import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { getAccessToken, stkPush } from "../lib/kcb_client.ts";
import { checkRateLimit, getRateLimitHeaders } from "../lib/rate_limit.ts";
import { logAuditEvent, createAlertIfNeeded } from "../lib/audit_log.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface STKPushRequest {
  phone: string;
  amount: number | string;
  sharedShortCode?: boolean;
  orgShortCode?: string;
  orgPassKey?: string;
  transactionDescription?: string;
  accountReference?: string;
}

function formatPhone(phone: string): string {
  let p = phone.replace(/\D/g, "");
  if (p.startsWith("0") && p.length === 10) return "254" + p.slice(1);
  if (p.startsWith("+254")) return p.slice(1);
  if (p.startsWith("254") && p.length === 12) return p;
  if (p.length === 9) return "254" + p;
  return p;
}

// generate a messageId
function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    // Extract client identifier for rate limiting
    const authHeader = req.headers.get('authorization');
    const clientId = authHeader?.split(' ')[1]?.slice(0, 10) || 'anonymous';

    // Check rate limit (100 requests per minute per client)
    const rateLimitResult = await checkRateLimit(supabase, clientId, {
      maxRequests: 100,
      windowSeconds: 60,
      keyPrefix: 'stk-push',
    });

    if (!rateLimitResult.allowed) {
      // Log rate limit event
      await logAuditEvent(supabase, {
        eventType: 'RATE_LIMIT_EXCEEDED',
        actor: clientId,
        resource: 'stk-push',
        action: 'Rate limit exceeded',
        status: 'BLOCKED',
        metadata: { remaining: rateLimitResult.remaining, resetAt: rateLimitResult.resetAt },
      }, req);

      await createAlertIfNeeded(supabase, 'RATE_LIMIT_EXCEEDED', { clientId, resetAt: rateLimitResult.resetAt });

      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            ...getRateLimitHeaders(rateLimitResult),
          },
        }
      );
    }

    const body: STKPushRequest = await req.json();

    if (!body.phone) return new Response(JSON.stringify({ error: 'Phone number is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!body.amount || Number(body.amount) <= 0) return new Response(JSON.stringify({ error: 'Amount must be greater than 0' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Load KCB settings
    let settings: any = null;
    try {
      const { data } = await supabase.from('kcb_settings').select('*').eq('id', 'kcb-settings').maybeSingle();
      settings = data ?? null;
    } catch (err) {
      console.debug('kcb_settings lookup error:', err?.message ?? err);
    }

    const clientId = settings?.client_id ?? Deno.env.get('KCB_BUNI_CLIENT_ID') ?? Deno.env.get('VITE_KCB_CLIENT_ID');
    const clientSecret = settings?.client_secret ?? Deno.env.get('KCB_BUNI_CLIENT_SECRET') ?? Deno.env.get('VITE_KCB_CLIENT_SECRET');
    const baseUrl = settings?.base_url ?? Deno.env.get('KCB_BUNI_BASE_URL') ?? Deno.env.get('VITE_KCB_BASE_URL');
    const tokenUrl = settings?.token_url ?? Deno.env.get('KCB_BUNI_TOKEN_URL') ?? Deno.env.get('VITE_KCB_TOKEN_URL') ?? (baseUrl ? `${baseUrl}/token` : undefined);
    const callbackUrl = settings?.callback_url ?? Deno.env.get('KCB_BUNI_CALLBACK_URL');

    if (!clientId || !clientSecret || !baseUrl || !tokenUrl) {
      return new Response(JSON.stringify({ error: 'KCB credentials or base URL are not configured' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const formattedPhone = formatPhone(String(body.phone));

    const token = await getAccessToken({ tokenUrl, clientId, clientSecret });

    // Build KCB STK push body per spec
    const stkBody: any = {
      phoneNumber: formattedPhone,
      amount: String(body.amount),
      invoiceNumber: body.accountReference || `KCBTILLNO-${Date.now()}`,
      sharedShortCode: body.sharedShortCode !== undefined ? !!body.sharedShortCode : true,
      orgShortCode: body.orgShortCode || settings?.org_shortcode || '',
      orgPassKey: body.orgPassKey || settings?.org_passkey || '',
      callbackUrl,
      transactionDescription: body.transactionDescription || 'POS Payment',
    };

    const headers = {
      routeCode: settings?.route_code || '207',
      operation: 'STKPush',
      messageId: generateMessageId(),
    } as Record<string,string>;

    const pushResp = await stkPush({ baseUrl, token, body: stkBody, headers });

    // Extract IDs from KCB response which may use response.header and response
    let merchantRequestId = null;
    let checkoutRequestId = null;
    try {
      if (pushResp?.response) {
        merchantRequestId = pushResp.response.MerchantRequestID || pushResp.response.merchantRequestId || null;
        checkoutRequestId = pushResp.response.CheckoutRequestID || pushResp.response.CheckoutRequestID || null;
      } else {
        merchantRequestId = pushResp.MerchantRequestID || pushResp.merchantRequestId || null;
        checkoutRequestId = pushResp.CheckoutRequestID || pushResp.checkoutRequestId || null;
      }
    } catch (err) { /* ignore parsing errors */ }

    // Persist to kcb_payments if table exists
    try {
      await supabase.from('kcb_payments').insert({
        checkout_request_id: checkoutRequestId,
        merchant_request_id: merchantRequestId,
        phone_number: formattedPhone,
        amount: Number(body.amount),
        status: 'pending',
        transaction_id: null,
        raw_request: stkBody,
        raw_response: pushResp,
        created_at: new Date().toISOString(),
      });
    } catch (err) {
      console.debug('Failed to insert kcb_payments row:', err?.message ?? err);
    }

    // Log successful STK push
    await logAuditEvent(supabase, {
      eventType: 'STK_PUSH_INITIATED',
      actor: clientId,
      resource: merchantRequestId || 'unknown',
      action: `STK Push initiated for ${formattedPhone}`,
      status: 'SUCCESS',
      metadata: {
        phone: formattedPhone,
        amount: body.amount,
        merchantRequestId,
        checkoutRequestId,
      },
    }, req);

    return new Response(JSON.stringify({ success: true, merchantRequestId, checkoutRequestId, raw: pushResp }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('kcb-stk error:', error);
    
    // Log error event
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    
    await logAuditEvent(supabase, {
      eventType: 'STK_PUSH_FAILED',
      actor: 'system',
      resource: 'stk-push',
      action: 'STK Push failed',
      status: 'FAILED',
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    }, req);

    await createAlertIfNeeded(supabase, 'STK_PUSH_FAILED', {
      error: error instanceof Error ? error.message : String(error),
    });

    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

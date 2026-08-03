import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, SupabaseClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// ============ Token cache (inlined from lib/kcb_client.ts) ============
interface TokenCache { access_token: string; expires_at: number; }
let tokenCache: TokenCache | null = null;
let ongoingTokenPromise: Promise<string> | null = null;

async function getAccessToken(params: { tokenUrl: string; clientId: string; clientSecret: string; }): Promise<string> {
  const { tokenUrl, clientId, clientSecret } = params;
  if (!tokenUrl || !clientId || !clientSecret) throw new Error('Missing KCB token config');

  if (tokenCache && Date.now() < tokenCache.expires_at - 5000) {
    return tokenCache.access_token;
  }

  if (ongoingTokenPromise) return ongoingTokenPromise;

  ongoingTokenPromise = (async () => {
    const body = new URLSearchParams();
    body.set('grant_type', 'client_credentials');

    const resp = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      },
      body: body.toString(),
    });

    const text = await resp.text();
    if (!resp.ok) {
      let msg = `Auth failed (${resp.status})`;
      try { const json = JSON.parse(text); msg = json.error_description || json.errorMessage || json.error || msg; } catch {}
      throw new Error(msg);
    }
    const data = JSON.parse(text);
    if (!data.access_token) throw new Error('No access token in response');
    const expiresIn = data.expires_in ? Number(data.expires_in) : 300;
    tokenCache = { access_token: data.access_token, expires_at: Date.now() + expiresIn * 1000 };
    ongoingTokenPromise = null;
    return tokenCache.access_token;
  })();

  return ongoingTokenPromise;
}

async function stkPush(params: { baseUrl: string; token: string; body: Record<string, any>; timeoutMs?: number; headers?: Record<string,string> }) {
  const { baseUrl, token, body, timeoutMs = 30000, headers = {} } = params;
  const url = `${baseUrl.replace(/\/$/, '')}/mm/api/request/1.0.0/stkpush`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const messageId = `JIMWAS-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'accept': 'application/json',
        'routeCode': '207',
        'operation': 'STKPush',
        'messageId': messageId,
        ...headers,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await resp.text();
    let data: any = {};
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!resp.ok) throw new Error(`STK push failed: ${resp.status} ${JSON.stringify(data)}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

// ============ Rate limiting (inlined from lib/rate_limit.ts) ============
interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
  keyPrefix: string;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter?: number;
}

async function checkRateLimit(
  supabase: SupabaseClient,
  identifier: string,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const key = `${config.keyPrefix}:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.windowSeconds;

  try {
    const { data: record, error: fetchError } = await supabase
      .from("api_rate_limits")
      .select("*")
      .eq("key", key)
      .maybeSingle();

    if (fetchError) {
      console.error("[kcb-stk] Rate limit fetch error:", fetchError);
      return { allowed: true, remaining: config.maxRequests, resetAt: now + config.windowSeconds };
    }

    if (!record || record.window_start < windowStart) {
      const { error: upsertError } = await supabase
        .from("api_rate_limits")
        .upsert(
          { key, count: 1, window_start: now, updated_at: new Date().toISOString() },
          { onConflict: "key" }
        );

      if (upsertError) {
        console.error("[kcb-stk] Rate limit upsert error:", upsertError);
        return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowSeconds };
      }

      return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowSeconds };
    }

    const remaining = config.maxRequests - record.count;

    if (remaining > 0) {
      const { error: updateError } = await supabase
        .from("api_rate_limits")
        .update({ count: record.count + 1, updated_at: new Date().toISOString() })
        .eq("key", key);

      if (updateError) {
        console.error("[kcb-stk] Rate limit increment error:", updateError);
      }

      return { allowed: true, remaining: remaining - 1, resetAt: record.window_start + config.windowSeconds };
    }

    const retryAfter = record.window_start + config.windowSeconds - now;
    return { allowed: false, remaining: 0, resetAt: record.window_start + config.windowSeconds, retryAfter: Math.max(1, retryAfter) };
  } catch (error) {
    console.error("[kcb-stk] Rate limit check error:", error);
    return { allowed: true, remaining: config.maxRequests, resetAt: now + config.windowSeconds };
  }
}

function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": "100",
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.resetAt),
    ...(result.retryAfter && { "Retry-After": String(result.retryAfter) }),
  };
}

// ============ Audit logging (inlined from lib/audit_log.ts) ============
type AuditEventType =
  | "STK_PUSH_INITIATED"
  | "STK_PUSH_SUCCESS"
  | "STK_PUSH_FAILED"
  | "IPN_RECEIVED"
  | "IPN_VERIFIED"
  | "IPN_FAILED"
  | "RATE_LIMIT_EXCEEDED"
  | "SIGNATURE_VERIFICATION_FAILED"
  | "CONFIG_ERROR";

interface AuditLogEntry {
  eventType: AuditEventType;
  actor: string;
  resource: string;
  action: string;
  status: "SUCCESS" | "FAILED" | "BLOCKED";
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

async function logAuditEvent(
  supabase: SupabaseClient,
  entry: AuditLogEntry,
  request?: Request
): Promise<void> {
  try {
    const ipAddress = getClientIP(request);
    const userAgent = request?.headers.get("user-agent") || undefined;

    const { error } = await supabase.from("api_audit_logs").insert({
      event_type: entry.eventType,
      actor: entry.actor,
      resource: entry.resource,
      action: entry.action,
      status: entry.status,
      metadata: entry.metadata || {},
      ip_address: ipAddress,
      user_agent: userAgent,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[kcb-stk] Audit log error:", error);
    }
  } catch (err) {
    console.error("[kcb-stk] Error logging audit event:", err);
  }
}

function getClientIP(request?: Request): string | null {
  if (!request) return null;
  const cfIP = request.headers.get("cf-connecting-ip");
  if (cfIP) return cfIP;
  const xForwardedFor = request.headers.get("x-forwarded-for");
  if (xForwardedFor) return xForwardedFor.split(",")[0].trim();
  const xRealIP = request.headers.get("x-real-ip");
  if (xRealIP) return xRealIP;
  return null;
}

async function createAlertIfNeeded(
  supabase: SupabaseClient,
  eventType: AuditEventType,
  metadata?: Record<string, any>
): Promise<void> {
  const criticalEvents = [
    "STK_PUSH_FAILED",
    "IPN_FAILED",
    "RATE_LIMIT_EXCEEDED",
    "SIGNATURE_VERIFICATION_FAILED",
    "CONFIG_ERROR",
  ];

  if (!criticalEvents.includes(eventType)) return;

  try {
    const { error } = await supabase.from("api_alerts").insert({
      event_type: eventType,
      severity: eventType === "RATE_LIMIT_EXCEEDED" ? "WARN" : "ERROR",
      message: `Alert: ${eventType}`,
      metadata: metadata || {},
      resolved: false,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error("[kcb-stk] Alert creation error:", error);
    }
  } catch (err) {
    console.error("[kcb-stk] Error creating alert:", err);
  }
}

// ============ Main handler ============
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

function generateMessageId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

    // Load KCB settings from database
    let settings: any = null;
    try {
      const { data } = await supabase.from('kcb_settings').select('*').eq('id', 'kcb-settings').maybeSingle();
      settings = data ?? null;
    } catch (err) {
      console.debug('kcb_settings lookup error:', err?.message ?? err);
    }

    const kcbClientId = settings?.client_id ?? Deno.env.get('KCB_BUNI_CLIENT_ID') ?? Deno.env.get('VITE_KCB_CLIENT_ID');
    const kcbClientSecret = settings?.client_secret ?? Deno.env.get('KCB_BUNI_CLIENT_SECRET') ?? Deno.env.get('VITE_KCB_CLIENT_SECRET');
    const baseUrl = settings?.base_url ?? Deno.env.get('KCB_BUNI_BASE_URL') ?? Deno.env.get('VITE_KCB_BASE_URL');
    const tokenUrl = settings?.token_url ?? Deno.env.get('KCB_BUNI_TOKEN_URL') ?? Deno.env.get('VITE_KCB_TOKEN_URL') ?? (baseUrl ? `${baseUrl}/token` : undefined);
    const callbackUrl = settings?.callback_url ?? Deno.env.get('KCB_BUNI_CALLBACK_URL');

    if (!kcbClientId || !kcbClientSecret || !baseUrl || !tokenUrl) {
      return new Response(JSON.stringify({ error: 'KCB credentials or base URL are not configured' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const formattedPhone = formatPhone(String(body.phone));

    const token = await getAccessToken({ tokenUrl, clientId: kcbClientId, clientSecret: kcbClientSecret });

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
    } as Record<string, string>;

    const pushResp = await stkPush({ baseUrl, token, body: stkBody, headers });

    // Extract IDs from KCB response
    let merchantRequestId = null;
    let checkoutRequestId = null;
    try {
      if (pushResp?.response) {
        merchantRequestId = pushResp.response.MerchantRequestID || pushResp.response.merchantRequestId || null;
        checkoutRequestId = pushResp.response.CheckoutRequestID || pushResp.response.checkoutRequestId || null;
      } else {
        merchantRequestId = pushResp.MerchantRequestID || pushResp.merchantRequestId || null;
        checkoutRequestId = pushResp.CheckoutRequestID || pushResp.checkoutRequestId || null;
      }
    } catch { /* ignore parsing errors */ }

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

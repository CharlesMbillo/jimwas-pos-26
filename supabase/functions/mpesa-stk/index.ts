import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface STKPushRequest {
  phone: string;
  amount: number;
  transactionId?: string;
  customerId?: string;
  cashierId?: string;
  cashierName?: string;
  accountReference?: string;
  transactionDesc?: string;
}

// Simple phone formatter
function formatPhone(phone: string): string {
  let p = phone.replace(/\D/g, "");
  if (p.startsWith("0") && p.length === 10) return "254" + p.slice(1);
  if (p.startsWith("+254")) return p.slice(1);
  if (p.startsWith("254") && p.length === 12) return p;
  if (p.length === 9) return "254" + p;
  return p;
}

// Simple token cache (in-memory for the function instance)
let cachedToken: { access_token: string; expires_at: number } | null = null;

async function getKcbAccessToken(clientId: string, clientSecret: string, tokenUrl: string) {
  if (cachedToken && Date.now() < cachedToken.expires_at - 5000) {
    return cachedToken.access_token;
  }

  const creds = btoa(`${clientId}:${clientSecret}`);
  const resp = await fetch(`${tokenUrl}?grant_type=client_credentials`, {
    method: 'GET',
    headers: { Authorization: `Basic ${creds}` },
  });

  const text = await resp.text();
  if (!resp.ok) {
    let msg = `Auth failed (${resp.status})`;
    try { const json = JSON.parse(text); msg = json.error_description || json.errorMessage || json.error || msg; } catch {}
    throw new Error(msg);
  }
  const data = JSON.parse(text);
  if (!data.access_token) throw new Error('No access token in KCB response');
  const expiresIn = data.expires_in ? Number(data.expires_in) : 300;
  cachedToken = { access_token: data.access_token, expires_at: Date.now() + (expiresIn * 1000) };
  return cachedToken.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const body: STKPushRequest = await req.json();

    if (!body.phone) return new Response(JSON.stringify({ error: 'Phone number is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    if (!body.amount || body.amount <= 0) return new Response(JSON.stringify({ error: 'Amount must be greater than 0' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Load KCB settings (prefer kcb_settings table, fall back to env)
    let settings: any = null;
    try {
      const { data, error } = await supabase.from('kcb_settings').select('*').eq('id', 'kcb-settings').maybeSingle();
      if (!error && data) settings = data;
    } catch (err) {
      console.debug('kcb_settings lookup error:', err?.message ?? err);
    }

    const clientId = settings?.client_id ?? Deno.env.get('KCB_BUNI_CLIENT_ID') ?? Deno.env.get('VITE_KCB_CLIENT_ID');
    const clientSecret = settings?.client_secret ?? Deno.env.get('KCB_BUNI_CLIENT_SECRET') ?? Deno.env.get('VITE_KCB_CLIENT_SECRET');
    const baseUrl = settings?.base_url ?? Deno.env.get('KCB_BUNI_BASE_URL') ?? Deno.env.get('VITE_KCB_BASE_URL');
    const tokenUrl = settings?.token_url ?? Deno.env.get('KCB_BUNI_TOKEN_URL') ?? Deno.env.get('VITE_KCB_TOKEN_URL') ?? (baseUrl ? `${baseUrl}/oauth/authorize` : undefined);
    const callbackUrl = settings?.callback_url ?? Deno.env.get('KCB_BUNI_CALLBACK_URL');

    if (!clientId || !clientSecret || !baseUrl || !tokenUrl) {
      return new Response(JSON.stringify({ error: 'KCB credentials or base URL are not configured' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const formattedPhone = formatPhone(body.phone);

    // Build STK push payload (KCB BUNI expected shape may vary — adjust as needed)
    const stkBody = {
      phoneNumber: formattedPhone,
      amount: Math.round(body.amount),
      invoiceNumber: body.accountReference || body.transactionId || `INV-${Date.now()}`,
      description: body.transactionDesc || 'POS Payment',
      callbackUrl,
    };

    console.log('Requesting KCB access token...');
    const accessToken = await getKcbAccessToken(clientId, clientSecret, tokenUrl);

    console.log('Sending STK Push to KCB:', JSON.stringify({ ...stkBody, phoneNumber: '***' }));
    const stkResp = await fetch(`${baseUrl}/stk/push`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stkBody),
    });

    const stkDataText = await stkResp.text();
    let stkData: any = {};
    try { stkData = JSON.parse(stkDataText); } catch { stkData = { raw: stkDataText }; }
    if (!stkResp.ok) {
      console.error('KCB STK push failed:', stkData);
      return new Response(JSON.stringify({ error: 'STK Push failed', detail: stkData }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Try to extract IDs from response (fields may differ)
    const merchantRequestId = stkData.MerchantRequestID || stkData.merchantRequestId || stkData.merchant_request_id || stkData.merchant_request || null;
    const checkoutRequestId = stkData.CheckoutRequestID || stkData.checkoutRequestId || stkData.checkout_request_id || stkData.checkout_request || null;

    // Persist to kcb_payments table if available
    try {
      const { data: insertData, error: insertErr } = await supabase.from('kcb_payments').insert({
        checkout_request_id: checkoutRequestId,
        merchant_request_id: merchantRequestId,
        phone_number: formattedPhone,
        amount: body.amount,
        status: 'pending',
        transaction_id: body.transactionId || null,
        customer_id: body.customerId || null,
        cashier_id: body.cashierId || null,
        cashier_name: body.cashierName || null,
        raw_request: stkBody,
        raw_response: stkData,
        created_at: new Date().toISOString(),
      }).select().single();
      if (insertErr) console.debug('kcb_payments insert failed:', insertErr.message);
    } catch (err) {
      console.debug('kcb_payments insert error:', err?.message ?? err);
    }

    return new Response(JSON.stringify({ success: true, merchantRequestId, checkoutRequestId, raw: stkData }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('KCB STK push handler error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

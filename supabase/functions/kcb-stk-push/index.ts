import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Idempotency-Key",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const normalizePhone = (value: string) => {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  return null;
};
const safeError = (error: unknown) => error instanceof Error ? error.message.replace(/(secret|token|passkey|authorization)\S*/gi, '[REDACTED]') : 'KCB request failed';

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

async function getToken(clientId: string, clientSecret: string, tokenUrl: string): Promise<string> {
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`KCB authentication failed (${response.status})`);
  const data = await response.json();
  if (typeof data.access_token !== 'string' || !data.access_token) throw new Error('KCB authentication returned no token');
  return data.access_token;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const supabase = createClient(supabaseUrl, serviceKey);
  const correlationId = req.headers.get('x-correlation-id') || crypto.randomUUID();

  try {
    const body = await req.json() as STKPushRequest;
    const phone = normalizePhone(body.phone);
    const amount = Number(body.amount);
    if (!phone) return json({ error: 'Invalid Kenyan phone number' }, 400);
    if (!Number.isFinite(amount) || amount <= 0 || Math.round(amount * 100) !== amount * 100 || amount > 999999.99) return json({ error: 'Amount must be a positive KES value with at most two decimals' }, 400);

    const { data: settings } = await supabase.from('kcb_settings').select('*').eq('id', 'kcb-settings').maybeSingle();
    if (!settings?.is_enabled) return json({ error: 'KCB is disabled or not configured' }, 400);
    if (!settings.client_id || !settings.client_secret || !settings.org_shortcode || !settings.org_passkey) return json({ error: 'KCB configuration is incomplete' }, 400);

    const reference = String(body.accountReference || body.transactionId || `POS-${Date.now()}`).slice(0, 50);
    const idempotencyKey = req.headers.get('x-idempotency-key') || `${body.transactionId || reference}:${phone}:${amount.toFixed(2)}`;
    const { data: existing } = await supabase.from('kcb_payments').select('id, status, checkout_request_id, merchant_request_id').eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existing && ['pending', 'processing', 'success'].includes(existing.status)) return json({ success: true, reused: true, checkoutRequestId: existing.checkout_request_id, merchantRequestId: existing.merchant_request_id, status: existing.status });

    const callbackUrl = settings.callback_url?.trim() || `${supabaseUrl}/functions/v1/kcb-ipn-notification`;
    const baseUrl = Deno.env.get('KCB_BUNI_BASE_URL') || (settings.environment === 'production' ? 'https://api.kcb.co.ke' : 'https://api.sandbox.kcb.co.ke');
    const tokenUrl = Deno.env.get('KCB_BUNI_TOKEN_URL') || `${baseUrl}/oauth/token`;
    const stkUrl = `${baseUrl.replace(/\/$/, '')}/mm/api/request/1.0.0/stkpush`;
    const messageId = `JIMWAS-${crypto.randomUUID()}`;
    const payload = { phoneNumber: phone, amount: String(amount), invoiceNumber: reference, sharedShortCode: false, orgShortCode: settings.org_shortcode, orgPassKey: settings.org_passkey, callbackUrl, transactionDescription: body.transactionDesc || 'POS Payment' };

    const { data: payment, error: insertError } = await supabase.from('kcb_payments').insert({ idempotency_key: idempotencyKey, transaction_id: body.transactionId || null, customer_id: body.customerId || null, phone_number: phone, amount, status: 'pending', cashier_id: body.cashierId || null, cashier_name: body.cashierName || null, raw_request: { ...payload, orgPassKey: '[REDACTED]' }, last_attempt_at: new Date().toISOString() }).select('id').single();
    if (insertError || !payment) return json({ error: 'Unable to create payment attempt' }, 503);

    try {
      const token = await getToken(settings.client_id, settings.client_secret, tokenUrl);
      const response = await fetch(stkUrl, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', accept: 'application/json', routeCode: '207', operation: 'STKPush', messageId, 'X-Correlation-ID': correlationId }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30000) });
      const text = await response.text();
      let data: Record<string, unknown> = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text.slice(0, 500) }; }
      const checkout = data.CheckoutRequestID || data.checkoutRequestId || data.checkout_request_id;
      const merchant = data.MerchantRequestID || data.merchantRequestId || data.merchant_request_id;
      const code = String(data.ResponseCode || data.responseCode || data.code || '');
      if (!response.ok || (code && !['0', '00000000'].includes(code)) || typeof checkout !== 'string') {
        await supabase.from('kcb_payments').update({ status: 'failed', result_code: code, result_desc: String(data.ResponseDescription || data.message || 'KCB rejected the request').slice(0, 500), error_message: 'Provider rejected STK request', raw_response: data, updated_at: new Date().toISOString() }).eq('id', payment.id);
        return json({ error: 'KCB did not accept the STK request', correlationId }, response.ok ? 400 : 502);
      }
      await supabase.from('kcb_payments').update({ checkout_request_id: checkout, merchant_request_id: merchant || null, status: 'processing', raw_response: data, updated_at: new Date().toISOString() }).eq('id', payment.id);
      return json({ success: true, checkoutRequestId: checkout, merchantRequestId: merchant, responseCode: code || '00000000', status: 'processing', correlationId });
    } catch (error) {
      await supabase.from('kcb_payments').update({ status: 'failed', error_message: 'KCB request failed', result_desc: safeError(error), updated_at: new Date().toISOString() }).eq('id', payment.id);
      return json({ error: 'KCB request failed', correlationId }, 502);
    }
  } catch {
    return json({ error: 'Invalid request body', correlationId }, 400);
  }
});

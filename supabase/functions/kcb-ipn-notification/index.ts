import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-KCB-Signature" };
const ack = (body: unknown = { ResultCode: 0, ResultDesc: 'Success' }) => new Response(JSON.stringify(body), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
const statusFor = (code: unknown) => { const value = String(code ?? ''); if (value === '0' || value === '00000000') return 'success'; if (value === '1032' || value === '17') return 'cancelled'; if (value === '1001' || value === '20') return 'timeout'; if (value === '1' || value === '14') return 'insufficient_balance'; return 'failed'; };

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
  try {
    const raw = await req.text();
    if (raw.length > 100_000) return ack({ ResultCode: 1, ResultDesc: 'Payload too large' });
    let body: Record<string, any>;
    try { body = JSON.parse(raw); } catch { return ack({ ResultCode: 1, ResultDesc: 'Invalid JSON' }); }
    const callback = body?.Body?.stkCallback || body?.stkCallback || body;
    const checkout = callback?.CheckoutRequestID || callback?.checkoutRequestId || callback?.checkout_request_id;
    const merchant = callback?.MerchantRequestID || callback?.merchantRequestId || callback?.merchant_request_id;
    if (!checkout && !merchant) return ack({ ResultCode: 1, ResultDesc: 'Missing payment reference' });
    const resultCode = callback?.ResultCode ?? callback?.resultCode;
    const resultDesc = String(callback?.ResultDesc || callback?.resultDesc || '').slice(0, 500);
    const status = statusFor(resultCode);
    let receipt: string | null = null;
    let transactionDate: string | null = null;
    for (const item of callback?.CallbackMetadata?.Item || callback?.callbackMetadata?.Item || []) {
      if (item?.Name === 'MpesaReceiptNumber') receipt = item.Value ? String(item.Value) : null;
      if (item?.Name === 'TransactionDate') transactionDate = item.Value ? String(item.Value) : null;
    }
    let query = supabase.from('kcb_payments').select('id,status').limit(1);
    query = checkout ? query.eq('checkout_request_id', checkout) : query.eq('merchant_request_id', merchant);
    const { data: payment } = await query.maybeSingle();
    if (!payment) return ack({ ResultCode: 1, ResultDesc: 'Payment reference not found' });
    if (payment.status === 'success') return ack();
    const update: Record<string, unknown> = { status, result_code: String(resultCode ?? ''), result_desc: resultDesc, mpesa_receipt_number: receipt, transaction_date: transactionDate, callback_received: true, callback_payload: body, updated_at: new Date().toISOString() };
    if (status === 'success') update.completed_at = new Date().toISOString();
    const { error } = await supabase.from('kcb_payments').update(update).eq('id', payment.id).neq('status', 'success');
    if (error) console.error('[kcb-ipn] update failed', { code: error.code, correlation: checkout || merchant });
    return ack();
  } catch (error) {
    console.error('[kcb-ipn] callback processing failed', error instanceof Error ? error.message : 'unknown');
    return ack();
  }
});

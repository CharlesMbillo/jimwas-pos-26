import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-kcb-signature",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const rawBody = await req.text();
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    let body;
    try { body = JSON.parse(rawBody); } catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

    // Handle KCB BUNI IPN format: { Body: { stkCallback: { ... } } }
    const stkCallback = body?.Body?.stkCallback || body?.stkCallback || body;
    if (!stkCallback) {
      console.warn("Callback missing stkCallback body:", body);
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Acknowledged" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const checkoutRequestId = stkCallback.CheckoutRequestID || stkCallback.checkoutRequestId || stkCallback.checkout_request_id;
    const merchantRequestId = stkCallback.MerchantRequestID || stkCallback.merchantRequestId || stkCallback.merchant_request_id;
    const resultCode = stkCallback.ResultCode ?? stkCallback.resultCode;
    const resultDesc = stkCallback.ResultDesc || stkCallback.resultDesc || '';

    let mpesaReceiptNumber: string | null = null;
    let transactionDate: string | null = null;
    const metadata = stkCallback.CallbackMetadata?.Item || stkCallback.callbackMetadata?.Item || [];
    for (const item of metadata) {
      switch (item.Name) {
        case 'MpesaReceiptNumber': mpesaReceiptNumber = String(item.Value || ''); break;
        case 'TransactionDate': transactionDate = String(item.Value || ''); break;
      }
    }

    let status: string;
    if (resultCode === 0 || resultCode === '0') status = 'success';
    else if (resultCode === 1032) status = 'cancelled';
    else if (resultCode === 1001) status = 'timeout';
    else if (resultCode === 1 || resultCode === '1') status = 'insufficient_balance';
    else if (resultCode === 2001) status = 'invalid_pin';
    else status = 'failed';

    // Update kcb_payments by checkout_request_id
    const { data: kcbPayment, error: kcbError } = await supabase
      .from('kcb_payments')
      .update({
        status,
        result_code: String(resultCode ?? ''),
        result_desc: resultDesc,
        mpesa_receipt_number: mpesaReceiptNumber,
        transaction_date: transactionDate,
        callback_received: true,
        callback_payload: body,
        updated_at: new Date().toISOString(),
      })
      .eq('checkout_request_id', checkoutRequestId)
      .in('status', ['pending', 'processing'])
      .select()
      .maybeSingle();

    if (kcbError) {
      console.error("Failed to update kcb_payments:", kcbError);
    } else if (kcbPayment) {
      console.log("kcb_payments updated:", kcbPayment.id, "status:", status);
      // If successful and linked to a transaction, update it
      if (status === 'success' && kcbPayment.transaction_id) {
        await supabase.from('transactions').update({
          status: 'completed',
          payment_reference: mpesaReceiptNumber,
          updated_at: new Date().toISOString(),
        }).eq('id', kcbPayment.transaction_id).neq('status', 'completed');
      }
    }

    // Also try mpesa_transactions for backward compatibility
    const { data: mpesaTx } = await supabase
      .from('mpesa_transactions')
      .update({
        status,
        result_code: String(resultCode ?? ''),
        result_desc: resultDesc,
        mpesa_receipt_number: mpesaReceiptNumber,
        transaction_date: transactionDate,
        callback_received: true,
        callback_payload: body,
        updated_at: new Date().toISOString(),
      })
      .eq('checkout_request_id', checkoutRequestId)
      .in('status', ['pending', 'processing'])
      .select()
      .maybeSingle();

    if (mpesaTx && status === 'success' && mpesaTx.transaction_id) {
      await supabase.from('transactions').update({
        status: 'completed',
        payment_reference: mpesaReceiptNumber,
        updated_at: new Date().toISOString(),
      }).eq('id', mpesaTx.transaction_id).neq('status', 'completed');
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Success" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Callback error:", error);
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: "Acknowledged" }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

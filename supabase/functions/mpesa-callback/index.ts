import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-kcb-signature",
};

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----BEGIN PUBLIC KEY-----/g, '').replace(/-----END PUBLIC KEY-----/g, '').replace(/\r?\n|\r/g, '').trim();
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function verifySignature(rawBody: string, signatureBase64: string, publicPem: string): Promise<boolean> {
  try {
    if (!publicPem || !signatureBase64) return false;
    const publicKeyDer = pemToArrayBuffer(publicPem);
    const publicKey = await crypto.subtle.importKey(
      'spki',
      publicKeyDer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const encoder = new TextEncoder();
    const data = encoder.encode(rawBody);
    const signature = base64ToArrayBuffer(signatureBase64);
    return await crypto.subtle.verify('RSASSA-PKCS1-v1_5', publicKey, signature, data);
  } catch (e) {
    console.error('Signature verification error:', e);
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const rawBody = await req.text();
    const signature = req.headers.get('x-kcb-signature') ?? req.headers.get('X-KCB-SIGNATURE') ?? '';
    const publicPem = Deno.env.get('KCB_PUBLIC_PEM') ?? '';

    if (publicPem) {
      const valid = await verifySignature(rawBody, signature, publicPem);
      if (!valid) {
        console.warn('Invalid KCB signature; rejecting callback');
        return new Response(JSON.stringify({ ResultCode: '401', ResultDesc: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } else {
      console.warn('KCB public cert not configured (KCB_PUBLIC_PEM); skipping signature verification');
    }

    const body = JSON.parse(rawBody);
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const stkCallback = body?.Body?.stkCallback;
    if (!stkCallback) {
      console.warn('Callback missing stkCallback body', body);
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Acknowledged' }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc;

    let mpesaReceiptNumber: string | null = null;
    let transactionDate: string | null = null;
    if (stkCallback.CallbackMetadata?.Item) {
      for (const item of stkCallback.CallbackMetadata.Item) {
        switch (item.Name) {
          case 'Amount':
            break;
          case 'MpesaReceiptNumber':
            mpesaReceiptNumber = String(item.Value || '');
            break;
          case 'TransactionDate':
            transactionDate = String(item.Value || '');
            break;
          case 'PhoneNumber':
            break;
        }
      }
    }

    let status: string;
    if (resultCode === 0) status = 'success';
    else if (resultCode === 1032) status = 'cancelled';
    else if (resultCode === 1001) status = 'timeout';
    else if (resultCode === 1) status = 'insufficient_balance';
    else if (resultCode === 2001) status = 'invalid_pin';
    else status = 'failed';

    const { data: updatedTx, error: updateError } = await supabase
      .from('mpesa_transactions')
      .update({
        status,
        result_code: String(resultCode),
        result_desc: resultDesc,
        mpesa_receipt_number: mpesaReceiptNumber,
        transaction_date: transactionDate,
        callback_received: true,
        callback_payload: body,
        updated_at: new Date().toISOString(),
      })
      .eq('checkout_request_id', checkoutRequestId)
      .select()
      .single();

    if (updateError) {
      console.error('Failed to update mpesa transaction:', updateError);
      return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Acknowledged' }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (status === 'success' && updatedTx?.transaction_id) {
      const { error: txUpdateError } = await supabase
        .from('transactions')
        .update({
          status: 'completed',
          payment_reference: mpesaReceiptNumber,
          updated_at: new Date().toISOString(),
        })
        .eq('id', updatedTx.transaction_id);

      if (txUpdateError) console.error('Failed to update transaction:', txUpdateError);
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Success' }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error('M-Pesa callback error:', error);
    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'Acknowledged' }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

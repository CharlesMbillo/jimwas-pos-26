import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface MpesaCallbackBody {
  Body: {
    stkCallback: {
      MerchantRequestID: string;
      CheckoutRequestID: string;
      ResultCode: number;
      ResultDesc: string;
      CallbackMetadata?: {
        Item: Array<{
          Name: string;
          Value?: string | number;
        }>;
      };
    };
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const body: MpesaCallbackBody = await req.json();
    const { stkCallback } = body.Body;

    console.log('M-Pesa Callback received:', JSON.stringify(body, null, 2));

    const checkoutRequestId = stkCallback.CheckoutRequestID;
    const merchantRequestId = stkCallback.MerchantRequestID;
    const resultCode = stkCallback.ResultCode;
    const resultDesc = stkCallback.ResultDesc;

    // Extract callback metadata if payment was successful
    let mpesaReceiptNumber: string | null = null;
    let transactionDate: string | null = null;
    let phoneNumber: string | null = null;
    let amount: number | null = null;

    if (stkCallback.CallbackMetadata?.Item) {
      console.log('Callback metadata:', JSON.stringify(stkCallback.CallbackMetadata.Item, null, 2));
      for (const item of stkCallback.CallbackMetadata.Item) {
        switch (item.Name) {
          case 'Amount':
            amount = Number(item.Value) || null;
            break;
          case 'MpesaReceiptNumber':
            mpesaReceiptNumber = String(item.Value || '');
            break;
          case 'TransactionDate':
            transactionDate = String(item.Value || '');
            break;
          case 'PhoneNumber':
            phoneNumber = String(item.Value || '');
            break;
        }
      }
    }

    // Determine status based on result code
    // Reference: https://developer.safaricom.co.ke/APIs/MpesaExpressSimulate
    let status: string;
    if (resultCode === 0) {
      status = 'success';
    } else if (resultCode === 1032) {
      // Request cancelled by user
      status = 'cancelled';
    } else if (resultCode === 1001) {
      // Timeout - user didn't respond
      status = 'timeout';
    } else if (resultCode === 1) {
      // Insufficient balance
      status = 'insufficient_balance';
    } else if (resultCode === 2001) {
      // Invalid PIN
      status = 'invalid_pin';
    } else {
      status = 'failed';
    }

    console.log(`Transaction ${checkoutRequestId}: status=${status}, resultCode=${resultCode}, receipt=${mpesaReceiptNumber}`);

    // Update transaction in database
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
      // Still return success to M-Pesa to avoid retries
      return new Response(
        JSON.stringify({ ResultCode: 0, ResultDesc: 'Acknowledged' }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log('Transaction updated successfully:', updatedTx?.id);

    // If payment successful and linked to a transaction, update it
    if (status === 'success' && updatedTx?.transaction_id) {
      const { error: txUpdateError } = await supabase
        .from('transactions')
        .update({
          status: 'completed',
          payment_reference: mpesaReceiptNumber,
          updated_at: new Date().toISOString(),
        })
        .eq('id', updatedTx.transaction_id);

      if (txUpdateError) {
        console.error('Failed to update transaction:', txUpdateError);
      } else {
        console.log(`Transaction ${updatedTx.transaction_id} marked as completed`);
      }
    }

    // Return success to M-Pesa (must always return 200 with ResultCode: 0)
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: 'Success' }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error('M-Pesa callback error:', error);
    // Still return success to avoid M-Pesa retries
    return new Response(
      JSON.stringify({ ResultCode: 0, ResultDesc: 'Acknowledged' }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

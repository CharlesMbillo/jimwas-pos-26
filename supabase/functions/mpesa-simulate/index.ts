import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Sandbox UAT: directly simulates a successful M-Pesa callback by updating
// the mpesa_transactions row to "success" with a generated receipt number.
// The frontend polling picks up the status change and completes the sale.
// This bypasses Daraja entirely — it's for UAT testing only.

function generateReceiptNumber(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  let receipt = "";
  for (let i = 0; i < 10; i++) {
    receipt += chars[Math.floor(Math.random() * chars.length)];
  }
  return receipt;
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

    const { checkoutRequestId, phone, amount } = await req.json();

    // Load settings — must be sandbox
    const { data: settings } = await supabase
      .from("mpesa_settings")
      .select("environment, is_enabled")
      .eq("id", "mpesa-settings")
      .single();

    if (!settings || settings.environment !== "sandbox") {
      return new Response(
        JSON.stringify({ error: "Simulation only available in sandbox environment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const receiptNumber = generateReceiptNumber();
    const now = new Date().toISOString();
    const txnDate = new Date();
    const formattedDate = [
      txnDate.getFullYear(),
      String(txnDate.getMonth() + 1).padStart(2, "0"),
      String(txnDate.getDate()).padStart(2, "0"),
      String(txnDate.getHours()).padStart(2, "0"),
      String(txnDate.getMinutes()).padStart(2, "0"),
      String(txnDate.getSeconds()).padStart(2, "0"),
    ].join("");

    // Build a fake callback payload matching Daraja's format
    const fakeCallback = {
      Body: {
        stkCallback: {
          MerchantRequestID: "sim-" + Date.now(),
          CheckoutRequestID: checkoutRequestId,
          ResultCode: 0,
          ResultDesc: "The service request is processed successfully.",
          CallbackMetadata: {
            Item: [
              { Name: "Amount", Value: Math.round(amount) || 1 },
              { Name: "MpesaReceiptNumber", Value: receiptNumber },
              { Name: "TransactionDate", Value: formattedDate },
              { Name: "PhoneNumber", Value: phone || "254708374149" },
            ],
          },
        },
      },
    };

    // Update the mpesa_transactions row
    let updatedTx = null;

    if (checkoutRequestId && !checkoutRequestId.startsWith("sim-")) {
      // Real checkout request ID from STK push — update the existing row
      const { data, error } = await supabase
        .from("mpesa_transactions")
        .update({
          status: "success",
          result_code: "0",
          result_desc: "The service request is processed successfully.",
          mpesa_receipt_number: receiptNumber,
          transaction_date: formattedDate,
          callback_received: true,
          callback_payload: fakeCallback,
          updated_at: now,
        })
        .eq("checkout_request_id", checkoutRequestId)
        .select()
        .single();

      if (error) {
        console.error("Failed to update mpesa transaction:", error);
        return new Response(
          JSON.stringify({ error: "Failed to simulate: " + error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      updatedTx = data;
    } else {
      // No real checkout ID (STK push failed) — create a synthetic transaction
      const syntheticId = `sim-${Date.now()}`;
      const { data, error } = await supabase
        .from("mpesa_transactions")
        .insert({
          checkout_request_id: syntheticId,
          merchant_request_id: "sim-" + Date.now(),
          phone_number: phone || "254708374149",
          amount: Math.round(amount) || 1,
          status: "success",
          result_code: "0",
          result_desc: "The service request is processed successfully.",
          mpesa_receipt_number: receiptNumber,
          transaction_date: formattedDate,
          callback_received: true,
          callback_payload: fakeCallback,
        })
        .select()
        .single();

      if (error) {
        console.error("Failed to create simulated transaction:", error);
        return new Response(
          JSON.stringify({ error: "Failed to simulate: " + error.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      updatedTx = data;
    }

    // If linked to a POS transaction, mark it completed
    if (updatedTx?.transaction_id) {
      const { error: txError } = await supabase
        .from("transactions")
        .update({
          status: "completed",
          payment_reference: receiptNumber,
          updated_at: now,
        })
        .eq("id", updatedTx.transaction_id);

      if (txError) {
        console.error("Failed to update linked transaction:", txError);
      }
    }

    console.log("Simulation complete:", { receipt: receiptNumber, checkoutId: checkoutRequestId });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Payment simulated successfully",
        receiptNumber,
        checkoutRequestId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Simulate error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Simulation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

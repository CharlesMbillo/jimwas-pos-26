import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");
    const { checkoutRequestId } = await req.json();

    if (!checkoutRequestId) {
      return new Response(JSON.stringify({ error: "checkoutRequestId is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Try kcb_payments first (KCB BUNI flow)
    const { data: kcbPayment, error: kcbError } = await supabase
      .from("kcb_payments")
      .select("*")
      .eq("checkout_request_id", checkoutRequestId)
      .maybeSingle();

    if (!kcbError && kcbPayment) {
      return new Response(JSON.stringify({
        success: true,
        status: kcbPayment.status,
        mpesaReceiptNumber: kcbPayment.mpesa_receipt_number,
        resultDesc: kcbPayment.result_desc || kcbPayment.error_message,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fall back to mpesa_transactions (legacy Safaricom Daraja flow)
    const { data: mpesaTx, error: txError } = await supabase
      .from("mpesa_transactions")
      .select("*")
      .eq("checkout_request_id", checkoutRequestId)
      .maybeSingle();

    if (txError || !mpesaTx) {
      return new Response(JSON.stringify({ error: "Transaction not found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // If callback already resolved it, return from DB
    if (mpesaTx.callback_received && mpesaTx.status !== "pending" && mpesaTx.status !== "processing") {
      return new Response(JSON.stringify({
        success: true,
        status: mpesaTx.status,
        mpesaReceiptNumber: mpesaTx.mpesa_receipt_number,
        resultDesc: mpesaTx.result_desc,
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Return current DB status (callback may not have arrived yet)
    return new Response(JSON.stringify({
      success: true,
      status: mpesaTx.status || "pending",
      mpesaReceiptNumber: mpesaTx.mpesa_receipt_number,
      resultDesc: mpesaTx.result_desc || "Waiting for callback",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("Status check error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Failed to check status" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

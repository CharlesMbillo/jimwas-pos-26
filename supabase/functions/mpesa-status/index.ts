import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function generateTimestamp(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ].join("");
}

async function getAccessToken(
  consumerKey: string,
  consumerSecret: string,
  environment: string
): Promise<string> {
  const baseUrl =
    environment === "production"
      ? "https://api.safaricom.co.ke"
      : "https://sandbox.safaricom.co.ke";
  const credentials = btoa(`${consumerKey}:${consumerSecret}`);
  const resp = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${credentials}` },
  });
  const data = await resp.json();
  if (!resp.ok || !data.access_token) throw new Error(data.error_description || `Auth failed (${resp.status})`);
  return data.access_token;
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

    const { checkoutRequestId } = await req.json();
    if (!checkoutRequestId) {
      return new Response(
        JSON.stringify({ error: "checkoutRequestId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get transaction from DB
    const { data: mpesaTx, error: txError } = await supabase
      .from("mpesa_transactions")
      .select("*")
      .eq("checkout_request_id", checkoutRequestId)
      .single();

    if (txError || !mpesaTx) {
      return new Response(
        JSON.stringify({ error: "Transaction not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If callback already resolved it, return from DB — no need to call Safaricom
    if (mpesaTx.callback_received && mpesaTx.status !== "pending" && mpesaTx.status !== "processing") {
      return new Response(
        JSON.stringify({
          success: true,
          status: mpesaTx.status,
          mpesaReceiptNumber: mpesaTx.mpesa_receipt_number,
          resultDesc: mpesaTx.result_desc,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get M-Pesa settings for live query
    const { data: settings } = await supabase
      .from("mpesa_settings")
      .select("*")
      .eq("id", "mpesa-settings")
      .single();

    // If we can't query Safaricom (missing credentials), return current DB status
    const effectiveShortCode = settings?.till_number || settings?.short_code;
    if (!settings?.consumer_key || !settings?.consumer_secret || !settings?.passkey || !effectiveShortCode) {
      return new Response(
        JSON.stringify({
          success: true,
          status: mpesaTx.status,
          mpesaReceiptNumber: mpesaTx.mpesa_receipt_number,
          resultDesc: mpesaTx.result_desc || "Waiting for callback",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const baseUrl =
      settings.environment === "production"
        ? "https://api.safaricom.co.ke"
        : "https://sandbox.safaricom.co.ke";

    const accessToken = await getAccessToken(
      settings.consumer_key,
      settings.consumer_secret,
      settings.environment
    );

    const timestamp = generateTimestamp();
    const password = btoa(effectiveShortCode + settings.passkey + timestamp);

    const queryResp = await fetch(`${baseUrl}/mpesa/stkpushquery/v1/query`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        BusinessShortCode: effectiveShortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId,
      }),
    });

    const result = await queryResp.json();
    console.log("STK Query result:", JSON.stringify(result));

    let newStatus = mpesaTx.status;
    if (result.ResultCode === 0 || result.resultCode === 0) {
      newStatus = "success";
    } else if (result.errorCode === "500.001.1001") {
      newStatus = "pending"; // still waiting
    } else if (result.ResultCode === 1032 || result.resultCode === 1032) {
      newStatus = "cancelled";
    } else if (result.ResultCode === 1 || result.resultCode === 1) {
      newStatus = "insufficient_balance";
    } else if (result.ResultCode === 2001 || result.resultCode === 2001) {
      newStatus = "invalid_pin";
    } else if (result.ResultCode === 1001 || result.resultCode === 1001) {
      newStatus = "timeout";
    } else if (result.errorCode) {
      newStatus = "failed";
    } else if ((result.ResultCode && result.ResultCode !== 0) || (result.resultCode && result.resultCode !== 0)) {
      newStatus = "failed";
    }

    if (newStatus !== mpesaTx.status) {
      await supabase
        .from("mpesa_transactions")
        .update({
          status: newStatus,
          result_code: String(result.ResultCode ?? result.resultCode ?? result.errorCode ?? ""),
          result_desc: result.ResultDesc ?? result.resultDesc ?? result.errorMessage ?? "",
          updated_at: new Date().toISOString(),
        })
        .eq("checkout_request_id", checkoutRequestId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        status: newStatus,
        mpesaReceiptNumber: mpesaTx.mpesa_receipt_number,
        resultDesc: result.ResultDesc ?? result.resultDesc ?? result.errorMessage ?? mpesaTx.result_desc,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Status check error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Failed to check status" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

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

// Format phone to 254XXXXXXXXX
function formatPhone(phone: string): string {
  let p = phone.replace(/\D/g, "");
  if (p.startsWith("0") && p.length === 10) return "254" + p.slice(1);
  if (p.startsWith("+254")) return p.slice(1);
  if (p.startsWith("254") && p.length === 12) return p;
  if (p.length === 9) return "254" + p;
  return p;
}

async function getKCBAccessToken(
  clientId: string,
  clientSecret: string,
  tokenUrl: string
): Promise<string> {
  const credentials = btoa(`${clientId}:${clientSecret}`);
  const resp = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const text = await resp.text();
  if (!resp.ok) {
    let msg = `Token request failed (${resp.status})`;
    try {
      const json = JSON.parse(text);
      msg = json.error_description || json.error || msg;
    } catch { /* ignore */ }
    throw new Error(msg);
  }

  const data = JSON.parse(text);
  if (!data.access_token) throw new Error("No access token in response");
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const body: STKPushRequest = await req.json();

    if (!body.phone) {
      return new Response(
        JSON.stringify({ error: "Phone number is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!body.amount || body.amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Amount must be greater than 0" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Load KCB settings
    const { data: settings, error: settingsError } = await supabase
      .from("kcb_settings")
      .select("*")
      .eq("id", "kcb-settings")
      .single();

    if (settingsError || !settings) {
      return new Response(
        JSON.stringify({ error: "KCB settings not found. Configure KCB in Settings > Payments." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.is_enabled) {
      return new Response(
        JSON.stringify({ error: "KCB is disabled. Enable it in Settings > Payments." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.client_id || !settings.client_secret) {
      return new Response(
        JSON.stringify({ error: "KCB Client ID and Secret are required. Configure them in Settings > Payments." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!settings.org_passkey || !settings.org_shortcode) {
      return new Response(
        JSON.stringify({ error: "KCB Organization Passkey and Short Code are required. Configure them in Settings > Payments." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const formattedPhone = formatPhone(body.phone);
    if (formattedPhone.length !== 12 || !formattedPhone.startsWith("254")) {
      return new Response(
        JSON.stringify({ error: `Invalid phone number format: ${body.phone}. Use format 07XXXXXXXX or +2547XXXXXXXX` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get environment-specific URLs
    const baseUrl = settings.environment === 'production'
      ? 'https://api.kcb.co.ke'
      : 'https://api.sandbox.kcb.co.ke';
    
    const tokenUrl = `${baseUrl}/oauth/token`;
    const stkPushUrl = `${baseUrl}/stk/push`;

    // Get access token
    let token: string;
    try {
      token = await getKCBAccessToken(settings.client_id, settings.client_secret, tokenUrl);
    } catch (err: any) {
      return new Response(
        JSON.stringify({ error: `KCB authentication failed: ${err.message}` }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare STK Push request
    const timestamp = new Date().toISOString();
    const stkPayload = {
      phoneNumber: formattedPhone,
      amount: Math.floor(body.amount), // Ensure integer
      invoiceNumber: body.transactionId || `INV-${Date.now()}`,
      orgShortCode: settings.org_shortcode,
      orgPassKey: settings.org_passkey,
      transactionDescription: body.transactionDesc || 'POS Payment',
      callbackUrl: `${supabaseUrl}/functions/v1/kcb-callback`,
      sharedShortCode: false,
      metadata: {
        cashierId: body.cashierId,
        cashierName: body.cashierName,
        accountReference: body.accountReference,
      },
    };

    // Call KCB STK Push
    const stkResponse = await fetch(stkPushUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(stkPayload),
    });

    const stkText = await stkResponse.text();
    console.error('[v0] KCB STK Response - Status:', stkResponse.status, 'Body:', stkText, 'URL:', stkPushUrl);

    if (!stkResponse.ok) {
      let errorMsg = `STK Push failed (${stkResponse.status})`;
      try {
        const errorData = JSON.parse(stkText);
        errorMsg = errorData.ResponseDescription || errorData.message || errorMsg;
      } catch { /* ignore */ }
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: stkResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!stkText) {
      return new Response(
        JSON.stringify({ error: "Empty response from KCB service - no body returned" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let stkData;
    try {
      stkData = JSON.parse(stkText);
    } catch (parseError) {
      console.error('[v0] Failed to parse KCB response:', parseError, 'Text:', stkText);
      return new Response(
        JSON.stringify({ error: "Invalid JSON response from KCB service" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        checkoutRequestId: stkData.CheckoutRequestID || stkData.checkoutRequestId,
        merchantRequestId: stkData.MerchantRequestID || stkData.merchantRequestId,
        mpesaTransactionId: stkData.MpesaTransactionID || stkData.mpesaTransactionId,
        responseCode: stkData.ResponseCode || stkData.responseCode,
        responseMessage: stkData.ResponseDescription || stkData.responseMessage,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error('KCB STK Push error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

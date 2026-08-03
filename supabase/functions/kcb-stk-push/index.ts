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
      .maybeSingle();

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

    // Determine environment-specific base URL
    // Use callback_url from settings if available, otherwise construct from Supabase URL
    const callbackUrl = settings.callback_url || `${supabaseUrl}/functions/v1/kcb-ipn-notification`;

    // Determine the KCB API base URL from settings or environment
    const envBaseUrl = settings.environment === 'production'
      ? (Deno.env.get('KCB_BUNI_BASE_URL') || 'https://api.kcb.co.ke')
      : (Deno.env.get('KCB_BUNI_SANDBOX_URL') || Deno.env.get('KCB_BUNI_BASE_URL') || 'https://api.sandbox.kcb.co.ke');

    const tokenUrl = `${envBaseUrl}/oauth/token`;
    const stkPushUrl = `${envBaseUrl}/mm/api/request/1.0.0/stkpush`;

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

    // Prepare STK Push request per KCB BUNI spec
    const messageId = `JIMWAS-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    const stkPayload = {
      phoneNumber: formattedPhone,
      amount: String(body.amount),
      invoiceNumber: body.accountReference || `INV-${Date.now()}`,
      sharedShortCode: false,
      orgShortCode: settings.org_shortcode,
      orgPassKey: settings.org_passkey,
      callbackUrl,
      transactionDescription: body.transactionDesc || 'POS Payment',
    };

    // Insert pending payment record into kcb_payments BEFORE calling KCB
    // so the callback can find it even if the STK response is slow
    const { data: paymentRow, error: insertError } = await supabase
      .from('kcb_payments')
      .insert({
        phone_number: formattedPhone,
        amount: body.amount,
        status: 'pending',
        cashier_id: body.cashierId || null,
        cashier_name: body.cashierName || null,
        raw_request: stkPayload,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('[kcb-stk-push] Failed to insert kcb_payments row:', insertError);
    }

    // Call KCB STK Push
    const stkResponse = await fetch(stkPushUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'accept': 'application/json',
        'routeCode': '207',
        'operation': 'STKPush',
        'messageId': messageId,
      },
      body: JSON.stringify(stkPayload),
    });

    const stkText = await stkResponse.text();
    console.log('[kcb-stk-push] KCB STK Response - Status:', stkResponse.status, 'Body:', stkText);

    if (!stkResponse.ok) {
      let errorMsg = `STK Push failed (${stkResponse.status})`;
      try {
        const errorData = JSON.parse(stkText);
        errorMsg = errorData.ResponseDescription || errorData.message || errorMsg;
      } catch { /* ignore */ }

      // Update payment record with error
      if (paymentRow) {
        await supabase.from('kcb_payments').update({
          status: 'failed',
          error_message: errorMsg,
          raw_response: stkText ? JSON.parse(stkText) : null,
          updated_at: new Date().toISOString(),
        }).eq('id', paymentRow.id);
      }

      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: stkResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!stkText) {
      const errorMsg = "Empty response from KCB service";
      if (paymentRow) {
        await supabase.from('kcb_payments').update({
          status: 'failed',
          error_message: errorMsg,
          updated_at: new Date().toISOString(),
        }).eq('id', paymentRow.id);
      }
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let stkData;
    try {
      stkData = JSON.parse(stkText);
    } catch (parseError) {
      console.error('[kcb-stk-push] Failed to parse KCB response:', parseError);
      if (paymentRow) {
        await supabase.from('kcb_payments').update({
          status: 'failed',
          error_message: 'Invalid JSON response from KCB',
          raw_response: { raw: stkText },
          updated_at: new Date().toISOString(),
        }).eq('id', paymentRow.id);
      }
      return new Response(
        JSON.stringify({ error: "Invalid JSON response from KCB service" }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract IDs from KCB response (handle multiple possible field names)
    const checkoutRequestId = stkData.CheckoutRequestID || stkData.checkoutRequestId || stkData.checkout_request_id;
    const merchantRequestId = stkData.MerchantRequestID || stkData.merchantRequestId || stkData.merchant_request_id;
    const responseCode = stkData.ResponseCode || stkData.responseCode || stkData.code;

    // Check if STK push was accepted by KCB
    // KCB returns ResponseCode "00000000" for success
    if (responseCode && responseCode !== '00000000' && responseCode !== '0') {
      const errorMsg = stkData.ResponseDescription || stkData.responseMessage || stkData.message || 'STK Push rejected by KCB';
      if (paymentRow) {
        await supabase.from('kcb_payments').update({
          status: 'failed',
          error_message: errorMsg,
          result_code: String(responseCode),
          result_desc: stkData.ResponseDescription || stkData.responseMessage,
          raw_response: stkData,
          updated_at: new Date().toISOString(),
        }).eq('id', paymentRow.id);
      }
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!checkoutRequestId) {
      const errorMsg = 'No CheckoutRequestID returned by KCB';
      if (paymentRow) {
        await supabase.from('kcb_payments').update({
          status: 'failed',
          error_message: errorMsg,
          raw_response: stkData,
          updated_at: new Date().toISOString(),
        }).eq('id', paymentRow.id);
      }
      return new Response(
        JSON.stringify({ error: errorMsg }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update payment record with checkout/merchant IDs and mark as processing
    if (paymentRow) {
      await supabase.from('kcb_payments').update({
        checkout_request_id: checkoutRequestId,
        merchant_request_id: merchantRequestId || null,
        status: 'processing',
        raw_response: stkData,
        updated_at: new Date().toISOString(),
      }).eq('id', paymentRow.id);
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        checkoutRequestId,
        merchantRequestId,
        responseCode,
        responseMessage: stkData.ResponseDescription || stkData.responseMessage || 'STK Push initiated',
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error('[kcb-stk-push] Error:', error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

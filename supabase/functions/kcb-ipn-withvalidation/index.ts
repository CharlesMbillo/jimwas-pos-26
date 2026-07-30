import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { verifySignature } from "../lib/signature.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, Signature, X-Signature",
};

interface ValidationRequest {
  requestId: string;
  customerReference: string;
  organizationReference: string;
  // other fields allowed
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "");

    const signatureHeader = req.headers.get('Signature') || req.headers.get('X-Signature') || req.headers.get('x-signature');
    if (!signatureHeader) {
      console.warn('Missing signature header for validation request');
      return new Response(JSON.stringify({ error: 'Missing signature' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch public cert from kcb_settings or env
    let publicPem: string | null = null;
    try {
      const { data } = await supabase.from('kcb_settings').select('public_cert').eq('id', 'kcb-settings').maybeSingle();
      publicPem = data?.public_cert ?? null;
    } catch (err) {
      console.debug('kcb_settings lookup failed:', err?.message ?? err);
    }
    if (!publicPem) publicPem = Deno.env.get('KCB_BUNI_PUBLIC_CERT') ?? Deno.env.get('VITE_KCB_PUBLIC_CERT') ?? null;
    if (!publicPem) {
      console.error('Public cert not configured for KCB validation signature verification');
      return new Response(JSON.stringify({ error: 'Public cert not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const raw = await req.text();

    const valid = await verifySignature(publicPem, raw, signatureHeader);
    if (!valid) {
      console.warn('Signature verification failed for validation request');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body: ValidationRequest = JSON.parse(raw);

    console.log("KCB Bill-Validation request:", JSON.stringify(body));

    if (!body.requestId || !body.customerReference || !body.organizationReference) {
      const failure = {
        transactionID: String(Date.now()),
        statusCode: "1",
        statusMessage: "Invalid request: missing required fields",
        CustomerName: "",
        billAmount: "0.00",
        currency: "KES",
        billType: "FIXED",
        creditAccountIdentifier: "",
      };
      return new Response(JSON.stringify(failure), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Dedupe: if we've already processed this requestId, return the previous response
    try {
      const { data: existing } = await supabase
        .from('kcb_validations')
        .select('response')
        .eq("request->>requestId", body.requestId)
        .maybeSingle();
      if (existing && existing.response) {
        console.log('Duplicate validation request detected, returning existing response');
        return new Response(JSON.stringify(existing.response), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } catch (err) {
      console.debug('kcb_validations lookup for dedupe failed:', err?.message ?? err);
    }

    // Best-effort: look up invoice/bill in DB
    let billRecord: any = null;
    try {
      const { data } = await supabase
        .from("bills") // adjust to your schema (invoices/bills)
        .select("*")
        .eq("reference", body.customerReference)
        .maybeSingle();
      billRecord = data ?? null;
    } catch (err) {
      console.debug("bill lookup failed (table missing?):", err?.message ?? err);
    }

    const response = {
      transactionID: billRecord?.id ? String(billRecord.id) : `val-${Date.now()}`,
      statusCode: billRecord ? "0" : "2",
      statusMessage: billRecord ? "Success" : "Customer/Invoice not found",
      CustomerName: billRecord?.customer_name ?? "",
      billAmount: billRecord ? Number(billRecord.amount).toFixed(2) : "0.00",
      currency: billRecord?.currency ?? "KES",
      billType: billRecord?.bill_type ?? "FIXED",
      creditAccountIdentifier: billRecord?.credit_account_identifier ?? (Deno.env.get("DEFAULT_KCB_CREDIT_ACCOUNT") ?? ""),
    };

    try {
      await supabase.from("kcb_validations").insert([{ request: body, response, received_at: new Date().toISOString(), request_id: body.requestId }]);
    } catch (err) {
      console.debug("Could not persist validation row (table may not exist or add-on columns not present):", err?.message ?? err);
    }

    return new Response(JSON.stringify(response), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error("KCB Validation handler error:", error);
    return new Response(JSON.stringify({
      transactionID: String(Date.now()),
      statusCode: "1",
      statusMessage: "Internal error",
      CustomerName: "",
      billAmount: "0.00",
      currency: "KES",
      billType: "FIXED",
      creditAccountIdentifier: "",
    }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

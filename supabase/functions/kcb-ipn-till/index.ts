import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { verifySignature } from "../lib/signature.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, Signature, X-Signature",
};

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

    const signatureHeader = req.headers.get('Signature') || req.headers.get('X-Signature') || req.headers.get('x-signature');
    if (!signatureHeader) {
      console.warn('Missing signature header for notification request');
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
      console.error('Public cert not configured for KCB notification signature verification');
      return new Response(JSON.stringify({ error: 'Public cert not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const raw = await req.text();

    const valid = await verifySignature(publicPem, raw, signatureHeader);
    if (!valid) {
      console.warn('Signature verification failed for notification request');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const body = JSON.parse(raw);

    console.log('KCB IPN (TILL) received:', JSON.stringify(body));

    // Dedupe: look for existing notification by transactionReference or requestId
    try {
      let found = null;
      if (body.transactionReference) {
        const { data } = await supabase.from('kcb_notifications').select('id,payload').eq("payload->>transactionReference", body.transactionReference).maybeSingle();
        found = data ?? null;
      }
      if (!found && body.requestId) {
        const { data } = await supabase.from('kcb_notifications').select('id,payload').eq("payload->>requestId", body.requestId).maybeSingle();
        found = data ?? null;
      }
      if (found) {
        console.log('Duplicate notification received, returning ack');
        const existingId = found.id;
        const response = { transactionID: String(existingId), statusCode: 0, statusMessage: 'Notification already processed' };
        return new Response(JSON.stringify(response), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    } catch (err) {
      console.debug('kcb_notifications lookup for dedupe failed:', err?.message ?? err);
    }

    // Expected fields (from spec): transactionReference, requestId, channelCode, timestamp,
    // transactionAmount, currency, customerReference, customerName, customerMobileNumber,
    // balance, narration, creditAccountIdentifier, organizationShortCode, tillNumber

    const required = [
      'transactionReference', 'requestId', 'transactionAmount', 'currency', 'customerReference'
    ];

    for (const f of required) {
      if (!body[f]) {
        console.warn(`Missing field ${f} in KCB IPN (TILL)`);
      }
    }

    // Try to persist notification to kcb_notifications (best-effort). If table doesn't exist, ignore.
    try {
      await supabase.from('kcb_notifications').insert([{ payload: body, received_at: new Date().toISOString(), transaction_reference: body.transactionReference ?? null, request_id: body.requestId ?? null }]);
    } catch (err) {
      console.debug('Could not insert into kcb_notifications (table may not exist):', err?.message ?? err);
    }

    // Respond with acknowledgement expected by KCB
    const response = {
      transactionID: String(Date.now()),
      statusCode: 0,
      statusMessage: 'Notification received',
    };

    return new Response(JSON.stringify(response), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    console.error('KCB IPN (TILL) handler error:', error);
    return new Response(
      JSON.stringify({ ResultCode: 1, ResultDesc: 'Internal error' }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

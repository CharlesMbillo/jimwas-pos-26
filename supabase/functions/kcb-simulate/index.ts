import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, Signature",
};

function pemToArrayBuffer(pem: string) {
  const b64 = pem.replace(/-----BEGIN [^-]+-----/, '').replace(/-----END [^-]+-----/, '').replace(/\s+/g, '');
  const binary = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function signWithPrivateKeyPkcs8(privatePem: string, data: string) {
  // privatePem expected in PKCS8 PEM format
  const pkcs8 = pemToArrayBuffer(privatePem);
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pkcs8,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(data));
  // base64
  const sigBytes = new Uint8Array(signature);
  let s = '';
  for (let i = 0; i < sigBytes.length; i++) s += String.fromCharCode(sigBytes[i]);
  return typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabase = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');

    const body = await req.json();
    const now = new Date().toISOString();
    const simulateFor = body.simulateFor || 'till';

    if (simulateFor === 'validation') {
      const validationPayload = {
        requestId: body.requestId || `sim-${Date.now()}`,
        customerReference: body.customerReference || 'SIM-INV-1',
        organizationReference: body.organizationReference || (Deno.env.get('DEFAULT_ORG_REF') ?? '777777'),
      };
      try {
        await supabase.from('kcb_validations').insert([{ request: validationPayload, response: { transactionID: `sim-${Date.now()}`, statusCode: '0', statusMessage: 'Success', CustomerName: 'Sim User', billAmount: (body.amount || '1.00'), currency: 'KES', billType: 'FIXED', creditAccountIdentifier: 'SIMACC001' }, received_at: now }]);
      } catch (err) {
        console.debug('kcb_validations insert failed:', err?.message ?? err);
      }

      // Optionally POST to validation endpoint with signature if privateKey provided
      if (body.sign && body.privateKeyPem && body.callbackUrl) {
        const raw = JSON.stringify(validationPayload);
        const sig = await signWithPrivateKeyPkcs8(body.privateKeyPem, raw);
        const resp = await fetch(body.callbackUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Signature': sig }, body: raw });
        const text = await resp.text();
        return new Response(JSON.stringify({ success: true, forwarded: true, resp: text }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ success: true, message: 'Validation simulated' }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const simulationPayload = {
      transactionReference: body.transactionReference || `FTSIM${Date.now()}`,
      requestId: body.requestId || `req-sim-${Date.now()}`,
      channelCode: body.channelCode || '202',
      timestamp: body.timestamp || now,
      transactionAmount: (body.amount || '100.00'),
      currency: body.currency || 'KES',
      customerReference: body.customerReference || 'SIM-INV-1',
      customerName: body.customerName || 'Sim User',
      customerMobileNumber: body.customerMobileNumber || (body.phone || '254700000000'),
      balance: '1000.00',
      narration: body.narration || 'Simulated payment',
      creditAccountIdentifier: body.creditAccountIdentifier || 'SIMACC001',
      organizationShortCode: body.organizationShortCode || (Deno.env.get('DEFAULT_ORG_REF') ?? '777777'),
      tillNumber: body.tillNumber || '150150',
      simulated_at: now,
    };

    try {
      await supabase.from('kcb_notifications').insert([{ payload: simulationPayload, received_at: now }]);
    } catch (err) {
      console.debug('kcb_notifications insert failed:', err?.message ?? err);
    }

    // Optionally update a payment record (kcb_payments) if checkoutRequestId given
    if (body.checkoutRequestId) {
      try {
        await supabase.from('kcb_payments').update({ status: 'paid', receipt: `SIMR${Date.now()}`, callback_received: true, updated_at: now }).eq('checkout_request_id', body.checkoutRequestId);
      } catch (err) {
        console.debug('kcb_payments update failed:', err?.message ?? err);
      }
    }

    // If sign is requested, privateKeyPem must be provided and callbackUrl must be provided
    if (body.sign && body.privateKeyPem && body.callbackUrl) {
      const raw = JSON.stringify(simulationPayload);
      const sig = await signWithPrivateKeyPkcs8(body.privateKeyPem, raw);
      const resp = await fetch(body.callbackUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Signature': sig }, body: raw });
      const text = await resp.text();
      return new Response(JSON.stringify({ success: true, forwarded: true, resp: text }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ success: true, payload: simulationPayload }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('kcb-simulate error:', error);
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

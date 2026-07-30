import { assertEquals } from "https://deno.land/std@0.201.0/testing/asserts.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

// Integration test that requires the local functions to be reachable and Supabase configured via env
Deno.test('kcb end-to-end: stk push -> simulate signed notification -> verify kcb_payments updated', async () => {
  const FUNCTIONS_BASE = Deno.env.get('FUNCTIONS_BASE'); // e.g. http://localhost:54321/functions/v1
  const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!FUNCTIONS_BASE || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.warn('Skipping integration test: FUNCTIONS_BASE, SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set');
    return;
  }

  // Generate a keypair and export PEMs
  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: 'SHA-256' },
    true,
    ['sign','verify']
  );
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey));
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey));
  function uint8ToBase64(u8: Uint8Array){ let s=''; for (let i=0;i<u8.length;i++) s+=String.fromCharCode(u8[i]); return typeof btoa==='function'?btoa(s):Buffer.from(s,'binary').toString('base64'); }
  const pubPem = '-----BEGIN PUBLIC KEY-----\n'+(uint8ToBase64(spki).match(/.{1,64}/g)?.join('\n'))+'\n-----END PUBLIC KEY-----';
  const privPem = '-----BEGIN PRIVATE KEY-----\n'+(uint8ToBase64(pkcs8).match(/.{1,64}/g)?.join('\n'))+'\n-----END PRIVATE KEY-----';

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Upsert kcb_settings.public_cert
  try {
    await supabase.from('kcb_settings').upsert({ id: 'kcb-settings', public_cert: pubPem }).eq('id','kcb-settings');
  } catch (err) {
    console.warn('Failed to upsert kcb_settings public_cert:', err?.message ?? err);
  }

  // 1) Call kcb-stk to initiate an STK push
  const stkResp = await fetch(`${FUNCTIONS_BASE}/kcb-stk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '254700000000', amount: '1', sharedShortCode: true })
  });
  const stkJson = await stkResp.json();
  if (!stkJson.checkoutRequestId) throw new Error('stk push failed or did not return checkoutRequestId');

  const checkoutRequestId = stkJson.checkoutRequestId;

  // 2) Call kcb-simulate with sign=true to forward signed notification to kcb-ipn-till
  const simulateResp = await fetch(`${FUNCTIONS_BASE}/kcb-simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ simulateFor: 'till', checkoutRequestId, sign: true, privateKeyPem: privPem, callbackUrl: `${FUNCTIONS_BASE}/kcb-ipn-till` })
  });
  const simulateJson = await simulateResp.json();
  assertEquals(simulateJson.success, true);

  // 3) Poll Supabase for the kcb_payments row to reflect callback_received or status updated
  let attempts = 0;
  let found = null;
  while (attempts < 10) {
    const { data } = await supabase.from('kcb_payments').select('*').eq('checkout_request_id', checkoutRequestId).maybeSingle();
    if (data) { found = data; break; }
    attempts++;
    await new Promise(r => setTimeout(r, 1000));
  }
  if (!found) throw new Error('kcb_payments row not found after simulate');

  // Assert callback_received true or status != pending
  if (!found.callback_received && found.status === 'pending') throw new Error('Payment not updated after notification');
});

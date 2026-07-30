import { verifySignature } from '../lib/signature.ts';

Deno.test('signature verification roundtrip', async () => {
  // generate key pair
  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1,0,1]), hash: 'SHA-256' },
    true,
    ['sign','verify']
  );

  // export public key (spki) and convert to PEM
  const spki = new Uint8Array(await crypto.subtle.exportKey('spki', keyPair.publicKey));
  function uint8ToBase64(u8: Uint8Array){
    let s = '';
    for (let i=0;i<u8.length;i++) s += String.fromCharCode(u8[i]);
    return typeof btoa === 'function' ? btoa(s) : Buffer.from(s, 'binary').toString('base64');
  }
  const b64 = uint8ToBase64(spki);
  const pem = '-----BEGIN PUBLIC KEY-----\n' + b64.match(/.{1,64}/g)?.join('\n') + '\n-----END PUBLIC KEY-----';

  const data = 'hello world';
  const encoded = new TextEncoder().encode(data);

  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', keyPair.privateKey, encoded));
  function base64FromUint8(u8: Uint8Array){
    let s = '';
    for (let i=0;i<u8.length;i++) s += String.fromCharCode(u8[i]);
    return typeof btoa === 'function' ? btoa(s) : Buffer.from(s).toString('base64');
  }
  const sigB64 = base64FromUint8(signature);

  const ok = await verifySignature(pem, data, sigB64);
  if (!ok) throw new Error('signature verification failed');
});

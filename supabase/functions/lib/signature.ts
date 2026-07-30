export async function verifySignature(publicPem: string, data: string | Uint8Array, signatureB64: string): Promise<boolean> {
  // Convert PEM to binary (SPKI)
  const pemBody = publicPem.replace(/-----BEGIN PUBLIC KEY-----/, '').replace(/-----END PUBLIC KEY-----/, '').replace(/\s+/g, '');
  if (!pemBody) return false;

  function base64ToUint8Array(b64: string) {
    const binary = typeof atob === 'function' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  const spki = base64ToUint8Array(pemBody);
  const sig = base64ToUint8Array(signatureB64);
  const rawBytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;

  try {
    const key = await crypto.subtle.importKey(
      'spki',
      spki.buffer,
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const verified = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, sig.buffer, rawBytes.buffer);
    return !!verified;
  } catch (err) {
    console.error('Signature verification error:', err);
    return false;
  }
}

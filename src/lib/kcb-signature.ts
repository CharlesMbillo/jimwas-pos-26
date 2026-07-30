/**
 * KCB Signature Verification Utility
 * Implements SHA256withRSA verification for KCB Buni IPN notifications
 * This is critical for KCB UAT - signature verification is mandatory
 */

import crypto from 'crypto';

/**
 * Verifies a KCB signature using SHA256withRSA
 * @param data The raw request body as string (must be exact bytes received)
 * @param signature Base64-encoded signature from X-KCB-SIGNATURE header
 * @param publicKeyPem KCB public key in PEM format
 * @returns true if signature is valid, false otherwise
 */
export function verifyKcbSignature(
  data: string,
  signature: string,
  publicKeyPem: string
): boolean {
  try {
    // Decode the signature from Base64
    const signatureBuffer = Buffer.from(signature, 'base64');

    // Create verifier using RSA public key
    const verifier = crypto.createVerify('sha256');
    verifier.update(data, 'utf8');

    // Verify the signature
    return verifier.verify(publicKeyPem, signatureBuffer);
  } catch (error) {
    console.error('[v0] Signature verification error:', error);
    return false;
  }
}

/**
 * Extracts signature from request headers
 * @param headers Request headers object
 * @returns Signature string or null if not found
 */
export function extractSignature(headers: Record<string, string | string[]>): string | null {
  const signature = headers['x-kcb-signature'];
  
  if (typeof signature === 'string') {
    return signature;
  }
  
  if (Array.isArray(signature) && signature.length > 0) {
    return signature[0];
  }
  
  return null;
}

/**
 * Validates KCB certificate chain and expiry
 * @param certificatePem Certificate in PEM format
 * @returns {valid: boolean, error?: string}
 */
export function validateKcbCertificate(certificatePem: string): { valid: boolean; error?: string } {
  try {
    const cert = new crypto.X509Certificate(certificatePem);
    
    // Check if certificate is valid (not self-signed by default - KCB provides signed certs)
    const now = new Date();
    
    if (cert.validFrom && new Date(cert.validFrom) > now) {
      return { valid: false, error: 'Certificate not yet valid' };
    }
    
    if (cert.validTo && new Date(cert.validTo) < now) {
      return { valid: false, error: 'Certificate expired' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Certificate validation error: ${error}` };
  }
}

/**
 * Standard response for KCB endpoint verification failures
 */
export function securityErrorResponse(reason: string) {
  return {
    status: 401,
    body: {
      resultCode: '401',
      resultMessage: 'Unauthorized',
      reason,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Standard response for successful KCB operations
 */
export function successResponse(resultCode: string = '000', resultMessage: string = 'Success') {
  return {
    status: 200,
    body: {
      resultCode,
      resultMessage,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Standard response for KCB errors
 */
export function errorResponse(resultCode: string, resultMessage: string) {
  return {
    status: 400,
    body: {
      resultCode,
      resultMessage,
      timestamp: new Date().toISOString(),
    },
  };
}

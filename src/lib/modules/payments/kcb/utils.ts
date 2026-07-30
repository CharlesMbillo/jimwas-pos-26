/**
 * KCB Payment Utility Functions
 */

import { VALIDATION_RULES } from './constants';
import { KCBPaymentError, ErrorCode } from './types';

/**
 * Generate a unique message ID (UUID-like)
 */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Generate a correlation ID for request tracking
 */
export function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Validate phone number format
 * Accepts: 254712345678 or +254712345678 or 0712345678
 */
export function validatePhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== 'string') {
    return false;
  }

  // Remove any non-digit characters except +
  let cleaned = phone.replace(/[^\d+]/g, '');

  // Remove leading +
  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  // Handle 0712345678 format - convert to 254712345678
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '254' + cleaned.substring(1);
  }

  // Must be 12 digits starting with 254
  if (cleaned.length !== VALIDATION_RULES.PHONE_LENGTH) {
    return false;
  }

  if (!cleaned.startsWith(VALIDATION_RULES.PHONE_PREFIX)) {
    return false;
  }

  return /^\d+$/.test(cleaned);
}

/**
 * Normalize phone number to 254XXXXXXXXX format
 */
export function normalizePhoneNumber(phone: string): string {
  let cleaned = phone.replace(/[^\d+]/g, '');

  if (cleaned.startsWith('+')) {
    cleaned = cleaned.substring(1);
  }

  if (cleaned.startsWith('0') && cleaned.length === 10) {
    cleaned = '254' + cleaned.substring(1);
  }

  return cleaned;
}

/**
 * Validate amount
 */
export function validateAmount(amount: any): boolean {
  if (typeof amount !== 'number' || isNaN(amount)) {
    return false;
  }

  if (amount < VALIDATION_RULES.MIN_AMOUNT || amount > VALIDATION_RULES.MAX_AMOUNT) {
    return false;
  }

  // Check if has more than 2 decimal places
  if (!VALIDATION_RULES.AMOUNT_PATTERN.test(amount.toString())) {
    return false;
  }

  return true;
}

/**
 * Format amount as currency
 */
export function formatAmount(amount: number, currency: string = 'KES'): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Validate message ID format
 */
export function validateMessageId(messageId: string): boolean {
  return VALIDATION_RULES.MESSAGE_ID_FORMAT.test(messageId);
}

/**
 * Validate invoice number
 */
export function validateInvoiceNumber(invoiceNumber: string): boolean {
  if (!invoiceNumber || typeof invoiceNumber !== 'string') {
    return false;
  }

  if (invoiceNumber.length > VALIDATION_RULES.INVOICE_MAX_LENGTH) {
    return false;
  }

  return /^[\w\-]+$/.test(invoiceNumber);
}

/**
 * Calculate request expiry time
 */
export function calculateExpiryTime(durationSeconds: number = 900): Date {
  return new Date(Date.now() + durationSeconds * 1000);
}

/**
 * Check if timestamp is expired
 */
export function isExpired(expiryTime: Date | string | number): boolean {
  const expiry = new Date(expiryTime).getTime();
  return Date.now() > expiry;
}

/**
 * Mask sensitive data for logging
 */
export function maskSensitiveData(data: Record<string, any>, fieldsToMask: string[] = []): Record<string, any> {
  const defaultMasked = ['access_token', 'client_secret', 'passkey', 'pin', 'password'];
  const fieldsToHide = [...defaultMasked, ...fieldsToMask];

  const masked = { ...data };

  for (const field of fieldsToHide) {
    if (field in masked) {
      masked[field] = '***MASKED***';
    }
  }

  return masked;
}

/**
 * Parse error response
 */
export function parseErrorResponse(response: any): { code: string; message: string } {
  if (!response) {
    return { code: 'UNKNOWN_ERROR', message: 'Unknown error occurred' };
  }

  if (typeof response === 'string') {
    return { code: 'PARSE_ERROR', message: response };
  }

  if (response.code && response.message) {
    return { code: response.code, message: response.message };
  }

  if (response.error) {
    return {
      code: response.error.code || 'API_ERROR',
      message: response.error.message || response.error,
    };
  }

  return {
    code: 'API_ERROR',
    message: JSON.stringify(response),
  };
}

/**
 * Build query string
 */
export function buildQueryString(params: Record<string, any>): string {
  return new URLSearchParams(
    Object.entries(params)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => [key, String(value)])
  ).toString();
}

/**
 * Generate Base64 string
 */
export function toBase64(data: string | Record<string, any>): string {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  return btoa(unescape(encodeURIComponent(str)));
}

/**
 * Decode Base64 string
 */
export function fromBase64(data: string): string {
  return decodeURIComponent(escape(atob(data)));
}

/**
 * Generate random string
 */
export function generateRandomString(length: number = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Format date to ISO string
 */
export function formatDateISO(date: Date = new Date()): string {
  return date.toISOString();
}

/**
 * Calculate time difference in seconds
 */
export function getTimeDiffSeconds(from: Date | number, to: Date | number = Date.now()): number {
  const fromTime = from instanceof Date ? from.getTime() : from;
  const toTime = to instanceof Date ? to.getTime() : to;
  return Math.floor((toTime - fromTime) / 1000);
}

/**
 * Wait for specified milliseconds
 */
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  initialDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < maxAttempts) {
        const delayMs = initialDelayMs * Math.pow(2, attempt - 1);
        await delay(delayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Deduplicate transactions within time window
 */
export function isDuplicateTransaction(
  previousTime: Date | number,
  windowMs: number = 60000
): boolean {
  const prevMs = previousTime instanceof Date ? previousTime.getTime() : previousTime;
  const diff = Date.now() - prevMs;
  return diff < windowMs;
}

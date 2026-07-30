/**
 * KCB Payment Error Handling
 */

import { PAYMENT_MESSAGES } from './constants';

export class KCBError extends Error {
  public readonly code: string;
  public readonly statusCode?: number;
  public readonly details?: Record<string, any>;

  constructor(
    code: string,
    message: string,
    statusCode?: number,
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'KCBError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      details: this.details,
    };
  }
}

/**
 * Handle common KCB errors and map to user-friendly messages
 */
export function getErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    'INVALID_PHONE': PAYMENT_MESSAGES.INVALID_PHONE,
    'INVALID_AMOUNT': PAYMENT_MESSAGES.INVALID_AMOUNT,
    'TOKEN_EXPIRED': 'Payment session expired',
    'TOKEN_FAILED': 'Failed to authenticate payment service',
    'STK_FAILED': PAYMENT_MESSAGES.TRANSACTION_FAILED,
    'NETWORK_ERROR': PAYMENT_MESSAGES.NETWORK_ERROR,
    'INVALID_SIGNATURE': PAYMENT_MESSAGES.SIGNATURE_INVALID,
    'DUPLICATE_TRANSACTION': PAYMENT_MESSAGES.DUPLICATE_TRANSACTION,
    'CUSTOMER_CANCELLED': PAYMENT_MESSAGES.CUSTOMER_CANCELLED,
    'INSUFFICIENT_FUNDS': PAYMENT_MESSAGES.INSUFFICIENT_FUNDS,
    'TRANSACTION_TIMEOUT': PAYMENT_MESSAGES.PAYMENT_TIMEOUT,
    'INVALID_RESPONSE': 'Invalid response from payment service',
  };

  return messages[code] || 'An error occurred processing your payment';
}

/**
 * Check if error is retryable
 */
export function isRetryableError(error: any): boolean {
  if (!(error instanceof KCBError)) {
    return false;
  }

  const retryableCodes = [
    'NETWORK_ERROR',
    'TRANSACTION_TIMEOUT',
    'TOKEN_FAILED',
  ];

  return retryableCodes.includes(error.code);
}

/**
 * Check if error is customer-caused (not retryable)
 */
export function isCustomerError(error: any): boolean {
  if (!(error instanceof KCBError)) {
    return false;
  }

  const customerErrors = [
    'CUSTOMER_CANCELLED',
    'INSUFFICIENT_FUNDS',
    'INVALID_PHONE',
    'INVALID_AMOUNT',
  ];

  return customerErrors.includes(error.code);
}

/**
 * Convert HTTP error response to KCBError
 */
export function parseHTTPError(status: number, body?: any): KCBError {
  const errorCode = mapHTTPStatusToError(status);
  const message = getErrorMessage(errorCode);

  return new KCBError(
    errorCode,
    message,
    status,
    body
  );
}

/**
 * Map HTTP status codes to error codes
 */
function mapHTTPStatusToError(status: number): string {
  switch (status) {
    case 400:
      return 'INVALID_RESPONSE';
    case 401:
    case 403:
      return 'TOKEN_EXPIRED';
    case 404:
      return 'INVALID_RESPONSE';
    case 409:
      return 'DUPLICATE_TRANSACTION';
    case 429:
      return 'RATE_LIMITED';
    case 500:
    case 502:
    case 503:
    case 504:
      return 'NETWORK_ERROR';
    default:
      return 'NETWORK_ERROR';
  }
}

/**
 * Safe error stringification (masks sensitive data)
 */
export function stringifyError(error: unknown): string {
  if (error instanceof KCBError) {
    return JSON.stringify(error.toJSON());
  }

  if (error instanceof Error) {
    return JSON.stringify({
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }

  return JSON.stringify(error);
}

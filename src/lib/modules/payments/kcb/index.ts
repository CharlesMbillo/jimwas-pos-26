/**
 * KCB BUNI Payment Gateway - Main Export
 */

// Types
export type {
  OAuthTokenRequest,
  OAuthTokenResponse,
  CachedToken,
  STKPushRequest,
  STKPushResponse,
  STKPushPayload,
  PaymentStatus,
  IPNPayload,
  IPNRequest,
  PaymentTransaction,
  PaymentCallback,
  PaymentToken,
  PaymentAudit,
  PaymentRetry,
  APIResponse,
  HealthCheckResponse,
  KCBConfig,
  CreatePaymentDTO,
  PaymentStatusDTO,
  UpdatePaymentStatusDTO,
} from './types';

export { KCBPaymentError, ErrorCode, PaymentStatus } from './types';

// Constants
export { KCB_API_DEFAULTS, PAYMENT_STATUS_CODES, HTTP_STATUS_CODES, PAYMENT_MESSAGES } from './constants';

// Configuration
export { configManager, getKCBConfig, isKCBConfigured } from './config';

// OAuth
export { oauthTokenManager, getAccessToken, clearTokenCache, getTokenCacheInfo } from './oauth';

// Client
export { KCBClient, kcbClient, getKCBClient } from './client';

// Logging
export { Logger, createLogger } from './logger';

// Errors
export { KCBError, getErrorMessage, isRetryableError, isCustomerError, parseHTTPError, stringifyError } from './errors';

// Utilities
export {
  generateMessageId,
  generateCorrelationId,
  validatePhoneNumber,
  normalizePhoneNumber,
  validateAmount,
  formatAmount,
  validateMessageId,
  validateInvoiceNumber,
  calculateExpiryTime,
  isExpired,
  maskSensitiveData,
  parseErrorResponse,
  buildQueryString,
  toBase64,
  fromBase64,
  generateRandomString,
  formatDateISO,
  getTimeDiffSeconds,
  delay,
  retry,
  isDuplicateTransaction,
} from './utils';

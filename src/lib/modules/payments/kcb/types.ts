/**
 * KCB BUNI Payment Gateway Type Definitions
 * Comprehensive types for OAuth, STK Push, IPN, and transaction management
 */

// ============ OAUTH TYPES ============

export interface OAuthTokenRequest {
  grant_type: 'client_credentials';
  client_id: string;
  client_secret: string;
}

export interface OAuthTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

export interface CachedToken {
  access_token: string;
  expires_at: number;
  cached_at: number;
}

// ============ STK PUSH TYPES ============

export interface STKPushRequest {
  phoneNumber: string;
  amount: number;
  invoiceNumber: string;
  description?: string;
  // Merchant-specific
  merchantName?: string;
  expiryTime?: number; // seconds
}

export interface STKPushResponse {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResponseCode: string;
  ResponseDescription: string;
  CustomerMessage: string;
}

export interface STKPushPayload {
  messageId: string;
  phoneNumber: string;
  amount: number;
  invoiceNumber: string;
  description: string;
  correlationId: string;
  timestamp: string;
  merchantName: string;
  merchantRequestId: string;
  checkoutRequestId: string;
}

// ============ PAYMENT STATUS TYPES ============

export enum PaymentStatus {
  PENDING = 'pending',
  REQUESTED = 'requested',
  WAITING_CUSTOMER = 'waiting_customer',
  PAID = 'paid',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  EXPIRED = 'expired',
}

// ============ CALLBACK/IPN TYPES ============

export interface IPNPayload {
  MerchantRequestID: string;
  CheckoutRequestID: string;
  ResultCode: number;
  ResultDesc: string;
  Amount: number;
  MpesaReceiptNumber: string;
  Balance: number;
  TransactionDate: string;
  PhoneNumber: string;
}

export interface IPNRequest {
  signature: string;
  payload: string; // Base64 encoded JSON
}

// ============ TRANSACTION TYPES ============

export interface PaymentTransaction {
  id: string;
  merchantRequestId: string;
  checkoutRequestId: string;
  invoiceId: string;
  customerId?: string;
  phoneNumber: string;
  amount: number;
  currency: string;
  description: string;
  status: PaymentStatus;
  receipt?: string;
  resultCode?: number;
  resultDesc?: string;
  transactionDate?: string;
  rawPayload: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string;
}

export interface PaymentCallback {
  id: string;
  transactionId: string;
  merchantRequestId: string;
  checkoutRequestId: string;
  resultCode: number;
  resultDesc: string;
  signature: string;
  payload: Record<string, any>;
  verified: boolean;
  processedAt?: string;
  createdAt: string;
}

export interface PaymentToken {
  id: string;
  access_token: string;
  token_type: string;
  expires_at: number;
  scope?: string;
  createdAt: string;
}

export interface PaymentAudit {
  id: string;
  transactionId?: string;
  action: string;
  actor?: string;
  details: Record<string, any>;
  ip?: string;
  userAgent?: string;
  createdAt: string;
}

export interface PaymentRetry {
  id: string;
  transactionId: string;
  attemptNumber: number;
  maxAttempts: number;
  nextRetryAt: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

// ============ ERROR TYPES ============

export class KCBPaymentError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode?: number,
    public details?: Record<string, any>
  ) {
    super(message);
    this.name = 'KCBPaymentError';
  }
}

export enum ErrorCode {
  INVALID_PHONE = 'INVALID_PHONE',
  INVALID_AMOUNT = 'INVALID_AMOUNT',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  TOKEN_FAILED = 'TOKEN_FAILED',
  STK_FAILED = 'STK_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_SIGNATURE = 'INVALID_SIGNATURE',
  DUPLICATE_TRANSACTION = 'DUPLICATE_TRANSACTION',
  CUSTOMER_CANCELLED = 'CUSTOMER_CANCELLED',
  INSUFFICIENT_FUNDS = 'INSUFFICIENT_FUNDS',
  TRANSACTION_TIMEOUT = 'TRANSACTION_TIMEOUT',
  INVALID_RESPONSE = 'INVALID_RESPONSE',
}

// ============ REQUEST/RESPONSE TYPES ============

export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, any>;
  };
}

export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  oauth: boolean;
  database: boolean;
  timestamp: string;
}

// ============ CONFIG TYPES ============

export interface KCBConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  routeCode: string;
  sharedShortcode: boolean;
  orgShortcode: string;
  orgPasskey: string;
  callbackUrl: string;
  publicCertPath: string;
  tokenCacheTTL: number; // seconds
  requestTimeout: number; // milliseconds
  maxRetries: number;
  retryDelay: number; // milliseconds
}

// ============ DTO TYPES ============

export interface CreatePaymentDTO {
  phoneNumber: string;
  amount: number;
  invoiceNumber: string;
  description?: string;
  customerId?: string;
}

export interface PaymentStatusDTO {
  merchantRequestId: string;
  checkoutRequestId: string;
}

export interface UpdatePaymentStatusDTO {
  status: PaymentStatus;
  receipt?: string;
  resultCode?: number;
  resultDesc?: string;
}

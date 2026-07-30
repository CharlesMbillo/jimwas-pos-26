/**
 * KCB BUNI Constants and Configuration Defaults
 */

export const KCB_API_DEFAULTS = {
  OAUTH_ENDPOINT: '/oauth/authorize',
  TOKEN_ENDPOINT: '/oauth/token',
  STK_PUSH_ENDPOINT: '/api/v1/PaymentService/MobileCheckout',
  QUERY_ENDPOINT: '/api/v1/PaymentService/QueryPaymentStatus',
  TOKEN_CACHE_TTL: 3300, // 55 minutes (token valid for 1 hour)
  TOKEN_REFRESH_BEFORE_EXPIRY: 60, // Refresh 60 seconds before expiry
  REQUEST_TIMEOUT: 30000, // 30 seconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // 1 second
  EXPIRY_TIME: 900, // 15 minutes
  DUPLICATE_CHECK_WINDOW: 60000, // 60 seconds
} as const;

export const PAYMENT_STATUS_CODES = {
  SUCCESS: '00000000', // Successful transaction
  PENDING: '1',
  INSUFFICIENT_FUNDS: '14',
  CUSTOMER_CANCELLED: '17',
  TIMEOUT: '20',
  INVALID_CREDENTIALS: '05',
  INVALID_PHONE: '1',
  DUPLICATE_TRANSACTION: '2009',
} as const;

export const HTTP_STATUS_CODES = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  RATE_LIMITED: 429,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

export const PAYMENT_MESSAGES = {
  STK_SENT: 'STK push sent to your phone',
  PAYMENT_TIMEOUT: 'Payment request timed out. Please try again.',
  CUSTOMER_CANCELLED: 'Payment cancelled by customer',
  INSUFFICIENT_FUNDS: 'Insufficient funds in your M-Pesa account',
  INVALID_PHONE: 'Invalid phone number format',
  INVALID_AMOUNT: 'Invalid or negative amount',
  NETWORK_ERROR: 'Network error. Please check your connection.',
  SIGNATURE_INVALID: 'Invalid payment signature',
  DUPLICATE_TRANSACTION: 'Duplicate transaction detected',
  TRANSACTION_FAILED: 'Transaction failed. Please try again.',
  TRANSACTION_SUCCESSFUL: 'Payment successful',
} as const;

export const LOGGER_CONFIG = {
  MASK_FIELDS: ['access_token', 'client_secret', 'password', 'pin'],
  INCLUDE_HEADERS: ['correlation-id', 'request-id', 'x-forwarded-for'],
  LOG_LEVELS: {
    ERROR: 'ERROR',
    WARN: 'WARN',
    INFO: 'INFO',
    DEBUG: 'DEBUG',
  },
} as const;

export const VALIDATION_RULES = {
  MIN_AMOUNT: 1,
  MAX_AMOUNT: 999999.99,
  PHONE_LENGTH: 12, // E.g., 254712345678
  PHONE_PREFIX: '254', // Kenya country code
  INVOICE_MAX_LENGTH: 50,
  DESCRIPTION_MAX_LENGTH: 500,
  MESSAGE_ID_FORMAT: /^[A-Za-z0-9\-_]+$/,
  AMOUNT_PATTERN: /^\d+(\.\d{1,2})?$/,
} as const;

export const PAYMENT_METHODS = {
  KCB_STK: 'kcb_stk',
  KCB_DIRECT: 'kcb_direct',
  MPESA: 'mpesa',
  CASH: 'cash',
  CARD: 'card',
} as const;

export const CURRENCY_CODES = {
  KES: 'KES',
  USD: 'USD',
  EUR: 'EUR',
} as const;

export const NOTIFICATION_EVENTS = {
  PAYMENT_INITIATED: 'payment.initiated',
  PAYMENT_REQUESTED: 'payment.requested',
  PAYMENT_WAITING: 'payment.waiting_customer',
  PAYMENT_SUCCESS: 'payment.success',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_CANCELLED: 'payment.cancelled',
  PAYMENT_TIMEOUT: 'payment.timeout',
  CALLBACK_RECEIVED: 'callback.received',
  CALLBACK_VERIFIED: 'callback.verified',
} as const;

// KCB Edge Functions Integration
// Provides frontend integration with KCB Buni endpoints

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ============================================================================
// Type Definitions
// ============================================================================

export interface BillValidationRequest {
  invoiceNumber: string;
  phoneNumber: string;
  amount?: number;
}

export interface BillValidationResponse {
  success: boolean;
  valid: boolean;
  billDetails?: {
    invoiceNumber: string;
    phoneNumber: string;
    amount: number;
    description: string;
    dueDate?: string;
  };
  errorCode?: string;
  errorMessage?: string;
}

export interface BillNotificationPayload {
  invoiceNumber: string;
  transactionId: string;
  amount: number;
  phoneNumber: string;
  transactionDate: string;
  mpesaReceiptNumber?: string;
  signature: string; // X-KCB-SIGNATURE header
}

export interface TillNotificationPayload {
  invoiceNumber: string;
  transactionId: string;
  amount: number;
  phoneNumber: string;
  tillId: string;
  cashierId: string;
  cashierName: string;
  transactionDate: string;
  mpesaReceiptNumber?: string;
  signature: string; // X-KCB-SIGNATURE header
}

export interface EdgeFunctionResponse {
  success: boolean;
  data?: any;
  error?: string;
  errorCode?: string;
}

// ============================================================================
// Bill Validation Endpoint
// ============================================================================

/**
 * Query KCB to validate a bill before payment
 * This is called BEFORE initiating payment
 */
export async function validateBill(
  request: BillValidationRequest
): Promise<BillValidationResponse> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/kcb-bill-validation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(request),
      }
    );

    let data;
    try {
      const text = await response.text();
      if (!text) {
        return {
          success: false,
          valid: false,
          errorMessage: 'Empty response from KCB service',
        };
      }
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('[v0] JSON parse error in validateBill:', parseError);
      return {
        success: false,
        valid: false,
        errorMessage: 'Invalid response from KCB service',
      };
    }

    if (!response.ok) {
      return {
        success: false,
        valid: false,
        errorCode: data?.errorCode || 'VALIDATION_ERROR',
        errorMessage: data?.errorMessage || 'Bill validation failed',
      };
    }

    return {
      success: true,
      valid: data.valid || false,
      billDetails: data.billDetails,
      errorCode: data.errorCode,
      errorMessage: data.errorMessage,
    };
  } catch (error) {
    console.error('[v0] validateBill error:', error);
    return {
      success: false,
      valid: false,
      errorMessage:
        error instanceof Error ? error.message : 'Network error',
    };
  }
}

// ============================================================================
// Bill Notification IPN Endpoint
// ============================================================================

/**
 * Send bill payment notification to KCB
 * Called after successful M-Pesa payment to notify KCB
 * (Typically called from backend, but exposed for flexibility)
 */
export async function notifyBillPayment(
  payload: BillNotificationPayload
): Promise<EdgeFunctionResponse> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/kcb-bill-notification`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'X-KCB-SIGNATURE': payload.signature,
        },
        body: JSON.stringify({
          invoiceNumber: payload.invoiceNumber,
          transactionId: payload.transactionId,
          amount: payload.amount,
          phoneNumber: payload.phoneNumber,
          transactionDate: payload.transactionDate,
          mpesaReceiptNumber: payload.mpesaReceiptNumber,
        }),
      }
    );

    let data;
    try {
      const text = await response.text();
      if (!text) {
        return {
          success: false,
          error: 'Empty response from KCB service',
        };
      }
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('[v0] JSON parse error in notifyBillPayment:', parseError);
      return {
        success: false,
        error: 'Invalid response from KCB service',
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: data?.error || 'Bill notification failed',
        errorCode: data?.errorCode,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('[v0] notifyBillPayment error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// ============================================================================
// Till Notification IPN Endpoint
// ============================================================================

/**
 * Send till payment notification to KCB
 * Called for till-specific transactions with cashier tracking
 * (Typically called from backend)
 */
export async function notifyTillPayment(
  payload: TillNotificationPayload
): Promise<EdgeFunctionResponse> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/kcb-till-notification`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
          'X-KCB-SIGNATURE': payload.signature,
        },
        body: JSON.stringify({
          invoiceNumber: payload.invoiceNumber,
          transactionId: payload.transactionId,
          amount: payload.amount,
          phoneNumber: payload.phoneNumber,
          tillId: payload.tillId,
          cashierId: payload.cashierId,
          cashierName: payload.cashierName,
          transactionDate: payload.transactionDate,
          mpesaReceiptNumber: payload.mpesaReceiptNumber,
        }),
      }
    );

    let data;
    try {
      const text = await response.text();
      if (!text) {
        return {
          success: false,
          error: 'Empty response from KCB service',
        };
      }
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('[v0] JSON parse error in notifyTillPayment:', parseError);
      return {
        success: false,
        error: 'Invalid response from KCB service',
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: data?.error || 'Till notification failed',
        errorCode: data?.errorCode,
      };
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('[v0] notifyTillPayment error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Format phone number for KCB (254XXXXXXXXX format)
 */
export function formatPhoneForKCB(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');

  if (cleaned.startsWith('254') && cleaned.length === 12) {
    return cleaned;
  }

  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return `254${cleaned.substring(1)}`;
  }

  if (cleaned.length === 9) {
    return `254${cleaned}`;
  }

  return cleaned;
}

/**
 * Validate phone format
 */
export function isValidPhoneNumber(phone: string): boolean {
  const formatted = formatPhoneForKCB(phone);
  return formatted.startsWith('254') && formatted.length === 12;
}

/**
 * Format amount for KCB (ensure it's an integer)
 */
export function formatAmountForKCB(amount: number): number {
  return Math.floor(Math.max(0, amount));
}

/**
 * Generate transaction ID for KCB
 */
export function generateKCBTransactionId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `TXN-${timestamp}-${random}`;
}

// ============================================================================
// Error Handling Utilities
// ============================================================================

/**
 * Get human-readable error message from KCB error code
 */
export function getKCBErrorMessage(errorCode?: string): string {
  const errorMap: Record<string, string> = {
    VALIDATION_ERROR: 'Bill validation failed',
    BILL_NOT_FOUND: 'Bill not found in system',
    INVALID_AMOUNT: 'Amount does not match bill',
    INVALID_PHONE: 'Phone number does not match bill',
    BILL_ALREADY_PAID: 'Bill has already been paid',
    BILL_EXPIRED: 'Bill payment period has expired',
    DUPLICATE_TRANSACTION: 'Transaction already recorded',
    SIGNATURE_VERIFICATION_FAILED: 'Signature verification failed',
    SERVICE_UNAVAILABLE: 'KCB service temporarily unavailable',
  };

  return errorMap[errorCode || ''] || 'An error occurred';
}

/**
 * Determine if error is retryable
 */
export function isRetryableError(errorCode?: string): boolean {
  const retryable = [
    'SERVICE_UNAVAILABLE',
    'NETWORK_ERROR',
    'TIMEOUT',
  ];

  return retryable.includes(errorCode || '');
}

// ============================================================================
// Batch Operations
// ============================================================================

/**
 * Validate multiple bills in parallel
 */
export async function validateMultipleBills(
  bills: BillValidationRequest[]
): Promise<Map<string, BillValidationResponse>> {
  const results = new Map<string, BillValidationResponse>();

  const promises = bills.map(async (bill) => {
    const response = await validateBill(bill);
    results.set(bill.invoiceNumber, response);
  });

  await Promise.all(promises);
  return results;
}

/**
 * Retry bill validation with exponential backoff
 */
export async function validateBillWithRetry(
  request: BillValidationRequest,
  options?: {
    maxAttempts?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
  }
): Promise<BillValidationResponse> {
  const maxAttempts = options?.maxAttempts || 3;
  const initialDelayMs = options?.initialDelayMs || 1000;
  const maxDelayMs = options?.maxDelayMs || 10000;

  let lastError: BillValidationResponse | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await validateBill(request);

    if (response.success) {
      return response;
    }

    lastError = response;

    if (attempt < maxAttempts - 1) {
      // Exponential backoff with jitter
      const delay = Math.min(
        initialDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
        maxDelayMs
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return lastError || {
    success: false,
    valid: false,
    errorMessage: 'Validation failed after all retries',
  };
}

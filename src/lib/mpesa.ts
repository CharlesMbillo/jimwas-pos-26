// KCB BUNI STK Push Integration
import { generateId } from './db';
import type { KCBPaymentRecord } from './db';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? import.meta.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Generate a KCB BUNI-compliant M-Pesa receipt number for testing/sandbox mode.
 * Format: 9 characters - 3 uppercase letters + 6 digits (e.g., "ABC123456")
 * Per KCB BUNI documentation: MpesaReceiptNumber format matches M-Pesa standard receipts.
 * Reference: KCB M-Pesa STK Push API Specification
 */
export function generateMpesaReceiptNumber(): string {
  // Generate 3 random uppercase letters
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let receipt = '';
  
  for (let i = 0; i < 3; i++) {
    receipt += letters.charAt(Math.floor(Math.random() * letters.length));
  }
  
  // Generate 6 random digits
  for (let i = 0; i < 6; i++) {
    receipt += Math.floor(Math.random() * 10).toString();
  }
  
  return receipt;
}

export interface STKPushResponse {
  success: boolean;
  checkoutRequestId?: string;
  merchantRequestId?: string;
  mpesaTransactionId?: string;
  error?: string;
}

export interface STKPushStatusResponse {
  success: boolean;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'cancelled' | 'timeout' | 'insufficient_balance';
  mpesaReceiptNumber?: string;
  resultDesc?: string;
  error?: string;
}

// Initiate KCB BUNI STK Push
export async function initiateKCBSTKPush(
  phone: string,
  amount: number,
  options?: {
    transactionId?: string;
    customerId?: string;
    cashierId?: string;
    cashierName?: string;
    accountReference?: string;
    transactionDesc?: string;
  }
): Promise<STKPushResponse> {
  // 1. Create local payment record immediately so UI shows pending
  const payment = await createKCBPaymentRecord(phone, amount, {
    transactionId: options?.transactionId,
    cashierId: options?.cashierId,
    checkoutRequestId: options?.checkoutRequestId,
    merchantRequestId: options?.merchantRequestId,
  });

  const payload = {
    phone,
    amount,
    accountReference: options?.accountReference ?? payment.id,
    transactionDesc: options?.transactionDesc ?? 'POS Payment',
    transactionId: options?.transactionId,
  };

  // 2. Enforce timeout using AbortController (10s)
  const controller = new AbortController();
  const timeoutMs = 10000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/kcb-stk-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timer);

    const text = await response.text();
    if (!text) {
      await recordMpesaFailure(payment.id, 'failed', 'Empty response from KCB service');
      return { success: false, error: 'Empty response from KCB service' };
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error('[v0] JSON parse error in initiateKCBSTKPush:', err);
      await recordMpesaFailure(payment.id, 'failed', 'Invalid JSON from KCB service');
      return { success: false, error: 'Invalid response from KCB service' };
    }

    if (!response.ok) {
      await recordMpesaFailure(payment.id, 'failed', data?.error || 'Failed to initiate payment');
      return { success: false, error: data?.error || 'Failed to initiate payment' };
    }

    const checkoutRequestId = data.checkoutRequestId || data.CheckoutRequestID || data.checkout_request_id;
    const merchantRequestId = data.merchantRequestId || data.merchant_request_id || undefined;

    if (!checkoutRequestId) {
      // Provider did not return a checkoutRequestId → cannot trigger phone prompt
      await recordMpesaFailure(payment.id, 'failed', 'No CheckoutRequestID returned');
      return { success: false, error: 'No CheckoutRequestID returned from provider' };
    }

    // Persist checkoutRequestId and mark processing
    await recordMpesaInitiation(payment.id, checkoutRequestId, merchantRequestId);

    return {
      success: true,
      checkoutRequestId,
      merchantRequestId,
      mpesaTransactionId: data.mpesaTransactionId || data.MpesaTransactionID || undefined,
    };
  } catch (err: any) {
    clearTimeout(timer);
    const message = err?.name === 'AbortError' ? 'Request timed out' : err?.message || String(err);
    await recordMpesaFailure(payment.id, 'failed', message);
    return { success: false, error: message };
  }
}

// Check STK Push Status
export async function checkSTKPushStatus(checkoutRequestId: string): Promise<STKPushStatusResponse> {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/mpesa-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ checkoutRequestId }),
    });

    // Safely parse JSON response
    let data;
    try {
      const text = await response.text();
      if (!text) {
        return { success: false, status: 'failed', error: 'Empty response from KCB BUNI service' };
      }
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('[v0] JSON parse error in checkSTKPushStatus:', parseError);
      return { success: false, status: 'failed', error: 'Invalid response from KCB BUNI service' };
    }

    if (!response.ok) {
      return { success: false, status: 'failed', error: data?.error || 'Failed to check status' };
    }

    return {
      success: true,
      status: data.status,
      mpesaReceiptNumber: data.mpesaReceiptNumber,
      resultDesc: data.resultDesc,
    };
  } catch (error) {
    return { success: false, status: 'failed', error: error instanceof Error ? error.message : 'Network error' };
  }
}

// Poll for KCB BUNI payment completion
export async function pollForKCBPaymentCompletion(
  checkoutRequestId: string,
  options?: {
    maxAttempts?: number;
    intervalMs?: number;
    onStatusChange?: (status: STKPushStatusResponse) => void;
  }
): Promise<STKPushStatusResponse> {
  const maxAttempts = options?.maxAttempts || 30; // 30 attempts = ~2.5 minutes
  const intervalMs = options?.intervalMs || 5000; // 5 seconds

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await checkSTKPushStatus(checkoutRequestId);

    options?.onStatusChange?.(status);

    if (status.status === 'success') {
      return status;
    }

    if (
      status.status === 'failed' ||
      status.status === 'cancelled' ||
      status.status === 'timeout' ||
      status.status === 'insufficient_balance'
    ) {
      return status;
    }

    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  return { success: false, status: 'timeout', error: 'Payment verification timed out' };
}

// Format phone number for display
export function formatPhoneDisplay(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('254') && cleaned.length === 12) {
    return `+${cleaned.substring(0, 3)} ${cleaned.substring(3, 6)} ${cleaned.substring(6, 9)} ${cleaned.substring(9)}`;
  }
  if (cleaned.startsWith('0') && cleaned.length === 10) {
    return `${cleaned.substring(0, 4)} ${cleaned.substring(4, 7)} ${cleaned.substring(7)}`;
  }
  return phone;
}

// Create and track KCB BUNI payment record
export async function createKCBPaymentRecord(
  phone: string,
  amount: number,
  options?: {
    transactionId?: string;
    cashierId?: string;
    checkoutRequestId?: string;
    merchantRequestId?: string;
  }
): Promise<KCBPaymentRecord> {
  const { saveMpesaPayment } = await import('./db');
  
  const payment: KCBPaymentRecord = {
    id: `mpesa_${generateId()}`,
    phone,
    amount,
    status: 'pending',
    attempts: 0,
    created_at: new Date().toISOString(),
    created_by: options?.cashierId,
    transaction_id: options?.transactionId,
    checkout_request_id: options?.checkoutRequestId,
    merchant_request_id: options?.merchantRequestId,
    sync_status: 'pending',
  };
  
  await saveMpesaPayment(payment);
  return payment;
}

// Update payment after STK Push initiation
export async function recordMpesaInitiation(
  paymentId: string,
  checkoutRequestId: string,
  merchantRequestId: string
) {
  const { updateMpesaPaymentStatus } = await import('./db');
  
  await updateMpesaPaymentStatus(paymentId, 'processing', {
    checkout_request_id: checkoutRequestId,
    merchant_request_id: merchantRequestId,
    attempts: 1,
  });
}

// Update payment after successful completion
export async function recordMpesaSuccess(
  paymentId: string,
  mpesaReceiptNumber: string,
  resultDesc: string
) {
  const { updateMpesaPaymentStatus } = await import('./db');
  
  await updateMpesaPaymentStatus(paymentId, 'success', {
    mpesa_receipt_number: mpesaReceiptNumber,
    result_desc: resultDesc,
    completed_at: new Date().toISOString(),
  });
}

// Update payment on failure
export async function recordMpesaFailure(
  paymentId: string,
  status: 'failed' | 'cancelled' | 'timeout' | 'insufficient_balance',
  errorMessage: string
) {
  const { getMpesaPayment, updateMpesaPaymentStatus } = await import('./db');
  const payment = await getMpesaPayment(paymentId);
  
  await updateMpesaPaymentStatus(paymentId, status, {
    error_message: errorMessage,
    attempts: (payment?.attempts || 0) + 1,
  });
}

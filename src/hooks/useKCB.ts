// KCB Integration Hook
// Provides React components with easy access to KCB operations

import { useState, useCallback } from 'react';
import {
  validateBill,
  notifyBillPayment,
  notifyTillPayment,
  formatPhoneForKCB,
  formatAmountForKCB,
  generateKCBTransactionId,
  getKCBErrorMessage,
  isRetryableError,
  validateBillWithRetry,
  type BillValidationRequest,
  type BillValidationResponse,
  type EdgeFunctionResponse,
} from '../lib/kcb-edge-functions';

interface UseKCBOptions {
  autoRetry?: boolean;
  maxRetries?: number;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

interface UseKCBState {
  loading: boolean;
  error: string | null;
  data: any | null;
}

export function useKCB(options?: UseKCBOptions) {
  const [state, setState] = useState<UseKCBState>({
    loading: false,
    error: null,
    data: null,
  });

  // ========================================================================
  // Bill Validation
  // ========================================================================

  const checkBill = useCallback(
    async (
      invoiceNumber: string,
      phoneNumber: string,
      amount?: number
    ): Promise<BillValidationResponse> => {
      setState({ loading: true, error: null, data: null });

      try {
        const request: BillValidationRequest = {
          invoiceNumber,
          phoneNumber: formatPhoneForKCB(phoneNumber),
          amount: amount ? formatAmountForKCB(amount) : undefined,
        };

        let response: BillValidationResponse;

        if (options?.autoRetry && options?.maxRetries) {
          response = await validateBillWithRetry(request, {
            maxAttempts: options.maxRetries,
          });
        } else {
          response = await validateBill(request);
        }

        if (response.success && response.valid) {
          setState({
            loading: false,
            error: null,
            data: response.billDetails,
          });
          options?.onSuccess?.('Bill validated successfully');
        } else {
          const errorMsg =
            response.errorMessage ||
            getKCBErrorMessage(response.errorCode);
          setState({
            loading: false,
            error: errorMsg,
            data: null,
          });
          options?.onError?.(errorMsg);
        }

        return response;
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Validation failed';
        setState({
          loading: false,
          error: errorMsg,
          data: null,
        });
        options?.onError?.(errorMsg);

        return {
          success: false,
          valid: false,
          errorMessage: errorMsg,
        };
      }
    },
    [options]
  );

  // ========================================================================
  // Bill Payment Notification
  // ========================================================================

  const notifyBill = useCallback(
    async (payload: {
      invoiceNumber: string;
      amount: number;
      phoneNumber: string;
      mpesaReceiptNumber?: string;
      signature: string;
    }): Promise<EdgeFunctionResponse> => {
      setState({ loading: true, error: null, data: null });

      try {
        const response = await notifyBillPayment({
          invoiceNumber: payload.invoiceNumber,
          transactionId: generateKCBTransactionId(),
          amount: formatAmountForKCB(payload.amount),
          phoneNumber: formatPhoneForKCB(payload.phoneNumber),
          transactionDate: new Date().toISOString(),
          mpesaReceiptNumber: payload.mpesaReceiptNumber,
          signature: payload.signature,
        });

        if (response.success) {
          setState({
            loading: false,
            error: null,
            data: response.data,
          });
          options?.onSuccess?.(
            'Bill payment notification sent to KCB'
          );
        } else {
          setState({
            loading: false,
            error: response.error || 'Notification failed',
            data: null,
          });
          options?.onError?.(
            response.error || 'Notification failed'
          );
        }

        return response;
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Notification failed';
        setState({
          loading: false,
          error: errorMsg,
          data: null,
        });
        options?.onError?.(errorMsg);

        return {
          success: false,
          error: errorMsg,
        };
      }
    },
    [options]
  );

  // ========================================================================
  // Till Payment Notification
  // ========================================================================

  const notifyTill = useCallback(
    async (payload: {
      invoiceNumber: string;
      amount: number;
      phoneNumber: string;
      tillId: string;
      cashierId: string;
      cashierName: string;
      mpesaReceiptNumber?: string;
      signature: string;
    }): Promise<EdgeFunctionResponse> => {
      setState({ loading: true, error: null, data: null });

      try {
        const response = await notifyTillPayment({
          invoiceNumber: payload.invoiceNumber,
          transactionId: generateKCBTransactionId(),
          amount: formatAmountForKCB(payload.amount),
          phoneNumber: formatPhoneForKCB(payload.phoneNumber),
          tillId: payload.tillId,
          cashierId: payload.cashierId,
          cashierName: payload.cashierName,
          transactionDate: new Date().toISOString(),
          mpesaReceiptNumber: payload.mpesaReceiptNumber,
          signature: payload.signature,
        });

        if (response.success) {
          setState({
            loading: false,
            error: null,
            data: response.data,
          });
          options?.onSuccess?.(
            'Till payment notification sent to KCB'
          );
        } else {
          setState({
            loading: false,
            error: response.error || 'Notification failed',
            data: null,
          });
          options?.onError?.(
            response.error || 'Notification failed'
          );
        }

        return response;
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : 'Notification failed';
        setState({
          loading: false,
          error: errorMsg,
          data: null,
        });
        options?.onError?.(errorMsg);

        return {
          success: false,
          error: errorMsg,
        };
      }
    },
    [options]
  );

  // ========================================================================
  // Utility Functions
  // ========================================================================

  const formatPhone = useCallback(formatPhoneForKCB, []);
  const formatAmount = useCallback(formatAmountForKCB, []);
  const generateTransactionId = useCallback(generateKCBTransactionId, []);
  const getErrorMessage = useCallback(getKCBErrorMessage, []);
  const checkRetryable = useCallback(isRetryableError, []);

  // ========================================================================
  // State Reset
  // ========================================================================

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);

  const reset = useCallback(() => {
    setState({ loading: false, error: null, data: null });
  }, []);

  // ========================================================================
  // Return Interface
  // ========================================================================

  return {
    // State
    loading: state.loading,
    error: state.error,
    data: state.data,

    // Operations
    checkBill,
    notifyBill,
    notifyTill,

    // Utilities
    formatPhone,
    formatAmount,
    generateTransactionId,
    getErrorMessage,
    checkRetryable,

    // State Management
    clearError,
    reset,
  };
}

// Export types for component usage
export type { BillValidationResponse, EdgeFunctionResponse };

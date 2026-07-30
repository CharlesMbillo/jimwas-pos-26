export type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface PaymentResponse {
  provider: string; // e.g. 'kcb_buni'
  providerTransactionId?: string;
  merchantRequestId?: string;
  checkoutRequestId?: string;
  responseCode?: string;
  responseMessage?: string;
  status: TransactionStatus;
  raw?: any;
}

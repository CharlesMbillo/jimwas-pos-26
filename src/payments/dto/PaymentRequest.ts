export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export interface PaymentRequest {
  provider: string;
  merchantRequestId?: string;
  checkoutRequestId?: string;
  providerTransactionId?: string;
  phoneNumber: string;
  amount: number | string;
  invoiceNumber: string;
  status?: PaymentStatus;
  raw?: any;
}

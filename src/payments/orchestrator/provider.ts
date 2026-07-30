export type ProviderResponse = {
  success: boolean;
  providerTransactionId?: string;
  receiptNumber?: string;
  raw?: any;
  status?: 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
  merchantRequestId?: string;
};

export interface PaymentProvider {
  name: string;
  // Initiate a payment (idempotent per idempotencyKey/merchantRequestId)
  initiate(intent: import('./types').PaymentIntent, opts?: { timeoutMs?: number }): Promise<ProviderResponse>;

  // Parse provider webhook payload into canonical fields
  parseCallback(payload: any): { merchantRequestId?: string; providerTransactionId?: string; status?: string; raw?: any; receiptNumber?: string };

  // Optional: lookup status or refund
  statusLookup?(merchantRequestId: string): Promise<ProviderResponse>;
}

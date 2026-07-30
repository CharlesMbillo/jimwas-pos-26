export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export type PaymentIntent = {
  id?: string; // local uuid
  amount: number;
  phoneNumber: string;
  invoiceNumber: string;
  preferredProvider?: string;
  metadata?: Record<string, any>;
  idempotencyKey?: string;
  merchantRequestId?: string;
};

export type QueueItem = {
  id: string;
  paymentId?: string;
  intent: PaymentIntent;
  attempts: number;
  status: 'PENDING' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';
  nextAttemptAt?: string | null;
  lastError?: string | null;
  createdAt: string;
  updatedAt: string;
};

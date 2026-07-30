import { PaymentRequest } from '../dto/PaymentRequest';
import { PaymentResponse, TransactionStatus } from '../dto/PaymentResponse';
import { CallbackPayload } from '../dto/CallbackPayload';

export interface PaymentProvider {
  initiatePayment(request: PaymentRequest): Promise<PaymentResponse>;

  processCallback(payload: any): Promise<CallbackPayload>;

  validateTransaction(transactionId: string): Promise<TransactionStatus>;

  getTransactionStatus(transactionId: string): Promise<PaymentResponse>;
}

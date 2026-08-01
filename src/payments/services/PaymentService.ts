import { PrismaClient } from '@prisma/client';
import { PaymentRepository, PaymentStatus } from '../repositories/PaymentRepository';
import { PaymentRequest } from '../dto/PaymentRequest';

/**
 * Simplified payment service for STK Push only workflow.
 * Handles payment initiation without callbacks.
 */
export class PaymentService {
  private repo: PaymentRepository;

  constructor(prisma: PrismaClient) {
    this.repo = new PaymentRepository(prisma);
  }

  async createInitiation(payload: PaymentRequest) {
    // Create payment record from initiation request
    return this.repo.createFromInitiation({
      provider: payload.provider,
      merchantRequestId: payload.merchantRequestId,
      checkoutRequestId: payload.checkoutRequestId,
      providerTransactionId: payload.providerTransactionId,
      phoneNumber: payload.phoneNumber,
      amount: payload.amount,
      invoiceNumber: payload.invoiceNumber,
      status: payload.status as PaymentStatus | undefined,
      raw: payload.raw,
    });
  }

  /**
   * Update payment status directly (for STK Push or manual updates).
   */
  async updatePaymentStatus(
    merchantRequestId: string,
    status: PaymentStatus,
    updates?: Partial<Record<string, any>>
  ) {
    if (!merchantRequestId) return null;
    return this.repo.updateFromCallback(merchantRequestId, {
      status,
      ...updates,
    });
  }
}

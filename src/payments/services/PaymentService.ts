import { PrismaClient } from '@prisma/client';
import { PaymentRepository, PaymentStatus } from '../repositories/PaymentRepository';
import { PaymentRequest } from '../dto/PaymentRequest';

/**
 * Thin service layer that uses PaymentRepository to encapsulate
 * higher-level flows: initiation + callback handling.
 */
export class PaymentService {
  private repo: PaymentRepository;

  constructor(prisma: PrismaClient) {
    this.repo = new PaymentRepository(prisma);
  }

  async createInitiation(payload: PaymentRequest) {
    // normalize inputs as PaymentRepository expects
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
   * Handle a provider callback (webhook) that identifies the payment by merchantRequestId.
   * updates: partial fields to write back (status, receiptNumber, callback payload, etc).
   */
  async handleCallback(merchantRequestId: string, updates: Partial<Record<string, any>>) {
    // defensive: ensure merchantRequestId present
    if (!merchantRequestId) return null;

    // updateFromCallback already searches and returns null if none exists
    return this.repo.updateFromCallback(merchantRequestId, {
      ...updates,
      // keep callback payload under callbackPayload if provided raw
      callbackPayload: updates.callbackPayload ?? updates.raw ?? null,
    });
  }
}

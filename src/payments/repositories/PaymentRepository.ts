import { PrismaClient } from '@prisma/client';
import { PaymentRequest } from '../dto/PaymentRequest';

export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

export class PaymentRepository {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  async createFromInitiation(args: {
    provider: string;
    merchantRequestId?: string;
    checkoutRequestId?: string;
    providerTransactionId?: string;
    phoneNumber: string;
    amount: number | string;
    invoiceNumber: string;
    status?: PaymentStatus;
    raw?: any;
  }) {
    return this.prisma.payment.create({
      data: {
        provider: args.provider,
        providerTransactionId: args.providerTransactionId,
        merchantRequestId: args.merchantRequestId,
        checkoutRequestId: args.checkoutRequestId,
        phoneNumber: args.phoneNumber,
        amount: Number(args.amount),
        invoiceNumber: args.invoiceNumber,
        status: args.status ?? 'PENDING',
        callbackPayload: args.raw ?? null,
      },
    });
  }

  async findByMerchantRequestId(merchantRequestId: string) {
    if (!merchantRequestId) return null;
    return this.prisma.payment.findFirst({ where: { merchantRequestId } });
  }

  async updateFromCallback(merchantRequestId: string, updates: Partial<Record<string, any>>) {
    const existing = await this.findByMerchantRequestId(merchantRequestId);
    if (!existing) return null;
    return this.prisma.payment.update({ where: { id: existing.id }, data: updates });
  }

  async findByInvoice(invoiceNumber: string) {
    return this.prisma.payment.findFirst({ where: { invoiceNumber } });
  }
}

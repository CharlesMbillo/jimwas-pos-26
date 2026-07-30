import { jest } from '@jest/globals';
import { PaymentRepository } from '../src/payments/repositories/PaymentRepository';
import type { PrismaClient } from '@prisma/client';

describe('PaymentRepository', () => {
  let mockPrisma: Partial<PrismaClient>;
  beforeEach(() => {
    mockPrisma = {
      payment: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      } as any,
    } as Partial<PrismaClient>;
  });

  test('createFromInitiation: casts amount to Number and sets defaults', async () => {
    const repo = new PaymentRepository(mockPrisma as PrismaClient);
    (mockPrisma!.payment!.create as jest.Mock).mockResolvedValue({ id: 'abc' });

    const result = await repo.createFromInitiation({
      provider: 'mpesa',
      phoneNumber: '+254700000000',
      amount: '123.45',
      invoiceNumber: 'INV-1',
    });

    expect(mockPrisma!.payment!.create).toHaveBeenCalledTimes(1);
    const createArg = (mockPrisma!.payment!.create as jest.Mock).mock.calls[0][0];
    expect(createArg.data.amount).toBe(Number('123.45'));
    expect(createArg.data.status).toBe('PENDING');
    expect(result).toEqual({ id: 'abc' });
  });

  test('findByMerchantRequestId returns null for empty id', async () => {
    const repo = new PaymentRepository(mockPrisma as PrismaClient);
    const res = await repo.findByMerchantRequestId('');
    expect(res).toBeNull();
  });

  test('updateFromCallback returns null if not existing', async () => {
    (mockPrisma!.payment!.findFirst as jest.Mock).mockResolvedValue(null);
    const repo = new PaymentRepository(mockPrisma as PrismaClient);
    const res = await repo.updateFromCallback('non-existent', { status: 'SUCCESS' });
    expect(res).toBeNull();
    expect(mockPrisma!.payment!.update).not.toHaveBeenCalled();
  });

  test('findByInvoice delegates to prisma.findFirst', async () => {
    (mockPrisma!.payment!.findFirst as jest.Mock).mockResolvedValue({ id: '123', invoiceNumber: 'INV-1' });
    const repo = new PaymentRepository(mockPrisma as PrismaClient);
    const res = await repo.findByInvoice('INV-1');
    expect(mockPrisma!.payment!.findFirst).toHaveBeenCalledWith({ where: { invoiceNumber: 'INV-1' } });
    expect(res).toEqual({ id: '123', invoiceNumber: 'INV-1' });
  });
});

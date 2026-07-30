import { PaymentOrchestrator } from '../../src/payments/orchestrator/PaymentOrchestrator';
import { PaymentRepository } from '../../src/payments/repositories/PaymentRepository';
import type { PaymentProvider } from '../../src/payments/orchestrator/provider';
import { v4 as uuidv4 } from 'uuid';

describe('PaymentOrchestrator', () => {
  const mockRepo: Partial<PaymentRepository> = {
    createFromInitiation: jest.fn(),
    updateFromCallback: jest.fn(),
  } as any;

  const successProvider: PaymentProvider = {
    name: 'success',
    async initiate(intent) {
      return {
        success: true,
        providerTransactionId: 'tx-1',
        status: 'SUCCESS',
        raw: { mock: true },
        merchantRequestId: intent.merchantRequestId ?? 'mr-1',
      };
    },
    parseCallback(payload) {
      return { merchantRequestId: payload.merchantRequestId, providerTransactionId: payload.txId, status: payload.status, raw: payload };
    },
  };

  test('createAndEnqueue creates payment and returns queue item', async () => {
    (mockRepo.createFromInitiation as jest.Mock).mockResolvedValue({ id: 'pay-1' });
    const orch = new PaymentOrchestrator({ repo: mockRepo as PaymentRepository, providers: [successProvider], defaultProvider: 'success' });
    const { payment, queueItem } = await orch.createAndEnqueue({ amount: 10, phoneNumber: '+254', invoiceNumber: 'INV-1' });
    expect(payment.id).toBe('pay-1');
    expect(queueItem.intent.amount).toBe(10);
    expect(queueItem.status).toBe('PENDING');
  });

  test('processQueueItem calls provider and updates repo', async () => {
    (mockRepo.updateFromCallback as jest.Mock).mockResolvedValue({ id: 'pay-1', status: 'SUCCESS' });
    const orch = new PaymentOrchestrator({ repo: mockRepo as PaymentRepository, providers: [successProvider], defaultProvider: 'success' });
    const queueItem = {
      id: uuidv4(),
      paymentId: 'pay-1',
      intent: { amount: 10, phoneNumber: '+254', invoiceNumber: 'INV-1', idempotencyKey: uuidv4() },
      attempts: 0,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any;
    const res = await orch.processQueueItem(queueItem);
    expect(res.status).toBe('SUCCEEDED');
    expect(mockRepo.updateFromCallback).toHaveBeenCalled();
  });
});

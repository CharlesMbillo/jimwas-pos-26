// tests for callback handler should use an in-memory prisma or mock PaymentRepository
import request from 'supertest';
import express from 'express';
import { createKcbBuniCallbackRouter } from '../src/payments/webhooks/KcbBuniCallbackHandler';

describe('KCB Callback Handler', () => {
  it('acknowledges valid callback and creates payment when none exists', async () => {
    const app = express();

    // minimal mock repository
    const payments: any[] = [];
    const mockRepo: any = {
      findByMerchantRequestId: async (m: string) => payments.find((p) => p.merchantRequestId === m) || null,
      createFromInitiation: async (args: any) => {
        const p = { id: String(payments.length + 1), ...args };
        payments.push(p);
        return p;
      },
      updateFromCallback: async () => null,
    };

    const mockProviderService: any = {
      processCallback: async (raw: any) => raw.stkCallback,
    };

    app.use('/api/kcb-buni', createKcbBuniCallbackRouter({ repository: mockRepo, providerService: mockProviderService } as any));

    const payload = {
      stkCallback: {
        MerchantRequestID: 'M123',
        CheckoutRequestID: 'C123',
        ResultCode: 0,
        ResultDesc: 'Success',
        CallbackMetadata: { Amount: 100, MpesaReceiptNumber: 'R123', TransactionDate: '20260729', PhoneNumber: '254700123456' },
      },
    };

    const res = await request(app).post('/api/kcb-buni/mpesa/callback').send(payload).set('Content-Type', 'application/json');
    expect(res.status).toBe(200);
    expect(payments.length).toBe(1);
    expect(payments[0].merchantRequestId).toBe('M123');
  });
});

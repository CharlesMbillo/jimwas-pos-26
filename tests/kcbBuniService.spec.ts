import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { KcbBuniMpesaService } from '../src/payments/providers/KcbBuniMpesaService';

describe('KcbBuniMpesaService', () => {
  let mock: MockAdapter;
  let service: KcbBuniMpesaService;

  beforeEach(() => {
    mock = new MockAdapter(axios);
    service = new KcbBuniMpesaService({
      KCB_BUNI_BASE_URL: 'https://kcb.example',
      KCB_BUNI_TOKEN_URL: 'https://kcb.example/oauth/token',
      KCB_BUNI_CLIENT_ID: 'id',
      KCB_BUNI_CLIENT_SECRET: 'secret',
      KCB_BUNI_CALLBACK_URL: 'https://example.com/callback',
    });
  });

  afterEach(() => {
    mock.restore();
  });

  it('should initiate STK Push successfully', async () => {
    mock.onPost('https://kcb.example/oauth/token').reply(200, { access_token: 'tok', expires_in: 3600 });
    mock.onPost('https://kcb.example/stk-push').reply(200, {
      merchantRequestId: 'MCR123',
      checkoutRequestId: 'CHK123',
      transactionReference: 'TRX123',
      status: 'PENDING',
      message: 'Request accepted',
    });

    const req = {
      phoneNumber: '254700123456',
      amount: '100',
      invoiceNumber: 'KCBTILLNO-JIMWAS001',
      sharedShortCode: true,
      callbackUrl: 'https://example.com/callback',
      transactionDescription: 'Payment for goods purchased',
    };

    const resp = await service.initiatePayment(req);
    expect(resp.merchantRequestId).toBe('MCR123');
    expect(resp.status).toBe('PENDING');
  });

  it('should handle failed authentication', async () => {
    mock.onPost('https://kcb.example/oauth/token').reply(401, { error: 'invalid_client' });

    const req = {
      phoneNumber: '254700123456',
      amount: '100',
      invoiceNumber: 'KCBTILLNO-JIMWAS001',
      sharedShortCode: true,
      callbackUrl: 'https://example.com/callback',
      transactionDescription: 'Payment for goods purchased',
    };

    const resp = await service.initiatePayment(req);
    expect(resp.status).toBe('FAILED');
  });
});

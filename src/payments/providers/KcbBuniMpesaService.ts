import axios, { AxiosInstance } from 'axios';
import qs from 'qs';
import { PaymentProvider } from './PaymentProvider';
import { PaymentRequest } from '../dto/PaymentRequest';
import { PaymentResponse, TransactionStatus } from '../dto/PaymentResponse';
import { CallbackPayload } from '../dto/CallbackPayload';

type TokenCache = { token: string; expiresAt: number } | null;

export class KcbBuniMpesaService implements PaymentProvider {
  private client: AxiosInstance;
  private tokenCache: TokenCache = null;

  private baseUrl: string;
  private tokenUrl: string;
  private clientId: string;
  private clientSecret: string;
  private shortCode?: string;
  private callbackUrl: string;
  private timeout: number;

  constructor(env: {
    KCB_BUNI_BASE_URL: string;
    KCB_BUNI_TOKEN_URL: string;
    KCB_BUNI_CLIENT_ID: string;
    KCB_BUNI_CLIENT_SECRET: string;
    KCB_BUNI_SHORT_CODE?: string;
    KCB_BUNI_CALLBACK_URL: string;
    KCB_BUNI_TIMEOUT?: string;
  }) {
    this.baseUrl = env.KCB_BUNI_BASE_URL;
    this.tokenUrl = env.KCB_BUNI_TOKEN_URL;
    this.clientId = env.KCB_BUNI_CLIENT_ID;
    this.clientSecret = env.KCB_BUNI_CLIENT_SECRET;
    this.shortCode = env.KCB_BUNI_SHORT_CODE;
    this.callbackUrl = env.KCB_BUNI_CALLBACK_URL;
    this.timeout = Number(env.KCB_BUNI_TIMEOUT || 10000);

    this.client = axios.create({ baseURL: this.baseUrl, timeout: this.timeout, headers: { 'Content-Type': 'application/json' } });
  }

  private async getToken(): Promise<string> {
    const now = Date.now();
    if (this.tokenCache && this.tokenCache.expiresAt > now + 5000) return this.tokenCache.token;

    try {
      const resp = await axios.post(
        this.tokenUrl,
        qs.stringify({ client_id: this.clientId, client_secret: this.clientSecret, grant_type: 'client_credentials' }),
        { timeout: this.timeout, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
      );

      const data = resp.data;
      if (!data || !data.access_token) throw new Error('Token response missing access_token');
      const expiresIn = Number(data.expires_in || 3600);
      this.tokenCache = { token: data.access_token, expiresAt: Date.now() + expiresIn * 1000 };
      return data.access_token;
    } catch (err: any) {
      const msg = err?.response?.data || err?.message || 'Token fetch failed';
      throw new Error(`KCB token error: ${JSON.stringify(msg)}`);
    }
  }

  private buildStkPayload(request: PaymentRequest) {
    return {
      phoneNumber: request.phoneNumber,
      amount: request.amount,
      invoiceNumber: request.invoiceNumber,
      sharedShortCode: !!request.sharedShortCode,
      orgShortCode: request.orgShortCode || '',
      orgPassKey: request.orgPassKey || '',
      callbackUrl: request.callbackUrl || this.callbackUrl,
      transactionDescription: request.transactionDescription || 'Payment',
      metadata: request.metadata || {},
    };
  }

  public async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    const token = await this.getToken();
    const payload = this.buildStkPayload(request);

    try {
      const resp = await this.client.post('/stk-push', payload, { headers: { Authorization: `Bearer ${token}` } });
      const data = resp.data;

      const response: PaymentResponse = {
        provider: 'kcb_buni',
        providerTransactionId: data.transactionReference || data.transactionId || undefined,
        merchantRequestId: data.merchantRequestId || undefined,
        checkoutRequestId: data.checkoutRequestId || undefined,
        responseCode: data.responseCode || data.code || undefined,
        responseMessage: data.responseMessage || data.message || 'initiated',
        status: (data.status === 'SUCCESS' ? 'PENDING' : 'FAILED') as TransactionStatus,
        raw: data,
      };

      return response;
    } catch (err: any) {
      const code = err?.code || err?.response?.status;
      const body = err?.response?.data || err?.message;
      return {
        provider: 'kcb_buni',
        status: 'FAILED',
        responseCode: String(code || 'UNKNOWN'),
        responseMessage: typeof body === 'string' ? body : JSON.stringify(body),
        raw: body,
      };
    }
  }

  public async processCallback(payload: any): Promise<CallbackPayload> {
    const receivedAt = new Date().toISOString();
    const body = payload?.body || payload;
    const stkCallback = body.stkCallback || body;

    if (!stkCallback) throw new Error('Invalid callback: missing stkCallback payload');

    const merchantRequestId: string = stkCallback.MerchantRequestID || stkCallback.merchantRequestId;
    const checkoutRequestId: string = stkCallback.CheckoutRequestID || stkCallback.checkoutRequestId;
    const resultCode = Number(stkCallback.ResultCode ?? stkCallback.resultCode ?? -1);
    const resultDesc = stkCallback.ResultDesc || stkCallback.resultDesc || '';
    const callbackMetadata = stkCallback.CallbackMetadata || stkCallback.callbackMetadata || {};

    if (!merchantRequestId) throw new Error('Invalid callback: missing MerchantRequestID');

    const normalized: CallbackPayload = {
      provider: 'kcb_buni',
      merchantRequestId,
      checkoutRequestId,
      resultCode,
      resultDesc,
      callbackMetadata,
      raw: stkCallback,
      receivedAt,
    };

    return normalized;
  }

  public async validateTransaction(transactionId: string): Promise<TransactionStatus> {
    try {
      const token = await this.getToken();
      const resp = await this.client.get(`/transactions/${encodeURIComponent(transactionId)}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = resp.data;
      const status = (data.status === 'SUCCESS' ? 'SUCCESS' : data.status === 'PENDING' ? 'PENDING' : 'FAILED') as TransactionStatus;
      return status;
    } catch (err) {
      return 'FAILED';
    }
  }

  public async getTransactionStatus(transactionId: string): Promise<PaymentResponse> {
    try {
      const token = await this.getToken();
      const resp = await this.client.get(`/transactions/${encodeURIComponent(transactionId)}`, { headers: { Authorization: `Bearer ${token}` } });
      const data = resp.data;
      return {
        provider: 'kcb_buni',
        providerTransactionId: transactionId,
        responseCode: data.code || '0',
        responseMessage: data.message || '',
        status: (data.status === 'SUCCESS' ? 'SUCCESS' : data.status === 'PENDING' ? 'PENDING' : 'FAILED') as TransactionStatus,
        raw: data,
      };
    } catch (err: any) {
      const body = err?.response?.data || err?.message;
      return {
        provider: 'kcb_buni',
        providerTransactionId: transactionId,
        status: 'FAILED',
        responseMessage: typeof body === 'string' ? body : JSON.stringify(body),
        raw: body,
      };
    }
  }
}

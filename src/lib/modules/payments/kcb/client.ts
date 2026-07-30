/**
 * KCB BUNI Client
 * Main interface for KCB payment operations
 */

import type {
  STKPushRequest,
  STKPushResponse,
  STKPushPayload,
  IPNPayload,
  HealthCheckResponse,
  PaymentStatus,
} from './types';
import { KCBPaymentError, ErrorCode } from './types';
import { getKCBConfig } from './config';
import { getAccessToken } from './oauth';
import { Logger } from './logger';
import { KCB_API_DEFAULTS, VALIDATION_RULES } from './constants';
import { generateMessageId, generateCorrelationId, validatePhoneNumber, validateAmount } from './utils';

const logger = new Logger('KCBClient');

export class KCBClient {
  /**
   * Initiate STK Push payment
   */
  async initiateSTKPush(request: STKPushRequest): Promise<STKPushPayload> {
    logger.info('Initiating STK Push', { phone: request.phoneNumber, amount: request.amount });

    // Validate request
    this.validateSTKPushRequest(request);

    try {
      const config = getKCBConfig();
      const token = await getAccessToken();
      const messageId = generateMessageId();
      const correlationId = generateCorrelationId();
      const timestamp = new Date().toISOString();

      const payload = {
        messageId,
        phoneNumber: request.phoneNumber,
        amount: request.amount,
        invoiceNumber: request.invoiceNumber,
        description: request.description || `Invoice ${request.invoiceNumber}`,
        correlationId,
        timestamp,
        merchantName: request.merchantName || 'Jimwas POS',
        expiryTime: request.expiryTime || KCB_API_DEFAULTS.EXPIRY_TIME,
        routeCode: config.routeCode,
        shortCode: config.orgShortcode,
        passkey: config.orgPasskey,
      };

      const response = await fetch(
        `${config.baseUrl}${KCB_API_DEFAULTS.STK_PUSH_ENDPOINT}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId,
            'X-Message-ID': messageId,
            'User-Agent': 'JimwasPOS/1.0',
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(config.requestTimeout),
        }
      );

      if (!response.ok) {
        throw new KCBPaymentError(
          ErrorCode.STK_FAILED,
          `STK Push failed with status ${response.status}`,
          response.status
        );
      }

      const data: STKPushResponse = await response.json();

      if (data.ResponseCode !== '00000000') {
        throw new KCBPaymentError(
          ErrorCode.STK_FAILED,
          data.ResponseDescription || 'STK Push request failed'
        );
      }

      logger.info('STK Push initiated successfully', {
        merchantRequestId: data.MerchantRequestID,
        checkoutRequestId: data.CheckoutRequestID,
      });

      return {
        messageId,
        phoneNumber: request.phoneNumber,
        amount: request.amount,
        invoiceNumber: request.invoiceNumber,
        description: request.description || '',
        correlationId,
        timestamp,
        merchantName: request.merchantName || 'Jimwas POS',
        merchantRequestId: data.MerchantRequestID,
        checkoutRequestId: data.CheckoutRequestID,
      };
    } catch (error) {
      if (error instanceof KCBPaymentError) {
        throw error;
      }

      if (error instanceof TypeError && error.name === 'AbortError') {
        throw new KCBPaymentError(
          ErrorCode.NETWORK_ERROR,
          'STK Push request timeout'
        );
      }

      throw new KCBPaymentError(
        ErrorCode.NETWORK_ERROR,
        error instanceof Error ? error.message : 'Failed to initiate STK Push'
      );
    }
  }

  /**
   * Query payment status
   */
  async queryPaymentStatus(
    merchantRequestId: string,
    checkoutRequestId: string
  ): Promise<PaymentStatus> {
    logger.debug('Querying payment status', { merchantRequestId, checkoutRequestId });

    try {
      const config = getKCBConfig();
      const token = await getAccessToken();
      const correlationId = generateCorrelationId();

      const response = await fetch(
        `${config.baseUrl}${KCB_API_DEFAULTS.QUERY_ENDPOINT}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'X-Correlation-ID': correlationId,
            'User-Agent': 'JimwasPOS/1.0',
          },
          body: JSON.stringify({
            merchantRequestId,
            checkoutRequestId,
          }),
          signal: AbortSignal.timeout(config.requestTimeout),
        }
      );

      if (!response.ok) {
        throw new KCBPaymentError(
          ErrorCode.NETWORK_ERROR,
          `Status query failed with status ${response.status}`
        );
      }

      const data = await response.json();

      return {
        status: this.mapResultCode(data.ResultCode),
        receipt: data.MpesaReceiptNumber,
        resultCode: data.ResultCode,
        resultDesc: data.ResultDesc,
      } as PaymentStatus;
    } catch (error) {
      if (error instanceof KCBPaymentError) {
        throw error;
      }

      throw new KCBPaymentError(
        ErrorCode.NETWORK_ERROR,
        error instanceof Error ? error.message : 'Failed to query payment status'
      );
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<HealthCheckResponse> {
    const timestamp = new Date().toISOString();

    try {
      const config = getKCBConfig();
      const oauthHealthy = await this.checkOAuthHealth();
      
      // Note: Database health check would be done separately
      const dbHealthy = true; // Placeholder

      return {
        status: oauthHealthy && dbHealthy ? 'healthy' : 'unhealthy',
        oauth: oauthHealthy,
        database: dbHealthy,
        timestamp,
      };
    } catch (error) {
      logger.error('Health check failed', {}, error as Error);
      return {
        status: 'unhealthy',
        oauth: false,
        database: false,
        timestamp,
      };
    }
  }

  /**
   * Validate configuration
   */
  async validate(): Promise<boolean> {
    try {
      const config = getKCBConfig();

      // Test OAuth
      const token = await getAccessToken();
      if (!token) {
        throw new Error('Failed to obtain OAuth token');
      }

      logger.info('Configuration validation successful');
      return true;
    } catch (error) {
      logger.error('Configuration validation failed', {}, error as Error);
      return false;
    }
  }

  /**
   * Validate STK Push request
   */
  private validateSTKPushRequest(request: STKPushRequest): void {
    if (!validatePhoneNumber(request.phoneNumber)) {
      throw new KCBPaymentError(
        ErrorCode.INVALID_PHONE,
        `Invalid phone number: ${request.phoneNumber}`
      );
    }

    if (!validateAmount(request.amount)) {
      throw new KCBPaymentError(
        ErrorCode.INVALID_AMOUNT,
        `Invalid amount: ${request.amount}`
      );
    }

    if (!request.invoiceNumber || request.invoiceNumber.length > VALIDATION_RULES.INVOICE_MAX_LENGTH) {
      throw new KCBPaymentError(
        ErrorCode.INVALID_PHONE,
        'Invalid invoice number'
      );
    }
  }

  /**
   * Map KCB result code to payment status
   */
  private mapResultCode(code: number): string {
    switch (code) {
      case 0:
        return 'paid';
      case 14:
        return 'insufficient_funds';
      case 17:
        return 'cancelled';
      case 20:
        return 'timeout';
      default:
        return 'failed';
    }
  }

  /**
   * Check OAuth health
   */
  private async checkOAuthHealth(): Promise<boolean> {
    try {
      const token = await getAccessToken();
      return !!token;
    } catch {
      return false;
    }
  }
}

// Export singleton instance
export const kcbClient = new KCBClient();

/**
 * Get KCB client instance
 */
export function getKCBClient(): KCBClient {
  return kcbClient;
}

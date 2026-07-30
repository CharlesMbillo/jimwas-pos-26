import express, { Request, Response } from 'express';
import { PaymentRepository } from '../repositories/PaymentRepository';
import { KcbBuniMpesaService } from '../providers/KcbBuniMpesaService';

export function createKcbBuniCallbackRouter(opts: { repository: PaymentRepository; providerService: KcbBuniMpesaService }) {
  const router = express.Router();

  router.post('/mpesa/callback', express.json(), async (req: Request, res: Response) => {
    try {
      const raw = req.body;
      let normalized;
      try {
        normalized = await opts.providerService.processCallback(raw);
      } catch (err: any) {
        console.error('Invalid callback payload', err?.message || err);
        return res.status(400).json({ message: 'Invalid callback payload' });
      }

      const existing = await opts.repository.findByMerchantRequestId(normalized.merchantRequestId);

      if (existing) {
        if (normalized.resultCode === 0) {
          await opts.repository.updateFromCallback(normalized.merchantRequestId, {
            status: 'SUCCESS',
            receiptNumber: normalized.callbackMetadata?.MpesaReceiptNumber || existing.receiptNumber,
            callbackPayload: normalized.raw,
          });
        } else {
          if (existing.status !== 'SUCCESS') {
            await opts.repository.updateFromCallback(normalized.merchantRequestId, { status: 'FAILED', callbackPayload: normalized.raw });
          }
        }
        return res.status(200).json({ message: 'acknowledged' });
      }

      const status = normalized.resultCode === 0 ? 'SUCCESS' : 'FAILED';

      await opts.repository.createFromInitiation({
        provider: 'kcb_buni',
        merchantRequestId: normalized.merchantRequestId,
        checkoutRequestId: normalized.checkoutRequestId,
        providerTransactionId: normalized.callbackMetadata?.MpesaReceiptNumber ?? undefined,
        phoneNumber: normalized.callbackMetadata?.PhoneNumber ?? '',
        amount: Number(normalized.callbackMetadata?.Amount ?? 0),
        invoiceNumber: 'UNKNOWN',
        status,
        raw: normalized.raw,
      });

      return res.status(200).json({ message: 'acknowledged' });
    } catch (err: any) {
      console.error('Callback processing error', { err: err?.message || err });
      return res.status(500).json({ message: 'server_error' });
    }
  });

  return router;
}

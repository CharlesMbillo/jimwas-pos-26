import express, { Request, Response } from 'express';
import { PaymentService } from '../services/PaymentService';
import { PaymentRequest } from '../dto/PaymentRequest';

export function createPaymentController(paymentService: PaymentService) {
  const router = express.Router();

  router.post('/initiate', async (req: Request, res: Response) => {
    try {
      const body = req.body as PaymentRequest;
      if (!body?.phoneNumber || !body?.amount || !body?.invoiceNumber || !body?.callbackUrl) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const response = await paymentService.initiatePayment(body, 'kcb_buni');
      return res.status(200).json(response);
    } catch (err: any) {
      return res.status(500).json({ error: err?.message || 'Internal error' });
    }
  });

  return router;
}

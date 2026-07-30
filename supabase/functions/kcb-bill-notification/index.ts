/**
 * KCB Bill-Notification Endpoint (Phase 2)
 * 
 * KCB sends payment confirmations to this endpoint after successful payment
 * Payload includes signature in X-KCB-SIGNATURE header
 * This is an IPN (Instant Payment Notification) endpoint
 * 
 * Documentation: KCB Validation & Notification Documentation
 * Endpoint: POST /functions/v1/kcb-bill-notification
 * Header: X-KCB-SIGNATURE (Base64-encoded SHA256withRSA signature)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import crypto from 'crypto';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const kcbPublicKey = Deno.env.get('KCB_PUBLIC_KEY') || '';

interface BillNotificationPayload {
  resultCode: string;
  resultMessage: string;
  invoiceNumber: string;
  phoneNumber: string;
  amount: number;
  mpesaReceiptNumber: string;
  transactionDate: string;
  mpesaTransactionId: string;
  orgShortCode: string;
}

interface BillNotificationResponse {
  resultCode: string;
  resultMessage: string;
  timestamp: string;
}

/**
 * Verifies KCB signature using SHA256withRSA
 */
function verifySignature(data: string, signature: string, publicKeyPem: string): boolean {
  try {
    const signatureBuffer = Buffer.from(signature, 'base64');
    const verifier = crypto.createVerify('sha256');
    verifier.update(data, 'utf8');
    return verifier.verify(publicKeyPem, signatureBuffer);
  } catch (error) {
    console.error('[v0] Signature verification error:', error);
    return false;
  }
}

async function processPaymentNotification(
  payload: BillNotificationPayload,
  rawBody: string
): Promise<BillNotificationResponse> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    if (payload.resultCode !== '000') {
      // Payment failed on KCB side
      console.log('[v0] Payment failed:', payload.resultMessage);

      await supabase.from('kcb_transactions').insert({
        invoice_number: payload.invoiceNumber,
        phone_number: payload.phoneNumber,
        amount: payload.amount,
        status: 'failed',
        result_code: payload.resultCode,
        result_message: payload.resultMessage,
        mpesa_receipt: null,
        mpesa_transaction_id: null,
        transaction_date: null,
        org_short_code: payload.orgShortCode,
        raw_payload: JSON.stringify(payload),
        created_at: new Date().toISOString(),
      });

      return {
        resultCode: '000',
        resultMessage: 'Notification received',
        timestamp: new Date().toISOString(),
      };
    }

    // Payment successful - create transaction record
    const { data: transaction, error: insertError } = await supabase
      .from('kcb_transactions')
      .insert({
        invoice_number: payload.invoiceNumber,
        phone_number: payload.phoneNumber,
        amount: payload.amount,
        status: 'completed',
        result_code: payload.resultCode,
        result_message: payload.resultMessage,
        mpesa_receipt: payload.mpesaReceiptNumber,
        mpesa_transaction_id: payload.mpesaTransactionId,
        transaction_date: payload.transactionDate,
        org_short_code: payload.orgShortCode,
        raw_payload: JSON.stringify(payload),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    // Log audit trail
    await supabase.from('kcb_audit_logs').insert({
      event_type: 'bill_notification_received',
      invoice_number: payload.invoiceNumber,
      phone_number: payload.phoneNumber,
      amount: payload.amount,
      result: 'success',
      mpesa_receipt: payload.mpesaReceiptNumber,
      timestamp: new Date().toISOString(),
    });

    // Try to update related transaction if exists
    // This links KCB notification to original STK Push request
    await supabase
      .from('transactions')
      .update({
        status: 'completed',
        mpesa_receipt: payload.mpesaReceiptNumber,
        mpesa_transaction_id: payload.mpesaTransactionId,
      })
      .eq('invoice_number', payload.invoiceNumber)
      .eq('status', 'pending');

    console.log('[v0] Payment notification processed:', {
      invoice: payload.invoiceNumber,
      receipt: payload.mpesaReceiptNumber,
      amount: payload.amount,
    });

    return {
      resultCode: '000',
      resultMessage: 'Notification received and processed',
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[v0] Payment notification processing error:', error);

    // Still return success to KCB (to prevent re-sends)
    // We'll log the error for manual review
    await supabase
      .from('kcb_audit_logs')
      .insert({
        event_type: 'bill_notification_error',
        invoice_number: payload.invoiceNumber,
        phone_number: payload.phoneNumber,
        amount: payload.amount,
        result: 'error',
        error_message: String(error),
        timestamp: new Date().toISOString(),
      })
      .catch((err) => console.error('[v0] Failed to log error:', err));

    return {
      resultCode: '000',
      resultMessage: 'Notification received',
      timestamp: new Date().toISOString(),
    };
  }
}

export async function handler(req: Request): Promise<Response> {
  // Only POST allowed
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({
        resultCode: '400',
        resultMessage: 'Method not allowed',
      }),
      { status: 405, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // Get raw body as string for signature verification
    const rawBody = await req.text();

    // Verify signature before processing
    const signature = req.headers.get('x-kcb-signature');

    if (!signature) {
      console.error('[v0] Missing X-KCB-SIGNATURE header');
      return new Response(
        JSON.stringify({
          resultCode: '401',
          resultMessage: 'Unauthorized - missing signature',
          timestamp: new Date().toISOString(),
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify signature
    if (!kcbPublicKey) {
      console.error('[v0] KCB_PUBLIC_KEY not configured');
      return new Response(
        JSON.stringify({
          resultCode: '500',
          resultMessage: 'Server configuration error',
          timestamp: new Date().toISOString(),
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!verifySignature(rawBody, signature, kcbPublicKey)) {
      console.error('[v0] Signature verification failed');
      return new Response(
        JSON.stringify({
          resultCode: '401',
          resultMessage: 'Unauthorized - invalid signature',
          timestamp: new Date().toISOString(),
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse payload
    const payload: BillNotificationPayload = JSON.parse(rawBody);

    console.log('[v0] Bill notification received (signature verified):', {
      invoice: payload.invoiceNumber,
      amount: payload.amount,
      receipt: payload.mpesaReceiptNumber,
    });

    // Validate required fields
    if (!payload.invoiceNumber || !payload.phoneNumber || payload.amount === undefined) {
      return new Response(
        JSON.stringify({
          resultCode: '400',
          resultMessage: 'Missing required fields',
          timestamp: new Date().toISOString(),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Process the notification
    const response = await processPaymentNotification(payload, rawBody);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[v0] Bill notification handler error:', error);

    return new Response(
      JSON.stringify({
        resultCode: '000',
        resultMessage: 'Notification received',
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

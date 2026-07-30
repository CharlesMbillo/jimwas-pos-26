/**
 * KCB Till-Notification Endpoint (Phase 3)
 * 
 * KCB sends till-specific payment notifications to this endpoint
 * Includes till information, cashier details, and transaction reconciliation
 * Payload includes signature in X-KCB-SIGNATURE header
 * 
 * Documentation: KCB Till Notification Documentation
 * Endpoint: POST /functions/v1/kcb-till-notification
 * Header: X-KCB-SIGNATURE (Base64-encoded SHA256withRSA signature)
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';
import crypto from 'crypto';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const kcbPublicKey = Deno.env.get('KCB_PUBLIC_KEY') || '';

interface TillNotificationPayload {
  resultCode: string;
  resultMessage: string;
  tillId: string;
  cashierId: string;
  cashierName: string;
  invoiceNumber: string;
  phoneNumber: string;
  amount: number;
  mpesaReceiptNumber: string;
  transactionDate: string;
  mpesaTransactionId: string;
  orgShortCode: string;
  transactionTime?: string;
  reconciliationId?: string;
}

interface TillNotificationResponse {
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

async function processTillPaymentNotification(
  payload: TillNotificationPayload,
  rawBody: string
): Promise<TillNotificationResponse> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    if (payload.resultCode !== '000') {
      // Payment failed
      console.log('[v0] Till payment failed:', payload.resultMessage);

      await supabase.from('till_transactions').insert({
        till_id: payload.tillId,
        cashier_id: payload.cashierId,
        cashier_name: payload.cashierName,
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

    // Payment successful
    const { error: insertError } = await supabase.from('till_transactions').insert({
      till_id: payload.tillId,
      cashier_id: payload.cashierId,
      cashier_name: payload.cashierName,
      invoice_number: payload.invoiceNumber,
      phone_number: payload.phoneNumber,
      amount: payload.amount,
      status: 'completed',
      result_code: payload.resultCode,
      result_message: payload.resultMessage,
      mpesa_receipt: payload.mpesaReceiptNumber,
      mpesa_transaction_id: payload.mpesaTransactionId,
      transaction_date: payload.transactionDate,
      transaction_time: payload.transactionTime,
      reconciliation_id: payload.reconciliationId,
      org_short_code: payload.orgShortCode,
      raw_payload: JSON.stringify(payload),
      created_at: new Date().toISOString(),
    });

    if (insertError) {
      throw insertError;
    }

    // Log audit trail
    await supabase.from('kcb_audit_logs').insert({
      event_type: 'till_notification_received',
      till_id: payload.tillId,
      cashier_id: payload.cashierId,
      invoice_number: payload.invoiceNumber,
      phone_number: payload.phoneNumber,
      amount: payload.amount,
      result: 'success',
      mpesa_receipt: payload.mpesaReceiptNumber,
      timestamp: new Date().toISOString(),
    });

    // Update POS transaction if exists
    const { data: posTransaction } = await supabase
      .from('transactions')
      .select('id')
      .eq('invoice_number', payload.invoiceNumber)
      .eq('status', 'pending')
      .single();

    if (posTransaction) {
      await supabase
        .from('transactions')
        .update({
          status: 'completed',
          mpesa_receipt: payload.mpesaReceiptNumber,
          mpesa_transaction_id: payload.mpesaTransactionId,
          cashier_id: payload.cashierId,
          till_id: payload.tillId,
        })
        .eq('id', posTransaction.id);
    }

    console.log('[v0] Till payment notification processed:', {
      till: payload.tillId,
      cashier: payload.cashierName,
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
    console.error('[v0] Till payment notification processing error:', error);

    // Log error for manual review
    await supabase
      .from('kcb_audit_logs')
      .insert({
        event_type: 'till_notification_error',
        till_id: payload.tillId,
        cashier_id: payload.cashierId,
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
    // Get raw body for signature verification
    const rawBody = await req.text();

    // Get signature from header
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

    // Verify signature
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
    const payload: TillNotificationPayload = JSON.parse(rawBody);

    console.log('[v0] Till notification received (signature verified):', {
      till: payload.tillId,
      cashier: payload.cashierName,
      invoice: payload.invoiceNumber,
      receipt: payload.mpesaReceiptNumber,
    });

    // Validate required fields
    if (
      !payload.tillId ||
      !payload.cashierId ||
      !payload.invoiceNumber ||
      !payload.phoneNumber ||
      payload.amount === undefined
    ) {
      return new Response(
        JSON.stringify({
          resultCode: '400',
          resultMessage: 'Missing required fields',
          timestamp: new Date().toISOString(),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Process notification
    const response = await processTillPaymentNotification(payload, rawBody);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[v0] Till notification handler error:', error);

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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { verifySignature } from "../lib/signature.ts";
import { logAuditEvent, createAlertIfNeeded } from "../lib/audit_log.ts";

interface IPNPayload {
  merchantRequestId: string;
  checkoutRequestId: string;
  responseCode: string;
  responseDescription: string;
  resultCode?: string;
  resultDesc?: string;
  amount?: number;
  mpesaReceiptNumber?: string;
  transactionDate?: string;
  phoneNumber?: string;
  invoiceNumber?: string;
}

export async function handler(req: Request): Promise<Response> {
  try {
    // Parse incoming IPN notification from KCB
    const payload: IPNPayload = await req.json();
    
    // Extract signature from headers for verification
    const signature = req.headers.get("x-signature");
    const rawBody = await req.clone().text();

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase credentials");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify webhook signature if present
    if (signature) {
      const publicKeyPem = Deno.env.get("KCB_WEBHOOK_PUBLIC_KEY");
      if (publicKeyPem) {
        const isValid = await verifySignature(publicKeyPem, rawBody, signature);
        if (!isValid) {
          console.error("[v0] IPN signature verification failed");
          
          // Log failed verification
          await logAuditEvent(supabase, {
            eventType: 'SIGNATURE_VERIFICATION_FAILED',
            actor: 'kcb-webhook',
            resource: payload.merchantRequestId,
            action: 'IPN signature verification failed',
            status: 'FAILED',
            metadata: { payloadId: payload.merchantRequestId },
          }, req);

          await createAlertIfNeeded(supabase, 'SIGNATURE_VERIFICATION_FAILED', {
            merchantRequestId: payload.merchantRequestId,
          });

          return new Response(
            JSON.stringify({ error: 'Signature verification failed' }),
            { status: 401, headers: { 'Content-Type': 'application/json' } }
          );
        }
        
        // Log verified IPN
        await logAuditEvent(supabase, {
          eventType: 'IPN_VERIFIED',
          actor: 'kcb-webhook',
          resource: payload.merchantRequestId,
          action: 'IPN signature verified successfully',
          status: 'SUCCESS',
          metadata: { responseCode: payload.responseCode },
        }, req);
      }
    }

    console.log("[v0] IPN Notification received:", {
      merchantRequestId: payload.merchantRequestId,
      responseCode: payload.responseCode,
    });

    // Determine payment status based on KCB response
    let paymentStatus = "PENDING";
    if (payload.responseCode === "0") {
      paymentStatus = "SUCCESS";
    } else if (payload.responseCode === "1") {
      paymentStatus = "TIMEOUT";
    } else {
      paymentStatus = "FAILED";
    }

    // Update payment status in database
    const { data: paymentData, error: paymentError } = await supabase
      .from("kcb_payments")
      .update({
        status: paymentStatus,
        mpesa_receipt_number: payload.mpesaReceiptNumber || null,
        transaction_date: payload.transactionDate || null,
        response_code: payload.responseCode,
        response_description: payload.responseDescription,
      })
      .eq("merchant_request_id", payload.merchantRequestId)
      .select()
      .single();

    if (paymentError) {
      console.error("[v0] Error updating payment:", paymentError);
      throw paymentError;
    }

    console.log("[v0] Payment updated:", {
      id: paymentData.id,
      status: paymentStatus,
    });

    // Log payment status update
    await logAuditEvent(supabase, {
      eventType: 'IPN_RECEIVED',
      actor: 'kcb-webhook',
      resource: payload.merchantRequestId,
      action: `Payment status updated to ${paymentStatus}`,
      status: 'SUCCESS',
      metadata: {
        paymentStatus,
        responseCode: payload.responseCode,
        mpesaReceipt: payload.mpesaReceiptNumber,
      },
    }, req);

    // If payment successful, trigger invoice creation
    if (paymentStatus === "SUCCESS") {
      // Get invoice from database (should exist from order creation)
      const { data: invoiceData, error: invoiceError } = await supabase
        .from("invoices")
        .select("*")
        .eq("invoice_number", payload.invoiceNumber || paymentData.invoice_number)
        .single();

      if (invoiceError && invoiceError.code !== "PGRST116") {
        console.error("[v0] Error fetching invoice:", invoiceError);
      }

      if (invoiceData) {
        // Update invoice status to mark payment received
        const { error: updateInvoiceError } = await supabase
          .from("invoices")
          .update({
            payment_status: "PAID",
            paid_date: new Date().toISOString(),
            payment_method: "M-PESA",
          })
          .eq("id", invoiceData.id);

        if (updateInvoiceError) {
          console.error("[v0] Error updating invoice:", updateInvoiceError);
        }

        console.log("[v0] Invoice marked as paid:", invoiceData.id);
      }
    }

    // Log the IPN notification for audit trail
    const { error: logError } = await supabase
      .from("ipn_notifications")
      .insert({
        merchant_request_id: payload.merchantRequestId,
        checkout_request_id: payload.checkoutRequestId,
        payment_status: paymentStatus,
        response_code: payload.responseCode,
        response_description: payload.responseDescription,
        mpesa_receipt_number: payload.mpesaReceiptNumber,
        raw_payload: payload,
        received_at: new Date().toISOString(),
      });

    if (logError) {
      console.warn("[v0] Warning logging IPN notification:", logError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "IPN notification processed",
        paymentStatus,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("[v0] IPN Notification Error:", error);
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Log IPN processing error
      await logAuditEvent(supabase, {
        eventType: 'IPN_FAILED',
        actor: 'kcb-webhook',
        resource: 'unknown',
        action: 'IPN processing failed',
        status: 'FAILED',
        metadata: {
          error: error instanceof Error ? error.message : String(error),
        },
      }, req);

      await createAlertIfNeeded(supabase, 'IPN_FAILED', {
        error: error instanceof Error ? error.message : String(error),
      });
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}

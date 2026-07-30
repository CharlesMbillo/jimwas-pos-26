/**
 * KCB Bill-Validation Endpoint
 * 
 * KCB queries this endpoint to validate bills before showing payment prompt
 * Request: POST from KCB server with bill details
 * Response: Return bill details + validation status (NOT a payment confirmation)
 * 
 * Documentation: KCB Validation & Notification Documentation
 * Endpoint: POST /functions/v1/kcb-bill-validation
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const kcbPublicKey = Deno.env.get('KCB_PUBLIC_KEY') || '';

interface BillValidationRequest {
  phoneNumber: string;
  amount: number;
  invoiceNumber: string;
  orgShortCode: string;
  timestamp: string;
}

interface BillValidationResponse {
  resultCode: string;
  resultMessage: string;
  billDetails: {
    invoiceNumber: string;
    amount: number;
    phoneNumber: string;
    customerName?: string;
    accountNumber?: string;
    dueDate?: string;
  } | null;
  timestamp: string;
}

async function validateBill(request: BillValidationRequest): Promise<BillValidationResponse> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Verify bill exists in system
    const { data: bill, error } = await supabase
      .from('bill_validations')
      .select('*')
      .eq('invoice_number', request.invoiceNumber)
      .eq('org_short_code', request.orgShortCode)
      .single();

    if (error || !bill) {
      // Bill not found - return validation error
      return {
        resultCode: '001',
        resultMessage: 'Bill not found',
        billDetails: null,
        timestamp: new Date().toISOString(),
      };
    }

    // Verify amount matches
    if (bill.amount !== request.amount) {
      return {
        resultCode: '002',
        resultMessage: 'Amount mismatch',
        billDetails: null,
        timestamp: new Date().toISOString(),
      };
    }

    // Verify phone number matches
    if (bill.phone_number !== request.phoneNumber) {
      return {
        resultCode: '003',
        resultMessage: 'Phone number mismatch',
        billDetails: null,
        timestamp: new Date().toISOString(),
      };
    }

    // Log validation request for audit
    await supabase.from('kcb_audit_logs').insert({
      event_type: 'bill_validation_query',
      invoice_number: request.invoiceNumber,
      phone_number: request.phoneNumber,
      amount: request.amount,
      result: 'success',
      timestamp: new Date().toISOString(),
    });

    // Bill is valid - return bill details
    return {
      resultCode: '000',
      resultMessage: 'Bill valid',
      billDetails: {
        invoiceNumber: bill.invoice_number,
        amount: bill.amount,
        phoneNumber: bill.phone_number,
        customerName: bill.customer_name,
        accountNumber: bill.account_number,
        dueDate: bill.due_date,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('[v0] Bill validation error:', error);

    return {
      resultCode: '500',
      resultMessage: 'Internal server error',
      billDetails: null,
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
    const body = await req.json();

    // Log incoming request
    console.log('[v0] Bill validation request received:', {
      invoiceNumber: body.invoiceNumber,
      phone: body.phoneNumber,
      amount: body.amount,
      timestamp: new Date().toISOString(),
    });

    // Validate request structure
    if (!body.phoneNumber || !body.amount || !body.invoiceNumber || !body.orgShortCode) {
      return new Response(
        JSON.stringify({
          resultCode: '400',
          resultMessage: 'Missing required fields',
          timestamp: new Date().toISOString(),
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate bill
    const response = await validateBill({
      phoneNumber: body.phoneNumber,
      amount: body.amount,
      invoiceNumber: body.invoiceNumber,
      orgShortCode: body.orgShortCode,
      timestamp: body.timestamp || new Date().toISOString(),
    });

    // Return appropriate status code based on validation result
    const statusCode = response.resultCode === '000' ? 200 : response.resultCode.startsWith('5') ? 500 : 400;

    return new Response(JSON.stringify(response), {
      status: statusCode,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[v0] Bill validation handler error:', error);

    return new Response(
      JSON.stringify({
        resultCode: '500',
        resultMessage: 'Internal server error',
        billDetails: null,
        timestamp: new Date().toISOString(),
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

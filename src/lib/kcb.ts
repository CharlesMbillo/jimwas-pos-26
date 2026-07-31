/**
 * KCB Buni Integration Library
 * Comprehensive utilities for KCB bill validation, notifications, and till IPNs
 * 
 * This library supports three main payment flows:
 * 1. Bill-Validation: Query endpoint to validate bills
 * 2. Bill-Notification: IPN endpoint for payment confirmations
 * 3. Till-Notification: IPN endpoint for till-specific payments
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export interface KCBSettings {
  id?: string;
  orgId: string;
  orgShortCode: string;
  orgPassKey: string;
  environment: 'sandbox' | 'production';
  isEnabled: boolean;
  billValidationUrl?: string;
  billNotificationUrl?: string;
  tillNotificationUrl?: string;
}

export interface BillValidationRequest {
  phoneNumber: string;
  amount: number;
  invoiceNumber: string;
  orgShortCode: string;
  timestamp?: string;
}

export interface BillValidationResponse {
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

export interface BillNotificationPayload {
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

export interface TillNotificationPayload {
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

export interface BillRecord {
  id: string;
  invoiceNumber: string;
  orgShortCode: string;
  phoneNumber: string;
  amount: number;
  customerName?: string;
  accountNumber?: string;
  dueDate?: string;
  status: 'active' | 'paid' | 'cancelled';
  description?: string;
  createdAt: string;
}

export interface KCBTransaction {
  id: string;
  invoiceNumber: string;
  phoneNumber: string;
  amount: number;
  status: 'pending' | 'completed' | 'failed';
  resultCode: string;
  resultMessage: string;
  mpesaReceipt?: string;
  mpesaTransactionId?: string;
  transactionDate?: string;
  orgShortCode: string;
  createdAt: string;
}

/**
 * Initialize Supabase client
 */
function getSupabaseClient() {
  return createClient(supabaseUrl, supabaseKey);
}

/**
 * Get KCB settings for an organization
 */
export async function getKCBSettings(orgShortCode: string): Promise<KCBSettings | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('kcb_settings')
    .select('*')
    .eq('org_short_code', orgShortCode)
    .single();

  if (error) {
    console.error('[v0] Error fetching KCB settings:', error);
    return null;
  }

  return data as KCBSettings;
}

/**
 * Update KCB settings
 */
export async function updateKCBSettings(
  orgShortCode: string,
  updates: Partial<KCBSettings>
): Promise<KCBSettings | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('kcb_settings')
    .update(updates)
    .eq('org_short_code', orgShortCode)
    .select()
    .single();

  if (error) {
    console.error('[v0] Error updating KCB settings:', error);
    return null;
  }

  return data as KCBSettings;
}

/**
 * Create a bill for validation
 */
export async function createBill(bill: BillRecord): Promise<BillRecord | null> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase.from('bill_validations').insert({
    invoice_number: bill.invoiceNumber,
    org_short_code: bill.orgShortCode,
    phone_number: bill.phoneNumber,
    amount: bill.amount,
    customer_name: bill.customerName,
    account_number: bill.accountNumber,
    due_date: bill.dueDate,
    description: bill.description,
    status: bill.status || 'active',
  });

  if (error) {
    console.error('[v0] Error creating bill:', error);
    return null;
  }

  return bill;
}

/**
 * Get bills for an organization
 */
export async function getBills(
  orgShortCode: string,
  status?: 'active' | 'paid' | 'cancelled'
): Promise<BillRecord[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('bill_validations')
    .select('*')
    .eq('org_short_code', orgShortCode);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('[v0] Error fetching bills:', error);
    return [];
  }

  return (data || []) as BillRecord[];
}

/**
 * Get KCB transactions
 */
export async function getKCBTransactions(orgShortCode: string): Promise<KCBTransaction[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('kcb_transactions')
    .select('*')
    .eq('org_short_code', orgShortCode)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[v0] Error fetching transactions:', error);
    return [];
  }

  return (data || []) as KCBTransaction[];
}

/**
 * Get till transactions for a specific till
 */
export async function getTillTransactions(
  orgShortCode: string,
  tillId: string
): Promise<KCBTransaction[]> {
  const supabase = getSupabaseClient();

  const { data, error } = await supabase
    .from('till_transactions')
    .select('*')
    .eq('org_short_code', orgShortCode)
    .eq('till_id', tillId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[v0] Error fetching till transactions:', error);
    return [];
  }

  return (data || []) as KCBTransaction[];
}

/**
 * Get audit logs for debugging
 */
export async function getKCBAuditLogs(
  orgShortCode?: string,
  eventType?: string,
  limit: number = 100
): Promise<any[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('kcb_audit_logs')
    .select('*')
    .order('timestamp', { ascending: false })
    .limit(limit);

  if (eventType) {
    query = query.eq('event_type', eventType);
  }

  const { data, error } = await query;

  if (error) {
    console.error('[v0] Error fetching audit logs:', error);
    return [];
  }

  return data || [];
}

/**
 * Validate a bill (query endpoint)
 * This would be called internally to test bill-validation endpoint
 */
export async function validateBillRequest(
  request: BillValidationRequest
): Promise<BillValidationResponse> {
  try {
    const response = await fetch(
      `${supabaseUrl}/functions/v1/kcb-bill-validation`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      }
    );

    return await response.json();
  } catch (error) {
    console.error('[v0] Error validating bill:', error);
    return {
      resultCode: '500',
      resultMessage: 'Error validating bill',
      billDetails: null,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Format phone number to KCB format (254XXXXXXXXX)
 */
export function formatPhoneNumber(phone: string): string {
  // Remove any non-digit characters
  const cleaned = phone.replace(/\D/g, '');

  // If starts with 0, replace with 254
  if (cleaned.startsWith('0')) {
    return '254' + cleaned.substring(1);
  }

  // If already starts with 254, keep as is
  if (cleaned.startsWith('254')) {
    return cleaned;
  }

  // Otherwise assume it's missing country code and add 254
  return '254' + cleaned;
}

/**
 * Format currency value
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
  }).format(amount);
}

/**
 * Get transaction status badge
 */
export function getStatusBadge(status: string): string {
  const badges: Record<string, string> = {
    completed: 'bg-green-100 text-green-800',
    pending: 'bg-yellow-100 text-yellow-800',
    failed: 'bg-red-100 text-red-800',
  };
  return badges[status] || 'bg-gray-100 text-gray-800';
}

/**
 * Check if organization is KCB-enabled
 */
export async function isKCBEnabled(orgShortCode: string): Promise<boolean> {
  const settings = await getKCBSettings(orgShortCode);
  return settings?.isEnabled ?? false;
}

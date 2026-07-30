// Ledger Module - Financial tracking and reporting for Jimwas POS

import {
  getAllTransactions,
  getAllInstallmentPayments,
  getAllLoyaltyTransactions,
  getBusinessSettings,
  saveLedgerEntry,
  getAllLedgerEntries,
  getAllExpenseCategories,
  saveExpenseCategory,
  generateId,
  type LedgerEntryRecord,
  type ExpenseCategoryRecord,
} from './db';
import { syncInsertLedgerEntry } from './sync';

export type LedgerEntryType = 'sale' | 'refund' | 'installment_payment' | 'loyalty_redemption' | 'void' | 'income' | 'expense' | 'adjustment' | 'cash_draw' | 'transfer';

export interface LedgerEntry {
  id: string;
  date: string;
  type: LedgerEntryType;
  reference_id: string;
  reference_type: string;
  description: string;
  amount: number;
  payment_method: string;
  customer_id?: string;
  customer_name?: string;
  cashier_id?: string;
  cashier_name?: string;
  branch_id?: string;
  category?: string;
  notes?: string;
  is_manual?: boolean;
  sync_status: 'pending' | 'synced';
}

export interface DailySummary {
  date: string;
  total_sales: number;
  total_refunds: number;
  total_voids: number;
  total_installment_payments: number;
  total_loyalty_redemptions: number;
  total_income: number;
  total_expenses: number;
  total_adjustments: number;
  net_revenue: number;
  transaction_count: number;
  by_payment_method: Record<string, number>;
  by_category: Record<string, number>;
}

export interface PeriodSummary {
  start_date: string;
  end_date: string;
  total_sales: number;
  total_refunds: number;
  total_voids: number;
  total_installment_payments: number;
  total_income: number;
  total_expenses: number;
  total_adjustments: number;
  net_revenue: number;
  transaction_count: number;
  average_daily: number;
  by_payment_method: Record<string, number>;
  by_category: Record<string, number>;
  daily_breakdown: DailySummary[];
}

export async function getLedgerEntries(
  dateFrom?: string,
  dateTo?: string,
  type?: string
): Promise<LedgerEntry[]> {
  const transactions = await getAllTransactions();
  const installmentPayments = await getAllInstallmentPayments();
  const loyaltyTransactions = await getAllLoyaltyTransactions();
  const manualEntries = await getAllLedgerEntries();

  const entries: LedgerEntry[] = [];

  // Process transactions
  for (const tx of transactions) {
    const txDate = tx.created_at?.split('T')[0] || '';
    if (dateFrom && txDate < dateFrom) continue;
    if (dateTo && txDate > dateTo) continue;

    const entry: LedgerEntry = {
      id: tx.id,
      date: tx.created_at,
      type: tx.status === 'voided' ? 'void' : tx.status === 'refunded' ? 'refund' : 'sale',
      reference_id: tx.id,
      reference_type: 'transaction',
      description: tx.status === 'voided' ? 'Voided Sale' : tx.status === 'refunded' ? 'Refunded Sale' : 'Sale',
      amount: tx.total_amount,
      payment_method: tx.payment_method,
      customer_id: tx.customer_id,
      cashier_id: tx.cashier_id,
      cashier_name: tx.cashier_name,
      branch_id: tx.branch_id,
      sync_status: tx.sync_status,
    };

    if (type && entry.type !== type) continue;

    entries.push(entry);
  }

  // Process installment payments
  for (const payment of installmentPayments) {
    const payDate = payment.created_at?.split('T')[0] || '';
    if (dateFrom && payDate < dateFrom) continue;
    if (dateTo && payDate > dateTo) continue;

    const entry: LedgerEntry = {
      id: payment.id,
      date: payment.created_at,
      type: 'installment_payment',
      reference_id: payment.id,
      reference_type: 'installment_payment',
      description: 'Installment Payment',
      amount: payment.amount,
      payment_method: payment.payment_method,
      sync_status: payment.sync_status,
    };

    if (type && entry.type !== type) continue;

    entries.push(entry);
  }

  // Process loyalty redemptions
  for (const loyalty of loyaltyTransactions) {
    if (loyalty.transaction_type !== 'redeemed') continue;

    const loyDate = loyalty.created_at?.split('T')[0] || '';
    if (dateFrom && loyDate < dateFrom) continue;
    if (dateTo && loyDate > dateTo) continue;

    const entry: LedgerEntry = {
      id: loyalty.id,
      date: loyalty.created_at,
      type: 'loyalty_redemption',
      reference_id: loyalty.id,
      reference_type: 'loyalty_transaction',
      description: 'Loyalty Points Redemption',
      amount: loyalty.points,
      payment_method: 'loyalty',
      customer_id: loyalty.customer_id,
      sync_status: loyalty.sync_status,
    };

    if (type && entry.type !== type) continue;

    entries.push(entry);
  }

  // Process manual ledger entries
  for (const manual of manualEntries) {
    const entryDate = manual.date?.split('T')[0] || '';
    if (dateFrom && entryDate < dateFrom) continue;
    if (dateTo && entryDate > dateTo) continue;

    const entry: LedgerEntry = {
      id: manual.id,
      date: manual.date,
      type: manual.entry_type,
      reference_id: manual.reference_id || manual.id,
      reference_type: manual.reference_type || 'manual_entry',
      description: manual.description,
      amount: manual.amount,
      payment_method: manual.payment_method,
      customer_id: manual.customer_id,
      cashier_id: manual.cashier_id,
      cashier_name: manual.cashier_name,
      branch_id: manual.branch_id,
      category: manual.category,
      notes: manual.notes,
      is_manual: manual.is_manual,
      sync_status: manual.sync_status,
    };

    if (type && entry.type !== type) continue;

    entries.push(entry);
  }

  // Sort by date descending
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return entries;
}

export async function getDailySummary(date: string): Promise<DailySummary> {
  const entries = await getLedgerEntries(date, date);

  const summary: DailySummary = {
    date,
    total_sales: 0,
    total_refunds: 0,
    total_voids: 0,
    total_installment_payments: 0,
    total_loyalty_redemptions: 0,
    total_income: 0,
    total_expenses: 0,
    total_adjustments: 0,
    net_revenue: 0,
    transaction_count: 0,
    by_payment_method: {},
    by_category: {},
  };

  for (const entry of entries) {
    switch (entry.type) {
      case 'sale':
        summary.total_sales += entry.amount;
        summary.transaction_count++;
        break;
      case 'refund':
        summary.total_refunds += entry.amount;
        break;
      case 'void':
        summary.total_voids += entry.amount;
        break;
      case 'installment_payment':
        summary.total_installment_payments += entry.amount;
        break;
      case 'loyalty_redemption':
        summary.total_loyalty_redemptions += entry.amount;
        break;
      case 'income':
        summary.total_income += entry.amount;
        break;
      case 'expense':
        summary.total_expenses += entry.amount;
        break;
      case 'adjustment':
        summary.total_adjustments += entry.amount;
        break;
      case 'cash_draw':
      case 'transfer':
        break;
    }

    const method = entry.payment_method || 'unknown';
    summary.by_payment_method[method] = (summary.by_payment_method[method] || 0) + entry.amount;

    if (entry.category) {
      summary.by_category[entry.category] = (summary.by_category[entry.category] || 0) + entry.amount;
    }
  }

  summary.net_revenue = summary.total_sales + summary.total_installment_payments + summary.total_income - summary.total_refunds - summary.total_voids - summary.total_expenses + summary.total_adjustments;

  return summary;
}

export async function getPeriodSummary(
  startDate: string,
  endDate: string
): Promise<PeriodSummary> {
  const entries = await getLedgerEntries(startDate, endDate);

  const summary: PeriodSummary = {
    start_date: startDate,
    end_date: endDate,
    total_sales: 0,
    total_refunds: 0,
    total_voids: 0,
    total_installment_payments: 0,
    total_income: 0,
    total_expenses: 0,
    total_adjustments: 0,
    net_revenue: 0,
    transaction_count: 0,
    average_daily: 0,
    by_payment_method: {},
    by_category: {},
    daily_breakdown: [],
  };

  const dailyMap = new Map<string, DailySummary>();

  for (const entry of entries) {
    const entryDate = entry.date.split('T')[0];

    if (!dailyMap.has(entryDate)) {
      dailyMap.set(entryDate, {
        date: entryDate,
        total_sales: 0,
        total_refunds: 0,
        total_voids: 0,
        total_installment_payments: 0,
        total_loyalty_redemptions: 0,
        total_income: 0,
        total_expenses: 0,
        total_adjustments: 0,
        net_revenue: 0,
        transaction_count: 0,
        by_payment_method: {},
        by_category: {},
      });
    }

    const daily = dailyMap.get(entryDate)!;

    switch (entry.type) {
      case 'sale':
        summary.total_sales += entry.amount;
        daily.total_sales += entry.amount;
        summary.transaction_count++;
        daily.transaction_count++;
        break;
      case 'refund':
        summary.total_refunds += entry.amount;
        daily.total_refunds += entry.amount;
        break;
      case 'void':
        summary.total_voids += entry.amount;
        daily.total_voids += entry.amount;
        break;
      case 'installment_payment':
        summary.total_installment_payments += entry.amount;
        daily.total_installment_payments += entry.amount;
        break;
      case 'loyalty_redemption':
        summary.total_loyalty_redemptions += entry.amount;
        daily.total_loyalty_redemptions += entry.amount;
        break;
      case 'income':
        summary.total_income += entry.amount;
        daily.total_income += entry.amount;
        break;
      case 'expense':
        summary.total_expenses += entry.amount;
        daily.total_expenses += entry.amount;
        break;
      case 'adjustment':
        summary.total_adjustments += entry.amount;
        daily.total_adjustments += entry.amount;
        break;
      case 'cash_draw':
      case 'transfer':
        break;
    }

    const method = entry.payment_method || 'unknown';
    summary.by_payment_method[method] = (summary.by_payment_method[method] || 0) + entry.amount;
    daily.by_payment_method[method] = (daily.by_payment_method[method] || 0) + entry.amount;

    if (entry.category) {
      summary.by_category[entry.category] = (summary.by_category[entry.category] || 0) + entry.amount;
      daily.by_category[entry.category] = (daily.by_category[entry.category] || 0) + entry.amount;
    }
  }

  for (const daily of dailyMap.values()) {
    daily.net_revenue = daily.total_sales + daily.total_installment_payments + daily.total_income - daily.total_refunds - daily.total_voids - daily.total_expenses + daily.total_adjustments;
  }

  summary.net_revenue = summary.total_sales + summary.total_installment_payments + summary.total_income - summary.total_refunds - summary.total_voids - summary.total_expenses + summary.total_adjustments;

  const days = Math.max(1, dailyMap.size);
  summary.average_daily = summary.net_revenue / days;

  summary.daily_breakdown = Array.from(dailyMap.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return summary;
}

export async function getTodaySummary(): Promise<DailySummary> {
  const today = new Date().toISOString().split('T')[0];
  return getDailySummary(today);
}

export async function getMonthSummary(): Promise<PeriodSummary> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startDate = startOfMonth.toISOString().split('T')[0];
  const endDate = now.toISOString().split('T')[0];
  return getPeriodSummary(startDate, endDate);
}

export async function getWeekSummary(): Promise<PeriodSummary> {
  const now = new Date();
  const startOfWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const startDate = startOfWeek.toISOString().split('T')[0];
  const endDate = now.toISOString().split('T')[0];
  return getPeriodSummary(startDate, endDate);
}

export function formatCurrency(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function getPaymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: 'Cash',
    mpesa: 'M-Pesa',
    card: 'Card',
    bank_transfer: 'Bank Transfer',
    loyalty: 'Loyalty Points',
    unknown: 'Other',
  };
  return labels[method] || method;
}

export function getEntryTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    sale: 'Sale',
    refund: 'Refund',
    void: 'Void',
    installment_payment: 'Installment Payment',
    loyalty_redemption: 'Loyalty Redemption',
    income: 'Income',
    expense: 'Expense',
    adjustment: 'Adjustment',
    cash_draw: 'Cash Draw',
    transfer: 'Transfer',
  };
  return labels[type] || type;
}

// Create a manual ledger entry (income, expense, adjustment)
export async function createManualEntry(
  entry: {
    entry_type: 'income' | 'expense' | 'adjustment' | 'cash_draw' | 'transfer';
    description: string;
    amount: number;
    payment_method?: string;
    category?: string;
    notes?: string;
    cashier_id?: string;
    cashier_name?: string;
    branch_id?: string;
  },
  userId?: string
): Promise<LedgerEntryRecord> {
  const now = new Date().toISOString();
  const id = generateId();

  const record: LedgerEntryRecord = {
    id,
    date: now,
    entry_type: entry.entry_type,
    category: entry.category,
    description: entry.description,
    amount: Math.abs(entry.amount),
    payment_method: entry.payment_method || 'cash',
    cashier_id: entry.cashier_id,
    cashier_name: entry.cashier_name,
    branch_id: entry.branch_id,
    notes: entry.notes,
    is_manual: true,
    created_at: now,
    created_by: userId,
    sync_status: 'pending',
    local_id: generateId(),
  };

  await saveLedgerEntry(record);
  syncInsertLedgerEntry(record);

  return record;
}

// Get default expense categories
export async function getExpenseCategories(): Promise<ExpenseCategoryRecord[]> {
  let categories = await getAllExpenseCategories();

  if (categories.length === 0) {
    const defaults = [
      { name: 'Rent', description: 'Shop rent and lease payments' },
      { name: 'Utilities', description: 'Electricity, water, internet bills' },
      { name: 'Salaries', description: 'Staff wages and compensation' },
      { name: 'Supplies', description: 'Shop supplies and packaging' },
      { name: 'Maintenance', description: 'Equipment and shop repairs' },
      { name: 'Marketing', description: 'Advertising and promotions' },
      { name: 'Transport', description: 'Delivery and transport costs' },
      { name: 'Other', description: 'Miscellaneous expenses' },
    ];

    for (const cat of defaults) {
      const record: ExpenseCategoryRecord = {
        id: generateId(),
        name: cat.name,
        description: cat.description,
        is_active: true,
        created_at: new Date().toISOString(),
      };
      await saveExpenseCategory(record);
      categories.push(record);
    }
  }

  return categories.filter(c => c.is_active);
}

// Export ledger to CSV
export function exportLedgerToCSV(entries: LedgerEntry[]): string {
  const headers = ['Date', 'Type', 'Category', 'Description', 'Amount', 'Payment Method', 'Notes'];
  const rows = entries.map(entry => [
    entry.date,
    getEntryTypeLabel(entry.type),
    entry.category || '',
    entry.description,
    entry.amount.toString(),
    getPaymentMethodLabel(entry.payment_method),
    entry.notes || '',
  ]);

  return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
}

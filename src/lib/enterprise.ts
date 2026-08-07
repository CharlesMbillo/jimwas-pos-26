import { getDB, generateId } from './db';
import { queueForSync } from './sync';
import type { OutboundDelivery, ReconciliationRecord, ReportFilters, ShiftRecord, OfferRule, SupplierFulfillment, Transaction } from './types';

export async function saveEnterpriseRecord<T extends { id: string }>(store: string, table: string, record: T) {
  const db = await getDB();
  await db.put(store as never, record as never);
  queueForSync(table, 'update', record);
  return record;
}

export async function listEnterpriseRecords<T>(store: string): Promise<T[]> {
  const db = await getDB();
  return (await db.getAll(store as never)) as T[];
}

export async function openShift(input: Pick<ShiftRecord, 'cashier_id' | 'opening_float' | 'branch_id' | 'terminal_id'>): Promise<ShiftRecord> {
  const now = new Date().toISOString();
  const shift: ShiftRecord = { id: generateId(), ...input, opened_at: now, opening_float: Number(input.opening_float) || 0, cash_sales: 0, card_sales: 0, mobile_money_sales: 0, bank_sales: 0, credit_sales: 0, refunds: 0, discounts: 0, tax: 0, gross_sales: 0, net_sales: 0, status: 'open', sync_status: 'pending' };
  return saveEnterpriseRecord('shifts', 'shifts', shift);
}

export async function calculateReport(filters: ReportFilters) {
  const db = await getDB();
  const transactions = (await db.getAll('transactions')) as Transaction[];
  const from = new Date(filters.from).getTime();
  const to = new Date(filters.to).getTime();
  const rows = transactions.filter((transaction) => {
    const created = new Date(transaction.created_at).getTime();
    return created >= from && created <= to && (!filters.payment_method || transaction.payment_method === filters.payment_method) && (!filters.customer_id || transaction.customer_id === filters.customer_id) && (!filters.sale_type || transaction.sale_type === filters.sale_type);
  });
  const gross = rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  const paid = rows.reduce((sum, row) => sum + Number(row.amount_paid || 0), 0);
  const paymentMix = rows.reduce<Record<string, number>>((mix, row) => { mix[row.payment_method] = (mix[row.payment_method] || 0) + Number(row.total_amount || 0); return mix; }, {});
  return { rows, count: rows.length, gross, paid, averageBasket: rows.length ? gross / rows.length : 0, paymentMix };
}

export async function createDelivery(transaction_id: string, data: Partial<OutboundDelivery> = {}) {
  const now = new Date().toISOString();
  const delivery: OutboundDelivery = { id: generateId(), transaction_id, status: 'pending', created_at: now, updated_at: now, sync_status: 'pending', ...data };
  return saveEnterpriseRecord('outbound_deliveries', 'outbound_deliveries', delivery);
}

export async function createReconciliation(data: Omit<ReconciliationRecord, 'id' | 'created_at' | 'sync_status'>) {
  return saveEnterpriseRecord('reconciliations', 'reconciliations', { ...data, id: generateId(), created_at: new Date().toISOString(), sync_status: 'pending' });
}

export async function saveOffer(data: Omit<OfferRule, 'id' | 'sync_status'>) {
  return saveEnterpriseRecord('offers', 'offers', { ...data, id: generateId(), sync_status: 'pending' });
}

export async function saveSupplierFulfillment(data: Omit<SupplierFulfillment, 'id' | 'created_at' | 'sync_status'>) {
  return saveEnterpriseRecord('supplier_fulfillments', 'supplier_fulfillments', { ...data, id: generateId(), created_at: new Date().toISOString(), sync_status: 'pending' });
}

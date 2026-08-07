import { getDB, generateId } from './db';
import { queueForSync } from './sync';
import type { OutboundDelivery, ReconciliationRecord, ReportFilters, ShiftRecord, OfferRule, SupplierFulfillment, Transaction, ReportSchedule, SafeDropRecord } from './types';
import { logAuditEvent } from './audit';

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

export async function closeShift(shift: ShiftRecord, cashCount: number, actorId?: string) {
  if (shift.status !== 'open') throw new Error('This shift is already locked.');
  const expected = shift.opening_float + shift.cash_sales - shift.refunds;
  const closed: ShiftRecord = { ...shift, cash_count: cashCount, variance: cashCount - expected, closed_at: new Date().toISOString(), status: 'closed', y_report_at: new Date().toISOString(), z_report_at: new Date().toISOString(), sync_status: 'pending' };
  await saveEnterpriseRecord('shifts', 'shifts', closed);
  await logAuditEvent({ eventType: 'APPROVAL_REQUESTED', entityType: 'shift_close', entityId: shift.id, oldValue: shift, newValue: closed, reason: `Z report generated; variance ${closed.variance}`, userId: actorId });
  return closed;
}

export async function recordSafeDrop(input: Omit<SafeDropRecord, 'id' | 'created_at' | 'sync_status'>) {
  const record: SafeDropRecord = { ...input, id: generateId(), created_at: new Date().toISOString(), sync_status: 'pending' };
  return saveEnterpriseRecord('safe_drops', 'safe_drops', record);
}

export async function markShiftReport(shift: ShiftRecord, kind: 'x' | 'y') {
  const updated = { ...shift, [`${kind}_report_at`]: new Date().toISOString(), sync_status: 'pending' } as ShiftRecord;
  return saveEnterpriseRecord('shifts', 'shifts', updated);
}

export async function matchReconciliation(record: ReconciliationRecord, receivedAmount: number, actorId?: string) {
  const status = receivedAmount === record.expected_amount ? 'matched' : receivedAmount > record.expected_amount ? 'partial' : 'exception';
  const updated = { ...record, received_amount: receivedAmount, status, matched_at: status === 'matched' ? new Date().toISOString() : undefined, sync_status: 'pending' as const };
  await saveEnterpriseRecord('reconciliations', 'reconciliations', updated);
  await logAuditEvent({ eventType: 'SALE_UPDATED', entityType: 'reconciliation', entityId: record.id, oldValue: record, newValue: updated, userId: actorId });
  return updated;
}

export async function updateDeliveryStatus(delivery: OutboundDelivery, status: OutboundDelivery['status'], actorId?: string, proof?: Pick<OutboundDelivery, 'proof_type' | 'proof_reference'>) {
  const updated = { ...delivery, ...proof, status, updated_at: new Date().toISOString(), sync_status: 'pending' as const };
  await saveEnterpriseRecord('outbound_deliveries', 'outbound_deliveries', updated);
  await logAuditEvent({ eventType: 'SALE_UPDATED', entityType: 'outbound_delivery', entityId: delivery.id, oldValue: delivery, newValue: updated, userId: actorId });
  return updated;
}

export function calculateOfferDiscount(offer: OfferRule, subtotal: number, quantity = 1) {
  if (!offer.is_active || (offer.starts_at && Date.now() < new Date(offer.starts_at).getTime()) || (offer.ends_at && Date.now() > new Date(offer.ends_at).getTime())) return 0;
  if (offer.type === 'percentage') return Math.min(subtotal, subtotal * offer.value / 100);
  if (offer.type === 'fixed') return Math.min(subtotal, offer.value);
  if (offer.type === 'bogo') return quantity > 1 ? Math.min(subtotal, offer.value || subtotal / quantity) : 0;
  if (offer.type === 'multi_buy') return quantity >= 3 ? Math.min(subtotal, offer.value) : 0;
  return 0;
}

export async function createReportSchedule(input: Omit<ReportSchedule, 'id' | 'created_at' | 'sync_status'>) {
  return saveEnterpriseRecord('report_schedules', 'report_schedules', { ...input, id: generateId(), created_at: new Date().toISOString(), sync_status: 'pending' as const });
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

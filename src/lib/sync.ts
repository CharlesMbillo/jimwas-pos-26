import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getDB, getSyncQueue, removeFromSyncQueue, addToSyncQueue, generateId } from './db';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let _supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) return null;
  if (!_supabase) _supabase = createClient(supabaseUrl, supabaseKey);
  return _supabase;
}

let isOnline = navigator.onLine;
let isSyncing = false;

export type SyncStatus = 'synced' | 'pending' | 'syncing' | 'error' | 'offline';

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSync: string | null;
  error: string | null;
}

let syncState: SyncState = {
  status: 'synced',
  pendingCount: 0,
  lastSync: null,
  error: null,
};

const syncListeners: Set<(state: SyncState) => void> = new Set();

export function subscribeToSyncState(listener: (state: SyncState) => void): () => void {
  syncListeners.add(listener);
  return () => syncListeners.delete(listener);
}

function notifySyncState() {
  syncListeners.forEach(listener => listener({ ...syncState }));
}

export function getSyncState(): SyncState {
  return { ...syncState };
}

export function initNetworkListeners() {
  window.addEventListener('online', () => {
    isOnline = true;
    syncState.status = 'synced';
    notifySyncState();
    triggerSync();
  });

  window.addEventListener('offline', () => {
    isOnline = false;
    syncState.status = 'offline';
    notifySyncState();
  });

  checkPendingCount();
}

async function checkPendingCount() {
  try {
    const queue = await getSyncQueue();
    syncState.pendingCount = queue.length;
    notifySyncState();
  } catch (error) {
    console.error('Failed to check pending count:', error);
  }
}

export function getOnlineStatus(): boolean {
  return isOnline;
}

async function triggerSync() {
  if (!isOnline || isSyncing) return;

  isSyncing = true;
  syncState.status = 'syncing';
  syncState.error = null;
  notifySyncState();

  try {
    const queue = await getSyncQueue();

    let successCount = 0;
    let failCount = 0;

    for (const item of queue) {
      try {
        await processSyncItem(item);
        await removeFromSyncQueue(item.id);
        successCount++;
      } catch (error) {
        console.error('Sync failed for item:', item.id, item.table_name, item.operation, error);
        // Remove items older than 24h that keep failing — they're likely stale
        const age = Date.now() - new Date(item.created_at).getTime();
        if (age > 24 * 60 * 60 * 1000) {
          await removeFromSyncQueue(item.id);
          successCount++; // count as resolved to clear pendingCount
        } else {
          failCount++;
        }
      }
    }

    try {
      await syncFromRemote();
    } catch (remoteError) {
      console.error('Remote sync failed:', remoteError);
      syncState.error = remoteError instanceof Error ? remoteError.message : 'Remote sync failed';
    }

    syncState.status = 'synced';
    syncState.lastSync = new Date().toISOString();
    syncState.pendingCount = queue.length - successCount;

    if (failCount > 0 && !syncState.error) {
      syncState.error = `${failCount} items failed to sync`;
    }
  } catch (error) {
    console.error('Sync error:', error);
    syncState.status = 'error';
    syncState.error = error instanceof Error ? error.message : 'Sync failed';
  } finally {
    isSyncing = false;
    notifySyncState();
  }
}

async function processSyncItem(item: { table_name: string; operation: string; data: Record<string, unknown> }) {
  const client = getSupabase();
  if (!client) return;
  const { table_name, operation, data } = item;
  const table = client.from(table_name);

  let error;
  switch (operation) {
    case 'insert': {
      const result = await table.insert(data);
      error = result.error;
      break;
    }
    case 'update': {
      const result = await table.upsert(data);
      error = result.error;
      break;
    }
    case 'delete': {
      const result = await table.delete().eq('id', data.id);
      error = result.error;
      break;
    }
  }
  if (error) {
    console.error(`Sync error for ${operation} on ${table_name}:`, error);
    throw error;
  }
}

// Generic table sync config
interface TableSyncConfig {
  table: string;
  store: string;
  uniqueIndex?: string;
  uniqueField?: string;
  relation?: { table: string; field: string };
  single?: boolean;
  limit?: number;
  orderBy?: string;
}

const TABLE_CONFIGS: TableSyncConfig[] = [
  { table: 'customers', store: 'customers', uniqueIndex: 'by-phone', uniqueField: 'phone' },
  { table: 'products', store: 'products', uniqueIndex: 'by-sku', uniqueField: 'sku' },
  { table: 'transactions', store: 'transactions', relation: { table: 'transaction_items', field: 'transaction_items' } },
  { table: 'installment_plans', store: 'installment_plans' },
  { table: 'installment_payments', store: 'installment_payments' },
  { table: 'loyalty_transactions', store: 'loyalty_transactions' },
  { table: 'stock_movements', store: 'stock_movements' },
  { table: 'suppliers', store: 'suppliers' },
  { table: 'deliveries', store: 'deliveries' },
  { table: 'users', store: 'users' },
  { table: 'roles', store: 'roles', uniqueIndex: 'by-code', uniqueField: 'code' },
  { table: 'audit_logs', store: 'audit_logs', orderBy: 'created_at', limit: 500 },
  { table: 'approval_requests', store: 'approval_requests' },
  { table: 'business_settings', store: 'business_settings', single: true },
  { table: 'mpesa_settings', store: 'mpesa_settings', single: true },
  { table: 'payment_methods', store: 'payment_methods' },
  { table: 'loyalty_settings', store: 'loyalty_settings', single: true },
  { table: 'receipt_settings', store: 'receipt_settings', single: true },
  { table: 'ledger_entries', store: 'ledger_entries', orderBy: 'date', limit: 1000 },
  { table: 'expense_categories', store: 'expense_categories' },
];

async function syncTableFromRemote(client: SupabaseClient, db: Awaited<ReturnType<typeof getDB>>, config: TableSyncConfig) {
  let query = client.from(config.table).select(
    config.relation ? `*, ${config.relation.table}(*)` : '*'
  );

  if (config.orderBy) {
    query = query.order(config.orderBy, { ascending: false });
  }
  if (config.limit) {
    query = query.limit(config.limit);
  }

  const { data } = await query;
  if (!data) return;

  if (config.single) {
    if (data.length > 0) {
      await db.put(config.store, { ...data[0], sync_status: 'synced' });
    }
    return;
  }

  for (const row of data) {
    if (config.uniqueIndex && config.uniqueField) {
      const fieldValue = row[config.uniqueField];
      if (fieldValue) {
        const existing = await db.getFromIndex(config.store, config.uniqueIndex, fieldValue);
        if (existing && existing.id !== row.id) {
          await db.delete(config.store, existing.id);
        }
      }
    }

    const record = config.relation
      ? { ...row, sync_status: 'synced', items: row[config.relation.field] || [] }
      : { ...row, sync_status: 'synced' };

    await db.put(config.store, record);
  }
}

async function syncFromRemote() {
  const client = getSupabase();
  if (!client) return;
  const db = await getDB();

  for (const config of TABLE_CONFIGS) {
    try {
      await syncTableFromRemote(client, db, config);
    } catch (error) {
      console.error(`Failed to sync ${config.table}:`, error);
    }
  }
}

export async function syncNow(): Promise<{ success: boolean; message: string }> {
  if (!getSupabase()) {
    return { success: false, message: 'Sync is not configured. Running in offline mode.' };
  }
  if (!isOnline) {
    return { success: false, message: 'You are offline. Changes will sync when online.' };
  }

  try {
    await triggerSync();
    return { success: true, message: 'Sync completed successfully' };
  } catch (error) {
    console.error('Sync error:', error);
    return { success: false, message: 'Sync failed. Will retry automatically.' };
  }
}

export function queueForSync(tableName: string, operation: 'insert' | 'update' | 'delete', data: unknown) {
  addToSyncQueue({
    id: generateId(),
    table_name: tableName,
    operation,
    data: data as Record<string, unknown>,
    created_at: new Date().toISOString(),
  });

  syncState.pendingCount++;
  syncState.status = 'pending';
  notifySyncState();

  if (isOnline) {
    triggerSync();
  }
}

// Generic sync helpers
async function syncInsert(table: string, data: unknown): Promise<void> {
  if (!isOnline || !getSupabase()) {
    queueForSync(table, 'insert', data);
    return;
  }
  try {
    const { error } = await getSupabase()!.from(table).insert(data as Record<string, unknown>);
    if (error) throw error;
  } catch {
    queueForSync(table, 'insert', data);
  }
}

async function syncUpdate(table: string, data: unknown): Promise<void> {
  if (!isOnline || !getSupabase()) {
    queueForSync(table, 'update', data);
    return;
  }
  try {
    const { error } = await getSupabase()!.from(table).upsert(data as Record<string, unknown>);
    if (error) throw error;
  } catch {
    queueForSync(table, 'update', data);
  }
}

// Entity-specific sync functions (thin wrappers for backward compatibility)
export const syncInsertCustomer = (customer: unknown) => syncInsert('customers', customer);
export const syncUpdateCustomer = (customer: unknown) => syncUpdate('customers', customer);

export async function syncInsertTransaction(transaction: unknown, items: unknown[]) {
  if (!isOnline || !getSupabase()) {
    queueForSync('transactions', 'insert', transaction);
    items.forEach(item => queueForSync('transaction_items', 'insert', item));
    return;
  }
  try {
    const { error: txError } = await getSupabase()!.from('transactions').insert(transaction as Record<string, unknown>);
    if (txError) throw txError;
    if (items.length > 0) {
      const { error: itemsError } = await getSupabase()!.from('transaction_items').insert(items as Record<string, unknown>[]);
      if (itemsError) throw itemsError;
    }
  } catch {
    queueForSync('transactions', 'insert', transaction);
    items.forEach(item => queueForSync('transaction_items', 'insert', item));
  }
}

export const syncInsertInstallmentPlan = (plan: unknown) => syncInsert('installment_plans', plan);
export const syncUpdateInstallmentPlan = (plan: unknown) => syncUpdate('installment_plans', plan);
export const syncInsertInstallmentPayment = (payment: unknown) => syncInsert('installment_payments', payment);
export const syncInsertLoyaltyTransaction = (loyaltyTx: unknown) => syncInsert('loyalty_transactions', loyaltyTx);
export const syncInsertProduct = (product: unknown) => syncInsert('products', product);
export const syncUpdateProduct = (product: unknown) => syncUpdate('products', product);
export async function syncDeleteProduct(id: string): Promise<void> {
  const client = getSupabase();
  if (!client || !isOnline) return;
  try {
    await client.from('products').delete().eq('id', id);
  } catch {
    // Best-effort — local delete already done
  }
}
export const syncInsertStockMovement = (movement: unknown) => syncInsert('stock_movements', movement);
export const syncInsertUser = (user: unknown) => syncInsert('users', user);
export const syncUpdateUser = (user: unknown) => syncUpdate('users', user);
export const syncInsertAuditLog = (log: unknown) => syncInsert('audit_logs', log);
export const syncInsertApprovalRequest = (request: unknown) => syncInsert('approval_requests', request);
export const syncUpdateApprovalRequest = (request: unknown) => syncUpdate('approval_requests', request);
export const syncInsertDelivery = (delivery: unknown) => syncInsert('deliveries', delivery);
export const syncUpdateDelivery = (delivery: unknown) => syncUpdate('deliveries', delivery);
export const syncInsertDeliveryItem = (item: unknown) => syncInsert('delivery_items', item);
export const syncInsertLedgerEntry = (entry: unknown) => syncInsert('ledger_entries', entry);
export const syncUpdateLedgerEntry = (entry: unknown) => syncUpdate('ledger_entries', entry);

// Settings sync functions
export const syncUpdateBusinessSettings = (settings: unknown) => syncUpdate('business_settings', settings);
export const syncUpdateMpesaSettings = (settings: unknown) => syncUpdate('mpesa_settings', settings);
export const syncUpdatePaymentMethod = (method: unknown) => syncUpdate('payment_methods', method);
export const syncUpdateLoyaltySettings = (settings: unknown) => syncUpdate('loyalty_settings', settings);
export const syncUpdateReceiptSettings = (settings: unknown) => syncUpdate('receipt_settings', settings);

// Helper to check if ID is a valid UUID
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

// Generate a proper UUID v4
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function resyncAllLocalProducts(): Promise<{ synced: number; skipped: number; errors: string[] }> {
  const client = getSupabase();
  if (!client || !isOnline) {
    return { synced: 0, skipped: 0, errors: ['Not online or Supabase not configured'] };
  }

  const db = await getDB();
  const localProducts = await db.getAll('products');
  const errors: string[] = [];
  let synced = 0;
  let skipped = 0;

  // Get all existing SKUs from Supabase to avoid duplicates
  const { data: existingProducts } = await client.from('products').select('id, sku');
  const existingSkus = new Map((existingProducts || []).map(p => [p.sku?.toLowerCase(), p.id]));
  const existingIds = new Set((existingProducts || []).map(p => p.id));

  for (const product of localProducts) {
    try {
      // Skip if already synced (has valid UUID and exists in Supabase)
      if (isValidUUID(product.id) && existingIds.has(product.id)) {
        skipped++;
        continue;
      }

      // Generate new UUID for products with non-UUID IDs
      const newId = isValidUUID(product.id) ? product.id : generateUUID();

      // Check for SKU conflict
      const skuLower = product.sku?.trim().toLowerCase();
      let finalSku = product.sku;
      if (skuLower && existingSkus.has(skuLower) && existingSkus.get(skuLower) !== newId) {
        // SKU conflict - append a number
        let counter = 1;
        while (existingSkus.has(`${skuLower}-${counter}`)) {
          counter++;
        }
        finalSku = `${product.sku}-${counter}`;
      }
      existingSkus.set(finalSku?.toLowerCase() || '', newId);

      // Prepare product data for Supabase
      const productData = {
        id: newId,
        name: product.name,
        sku: finalSku,
        price: product.price,
        cost: product.cost ?? 0,
        stock: product.stock,
        category: product.category ?? null,
        barcode: product.barcode ?? null,
        low_stock_alert: product.lowStockAlert ?? 5,
        tax_category: product.taxCategory ?? 'standard_16',
        is_active: product.isActive ?? true,
        sync_status: 'synced',
        created_at: product.created_at ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Upsert to Supabase
      const { error } = await client.from('products').upsert(productData);
      if (error) throw error;

      // Update local record with new ID if changed
      if (newId !== product.id) {
        await db.delete('products', product.id);
        await db.put('products', { ...product, id: newId, sku: finalSku, sync_status: 'synced' });
      } else {
        await db.put('products', { ...product, sku: finalSku, sync_status: 'synced' });
      }

      synced++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to sync "${product.name}": ${errMsg}`);
    }
  }

  return { synced, skipped, errors };
}

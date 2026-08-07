import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type {
  User,
  Role,
  Permission,
  AuditLog,
  ApprovalRequest,
  ApprovalHistory,
  LoginHistory,
  SecurityEvent,
  PriceChangeHistory,
  VoidRequest,
  RefundRequest,
} from './security-types';
import type {
  BusinessSettings,
  KCBSettings,
  PaymentMethodConfig,
  LoyaltySettings,
  ReceiptSettings,
} from './settings-types';
import type {
  CartItem,
  ShiftRecord,
  ReconciliationRecord,
  OutboundDelivery,
  OfferRule,
  SupplierFulfillment,
  ReportSchedule,
  SafeDropRecord,
} from './types';

interface POSDatabase extends DBSchema {
  customers: {
    key: string;
    value: {
      id: string;
      name: string;
      phone?: string;
      email?: string;
      loyalty_points: number;
      total_spent: number;
      created_at: string;
      updated_at: string;
      sync_status: 'pending' | 'synced';
    };
    indexes: { 'by-phone': string };
  };
  products: {
    key: string;
    value: {
      id: string;
      name: string;
      sku?: string;
      price: number;
      cost: number;
      stock: number;
      category?: string;
      image_url?: string;
      low_stock_alert?: number;
      barcode?: string;
      tax_category?: 'exempt' | 'standard_16';
      is_active: boolean;
      created_at: string;
      updated_at: string;
      sync_status: 'pending' | 'synced';
      local_id?: string;
    };
    indexes: { 'by-sku': string; 'by-barcode': string };
  };
  transactions: {
    key: string;
    value: {
      id: string;
      customer_id?: string;
      total_amount: number;
      amount_paid: number;
      change_amount: number;
      payment_method: string;
      status: string;
      notes?: string;
      created_at: string;
      sync_status: 'pending' | 'synced';
      items: TransactionItem[];
    };
  };
  transaction_items: {
    key: string;
    value: TransactionItem;
    indexes: { 'by-transaction': string };
  };
  installment_plans: {
    key: string;
    value: {
      id: string;
      customer_id: string;
      product_id: string;
      product_name: string;
      total_amount: number;
      amount_paid: number;
      installment_count: number;
      status: 'active' | 'completed' | 'cancelled';
      product_released: boolean;
      release_date?: string;
      notes?: string;
      created_at: string;
      updated_at: string;
      sync_status: 'pending' | 'synced';
    };
    indexes: { 'by-customer': string; 'by-status': string };
  };
  installment_payments: {
    key: string;
    value: {
      id: string;
      plan_id: string;
      amount: number;
      payment_method: string;
      notes?: string;
      created_at: string;
      sync_status: 'pending' | 'synced';
    };
    indexes: { 'by-plan': string };
  };
  loyalty_transactions: {
    key: string;
    value: {
      id: string;
      customer_id: string;
      points: number;
      transaction_type: 'earned' | 'redeemed';
      source: string;
      reference_id?: string;
      created_at: string;
      sync_status: 'pending' | 'synced';
    };
    indexes: { 'by-customer': string };
  };
  stock_movements: {
    key: string;
    value: {
      id: string;
      product_id: string;
      qty_delta: number;
      reason: 'sale' | 'return' | 'restock' | 'adjustment' | 'initial' | 'transfer_in' | 'transfer_out';
      note?: string;
      balance_after: number;
      reference_type?: 'sale' | 'delivery' | 'adjustment' | 'transfer';
      reference_id?: string;
      branch_id?: string;
      created_at: string;
      created_by: string;
      sync_status: 'pending' | 'synced';
      local_id?: string;
    };
    indexes: { 'by-product': string; 'by-reference': string };
  };
  suppliers: {
    key: string;
    value: {
      id: string;
      name: string;
      contact_person?: string;
      phone?: string;
      email?: string;
      address?: string;
      is_active: boolean;
      created_at: string;
      updated_at: string;
      sync_status: 'pending' | 'synced';
    };
  };
  deliveries: {
    key: string;
    value: {
      id: string;
      supplier_id?: string;
      delivery_note_number?: string;
      status: 'pending' | 'received' | 'cancelled';
      total_items: number;
      total_value: number;
      notes?: string;
      received_by?: string;
      received_at?: string;
      created_at: string;
      updated_at: string;
      sync_status: 'pending' | 'synced';
    };
    indexes: { 'by-supplier': string; 'by-status': string };
  };
  delivery_items: {
    key: string;
    value: {
      id: string;
      delivery_id: string;
      product_id: string;
      quantity_ordered: number;
      quantity_received: number;
      unit_cost: number;
      sync_status: 'pending' | 'synced';
    };
    indexes: { 'by-delivery': string };
  };
  stock_adjustments: {
    key: string;
    value: {
      id: string;
      product_id: string;
      previous_stock: number;
      new_stock: number;
      reason: string;
      note?: string;
      created_by: string;
      created_at: string;
      sync_status: 'pending' | 'synced';
      local_id?: string;
    };
    indexes: { 'by-product': string };
  };
  sync_queue: {
    key: string;
    value: {
      id: string;
      table_name: string;
      operation: 'insert' | 'update' | 'delete';
      data: Record<string, unknown>;
      created_at: string;
    };
  };
  shifts: { key: string; value: ShiftRecord; indexes: { 'by-status': string; 'by-cashier': string } };
  reconciliations: { key: string; value: ReconciliationRecord; indexes: { 'by-status': string; 'by-method': string } };
  outbound_deliveries: { key: string; value: OutboundDelivery; indexes: { 'by-status': string; 'by-transaction': string } };
  offers: { key: string; value: OfferRule; indexes: { 'by-active': string } };
  supplier_fulfillments: { key: string; value: SupplierFulfillment; indexes: { 'by-transaction': string; 'by-status': string } };
  report_schedules: { key: string; value: ReportSchedule; indexes: { 'by-active': string; 'by-next-run': string } };
  safe_drops: { key: string; value: SafeDropRecord; indexes: { 'by-shift': string } };
  // Security stores
  users: {
    key: string;
    value: User;
    indexes: { 'by-username': string; 'by-email': string; 'by-role': string };
  };
  roles: {
    key: string;
    value: Role;
    indexes: { 'by-code': string };
  };
  permissions: {
    key: string;
    value: Permission;
    indexes: { 'by-name': string; 'by-domain': string };
  };
  audit_logs: {
    key: string;
    value: AuditLog;
    indexes: { 'by-user': string; 'by-entity': string; 'by-event-type': string; 'by-created-at': string };
  };
  approval_requests: {
    key: string;
    value: ApprovalRequest;
    indexes: { 'by-requester': string; 'by-status': string; 'by-type': string };
  };
  approval_history: {
    key: string;
    value: ApprovalHistory;
    indexes: { 'by-request': string };
  };
  login_history: {
    key: string;
    value: LoginHistory;
    indexes: { 'by-user': string; 'by-login-at': string };
  };
  security_events: {
    key: string;
    value: SecurityEvent;
    indexes: { 'by-user': string; 'by-severity': string; 'by-resolved': string };
  };
  price_change_history: {
    key: string;
    value: PriceChangeHistory;
    indexes: { 'by-product': string; 'by-changed-by': string };
  };
  void_requests: {
    key: string;
    value: VoidRequest;
    indexes: { 'by-transaction': string; 'by-status': string };
  };
  refund_requests: {
    key: string;
    value: RefundRequest;
    indexes: { 'by-transaction': string; 'by-status': string };
  };
  // Settings stores
  business_settings: {
    key: string;
    value: BusinessSettings;
  };
  kcb_settings: {
    key: string;
    value: KCBSettings;
  };
  kcb_payments: {
    key: string;
    value: {
      id: string;
      transaction_id?: string;
      phone: string;
      amount: number;
      checkout_request_id?: string;
      merchant_request_id?: string;
      mpesa_receipt_number?: string;
      status: 'pending' | 'processing' | 'success' | 'failed' | 'cancelled' | 'timeout' | 'insufficient_balance';
      result_desc?: string;
      error_message?: string;
      attempts: number;
      last_attempt_at?: string;
      completed_at?: string;
      created_at: string;
      created_by?: string;
      sync_status: 'pending' | 'synced';
    };
    indexes: { 'by-transaction': string; 'by-phone': string; 'by-status': string; 'by-created-at': string };
  };
  payment_methods: {
    key: string;
    value: PaymentMethodConfig;
  };
  loyalty_settings: {
    key: string;
    value: LoyaltySettings;
  };
  receipt_settings: {
    key: string;
    value: ReceiptSettings;
  };
  ledger_entries: {
    key: string;
    value: {
      id: string;
      date: string;
      entry_type: 'sale' | 'refund' | 'void' | 'installment_payment' | 'loyalty_redemption' | 'income' | 'expense' | 'adjustment' | 'cash_draw' | 'transfer';
      category?: string;
      description: string;
      amount: number;
      payment_method: string;
      reference_id?: string;
      reference_type?: string;
      customer_id?: string;
      cashier_id?: string;
      cashier_name?: string;
      branch_id?: string;
      notes?: string;
      is_manual: boolean;
      created_at: string;
      created_by?: string;
      sync_status: 'pending' | 'synced';
      local_id?: string;
    };
    indexes: { 'by-date': string; 'by-type': string; 'by-category': string };
  };
  expense_categories: {
    key: string;
    value: {
      id: string;
      name: string;
      description?: string;
      is_active: boolean;
      created_at: string;
    };
  };
  cart_sessions: {
    key: string;
    value: {
      id: string;
      items: CartItem[];
      selectedCustomer: any | null;
      total: number;
      saleType: string;
      depositAmount: number;
      created_at: string;
      updated_at: string;
    };
  };
  parked_sales: {
    key: string;
    value: {
      id: string;
      cart: CartItem[];
      selectedCustomer: any | null;
      total: number;
      saleType: string;
      depositAmount: number;
      notes?: string;
      created_at: string;
      updated_at: string;
    };
  };
  restore_points: {
    key: string;
    value: {
      id: string;
      backup_date: string;
      created_at: string;
      product_count: number;
      customer_count: number;
      transaction_count: number;
    };
  };
}

export interface TransactionItem {
  id: string;
  transaction_id?: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

const DB_NAME = 'pos-offline-db';
const DB_VERSION = 7;

let dbInstance: IDBPDatabase<POSDatabase> | null = null;

export async function getDB(): Promise<IDBPDatabase<POSDatabase>> {
  if (dbInstance) return dbInstance;

  dbInstance = await openDB<POSDatabase>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Customers store
      if (!db.objectStoreNames.contains('customers')) {
        const customerStore = db.createObjectStore('customers', { keyPath: 'id' });
        customerStore.createIndex('by-phone', 'phone', { unique: true });
      }

      // Products store
      if (!db.objectStoreNames.contains('products')) {
        const productStore = db.createObjectStore('products', { keyPath: 'id' });
        productStore.createIndex('by-sku', 'sku', { unique: true });
      }

      // Transactions store
      if (!db.objectStoreNames.contains('transactions')) {
        db.createObjectStore('transactions', { keyPath: 'id' });
      }

      // Transaction items store
      if (!db.objectStoreNames.contains('transaction_items')) {
        const itemStore = db.createObjectStore('transaction_items', { keyPath: 'id' });
        itemStore.createIndex('by-transaction', 'transaction_id');
      }

      // Installment plans store
      if (!db.objectStoreNames.contains('installment_plans')) {
        const planStore = db.createObjectStore('installment_plans', { keyPath: 'id' });
        planStore.createIndex('by-customer', 'customer_id');
        planStore.createIndex('by-status', 'status');
      }

      // Installment payments store
      if (!db.objectStoreNames.contains('installment_payments')) {
        const paymentStore = db.createObjectStore('installment_payments', { keyPath: 'id' });
        paymentStore.createIndex('by-plan', 'plan_id');
      }

      // Loyalty transactions store
      if (!db.objectStoreNames.contains('loyalty_transactions')) {
        const loyaltyStore = db.createObjectStore('loyalty_transactions', { keyPath: 'id' });
        loyaltyStore.createIndex('by-customer', 'customer_id');
      }

      // Stock movements store
      if (!db.objectStoreNames.contains('stock_movements')) {
        const stockMovementStore = db.createObjectStore('stock_movements', { keyPath: 'id' });
        stockMovementStore.createIndex('by-product', 'product_id');
        stockMovementStore.createIndex('by-reference', 'reference_id');
      }

      // Suppliers store
      if (!db.objectStoreNames.contains('suppliers')) {
        db.createObjectStore('suppliers', { keyPath: 'id' });
      }

      // Deliveries store
      if (!db.objectStoreNames.contains('deliveries')) {
        const deliveryStore = db.createObjectStore('deliveries', { keyPath: 'id' });
        deliveryStore.createIndex('by-supplier', 'supplier_id');
        deliveryStore.createIndex('by-status', 'status');
      }

      // Delivery items store
      if (!db.objectStoreNames.contains('delivery_items')) {
        const deliveryItemStore = db.createObjectStore('delivery_items', { keyPath: 'id' });
        deliveryItemStore.createIndex('by-delivery', 'delivery_id');
      }

      // Stock adjustments store
      if (!db.objectStoreNames.contains('stock_adjustments')) {
        const adjustmentStore = db.createObjectStore('stock_adjustments', { keyPath: 'id' });
        adjustmentStore.createIndex('by-product', 'product_id');
      }

      // Sync queue store
      if (!db.objectStoreNames.contains('sync_queue')) {
        db.createObjectStore('sync_queue', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('shifts')) {
        const store = db.createObjectStore('shifts', { keyPath: 'id' });
        store.createIndex('by-status', 'status');
        store.createIndex('by-cashier', 'cashier_id');
      }
      if (!db.objectStoreNames.contains('reconciliations')) {
        const store = db.createObjectStore('reconciliations', { keyPath: 'id' });
        store.createIndex('by-status', 'status');
        store.createIndex('by-method', 'payment_method');
      }
      if (!db.objectStoreNames.contains('outbound_deliveries')) {
        const store = db.createObjectStore('outbound_deliveries', { keyPath: 'id' });
        store.createIndex('by-status', 'status');
        store.createIndex('by-transaction', 'transaction_id');
      }
      if (!db.objectStoreNames.contains('offers')) {
        const store = db.createObjectStore('offers', { keyPath: 'id' });
        store.createIndex('by-active', 'is_active');
      }
      if (!db.objectStoreNames.contains('supplier_fulfillments')) {
        const store = db.createObjectStore('supplier_fulfillments', { keyPath: 'id' });
        store.createIndex('by-transaction', 'transaction_id');
        store.createIndex('by-status', 'status');
      }
      if (!db.objectStoreNames.contains('report_schedules')) {
        const store = db.createObjectStore('report_schedules', { keyPath: 'id' });
        store.createIndex('by-active', 'is_active');
        store.createIndex('by-next-run', 'next_run_at');
      }
      if (!db.objectStoreNames.contains('safe_drops')) {
        const store = db.createObjectStore('safe_drops', { keyPath: 'id' });
        store.createIndex('by-shift', 'shift_id');
      }

      // Security stores
      // Users store
      if (!db.objectStoreNames.contains('users')) {
        const userStore = db.createObjectStore('users', { keyPath: 'id' });
        userStore.createIndex('by-username', 'username', { unique: true });
        userStore.createIndex('by-email', 'email', { unique: true });
        userStore.createIndex('by-role', 'role_id');
      }

      // Roles store
      if (!db.objectStoreNames.contains('roles')) {
        const roleStore = db.createObjectStore('roles', { keyPath: 'id' });
        roleStore.createIndex('by-code', 'code', { unique: true });
      }

      // Permissions store
      if (!db.objectStoreNames.contains('permissions')) {
        const permStore = db.createObjectStore('permissions', { keyPath: 'id' });
        permStore.createIndex('by-name', 'name', { unique: true });
        permStore.createIndex('by-domain', 'domain');
      }

      // Audit logs store
      if (!db.objectStoreNames.contains('audit_logs')) {
        const auditStore = db.createObjectStore('audit_logs', { keyPath: 'id' });
        auditStore.createIndex('by-user', 'user_id');
        auditStore.createIndex('by-entity', 'entity_id');
        auditStore.createIndex('by-event-type', 'event_type');
        auditStore.createIndex('by-created-at', 'created_at');
      }

      // Approval requests store
      if (!db.objectStoreNames.contains('approval_requests')) {
        const approvalStore = db.createObjectStore('approval_requests', { keyPath: 'id' });
        approvalStore.createIndex('by-requester', 'requester_id');
        approvalStore.createIndex('by-status', 'status');
        approvalStore.createIndex('by-type', 'request_type');
      }

      // Approval history store
      if (!db.objectStoreNames.contains('approval_history')) {
        const historyStore = db.createObjectStore('approval_history', { keyPath: 'id' });
        historyStore.createIndex('by-request', 'request_id');
      }

      // Login history store
      if (!db.objectStoreNames.contains('login_history')) {
        const loginStore = db.createObjectStore('login_history', { keyPath: 'id' });
        loginStore.createIndex('by-user', 'user_id');
        loginStore.createIndex('by-login-at', 'login_at');
      }

      // Security events store
      if (!db.objectStoreNames.contains('security_events')) {
        const eventStore = db.createObjectStore('security_events', { keyPath: 'id' });
        eventStore.createIndex('by-user', 'user_id');
        eventStore.createIndex('by-severity', 'severity');
        eventStore.createIndex('by-resolved', 'is_resolved');
      }

      // Price change history store
      if (!db.objectStoreNames.contains('price_change_history')) {
        const priceStore = db.createObjectStore('price_change_history', { keyPath: 'id' });
        priceStore.createIndex('by-product', 'product_id');
        priceStore.createIndex('by-changed-by', 'changed_by_id');
      }

      // Void requests store
      if (!db.objectStoreNames.contains('void_requests')) {
        const voidStore = db.createObjectStore('void_requests', { keyPath: 'id' });
        voidStore.createIndex('by-transaction', 'transaction_id');
        voidStore.createIndex('by-status', 'status');
      }

      // Refund requests store
      if (!db.objectStoreNames.contains('refund_requests')) {
        const refundStore = db.createObjectStore('refund_requests', { keyPath: 'id' });
        refundStore.createIndex('by-transaction', 'transaction_id');
        refundStore.createIndex('by-status', 'status');
      }

      // Settings stores
      if (!db.objectStoreNames.contains('business_settings')) {
        db.createObjectStore('business_settings', { keyPath: 'id' });
      }

      // KCB settings store (replaces mpesa_settings)
      if (!db.objectStoreNames.contains('kcb_settings')) {
        db.createObjectStore('kcb_settings', { keyPath: 'id' });
      }

      // KCB payments store (replaces mpesa_payments)
      if (!db.objectStoreNames.contains('kcb_payments')) {
        const kcbPaymentStore = db.createObjectStore('kcb_payments', { keyPath: 'id' });
        kcbPaymentStore.createIndex('by-transaction', 'transaction_id');
        kcbPaymentStore.createIndex('by-phone', 'phone');
        kcbPaymentStore.createIndex('by-status', 'status');
        kcbPaymentStore.createIndex('by-created-at', 'created_at');
      }

      if (!db.objectStoreNames.contains('payment_methods')) {
        db.createObjectStore('payment_methods', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('loyalty_settings')) {
        db.createObjectStore('loyalty_settings', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('receipt_settings')) {
        db.createObjectStore('receipt_settings', { keyPath: 'id' });
      }

      // Ledger entries store
      if (!db.objectStoreNames.contains('ledger_entries')) {
        const ledgerStore = db.createObjectStore('ledger_entries', { keyPath: 'id' });
        ledgerStore.createIndex('by-date', 'date');
        ledgerStore.createIndex('by-type', 'entry_type');
        ledgerStore.createIndex('by-category', 'category');
      }

      // Expense categories store
      if (!db.objectStoreNames.contains('expense_categories')) {
        db.createObjectStore('expense_categories', { keyPath: 'id' });
      }

      // Cart session store (for persisting current cart)
      if (!db.objectStoreNames.contains('cart_sessions')) {
        db.createObjectStore('cart_sessions', { keyPath: 'id' });
      }

      // Parked sales store (for saving incomplete transactions)
      if (!db.objectStoreNames.contains('parked_sales')) {
        db.createObjectStore('parked_sales', { keyPath: 'id' });
      }

      // Restore points store (for persisting last successful backup import)
      if (!db.objectStoreNames.contains('restore_points')) {
        db.createObjectStore('restore_points', { keyPath: 'id' });
      }
    },
  });

  return dbInstance;
}

export function generateId(): string {
  // Generate a proper UUID v4 format for Supabase compatibility
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Customer operations
export async function saveCustomer(customer: POSDatabase['customers']['value']) {
  const db = await getDB();
  await db.put('customers', customer);
}

export async function getCustomer(id: string) {
  const db = await getDB();
  return db.get('customers', id);
}

export async function getCustomerByPhone(phone: string) {
  const db = await getDB();
  return db.getFromIndex('customers', 'by-phone', phone);
}

export async function getAllCustomers() {
  const db = await getDB();
  return db.getAll('customers');
}

// Product operations
export async function saveProduct(product: POSDatabase['products']['value']) {
  const db = await getDB();
  await db.put('products', product);
}

export async function getProduct(id: string) {
  const db = await getDB();
  return db.get('products', id);
}

export async function getProductBySku(sku: string) {
  const db = await getDB();
  return db.getFromIndex('products', 'by-sku', sku);
}

export async function getAllProducts() {
  const db = await getDB();
  return db.getAll('products');
}

export async function deleteProduct(id: string) {
  const db = await getDB();
  await db.delete('products', id);
}

// Transaction operations
export async function saveTransaction(transaction: POSDatabase['transactions']['value']) {
  const db = await getDB();
  await db.put('transactions', transaction);
}

export async function getTransaction(id: string) {
  const db = await getDB();
  return db.get('transactions', id);
}

export async function getAllTransactions() {
  const db = await getDB();
  return db.getAll('transactions');
}

// Installment plan operations
export async function saveInstallmentPlan(plan: POSDatabase['installment_plans']['value']) {
  const db = await getDB();
  await db.put('installment_plans', plan);
}

export async function getInstallmentPlan(id: string) {
  const db = await getDB();
  return db.get('installment_plans', id);
}

export async function getInstallmentPlansByCustomer(customerId: string) {
  const db = await getDB();
  return db.getAllFromIndex('installment_plans', 'by-customer', customerId);
}

export async function getInstallmentPlansByStatus(status: string) {
  const db = await getDB();
  return db.getAllFromIndex('installment_plans', 'by-status', status);
}

export async function getAllInstallmentPlans() {
  const db = await getDB();
  return db.getAll('installment_plans');
}

// Installment payment operations
export async function saveInstallmentPayment(payment: POSDatabase['installment_payments']['value']) {
  const db = await getDB();
  await db.put('installment_payments', payment);
}

export async function getInstallmentPaymentsByPlan(planId: string) {
  const db = await getDB();
  return db.getAllFromIndex('installment_payments', 'by-plan', planId);
}

export async function getAllInstallmentPayments() {
  const db = await getDB();
  return db.getAll('installment_payments');
}

// Loyalty transaction operations
export async function saveLoyaltyTransaction(transaction: POSDatabase['loyalty_transactions']['value']) {
  const db = await getDB();
  await db.put('loyalty_transactions', transaction);
}

export async function getLoyaltyTransactionsByCustomer(customerId: string) {
  const db = await getDB();
  return db.getAllFromIndex('loyalty_transactions', 'by-customer', customerId);
}

export async function getAllLoyaltyTransactions() {
  const db = await getDB();
  return db.getAll('loyalty_transactions');
}

// Stock movement operations
export async function saveStockMovement(movement: POSDatabase['stock_movements']['value']) {
  const db = await getDB();
  await db.put('stock_movements', movement);
}

export async function getStockMovementsByProduct(productId: string) {
  const db = await getDB();
  return db.getAllFromIndex('stock_movements', 'by-product', productId);
}

export async function getAllStockMovements() {
  const db = await getDB();
  return db.getAll('stock_movements');
}

// Supplier operations
export async function saveSupplier(supplier: POSDatabase['suppliers']['value']) {
  const db = await getDB();
  await db.put('suppliers', supplier);
}

export async function getSupplier(id: string) {
  const db = await getDB();
  return db.get('suppliers', id);
}

export async function getAllSuppliers() {
  const db = await getDB();
  return db.getAll('suppliers');
}

// Delivery operations
export async function saveDelivery(delivery: POSDatabase['deliveries']['value']) {
  const db = await getDB();
  await db.put('deliveries', delivery);
}

export async function getDelivery(id: string) {
  const db = await getDB();
  return db.get('deliveries', id);
}

export async function getDeliveriesByStatus(status: string) {
  const db = await getDB();
  return db.getAllFromIndex('deliveries', 'by-status', status);
}

export async function getAllDeliveries() {
  const db = await getDB();
  return db.getAll('deliveries');
}

// Delivery item operations
export async function saveDeliveryItem(item: POSDatabase['delivery_items']['value']) {
  const db = await getDB();
  await db.put('delivery_items', item);
}

export async function getDeliveryItemsByDelivery(deliveryId: string) {
  const db = await getDB();
  return db.getAllFromIndex('delivery_items', 'by-delivery', deliveryId);
}

// Stock adjustment operations
export async function saveStockAdjustment(adjustment: POSDatabase['stock_adjustments']['value']) {
  const db = await getDB();
  await db.put('stock_adjustments', adjustment);
}

export async function getStockAdjustmentsByProduct(productId: string) {
  const db = await getDB();
  return db.getAllFromIndex('stock_adjustments', 'by-product', productId);
}

export async function getAllStockAdjustments() {
  const db = await getDB();
  return db.getAll('stock_adjustments');
}

// Sync queue operations
export async function addToSyncQueue(item: POSDatabase['sync_queue']['value']) {
  const db = await getDB();
  await db.put('sync_queue', item);
}

export async function getSyncQueue() {
  const db = await getDB();
  return db.getAll('sync_queue');
}

export async function removeFromSyncQueue(id: string) {
  const db = await getDB();
  await db.delete('sync_queue', id);
}

export async function clearSyncQueue() {
  const db = await getDB();
  await db.clear('sync_queue');
}

// ============ SECURITY STORE OPERATIONS ============

// User operations
export async function saveUser(user: User) {
  const db = await getDB();
  await db.put('users', user);
}

export async function getUser(id: string): Promise<User | undefined> {
  const db = await getDB();
  return db.get('users', id);
}

export async function getUserByUsername(username: string): Promise<User | undefined> {
  const db = await getDB();
  return db.getFromIndex('users', 'by-username', username);
}

export async function getUserByEmail(email: string): Promise<User | undefined> {
  const db = await getDB();
  return db.getFromIndex('users', 'by-email', email);
}

export async function getAllUsers(): Promise<User[]> {
  const db = await getDB();
  return db.getAll('users');
}

export async function getUsersByRole(roleId: string): Promise<User[]> {
  const db = await getDB();
  return db.getAllFromIndex('users', 'by-role', roleId);
}

// Role operations
export async function saveRole(role: Role) {
  const db = await getDB();
  await db.put('roles', role);
}

export async function getRole(id: string): Promise<Role | undefined> {
  const db = await getDB();
  return db.get('roles', id);
}

export async function getRoleByCode(code: string): Promise<Role | undefined> {
  const db = await getDB();
  return db.getFromIndex('roles', 'by-code', code);
}

export async function getAllRoles(): Promise<Role[]> {
  const db = await getDB();
  return db.getAll('roles');
}

// Permission operations
export async function savePermission(permission: Permission) {
  const db = await getDB();
  await db.put('permissions', permission);
}

export async function getPermission(id: string): Promise<Permission | undefined> {
  const db = await getDB();
  return db.get('permissions', id);
}

export async function getPermissionByName(name: string): Promise<Permission | undefined> {
  const db = await getDB();
  return db.getFromIndex('permissions', 'by-name', name);
}

export async function getAllPermissions(): Promise<Permission[]> {
  const db = await getDB();
  return db.getAll('permissions');
}

export async function getPermissionsByDomain(domain: string): Promise<Permission[]> {
  const db = await getDB();
  return db.getAllFromIndex('permissions', 'by-domain', domain);
}

// Audit log operations
export async function saveAuditLog(log: AuditLog) {
  const db = await getDB();
  await db.put('audit_logs', log);
}

export async function getAuditLog(id: string): Promise<AuditLog | undefined> {
  const db = await getDB();
  return db.get('audit_logs', id);
}

export async function getAllAuditLogs(): Promise<AuditLog[]> {
  const db = await getDB();
  return db.getAll('audit_logs');
}

export async function getAuditLogsByUser(userId: string): Promise<AuditLog[]> {
  const db = await getDB();
  return db.getAllFromIndex('audit_logs', 'by-user', userId);
}

export async function getAuditLogsByEntity(entityId: string): Promise<AuditLog[]> {
  const db = await getDB();
  return db.getAllFromIndex('audit_logs', 'by-entity', entityId);
}

export async function getAuditLogsByEventType(eventType: string): Promise<AuditLog[]> {
  const db = await getDB();
  return db.getAllFromIndex('audit_logs', 'by-event-type', eventType);
}

// Approval request operations
export async function saveApprovalRequest(request: ApprovalRequest) {
  const db = await getDB();
  await db.put('approval_requests', request);
}

export async function getApprovalRequest(id: string): Promise<ApprovalRequest | undefined> {
  const db = await getDB();
  return db.get('approval_requests', id);
}

export async function getAllApprovalRequests(): Promise<ApprovalRequest[]> {
  const db = await getDB();
  return db.getAll('approval_requests');
}

export async function getApprovalRequestsByRequester(requesterId: string): Promise<ApprovalRequest[]> {
  const db = await getDB();
  return db.getAllFromIndex('approval_requests', 'by-requester', requesterId);
}

export async function getApprovalRequestsByStatus(status: string): Promise<ApprovalRequest[]> {
  const db = await getDB();
  return db.getAllFromIndex('approval_requests', 'by-status', status);
}

export async function getApprovalRequestsByType(type: string): Promise<ApprovalRequest[]> {
  const db = await getDB();
  return db.getAllFromIndex('approval_requests', 'by-type', type);
}

// Approval history operations
export async function saveApprovalHistory(history: ApprovalHistory) {
  const db = await getDB();
  await db.put('approval_history', history);
}

export async function getApprovalHistoryByRequest(requestId: string): Promise<ApprovalHistory[]> {
  const db = await getDB();
  return db.getAllFromIndex('approval_history', 'by-request', requestId);
}

// Login history operations
export async function saveLoginHistory(login: LoginHistory) {
  const db = await getDB();
  await db.put('login_history', login);
}

export async function getLoginHistoryByUser(userId: string): Promise<LoginHistory[]> {
  const db = await getDB();
  return db.getAllFromIndex('login_history', 'by-user', userId);
}

export async function getAllLoginHistory(): Promise<LoginHistory[]> {
  const db = await getDB();
  return db.getAll('login_history');
}

// Security event operations
export async function saveSecurityEvent(event: SecurityEvent) {
  const db = await getDB();
  await db.put('security_events', event);
}

export async function getSecurityEvent(id: string): Promise<SecurityEvent | undefined> {
  const db = await getDB();
  return db.get('security_events', id);
}

export async function getAllSecurityEvents(): Promise<SecurityEvent[]> {
  const db = await getDB();
  return db.getAll('security_events');
}

export async function getSecurityEventsByUser(userId: string): Promise<SecurityEvent[]> {
  const db = await getDB();
  return db.getAllFromIndex('security_events', 'by-user', userId);
}

export async function getUnresolvedSecurityEvents(): Promise<SecurityEvent[]> {
  const db = await getDB();
  return db.getAllFromIndex('security_events', 'by-resolved', false);
}

// Price change history operations
export async function savePriceChangeHistory(history: PriceChangeHistory) {
  const db = await getDB();
  await db.put('price_change_history', history);
}

export async function getPriceChangeHistoryByProduct(productId: string): Promise<PriceChangeHistory[]> {
  const db = await getDB();
  return db.getAllFromIndex('price_change_history', 'by-product', productId);
}

export async function getAllPriceChangeHistory(): Promise<PriceChangeHistory[]> {
  const db = await getDB();
  return db.getAll('price_change_history');
}

// Void request operations
export async function saveVoidRequest(request: VoidRequest) {
  const db = await getDB();
  await db.put('void_requests', request);
}

export async function getVoidRequest(id: string): Promise<VoidRequest | undefined> {
  const db = await getDB();
  return db.get('void_requests', id);
}

export async function getVoidRequestByTransaction(transactionId: string): Promise<VoidRequest | undefined> {
  const db = await getDB();
  const results = await db.getAllFromIndex('void_requests', 'by-transaction', transactionId);
  return results[0];
}

export async function getAllVoidRequests(): Promise<VoidRequest[]> {
  const db = await getDB();
  return db.getAll('void_requests');
}

export async function getVoidRequestsByStatus(status: string): Promise<VoidRequest[]> {
  const db = await getDB();
  return db.getAllFromIndex('void_requests', 'by-status', status);
}

// Refund request operations
export async function saveRefundRequest(request: RefundRequest) {
  const db = await getDB();
  await db.put('refund_requests', request);
}

export async function getRefundRequest(id: string): Promise<RefundRequest | undefined> {
  const db = await getDB();
  return db.get('refund_requests', id);
}

export async function getAllRefundRequests(): Promise<RefundRequest[]> {
  const db = await getDB();
  return db.getAll('refund_requests');
}

export async function getRefundRequestsByStatus(status: string): Promise<RefundRequest[]> {
  const db = await getDB();
  return db.getAllFromIndex('refund_requests', 'by-status', status);
}

// ============ SETTINGS STORE OPERATIONS ============

// Settings writes are local-first. A failed cloud write remains pending and is queued
// for retry, so the values entered by the user are never discarded or replaced by defaults.
async function persistSetting<T extends { id: string; sync_status: 'pending' | 'synced' }>(
  store: string,
  table: string,
  settings: T,
  payload: Record<string, unknown>,
): Promise<T> {
  const db = await getDB();
  const pending = { ...settings, sync_status: 'pending' as const } as T;
  await db.put(store as any, pending as any);

  try {
    const { getSupabase, queueForSync } = await import('./sync');
    const supabase = getSupabase();
    if (!supabase) {
      queueForSync(table, 'update', payload);
      return pending;
    }

    const { error } = await supabase.from(table).upsert(payload);
    if (error) throw new Error(error.message);

    const synced = { ...pending, sync_status: 'synced' as const } as T;
      await db.put(store as any, synced as any);
    return synced;
  } catch (error) {
    console.warn(`[v0] Settings cloud sync pending for ${table}:`, error instanceof Error ? error.message : String(error));
    try {
      const { queueForSync } = await import('./sync');
      queueForSync(table, 'update', payload);
    } catch (queueError) {
      console.warn(`[v0] Could not queue ${table} settings sync:`, queueError);
    }
    return pending;
  }
}

// Business settings operations
export async function saveBusinessSettings(settings: BusinessSettings): Promise<BusinessSettings> {
  return persistSetting('business_settings', 'business_settings', settings, {
    id: settings.id,
    business_name: settings.business_name,
    business_phone: settings.business_phone || null,
    business_email: settings.business_email || null,
    business_address: settings.business_address || null,
    tax_id: settings.tax_id || null,
    currency: settings.currency,
    currency_symbol: settings.currency_symbol,
    receipt_header: settings.receipt_header || null,
    receipt_footer: settings.receipt_footer || null,
    show_tax_on_receipt: settings.show_tax_on_receipt,
    logo_url: settings.logo_url || null,
    created_at: settings.created_at,
    updated_at: settings.updated_at,
  });
}

export async function getBusinessSettings(): Promise<BusinessSettings | undefined> {
  const db = await getDB();
  return db.get('business_settings', 'business-settings');
}

// KCB settings operations
export async function saveKCBSettings(settings: KCBSettings): Promise<KCBSettings> {
  const safeSettings: KCBSettings = {
    ...settings,
    id: settings.id || 'kcb-settings',
    sync_status: 'pending',
  };

  return persistSetting('kcb_settings', 'kcb_settings', safeSettings, {
    id: safeSettings.id,
    is_enabled: safeSettings.is_enabled,
    environment: safeSettings.environment,
    client_id: safeSettings.client_id || null,
    client_secret: safeSettings.client_secret || null,
    org_shortcode: safeSettings.org_shortcode || null,
    org_passkey: safeSettings.org_passkey || null,
    callback_url: safeSettings.callback_url || null,
    timeout_url: safeSettings.timeout_url || null,
    public_cert_path: safeSettings.public_cert_path || null,
    default_phone_country_code: safeSettings.default_phone_country_code,
    last_updated: safeSettings.last_updated,
    last_updated_by: safeSettings.last_updated_by || null,
    created_at: safeSettings.created_at,
    updated_at: safeSettings.updated_at,
  });
}

export async function getKCBSettings(): Promise<KCBSettings | undefined> {
  try {
    const db = await getDB();
    try {
      const settings = await db.get('kcb_settings', 'kcb-settings');
      return settings;
    } catch (storeError) {
      // Store might not exist yet, return undefined instead of erroring
      console.debug('[v0] KCB settings store not yet initialized');
      return undefined;
    }
  } catch (error) {
    console.error('[v0] Failed to get KCB settings:', error);
    return undefined;
  }
}

// KCB Payment operations
export interface KCBPaymentRecord {
  id: string;
  transaction_id?: string;
  phone: string;
  amount: number;
  checkout_request_id?: string;
  merchant_request_id?: string;
  mpesa_receipt_number?: string;
  status: 'pending' | 'processing' | 'success' | 'failed' | 'cancelled' | 'timeout' | 'insufficient_balance';
  result_desc?: string;
  error_message?: string;
  attempts: number;
  last_attempt_at?: string;
  completed_at?: string;
  created_at: string;
  created_by?: string;
  sync_status: 'pending' | 'synced';
}

export async function saveKCBPayment(payment: KCBPaymentRecord) {
  const db = await getDB();
  await db.put('kcb_payments', payment);
  const { getSupabase } = await import('./sync');
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from('kcb_payments').upsert({
      id: payment.id,
      transaction_id: payment.transaction_id,
      phone: payment.phone,
      amount: payment.amount,
      checkout_request_id: payment.checkout_request_id,
      merchant_request_id: payment.merchant_request_id,
      mpesa_receipt_number: payment.mpesa_receipt_number,
      status: payment.status,
      result_desc: payment.result_desc,
      error_message: payment.error_message,
      attempts: payment.attempts,
      last_attempt_at: payment.last_attempt_at,
      completed_at: payment.completed_at,
      created_at: payment.created_at,
      created_by: payment.created_by,
    });
    if (error) console.error('[v0] Supabase M-Pesa payment save error:', error);
  }
}

export async function getKCBPayment(id: string): Promise<KCBPaymentRecord | undefined> {
  const db = await getDB();
  return db.get('kcb_payments', id);
}

export async function getAllKCBPayments(): Promise<KCBPaymentRecord[]> {
  const db = await getDB();
  return db.getAll('kcb_payments');
}

export async function getKCBPaymentsByStatus(status: string): Promise<KCBPaymentRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex('kcb_payments', 'by-status', status);
}

export async function getKCBPaymentsByPhone(phone: string): Promise<KCBPaymentRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex('kcb_payments', 'by-phone', phone);
}

export async function getKCBPaymentsByTransaction(transactionId: string): Promise<KCBPaymentRecord | undefined> {
  const db = await getDB();
  const allPayments = await db.getAllFromIndex('kcb_payments', 'by-transaction', transactionId);
  return allPayments[0];
}

export async function getKCBPaymentsSinceDate(date: Date): Promise<KCBPaymentRecord[]> {
  const db = await getDB();
  const allPayments = await db.getAll('kcb_payments');
  return allPayments.filter(p => new Date(p.created_at) >= date);
}

export async function updateKCBPaymentStatus(id: string, status: KCBPaymentRecord['status'], updates?: Partial<KCBPaymentRecord>) {
  const db = await getDB();
  const payment = await db.get('kcb_payments', id);
  if (!payment) throw new Error('M-Pesa payment not found');
  
  const updated = {
    ...payment,
    ...updates,
    status,
    last_attempt_at: new Date().toISOString(),
  };
  await db.put('kcb_payments', updated);
  
  const { getSupabase } = await import('./sync');
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase.from('kcb_payments').update({
      status: updated.status,
      result_desc: updated.result_desc,
      error_message: updated.error_message,
      attempts: updated.attempts,
      mpesa_receipt_number: updated.mpesa_receipt_number,
      completed_at: updated.completed_at,
      last_attempt_at: updated.last_attempt_at,
    }).eq('id', id);
    if (error) console.error('[v0] Supabase M-Pesa payment update error:', error);
  }
}

// M-Pesa Statistics
export interface KCBStatistics {
  totalTransactions: number;
  totalRevenue: number;
  successfulTransactions: number;
  failedTransactions: number;
  successRate: number;
  recentTransactions: KCBPaymentRecord[];
}

export async function getKCBStatistics(sinceDate?: Date): Promise<KCBStatistics> {
  const payments = sinceDate ? await getKCBPaymentsSinceDate(sinceDate) : await getAllKCBPayments();
  
  const totalTransactions = payments.length;
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const successfulTransactions = payments.filter(p => p.status === 'success').length;
  const failedTransactions = payments.filter(p => p.status === 'failed').length;
  const successRate = totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0;
  
  // Sort by created_at descending and take last 5
  const recentTransactions = payments
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);
  
  return {
    totalTransactions,
    totalRevenue,
    successfulTransactions,
    failedTransactions,
    successRate,
    recentTransactions,
  };
}

// Payment method operations
export async function savePaymentMethod(method: PaymentMethodConfig): Promise<PaymentMethodConfig> {
  const db = await getDB();
  await db.put('payment_methods', method);
  const payload = {
    id: method.id,
    method_name: method.method_name,
    is_enabled: method.is_enabled,
    display_name: method.display_name,
    requires_reference: method.requires_reference,
    display_order: method.display_order,
    created_at: method.created_at,
    updated_at: method.updated_at,
  };

  try {
    const { getSupabase } = await import('./sync');
    const supabase = getSupabase();
    if (!supabase) {
      const { queueForSync } = await import('./sync');
      queueForSync('payment_methods', 'update', payload);
      return method;
    }
    const { error } = await supabase.from('payment_methods').upsert(payload);
    if (error) throw new Error(error.message);
    return method;
  } catch (error) {
    console.warn('[v0] Payment method cloud sync pending:', error instanceof Error ? error.message : String(error));
    const { queueForSync } = await import('./sync');
    queueForSync('payment_methods', 'update', payload);
    return method;
  }
}

export async function getPaymentMethod(id: string): Promise<PaymentMethodConfig | undefined> {
  const db = await getDB();
  return db.get('payment_methods', id);
}

export async function getAllPaymentMethods(): Promise<PaymentMethodConfig[]> {
  const db = await getDB();
  return db.getAll('payment_methods');
}

// Loyalty settings operations
export async function saveLoyaltySettings(settings: LoyaltySettings): Promise<LoyaltySettings> {
  return persistSetting('loyalty_settings', 'loyalty_settings', settings, {
    id: settings.id,
    is_enabled: settings.is_enabled,
    points_per_currency: settings.points_per_currency,
    point_value: settings.point_value,
    minimum_points_to_redeem: settings.minimum_points_to_redeem,
    signup_bonus_points: settings.signup_bonus_points,
    created_at: settings.created_at,
    updated_at: settings.updated_at,
  });
}

export async function getLoyaltySettings(): Promise<LoyaltySettings | undefined> {
  const db = await getDB();
  return db.get('loyalty_settings', 'loyalty-settings');
}

// Receipt settings operations
export async function saveReceiptSettings(settings: ReceiptSettings): Promise<ReceiptSettings> {
  return persistSetting('receipt_settings', 'receipt_settings', settings, {
    id: settings.id,
    show_customer_name: settings.show_customer_name,
    show_customer_phone: settings.show_customer_phone,
    show_item_barcode: settings.show_item_barcode,
    show_item_sku: settings.show_item_sku,
    show_cashier_name: settings.show_cashier_name,
    show_branch_name: settings.show_branch_name,
    show_tax_breakdown: settings.show_tax_breakdown,
    print_copy_for_customer: settings.print_copy_for_customer,
    print_copy_for_merchant: settings.print_copy_for_merchant,
    paper_width: settings.paper_width,
    created_at: settings.created_at,
    updated_at: settings.updated_at,
  });
}

export async function getReceiptSettings(): Promise<ReceiptSettings | undefined> {
  const db = await getDB();
  return db.get('receipt_settings', 'receipt-settings');
}

// ============ BACKUP & RESTORE OPERATIONS ============

export interface BackupData {
  version: string;
  exported_at: string;
  exported_by?: string;
  business_name: string;
  data: {
    customers?: any[];
    products?: any[];
    transactions?: any[];
    [key: string]: any;
  };
}

export async function restoreFromBackup(backup: BackupData): Promise<{ synced: number; skipped: number; errors: string[] }> {
  const db = await getDB();
  const errors: string[] = [];
  let synced = 0;
  let skipped = 0;

  try {
    // Restore products
    if (backup.data.products && Array.isArray(backup.data.products)) {
      for (const product of backup.data.products) {
        try {
          await db.put('products', product);
          synced++;
        } catch (error) {
          errors.push(`Product ${product.name}: ${error}`);
          skipped++;
        }
      }
    }

    // Restore customers
    if (backup.data.customers && Array.isArray(backup.data.customers)) {
      for (const customer of backup.data.customers) {
        try {
          await db.put('customers', customer);
          synced++;
        } catch (error) {
          errors.push(`Customer ${customer.name}: ${error}`);
          skipped++;
        }
      }
    }

    // Restore transactions if present
    if (backup.data.transactions && Array.isArray(backup.data.transactions)) {
      for (const transaction of backup.data.transactions) {
        try {
          await db.put('transactions', transaction);
          synced++;
        } catch (error) {
          errors.push(`Transaction ${transaction.id}: ${error}`);
          skipped++;
        }
      }
    }

    // Sync to cloud if available
    try {
      const { getSupabase } = await import('./sync');
      const supabase = getSupabase();
      if (supabase && backup.data.products) {
        await supabase.from('products').upsert(backup.data.products);
      }
      if (supabase && backup.data.customers) {
        await supabase.from('customers').upsert(backup.data.customers);
      }
    } catch (syncError) {
      console.log('[v0] Cloud sync skipped:', syncError);
    }

    return { synced, skipped, errors };
  } catch (error) {
    errors.push(`Restore failed: ${error}`);
    return { synced, skipped, errors };
  }
}

// ============ LEDGER STORE OPERATIONS ============

export interface LedgerEntryRecord {
  id: string;
  date: string;
  entry_type: 'sale' | 'refund' | 'void' | 'installment_payment' | 'loyalty_redemption' | 'income' | 'expense' | 'adjustment' | 'cash_draw' | 'transfer';
  category?: string;
  description: string;
  amount: number;
  payment_method: string;
  reference_id?: string;
  reference_type?: string;
  customer_id?: string;
  cashier_id?: string;
  cashier_name?: string;
  branch_id?: string;
  notes?: string;
  is_manual: boolean;
  created_at: string;
  created_by?: string;
  sync_status: 'pending' | 'synced';
  local_id?: string;
}

export interface ExpenseCategoryRecord {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
}

// Ledger entry operations
export async function saveLedgerEntry(entry: LedgerEntryRecord) {
  const db = await getDB();
  await db.put('ledger_entries', entry);
}

export async function getLedgerEntry(id: string): Promise<LedgerEntryRecord | undefined> {
  const db = await getDB();
  return db.get('ledger_entries', id);
}

export async function getAllLedgerEntries(): Promise<LedgerEntryRecord[]> {
  const db = await getDB();
  return db.getAll('ledger_entries');
}

export async function getLedgerEntriesByType(entryType: string): Promise<LedgerEntryRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex('ledger_entries', 'by-type', entryType);
}

export async function getLedgerEntriesByCategory(category: string): Promise<LedgerEntryRecord[]> {
  const db = await getDB();
  return db.getAllFromIndex('ledger_entries', 'by-category', category);
}

export async function deleteLedgerEntry(id: string) {
  const db = await getDB();
  await db.delete('ledger_entries', id);
}

// Expense category operations
export async function saveExpenseCategory(category: ExpenseCategoryRecord) {
  const db = await getDB();
  await db.put('expense_categories', category);
}

export async function getExpenseCategory(id: string): Promise<ExpenseCategoryRecord | undefined> {
  const db = await getDB();
  return db.get('expense_categories', id);
}

export async function getAllExpenseCategories(): Promise<ExpenseCategoryRecord[]> {
  const db = await getDB();
  return db.getAll('expense_categories');
}

// ============ CART SESSION PERSISTENCE ============

export interface CartSession {
  id: string;
  items: CartItem[];
  selectedCustomer: any | null;
  total: number;
  saleType: string;
  depositAmount: number;
  created_at: string;
  updated_at: string;
}

export async function saveCartSession(session: CartSession): Promise<void> {
  try {
    const db = await getDB();
    session.updated_at = new Date().toISOString();
    // Use 'current' as the key to always have one active session
    await db.put('cart_sessions', session, 'current');
  } catch (error) {
    console.error('[v0] Failed to save cart session:', error);
  }
}

export async function loadCartSession(): Promise<CartSession | undefined> {
  try {
    const db = await getDB();
    return await db.get('cart_sessions', 'current');
  } catch (error) {
    console.error('[v0] Failed to load cart session:', error);
    return undefined;
  }
}

export async function clearCartSession(): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('cart_sessions', 'current');
  } catch (error) {
    console.error('[v0] Failed to clear cart session:', error);
  }
}

// ============ PARKED SALES PERSISTENCE ============

export interface ParkedSale {
  id: string;
  cart: CartItem[];
  selectedCustomer: any | null;
  total: number;
  saleType: string;
  depositAmount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export async function saveParkedSale(sale: ParkedSale): Promise<void> {
  try {
    const db = await getDB();
    sale.updated_at = new Date().toISOString();
    await db.put('parked_sales', sale, sale.id);
  } catch (error) {
    console.error('[v0] Failed to save parked sale:', error);
  }
}

export async function getParkedSale(id: string): Promise<ParkedSale | undefined> {
  try {
    const db = await getDB();
    return await db.get('parked_sales', id);
  } catch (error) {
    console.error('[v0] Failed to load parked sale:', error);
    return undefined;
  }
}

export async function getAllParkedSales(): Promise<ParkedSale[]> {
  try {
    const db = await getDB();
    return await db.getAll('parked_sales');
  } catch (error) {
    console.error('[v0] Failed to load parked sales:', error);
    return [];
  }
}

export async function deleteParkedSale(id: string): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('parked_sales', id);
  } catch (error) {
    console.error('[v0] Failed to delete parked sale:', error);
  }
}

export async function clearAllParkedSales(): Promise<void> {
  try {
    const db = await getDB();
    await db.clear('parked_sales');
  } catch (error) {
    console.error('[v0] Failed to clear parked sales:', error);
  }
}

// ============ RESTORE POINT PERSISTENCE ============

export interface RestorePoint {
  id: string;
  backup_date: string;
  created_at: string;
  product_count: number;
  customer_count: number;
  transaction_count: number;
}

export async function saveRestorePoint(backupDate: string, productCount: number, customerCount: number, transactionCount: number): Promise<void> {
  try {
    const db = await getDB();
    const restorePoint: RestorePoint = {
      id: 'last-restore-point',
      backup_date: backupDate,
      created_at: new Date().toISOString(),
      product_count: productCount,
      customer_count: customerCount,
      transaction_count: transactionCount,
    };
    await db.put('restore_points', restorePoint, restorePoint.id);
    console.log('[v0] Saved restore point:', restorePoint);
  } catch (error) {
    console.error('[v0] Failed to save restore point:', error);
  }
}

export async function getLastRestorePoint(): Promise<RestorePoint | undefined> {
  try {
    const db = await getDB();
    return await db.get('restore_points', 'last-restore-point');
  } catch (error) {
    console.error('[v0] Failed to load restore point:', error);
    return undefined;
  }
}

export async function clearRestorePoint(): Promise<void> {
  try {
    const db = await getDB();
    await db.delete('restore_points', 'last-restore-point');
  } catch (error) {
    console.error('[v0] Failed to clear restore point:', error);
  }
}

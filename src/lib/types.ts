export interface Customer {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  loyalty_points: number;
  total_spent: number;
  created_at: string;
  updated_at: string;
  sync_status: 'pending' | 'synced';
}

export interface Product {
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

export interface Transaction {
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
  sale_type?: 'standard' | 'wholesale' | 'lipa_mdogo' | 'kyama';
  deposit_amount?: number;
  balance_amount?: number;
}

export interface InstallmentPlan {
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
}

export interface InstallmentPayment {
  id: string;
  plan_id: string;
  amount: number;
  payment_method: string;
  notes?: string;
  created_at: string;
  sync_status: 'pending' | 'synced';
}

export interface LoyaltyTransaction {
  id: string;
  customer_id: string;
  points: number;
  transaction_type: 'earned' | 'redeemed';
  source: string;
  reference_id?: string;
  created_at: string;
  sync_status: 'pending' | 'synced';
}

export interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}

export interface StockMovement {
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
}

export interface Supplier {
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
}

export interface Delivery {
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
}

export interface DeliveryItem {
  id: string;
  delivery_id: string;
  product_id: string;
  quantity_ordered: number;
  quantity_received: number;
  unit_cost: number;
  sync_status: 'pending' | 'synced';
}

export interface StockAdjustment {
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
}

export type EnterpriseSyncStatus = 'pending' | 'synced' | 'error';
export type SaleType = 'standard' | 'retail' | 'wholesale' | 'dropshipping' | 'lipa_mdogo' | 'kyama' | 'group_sale';

export interface ReportFilters {
  from: string;
  to: string;
  branch_id?: string;
  cashier_id?: string;
  shift_id?: string;
  terminal_id?: string;
  sale_type?: SaleType;
  payment_method?: string;
  customer_id?: string;
}

export interface ShiftRecord {
  id: string;
  cashier_id: string;
  branch_id?: string;
  terminal_id?: string;
  opened_at: string;
  closed_at?: string;
  opening_float: number;
  cash_count?: number;
  cash_sales: number;
  card_sales: number;
  mobile_money_sales: number;
  bank_sales: number;
  credit_sales: number;
  refunds: number;
  discounts: number;
  tax: number;
  gross_sales: number;
  net_sales: number;
  variance?: number;
  status: 'open' | 'closed' | 'archived';
  x_report_at?: string;
  y_report_at?: string;
  z_report_at?: string;
  sync_status: EnterpriseSyncStatus;
}

export interface ReconciliationRecord {
  id: string;
  payment_method: string;
  reference?: string;
  transaction_id?: string;
  customer_id?: string;
  expected_amount: number;
  received_amount: number;
  status: 'matched' | 'pending' | 'partial' | 'failed' | 'duplicate' | 'exception' | 'reversed';
  matched_at?: string;
  notes?: string;
  created_at: string;
  sync_status: EnterpriseSyncStatus;
}

export type OutboundDeliveryStatus = 'pending' | 'packed' | 'assigned' | 'dispatched' | 'in_transit' | 'delivered' | 'closed' | 'returned';

export interface OutboundDelivery {
  id: string;
  transaction_id: string;
  customer_id?: string;
  status: OutboundDeliveryStatus;
  address?: string;
  courier?: string;
  driver?: string;
  vehicle?: string;
  eta?: string;
  cod_amount?: number;
  cod_status?: 'pending' | 'collected' | 'failed' | 'not_applicable';
  proof_type?: 'signature' | 'photo' | 'otp' | 'qr';
  proof_reference?: string;
  created_at: string;
  updated_at: string;
  sync_status: EnterpriseSyncStatus;
}

export interface OfferRule {
  id: string;
  name: string;
  type: 'percentage' | 'fixed' | 'bogo' | 'bundle' | 'multi_buy' | 'coupon' | 'loyalty' | 'staff' | 'senior';
  value: number;
  priority: number;
  starts_at?: string;
  ends_at?: string;
  product_ids?: string[];
  customer_group?: string;
  stackable: boolean;
  is_active: boolean;
  sync_status: EnterpriseSyncStatus;
}

export interface SupplierFulfillment {
  id: string;
  transaction_id: string;
  supplier_id: string;
  status: 'pending' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  supplier_reference?: string;
  margin?: number;
  created_at: string;
  sync_status: EnterpriseSyncStatus;
}

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

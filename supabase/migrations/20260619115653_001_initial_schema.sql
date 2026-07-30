-- Customers table
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT UNIQUE,
  email TEXT,
  loyalty_points INTEGER DEFAULT 0,
  total_spent DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  price DECIMAL(12,2) NOT NULL,
  cost DECIMAL(12,2) DEFAULT 0,
  stock INTEGER DEFAULT 0,
  category TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table (sales)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  total_amount DECIMAL(12,2) NOT NULL,
  amount_paid DECIMAL(12,2) NOT NULL,
  change_amount DECIMAL(12,2) DEFAULT 0,
  payment_method TEXT DEFAULT 'cash',
  status TEXT DEFAULT 'completed',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'pending',
  local_id TEXT
);

-- Transaction items
CREATE TABLE transaction_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lipa Mdogo Mdogo (Installment/Layaway) Plans
CREATE TABLE installment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) NOT NULL,
  product_id UUID REFERENCES products(id) NOT NULL,
  product_name TEXT NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  amount_paid DECIMAL(12,2) DEFAULT 0,
  installment_count INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  product_released BOOLEAN DEFAULT false,
  release_date TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'pending',
  local_id TEXT
);

-- Installment payments
CREATE TABLE installment_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES installment_plans(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'pending',
  local_id TEXT
);

-- Loyalty transactions (points earned/redeemed)
CREATE TABLE loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) NOT NULL,
  points INTEGER NOT NULL,
  transaction_type TEXT NOT NULL,
  source TEXT,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'pending',
  local_id TEXT
);

-- Enable RLS on all tables
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE installment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE installment_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for customers
CREATE POLICY "select_customers" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_customers" ON customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_customers" ON customers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_customers" ON customers FOR DELETE TO authenticated USING (true);

-- RLS Policies for products
CREATE POLICY "select_products" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_products" ON products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_products" ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_products" ON products FOR DELETE TO authenticated USING (true);

-- RLS Policies for transactions
CREATE POLICY "select_transactions" ON transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_transactions" ON transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_transactions" ON transactions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_transactions" ON transactions FOR DELETE TO authenticated USING (true);

-- RLS Policies for transaction_items
CREATE POLICY "select_transaction_items" ON transaction_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_transaction_items" ON transaction_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_transaction_items" ON transaction_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_transaction_items" ON transaction_items FOR DELETE TO authenticated USING (true);

-- RLS Policies for installment_plans
CREATE POLICY "select_installment_plans" ON installment_plans FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_installment_plans" ON installment_plans FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_installment_plans" ON installment_plans FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_installment_plans" ON installment_plans FOR DELETE TO authenticated USING (true);

-- RLS Policies for installment_payments
CREATE POLICY "select_installment_payments" ON installment_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_installment_payments" ON installment_payments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_installment_payments" ON installment_payments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_installment_payments" ON installment_payments FOR DELETE TO authenticated USING (true);

-- RLS Policies for loyalty_transactions
CREATE POLICY "select_loyalty_transactions" ON loyalty_transactions FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_loyalty_transactions" ON loyalty_transactions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_loyalty_transactions" ON loyalty_transactions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_loyalty_transactions" ON loyalty_transactions FOR DELETE TO authenticated USING (true);

-- Indexes for better performance
CREATE INDEX idx_transactions_customer ON transactions(customer_id);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX idx_transaction_items_transaction ON transaction_items(transaction_id);
CREATE INDEX idx_installment_plans_customer ON installment_plans(customer_id);
CREATE INDEX idx_installment_plans_status ON installment_plans(status);
CREATE INDEX idx_installment_payments_plan ON installment_payments(plan_id);
CREATE INDEX idx_loyalty_transactions_customer ON loyalty_transactions(customer_id);
CREATE INDEX idx_customers_phone ON customers(phone);
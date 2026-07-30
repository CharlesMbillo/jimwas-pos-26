-- Ledger entries table for manual journal entries and financial tracking
CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date TIMESTAMPTZ DEFAULT NOW(),
  entry_type TEXT NOT NULL CHECK (entry_type IN ('sale', 'refund', 'void', 'installment_payment', 'loyalty_redemption', 'income', 'expense', 'adjustment', 'cash_draw', 'transfer')),
  category TEXT,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  payment_method TEXT DEFAULT 'cash',
  reference_id UUID,
  reference_type TEXT,
  customer_id UUID REFERENCES customers(id),
  cashier_id UUID,
  cashier_name TEXT,
  branch_id TEXT,
  notes TEXT,
  is_manual BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  sync_status TEXT DEFAULT 'pending',
  local_id TEXT
);

-- Indexes for ledger queries
CREATE INDEX idx_ledger_entries_date ON ledger_entries(date DESC);
CREATE INDEX idx_ledger_entries_type ON ledger_entries(entry_type);
CREATE INDEX idx_ledger_entries_category ON ledger_entries(category);
CREATE INDEX idx_ledger_entries_reference ON ledger_entries(reference_id, reference_type);

-- Enable RLS
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "select_ledger_entries" ON ledger_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_ledger_entries" ON ledger_entries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_ledger_entries" ON ledger_entries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_ledger_entries" ON ledger_entries FOR DELETE TO authenticated USING (true);

-- Expense categories table for categorizing expenses
CREATE TABLE expense_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_expense_categories" ON expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_expense_categories" ON expense_categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_expense_categories" ON expense_categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_expense_categories" ON expense_categories FOR DELETE TO authenticated USING (true);

-- Insert default expense categories
INSERT INTO expense_categories (name, description) VALUES
  ('Rent', 'Shop rent and lease payments'),
  ('Utilities', 'Electricity, water, internet bills'),
  ('Salaries', 'Staff wages and compensation'),
  ('Supplies', 'Shop supplies and packaging'),
  ('Maintenance', 'Equipment and shop repairs'),
  ('Marketing', 'Advertising and promotions'),
  ('Transport', 'Delivery and transport costs'),
  ('Other', 'Miscellaneous expenses');

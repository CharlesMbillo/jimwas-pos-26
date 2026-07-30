-- Stock Movements table (immutable - append only)
CREATE TABLE stock_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) NOT NULL,
  qty_delta INTEGER NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('sale', 'restock', 'adjustment', 'damage', 'transfer_in', 'transfer_out', 'return', 'initial')),
  note TEXT,
  balance_after INTEGER NOT NULL,
  reference_type TEXT CHECK (reference_type IN ('transaction', 'delivery', 'adjustment', 'return')),
  reference_id UUID,
  branch_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  sync_status TEXT DEFAULT 'pending',
  local_id TEXT
);

-- Suppliers table (for delivery tracking)
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'pending',
  local_id TEXT
);

-- Deliveries table
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID REFERENCES suppliers(id),
  delivery_number TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'received', 'partial', 'cancelled')),
  total_amount DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  received_by TEXT,
  received_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'pending',
  local_id TEXT
);

-- Delivery items
CREATE TABLE delivery_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id UUID REFERENCES deliveries(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) NOT NULL,
  product_name TEXT NOT NULL,
  quantity_ordered INTEGER NOT NULL,
  quantity_received INTEGER DEFAULT 0,
  unit_cost DECIMAL(12,2) DEFAULT 0,
  total_cost DECIMAL(12,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'pending',
  local_id TEXT
);

-- Stock adjustments table (for manual corrections with approval workflow)
CREATE TABLE stock_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) NOT NULL,
  product_name TEXT NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  qty_delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by TEXT,
  sync_status TEXT DEFAULT 'pending',
  local_id TEXT
);

-- Enable RLS
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_adjustments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for stock_movements (INSERT and SELECT only - immutable)
CREATE POLICY "select_stock_movements" ON stock_movements FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_stock_movements" ON stock_movements FOR INSERT TO authenticated WITH CHECK (true);

-- RLS Policies for suppliers
CREATE POLICY "select_suppliers" ON suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_suppliers" ON suppliers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_suppliers" ON suppliers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_suppliers" ON suppliers FOR DELETE TO authenticated USING (true);

-- RLS Policies for deliveries
CREATE POLICY "select_deliveries" ON deliveries FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_deliveries" ON deliveries FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_deliveries" ON deliveries FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_deliveries" ON deliveries FOR DELETE TO authenticated USING (true);

-- RLS Policies for delivery_items
CREATE POLICY "select_delivery_items" ON delivery_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_delivery_items" ON delivery_items FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_delivery_items" ON delivery_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_delivery_items" ON delivery_items FOR DELETE TO authenticated USING (true);

-- RLS Policies for stock_adjustments
CREATE POLICY "select_stock_adjustments" ON stock_adjustments FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_stock_adjustments" ON stock_adjustments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_stock_adjustments" ON stock_adjustments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_stock_adjustments" ON stock_adjustments FOR DELETE TO authenticated USING (true);

-- Indexes
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id);
CREATE INDEX idx_stock_movements_created ON stock_movements(created_at DESC);
CREATE INDEX idx_stock_movements_reason ON stock_movements(reason);
CREATE INDEX idx_deliveries_supplier ON deliveries(supplier_id);
CREATE INDEX idx_deliveries_status ON deliveries(status);
CREATE INDEX idx_delivery_items_delivery ON delivery_items(delivery_id);
CREATE INDEX idx_delivery_items_product ON delivery_items(product_id);
CREATE INDEX idx_stock_adjustments_product ON stock_adjustments(product_id);
CREATE INDEX idx_stock_adjustments_created ON stock_adjustments(created_at DESC);

-- Add low_stock_alert field to products
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_alert INTEGER DEFAULT 5;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_category TEXT DEFAULT 'standard_16';
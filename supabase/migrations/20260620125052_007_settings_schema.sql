-- Settings Schema for Jimwas POS
-- Migration 007

-- ============ BUSINESS SETTINGS TABLE ============
CREATE TABLE IF NOT EXISTS business_settings (
  id TEXT PRIMARY KEY,
  business_name TEXT NOT NULL DEFAULT 'Jimwas Store',
  business_phone TEXT,
  business_email TEXT,
  business_address TEXT,
  tax_id TEXT,
  currency TEXT DEFAULT 'KES',
  currency_symbol TEXT DEFAULT 'KES',
  receipt_header TEXT,
  receipt_footer TEXT,
  show_tax_on_receipt BOOLEAN DEFAULT true,
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'pending'
);

-- ============ MPESA SETTINGS TABLE ============
CREATE TABLE IF NOT EXISTS mpesa_settings (
  id TEXT PRIMARY KEY,
  is_enabled BOOLEAN DEFAULT false,
  environment TEXT DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  consumer_key TEXT,
  consumer_secret TEXT,
  passkey TEXT,
  short_code TEXT,
  till_number TEXT,
  callback_url TEXT,
  timeout_url TEXT,
  result_url TEXT,
  default_phone_country_code TEXT DEFAULT '254',
  last_updated TIMESTAMPTZ,
  last_updated_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'pending'
);

-- ============ PAYMENT METHODS TABLE ============
CREATE TABLE IF NOT EXISTS payment_methods (
  id TEXT PRIMARY KEY,
  method_name TEXT NOT NULL CHECK (method_name IN ('cash', 'card', 'mpesa', 'bank_transfer')),
  is_enabled BOOLEAN DEFAULT true,
  display_name TEXT NOT NULL,
  requires_reference BOOLEAN DEFAULT false,
  icon TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ LOYALTY SETTINGS TABLE ============
CREATE TABLE IF NOT EXISTS loyalty_settings (
  id TEXT PRIMARY KEY,
  is_enabled BOOLEAN DEFAULT true,
  points_per_currency INTEGER DEFAULT 100,
  point_value NUMERIC DEFAULT 1,
  minimum_points_to_redeem INTEGER DEFAULT 10,
  signup_bonus_points INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'pending'
);

-- ============ RECEIPT SETTINGS TABLE ============
CREATE TABLE IF NOT EXISTS receipt_settings (
  id TEXT PRIMARY KEY,
  show_customer_name BOOLEAN DEFAULT true,
  show_customer_phone BOOLEAN DEFAULT false,
  show_item_barcode BOOLEAN DEFAULT false,
  show_item_sku BOOLEAN DEFAULT false,
  show_cashier_name BOOLEAN DEFAULT true,
  show_branch_name BOOLEAN DEFAULT false,
  show_tax_breakdown BOOLEAN DEFAULT true,
  print_copy_for_customer BOOLEAN DEFAULT true,
  print_copy_for_merchant BOOLEAN DEFAULT false,
  paper_width TEXT DEFAULT '58mm' CHECK (paper_width IN ('58mm', '80mm')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'pending'
);

-- Enable RLS
ALTER TABLE business_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE mpesa_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipt_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "business_settings_all" ON business_settings FOR ALL USING (true);
CREATE POLICY "mpesa_settings_all" ON mpesa_settings FOR ALL USING (true);
CREATE POLICY "payment_methods_all" ON payment_methods FOR ALL USING (true);
CREATE POLICY "loyalty_settings_all" ON loyalty_settings FOR ALL USING (true);
CREATE POLICY "receipt_settings_all" ON receipt_settings FOR ALL USING (true);

-- Insert default settings
INSERT INTO business_settings (id, business_name, business_phone, currency, currency_symbol, created_at, updated_at, sync_status) VALUES (
  'business-settings',
  'Jimwas Store',
  '',
  'KES',
  'KES',
  NOW(),
  NOW(),
  'synced'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO mpesa_settings (id, is_enabled, environment, default_phone_country_code, created_at, updated_at, sync_status) VALUES (
  'mpesa-settings',
  false,
  'sandbox',
  '254',
  NOW(),
  NOW(),
  'synced'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO payment_methods (id, method_name, is_enabled, display_name, requires_reference, display_order, created_at, updated_at) VALUES
('pm-cash', 'cash', true, 'Cash', false, 1, NOW(), NOW()),
('pm-mpesa', 'mpesa', true, 'M-Pesa', true, 2, NOW(), NOW()),
('pm-card', 'card', true, 'Card', false, 3, NOW(), NOW()),
('pm-bank', 'bank_transfer', false, 'Bank Transfer', true, 4, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO loyalty_settings (id, is_enabled, points_per_currency, point_value, minimum_points_to_redeem, signup_bonus_points, created_at, updated_at, sync_status) VALUES (
  'loyalty-settings',
  true,
  100,
  1,
  10,
  0,
  NOW(),
  NOW(),
  'synced'
) ON CONFLICT (id) DO NOTHING;

INSERT INTO receipt_settings (id, show_customer_name, show_cashier_name, show_tax_breakdown, print_copy_for_customer, paper_width, created_at, updated_at, sync_status) VALUES (
  'receipt-settings',
  true,
  true,
  true,
  true,
  '58mm',
  NOW(),
  NOW(),
  'synced'
) ON CONFLICT (id) DO NOTHING;

-- Comments
COMMENT ON TABLE business_settings IS 'Business information and general settings';
COMMENT ON TABLE mpesa_settings IS 'M-Pesa STK Push configuration';
COMMENT ON TABLE payment_methods IS 'Available payment methods';
COMMENT ON TABLE loyalty_settings IS 'Loyalty program configuration';
COMMENT ON TABLE receipt_settings IS 'Receipt printing options';
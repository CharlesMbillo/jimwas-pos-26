-- KCB BUNI Settings Schema for Jimwas POS
-- Migration 008 - Adding KCB BUNI M-Pesa integration settings

-- ============ KCB SETTINGS TABLE ============
CREATE TABLE IF NOT EXISTS kcb_settings (
  id TEXT PRIMARY KEY,
  is_enabled BOOLEAN DEFAULT false,
  environment TEXT DEFAULT 'sandbox' CHECK (environment IN ('sandbox', 'production')),
  client_id TEXT,
  client_secret TEXT,
  org_shortcode TEXT,
  org_passkey TEXT,
  callback_url TEXT,
  timeout_url TEXT,
  public_cert_path TEXT,
  default_phone_country_code TEXT DEFAULT '254',
  last_updated TIMESTAMPTZ,
  last_updated_by TEXT REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'pending'
);

-- Enable RLS
ALTER TABLE kcb_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policy - Allow all authenticated users to read/write KCB settings
CREATE POLICY "kcb_settings_all" ON kcb_settings FOR ALL USING (true);

-- Insert default KCB settings
INSERT INTO kcb_settings (
  id, 
  is_enabled, 
  environment, 
  client_id, 
  client_secret,
  org_shortcode,
  org_passkey,
  default_phone_country_code, 
  created_at, 
  updated_at, 
  sync_status
) VALUES (
  'kcb-settings',
  false,
  'sandbox',
  '',
  '',
  '',
  '',
  '254',
  NOW(),
  NOW(),
  'synced'
) ON CONFLICT (id) DO NOTHING;

-- Comment
COMMENT ON TABLE kcb_settings IS 'KCB BUNI M-Pesa STK Push configuration';

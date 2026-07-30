-- Add missing columns to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS low_stock_alert INTEGER DEFAULT 5;
ALTER TABLE products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS tax_category TEXT DEFAULT 'standard_16';
ALTER TABLE products ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'pending';
ALTER TABLE products ADD COLUMN IF NOT EXISTS local_id TEXT;
-- Idempotent seed for products and settings.
-- Adjust table/column names to your schema if needed.

-- Ensure extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Ensure settings table exists (example).
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Ensure products table exists (example).
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Upsert sample products (use a unique key like sku)
INSERT INTO products (sku, name, price, unit, metadata)
VALUES
  ('SKU-001', 'Sample Product A', 100.00, 'unit', '{"category":"default"}'),
  ('SKU-002', 'Sample Product B', 250.00, 'unit', '{"category":"default"}')
ON CONFLICT (sku) DO UPDATE
  SET name = EXCLUDED.name,
      price = EXCLUDED.price,
      unit = EXCLUDED.unit,
      metadata = EXCLUDED.metadata,
      updated_at = now();

-- Upsert default settings (store as JSONB)
INSERT INTO settings (key, value)
VALUES
  ('seeded', '{"time":"2026-07-31","by":"seed-script"}'),
  ('currency', '"KES"'),
  ('receipt_prefix', '"JIMWAS"')
ON CONFLICT (key) DO UPDATE
  SET value = EXCLUDED.value,
      updated_at = now();

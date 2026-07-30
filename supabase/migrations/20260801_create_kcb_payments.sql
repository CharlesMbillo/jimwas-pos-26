-- Migration: create kcb_payments table
CREATE TABLE IF NOT EXISTS kcb_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_request_id text UNIQUE,
  merchant_request_id text,
  phone_number text,
  amount numeric,
  status text,
  receipt text,
  transaction_id text,
  customer_id text,
  raw_request jsonb,
  raw_response jsonb,
  callback_received boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kcb_payments_checkout ON kcb_payments (checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_kcb_payments_merchant ON kcb_payments (merchant_request_id);

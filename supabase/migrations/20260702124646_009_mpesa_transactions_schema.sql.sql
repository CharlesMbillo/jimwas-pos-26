/*
# M-Pesa STK Push Transactions Table

1. New Tables
- `mpesa_transactions`
  - `id` (uuid, primary key)
  - `checkout_request_id` (text, unique) - M-Pesa checkout request ID from STK push
  - `merchant_request_id` (text) - M-Pesa merchant request ID
  - `phone_number` (text) - Customer phone number
  - `amount` (decimal) - Transaction amount
  - `status` (text) - Status: pending, success, failed, cancelled, timeout
  - `result_code` (text) - M-Pesa result code
  - `result_desc` (text) - M-Pesa result description
  - `mpesa_receipt_number` (text) - M-Pesa receipt number on success
  - `transaction_date` (text) - M-Pesa transaction date
  - `transaction_id` (uuid) - Reference to local transaction
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)
  - `callback_received` (boolean) - Whether callback was received

2. Security
- Enable RLS on `mpesa_transactions`.
- Allow anon + authenticated CRUD (single-tenant POS system).

3. Notes
- This table tracks STK push payment requests initiated from the POS.
- The checkout_request_id is used to match callbacks from M-Pesa.
- Status transitions: pending -> success/failed/cancelled/timeout
*/

CREATE TABLE IF NOT EXISTS mpesa_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_request_id TEXT UNIQUE,
  merchant_request_id TEXT,
  phone_number TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed', 'cancelled', 'timeout')),
  result_code TEXT,
  result_desc TEXT,
  mpesa_receipt_number TEXT,
  transaction_date TEXT,
  transaction_id UUID,
  customer_id UUID REFERENCES customers(id),
  cashier_id UUID,
  cashier_name TEXT,
  callback_received BOOLEAN DEFAULT false,
  callback_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE mpesa_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DROP POLICY IF EXISTS "select_mpesa_transactions" ON mpesa_transactions;
CREATE POLICY "select_mpesa_transactions" ON mpesa_transactions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_mpesa_transactions" ON mpesa_transactions;
CREATE POLICY "insert_mpesa_transactions" ON mpesa_transactions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_mpesa_transactions" ON mpesa_transactions;
CREATE POLICY "update_mpesa_transactions" ON mpesa_transactions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_mpesa_transactions_checkout ON mpesa_transactions(checkout_request_id);
CREATE INDEX idx_mpesa_transactions_status ON mpesa_transactions(status);
CREATE INDEX idx_mpesa_transactions_created ON mpesa_transactions(created_at DESC);

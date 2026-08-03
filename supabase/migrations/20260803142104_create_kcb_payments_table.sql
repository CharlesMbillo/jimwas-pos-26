-- Create kcb_payments table for KCB BUNI M-Pesa STK Push transactions
CREATE TABLE IF NOT EXISTS kcb_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checkout_request_id text UNIQUE,
  merchant_request_id text,
  phone_number text,
  amount numeric,
  status text NOT NULL DEFAULT 'pending',
  result_code text,
  result_desc text,
  mpesa_receipt_number text,
  transaction_date text,
  transaction_id uuid,
  customer_id uuid,
  cashier_id text,
  cashier_name text,
  callback_received boolean DEFAULT false,
  callback_payload jsonb,
  raw_request jsonb,
  raw_response jsonb,
  error_message text,
  attempts integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kcb_payments_checkout ON kcb_payments (checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_kcb_payments_merchant ON kcb_payments (merchant_request_id);
CREATE INDEX IF NOT EXISTS idx_kcb_payments_status ON kcb_payments (status);

ALTER TABLE kcb_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_kcb_payments" ON kcb_payments FOR SELECT
  TO anon, authenticated USING (true);
CREATE POLICY "insert_kcb_payments" ON kcb_payments FOR INSERT
  TO anon, authenticated WITH CHECK (true);
CREATE POLICY "update_kcb_payments" ON kcb_payments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_kcb_payments" ON kcb_payments FOR DELETE
  TO anon, authenticated USING (true);

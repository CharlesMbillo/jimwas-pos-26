-- SQL migration for environments where you prefer raw SQL or for manual application.
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(64) NOT NULL,
  provider_transaction_id varchar(128),
  merchant_request_id varchar(128),
  checkout_request_id varchar(128),
  phone_number varchar(32) NOT NULL,
  amount numeric NOT NULL,
  invoice_number varchar(128) NOT NULL,
  status varchar(32) NOT NULL DEFAULT 'PENDING',
  receipt_number varchar(64),
  callback_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_merchant_request_id ON payments (merchant_request_id);
CREATE INDEX IF NOT EXISTS idx_payments_invoice_number ON payments (invoice_number);

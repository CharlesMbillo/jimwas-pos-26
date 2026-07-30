ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS idempotency_key varchar(128);

CREATE INDEX IF NOT EXISTS idx_payments_idempotency_key ON payments (idempotency_key);

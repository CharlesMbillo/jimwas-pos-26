-- Fix mpesa_transactions status CHECK constraint to include all possible M-Pesa statuses
-- The callback sets 'insufficient_balance' and 'invalid_pin' which were missing

ALTER TABLE mpesa_transactions
  DROP CONSTRAINT IF EXISTS mpesa_transactions_status_check;

ALTER TABLE mpesa_transactions
  ADD CONSTRAINT mpesa_transactions_status_check
  CHECK (status IN ('pending', 'processing', 'success', 'failed', 'cancelled', 'timeout', 'insufficient_balance', 'invalid_pin'));

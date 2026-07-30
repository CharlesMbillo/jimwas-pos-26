-- Migration: Add DB-level unique indexes for payment notification/request IDs
-- Timestamp: 2026-08-01
-- Purpose: Prevent duplicate processing of the same external IDs from KCB/MPESA

-- Note: Using CREATE UNIQUE INDEX IF NOT EXISTS so this migration is idempotent

-- kcb_payments: make checkout_request_id and merchant_request_id unique when present
CREATE UNIQUE INDEX IF NOT EXISTS uniq_kcb_payments_checkout_request_id ON kcb_payments (checkout_request_id) WHERE checkout_request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_kcb_payments_merchant_request_id ON kcb_payments (merchant_request_id) WHERE merchant_request_id IS NOT NULL;

-- mpesa_transactions (legacy names) if present: protect merchant / checkout IDs
CREATE UNIQUE INDEX IF NOT EXISTS uniq_mpesa_transactions_checkout_request_id ON mpesa_transactions (checkout_request_id) WHERE checkout_request_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_mpesa_transactions_merchant_request_id ON mpesa_transactions (merchant_request_id) WHERE merchant_request_id IS NOT NULL;

-- kcb_notifications: payload is JSON; create expression indexes on common ID fields
CREATE UNIQUE INDEX IF NOT EXISTS uniq_kcb_notifications_requestid ON kcb_notifications ((payload ->> 'requestId')) WHERE (payload ->> 'requestId') IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_kcb_notifications_transactionref ON kcb_notifications ((payload ->> 'transactionReference')) WHERE (payload ->> 'transactionReference') IS NOT NULL;

-- kcb_validations: request is a JSON object with requestId
CREATE UNIQUE INDEX IF NOT EXISTS uniq_kcb_validations_requestid ON kcb_validations ((request ->> 'requestId')) WHERE (request ->> 'requestId') IS NOT NULL;

-- kcb_payments: also protect provider transaction id / receipt if present
CREATE UNIQUE INDEX IF NOT EXISTS uniq_kcb_payments_provider_txid ON kcb_payments ((provider_transaction_id)) WHERE provider_transaction_id IS NOT NULL;

-- Safety: create partial unique index on kcb_payments (checkout_request_id, merchant_request_id) combination
CREATE UNIQUE INDEX IF NOT EXISTS uniq_kcb_payments_checkout_merchant ON kcb_payments (checkout_request_id, merchant_request_id) WHERE checkout_request_id IS NOT NULL OR merchant_request_id IS NOT NULL;

-- Add comments for maintainers
COMMENT ON INDEX IF EXISTS uniq_kcb_payments_checkout_request_id IS 'Unique index to prevent duplicate KCB checkout_request_id entries';
COMMENT ON INDEX IF EXISTS uniq_kcb_payments_merchant_request_id IS 'Unique index to prevent duplicate KCB merchant_request_id entries';
COMMENT ON INDEX IF EXISTS uniq_kcb_notifications_requestid IS 'Unique index on KCB notification JSON payload requestId';
COMMENT ON INDEX IF EXISTS uniq_kcb_validations_requestid IS 'Unique index on KCB validation request.requestId';

-- End of migration

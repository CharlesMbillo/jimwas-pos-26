-- Ensure the pgcrypto extension is available for gen_random_uuid()
-- This is safe to run in deployments that already have the extension.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

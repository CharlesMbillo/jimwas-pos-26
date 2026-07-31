-- KCB Buni Integration Database Schema (fixed for PostgreSQL)
-- Created: July 29, 2026 (fixed)
-- Purpose: Support KCB bill validation, notifications, and till-specific IPNs

-- Table: bill_validations
-- Note: PostgreSQL does not support the MySQL-style `INDEX ...` clause inside
-- CREATE TABLE. Create the table first, then create indexes using CREATE INDEX.

CREATE TABLE IF NOT EXISTS bill_validations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number varchar(50) NOT NULL,
  org_short_code varchar(20) NOT NULL,
  phone_number varchar(20) NOT NULL,
  amount numeric(15,2) NOT NULL,
  customer_name varchar(255),
  account_number varchar(50),
  due_date timestamptz,
  description text,
  status varchar(20) DEFAULT 'active', -- active, paid, cancelled
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  UNIQUE (invoice_number, org_short_code)
);

-- Create index separately (use an explicit, schema-qualified name if needed)
CREATE INDEX IF NOT EXISTS idx_bill_validations_invoice_number ON bill_validations (invoice_number);

-- KCB Buni Integration Database Schema
-- Created: July 29, 2026
-- Purpose: Support KCB bill validation, notifications, and till-specific IPNs

-- Table: Bill Validations
-- Stores bills that KCB can validate before payment
CREATE TABLE IF NOT EXISTS bill_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) NOT NULL,
  org_short_code VARCHAR(20) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  customer_name VARCHAR(255),
  account_number VARCHAR(50),
  due_date TIMESTAMP,
  description TEXT,
  status VARCHAR(20) DEFAULT 'active', -- active, paid, cancelled
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  UNIQUE(invoice_number, org_short_code),
  INDEX idx_invoice_number (invoice_number),
  INDEX idx_org_short_code (org_short_code),
  INDEX idx_phone_number (phone_number)
);

-- Table: KCB Transactions
-- Records all bill payments from KCB notifications
CREATE TABLE IF NOT EXISTS kcb_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number VARCHAR(50) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  status VARCHAR(20) NOT NULL, -- pending, completed, failed
  result_code VARCHAR(10) NOT NULL,
  result_message TEXT,
  mpesa_receipt VARCHAR(50),
  mpesa_transaction_id VARCHAR(100),
  transaction_date VARCHAR(20),
  org_short_code VARCHAR(20),
  raw_payload JSONB,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  INDEX idx_invoice_number (invoice_number),
  INDEX idx_mpesa_receipt (mpesa_receipt),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- Table: Till Transactions
-- Records till-specific payment notifications from KCB
CREATE TABLE IF NOT EXISTS till_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  till_id VARCHAR(50) NOT NULL,
  cashier_id VARCHAR(50) NOT NULL,
  cashier_name VARCHAR(255) NOT NULL,
  invoice_number VARCHAR(50) NOT NULL,
  phone_number VARCHAR(20) NOT NULL,
  amount DECIMAL(15, 2) NOT NULL,
  status VARCHAR(20) NOT NULL, -- pending, completed, failed
  result_code VARCHAR(10) NOT NULL,
  result_message TEXT,
  mpesa_receipt VARCHAR(50),
  mpesa_transaction_id VARCHAR(100),
  transaction_date VARCHAR(20),
  transaction_time VARCHAR(20),
  reconciliation_id VARCHAR(100),
  org_short_code VARCHAR(20),
  raw_payload JSONB,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  INDEX idx_till_id (till_id),
  INDEX idx_cashier_id (cashier_id),
  INDEX idx_invoice_number (invoice_number),
  INDEX idx_mpesa_receipt (mpesa_receipt),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- Table: KCB Audit Logs
-- Comprehensive audit trail for all KCB operations
CREATE TABLE IF NOT EXISTS kcb_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type VARCHAR(100) NOT NULL, -- bill_validation_query, bill_notification_received, till_notification_received, etc
  till_id VARCHAR(50),
  cashier_id VARCHAR(50),
  invoice_number VARCHAR(50),
  phone_number VARCHAR(20),
  amount DECIMAL(15, 2),
  result VARCHAR(50), -- success, error, failed
  mpesa_receipt VARCHAR(50),
  error_message TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  timestamp TIMESTAMP DEFAULT now(),
  
  INDEX idx_event_type (event_type),
  INDEX idx_timestamp (timestamp),
  INDEX idx_invoice_number (invoice_number),
  INDEX idx_till_id (till_id)
);

-- Table: KCB Settings
-- Configuration for KCB integration (org-specific)
CREATE TABLE IF NOT EXISTS kcb_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL,
  org_short_code VARCHAR(20) NOT NULL UNIQUE,
  org_pass_key VARCHAR(255) NOT NULL,
  environment VARCHAR(20) DEFAULT 'sandbox', -- sandbox, production
  is_enabled BOOLEAN DEFAULT true,
  bill_validation_url VARCHAR(500),
  bill_notification_url VARCHAR(500),
  till_notification_url VARCHAR(500),
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  
  INDEX idx_org_id (org_id),
  INDEX idx_org_short_code (org_short_code)
);

-- Add RLS policies for KCB tables
ALTER TABLE bill_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kcb_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE till_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE kcb_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE kcb_settings ENABLE ROW LEVEL SECURITY;

-- RLS: Bill Validations - authenticated users can read/write
CREATE POLICY bill_validations_authenticated 
  ON bill_validations 
  FOR ALL 
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- RLS: KCB Transactions - read/write for authenticated, insert-only for service role (IPN)
CREATE POLICY kcb_transactions_authenticated 
  ON kcb_transactions 
  FOR ALL 
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY kcb_transactions_service 
  ON kcb_transactions 
  FOR INSERT 
  WITH CHECK (auth.role() = 'service_role');

-- RLS: Till Transactions - similar to KCB transactions
CREATE POLICY till_transactions_authenticated 
  ON till_transactions 
  FOR ALL 
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY till_transactions_service 
  ON till_transactions 
  FOR INSERT 
  WITH CHECK (auth.role() = 'service_role');

-- RLS: Audit Logs - insert for service role, read for authenticated
CREATE POLICY kcb_audit_logs_insert 
  ON kcb_audit_logs 
  FOR INSERT 
  WITH CHECK (auth.role() = 'service_role' OR auth.role() = 'authenticated');

CREATE POLICY kcb_audit_logs_read 
  ON kcb_audit_logs 
  FOR SELECT 
  USING (auth.role() = 'authenticated');

-- RLS: KCB Settings - read/write for authenticated
CREATE POLICY kcb_settings_authenticated 
  ON kcb_settings 
  FOR ALL 
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
  RETURNS TRIGGER AS $$
  BEGIN
    NEW.updated_at = now();
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

CREATE TRIGGER bill_validations_updated BEFORE UPDATE ON bill_validations
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER kcb_transactions_updated BEFORE UPDATE ON kcb_transactions
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER till_transactions_updated BEFORE UPDATE ON till_transactions
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER kcb_settings_updated BEFORE UPDATE ON kcb_settings
  FOR EACH ROW EXECUTE FUNCTION update_timestamp();

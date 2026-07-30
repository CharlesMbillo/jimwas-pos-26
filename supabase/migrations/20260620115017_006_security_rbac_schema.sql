-- Security and RBAC Schema for Jimwas POS
-- Migration 006

-- Enable UUID extension if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============ PERMISSIONS TABLE ============
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  domain TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============ ROLES TABLE ============
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  permissions TEXT[] DEFAULT '{}',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'synced'
);

-- ============ USERS TABLE ============
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_id TEXT REFERENCES roles(id),
  role_code TEXT NOT NULL,
  branch_id TEXT,
  branch_name TEXT,
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMPTZ,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'pending'
);

-- ============ AUDIT LOGS TABLE ============
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  user_id TEXT NOT NULL,
  user_name TEXT NOT NULL,
  user_role TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  reason TEXT,
  branch_id TEXT,
  branch_name TEXT,
  device_info TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============ APPROVAL REQUESTS TABLE ============
CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  request_type TEXT NOT NULL,
  requester_id TEXT NOT NULL REFERENCES users(id),
  requester_name TEXT NOT NULL,
  requester_role TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  request_data JSONB NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  approver_id TEXT REFERENCES users(id),
  approver_name TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  branch_id TEXT,
  branch_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_requester ON approval_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_approval_requests_status ON approval_requests(status);
CREATE INDEX IF NOT EXISTS idx_approval_requests_type ON approval_requests(request_type);

-- ============ APPROVAL HISTORY TABLE ============
CREATE TABLE IF NOT EXISTS approval_history (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL REFERENCES approval_requests(id),
  action TEXT NOT NULL,
  actor_id TEXT NOT NULL REFERENCES users(id),
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_approval_history_request ON approval_history(request_id);

-- ============ LOGIN HISTORY TABLE ============
CREATE TABLE IF NOT EXISTS login_history (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  user_name TEXT NOT NULL,
  device_info TEXT,
  ip_address TEXT,
  login_at TIMESTAMPTZ DEFAULT NOW(),
  logout_at TIMESTAMPTZ,
  session_duration_minutes INTEGER,
  login_status TEXT NOT NULL,
  failure_reason TEXT,
  branch_id TEXT,
  branch_name TEXT,
  sync_status TEXT DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_login_history_user ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_login_at ON login_history(login_at DESC);

-- ============ SECURITY EVENTS TABLE ============
CREATE TABLE IF NOT EXISTS security_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  user_name TEXT,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  branch_id TEXT,
  branch_name TEXT,
  is_resolved BOOLEAN DEFAULT false,
  resolved_by TEXT REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_security_events_user ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_resolved ON security_events(is_resolved);

-- ============ PRICE CHANGE HISTORY TABLE ============
CREATE TABLE IF NOT EXISTS price_change_history (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  product_name TEXT,
  old_price NUMERIC NOT NULL,
  new_price NUMERIC NOT NULL,
  changed_by_id TEXT NOT NULL REFERENCES users(id),
  changed_by_name TEXT NOT NULL,
  approved_by_id TEXT REFERENCES users(id),
  approved_by_name TEXT,
  reason TEXT NOT NULL,
  approval_request_id TEXT REFERENCES approval_requests(id),
  branch_id TEXT,
  branch_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_price_change_product ON price_change_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_change_changed_by ON price_change_history(changed_by_id);

-- ============ VOID REQUESTS TABLE ============
CREATE TABLE IF NOT EXISTS void_requests (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  transaction_total NUMERIC NOT NULL,
  requester_id TEXT NOT NULL REFERENCES users(id),
  requester_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  approver_id TEXT REFERENCES users(id),
  approver_name TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  approval_request_id TEXT REFERENCES approval_requests(id),
  branch_id TEXT,
  branch_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_void_requests_transaction ON void_requests(transaction_id);
CREATE INDEX IF NOT EXISTS idx_void_requests_status ON void_requests(status);

-- ============ REFUND REQUESTS TABLE ============
CREATE TABLE IF NOT EXISTS refund_requests (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  refund_amount NUMERIC NOT NULL,
  requester_id TEXT NOT NULL REFERENCES users(id),
  requester_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  approver_id TEXT REFERENCES users(id),
  approver_name TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  approval_request_id TEXT REFERENCES approval_requests(id),
  branch_id TEXT,
  branch_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  sync_status TEXT DEFAULT 'pending'
);

CREATE INDEX IF NOT EXISTS idx_refund_requests_transaction ON refund_requests(transaction_id);
CREATE INDEX IF NOT EXISTS idx_refund_requests_status ON refund_requests(status);

-- ============ SEED DATA: PERMISSIONS ============
INSERT INTO permissions (id, name, domain, action, description, created_at) VALUES
('perm-sales-view', 'sales.view', 'sales', 'view', 'View sales transactions', NOW()),
('perm-sales-create', 'sales.create', 'sales', 'create', 'Create new sales', NOW()),
('perm-sales-edit', 'sales.edit', 'sales', 'edit', 'Edit pending sales', NOW()),
('perm-sales-delete', 'sales.delete', 'sales', 'delete', 'Delete pending sales', NOW()),
('perm-sales-void', 'sales.void', 'sales', 'void', 'Void completed sales', NOW()),
('perm-sales-refund', 'sales.refund', 'sales', 'refund', 'Process refunds', NOW()),
('perm-inventory-view', 'inventory.view', 'inventory', 'view', 'View inventory', NOW()),
('perm-inventory-create', 'inventory.create', 'inventory', 'create', 'Add new products', NOW()),
('perm-inventory-edit', 'inventory.edit', 'inventory', 'edit', 'Edit product details', NOW()),
('perm-inventory-delete', 'inventory.delete', 'inventory', 'delete', 'Delete products', NOW()),
('perm-inventory-adjust', 'inventory.adjust', 'inventory', 'adjust', 'Adjust stock levels', NOW()),
('perm-stock-transfer', 'stock.transfer', 'inventory', 'transfer', 'Transfer stock between branches', NOW()),
('perm-price-change', 'price.change', 'inventory', 'change', 'Change product prices', NOW()),
('perm-customers-view', 'customers.view', 'customers', 'view', 'View customers', NOW()),
('perm-customers-create', 'customers.create', 'customers', 'create', 'Add new customers', NOW()),
('perm-customers-edit', 'customers.edit', 'customers', 'edit', 'Edit customer details', NOW()),
('perm-customers-delete', 'customers.delete', 'customers', 'delete', 'Delete customers', NOW()),
('perm-purchasing-view', 'purchasing.view', 'purchasing', 'view', 'View purchase orders', NOW()),
('perm-purchasing-create', 'purchasing.create', 'purchasing', 'create', 'Create purchase orders', NOW()),
('perm-purchasing-approve', 'purchasing.approve', 'purchasing', 'approve', 'Approve purchase orders', NOW()),
('perm-finance-view', 'finance.view', 'finance', 'view', 'View financial reports', NOW()),
('perm-finance-manage', 'finance.manage', 'finance', 'manage', 'Manage financial settings', NOW()),
('perm-reports-view', 'reports.view', 'reporting', 'view', 'View reports', NOW()),
('perm-reports-export', 'reports.export', 'reporting', 'export', 'Export reports', NOW()),
('perm-users-view', 'users.view', 'security', 'view', 'View users', NOW()),
('perm-users-manage', 'users.manage', 'security', 'manage', 'Manage users and roles', NOW()),
('perm-audit-view', 'audit.view', 'security', 'view', 'View audit logs', NOW()),
('perm-approval-approve', 'approval.approve', 'security', 'approve', 'Approve requests', NOW()),
('perm-approval-reject', 'approval.reject', 'security', 'reject', 'Reject requests', NOW()),
('perm-settings-view', 'settings.view', 'settings', 'view', 'View settings', NOW()),
('perm-settings-edit', 'settings.edit', 'settings', 'edit', 'Edit system settings', NOW())
ON CONFLICT (id) DO NOTHING;

-- ============ SEED DATA: ROLES ============
INSERT INTO roles (id, code, name, description, permissions, is_system, created_at, updated_at, sync_status) VALUES (
  'role-admin',
  'admin',
  'Administrator',
  'Full system access with all permissions',
  ARRAY['perm-sales-view', 'perm-sales-create', 'perm-sales-edit', 'perm-sales-delete', 'perm-sales-void', 'perm-sales-refund', 'perm-inventory-view', 'perm-inventory-create', 'perm-inventory-edit', 'perm-inventory-delete', 'perm-inventory-adjust', 'perm-stock-transfer', 'perm-price-change', 'perm-customers-view', 'perm-customers-create', 'perm-customers-edit', 'perm-customers-delete', 'perm-purchasing-view', 'perm-purchasing-create', 'perm-purchasing-approve', 'perm-finance-view', 'perm-finance-manage', 'perm-reports-view', 'perm-reports-export', 'perm-users-view', 'perm-users-manage', 'perm-audit-view', 'perm-approval-approve', 'perm-approval-reject', 'perm-settings-view', 'perm-settings-edit'],
  true,
  NOW(),
  NOW(),
  'synced'
) ON CONFLICT (code) DO NOTHING;

INSERT INTO roles (id, code, name, description, permissions, is_system, created_at, updated_at, sync_status) VALUES (
  'role-manager',
  'manager',
  'Manager',
  'Store manager with sales, inventory, and approval permissions',
  ARRAY['perm-sales-view', 'perm-sales-create', 'perm-sales-edit', 'perm-sales-void', 'perm-sales-refund', 'perm-inventory-view', 'perm-inventory-create', 'perm-inventory-edit', 'perm-inventory-adjust', 'perm-stock-transfer', 'perm-price-change', 'perm-customers-view', 'perm-customers-create', 'perm-customers-edit', 'perm-purchasing-view', 'perm-purchasing-create', 'perm-purchasing-approve', 'perm-finance-view', 'perm-reports-view', 'perm-reports-export', 'perm-users-view', 'perm-audit-view', 'perm-approval-approve', 'perm-approval-reject', 'perm-settings-view'],
  true,
  NOW(),
  NOW(),
  'synced'
) ON CONFLICT (code) DO NOTHING;

INSERT INTO roles (id, code, name, description, permissions, is_system, created_at, updated_at, sync_status) VALUES (
  'role-cashier',
  'cashier',
  'Cashier',
  'Cashier with basic sales and customer permissions',
  ARRAY['perm-sales-view', 'perm-sales-create', 'perm-inventory-view', 'perm-customers-view', 'perm-customers-create', 'perm-reports-view'],
  true,
  NOW(),
  NOW(),
  'synced'
) ON CONFLICT (code) DO NOTHING;

-- ============ ROW LEVEL SECURITY ============
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_change_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE void_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "permissions_read" ON permissions FOR SELECT USING (true);
CREATE POLICY "permissions_write" ON permissions FOR ALL USING (true);
CREATE POLICY "roles_read" ON roles FOR SELECT USING (true);
CREATE POLICY "roles_write" ON roles FOR ALL USING (true);
CREATE POLICY "users_read" ON users FOR SELECT USING (true);
CREATE POLICY "users_write" ON users FOR ALL USING (true);
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "audit_logs_read" ON audit_logs FOR SELECT USING (true);
CREATE POLICY "approval_requests_all" ON approval_requests FOR ALL USING (true);
CREATE POLICY "approval_history_all" ON approval_history FOR ALL USING (true);
CREATE POLICY "login_history_all" ON login_history FOR ALL USING (true);
CREATE POLICY "security_events_all" ON security_events FOR ALL USING (true);
CREATE POLICY "price_change_all" ON price_change_history FOR ALL USING (true);
CREATE POLICY "void_requests_all" ON void_requests FOR ALL USING (true);
CREATE POLICY "refund_requests_all" ON refund_requests FOR ALL USING (true);

-- Add cashier fields to transactions
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'cashier_id') THEN
    ALTER TABLE transactions ADD COLUMN cashier_id TEXT;
    ALTER TABLE transactions ADD COLUMN cashier_name TEXT;
    ALTER TABLE transactions ADD COLUMN branch_id TEXT;
  END IF;
END $$;
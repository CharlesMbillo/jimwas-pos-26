// Security Types for RBAC, Audit Trail, and Approval Engine

// ============ PERMISSIONS ============

export type PermissionDomain =
  | 'sales'
  | 'inventory'
  | 'customers'
  | 'purchasing'
  | 'finance'
  | 'reporting'
  | 'security'
  | 'settings';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'void' | 'refund' | 'adjust' | 'transfer' | 'change' | 'manage' | 'export' | 'approve' | 'reject';

export interface Permission {
  id: string;
  name: string; // e.g., 'sales.void', 'inventory.adjust'
  domain: PermissionDomain;
  action: PermissionAction;
  description: string;
  created_at: string;
}

// All system permissions
export const PERMISSIONS: Permission[] = [
  // Sales
  { id: 'perm-sales-view', name: 'sales.view', domain: 'sales', action: 'view', description: 'View sales transactions', created_at: '' },
  { id: 'perm-sales-create', name: 'sales.create', domain: 'sales', action: 'create', description: 'Create new sales', created_at: '' },
  { id: 'perm-sales-edit', name: 'sales.edit', domain: 'sales', action: 'edit', description: 'Edit pending sales', created_at: '' },
  { id: 'perm-sales-delete', name: 'sales.delete', domain: 'sales', action: 'delete', description: 'Delete pending sales', created_at: '' },
  { id: 'perm-sales-void', name: 'sales.void', domain: 'sales', action: 'void', description: 'Void completed sales', created_at: '' },
  { id: 'perm-sales-refund', name: 'sales.refund', domain: 'sales', action: 'refund', description: 'Process refunds', created_at: '' },

  // Inventory
  { id: 'perm-inventory-view', name: 'inventory.view', domain: 'inventory', action: 'view', description: 'View inventory', created_at: '' },
  { id: 'perm-inventory-create', name: 'inventory.create', domain: 'inventory', action: 'create', description: 'Add new products', created_at: '' },
  { id: 'perm-inventory-edit', name: 'inventory.edit', domain: 'inventory', action: 'edit', description: 'Edit product details', created_at: '' },
  { id: 'perm-inventory-delete', name: 'inventory.delete', domain: 'inventory', action: 'delete', description: 'Delete products', created_at: '' },
  { id: 'perm-inventory-adjust', name: 'inventory.adjust', domain: 'inventory', action: 'adjust', description: 'Adjust stock levels', created_at: '' },

  // Stock
  { id: 'perm-stock-transfer', name: 'stock.transfer', domain: 'inventory', action: 'transfer', description: 'Transfer stock between branches', created_at: '' },

  // Price
  { id: 'perm-price-change', name: 'price.change', domain: 'inventory', action: 'change', description: 'Change product prices', created_at: '' },

  // Customers
  { id: 'perm-customers-view', name: 'customers.view', domain: 'customers', action: 'view', description: 'View customers', created_at: '' },
  { id: 'perm-customers-create', name: 'customers.create', domain: 'customers', action: 'create', description: 'Add new customers', created_at: '' },
  { id: 'perm-customers-edit', name: 'customers.edit', domain: 'customers', action: 'edit', description: 'Edit customer details', created_at: '' },
  { id: 'perm-customers-delete', name: 'customers.delete', domain: 'customers', action: 'delete', description: 'Delete customers', created_at: '' },

  // Purchasing
  { id: 'perm-purchasing-view', name: 'purchasing.view', domain: 'purchasing', action: 'view', description: 'View purchase orders', created_at: '' },
  { id: 'perm-purchasing-create', name: 'purchasing.create', domain: 'purchasing', action: 'create', description: 'Create purchase orders', created_at: '' },
  { id: 'perm-purchasing-approve', name: 'purchasing.approve', domain: 'purchasing', action: 'approve', description: 'Approve purchase orders', created_at: '' },

  // Finance
  { id: 'perm-finance-view', name: 'finance.view', domain: 'finance', action: 'view', description: 'View financial reports', created_at: '' },
  { id: 'perm-finance-manage', name: 'finance.manage', domain: 'finance', action: 'manage', description: 'Manage financial settings', created_at: '' },

  // Reporting
  { id: 'perm-reports-view', name: 'reports.view', domain: 'reporting', action: 'view', description: 'View reports', created_at: '' },
  { id: 'perm-reports-export', name: 'reports.export', domain: 'reporting', action: 'export', description: 'Export reports', created_at: '' },

  // Security
  { id: 'perm-users-view', name: 'users.view', domain: 'security', action: 'view', description: 'View users', created_at: '' },
  { id: 'perm-users-manage', name: 'users.manage', domain: 'security', action: 'manage', description: 'Manage users and roles', created_at: '' },
  { id: 'perm-audit-view', name: 'audit.view', domain: 'security', action: 'view', description: 'View audit logs', created_at: '' },
  { id: 'perm-approval-approve', name: 'approval.approve', domain: 'security', action: 'approve', description: 'Approve requests', created_at: '' },
  { id: 'perm-approval-reject', name: 'approval.reject', domain: 'security', action: 'reject', description: 'Reject requests', created_at: '' },

  // Settings
  { id: 'perm-settings-view', name: 'settings.view', domain: 'settings', action: 'view', description: 'View settings', created_at: '' },
  { id: 'perm-settings-edit', name: 'settings.edit', domain: 'settings', action: 'edit', description: 'Edit system settings', created_at: '' },
];

// ============ ROLES ============

export type RoleCode = 'admin' | 'manager' | 'cashier';

export interface Role {
  id: string;
  code: RoleCode;
  name: string;
  description: string;
  permissions: string[]; // Permission IDs
  is_system: boolean; // System roles cannot be deleted
  created_at: string;
  updated_at: string;
  sync_status: 'pending' | 'synced';
}

// Default role permission assignments
export const DEFAULT_ROLE_PERMISSIONS: Record<RoleCode, string[]> = {
  admin: PERMISSIONS.map(p => p.id), // Full access
  manager: [
    // Sales - full access
    'perm-sales-view', 'perm-sales-create', 'perm-sales-edit', 'perm-sales-void', 'perm-sales-refund',
    // Inventory - full access
    'perm-inventory-view', 'perm-inventory-create', 'perm-inventory-edit', 'perm-inventory-adjust',
    'perm-stock-transfer', 'perm-price-change',
    // Customers - full access
    'perm-customers-view', 'perm-customers-create', 'perm-customers-edit',
    // Purchasing
    'perm-purchasing-view', 'perm-purchasing-create', 'perm-purchasing-approve',
    // Finance
    'perm-finance-view',
    // Reports
    'perm-reports-view', 'perm-reports-export',
    // Security
    'perm-users-view', 'perm-audit-view', 'perm-approval-approve', 'perm-approval-reject',
    // Settings
    'perm-settings-view',
  ],
  cashier: [
    // Sales - basic access
    'perm-sales-view', 'perm-sales-create',
    // Inventory - view only
    'perm-inventory-view',
    // Customers - basic access
    'perm-customers-view', 'perm-customers-create',
    // Reports - view only
    'perm-reports-view',
  ],
};

// ============ USERS ============

export interface User {
  id: string;
  username: string;
  email: string;
  password_hash: string;
  full_name: string;
  role_id: string;
  role_code: RoleCode;
  branch_id?: string;
  branch_name?: string;
  is_active: boolean;
  last_login_at?: string;
  failed_login_attempts: number;
  locked_until?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  sync_status: 'pending' | 'synced';
}

export interface UserSession {
  id: string;
  user_id: string;
  user?: User;
  token: string;
  device_info: string;
  ip_address?: string;
  login_at: string;
  logout_at?: string;
  is_active: boolean;
}

// ============ AUDIT TRAIL ============

export type AuditEventType =
  // Sales events
  | 'SALE_CREATED'
  | 'SALE_COMPLETED'
  | 'SALE_VOIDED'
  | 'SALE_REFUNDED'
  | 'SALE_UPDATED'
  // Product events
  | 'PRODUCT_CREATED'
  | 'PRODUCT_UPDATED'
  | 'PRODUCT_DELETED'
  | 'PRODUCT_PRICE_CHANGED'
  | 'PRODUCT_ACTIVATED'
  | 'PRODUCT_DEACTIVATED'
  // Stock events
  | 'STOCK_ADDED'
  | 'STOCK_REMOVED'
  | 'STOCK_ADJUSTED'
  | 'STOCK_TRANSFERRED'
  | 'STOCK_LOST'
  | 'STOCK_EXPIRED'
  // Customer events
  | 'CUSTOMER_CREATED'
  | 'CUSTOMER_UPDATED'
  | 'CUSTOMER_DELETED'
  // User events
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DEACTIVATED'
  | 'USER_REACTIVATED'
  | 'USER_ROLE_CHANGED'
  | 'USER_PASSWORD_CHANGED'
  // Security events
  | 'LOGIN_SUCCESS'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'SESSION_EXPIRED'
  // Approval events
  | 'APPROVAL_REQUESTED'
  | 'APPROVAL_APPROVED'
  | 'APPROVAL_REJECTED'
  // Settings events
  | 'SETTINGS_CHANGED';

export interface AuditLog {
  id: string;
  event_type: AuditEventType;
  user_id: string;
  user_name: string;
  user_role: RoleCode;
  entity_type: string; // 'sale', 'product', 'customer', 'user', etc.
  entity_id: string;
  old_value?: string; // JSON string of previous state
  new_value?: string; // JSON string of new state
  reason?: string;
  branch_id?: string;
  branch_name?: string;
  device_info?: string;
  ip_address?: string;
  created_at: string;
  sync_status: 'pending' | 'synced';
}

// ============ APPROVALS ============

export type ApprovalRequestType =
  | 'SALE_VOID'
  | 'SALE_REFUND'
  | 'PRICE_CHANGE'
  | 'STOCK_ADJUSTMENT'
  | 'STOCK_TRANSFER'
  | 'PURCHASE_CANCELLATION'
  | 'USER_DEACTIVATION'
  | 'USER_ROLE_CHANGE';

export type ApprovalRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface ApprovalRequest {
  id: string;
  request_type: ApprovalRequestType;
  requester_id: string;
  requester_name: string;
  requester_role: RoleCode;
  entity_type: string;
  entity_id: string;
  request_data: string; // JSON string with relevant data
  reason: string;
  status: ApprovalRequestStatus;
  approver_id?: string;
  approver_name?: string;
  approved_at?: string;
  rejection_reason?: string;
  branch_id?: string;
  branch_name?: string;
  created_at: string;
  updated_at: string;
  sync_status: 'pending' | 'synced';
}

export interface ApprovalHistory {
  id: string;
  request_id: string;
  action: 'created' | 'approved' | 'rejected' | 'cancelled';
  actor_id: string;
  actor_name: string;
  actor_role: RoleCode;
  comment?: string;
  created_at: string;
}

// ============ LOGIN HISTORY ============

export interface LoginHistory {
  id: string;
  user_id: string;
  user_name: string;
  device_info: string; // Browser, OS
  ip_address?: string;
  login_at: string;
  logout_at?: string;
  session_duration_minutes?: number;
  login_status: 'success' | 'failed';
  failure_reason?: string;
  branch_id?: string;
  branch_name?: string;
  sync_status: 'pending' | 'synced';
}

// ============ SECURITY EVENTS ============

export type SecurityEventSeverity = 'low' | 'medium' | 'high' | 'critical';

export type SecurityEventType =
  | 'MULTIPLE_FAILED_LOGINS'
  | 'ACCOUNT_LOCKOUT'
  | 'SUSPICIOUS_VOID_PATTERN'
  | 'LARGE_STOCK_ADJUSTMENT'
  | 'LARGE_REFUND_AMOUNT'
  | 'FREQUENT_PRICE_CHANGES'
  | 'OFFLINE_DATA_SYNC_ANOMALY'
  | 'PERMISSION_ESCALATION_ATTEMPT'
  | 'UNAUTHORIZED_ACCESS_ATTEMPT';

export interface SecurityEvent {
  id: string;
  event_type: SecurityEventType;
  severity: SecurityEventSeverity;
  user_id?: string;
  user_name?: string;
  description: string;
  metadata: string; // JSON string with additional details
  branch_id?: string;
  branch_name?: string;
  is_resolved: boolean;
  resolved_by?: string;
  resolved_at?: string;
  created_at: string;
  sync_status: 'pending' | 'synced';
}

// ============ PRICE CHANGE HISTORY ============

export interface PriceChangeHistory {
  id: string;
  product_id: string;
  product_name: string;
  old_price: number;
  new_price: number;
  changed_by_id: string;
  changed_by_name: string;
  approved_by_id?: string;
  approved_by_name?: string;
  reason: string;
  approval_request_id?: string;
  branch_id?: string;
  branch_name?: string;
  created_at: string;
  sync_status: 'pending' | 'synced';
}

// ============ VOID/REFUND REQUESTS ============

export interface VoidRequest {
  id: string;
  transaction_id: string;
  transaction_total: number;
  requester_id: string;
  requester_name: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  approver_id?: string;
  approver_name?: string;
  approved_at?: string;
  rejection_reason?: string;
  approval_request_id?: string;
  branch_id?: string;
  branch_name?: string;
  created_at: string;
  updated_at: string;
  sync_status: 'pending' | 'synced';
}

export interface RefundRequest {
  id: string;
  transaction_id: string;
  refund_amount: number;
  requester_id: string;
  requester_name: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected' | 'completed';
  approver_id?: string;
  approver_name?: string;
  approved_at?: string;
  rejection_reason?: string;
  approval_request_id?: string;
  branch_id?: string;
  branch_name?: string;
  created_at: string;
  updated_at: string;
  sync_status: 'pending' | 'synced';
}

// ============ HELPER FUNCTIONS ============

export function getPermissionByName(name: string): Permission | undefined {
  return PERMISSIONS.find(p => p.name === name);
}

export function getPermissionsByDomain(domain: PermissionDomain): Permission[] {
  return PERMISSIONS.filter(p => p.domain === domain);
}

export function requiresApproval(action: ApprovalRequestType): boolean {
  const approvalRequiredActions: ApprovalRequestType[] = [
    'SALE_VOID',
    'SALE_REFUND',
    'PRICE_CHANGE',
    'STOCK_ADJUSTMENT',
    'STOCK_TRANSFER',
    'PURCHASE_CANCELLATION',
    'USER_DEACTIVATION',
    'USER_ROLE_CHANGE',
  ];
  return approvalRequiredActions.includes(action);
}

export function getApproverRolesForAction(action: ApprovalRequestType): RoleCode[] {
  // Most actions require manager or admin approval
  // Some critical actions require admin only
  const adminOnly: ApprovalRequestType[] = ['USER_DEACTIVATION', 'USER_ROLE_CHANGE'];

  if (adminOnly.includes(action)) {
    return ['admin'];
  }
  return ['admin', 'manager'];
}

export function formatPermissionName(name: string): string {
  const parts = name.split('.');
  const domain = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  const action = parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
  return `${domain}: ${action}`;
}

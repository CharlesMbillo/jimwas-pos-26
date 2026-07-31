// RBAC Configuration - Complete role hierarchy and permissions matrix

import { RoleCode } from './security-types';

// Route access control configuration
export interface RouteConfig {
  path: string;
  allowedRoles: RoleCode[];
  permissions?: string[]; // Additional permission checks beyond role
  requiresApproval?: boolean;
  description: string;
}

// Feature access control configuration
export interface FeatureConfig {
  featureName: string;
  requiredPermissions: string[];
  allowedRoles: RoleCode[];
  description: string;
}

// Component access control configuration
export interface ComponentConfig {
  componentName: string;
  allowedRoles: RoleCode[];
  requiredPermissions?: string[];
  description: string;
}

// Complete route access matrix
export const ROUTE_CONFIG: Record<string, RouteConfig> = {
  // Core POS
  'pos': {
    path: '/pos',
    allowedRoles: ['admin', 'manager', 'cashier'],
    permissions: ['sales.create', 'sales.view'],
    description: 'POS Terminal - Create and process sales',
  },

  // Customers
  'customers': {
    path: '/customers',
    allowedRoles: ['admin', 'manager', 'cashier'],
    permissions: ['customers.view'],
    description: 'Customer Management',
  },

  // Products & Inventory
  'products': {
    path: '/products',
    allowedRoles: ['admin', 'manager'],
    permissions: ['inventory.view'],
    description: 'Product Management',
  },

  'inventory': {
    path: '/inventory',
    allowedRoles: ['admin', 'manager'],
    permissions: ['inventory.view', 'inventory.adjust'],
    description: 'Inventory Management',
  },

  'installments': {
    path: '/installments',
    allowedRoles: ['admin', 'manager'],
    permissions: ['sales.view'],
    description: 'Installment Plans',
  },

  // Dashboard & Analytics
  'dashboard': {
    path: '/dashboard',
    allowedRoles: ['admin', 'manager'],
    permissions: ['reports.view', 'finance.view'],
    description: 'Executive Dashboard',
  },

  // Transactions
  'transactions': {
    path: '/transactions',
    allowedRoles: ['admin', 'manager', 'cashier'],
    permissions: ['sales.view', 'reports.view'],
    description: 'Transaction History & Analytics',
  },

  // Approvals & Admin
  'void-requests': {
    path: '/void-requests',
    allowedRoles: ['admin', 'manager'],
    permissions: ['approval.approve', 'approval.reject', 'sales.void'],
    requiresApproval: true,
    description: 'Void Request Approvals',
  },

  'security': {
    path: '/security',
    allowedRoles: ['admin'],
    permissions: ['users.manage', 'users.view', 'security.view'],
    description: 'Security Dashboard - User & Role Management',
  },

  'audit': {
    path: '/audit',
    allowedRoles: ['admin', 'manager'],
    permissions: ['audit.view'],
    description: 'Audit Trail & System Logs',
  },

  'settings': {
    path: '/settings',
    allowedRoles: ['admin', 'manager'],
    permissions: ['settings.view', 'settings.edit'],
    description: 'System Settings',
  },

  'backup': {
    path: '/backup',
    allowedRoles: ['admin'],
    permissions: ['settings.edit'],
    description: 'Backup & Restore',
  },

  'populate-db': {
    path: '/populate-db',
    allowedRoles: ['admin'],
    permissions: ['settings.edit'],
    description: 'Database Population (Dev Only)',
  },
};

// Feature-level access control
export const FEATURE_CONFIG: Record<string, FeatureConfig> = {
  // Sales Features
  'CREATE_SALE': {
    featureName: 'Create Sale',
    requiredPermissions: ['sales.create'],
    allowedRoles: ['admin', 'manager', 'cashier'],
    description: 'Create new sales transactions',
  },

  'VOID_SALE': {
    featureName: 'Void Sale',
    requiredPermissions: ['sales.void'],
    allowedRoles: ['admin', 'manager'],
    description: 'Void completed sales',
  },

  'REFUND_SALE': {
    featureName: 'Refund Sale',
    requiredPermissions: ['sales.refund'],
    allowedRoles: ['admin', 'manager'],
    description: 'Process refunds',
  },

  // Inventory Features
  'ADJUST_STOCK': {
    featureName: 'Adjust Stock',
    requiredPermissions: ['inventory.adjust'],
    allowedRoles: ['admin', 'manager'],
    description: 'Adjust inventory levels',
  },

  'TRANSFER_STOCK': {
    featureName: 'Transfer Stock',
    requiredPermissions: ['stock.transfer'],
    allowedRoles: ['admin', 'manager'],
    description: 'Transfer stock between locations',
  },

  'CHANGE_PRICE': {
    featureName: 'Change Price',
    requiredPermissions: ['price.change'],
    allowedRoles: ['admin', 'manager'],
    description: 'Change product prices',
  },

  // User Management
  'MANAGE_USERS': {
    featureName: 'Manage Users',
    requiredPermissions: ['users.manage'],
    allowedRoles: ['admin'],
    description: 'Create, edit, delete users',
  },

  'MANAGE_ROLES': {
    featureName: 'Manage Roles',
    requiredPermissions: ['users.manage'],
    allowedRoles: ['admin'],
    description: 'Manage roles and permissions',
  },

  // Approvals
  'APPROVE_REQUEST': {
    featureName: 'Approve Request',
    requiredPermissions: ['approval.approve'],
    allowedRoles: ['admin', 'manager'],
    description: 'Approve pending requests',
  },

  'REJECT_REQUEST': {
    featureName: 'Reject Request',
    requiredPermissions: ['approval.reject'],
    allowedRoles: ['admin', 'manager'],
    description: 'Reject pending requests',
  },

  // Finance
  'VIEW_FINANCE': {
    featureName: 'View Finance',
    requiredPermissions: ['finance.view'],
    allowedRoles: ['admin', 'manager'],
    description: 'View financial reports',
  },

  'MANAGE_FINANCE': {
    featureName: 'Manage Finance',
    requiredPermissions: ['finance.manage'],
    allowedRoles: ['admin'],
    description: 'Manage financial settings',
  },

  // Reports
  'VIEW_REPORTS': {
    featureName: 'View Reports',
    requiredPermissions: ['reports.view'],
    allowedRoles: ['admin', 'manager', 'cashier'],
    description: 'View reports',
  },

  'EXPORT_REPORTS': {
    featureName: 'Export Reports',
    requiredPermissions: ['reports.export'],
    allowedRoles: ['admin', 'manager'],
    description: 'Export report data',
  },

  // Audit
  'VIEW_AUDIT': {
    featureName: 'View Audit',
    requiredPermissions: ['audit.view'],
    allowedRoles: ['admin', 'manager'],
    description: 'View audit logs',
  },

  // Settings
  'VIEW_SETTINGS': {
    featureName: 'View Settings',
    requiredPermissions: ['settings.view'],
    allowedRoles: ['admin', 'manager'],
    description: 'View system settings',
  },

  'EDIT_SETTINGS': {
    featureName: 'Edit Settings',
    requiredPermissions: ['settings.edit'],
    allowedRoles: ['admin'],
    description: 'Edit system settings',
  },
};

// Component-level access control
export const COMPONENT_CONFIG: Record<string, ComponentConfig> = {
  // Navigation Components
  'POSNavItem': {
    componentName: 'POS Navigation',
    allowedRoles: ['admin', 'manager', 'cashier'],
    requiredPermissions: ['sales.view'],
    description: 'Show POS in navigation',
  },

  'CustomerNavItem': {
    componentName: 'Customers Navigation',
    allowedRoles: ['admin', 'manager', 'cashier'],
    requiredPermissions: ['customers.view'],
    description: 'Show Customers in navigation',
  },

  'ProductsNavItem': {
    componentName: 'Products Navigation',
    allowedRoles: ['admin', 'manager'],
    requiredPermissions: ['inventory.view'],
    description: 'Show Products in navigation',
  },

  'InventoryNavItem': {
    componentName: 'Inventory Navigation',
    allowedRoles: ['admin', 'manager'],
    requiredPermissions: ['inventory.view'],
    description: 'Show Inventory in navigation',
  },

  'DashboardNavItem': {
    componentName: 'Dashboard Navigation',
    allowedRoles: ['admin', 'manager'],
    requiredPermissions: ['reports.view'],
    description: 'Show Dashboard in navigation',
  },

  'TransactionsNavItem': {
    componentName: 'Transactions Navigation',
    allowedRoles: ['admin', 'manager', 'cashier'],
    requiredPermissions: ['sales.view'],
    description: 'Show Transactions in navigation',
  },

  'SecurityNavItem': {
    componentName: 'Security Navigation',
    allowedRoles: ['admin'],
    requiredPermissions: ['users.manage'],
    description: 'Show Security in navigation',
  },

  'AuditNavItem': {
    componentName: 'Audit Navigation',
    allowedRoles: ['admin', 'manager'],
    requiredPermissions: ['audit.view'],
    description: 'Show Audit in navigation',
  },

  'SettingsNavItem': {
    componentName: 'Settings Navigation',
    allowedRoles: ['admin', 'manager'],
    requiredPermissions: ['settings.view'],
    description: 'Show Settings in navigation',
  },

  // Feature Components
  'VoidSaleButton': {
    componentName: 'Void Sale Button',
    allowedRoles: ['admin', 'manager'],
    requiredPermissions: ['sales.void'],
    description: 'Show void sale button',
  },

  'RefundButton': {
    componentName: 'Refund Button',
    allowedRoles: ['admin', 'manager'],
    requiredPermissions: ['sales.refund'],
    description: 'Show refund button',
  },

  'AdjustStockButton': {
    componentName: 'Adjust Stock Button',
    allowedRoles: ['admin', 'manager'],
    requiredPermissions: ['inventory.adjust'],
    description: 'Show stock adjustment button',
  },

  'ChangePrice': {
    componentName: 'Change Price Component',
    allowedRoles: ['admin', 'manager'],
    requiredPermissions: ['price.change'],
    description: 'Show price change functionality',
  },

  'ApproveButton': {
    componentName: 'Approve Request Button',
    allowedRoles: ['admin', 'manager'],
    requiredPermissions: ['approval.approve'],
    description: 'Show approve button',
  },

  'RejectButton': {
    componentName: 'Reject Request Button',
    allowedRoles: ['admin', 'manager'],
    requiredPermissions: ['approval.reject'],
    description: 'Show reject button',
  },

  'ExportButton': {
    componentName: 'Export Button',
    allowedRoles: ['admin', 'manager'],
    requiredPermissions: ['reports.export'],
    description: 'Show export button',
  },

  'UserManagement': {
    componentName: 'User Management Component',
    allowedRoles: ['admin'],
    requiredPermissions: ['users.manage'],
    description: 'Show user management controls',
  },

  'RoleManagement': {
    componentName: 'Role Management Component',
    allowedRoles: ['admin'],
    requiredPermissions: ['users.manage'],
    description: 'Show role management controls',
  },
};

// Helper functions
export function canAccessRoute(roleCode: RoleCode, routePath: string): boolean {
  const route = Object.values(ROUTE_CONFIG).find(r => r.path === routePath);
  if (!route) return false;
  return route.allowedRoles.includes(roleCode);
}

export function canUseFeature(roleCode: RoleCode, featureName: string): boolean {
  const feature = FEATURE_CONFIG[featureName];
  if (!feature) return false;
  return feature.allowedRoles.includes(roleCode);
}

export function canRenderComponent(roleCode: RoleCode, componentName: string): boolean {
  const component = COMPONENT_CONFIG[componentName];
  if (!component) return false;
  return component.allowedRoles.includes(roleCode);
}

export function getRouteConfig(routePath: string): RouteConfig | undefined {
  return Object.values(ROUTE_CONFIG).find(r => r.path === routePath);
}

export function getFeatureConfig(featureName: string): FeatureConfig | undefined {
  return FEATURE_CONFIG[featureName];
}

export function getComponentConfig(componentName: string): ComponentConfig | undefined {
  return COMPONENT_CONFIG[componentName];
}

// Get all routes available to a role
export function getAccessibleRoutes(roleCode: RoleCode): RouteConfig[] {
  return Object.values(ROUTE_CONFIG).filter(r => r.allowedRoles.includes(roleCode));
}

// Get all features available to a role
export function getAvailableFeatures(roleCode: RoleCode): FeatureConfig[] {
  return Object.values(FEATURE_CONFIG).filter(f => f.allowedRoles.includes(roleCode));
}

// Get all components that should be visible to a role
export function getVisibleComponents(roleCode: RoleCode): ComponentConfig[] {
  return Object.values(COMPONENT_CONFIG).filter(c => c.allowedRoles.includes(roleCode));
}

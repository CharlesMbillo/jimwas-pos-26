# Role-Based Access Control (RBAC) - Complete Implementation Guide

## Overview

The Jimwas POS system now has a fully implemented RBAC system with multi-layer protection:
1. **Route-level access control** - Protects entire pages/features
2. **Component-level access control** - Controls visibility of UI elements
3. **Feature-level access control** - Protects specific functionality
4. **Permission-based enforcement** - Fine-grained permission checking

## Role Hierarchy

### Admin
- Full system access
- All permissions granted
- Can manage users and roles
- Can approve all requests
- Access: All routes, all features, all components

### Manager
- Business operations management
- Sales, inventory, and customer management
- Can approve void/refund requests
- Limited security access
- Cannot manage users or system settings
- Access: POS, Customers, Products, Inventory, Transactions, Approvals, Audit

### Cashier
- Point of Sale operations only
- Can create sales transactions
- Can view transaction history
- Limited to sales operations
- Cannot void sales or manage inventory
- Access: POS, Customers, Transactions

## Permissions Matrix

### Sales Permissions
- `sales.view` - View sales transactions
- `sales.create` - Create new sales
- `sales.edit` - Edit pending sales
- `sales.delete` - Delete pending sales
- `sales.void` - Void completed sales (Manager/Admin only)
- `sales.refund` - Process refunds (Manager/Admin only)

### Inventory Permissions
- `inventory.view` - View inventory
- `inventory.create` - Add new products
- `inventory.edit` - Edit product details
- `inventory.delete` - Delete products
- `inventory.adjust` - Adjust stock levels
- `stock.transfer` - Transfer stock between branches
- `price.change` - Change product prices

### Customer Permissions
- `customers.view` - View customers
- `customers.create` - Add new customers
- `customers.edit` - Edit customer details
- `customers.delete` - Delete customers

### Purchasing Permissions
- `purchasing.view` - View purchase orders
- `purchasing.create` - Create purchase orders
- `purchasing.approve` - Approve purchase orders

### Finance Permissions
- `finance.view` - View financial reports
- `finance.manage` - Manage financial settings

### Security Permissions
- `users.view` - View users
- `users.manage` - Manage users and roles (Admin only)
- `audit.view` - View audit logs
- `approval.approve` - Approve requests
- `approval.reject` - Reject requests

### Settings Permissions
- `settings.view` - View system settings
- `settings.edit` - Edit system settings (Admin only)

### Reporting Permissions
- `reports.view` - View reports
- `reports.export` - Export reports

## Implementation Architecture

### Core Files

1. **security-types.ts** - Type definitions for roles, permissions, users
2. **permissions.ts** - Permission checking and caching
3. **rbac-config.ts** - Route, feature, and component access configuration
4. **rbac-enforcement.ts** - Enforcement layer with audit logging
5. **ProtectedRoute.tsx** - Route, component, and feature guards
6. **AuthContext.tsx** - Authentication context with permission guards

### Protected Component Usage

#### Route Protection
```tsx
import { ProtectedRoute } from './components/ProtectedRoute';

<ProtectedRoute routePath="/admin" fallback={<AccessDenied />}>
  <AdminPage />
</ProtectedRoute>
```

#### Component Protection
```tsx
import { ComponentGuard } from './components/ProtectedRoute';

<ComponentGuard componentName="UserManagement">
  <UserManagementUI />
</ComponentGuard>
```

#### Feature Protection
```tsx
import { FeatureGuard } from './components/ProtectedRoute';

<FeatureGuard featureName="VOID_SALE" showError>
  <VoidSaleButton />
</FeatureGuard>
```

### Enforcement Layer

#### Route-Level Enforcement
```tsx
import { enforceRouteAccess } from '../lib/rbac-enforcement';

const result = await enforceRouteAccess(user, '/admin');
if (!result.allowed) {
  console.log(result.reason);
}
```

#### Feature-Level Enforcement
```tsx
import { enforceFeatureAccess } from '../lib/rbac-enforcement';

const result = await enforceFeatureAccess(user, 'VOID_SALE');
if (!result.allowed) {
  console.log(result.reason);
}
```

#### Action-Level Enforcement
```tsx
import { enforceActionAccess } from '../lib/rbac-enforcement';

const result = await enforceActionAccess(user, 'void_transaction', ['sales.void']);
if (!result.allowed) {
  console.log(result.reason);
}
```

## Access Control Rules

### Route Access Control
- **POS** - Admin, Manager, Cashier (with sales.view permission)
- **Customers** - Admin, Manager, Cashier (with customers.view)
- **Products** - Admin, Manager only
- **Inventory** - Admin, Manager only
- **Dashboard** - Admin, Manager only
- **Transactions** - Admin, Manager, Cashier (with reports.view)
- **Void Requests** - Admin, Manager only (with approval.approve)
- **Security** - Admin only (with users.manage)
- **Audit** - Admin, Manager only (with audit.view)
- **Settings** - Admin, Manager only
- **Backup** - Admin only (with settings.edit)

### Component Access Control
- Navigation items filtered by role
- Action buttons hidden from unauthorized users
- Form fields disabled for read-only roles
- Admin-only controls hidden from other roles

### Feature Access Control
- Create Sale - Cashier, Manager, Admin
- Void Sale - Manager, Admin only
- Adjust Stock - Manager, Admin only
- Approve Requests - Manager, Admin only
- Manage Users - Admin only
- Export Reports - Manager, Admin only

## Approval Workflow

High-risk actions require approval by Manager or Admin:
1. Sale Void - Requires approval from manager/admin
2. Refund - Requires approval from manager/admin
3. Price Change - Requires approval from manager/admin
4. Stock Adjustment - Requires approval from manager/admin
5. User Deactivation - Requires admin approval
6. User Role Change - Requires admin approval

## Security Features

### Permission Caching
- User permissions cached in memory for performance
- Cache cleared when user role changes
- Automatic cache management

### Audit Trail
- All permission checks logged with:
  - User information
  - Action attempted
  - Resource accessed
  - Timestamp
  - Success/failure status

### Authorization Hierarchy
- Admin > Manager > Cashier
- More senior roles have all permissions of junior roles plus additional permissions
- Cannot elevate own permissions

## Testing RBAC

### Test as Cashier
- Can see: POS, Customers, Transactions
- Cannot see: Products, Inventory, Security, Audit
- Cannot perform: Void, Adjust Stock, Approve

### Test as Manager
- Can see: All areas except Security and Backup
- Can perform: All sales operations, inventory management, approvals
- Cannot see: User management, system settings

### Test as Admin
- Full access to all areas
- Can manage users and roles
- Can approve all requests
- Can edit system settings

## Best Practices

1. **Always use ProtectedRoute for new pages** - Ensures access control
2. **Use FeatureGuard for action buttons** - Hide unavailable actions
3. **Check permissions before API calls** - Prevent unauthorized requests
4. **Log all access attempts** - Maintain audit trail
5. **Keep role definitions simple** - Avoid complex hierarchies
6. **Test with different roles** - Verify access control works
7. **Document permission requirements** - Clear for future developers

## Troubleshooting

### Access Denied to Route
- Check user role in security settings
- Verify route configuration in rbac-config.ts
- Check required permissions are granted

### Button/Component Not Visible
- Verify ComponentGuard is correctly configured
- Check user role has required permissions
- Look at browser console for RBAC warnings

### Permission Check Failing
- Verify permission name matches security-types.ts
- Check user role has permission assigned
- Clear permission cache if recently changed

## Migration Guide

If adding new routes, features, or components:

1. Define in rbac-config.ts
2. Add to ROUTE_CONFIG, FEATURE_CONFIG, or COMPONENT_CONFIG
3. Wrap with ProtectedRoute/ComponentGuard/FeatureGuard
4. Test with different roles
5. Update this documentation


# RBAC UI Enhancements & Voiding Feature

## Overview
This document describes the role-based access control (RBAC) UI enhancements and the new transaction voiding feature added to Jimwas Enterprises POS.

## New Components

### 1. VoidTransactionModal.tsx
**Location:** `/src/components/VoidTransactionModal.tsx`

A modal component for submitting transaction void requests with the following features:
- Transaction details display (ID, amount, payment method, timestamp)
- Warning message about void consequences
- Reason input field (required) for audit trail
- Approval workflow integration (creates approval request)
- Real-time submission feedback
- Respects user permissions before enabling void

**Props:**
- `transaction: Transaction | null` - The transaction to void
- `isOpen: boolean` - Modal visibility state
- `onClose: () => void` - Close handler
- `onVoidComplete: () => void` - Callback after successful submission

### 2. RBACTransactionHistory.tsx
**Location:** `/src/components/RBACTransactionHistory.tsx`

RBAC-aware transaction history component showing:
- Complete transaction list with sorting by date
- Transaction details: ID, amount, payment method, status
- Role-based actions:
  - Managers/Admins with `sales.void` permission see void buttons
  - Cashiers/other roles see view-only interface
- Visual permission indicators (lock icon for restricted access)
- Void button only appears for completed transactions
- Integration with VoidTransactionModal for void submission

**Features:**
- Permission checking via `hasPermission()` utility
- Real-time transaction loading
- Status badges for completed/voided/pending transactions
- Modal integration for void workflow

### 3. VoidRequestsPage.tsx
**Location:** `/src/routes/void-requests.tsx`

Admin/Manager approval dashboard for pending void requests:
- **Stats Dashboard:**
  - Pending void requests count
  - Approved voids count
  - Rejected voids count
  
- **Void Request Management:**
  - Transaction ID and amount display
  - Requester information
  - Reason provided by requester
  - Status badges (Pending/Approved/Rejected)
  
- **Approval Workflow:**
  - Review modal for detailed assessment
  - Notes input for approval decisions
  - Approve/Reject buttons
  - Audit trail logging of decisions
  - Role guard restricts to admin/manager only

**Access:** Only accessible to users with `approval.approve` permission

## RBAC Implementation

### Permission System
The system uses a granular permission model with the following void-related permissions:

```typescript
// Permission Structure
{
  domain: 'sales',
  action: 'void',
  name: 'sales.void'
}
```

### Role Hierarchy
- **Admin:** Can void any transaction and approve all void requests
- **Manager:** Can void transactions up to manager limits and approve void requests
- **Cashier:** View-only access to transaction history
- **Supervisors:** Can create void requests

### Permission Checks
```typescript
// Check if user can void transactions
const canVoid = await hasPermission(user.id, 'sales.void');

// Check if user can approve voids
const canApprove = await hasPermission(user.id, 'approval.approve');
```

## Workflow: Transaction Voiding

### Step 1: Request Creation
1. Cashier/User creates a sale
2. After completion, admin/manager initiates void via VoidTransactionModal
3. Required to provide reason for audit trail
4. Void request is created and stored in `void_requests` table

### Step 2: Approval
1. Request moves to Void Requests page (admin/manager only)
2. Approver reviews:
   - Original transaction details
   - Reason for void
   - Impact (inventory, loyalty points, etc.)
3. Approver approves or rejects with notes

### Step 3: Execution
1. Upon approval:
   - Transaction marked as `voided`
   - Inventory levels restored
   - Loyalty points reversed (if applicable)
   - Payment reversed (if applicable)
   
2. Audit log created with:
   - Original requester
   - Approver
   - Timestamp
   - Reason
   - Impact summary

### Step 4: Visibility
- Voided transactions appear in history with "Voided" status badge
- Transaction details remain visible for audit purposes
- Cannot be re-voided (immutable state)

## Database Schema

### void_requests Table
```sql
CREATE TABLE void_requests (
  id TEXT PRIMARY KEY,
  transaction_id TEXT NOT NULL,
  transaction_amount REAL NOT NULL,
  requester_id TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  requester_role TEXT NOT NULL,
  reason TEXT NOT NULL,
  approval_request_id TEXT NOT NULL,
  status TEXT NOT NULL, -- pending, approved, rejected
  approver_id TEXT,
  approver_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### approval_requests Table (Extended)
```sql
-- Existing table used for void approval workflow
-- request_type: SALE_VOID
-- entity_type: transaction
-- entity_id: transaction_id
```

## UI/UX Enhancements

### Navigation Changes
- Added "Void Approvals" menu item in Layout (admin/manager only)
- Menu icon: AlertCircle (red warning indicator)
- Positioned in More menu with other approval-related items

### Color Coding
- **Void Actions:** Red (#dc2626) for warning/danger
- **Approved:** Green (#16a34a) for success
- **Pending:** Yellow (#ca8a04) for attention
- **Rejected:** Red (#dc2626) for blocked

### Permission Indicators
- Lock icon shows when user lacks permission
- Buttons disabled for unauthorized users
- "View only" badge for restricted roles
- "Can void" badge for authorized users

## Integration Points

### 1. Approval Workflow
- Uses existing `createApprovalRequest()` function
- Integrated with `approveRequest()` and `rejectRequest()`
- Respects approval chains (manager/admin only)

### 2. Audit Trail
- Logs void requests via `logApprovalRequested()`
- Logs approvals via `logApprovalApproved()`
- Logs rejections via `logApprovalRejected()`
- Records in `audit_logs` table

### 3. Database
- Stores void requests in IndexedDB
- Syncs to Supabase when online
- Respects sync status (pending/synced)

### 4. Permissions
- Uses `hasPermission()` to check capabilities
- Checks role-based access control
- Caches permission results for performance

## Usage Examples

### For Cashiers/Sellers
1. Complete a sale in POS Terminal
2. If mistake occurs, cannot directly void
3. Notifies admin/manager to request void

### For Managers/Admins
1. Access POS Terminal
2. Locate completed transaction
3. Click "Void" button in transaction history
4. Modal opens with void form
5. Provide reason and submit
6. Approval request created

### For Approvers (Manager/Admin)
1. Navigate to "Void Approvals" in menu
2. See pending void requests
3. Review transaction and reason
4. Click "Review" button
5. Modal shows approval form
6. Add notes and approve/reject
7. Changes reflected immediately

## Security Considerations

### Audit Trail
- All void requests logged with requester identity
- All approvals/rejections logged
- Immutable audit records for compliance

### Permission Model
- Void creation requires specific permission
- Void approval requires higher permission
- Two-person rule enforced (requester ≠ approver)

### Data Integrity
- Transactions remain visible after voiding
- Cannot be voided twice
- Original payment method preserved in audit

## Testing Checklist

- [ ] User without void permission cannot void transactions
- [ ] Void button only appears for completed transactions
- [ ] Void modal requires reason before submission
- [ ] Void request appears in Void Approvals page
- [ ] Approver can review and approve void
- [ ] Approver can reject with reason
- [ ] Voided transaction status updates correctly
- [ ] Audit logs capture all actions
- [ ] Void Approvals page only accessible to admin/manager
- [ ] UI respects responsive design on mobile

## Future Enhancements

1. **Partial Voids:** Allow voiding portion of transaction
2. **Bulk Voids:** Approve multiple voids at once
3. **Void Templates:** Pre-configured reasons for common voids
4. **Analytics:** Dashboard of void patterns and reasons
5. **Notifications:** Real-time alerts for pending approvals
6. **Delegation:** Approvers can delegate to other managers
7. **Time Limits:** Auto-reject voids after X hours without approval

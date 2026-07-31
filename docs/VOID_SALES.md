# Void Sales Feature Guide

## Overview
The Jimwas POS system includes a comprehensive void sales workflow that requires approval from managers/admins before voiding transactions. This ensures financial integrity and maintains an audit trail.

## Access Control
- **Who can void:** Users with `void_transaction` permission (Manager/Admin roles)
- **Where to access:** Transactions Dashboard → Void button on successful sales
- **Approval required:** Yes (Manager/Admin approval needed)

## Void Sales Workflow

### Step 1: Access Transactions Dashboard
1. Navigate to **Transactions** from the main menu
2. Look for completed sales (status = "success")
3. Hover over a transaction to reveal action buttons

### Step 2: Click Void Button
- Only visible for:
  - Sale transactions (type = 'sale')
  - With success status
  - If you have `void_transaction` permission
- Red trash icon indicates void action

### Step 3: Submit Void Request
1. Modal opens with transaction details:
   - Transaction ID
   - Amount
   - Payment method
   - Original timestamp
2. **Enter Reason** (required):
   - Explain why transaction is being voided
   - Examples:
     - "Customer returned items - wrong quantity"
     - "Duplicate transaction entry"
     - "Processing error - customer overpaid"
3. Click **"Submit Void Request"**

### Step 4: Manager Approval
- Void request goes to **Void Approvals** page
- Only Manager/Admin users can approve/reject
- Access via: **Void Approvals** in the More menu

#### Approval Process:
1. Navigate to **Void Approvals**
2. Review pending void requests
3. Click **"Review"** on request
4. Modal shows:
   - Transaction details
   - Original void reason
   - Space for approval notes
5. Choose:
   - **Approve** - Void is processed
   - **Reject** - Transaction remains active

### Step 5: Transaction Reversal
Once approved, the system:
- Reverses the transaction
- Restores inventory levels
- Refunds loyalty points (if applicable)
- Creates void record in transaction history
- Logs action in audit trail
- Records approver's name and timestamp

## Void Effects

When a sale is voided:
| Item | Effect |
|------|--------|
| Inventory | Restored to pre-sale levels |
| Customer Points | Refunded if awarded |
| Ledger | Transaction reversed with negative entry |
| Receipt | Marked as VOIDED in history |
| Payment | Cash refunded, KCB reversed via API |
| Audit Log | Complete record of void and approval |

## View Void History
- Navigate to **Transactions**
- Filter by Type = "Voids"
- Shows all voided transactions with:
  - Original transaction ID
  - Void reason
  - Approver name
  - Approval timestamp

## Permissions
```
Required Permission: void_transaction
Roles with permission: Admin, Manager
Default Denied: Cashier, Attendant
```

## Restrictions
- Cannot void pending transactions
- Cannot void failed transactions
- Cannot void already-voided transactions
- Cannot void KCB payments (must use KCB reversal)
- Cannot void transactions older than 30 days (audit policy)

## Audit Trail
All void operations are logged with:
- Void requester name and ID
- Approval/rejection details
- Timestamp of each action
- Reason provided
- Approver notes
- IP address (if applicable)

## Troubleshooting

### "No void button visible"
- Transaction hasn't been marked as success yet
- You don't have `void_transaction` permission
- User role doesn't have manager/admin privileges

### "Void request stuck in pending"
- No manager/admin available to approve
- Check Void Approvals page for status
- Contact system administrator

### "Void rejected"
- Manager may have concerns about the reason
- Check rejection notes for details
- Submit new void request if needed

## Best Practices
1. **Provide clear reasons** - Helps managers approve quickly
2. **Void immediately** - Don't delay voiding incorrect sales
3. **Check inventory** - Ensure restored inventory is accurate
4. **Verify payments** - Confirm refunds processed for KCB payments
5. **Document issues** - Use void reason field for accountability

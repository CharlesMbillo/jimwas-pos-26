# Jimwas Enterprises - Data Storage Guide

## Overview
Jimwas Enterprises uses a **hybrid offline-first architecture** with local IndexedDB storage and cloud Supabase sync.

## Data Storage Locations

### 1. **Browser IndexedDB (Local Storage)**
**Location:** Browser's Local Storage (per device/browser)

**Database Name:** `jimwas-pos-db`

**Purpose:** Primary local data store for offline-first functionality

**Stores:**
- `users` - User accounts and authentication
- `roles` - Role definitions and permissions
- `permissions` - Permission mappings
- `customers` - Customer records with loyalty points
- `products` - Product catalog with stock levels
- `transactions` - POS transactions and sales records
- `installments` - Installment plans and payment schedules
- `installment_payments` - Payment history for installments
- `mpesa_payments` - M-Pesa payment records and transaction history
- `audit_logs` - Audit trail for compliance
- `approval_requests` - Approval workflow records
- `approval_history` - Approval decision history
- `login_history` - User login records
- `security_events` - Security-related events
- `price_change_history` - Product price change tracking
- `void_requests` - Transaction void requests
- `refund_requests` - Refund request records
- `business_settings` - Business configuration
- `mpesa_settings` - M-Pesa API credentials and config
- `payment_methods` - Payment method configurations
- `loyalty_settings` - Loyalty program settings
- `receipt_settings` - Receipt format settings
- `ledger_entries` - Financial ledger records
- `expense_categories` - Expense category definitions
- `sync_queue` - Pending operations awaiting sync

**Access:** `src/lib/db.ts` - Database operations library

### 2. **Supabase Cloud Database**
**Location:** Cloud (Supabase hosted PostgreSQL)

**Configuration:** 
- URL: `VITE_SUPABASE_URL` (environment variable)
- Key: `VITE_SUPABASE_ANON_KEY` (environment variable)
- Current instances:
  - Primary: `sb-4iuu9ihy54t7.vercel.run`
  - Secondary: `sb-3681kiq7srv.vercel.run`

**Purpose:** Cloud backup and multi-device sync

**Tables (Mirror of IndexedDB):**
- Same schema as IndexedDB stores
- Real-time sync when online
- Maintains 'sync_status' field for conflict resolution

**Access:** `src/lib/sync.ts` - Synchronization library

### 3. **Backup Data Files**
**Location:** `src/data/` directory

**Files:**
- `jimwas-backup-2026-06-15_(1).json` (~163KB)
- `jimwas-backup-2026-06-30.json` (~155KB)

**Format:** JSON backup files for disaster recovery

**Contents:**
```json
{
  "products": [...],
  "customers": [...],
  "transactions": [...],
  "installments": [...],
  "settings": {...}
}
```

**Purpose:** 
- Restore points for data recovery
- Data migration between systems
- Analysis and reporting
- Manual backups created via Settings page

**Access:** `src/routes/backup.tsx` - Backup management UI

### 4. **Environment Variables**
**Location:** `.env.development.local`

**Configuration Variables:**
```
AI_GATEWAY_API_KEY=vck_6j2LOKF4hKx80blovSFbcRpV0BbQgsUVyTL6jAznrA14pGKxdZ3fb1Od
VITE_SUPABASE_URL=https://sb-4iuu9ihy54t7.vercel.run
VITE_SUPABASE_ANON_KEY=...
V0_RUNTIME_URL=https://vm-6mj460mpy3q7ymlulaxuv2nj.vusercontent.net
V0_CALLBACK_URL=https://callback.v0.app/?...
```

**Access:** `import.meta.env.*` in TypeScript code

## Data Structure

### IndexedDB Schema

Each store contains these common fields:

```typescript
{
  id: string;                    // Unique identifier
  sync_status: 'pending' | 'synced';  // Sync state
  created_at?: string;           // Creation timestamp
  updated_at?: string;           // Last update timestamp
  // ... store-specific fields
}
```

### IndexedDB Indexes

Used for efficient querying:

**Customers:**
- `by-phone` - Quick customer lookup by phone

**Products:**
- `by-category` - Filter by product category
- `by-sku` - SKU-based product lookup
- `by-low-stock` - Low stock alerts

**Transactions:**
- `by-date` - Sales history filtering
- `by-customer` - Customer transaction history
- `by-status` - Transaction status filtering

**M-Pesa Payments:**
- `by-transaction` - Link to sales records
- `by-phone` - Customer phone lookup
- `by-status` - Payment status filtering
- `by-created-at` - Date range queries

**Audit Logs:**
- `by-user` - User activity tracking
- `by-entity-type` - Entity-specific audit
- `by-timestamp` - Time-based filtering

## Sync Architecture

### Online Flow
1. User performs action (sale, payment, etc.)
2. Data saved to local IndexedDB
3. Auto-sync triggered if online
4. Data pushed to Supabase
5. `sync_status` changed to 'synced'

### Offline Flow
1. User performs action
2. Data saved to local IndexedDB
3. Operation queued in `sync_queue`
4. UI shows "Offline" indicator
5. When online restored:
   - Pending operations processed
   - Conflicts resolved
   - Data synced to cloud
   - UI updates to "Synced"

### Sync Queue
**Store:** `sync_queue` (IndexedDB)

**Contents:**
```typescript
{
  id: string;
  operation: 'create' | 'update' | 'delete';
  store: string;           // Store name (e.g., 'transactions')
  data: unknown;           // Data to sync
  timestamp: string;
  attempts: number;        // Retry count
}
```

## Querying Data

### Local Queries (IndexedDB)
```typescript
import { 
  getAllTransactions, 
  getCustomersByPhone,
  getMpesaPaymentsByStatus 
} from './lib/db';

// Get all transactions
const transactions = await getAllTransactions();

// Get by index
const customer = await db.getFromIndex('customers', 'by-phone', '254712345678');
```

### Cloud Queries (Supabase)
```typescript
import { getSupabase } from './lib/sync';

const supabase = getSupabase();
const { data } = await supabase
  .from('transactions')
  .select('*')
  .eq('status', 'completed');
```

## Data Retention & Cleanup

### Auto-purge Policies
- **Transaction history:** 2+ years retained locally, older moved to archive
- **Login history:** 90 days retained
- **Security events:** 1 year retained
- **Audit logs:** 3 years retained (compliance requirement)

### Manual Cleanup
Via Settings > Data Management:
- Clear transaction history
- Delete customer records
- Archive old data
- Export before deletion

## Backup & Recovery

### Automatic Backups
- Created: On system shutdown
- Location: `src/data/`
- Format: JSON
- Size: ~155-160KB typical

### Manual Backups
- Via: Settings > Backup > Export Backup
- Users can download full backup as JSON
- Timestamped filename: `jimwas-backup-YYYY-MM-DD.json`

### Restore Process
1. Go to: Settings > Backup > Import Backup
2. Upload JSON file
3. Select restore options:
   - Overwrite existing (or merge)
   - Include/exclude audit logs
   - Include/exclude user records
4. Confirm restore
5. System auto-syncs with cloud

## M-Pesa Payment Data

### Storage
**Location:** IndexedDB `mpesa_payments` store

**Fields:**
- `id` - Unique payment ID
- `transaction_id` - Links to POS transaction
- `phone` - Customer M-Pesa phone number
- `amount` - Payment amount in KES
- `mpesa_receipt_number` - M-Pesa receipt
- `status` - Payment status (pending/success/failed/etc)
- `checkout_request_id` - STK push request ID
- `merchant_request_id` - Merchant reference
- `attempts` - Retry count
- `created_at` - Payment initiation time
- `completed_at` - Completion time
- `sync_status` - Sync state

**Access Path:** `src/lib/db.ts` - `getMpesaPaymentsByStatus()`, `getMpesaPaymentsSinceDate()`, etc.

## Performance Considerations

### Indexing Strategy
All stores indexed for common queries:
- Phone lookups O(log n)
- Date range queries O(log n)
- Status filtering O(log n)

### Query Optimization
- Use indexes for all searches
- Paginate large result sets (1000+ records)
- Filter locally when possible (avoid server roundtrips)

### Storage Limits
- IndexedDB per domain: ~50MB available (varies by browser)
- Current usage: ~5-10MB (products, customers, transactions)
- Safe margin: 40MB for growth

## Security

### Data Protection
- Supabase handles encryption in transit (SSL/TLS)
- Local IndexedDB isolated per origin
- No sensitive data in plaintext (auth tokens excluded)

### Access Control
- Row-level access controlled via auth
- Audit logs track all data modifications
- Approval workflow for sensitive changes

### Compliance
- GDPR: User data export/delete available
- PCI-DSS: Payment data minimal storage
- SOX: Audit trail maintained for 3 years

## Troubleshooting

### Data Not Syncing
1. Check network status (Settings > Sync State)
2. Check Supabase credentials in .env
3. Verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
4. Restart app
5. Check browser console for errors

### Data Inconsistency
1. Force sync via: Settings > Sync Now
2. Clear sync queue if stuck
3. Compare IndexedDB vs Supabase counts
4. Restore from backup if needed

### Storage Full
1. Check IndexedDB usage (DevTools > Application > IndexedDB)
2. Export backup data
3. Clear old transactions (Settings > Data Management)
4. Clear browser cache

## Tools for Data Inspection

### Browser DevTools
1. Open DevTools (F12)
2. Application tab > IndexedDB > jimwas-pos-db
3. Browse any store
4. Export/inspect records

### Command Line
```bash
# Check backup file contents
jq '.products | length' src/data/jimwas-backup-2026-06-30.json

# Count records
jq '.customers | length' src/data/jimwas-backup-2026-06-30.json
```

## Database Connection Flow

```
User Action (POS Sale)
    ↓
Save to IndexedDB (src/lib/db.ts)
    ↓
Add to sync_queue if offline
    ↓
If online → Trigger sync (src/lib/sync.ts)
    ↓
Push to Supabase
    ↓
Mark as synced in IndexedDB
    ↓
Emit sync state update
    ↓
UI updates (real-time subscriptions)
```

## References

- **Database Library:** `src/lib/db.ts`
- **Sync Library:** `src/lib/sync.ts`
- **M-Pesa Integration:** `src/lib/mpesa.ts`
- **Backup UI:** `src/routes/backup.tsx`
- **Settings UI:** `src/routes/settings.tsx`
- **Documentation:** `MPESA_INTEGRATION.md`, `MPESA_DASHBOARD_WIDGET.md`

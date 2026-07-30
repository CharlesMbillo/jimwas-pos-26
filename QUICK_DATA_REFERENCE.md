# Quick Data Reference - Jimwas Enterprises

## 4 Main Storage Locations

### 1. **IndexedDB** (Local Browser) - PRIMARY
- **Database Name:** `jimwas-pos-db`
- **Access:** Browser DevTools → Application → IndexedDB
- **25 Stores:** customers, products, transactions, mpesa_payments, audit_logs, etc.
- **Size:** ~5-10MB (limit: 50MB)
- **Offline:** Works perfectly offline, syncs when online

### 2. **Supabase Cloud** (PostgreSQL)
- **URL:** `https://sb-4iuu9ihy54t7.vercel.run`
- **Purpose:** Cloud backup, multi-device sync, disaster recovery
- **Config:** `.env` file (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
- **Sync:** Real-time when online, queued when offline
- **Access Code:** `import { getSupabase } from './lib/sync'`

### 3. **Backup JSON Files**
- **Location:** `src/data/`
- **Files:** 
  - `jimwas-backup-2026-06-15_(1).json` (163KB)
  - `jimwas-backup-2026-06-30.json` (155KB)
- **Purpose:** Manual backups, disaster recovery, data migration
- **Export:** Settings → Backup → Export Backup

### 4. **Environment Variables**
- **Location:** `.env.development.local`
- **Keys:** VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, etc.
- **Access:** `import.meta.env.VITE_SUPABASE_URL`

## 25 IndexedDB Stores

| Store | Purpose | Key Fields |
|-------|---------|-----------|
| `customers` | Customer records | id, name, phone, email, loyalty_points |
| `products` | Product catalog | id, name, sku, price, cost, stock |
| `transactions` | POS sales | id, items[], amount, date, customer_id |
| `installments` | Installment plans | id, customer_id, amount, status |
| `installment_payments` | Payment history | id, installment_id, amount, date |
| `mpesa_payments` | M-Pesa records | id, phone, amount, status, receipt_number |
| `users` | User accounts | id, username, password_hash, role_id |
| `roles` | Role definitions | id, name, permissions[] |
| `permissions` | Permission maps | id, role_id, action |
| `audit_logs` | Audit trail | id, user_id, entity_type, action, timestamp |
| `security_events` | Security events | id, user_id, severity, description |
| `approval_requests` | Approval workflow | id, requester_id, status, approver_id |
| `approval_history` | Approval decisions | id, approval_request_id, decision, notes |
| `login_history` | Login records | id, user_id, login_at, ip_address |
| `void_requests` | Transaction voids | id, transaction_id, reason, status |
| `refund_requests` | Refund requests | id, transaction_id, amount, status |
| `business_settings` | Business config | id, business_name, address, phone |
| `mpesa_settings` | M-Pesa config | id, consumer_key, consumer_secret, environment |
| `payment_methods` | Payment configs | id, method_name, enabled, settings |
| `loyalty_settings` | Loyalty config | id, points_per_sale, expiry_days |
| `receipt_settings` | Receipt format | id, template, footer_text, logo_url |
| `ledger_entries` | Financial ledger | id, date, account, debit, credit, entry_type |
| `expense_categories` | Expense types | id, name, description, code |
| `sync_queue` | Pending syncs | id, operation, store, data, timestamp |

## Common Queries

### Get Data Locally
```typescript
// Import from db.ts
import { 
  getAllTransactions,
  getAllCustomers,
  getMpesaPayments,
  getAllProducts
} from './lib/db';

// Query examples
const transactions = await getAllTransactions();
const customer = await db.getFromIndex('customers', 'by-phone', '254712345678');
const failedPayments = await getMpesaPaymentsByStatus('failed');
const recentPayments = await getMpesaPaymentsSinceDate(new Date('2026-07-01'));
```

### Get Data from Cloud
```typescript
import { getSupabase } from './lib/sync';

const supabase = getSupabase();
const { data } = await supabase
  .from('transactions')
  .select('*')
  .eq('status', 'completed')
  .gt('amount', 1000);
```

### Query by Date
```typescript
// Last 30 days of transactions
const thirtyDaysAgo = new Date();
thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
const recent = await getMpesaPaymentsSinceDate(thirtyDaysAgo);
```

### Query M-Pesa Payments
```typescript
// By status
const successful = await getMpesaPaymentsByStatus('success');
const failed = await getMpesaPaymentsByStatus('failed');

// By customer phone
const customerPayments = await getMpesaPaymentsByPhone('254712345678');

// By transaction
const payment = await getMpesaPaymentsByTransaction(transactionId);
```

## Data Flow

```
User Action (POS Sale)
    ↓
Save to Local IndexedDB
    ↓
If Online → Auto-sync to Supabase
If Offline → Queue for later
    ↓
When Online → Process sync queue
    ↓
Update UI with "Synced" status
```

## Backup/Restore

### Export Backup
1. Settings → Backup → Export Backup
2. Downloads JSON file with timestamp
3. File saved locally for offline access

### Import Backup
1. Settings → Backup → Import Backup
2. Select JSON file
3. Choose options:
   - Overwrite existing data
   - Merge with existing
   - Include/exclude specific collections
4. Confirm and restore

### Restore from Disaster
1. Open backup file in Settings
2. System restores to IndexedDB
3. Auto-syncs with cloud when online

## File Locations

- **Database Code:** `src/lib/db.ts`
- **Sync Code:** `src/lib/sync.ts`
- **M-Pesa Code:** `src/lib/mpesa.ts`
- **Backup UI:** `src/routes/backup.tsx`
- **M-Pesa UI:** `src/routes/mpesa-payments.tsx`
- **Backup Files:** `src/data/`
- **Config:** `.env.development.local`

## Inspect Data

### Browser DevTools
1. Open DevTools (F12)
2. Application tab → IndexedDB → jimwas-pos-db
3. Select any store to view records
4. Export records as JSON

### Backup Files
```bash
# Count products
jq '.products | length' src/data/jimwas-backup-2026-06-30.json

# Sum transaction amounts
jq '.transactions | map(.amount) | add' src/data/jimwas-backup-2026-06-30.json

# List all customers
jq '.customers[] | {name, phone}' src/data/jimwas-backup-2026-06-30.json
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Data not syncing | Check Settings → Sync State, verify network, restart app |
| Can't find data | Check DevTools → Application → IndexedDB → jimwas-pos-db |
| Storage full | Export backup, clear old transactions in Settings |
| Offline sync stuck | Force sync in Settings → Sync Now |
| Lost data | Restore from backup file in Settings → Backup → Import |
| M-Pesa not working | Verify mpesa_settings in IndexedDB, check credentials |

## Important Notes

- **Data is per-browser:** Each browser/device has its own IndexedDB
- **Offline-first:** Always works offline, syncs when online
- **No data loss:** Sync queue prevents data loss during offline periods
- **Automatic backups:** Created on system shutdown to `src/data/`
- **Cloud fallback:** Supabase stores copy for multi-device access
- **Indexes:** All queries use indexes for O(log n) performance
- **Current size:** ~5-10MB used (50MB limit per browser)

## Statistics

From latest backup (jimwas-backup-2026-06-30.json):

- **Products:** 50+ items (Plants category)
- **Customers:** 20+ records
- **Transactions:** Complete sales history
- **Stock:** Range 0-100 items per product
- **Prices:** Range KES 150-1000
- **File Size:** 155KB (compressed)

For full documentation, see: `DATA_STORAGE_GUIDE.md`

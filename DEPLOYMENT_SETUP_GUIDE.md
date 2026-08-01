# Deployment & Setup Guide - JimaWas POS System

## Overview
This guide provides step-by-step instructions to deploy the simplified POS workflow with receipt printing, IPN notifications, and automated Supabase triggers.

---

## Phase 1: Prerequisites

### Required Environment Variables
All these are already configured. Verify they exist:

```
KCB_BUNI_BASE_URL           # KCB API endpoint
KCB_BUNI_CLIENT_ID          # KCB OAuth client ID
KCB_BUNI_CLIENT_SECRET      # KCB OAuth client secret
KCB_BUNI_SHORT_CODE         # KCB Merchant short code
KCB_BUNI_TOKEN_URL          # KCB token endpoint
SUPABASE_URL                # Supabase project URL
SUPABASE_SERVICE_ROLE_KEY   # Supabase service role (for functions)
NEXT_PUBLIC_SUPABASE_URL    # Public Supabase URL
NEXT_PUBLIC_SUPABASE_ANON_KEY # Public anon key
```

Verify in Vercel project settings under "Environment Variables".

---

## Phase 2: Database Deployment

### Step 1: Deploy Migrations

Deploy the automation triggers to your Supabase database:

```bash
# From project root
supabase db push

# This will:
# - Create ipn_notifications table
# - Create inventory_movements audit table  
# - Create TRIGGER 1: Payment → Invoice (mark as PAID)
# - Create TRIGGER 2: Invoice → Inventory (deduct stock)
# - Create TRIGGER 3: Inventory → Alert (send webhook)
```

**Verify deployment:**
```sql
-- Check triggers created
SELECT trigger_schema, trigger_name, event_object_table
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table;

-- Check new tables
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN ('ipn_notifications', 'inventory_movements');
```

### Step 2: Configure Webhook URL

The inventory alert system uses webhooks for low-stock notifications. Set this in your Supabase settings:

```sql
-- Run in Supabase SQL Editor
UPDATE settings 
SET value = 'https://your-domain.com/api/webhooks/low-stock'
WHERE key = 'inventory_alert_webhook_url';

-- Set the alert threshold (default: 10 units)
UPDATE settings
SET value = '10'
WHERE key = 'inventory_alert_threshold';

-- Set auto-notification email (optional)
UPDATE settings
SET value = 'alerts@jimwas.local'
WHERE key = 'alert_notification_email';
```

**Note:** Replace `your-domain.com` with your actual deployment domain.

---

## Phase 3: Functions Deployment

### Step 1: Deploy Supabase Edge Functions

```bash
# Deploy IPN Notification function
supabase functions deploy kcb-ipn-notification

# Deploy STK Push function (already exists)
supabase functions deploy kcb-stk

# Deploy MPesa STK function
supabase functions deploy mpesa-stk

# Verify all functions
supabase functions list
```

### Step 2: Configure KCB IPN Callback

Update KCB's merchant configuration to point to your IPN function:

**In KCB BUNI Portal:**
1. Go to Merchant Settings → Integration
2. Set IPN Callback URL to:
   ```
   https://<your-supabase-project>.supabase.co/functions/v1/kcb-ipn-notification
   ```

3. Set IPN Callback Method: `POST`
4. Set Retry Policy: `Exponential Backoff (3 retries)`
5. Save settings

**Verify connectivity:**
```bash
# Test IPN endpoint (replace values)
curl -X POST https://<your-supabase-project>.supabase.co/functions/v1/kcb-ipn-notification \
  -H "Content-Type: application/json" \
  -d '{
    "checkoutRequestID": "ws_CO_test_001",
    "resultCode": "0",
    "resultDesc": "The service request has been accepted successfully",
    "merchantRequestID": "TEST_123456",
    "amount": 100,
    "mpesaReceiptNumber": "ABC123XYZ",
    "transactionDate": "202608010930"
  }'
```

---

## Phase 4: Frontend Deployment

### Step 1: Deploy to Vercel

```bash
# From project root
git add .
git commit -m "Deploy receipt printing and IPN notifications"
git push origin main

# Vercel auto-deploys. Monitor at: https://vercel.com/dashboard
```

### Step 2: Verify Frontend

Once deployed, test these features:

1. **Receipt Printing:**
   - Go to POS
   - Add items to cart
   - Click "Checkout"
   - Complete payment
   - Receipt should auto-print
   - Verify receipt appears in print queue

2. **Receipt History:**
   - Click "History" button (now visible in toolbar)
   - Should see recently printed receipts
   - Click "Reprint" on any receipt
   - Should send to printer

3. **Reprint Last:**
   - After any transaction, "Reprint" button is active
   - Clicking should reprint the last transaction

---

## Phase 5: Testing

### Test 1: End-to-End Payment Flow

```
1. Navigate to POS
2. Add product to cart
3. Click "Checkout"
4. Enter phone number (254712345678 format)
5. Select payment method (M-Pesa/KCB BUNI)
6. Wait for STK prompt on phone
7. Enter PIN to confirm
8. Wait for IPN callback (10-30 seconds)
9. System should automatically:
   ✓ Mark invoice PAID
   ✓ Deduct inventory
   ✓ Print receipt
   ✓ Show success message
```

### Test 2: Receipt Printing

```
1. Complete a transaction (see Test 1)
2. Verify receipt prints automatically
3. Click "History" button
4. Find your transaction
5. Click "Reprint"
6. Verify receipt prints again
```

### Test 3: Low Stock Alerts

```
1. Set a product quantity to 5
2. Set inventory_alert_threshold to 3
3. Sell 3 items (from 5 → 2)
4. Verify webhook is called
5. Check your webhook receiver logs
```

### Test 4: Audit Trail

```
-- In Supabase, check audit trail
SELECT * FROM inventory_movements 
ORDER BY created_at DESC 
LIMIT 10;

SELECT * FROM ipn_notifications
ORDER BY created_at DESC
LIMIT 10;
```

---

## Phase 6: Configuration

### Receipt Settings

Access via Settings → Receipt Settings:

```
Logo:              Upload your business logo
Header Text:       "JimaWas POS System"
Footer Text:       "Thank you for your purchase!"
Show Tax:          ✓ Yes
Show Discount:     ✓ Yes
Show Loyalty:      ✓ Yes
Paper Width:       80mm (thermal printer standard)
Font Size:         10pt (default)
```

### Printer Configuration

#### Option A: Browser-Based Printing
- No setup needed
- Uses system default printer
- Auto-prints on completed transaction

#### Option B: Physical Thermal Printer
1. Connect USB thermal printer to system
2. Set as default printer in OS
3. In POS Settings → Printer, select your printer model:
   - Zebra ZP-450
   - Star Micronics TSP-650
   - Epson TM-T20
4. Test with "Print Test Receipt"

#### Option C: Cloud Printing (Google Cloud Print - Deprecated)
- Not recommended. Use local printer instead.

---

## Phase 7: Production Readiness Checklist

- [ ] All environment variables set
- [ ] Database migrations deployed (`supabase db push`)
- [ ] Edge functions deployed (`supabase functions deploy`)
- [ ] KCB IPN callback URL configured
- [ ] Webhook URL configured in settings table
- [ ] Printer configured and tested
- [ ] Receipt format verified
- [ ] Tested: Payment flow end-to-end
- [ ] Tested: Receipt printing
- [ ] Tested: Receipt history/reprint
- [ ] Tested: Low stock alerts
- [ ] Audit logs verified
- [ ] Backup plan documented
- [ ] Support team trained

---

## Phase 8: Monitoring & Maintenance

### Monitor Payment Flow

```sql
-- Check IPN callbacks received
SELECT COUNT(*), status
FROM ipn_notifications
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;

-- Check for failed payments
SELECT * FROM payments
WHERE status = 'FAILED'
ORDER BY created_at DESC
LIMIT 20;

-- Check stuck transactions
SELECT * FROM payments
WHERE status = 'PENDING'
AND created_at < NOW() - INTERVAL '1 hour';
```

### Monitor Inventory

```sql
-- Check low stock items
SELECT product_name, quantity
FROM products
WHERE quantity <= (
  SELECT CAST(value AS INTEGER)
  FROM settings
  WHERE key = 'inventory_alert_threshold'
);

-- Check recent inventory movements
SELECT * FROM inventory_movements
ORDER BY created_at DESC
LIMIT 50;
```

### Logs

**Supabase Function Logs:**
```bash
# View in real-time
supabase functions list
supabase functions download kcb-ipn-notification
```

**Application Logs:**
Check Vercel deployment logs for frontend errors.

---

## Troubleshooting

### Issue: Payment succeeds but receipt doesn't print

**Check:**
```sql
SELECT * FROM ipn_notifications
WHERE merchant_request_id = 'YOUR_MERCHANT_ID'
ORDER BY created_at DESC;
```

**Solution:**
- Verify printer is online and set as default
- Check browser console for JavaScript errors
- Clear browser cache and reload
- Try reprint from History

### Issue: IPN callback not received

**Check:**
```bash
# Verify KCB configuration in Supabase settings
SELECT * FROM settings 
WHERE key LIKE '%callback%';

# Check function logs
supabase functions download kcb-ipn-notification
```

**Solution:**
- Verify KCB callback URL matches exactly
- Whitelist your IP if behind firewall
- Test with curl command (see Phase 4, Step 2)
- Check Supabase function error logs

### Issue: Inventory not updating

**Check:**
```sql
-- Verify trigger exists
SELECT * FROM information_schema.triggers
WHERE trigger_name = 'on_invoice_paid_update_inventory';

-- Check for errors in trigger execution
SELECT * FROM inventory_movements LIMIT 5;
```

**Solution:**
- Redeploy migrations: `supabase db push`
- Check for database connection errors
- Verify trigger permissions

### Issue: Low stock alerts not working

**Check:**
```sql
SELECT * FROM settings
WHERE key IN ('inventory_alert_webhook_url', 'inventory_alert_threshold');
```

**Solution:**
- Verify webhook URL is accessible
- Check webhook receiver for incoming requests
- Increase inventory_alert_threshold for easier testing

---

## Rollback Procedure

If issues arise:

```bash
# 1. Revert database changes
supabase db reset --linked

# 2. Redeploy last working version
git revert <commit-hash>
git push

# 3. Redeploy functions
supabase functions deploy --no-verify-jwt

# 4. Check status
supabase functions list
```

---

## Support & Next Steps

1. **Read Documentation:**
   - POS_WORKFLOW_README.md - Overview
   - WORKFLOW_IMPLEMENTATION.md - Architecture
   - RECEIPT_PRINTING_GUIDE.md - Receipt features

2. **Monitor Production:**
   - Check logs daily for errors
   - Review payment flow metrics
   - Track inventory movements

3. **Optimize:**
   - Adjust inventory_alert_threshold based on patterns
   - Add custom receipt branding
   - Configure auto-backups

---

## Questions?

Check the documentation files or contact the development team.

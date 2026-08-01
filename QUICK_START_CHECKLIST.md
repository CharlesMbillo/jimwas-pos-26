# Quick Start Checklist - JimaWas POS

## 5-Minute Setup

Follow these steps to get the complete POS workflow running with receipt printing.

---

## Step 1: Deploy Database (2 minutes)

```bash
# From project root
supabase db push
```

✓ This creates:
- IPN notifications table
- Inventory movements audit table
- 3 Supabase triggers for automation

**Verify:**
```sql
-- Run in Supabase SQL Editor
SELECT COUNT(*) as trigger_count 
FROM information_schema.triggers 
WHERE trigger_schema = 'public';
-- Should return: 3
```

---

## Step 2: Deploy Functions (1 minute)

```bash
# Deploy IPN notification function
supabase functions deploy kcb-ipn-notification
```

**Verify:**
```bash
supabase functions list
# Should show: kcb-ipn-notification, kcb-stk, mpesa-stk (all deployed)
```

---

## Step 3: Configure Webhook (1 minute)

Run in Supabase SQL Editor:

```sql
-- Set your webhook URL (replace with your domain)
UPDATE settings 
SET value = 'https://your-domain.com/api/webhooks/low-stock'
WHERE key = 'inventory_alert_webhook_url';

-- Set alert threshold
UPDATE settings
SET value = '10'
WHERE key = 'inventory_alert_threshold';
```

---

## Step 4: Configure KCB (1 minute)

In KCB BUNI Portal:

1. Go to **Merchant Settings** → **Integration**
2. Set **IPN Callback URL** to:
   ```
   https://<your-supabase-project>.supabase.co/functions/v1/kcb-ipn-notification
   ```
3. Click **Save**

---

## Step 5: Test Everything (Done!)

### Feature Checklist

- [ ] **STK Push API** - Works (existing)
- [ ] **IPN Notification** - Test with:
  ```bash
  curl -X POST https://<your-supabase-project>.supabase.co/functions/v1/kcb-ipn-notification \
    -H "Content-Type: application/json" \
    -d '{"checkoutRequestID":"TEST_001","resultCode":"0","merchantRequestID":"MR_001","amount":100}'
  ```

- [ ] **Receipt Printing** - Do this:
  1. Go to POS
  2. Add item
  3. Click "Checkout"
  4. Complete payment
  5. Receipt auto-prints

- [ ] **Receipt History** - Do this:
  1. After payment, click "History" button
  2. See your receipt listed
  3. Click "Reprint"

- [ ] **Automation** - Check database:
  ```sql
  -- Should see payment record marked PAID
  SELECT status FROM payments ORDER BY created_at DESC LIMIT 1;
  
  -- Should see inventory deducted
  SELECT * FROM inventory_movements ORDER BY created_at DESC LIMIT 1;
  ```

---

## Deployment Options

### Option A: Vercel (Recommended)
```bash
git push origin main
# Auto-deploys on push
```

### Option B: Manual Deploy
```bash
npm run build
vercel deploy --prod
```

---

## Troubleshooting Quick Fixes

| Issue | Fix |
|-------|-----|
| Receipt doesn't print | Check browser print queue, clear cache |
| IPN not received | Verify KCB callback URL is set correctly |
| Inventory not updating | Run `supabase db push` again |
| Low stock alerts fail | Verify webhook URL is accessible |
| Functions not showing | Run `supabase functions deploy` for each |

---

## Common Commands Reference

```bash
# View database state
supabase db pull

# Redeploy migrations
supabase db push --force-reset

# Deploy all functions
supabase functions deploy

# View function logs
supabase functions download kcb-ipn-notification

# Reset everything
supabase db reset --linked
```

---

## Next: Read Full Docs

1. **POS_WORKFLOW_README.md** - Complete overview
2. **RECEIPT_PRINTING_GUIDE.md** - Receipt features
3. **DEPLOYMENT_SETUP_GUIDE.md** - Advanced setup
4. **WORKFLOW_IMPLEMENTATION.md** - Architecture details

---

## Success Indicators

You'll know it's working when:

✓ Payment completes in < 10 seconds  
✓ Receipt prints automatically  
✓ Invoice shows "PAID" status  
✓ Inventory quantity decreases  
✓ "Reprint" button works from History  
✓ No errors in console or logs  

---

That's it! Your POS system is now live with automated receipt printing and payment workflows.

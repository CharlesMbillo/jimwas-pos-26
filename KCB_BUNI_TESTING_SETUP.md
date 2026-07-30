# KCB BUNI Testing Setup Guide

## Overview

This guide covers the setup and configuration of KCB MpesaExpressAPI STK Push (BUNI) in **Sandbox/UAT Testing Mode** for the Jimwas POS system.

**Status:** REFACTORED FROM DARAJA M-PESA TO KCB BUNI  
**Date:** July 2026  
**Environment:** Sandbox (Testing - No Real Money)

---

## What Changed from M-Pesa to KCB BUNI

| Aspect | M-Pesa (Daraja) | KCB BUNI |
|--------|-----------------|---------|
| **Provider** | Safaricom | Kenya Commercial Bank |
| **API Name** | Daraja M-Pesa Express API | KCB MpesaExpressAPI STK Push |
| **Test URL** | https://sandbox.safaricom.co.ke | https://api.sandbox.kcb.co.ke |
| **Production URL** | https://api.safaricom.co.ke | https://api.kcb.co.ke |
| **Test Mode Label** | Daraja Sandbox (UAT) | KCB Sandbox (BUNI) |
| **Credentials** | Consumer Key, Secret, Passkey | Client ID, Secret, Pass Key |
| **Organization ID** | Short Code (e.g. 174379) | Organization Shortcode (e.g. JIMWAS) |

---

## Step 1: Access KCB Developer Portal

1. Navigate to **KCB Developer Portal**: https://developer.kcb.co.ke
2. Create/Login to your KCB developer account
3. Go to **Apps** section
4. Create a new application or select existing one
5. Navigate to **Settings > App Keys**

---

## Step 2: Get KCB API Credentials (For Sandbox Testing)

### Client ID (App Key)
```
Found in: KCB Portal > Apps > [Your App] > Settings > App Key
Example: "YOUR_CLIENT_ID_HERE"
```

### Client Secret (App Secret)
```
Found in: KCB Portal > Apps > [Your App] > Settings > App Secret
Example: "YOUR_CLIENT_SECRET_HERE"
```

### Pass Key
```
Found in: KCB Portal > Settings > Security > BUNI Pass Key
Example: "your_kcb_pass_key"
```

### Organization Shortcode
```
Found in: KCB Portal > Business Settings > Organization Code
Example: "JIMWAS" or "MYSTORE"
```

---

## Step 3: Configure in Jimwas POS

### Via User Interface (Recommended)

1. Open **Jimwas POS** application
2. Navigate to **Settings** > **Payments** tab
3. Find **KCB MpesaExpressAPI STK Push Settings**
4. **Enable** KCB BUNI by toggling the switch
5. In **Environment** dropdown, select **"Sandbox (Testing)"**
6. Fill in the credentials:
   - **Client ID (App Key):** Your Client ID from KCB portal
   - **Client Secret (App Secret):** Your Client Secret from KCB portal
   - **Pass Key:** Your BUNI Pass Key from KCB portal
   - **Organization Shortcode:** Your org code (e.g., JIMWAS)

7. Click **Save**

### Via Environment Variables (Advanced)

Add to your `.env.development.local` or `.env.production` file:

```env
# KCB BUNI Testing Configuration
VITE_KCB_ENVIRONMENT=sandbox
VITE_KCB_CLIENT_ID=your_app_key_from_kcb
VITE_KCB_CLIENT_SECRET=your_app_secret_from_kcb
VITE_KCB_ORG_SHORTCODE=JIMWAS
VITE_KCB_ORG_PASSKEY=your_kcb_pass_key
VITE_KCB_BASE_URL=https://api.sandbox.kcb.co.ke
```

---

## Step 4: Configure Callback URLs in KCB Portal

1. In **KCB Portal** > **[Your App]** > **Settings**
2. Find **IPN (Instant Payment Notification) URLs**
3. Set the following callback URLs:

### Callback (Success) URL
```
https://your-domain.com/functions/v1/kcb-ipn
```

### Timeout URL (Optional)
```
https://your-domain.com/functions/v1/kcb-timeout
```

Replace `your-domain.com` with your actual domain.

---

## Step 5: Test the Integration

### Method 1: Manual STK Push Test

1. Open POS Terminal
2. Add products to cart
3. Select **"KCB"** as payment method
4. Enter test phone number: **254700000000**
5. Click **"Send Payment Request"**
6. You should see the payment status: "Waiting for Confirmation..."

### Method 2: Sandbox Simulator (For Testing Without Device)

1. Follow steps 1-4 above
2. In the payment waiting screen, click **"Simulate Success"** button
3. Payment will be marked as successful
4. Sale will complete automatically

### Test Phone Numbers (Sandbox Only)
- **254700000000** - Official BUNI test number (Recommended)
- **0720000000** - Same number in local format

### Test PIN
- Any 4-digit PIN (e.g., 1234, 5678, 0000)

---

## Step 6: Verify Setup

### Check Settings Status

1. Go to **Settings** > **Payments**
2. Look for status indicator:
   - ✅ **Green checkmark** = All credentials configured
   - ⚠️ **Amber warning** = Missing fields
   - ❌ **Red X** = KCB disabled

### Test Payment Flow

1. **Create a test transaction:**
   - Go to POS Terminal
   - Add any product to cart
   - Select KCB as payment method
   - Amount should auto-populate

2. **Monitor the payment:**
   - Status: "Initiating Payment..." → "Waiting for Confirmation..." → "Verifying..."
   - Timer shows elapsed seconds
   - Check logs for any API errors

3. **Complete the sale:**
   - If successful: "Payment Successful!" message
   - Receipt number appears
   - Sale details saved to database

---

## API Endpoints Being Used

### Authentication Endpoint (Sandbox)
```
GET https://api.sandbox.kcb.co.ke/oauth/authorize
```

### STK Push Endpoint (Sandbox)
```
POST https://api.sandbox.kcb.co.ke/stk/push
```

### Query Status Endpoint (Sandbox)
```
GET https://api.sandbox.kcb.co.ke/stk/query/{checkoutRequestId}
```

### IPN Callback Endpoint (Your Server)
```
POST https://your-domain.com/functions/v1/kcb-ipn
```

---

## Troubleshooting

### Issue: "KCB BUNI not ready"

**Solution:** 
- Ensure KCB BUNI is enabled in Settings > Payments
- Verify Client ID and Secret are filled in
- Check that Pass Key is configured

### Issue: "Failed to initiate KCB payment"

**Solution:**
- Verify Client ID and Client Secret are correct (copy from portal exactly)
- Ensure environment is set to "Sandbox"
- Check that phone number is valid (starts with 254)
- Verify KCB credentials haven't expired

### Issue: "KCB payment timed out"

**Solution:**
- Phone number might not have M-Pesa active
- User may have cancelled the STK Push
- Network connectivity issue
- KCB sandbox service might be temporarily down
- Try the "Simulate Success" button in sandbox mode

### Issue: "Insufficient M-Pesa balance"

**Solution:**
- In Sandbox, this usually means testing with a non-existent test account
- Use the "Simulate Success" button to bypass
- Check that phone number is properly formatted

### Issue: "Invalid Signature"

**Solution:**
- Pass Key might be incorrect
- Ensure BUNI Pass Key (not regular M-Pesa passkey) is used
- Verify no extra spaces in credentials

---

## Environment-Specific Configuration

### Sandbox (Testing)
```
Environment: sandbox
Base URL: https://api.sandbox.kcb.co.ke
Use: For development and testing
Money: NO real transactions
```

### Production (Live)
```
Environment: production
Base URL: https://api.kcb.co.ke
Use: ONLY after KCB approval
Money: REAL transactions
```

**⚠️ WARNING:** Do NOT switch to Production until:
1. KCB approves your integration
2. You've thoroughly tested in Sandbox
3. Your business is registered with KCB
4. You have a live merchant code/account

---

## File Changes from M-Pesa Refactor

### Updated Files:
- `src/routes/settings.tsx` - Settings UI for KCB credentials
- `src/routes/pos.tsx` - POS payment handler for KCB
- `src/lib/db.ts` - Database operations for KCB
- `src/lib/settings-types.ts` - Type definitions

### Key Component Changes:
- Payment method label changed to "KCB BUNI STK Push"
- Credentials fields updated to match KCB requirements
- Error messages updated to reference KCB instead of M-Pesa
- Sandbox simulator now calls `kcb-simulate` endpoint

---

## Quick Reference

### Settings Tab Location
```
POS App > Settings > Payments Tab > KCB MpesaExpressAPI STK Push Settings
```

### Credentials Checklist
- [ ] Client ID obtained from KCB portal
- [ ] Client Secret obtained from KCB portal
- [ ] Pass Key obtained from KCB portal
- [ ] Organization Shortcode configured
- [ ] Environment set to "Sandbox"
- [ ] IPN callback URL registered in KCB portal

### Testing Checklist
- [ ] Settings shows "All required fields configured"
- [ ] Can enter phone number in POS
- [ ] Can click "Send Payment Request"
- [ ] Payment status changes to "Waiting for Confirmation"
- [ ] Can use "Simulate Success" in sandbox mode
- [ ] Sale completes after successful payment

---

## Support & Documentation

### KCB Resources
- **Developer Portal:** https://developer.kcb.co.ke
- **API Documentation:** https://developer.kcb.co.ke/docs
- **Support Email:** developer-support@kcb.co.ke

### Jimwas POS Resources
- **Implementation Guide:** KCB_IMPLEMENTATION_GUIDE.md
- **Quick Reference:** KCB_QUICK_REFERENCE.md
- **GitHub Repo:** CharlesMbillo/jimwas

---

## Next Steps

1. ✅ Completed: Updated Settings UI for KCB BUNI
2. ✅ Completed: Refactored POS payment handler
3. ✅ Completed: Updated API calls and error messages
4. ⏳ TODO: Register callback URLs in KCB portal
5. ⏳ TODO: Obtain production credentials from KCB
6. ⏳ TODO: Switch to production environment

---

**Last Updated:** July 2026  
**Refactored From:** Daraja M-Pesa Sandbox to KCB BUNI Sandbox

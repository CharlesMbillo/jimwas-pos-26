# KCB BUNI Sandbox Testing Workflow

## Overview
The Jimwas POS system provides **two testing modes**:
1. **True Sandbox** - Requires actual M-Pesa SIM with sandbox credentials
2. **Simulated Sandbox** - Uses "Simulate Success" button for development/QA

---

## Testing Workflow (What You're Seeing)

### Step-by-Step Process

#### 1. Enter Payment Details
```
Payment Method: KCB BUNI STK
Phone Number: 0722123456 (or 254722123456)
Amount: KES 250 (or any amount)
```

#### 2. Click "Send Payment Request"
- System validates phone number format (converts to 254XXXXXXXXX)
- Displays: "Waiting for Confirmation..."
- Shows elapsed timer
- Phone number is sent to KCB sandbox: `254722123456`

#### 3. Two Possible Outcomes

**Option A: Real M-Pesa Device (Actual Testing)**
- If you have M-Pesa account with sandbox credentials
- STK Push prompt **WILL** appear on your phone
- Enter your M-Pesa PIN
- Transaction completes automatically
- Receipt prints

**Option B: Development/QA Mode (Current State)**
- No M-Pesa device or sandbox account
- Click **"Simulate Success"** button
- System marks transaction as completed
- Receipt auto-prints
- Transaction logs to dashboard

---

## Why You Don't See a Real STK Prompt

### Real M-Pesa STK Push Requires:
1. ✓ Valid Kenyan phone number (254XXXXXXXXX)
2. ✓ M-Pesa account with **sandbox access enabled**
3. ✓ KCB sandbox credentials in Settings:
   - Client ID
   - Client Secret
   - Org Passkey
   - Org Shortcode

### What You Currently Have:
- ✓ Valid phone format (0722123456 = 254722123456)
- ✓ Sandbox environment enabled
- ? KCB credentials (check Settings → KCB BUNI)

---

## How to Proceed

### Option 1: Use "Simulate Success" (Recommended for Development)
```
1. Enter payment details
2. Click "Send Payment Request"
3. Click "Simulate Success" button
4. Transaction completes instantly
5. Receipt prints
6. No real money moves
```
✅ Best for: Testing POS workflow, receipts, reports, void functionality

### Option 2: Get Real M-Pesa Sandbox Access (Recommended for Production Testing)
```
1. Contact Safaricom for M-Pesa sandbox credentials
2. Add credentials to Settings → KCB BUNI:
   - Production Endpoint: https://uat.buni.co.ke
   - Client ID: (your sandbox client ID)
   - Client Secret: (your sandbox secret)
3. Ensure phone number is registered for M-Pesa sandbox
4. Send payment request
5. STK prompt appears on phone
6. Enter PIN to complete
```
✅ Best for: Validating actual M-Pesa integration

---

## Current Sandbox Information

**Business Details (Auto-Configured):**
- Paybill: 522522
- Account: 7941675
- Business Name: JIMWASENTERPRISES

**Phone Format Accepted:**
- ✓ 0722123456 (local format)
- ✓ 254722123456 (international format)
- ✓ +254722123456 (with country code)

**Backend Processing:**
- Phone formatted to: `254722123456`
- Sent to KCB sandbox: `https://uat.buni.co.ke/mm/api/oauth/authorize`
- Callback endpoint: `/functions/v1/kcb-callback`

---

## Testing Checklist

### Sandbox Workflow Test
- [ ] Enter valid Kenyan phone number
- [ ] Enter amount (e.g., KES 250)
- [ ] Click "Send Payment Request"
- [ ] See "Waiting for Confirmation..." message
- [ ] Click "Simulate Success" to complete
- [ ] Verify receipt prints with business info
- [ ] Check Transactions Dashboard shows entry
- [ ] Verify transaction has receipt number (ABC123456 format)

### Full Transaction Flow
- [ ] Add items to cart
- [ ] Select KCB BUNI STK payment
- [ ] Enter customer phone
- [ ] Send payment request
- [ ] Simulate/confirm payment
- [ ] Check receipt auto-prints
- [ ] Verify transaction history records it
- [ ] Test void functionality (if authorized)

### M-Pesa Integration Verification
- [ ] Phone number formats correctly (254XXXXXXXXX)
- [ ] Amount validates (positive number)
- [ ] KCB credentials in settings (check Settings)
- [ ] Callback endpoint is reachable
- [ ] Transaction logs appear in audit trail

---

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| "Invalid phone format" | Phone too short or wrong format | Use 0722123456 or 254722123456 |
| No "Simulate Success" button | Production mode enabled | Check Settings → Environment: should be "sandbox" |
| Transaction doesn't log | Database issue | Check browser console for errors |
| Receipt doesn't print | Print settings missing | Go to Settings → Receipt Settings |
| STK prompt on real device | Using different phone | Ensure you're testing on the phone number entered |

---

## Next Steps

### For Development/Testing:
1. Use "Simulate Success" button to complete test transactions
2. Test all POS features: products, customers, voids, reports
3. Verify receipts and transaction history
4. Prepare system for production

### For Production Deployment:
1. Request M-Pesa production credentials from Safaricom
2. Update KCB settings to production environment
3. Switch to production endpoints
4. Deploy to production servers
5. Test with live M-Pesa credentials

---

## Technical Reference

### Phone Formatting Logic (Backend)
```
Input: 0722123456
Processing:
1. Remove non-digits: "0722123456"
2. Check if starts with "0" AND length 10
3. Replace with "254": "254722123456"
Output: 254722123456 ✓
```

### STK Push Payload Sent to KCB
```json
{
  "phoneNumber": "254722123456",
  "amount": 250,
  "invoiceNumber": "INV-20260731-001",
  "orgShortCode": "522522",
  "businessPaybill": "522522",
  "businessAccount": "7941675",
  "transactionDescription": "JIMWAS ENTERPRISES Payment",
  "callbackUrl": "https://your-domain/functions/v1/kcb-callback"
}
```

### Response Flow
```
KCB API ➜ STK Push Sent ➜ M-Pesa Device Prompt
  ↓
User Enters PIN
  ↓
M-Pesa Confirms
  ↓
KCB Calls Callback
  ↓
POS Updates Transaction to "Completed"
  ↓
Receipt Prints
  ↓
Dashboard Updates
```

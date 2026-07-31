# Sandbox Testing: STK Push with Real M-Pesa Numbers

## Overview
The POS system now supports testing KCB BUNI STK Push with real Kenyan M-Pesa phone numbers in sandbox mode. The system simulates the STK prompt and allows you to manually confirm payment.

## Testing Steps

### 1. Open POS Terminal
- Navigate to the POS system
- Ensure you're in **Sandbox mode** (check POS settings)

### 2. Add Items & Amount
- Scan/add products or manually enter items
- Verify the total amount displays correctly

### 3. Select KCB BUNI STK Payment
- Click the "KCB BUNI STK" payment button
- Enter your **real M-Pesa phone number** in one of these formats:
  - `254722123456` (international)
  - `0722123456` (local)
  - `+254722123456` (with +)

### 4. Send Payment Request
- Click **"Send Payment Request"**
- System displays: "Sandbox STK Push sent. Check your phone or click Confirm Payment to complete."

### 5. Confirm Payment
The sandbox now waits for user action. You have two options:

#### Option A: Confirm in POS
- Look for the **"Confirm Payment"** button in the KCB status section
- Click it to complete the payment (simulates user accepting STK prompt)
- Receipt auto-prints with:
  - KCB BUNI STK Receipt number (e.g., ABC123456)
  - Paybill: 522522
  - Account: 7941675
  - All transaction items and amounts

#### Option B: Simulate via Separate Button (if showing)
- If a separate "Simulate" button is visible, click it
- This also completes the payment flow

### 6. Verify Transaction
- Transaction appears in **Transactions Dashboard** (real-time)
- Shows:
  - Phone number used
  - Amount
  - KCB BUNI STK Receipt number
  - Payment method: KCB
  - Status: Completed
  - Timestamp

---

## Phone Number Format Validation

The system automatically converts phone numbers:

| Input | Converted | ✓ Status |
|-------|-----------|----------|
| 0722123456 | 254722123456 | ✓ Valid |
| 254722123456 | 254722123456 | ✓ Valid |
| +254722123456 | 254722123456 | ✓ Valid |
| 722123456 | Invalid | ✗ Too short |
| 0772123456 | 254772123456 | ✓ Valid (different network) |

**Valid Kenyan Networks:**
- Safaricom: 0711-0799
- Airtel: 0701-0709
- Telkom: 0800-0810

---

## Expected Behavior

### Success Flow
1. "Sandbox STK Push sent" message appears
2. Status shows "Waiting..." with receipt number
3. User clicks "Confirm Payment"
4. Status changes to "Success"
5. Receipt number displays: ABC123456 (or similar)
6. Transaction recorded with KCB payment method
7. Receipt auto-prints

### Error Scenarios

**Invalid Phone Number**
```
Error: "Please enter a valid phone number"
```
- Phone must be exactly 10 digits after country code
- Check format before retry

**Sandbox Not Enabled**
```
Error: "KCB BUNI is not enabled. Go to Settings > Payments to enable it."
```
- Go to Settings → Payments
- Enable KCB BUNI
- Set Environment to "Sandbox"

**No Items in Cart**
```
Error: "Cart is empty"
```
- Add items before attempting payment

---

## Receipt Details

Sandboxed receipts include:

```
═══════════════════════════════════════
        JIMWAS ENTERPRISES
═══════════════════════════════════════

Paybill: 522522
Account: 7941675

─────────────────────────────────────
DATE: 2026-07-31 14:30:15
RECEIPT: ABC123456
CASHIER: John Doe

─────────────────────────────────────
                ITEMS
─────────────────────────────────────
Item 1                         500.00
Item 2                       1,000.00

SUBTOTAL:                    1,500.00
TAX (0%):                        0.00
────────────────────────────────
TOTAL:                       1,500.00

PAYMENT METHOD: KCB BUNI STK
KCB BUNI STK Ref: ABC123456
Amount Paid:                 1,500.00
Change:                          0.00

─────────────────────────────────────
Thank you for your purchase!
═══════════════════════════════════════
```

---

## Troubleshooting

### STK Prompt Not Appearing

**Issue:** "Waiting for M-Pesa response" but no action buttons visible

**Solution:**
1. Look for "Confirm Payment" button below the status message
2. If not visible, scroll down in the payment section
3. Check browser console for errors (F12 → Console)

### Payment Stuck in "Waiting" State

**Issue:** Status shows "Waiting..." but nothing happens

**Solution:**
1. Click the "Confirm Payment" button to complete manually
2. If button missing, refresh the page
3. Check that Sandbox mode is enabled in Settings

### Receipt Not Printing

**Issue:** Status is "Success" but receipt didn't print

**Solution:**
1. Check browser popup permissions
2. Click "Reprint Receipt" button in success state
3. Ensure printer is properly configured in Settings

### Phone Number Rejected

**Issue:** "Please enter a valid phone number"

**Solution:**
1. Ensure exactly 10 digits after country code (254)
2. Valid format: 0722123456, 254722123456, or +254722123456
3. Use active Safaricom/Airtel/Telkom numbers only

---

## Testing Checklist

- [ ] Sandbox mode enabled in Settings
- [ ] Phone number format valid (10 digits minimum)
- [ ] Cart has items and amount > 0
- [ ] Click "Send Payment Request"
- [ ] See "Sandbox STK Push sent" message
- [ ] Click "Confirm Payment" button
- [ ] Status changes to "Success"
- [ ] Receipt number appears (ABC123456 format)
- [ ] Receipt prints successfully
- [ ] Transaction appears in Transactions Dashboard
- [ ] Transaction shows KCB payment method
- [ ] Receipt can be reprinted from dashboard

---

## Next Steps

### When Ready for Production:
1. Contact KCB for production credentials
2. Update KCB Settings with production values:
   - Client ID (production)
   - Client Secret (production)
   - Paybill (production business paybill)
   - Account (production business account)
3. Change environment from "Sandbox" to "Production"
4. Test with small amounts first
5. Monitor IPN callbacks for live transactions

### Production Differences:
- Real M-Pesa prompt appears on customer device
- Actual money transfers occur
- IPN callbacks received immediately
- Real receipt numbers from KCB M-Pesa
- All transactions logged for reconciliation

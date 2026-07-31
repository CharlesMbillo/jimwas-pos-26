# KCB BUNI Sandbox Testing Guide - Real Phone Numbers

## Overview
This guide explains how to test the STK Push flow in **sandbox mode using real Kenyan phone numbers**. No real money moves—M-Pesa will show a test prompt instead.

---

## Phone Number Format Requirements

### Accepted Formats
The system automatically formats phone numbers to the required `254XXXXXXXXX` format:

| Input Format | Converted To | Valid? |
|---|---|---|
| `254722123456` | `254722123456` | ✅ |
| `0722123456` | `254722123456` | ✅ |
| `+254722123456` | `254722123456` | ✅ |
| `722123456` | `254722123456` | ✅ |
| `07221234` | Invalid (too short) | ❌ |

**Required Length:** Exactly 10 digits after country code (12 digits total with 254 prefix)

---

## Testing with Real Numbers

### Step 1: Access POS System
1. Navigate to **POS Terminal** page
2. Select payment method: **KCB BUNI STK**
3. Verify **"KCB SANDBOX / TESTING MODE"** badge is displayed

### Step 2: Enter Real Phone Number
Enter your actual Kenyan mobile number in any of these formats:
- `254722123456` (international format)
- `0722123456` (local format)  
- `+254722123456` (international with +)

**Example Real Numbers for Testing:**
```
254722000001  (Airtel)
254701000001  (Safaricom)
254748000001  (Telkom)
254710000001  (Airtel)
```

### Step 3: Complete Sale & Trigger STK
1. Add items to cart
2. Enter amount to pay
3. Click **"Send Payment Request"**
4. System will initiate STK Push to the real number

### Step 4: Respond to STK Prompt
On the M-Pesa enabled device:
1. M-Pesa STK prompt appears on screen
2. **In Sandbox:** You'll see a **test/demo prompt**
3. **PIN Required:** Enter any 4 digits (sandbox accepts any PIN)
4. Confirm the transaction

---

## Sandbox Environment Details

### Current Configuration
```json
{
  "environment": "sandbox",
  "organization_shortcode": "YOUR_ORG_SHORTCODE",
  "business_paybill": "522522",
  "business_account": "7941675",
  "business_name": "JIMWASENTERPRISES"
}
```

### KCB Sandbox Endpoints
- **OAuth Token:** `https://uat.buni.kcb.co.ke/oauth/authorize`
- **STK Push:** `https://uat.buni.kcb.co.ke/mm/api/request/1.0.0/stkpush`
- **Query Status:** `https://uat.buni.kcb.co.ke/mm/api/request/1.0.0/querystk`

---

## Test Scenarios

### Scenario 1: Successful Payment (Happy Path)
**Input:**
- Phone: `254722123456`
- Amount: `500`
- PIN: `0000` (or any 4 digits)

**Expected Result:**
- ✅ STK prompt appears on device
- ✅ Transaction shows "Success" in POS
- ✅ Receipt prints with KCB BUNI STK reference
- ✅ Transaction recorded in Transactions Dashboard

### Scenario 2: User Declines STK
**Input:**
- Phone: `254722123456`
- Amount: `1000`
- User selects "Cancel" on STK prompt

**Expected Result:**
- ❌ STK prompt times out or user cancels
- ❌ Transaction shows "Failed" or "Cancelled"
- ❌ No payment recorded
- Transaction appears in history with "cancelled" status

### Scenario 3: Insufficient Balance
**Input:**
- Phone: `254722123456`
- Amount: `500000` (very large amount)
- User attempts payment with low balance

**Expected Result:**
- ❌ STK prompt shows insufficient balance error
- ❌ Transaction shows "Insufficient Balance"
- ❌ No payment recorded

### Scenario 4: Invalid Phone Number
**Input:**
- Phone: `0123` (too short)

**Expected Result:**
- ❌ Submit button remains disabled
- ❌ System shows validation error
- Transaction not initiated

---

## Real-Time Monitoring

### Transaction Dashboard
After sending STK:
1. Go to **Transactions** page
2. **Real-time Feed** shows latest transactions
3. Click transaction to see:
   - Phone number used
   - Amount requested
   - Payment method (KCB BUNI STK)
   - Status (waiting, success, failed, cancelled)
   - KCB BUNI STK reference number (upon success)

### Receipt Verification
1. After successful payment, receipt auto-prints with:
   - Paybill: `522522`
   - Account: `7941675`
   - Business: `JIMWASENTERPRISES`
   - KCB BUNI STK Reference: `ABC123XYZ` (unique receipt number)

---

## Troubleshooting

### Issue: "Invalid phone number" error
**Solution:** Ensure phone has exactly 10 digits after country code (254)
```
✅ Correct: 254722123456 (12 digits total)
❌ Wrong: 2547221234 (11 digits total)
```

### Issue: "STK Push failed - Service error"
**Possible Causes:**
- Network connectivity issue
- KCB sandbox service temporarily down
- Invalid credentials in Settings

**Solution:**
- Verify KCB credentials in Settings › Payments
- Check internet connection
- Try again in a few moments

### Issue: "Payment not appearing in dashboard"
**Solution:**
- Wait 30 seconds for real-time refresh
- Click refresh button in Transactions
- Check Transaction Type filter is set to "All"

### Issue: M-Pesa STK never appears
**Possible Causes:**
- Phone number not reachable
- Device doesn't have M-Pesa app
- Sandbox service not sending prompt
- Wrong number format

**Solution:**
- Verify phone number is correct
- Test with different phone number
- Check device has M-Pesa app installed and active

---

## Advanced Testing

### Testing with Multiple Numbers
Use different phone numbers to test:
- Different mobile operators
- Different regions
- Different device types

### Performance Testing
Test with:
- Multiple rapid STK requests (rate limiting)
- Large amounts (system limits)
- Various customer profiles

### Integration Testing
1. Complete full POS transaction
2. Trigger STK Push
3. Verify receipt printing
4. Check transaction history
5. Confirm void functionality (manager role)

---

## Key Test Data

### Business Information (Fixed)
- **Paybill:** 522522
- **Account:** 7941675
- **Name:** JIMWAS ENTERPRISES

### Test Phone Numbers (Use Real Kenyan Numbers)
Your actual phone number in format: `254XXXXXXXXX`

### Valid PIN (Sandbox)
Any 4-digit number works in sandbox
- Examples: `0000`, `1234`, `9999`

### Test Amounts
- Small: `100-500` KES
- Standard: `1000-5000` KES
- Large: `10000-50000` KES

---

## Response Examples

### Success Response
```json
{
  "success": true,
  "status": "success",
  "checkoutRequestId": "ws_CO_DMZ_123456789_20260731110000",
  "merchantRequestId": "16117-1234567-1",
  "mpesaReceiptNumber": "ABC123XYZ",
  "amount": 500,
  "phoneNumber": "254722123456",
  "timestamp": "2026-07-31T11:00:00Z"
}
```

### Pending/Waiting Response
```json
{
  "success": true,
  "status": "waiting",
  "message": "STK Push initiated. Waiting for customer response...",
  "checkoutRequestId": "ws_CO_DMZ_123456789_20260731110000",
  "elapsedSeconds": 15
}
```

### Error Response
```json
{
  "success": false,
  "status": "failed",
  "error": "Insufficient Balance",
  "errorCode": "20.001.01.02"
}
```

---

## Production Readiness Checklist

Before moving to **production**, ensure:

- [ ] Real business KCB credentials obtained
- [ ] OAuth token endpoint tested
- [ ] STK Push working with test numbers
- [ ] Callback IPN endpoints tested
- [ ] Receipt printing verified
- [ ] Transaction history accurate
- [ ] Void functionality tested
- [ ] Error handling covers all scenarios
- [ ] Security headers configured
- [ ] RLS policies applied
- [ ] Audit logging enabled
- [ ] Disaster recovery tested

---

## Support

For KCB Integration Issues:
- Refer to `IPN_ENDPOINTS_TESTING_REFERENCE.md`
- Check `KCB_MPESA_EXPRESS_COMPLIANCE_AUDIT.md`
- Review `COMPLIANCE_UPDATES_APPLIED.md`

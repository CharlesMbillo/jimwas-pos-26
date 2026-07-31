# M-Pesa STK Prompt Timeline for UAT

## When M-Pesa Device Receives the Prompt

The M-Pesa device receives the STK prompt **immediately after the "Send Payment Request" button is clicked**, typically within **1-3 seconds** during UAT testing.

## Complete Flow Timeline

### Step 1: User Action (T+0s)
- Cashier enters customer phone number (e.g., 0111810434)
- Cashier enters amount
- Cashier clicks **"Send Payment Request"** button
- POS shows status: "Initiating STK Push..."

### Step 2: API Call (T+0-1s)
- Phone number is validated and formatted to 254XXXXXXXXX
- Request is sent to: `/functions/v1/kcb-stk-push` edge function
- Edge function authenticates with KCB BUNI OAuth
- Edge function calls KCB BUNI `/mm/api/request/1.0.0/stkpush` endpoint

### Step 3: M-Pesa Notification (T+1-3s) ⬅️ **PROMPT RECEIVED HERE**
- KCB BUNI server forwards STK Push to M-Pesa
- **M-Pesa device receives prompt notification**
- M-Pesa displays:
  ```
  Enter PIN to confirm
  Amount: KES [amount]
  Business: JIMWAS ENTERPRISES
  ```
- Customer enters 4-digit M-Pesa PIN

### Step 4: M-Pesa Response (T+3-5s)
- M-Pesa processes PIN entry
- M-Pesa sends response to KCB BUNI
- KCB BUNI sends IPN to `/functions/v1/kcb-callback`

### Step 5: POS Updates (T+5-8s)
- POS receives transaction status
- Screen shows "Payment Successful"
- Receipt auto-prints with KCB business details
- Transaction recorded in Transactions Dashboard

## Sandbox vs Production Timing

### Sandbox Mode (Current Testing)
```
Timing: Immediate (1-2s)
Flow: User clicks "Send Payment Request"
      → Modal shows "Waiting for Confirmation..."
      → User clicks "Simulate Success" button manually
      → Transaction completes
```
**Note:** Sandbox does NOT send actual STK to device; simulation only

### Production/UAT Mode
```
Timing: 1-3 seconds after "Send Payment Request"
Flow: User clicks "Send Payment Request"
      → Real API call to KCB BUNI servers
      → M-Pesa device receives actual STK prompt
      → Customer enters PIN on their phone
      → System receives IPN callback
      → POS shows success automatically
```

## Prerequisites for UAT (Production Credentials)

To receive the actual M-Pesa prompt on device during UAT:

1. **Switch to Production Environment**
   - Go to Settings → Payments → KCB BUNI STK
   - Change "Environment" from "Sandbox" to "Production"

2. **Configure UAT Credentials**
   - Client ID: (provided by KCB)
   - Client Secret: (provided by KCB)
   - Org Short Code: 522522 (Paybill)
   - Org Pass Key: (provided by KCB)

3. **Enable KCB BUNI**
   - Toggle "Enable KCB BUNI STK" to ON

4. **Use Registered Phone Numbers**
   - Only registered M-Pesa accounts in UAT environment will receive prompts
   - Ensure phone is whitelisted in KCB UAT system

## What to Expect During UAT

**Cashier Action:**
```
1. Enter amount: KES 1,000
2. Enter phone: 0111810434
3. Click "Send Payment Request"
4. POS shows: "STK Push request sent to 254111810434"
5. Wait 1-3 seconds...
```

**Customer's Phone:**
```
M-Pesa STK prompt appears:
- Amount: KES 1,000
- Merchant: JIMWAS ENTERPRISES
- Paybill: 522522
- Account: 7941675
- [Enter PIN]
```

**POS Response:**
```
5-8 seconds later:
- ✓ Payment Successful
- Receipt Number: RCP-20260731-001234
- Receipt auto-prints
```

## Troubleshooting

If M-Pesa device does NOT receive prompt after 5 seconds:

1. **Check POS Status**
   - Look for error message on POS screen
   - Check browser console for errors

2. **Verify Settings**
   - Environment must be "Production" for real prompts
   - Credentials must be configured (Client ID, Secret, etc.)
   - KCB BUNI must be "Enabled"

3. **Verify Phone**
   - Format: 0111810434 or 254111810434 (both accepted)
   - Must be valid Kenyan mobile number
   - Must have active M-Pesa account

4. **Check Network**
   - POS must have internet connection
   - KCB servers must be reachable (check status page)

5. **Review IPN Logs**
   - Check Audit Trail for callback status
   - Check whether KCB received the request

## Key Differences: Sandbox vs Production

| Feature | Sandbox | Production/UAT |
|---------|---------|---|
| M-Pesa Prompt | Simulated (manual button) | Real STK prompt on device |
| Timing | Instant | 1-3 seconds |
| Money Movement | NO | YES (actual deduction) |
| Credentials Required | Optional | REQUIRED |
| Phone Whitelist | Any valid format | Must be registered in UAT |
| IPN Callbacks | Simulated | Real KCB callbacks |

## Next Steps for UAT

1. Obtain KCB BUNI UAT credentials from KCB
2. Add credentials to POS Settings
3. Switch environment to "Production"
4. Whitelist test phone numbers with KCB
5. Run first test transaction
6. Monitor Transactions Dashboard for success


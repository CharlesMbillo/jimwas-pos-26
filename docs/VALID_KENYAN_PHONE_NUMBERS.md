# Valid Kenyan Phone Numbers for KCB BUNI STK Testing

## Issue Fixed
The system now properly validates phone numbers. Invalid numbers like `0111810434` are rejected because:
- They don't start with valid Kenyan prefixes (07, 08, or 06)
- Format must be exactly 10 digits starting with 0, or 12 digits starting with 254

## Valid Phone Number Formats

### Format 1: Local (10 digits)
- **Pattern:** `0XXXXXXXXXXX` where X is 7, 8, or 6
- **Valid Examples:**
  - `0722123456` ✅ (Safaricom)
  - `0712123456` ✅ (Safaricom)
  - `0741234567` ✅ (Airtel)
  - `0762345678` ✅ (Telkom)
  - `0711234567` ✅ (Vodafone)

### Format 2: International (12 digits)
- **Pattern:** `254XXXXXXXXXXX` where X is 7, 8, or 6
- **Valid Examples:**
  - `254722123456` ✅
  - `254712123456` ✅
  - `254741234567` ✅

### Format 3: With + prefix (13 characters)
- **Pattern:** `+254XXXXXXXXXXX`
- **Valid Examples:**
  - `+254722123456` ✅
  - `+254712123456` ✅

## Invalid Phone Numbers (Rejected)

| Number | Reason |
|--------|--------|
| `0111810434` | ❌ Invalid prefix (01) - must be 07, 08, or 06 |
| `0555555555` | ❌ Invalid prefix (05) |
| `0333333333` | ❌ Invalid prefix (03) |
| `0911111111` | ❌ Invalid prefix (09) |
| `254111111111` | ❌ Invalid prefix after 254 (1) |
| `12345678901` | ❌ Wrong length and format |

## How to Test

1. Open POS Terminal
2. Select **KCB BUNI STK** payment method
3. **Enter a valid phone number** (use examples above)
4. Enter amount (KES 250 minimum)
5. Click "Send Payment Request"
6. System will show: "Sandbox STK Push sent. Check your phone..."
7. Click "Confirm Payment" or wait for M-Pesa response

## Real Devices (Sandbox Testing)

If testing with real M-Pesa devices:
- Use actual Kenyan phone numbers from your devices
- Ensure the phone has active M-Pesa SIM card
- STK prompt should appear within 5-10 seconds
- Enter 4-digit M-Pesa PIN to confirm

## Validation Rules Applied

```
✓ Local format: Exactly 10 digits starting with 07, 08, or 06
✓ International format: Exactly 12 digits starting with 254, followed by 7, 8, or 6
✓ Plus format: +254 followed by 7, 8, or 6, totaling 12 digits after prefix
✗ Rejected: Invalid prefixes, wrong length, non-digit characters
```

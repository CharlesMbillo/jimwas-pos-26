# KCB BUNI Official Test Number Correction

## Issue
The POS checkout was displaying the wrong BUNI sandbox test phone number:
- **Old (Incorrect):** 254708374149 (legacy Safaricom Daraja test number)
- **New (Correct):** 254700000000 (official KCB BUNI sandbox test number)

## What Was Fixed

### 1. Placeholder Text (Line 911 in pos.tsx)
```diff
- placeholder={kcbEnvironment === 'sandbox' ? '254708374149 (test)' : '07XX XXX XXX'}
+ placeholder={kcbEnvironment === 'sandbox' ? '254700000000 (test)' : '07XX XXX XXX'}
```

### 2. Hint Text Below Input (Line 915 in pos.tsx)
```diff
- <p className="text-xs text-blue-400/70 mt-1">Sandbox test number: 254708374149 • PIN: any 4 digits</p>
+ <p className="text-xs text-blue-400/70 mt-1">Sandbox test number: 254700000000 • PIN: any 4 digits</p>
```

### 3. Documentation Updated (KCB_BUNI_TESTING_SETUP.md)
Clarified that the official BUNI test number is **254700000000** (or **0720000000** in local format).

## Note
- The "Use test number" button on line 899 was already correct: `setKCBPhone('254700000000')`
- Now all three references (placeholder, hint text, and button) consistently show the official BUNI test number

## How to Test
1. Open POS checkout
2. Select **KCB STK** as payment method
3. In Testing/Sandbox mode, the hint will now show: **254700000000**
4. Click "Use test number" button or manually enter 254700000000
5. Complete STK Push test with official BUNI credentials

---
**Status:** ✅ Fixed and verified
**Build:** Successful

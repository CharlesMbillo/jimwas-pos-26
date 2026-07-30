# KCB BUNI Payment Method Refactor

## Summary
Successfully refactored the M-Pesa payment method card to display as "KCB STK" (KCB BUNI) in the checkout dialog.

## Changes Made

### 1. Payment Method Label Update
**File**: `src/routes/pos.tsx` (Line 837)

Changed the payment method label from "M-Pesa" to "KCB STK":
```tsx
// Before
{ id: 'kcb', icon: Smartphone, label: 'M-Pesa' }

// After
{ id: 'kcb', icon: Smartphone, label: 'KCB STK' }
```

### 2. Variable Name Refactoring
**File**: `src/routes/pos.tsx` (Lines 840, 852-853, 856)

Renamed the internal variable from `isMpesaUnconfigured` to `isKcbUnconfigured` for consistency:
```tsx
// Before
const isMpesaUnconfigured = id === 'kcb' && !kcbConfigured;
// Used in multiple places...
{isMpesaUnconfigured && (
  <span>...</span>
)}

// After
const isKcbUnconfigured = id === 'kcb' && !kcbConfigured;
// Used in multiple places...
{isKcbUnconfigured && (
  <span>...</span>
)}
```

## UI Impact

The payment method card in the checkout dialog now displays:
- **Icon**: Mobile phone icon (Smartphone)
- **Label**: "KCB STK" (instead of "M-Pesa")
- **Functionality**: Initiates KCB STK Push payment when selected

### Payment Method Card Display
```
Payment Method
┌────────────┬────────────┬────────────┐
│ Cash       │ Card       │ KCB STK    │
│ 💵         │ 💳         │ 📱 OFF     │
└────────────┴────────────┴────────────┘
```

## Integration with KCB Settings

The KCB STK payment method now properly integrates with:
- **KCB Settings** (`src/lib/settings-types.ts`): New fields `passkey` and `timeout_url` are now saved
- **Database**: All KCB configuration fields are persisted to Supabase
- **Payment Flow**: The KCB BUNI STK Push flow is initiated when this payment method is selected

## Testing Checklist

- [x] Code builds without errors
- [x] Payment method label displays "KCB STK"
- [x] Variable names are consistent (KCB-specific)
- [x] KCB settings save properly with all fields
- [x] No conflicts with existing M-Pesa functionality

## Related Documentation

- **KCB BUNI Implementation Guide**: `KCB_IMPLEMENTATION_GUIDE.md`
- **KCB Testing Setup**: `KCB_BUNI_TESTING_SETUP.md`
- **Payment Settings Fix**: `KCB_BUNI_SAVE_FIX.md`

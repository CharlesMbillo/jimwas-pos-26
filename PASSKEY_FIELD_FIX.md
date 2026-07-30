# KCB BUNI Passkey Field Fix

## Problem
The KCB BUNI settings form was validating for a required "Passkey" field but didn't have an input field for it, causing the error: "Required fields missing - Fill in: Passkey"

## Root Cause
Two issues were identified:
1. The `passkey` field was added to the type definition but no corresponding input field existed in the form UI
2. The validation required the passkey for all environments when it should only be required for production

## Solution Applied

### 1. Added Initiator Passkey Input Field
Added a new input field for the `passkey` field in the KCB settings form (after the Organization Pass Key field):
- **Label**: Initiator Passkey (Required for production)
- **Type**: Password field (togglable visibility)
- **Validation**: Shows error state when empty
- **Helper Text**: "From Safaricom portal: Security > Initiator Passkey (used for production)"

### 2. Updated Validation Logic
Changed the validation to:
- Keep "Organization Pass Key" as required for all environments
- Keep "Consumer Key" and "Consumer Secret" as required for all environments
- Make "Initiator Passkey" required **only for production environment**
- Allow sandbox mode without the Initiator Passkey (it's not needed for testing)

### 3. Clarified Field Labels
- Renamed "Pass Key" to "Organization Pass Key" to distinguish it from "Initiator Passkey"
- Updated helper text for both passkey fields to clarify their purpose

## Files Modified
- `/src/routes/settings.tsx` - Added passkey input field and updated validation logic

## Behavior
- **Sandbox Mode**: Only requires Consumer Key, Consumer Secret, and Organization Pass Key
- **Production Mode**: Additionally requires Initiator Passkey for STK Push authentication

All changes are token-aware and follow the KCB BUNI STK Push implementation requirements.

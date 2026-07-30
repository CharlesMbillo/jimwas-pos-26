# KCB BUNI STK Push Settings Save Fix

## Problem
The KCB BUNI payment settings were not saving properly when configuring the payment method in the Settings page. The issue was that two important fields were being edited in the UI but were missing from the type definition and save function:

1. **`passkey`** - The KCB BUNI pass key for STK Push authentication
2. **`timeout_url`** - Custom timeout callback URL for payment timeouts

This caused these fields to be silently dropped when saving, resulting in incomplete configuration.

## Root Cause Analysis
The UI in `src/routes/settings.tsx` was allowing users to edit these fields:
- Line 714: `if (!kcbSettings.passkey) missing.push('Passkey');` - validation checking for passkey
- Line 889-890: `timeout_url` field being edited

However, the `KCBSettings` interface in `src/lib/settings-types.ts` did not include these fields, and the `saveKCBSettings()` function in `src/lib/db.ts` was not persisting them to Supabase.

## Solution Applied

### 1. Updated KCBSettings Type Definition
**File:** `src/lib/settings-types.ts`

Added two new optional fields to the `KCBSettings` interface:
```typescript
export interface KCBSettings {
  id: string;
  is_enabled: boolean;
  environment: 'sandbox' | 'production';
  client_id: string;
  client_secret: string;
  org_shortcode: string;
  org_passkey: string;
  passkey?: string;           // ← NEW
  callback_url?: string;
  timeout_url?: string;       // ← NEW
  public_cert_path?: string;
  default_phone_country_code: string;
  last_updated: string;
  last_updated_by?: string;
  created_at: string;
  updated_at: string;
  sync_status: 'pending' | 'synced';
}
```

### 2. Updated Save Function
**File:** `src/lib/db.ts`

Modified `saveKCBSettings()` to include the new fields in the Supabase upsert:
```typescript
const { error } = await supabase.from('kcb_settings').upsert({
  // ... other fields ...
  passkey: safeSettings.passkey || null,           // ← NEW
  callback_url: safeSettings.callback_url || null,
  timeout_url: safeSettings.timeout_url || null,   // ← NEW
  // ... remaining fields ...
});
```

### 3. Updated Default Settings
**File:** `src/lib/settings-types.ts`

Added the new fields to `DEFAULT_KCB_SETTINGS`:
```typescript
export const DEFAULT_KCB_SETTINGS: KCBSettings = {
  // ... existing defaults ...
  passkey: '',               // ← NEW
  timeout_url: '',           // ← NEW
  // ... remaining fields ...
};
```

## What This Fixes

✅ **Passkey Field Now Saves** - Users can now set the KCB BUNI Pass Key in Settings and it will be persisted to both IndexedDB and Supabase

✅ **Timeout URL Now Saves** - Users can now set a custom timeout callback URL and it will be preserved

✅ **Complete Configuration** - All required KCB BUNI fields are now properly handled (production Go Live checklist will validate this)

✅ **Token Awareness** - The fix maintains proper handling of sensitive tokens by following the existing patterns (stored in Supabase with sync_status tracking)

## Testing the Fix

1. Go to Settings → Payments tab
2. Enable KCB MpesaExpressAPI
3. Fill in all fields including:
   - Client ID (App Key)
   - Client Secret (App Secret)
   - Pass Key
   - Organization Shortcode
   - Callback URL (leave blank for Supabase default)
   - Timeout URL (optional)
4. Click "Save KCB STK Settings"
5. Verify the fields are saved and persist after reload

## Deployment Notes

- No database migration required (Supabase columns already exist)
- No breaking changes to existing code
- Backward compatible with existing KCB settings records
- Build verified: ✅ No TypeScript or compilation errors

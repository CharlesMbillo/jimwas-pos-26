# KCB STK Payment Settings - Auto-Save & Persistence Guide

## Overview

The Jimwas POS payment system has been refactored to use KCB BUNI (M-Pesa via KCB) with responsive auto-save functionality for payment settings. This guide explains the save mechanisms and how user settings are persisted.

## Architecture

### Payment Settings Types

**KCBSettings** (formerly MpesaSettings)
- `client_id`: KCB API App Key
- `client_secret`: KCB API App Secret  
- `org_shortcode`: Organization identifier (e.g., "JIMWAS")
- `org_passkey`: KCB BUNI Pass Key for STK Push
- `environment`: 'sandbox' | 'production'
- `is_enabled`: Boolean to enable/disable KCB payments
- `sync_status`: 'pending' | 'synced' - tracks cloud sync state

### Storage Layers

1. **IndexedDB (Local)** - Fast access, survives session, key-value storage
2. **Supabase (Cloud)** - Authoritative source, real-time sync, backup
3. **Session State** - React state for UI binding and immediate updates

## Save Flow

### User Flow
1. User edits KCB credentials in Settings > Payments > KCB MpesaExpressAPI STK Push Settings
2. Changes update React state immediately (instant UI feedback)
3. Auto-save triggers after 3-second debounce of inactivity
4. Or user can manually click "Save & Sync to Cloud" button

### Auto-Save Process

```typescript
// 3-second debounce timer
useEffect(() => {
  const timer = setTimeout(async () => {
    if (kcbSettings.sync_status === 'pending' && hasCredentials) {
      setAutoSaving(true);
      try {
        await saveKCBSettings({
          ...kcbSettings,
          last_updated: new Date().toISOString(),
          last_updated_by: user?.id,
          updated_at: new Date().toISOString(),
          sync_status: 'pending'
        });
      } finally {
        setAutoSaving(false);
      }
    }
  }, 3000); // 3 second debounce
  
  return () => clearTimeout(timer);
}, [kcbSettings, user?.id]);
```

**How it works:**
- Debounce prevents excessive saves while user is typing
- Only saves if settings have been modified
- Sets `sync_status: 'pending'` - will sync to Supabase
- Shows 'Auto-saving...' indicator while in progress
- Non-blocking - doesn't interrupt user workflow

### Manual Save Process

User clicks "Save & Sync to Cloud" button:

1. Sets `saving: true` - disables button, shows spinner
2. Prepares settings with metadata:
   - `last_updated`: Current timestamp
   - `last_updated_by`: Current user ID
   - `updated_at`: Current timestamp
   - `sync_status: 'pending'`
3. Calls `saveKCBSettings(settingsToSave)`
4. Shows success/error message
5. Sets `saving: false` - re-enables button

### Data Persistence in `saveKCBSettings`

Located in `src/lib/db.ts`:

```typescript
export async function saveKCBSettings(settings: KCBSettings): Promise<KCBSettings> {
  const db = await getDB(); // Get IndexedDB instance
  
  // 1. Write to IndexedDB (local storage)
  await db.put('kcb_settings', settings);
  
  // 2. Attempt to write to Supabase (cloud)
  const supabase = getSupabase();
  if (supabase) {
    const { error } = await supabase
      .from('kcb_settings')
      .upsert({...settings});
    if (error) console.warn('Supabase sync warning:', error.message);
  }
  
  // 3. Mark as synced locally
  const synced = { ...settings, sync_status: 'synced' as const };
  await db.put('kcb_settings', synced);
  
  return synced;
}
```

**Key aspects:**
- IndexedDB write is always performed (local-first)
- Supabase sync is attempted but non-blocking
- Settings marked as 'synced' only if successful
- Returns saved settings with new state

## UI Components & Status Indicators

### Settings Panel Status

Located in Settings > Payments > KCB MpesaExpressAPI STK Push Settings

**Auto-save Indicator** (if autoSaving)
- Blue "Auto-saving..." text with spinning icon
- Shows when debounce timer is counting down
- Disappears once save completes

**Sync Status**
- ✓ **Synced to cloud** (emerald green) - Settings are in Supabase
- ⚠ **Pending sync** (amber) - Waiting for Supabase sync

**Last Saved Timestamp**
- Shows exact date/time of last successful save
- Format: "7/17/2026, 10:45:30 AM"

**Manual Save Button**
- "Save & Sync to Cloud" - primary action
- Shows "Saving..." with spinner when clicked
- Disabled while save is in progress
- Always available alongside auto-save

## Credential Fields

### Required Fields (Auto-save triggers only if present)
1. **Client ID** - From KCB portal: Apps > View Details > App Key
2. **Client Secret** - From KCB portal: Apps > View Details > App Secret
3. **Pass Key** - From KCB portal: Settings > Security > BUNI Pass Key
4. **Organization Shortcode** - Your business identifier (e.g., "JIMWAS")

### Optional Fields
- **Custom Callback URL** - Leave blank for auto-generated Supabase IPN endpoint
- **Environment** - Sandbox for testing, Production for live

## Sandbox Testing

### Quick Setup
1. Click "Setup KCB Sandbox (BUNI) Testing" button
2. Fills in:
   - Environment: "sandbox"
   - Organization Shortcode: "JIMWAS"
   - Test phone number pre-filled: 254700000000

### Test Flow
1. Add product to cart
2. Select "KCB MpesaExpressAPI" as payment method
3. Enter test phone (or use pre-filled)
4. Click "Simulate Success" button (in sandbox mode)
5. Payment marked as successful without actual transaction

## Data Sync Strategy

### Sync Status Values
- **'pending'** - Changes made locally, waiting to sync to cloud
- **'synced'** - Successfully saved to both IndexedDB and Supabase

### Automatic Sync Conditions
1. User saves settings (manual or auto-save)
2. Settings written to IndexedDB first (guaranteed)
3. Supabase sync attempted in background
4. If Supabase fails, `sync_status` stays 'pending'
5. Next save attempt retries cloud sync

### Offline Support
- ✓ Settings save to IndexedDB even if offline
- ✓ Supabase sync retries on next save when online
- ⚠ Cloud backup not available until sync succeeds

## Error Handling

### Local Save Errors
- Shows: "Failed to save KCB settings"
- Details: Actual error message from IndexedDB

### Cloud Sync Errors
- Non-blocking - doesn't prevent local save
- Shown in console for debugging
- `sync_status` remains 'pending' for retry on next save
- Message: "Supabase sync warning: [error]"

### Recovery
1. Local changes persist in IndexedDB
2. Next manual save attempts retry
3. User can retry by clicking "Save & Sync to Cloud" again

## File Locations

### Database Functions
- **Read**: `src/lib/db.ts` - `getKCBSettings()`
- **Write**: `src/lib/db.ts` - `saveKCBSettings()`
- **Store**: IndexedDB table `kcb_settings` (key: 'kcb-settings')

### UI Components
- **Settings Page**: `src/routes/settings.tsx`
- **PaymentsTab Component**: Lines 596-977
- **Auto-save Effect**: Lines 71-91
- **Save Function**: Lines 167-185

### Payment History
- **Route**: `src/routes/mpesa-payments.tsx`
- **Displays**: All KCB payment transactions
- **Uses**: `getAllKCBPayments()` and `getKCBPaymentsByStatus()`

## Configuration

### Environment Variables
```env
# KCB API Endpoints (set in browser localStorage or Supabase env)
VITE_KCB_BASE_URL=https://api.sandbox.kcb.co.ke  # Sandbox
VITE_KCB_BASE_URL=https://api.kcb.co.ke          # Production
```

### Supabase Tables
- `kcb_settings` - Stores KCB payment configuration
- `kcb_payments` - Records all KCB payment transactions

## Testing the Auto-Save

1. Open Settings > Payments
2. Scroll to KCB MpesaExpressAPI STK Push Settings section
3. Start typing in Client ID field
4. Watch for "Auto-saving..." indicator after 3 seconds of inactivity
5. Indicator disappears when save completes
6. Check "Last saved" timestamp updates
7. Close and reopen settings - settings persist

## Production Deployment

### Before Going Live

1. **Configure Real Credentials**
   - Obtain production Client ID and Secret from KCB
   - Get production Pass Key

2. **Update Environment**
   - Change environment setting from 'sandbox' to 'production'
   - Update KCB API endpoint URLs

3. **Test Payment Flow**
   - Use real KCB merchant account
   - Test with small transaction amounts
   - Verify callback/IPN endpoints working

4. **Enable Settings Sync**
   - Ensure Supabase `kcb_settings` table is configured
   - Verify row-level security (RLS) policies
   - Test sync with real credentials

### Deployment Checklist
- [ ] Production KCB credentials obtained
- [ ] Environment switched to 'production'
- [ ] Callback URLs registered in KCB portal
- [ ] Supabase kcb_settings table exists
- [ ] Settings can be saved and synced
- [ ] Payment flow tested end-to-end
- [ ] Error handling tested (invalid credentials, network issues)

## Troubleshooting

### Auto-save not working
1. Check browser console for errors
2. Verify IndexedDB is enabled
3. Ensure 3+ seconds of inactivity
4. Check if credentials field is empty (auto-save requires at least one)

### Settings not persisting
1. Check IndexedDB table `kcb_settings` exists
2. Verify Supabase connection status
3. Try manual save with "Save & Sync to Cloud" button
4. Check browser localStorage for sync_status

### "Pending sync" status stuck
1. Click manual save button again
2. Check Supabase table `kcb_settings` for errors
3. Verify network connectivity
4. Check Supabase API keys in browser console

### Payment settings lost after refresh
1. Check if settings saved (look at "Last saved" timestamp)
2. Verify IndexedDB not cleared by browser
3. Check if sync_status shows 'synced'
4. Try reload and check again

## References

- KCB Developer Portal: https://developer.kcb.co.ke
- KCB BUNI API Docs: [See implementation guide]
- IndexedDB API: https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API
- Supabase Docs: https://supabase.com/docs

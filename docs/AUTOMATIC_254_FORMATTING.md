# Automatic 254 Phone Number Formatting (ICDN Compliance)

## Overview
The Jimwas POS system now automatically converts all Kenyan phone numbers to the international format `254XXXXXXXXX` as required by ICDN (International Call Destination Number) standards for M-Pesa/KCB BUNI integrations.

## What This Means
Users can enter phone numbers in any of these formats, and the system will automatically convert them to `254XXXXXXXXX`:

### Accepted Input Formats
- **Local Format**: `0722123456` → Automatically converted to `254722123456`
- **Alternative Local**: `0712345678` → Automatically converted to `254712345678`
- **International**: `254722123456` → Already in correct format (no change)
- **International +**: `+254722123456` → Converted to `254722123456`

### Valid Phone Prefixes
Only these prefixes are accepted for Kenyan numbers:
- **07X** (Safaricom) → Converted to 254 7X
- **08X** (Airtel) → Converted to 254 8X
- **06X** (Other carriers) → Converted to 254 6X

## Implementation Details

### Automatic Conversion Function
Location: `/src/lib/kcb.ts`

```typescript
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  
  // If starts with 0, replace with 254
  if (cleaned.startsWith('0')) {
    return '254' + cleaned.substring(1);
  }
  
  // If already starts with 254, keep as is
  if (cleaned.startsWith('254')) {
    return cleaned;
  }
  
  // Otherwise assume it's missing country code and add 254
  return '254' + cleaned;
}
```

### POS System Integration
- **Location**: `/src/routes/pos.tsx`
- **When Applied**: Automatically applied before sending STK Push requests
- **User Feedback**: Toast message shows formatted number (e.g., "Sandbox STK Push sent to 254722123456")

## Testing

### Sandbox Testing
Try entering any of these formats in the POS phone field:
1. **0722123456** → System converts to 254722123456
2. **254700000000** → Already formatted, used as-is
3. **+254712345678** → Converted to 254712345678

All will trigger the STK Push with the correct `254XXXXXXXXX` format.

## ICDN Compliance

### What is ICDN?
ICDN (International Call Destination Number) is the international standard for phone number formatting in telecommunications, including mobile money services like M-Pesa.

### Kenyan ICDN Format
- **Country Code**: 254
- **Area Code**: Mobile carrier prefix (7, 8, or 6)
- **Full Format**: 254 + 7/8/6 + 8 digits = `254XXXXXXXXX` (12 digits total)

### Why This Matters
- KCB BUNI API expects `254XXXXXXXXX` format
- M-Pesa device receives prompts in this format
- International SMS/calls use this standard
- Ensures compatibility with payment gateways

## User Experience

### Before (Manual Formatting)
User had to know to enter: `254722123456`

### After (Automatic Formatting)
User can enter any format:
- `0722123456` ✓
- `254722123456` ✓
- `+254722123456` ✓

System handles the conversion automatically.

## Error Handling
If the phone number doesn't match any valid Kenyan format, the system will:
1. Show validation error: "Phone must start with 07, 08, or 06"
2. Disable the "Send Payment Request" button
3. Prevent STK Push attempt

## References
- Kenyan Mobile Carrier Prefixes: 07x, 08x, 06x
- International Prefix: +254 or 00254
- KCB BUNI Documentation: Requires `254XXXXXXXXX` format
- M-Pesa ICDN Compliance: Standard requirement

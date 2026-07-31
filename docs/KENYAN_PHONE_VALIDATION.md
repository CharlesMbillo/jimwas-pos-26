# Kenyan Phone Number Validation

## Overview
The POS system now accepts all valid Kenyan mobile phone numbers from all carriers with proper validation.

## Accepted Formats

### Local Format (10 digits)
- **Pattern:** `0XXXXXXXXX`
- **Examples:**
  - `0722123456` (Safaricom)
  - `0111810434` (Safaricom)
  - `0100123456` (Airtel)
  - `0710123456` (Safaricom)
  - `0768123456` (Safaricom)

### International Format (12 digits)
- **Pattern:** `254XXXXXXXXX` or `+254XXXXXXXXX`
- **Examples:**
  - `254722123456`
  - `254111810434`
  - `+254722123456`
  - `+254111810434`

## Valid Carrier Prefixes

### Safaricom
- `10X-19X` (100-108, 110-119) - All prefixes
- `70X-72X` (700-729)
- `74X` (740-743, 745-746, 748)
- `75X-75X` (757-759)
- `76X-76X` (768-769)
- `79X` (790-799)

**Valid Examples:** 0722, 0111, 0710, 0768, 0795

### Airtel
- `10X-10X` (100-108)
- `73X` (730-739)
- `75X` (750-756)
- `762`, `767`
- `78X` (780-789)

**Valid Examples:** 0100, 0735, 0750, 0762, 0780

### Other Carriers
- `01X` (010-019)
- `05X` (050-059)
- `07X` (070-089)
- `08X` (080-089)

## Validation Rules

✅ **ACCEPTED:**
- `0722123456` - 10 digits, valid prefix
- `0111810434` - 10 digits, valid Safaricom prefix
- `254722123456` - 12 digits with country code
- `+254722123456` - International format with +

❌ **REJECTED:**
- `722123456` - Missing leading 0 or 254
- `07221234` - Too short (only 8 digits)
- `072212345678` - Too long (more than 10 local digits)

## Automatic Conversion
The system automatically converts phone numbers to international format (`254XXXXXXXXX`) before sending to KCB BUNI STK Push API for consistency and compliance with ICDN standards.

## Phone Number Portability Note
While these prefixes indicate typical network assignments, mobile number portability means a number can be ported from one carrier to another. However, for KCB BUNI STK Push purposes, validation ensures the number format is correct for Kenyan mobile networks.

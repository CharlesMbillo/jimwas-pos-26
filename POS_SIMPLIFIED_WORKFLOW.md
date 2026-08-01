# Simplified POS Workflow - STK Push Only

## Overview
This is a lightweight POS application focused on **STK Push Payment Initiation** via KCB BUNI/M-Pesa.

## Removed Features
The following complex features have been removed to streamline the application:
- **Bill Notification API** (IPN) - Payment confirmations from KCB
- **Bill Validation API** - Pre-payment bill validation
- **Callback Handler** - Webhook-based payment status updates
- **Complex Database Schema** - Removed `bill_validations` and `kcb_notifications` tables

## Core Workflow

### 1. Product Selection (Retail/Wholesale/Offer)
- Customer selects product
- System calculates price based on sale type:
  - **Retail**: Standard pricing
  - **Wholesale**: Bulk discounts + installment options
  - **Offer**: Special promotional discount

### 2. Price Calculation
- Apply appropriate pricing rules
- Calculate final amount for payment

### 3. STK Push Payment
- Call `/functions/v1/kcb-stk-push` Supabase Edge Function
- KCB sends STK prompt to customer phone
- Customer enters M-Pesa PIN to confirm
- Payment is completed on customer device

### 4. Direct Supabase Updates
- On successful payment (manual verification or direct status update):
  - Update invoice record with payment status
  - Update inventory quantities
  - Trigger stock alerts if needed
  - Release product or process order

## Technology Stack
- **Frontend**: React + TypeScript
- **Backend**: Supabase Edge Functions (Deno)
- **Database**: Supabase PostgreSQL
- **Payment**: KCB BUNI M-Pesa API (STK Push only)

## Database Schema
Key tables:
- `invoices` - Transaction records
- `products` - Product catalog
- `inventory` - Stock levels
- `kcb_payments` - Payment initiation records
- `kcb_settings` - KCB credentials and configuration

## Environment Variables
```
KCB_BUNI_BASE_URL
KCB_BUNI_TOKEN_URL
KCB_BUNI_CLIENT_ID
KCB_BUNI_CLIENT_SECRET
KCB_BUNI_CALLBACK_URL (optional, callback URL if needed)
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

## API Endpoints
- `POST /functions/v1/kcb-stk-push` - Initiate STK Push payment

## Notes
- No automatic payment confirmation callbacks
- Payment status updates are manual or poll-based
- System is optimized for quick, lightweight operations
- All unrelated code and documentation has been removed

# Simplified POS Workflow with KCB BUNI APIs - Implementation Guide

## Overview
This document outlines the complete **Simplified POS Workflow** with **automated Supabase triggers** that handle payment confirmation, invoice updates, inventory management, and low-stock alerts.

## Workflow Architecture

### **Three Sale Types Converging at STK Push**

```
┌─────────────────┐  ┌─────────────────┐  ┌──────────────────┐
│  Retail Sale    │  │ Wholesale/      │  │   Offer Sale     │
│                 │  │ Dropshipping    │  │                  │
└────────┬────────┘  └────────┬────────┘  └────────┬─────────┘
         │                    │                    │
    Product        Bulk Order   Multiple      Product    Discount
    Selection      + Pricing    Installments  Selection  Application
         │                    │                    │
         └────────────────────┼────────────────────┘
                              ▼
                      ┌──────────────────┐
                      │  STK Push API    │
                      │ Initiate Payment │
                      └────────┬─────────┘
                               ▼
                      ┌──────────────────┐
                      │ IPN Notification │
                      │ Confirm Payment  │
                      └────────┬─────────┘
                               ▼
         ┌─────────────────────┼──────────────────────┐
         ▼                     ▼                      ▼
   ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
   │Release       │    │Complete Order│    │Release Promo │
   │Product       │    │/ Ship        │    │Product       │
   └──────────────┘    └──────────────┘    └──────────────┘
```

## API Components

### 1. **STK Push API** (`/supabase/functions/kcb-stk/`)
- **Role**: Initiates payment by sending STK Push request to customer
- **Input**: Phone number, amount, transaction description
- **Output**: merchantRequestId, checkoutRequestId
- **Database**: Stores payment record with status `PENDING`

### 2. **IPN Notification API** (`/supabase/functions/kcb-ipn-notification/`)
- **Role**: Receives payment confirmation from KCB and triggers automation
- **Triggers**: Supabase triggers for invoice/inventory/alerts
- **Status Updates**: Changes payment from `PENDING` → `SUCCESS`/`FAILED`

### 3. **Supabase Triggers** (Database Automation)

#### **Trigger 1: Payment → Invoice Update**
```sql
FUNCTION: trigger_payment_to_invoice()
EVENT: AFTER UPDATE on kcb_payments
ACTION: When payment.status = 'SUCCESS', set invoice.payment_status = 'PAID'
RESULT: Invoice marked as paid in the system
```

#### **Trigger 2: Invoice → Inventory Update**
```sql
FUNCTION: trigger_invoice_to_inventory()
EVENT: AFTER UPDATE on invoices
ACTION: When invoice.payment_status = 'PAID', deduct quantities from inventory
RESULT: Automatic stock deduction for all line items
```

#### **Trigger 3: Inventory → Alert Webhook**
```sql
FUNCTION: trigger_inventory_alert_webhook()
EVENT: AFTER UPDATE on inventory
ACTION: When inventory.quantity_available < threshold, send webhook alert
RESULT: Stock-out prevention notifications
```

## Data Flow

### **Phase 1: Payment Initiation (STK Push)**
```
Frontend (POS)
    ↓
    POST /kcb-stk
    ├─ phone: "254712345678"
    ├─ amount: "5000"
    ├─ invoiceNumber: "INV-001"
    └─ accountReference: "order123"
    ↓
kcb_payments table
├─ Status: PENDING
├─ merchantRequestId: abc123
└─ checkoutRequestId: def456
```

### **Phase 2: Payment Confirmation (IPN)**
```
KCB BUNI Gateway
    ↓
    POST /kcb-ipn-notification
    ├─ merchantRequestId: abc123
    ├─ responseCode: "0" (Success)
    └─ mpesaReceiptNumber: "LHI123"
    ↓
[TRIGGER 1] kcb_payments → invoices
├─ kcb_payments.status = SUCCESS
├─ invoices.payment_status = PAID
├─ invoices.paid_date = NOW()
└─ invoices.payment_method = M-PESA
```

### **Phase 3: Inventory Automation (Triggers 2 & 3)**
```
[TRIGGER 2] invoices → inventory_movements
├─ INSERT inventory_movements (quantity, reference)
├─ UPDATE inventory (quantity_available -= sold)
└─ Stock levels updated

[TRIGGER 3] inventory → webhook alerts
├─ IF quantity_available < threshold
├─ THEN send POST to alert webhook
└─ Notification sent to admin
```

## Database Tables

### **kcb_payments**
| Field | Type | Purpose |
|-------|------|---------|
| id | UUID | Primary key |
| merchant_request_id | TEXT UNIQUE | KCB reference |
| checkout_request_id | TEXT | KCB reference |
| phone_number | TEXT | Customer phone |
| amount | DECIMAL | Payment amount |
| status | TEXT | PENDING/SUCCESS/FAILED |
| mpesa_receipt_number | TEXT | M-PESA receipt |
| invoice_number | TEXT | Reference to invoice |

### **invoices**
| Field | Type | Purpose |
|-------|------|---------|
| id | UUID | Primary key |
| invoice_number | TEXT | Invoice reference |
| payment_status | TEXT | UNPAID/PAID |
| paid_date | TIMESTAMP | When payment received |
| payment_method | TEXT | M-PESA/Cash/etc |

### **inventory_movements**
| Field | Type | Purpose |
|-------|------|---------|
| id | UUID | Primary key |
| product_id | UUID | Reference to product |
| movement_type | TEXT | SALE/RESTOCK/RETURN |
| quantity | INTEGER | Quantity changed |
| reference_type | TEXT | INVOICE/ADJUSTMENT |
| reference_id | UUID | Reference ID |

### **ipn_notifications**
| Field | Type | Purpose |
|-------|------|---------|
| id | UUID | Primary key |
| merchant_request_id | TEXT | KCB reference |
| payment_status | TEXT | Confirmation status |
| response_code | TEXT | KCB response code |
| mpesa_receipt_number | TEXT | M-PESA receipt |
| raw_payload | JSONB | Full IPN payload |

## Environment Configuration

### Required Environment Variables
```bash
KCB_BUNI_CLIENT_ID=your_client_id
KCB_BUNI_CLIENT_SECRET=your_client_secret
KCB_BUNI_BASE_URL=https://api.kcb.co.ke
KCB_BUNI_TOKEN_URL=https://api.kcb.co.ke/oauth/authorize
KCB_BUNI_CALLBACK_URL=https://yourapp.com/functions/v1/kcb-ipn-notification
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

### Settings Table Configuration
```sql
INSERT INTO settings (key, value) VALUES
('inventory_alert_threshold', '10'),
('inventory_alert_webhook_url', 'https://your-webhook-endpoint.com/alerts');
```

## Workflow Execution Example

### **Step 1: Customer Completes Purchase**
```
POS App → STK Push Request
├─ Amount: 5,000 KES
├─ Phone: 0712345678
└─ Invoice: INV-20260801-001
```

### **Step 2: Payment Gateway Response**
```
STK Prompt appears on customer's phone
├─ Customer enters M-PESA PIN
└─ KCB confirms transaction
```

### **Step 3: IPN Notification Received**
```
Automatic trigger chain executes:
├─ [Trigger 1] Invoice marked as PAID
├─ [Trigger 2] Inventory quantities deducted
├─ [Trigger 3] Stock alert if below threshold
└─ System fully automated - no manual intervention
```

### **Step 4: Final States**
```
✓ Payment: SUCCESS
✓ Invoice: PAID (with receipt)
✓ Inventory: Updated (audit trail created)
✓ Stock Alerts: Sent if needed
```

## Error Handling

### Payment Failures
- If response code != "0", payment marked as FAILED
- No inventory deduction occurs
- Manual review required

### Webhook Timeout
- IPN notification stored in `ipn_notifications` table
- Webhook alert retry handled by Supabase jobs
- Admin can view audit trail in DB

### Threshold Alerts
- Webhook alert sent immediately when stock < threshold
- Multiple alerts prevented by idempotent webhook design
- Configuration via settings table allows dynamic threshold changes

## Testing the Workflow

### Local Testing
```bash
# 1. Start Supabase
supabase start

# 2. Run migrations
supabase migration up

# 3. Test STK Push endpoint
curl -X POST http://localhost:3000/functions/v1/kcb-stk \
  -H "Content-Type: application/json" \
  -d '{
    "phone": "254712345678",
    "amount": "5000",
    "invoiceNumber": "INV-TEST-001",
    "accountReference": "test123"
  }'

# 4. Simulate IPN notification
curl -X POST http://localhost:3000/functions/v1/kcb-ipn-notification \
  -H "Content-Type: application/json" \
  -d '{
    "merchantRequestId": "abc123",
    "checkoutRequestId": "def456",
    "responseCode": "0",
    "mpesaReceiptNumber": "LHI123"
  }'

# 5. Verify triggers executed
SELECT * FROM invoices WHERE payment_status = 'PAID';
SELECT * FROM inventory_movements WHERE movement_type = 'SALE';
```

## Monitoring & Logs

### View Trigger Logs
```sql
SELECT * FROM pgsql_log 
WHERE message LIKE '%Trigger%' 
ORDER BY created_at DESC;
```

### Monitor Payment Flow
```sql
SELECT * FROM kcb_payments 
ORDER BY created_at DESC LIMIT 10;

SELECT * FROM ipn_notifications 
ORDER BY received_at DESC LIMIT 10;
```

## Deployment Checklist

- [ ] Deploy migrations: `supabase db push`
- [ ] Deploy functions: `supabase functions deploy`
- [ ] Configure webhook URL in settings table
- [ ] Set inventory alert threshold
- [ ] Test STK Push with test credentials
- [ ] Verify IPN notification delivery
- [ ] Monitor first production transactions

## Success Metrics

✓ Payment confirmation received within 10 seconds
✓ Invoice auto-marked as PAID without delay
✓ Inventory updated automatically for all sales
✓ Stock alerts triggered when threshold reached
✓ Zero manual steps required in payment-to-fulfillment flow

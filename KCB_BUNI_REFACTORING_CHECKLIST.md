# KCB Buni Refactoring Checklist & Implementation Guide

## Quick Reference: What Needs to Change

### Current Architecture (M-Pesa Only)
```
Client → STK Popup
   ↓
User approves payment
   ↓
M-Pesa → Callback to /mpesa-callback
   ↓
Database updated ✅
```

### Target Architecture (KCB Buni Complete)
```
┌─────────────────────────────────────────────────────────┐
│ BILL-VALIDATION FLOW                                    │
│ KCB → POST /bill-validation                             │
│ 3rd party → Validates customer & returns bill details   │
│ Response: { CustomerName, billAmount, billType, ... }   │
└─────────────────────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────────────────┐
│ PAYMENT PROCESSING                                      │
│ Customer makes payment on KCB channel                   │
│ (Till, Mobile App, Web, etc.)                           │
└─────────────────────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────────────────┐
│ BILL-NOTIFICATION FLOW                                  │
│ KCB → POST /bill-notification with signature            │
│ 3rd party → Verifies signature & updates DB             │
│ Response: { statusCode: "0", statusMessage: "..." }     │
└─────────────────────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────────────────┐
│ STK PUSH FLOW (Alternative)                             │
│ Client → Initiates STK push                             │
│ M-Pesa → STK Popup                                      │
│ User approves → M-Pesa callback                         │
│ Also arrives at endpoint (same signature verification)  │
└─────────────────────────────────────────────────────────┘
             ↓
┌─────────────────────────────────────────────────────────┐
│ TILL NOTIFICATION (IPN) FLOW                            │
│ Customer pays to Till                                   │
│ KCB → POST /till-notification with signature            │
│ 3rd party → Verifies signature & updates DB             │
│ Response: { header: { statusCode: "0" }, ... }          │
└─────────────────────────────────────────────────────────┘
```

---

## Implementation Checklist

### [ ] Phase 1: Add Signature Verification Infrastructure

**File to create:** `src/lib/kcb-signature.ts`

```typescript
// Functions needed:
- verifyKCBSignature(signature, body, publicKey)
- getKCBPublicKey()
- validateRequestSignature(req)

// Tests:
- Test with sample KCB signature from documentation
- Test with tampered payload (should fail)
```

**Environment variables to add:**
```
KCB_PUBLIC_KEY_BASE64=<provided-by-kcb>
KCB_ENVIRONMENT=sandbox|production
```

**Dependencies to install:**
```
npm install crypto
```

**Verification Steps:**
- [ ] Create signature verification utility
- [ ] Write unit tests for signature verification
- [ ] Test with provided KCB sample signatures
- [ ] Document public key storage process

---

### [ ] Phase 2: Create Bill-Validation Endpoint

**File to create:** `supabase/functions/bill-validation/index.ts`

**Request (from KCB):**
```json
{
  "requestId": "d115245e-9604-49de-9436-9fdcb539871f",
  "customerReference": "SAMPLE####",
  "organizationReference": "777777"
}
```

**Response (to KCB):**
```json
{
  "transactionID": "123456789",
  "statusCode": "0",
  "statusMessage": "Success",
  "CustomerName": "Mkenya",
  "billAmount": "100.00",
  "currency": "KES",
  "billType": "FIXED",
  "creditAccountIdentifier": "1234567800001"
}
```

**Implementation Steps:**
- [ ] Create edge function file
- [ ] Add request validation (check all required fields)
- [ ] Query database for invoice/bill details
- [ ] Return customer info with bill amount
- [ ] Handle not-found cases (return error statusCode)
- [ ] Add CORS headers
- [ ] Add error handling & logging
- [ ] Create database view for bill lookup

**Database Query Example:**
```sql
-- Find bill by invoice number (customerReference)
SELECT 
  t.id as transactionID,
  CONCAT(c.first_name, ' ', c.last_name) as CustomerName,
  t.amount as billAmount,
  'KES' as currency,
  'FIXED' as billType,
  t.account_identifier as creditAccountIdentifier
FROM transactions t
JOIN customers c ON t.customer_id = c.id
WHERE t.invoice_number = $1
  AND t.organization_id = $2
```

**Tests:**
- [ ] Valid bill lookup returns correct data
- [ ] Invalid invoice returns error
- [ ] Malformed request returns 400
- [ ] Response format matches spec exactly

---

### [ ] Phase 3: Create Bill-Notification Endpoint

**File to create:** `supabase/functions/bill-notification/index.ts`

**Request (from KCB with signature header):**
```json
Header: signature: <RSA-signature>

Body:
{
  "transactionReference": "FT00026252",
  "requestId": "c7d702cb-6b5f-4fa6-8b57-436d0f789017",
  "channelCode": "202",
  "timestamp": "2021111103005",
  "transactionAmount": "100.00",
  "currency": "KES",
  "customerReference": "INV-0001",
  "customerName": "John Doe",
  "customerMobileNumber": "25471111111",
  "balance": "100000.00",
  "narration": "Payment for goods",
  "creditAccountIdentifier": "JD001",
  "organizationShortCode": "777777",
  "tillNumber": "150150"
}
```

**Response (to KCB):**
```json
{
  "transactionID": "123456789",
  "statusCode": 0,
  "statusMessage": "Notification received"
}
```

**Implementation Steps:**
- [ ] Verify signature (CRITICAL - from header)
- [ ] Parse notification payload
- [ ] Create/update transaction record
- [ ] Link to POS transaction by customerReference
- [ ] Update status to "completed"
- [ ] Store payment details (receipt, amount, date)
- [ ] Handle duplicate notifications (idempotent)
- [ ] Return proper response format

**Database Operations:**
```sql
-- Update or create transaction
INSERT INTO mpesa_transactions (
  transaction_reference,
  request_id,
  channel_code,
  transaction_amount,
  customer_reference,
  customer_name,
  status
) VALUES ($1, $2, $3, $4, $5, $6, 'completed')
ON CONFLICT (transaction_reference) 
DO UPDATE SET status = 'completed', updated_at = NOW()

-- Link to POS transaction
UPDATE transactions 
SET payment_reference = $1, status = 'completed'
WHERE invoice_number = $2
```

**Tests:**
- [ ] Valid notification updates database
- [ ] Signature verification passes for valid request
- [ ] Signature verification fails for tampered data
- [ ] Duplicate notifications handled correctly
- [ ] Response format matches spec exactly
- [ ] Missing required fields returns error

---

### [ ] Phase 4: Create Till-Notification (IPN) Endpoint

**File to create:** `supabase/functions/till-notification/index.ts`

**Request (from KCB with signature header):**
```json
Header: signature: <RSA-signature>

Body:
{
  "header": {
    "messageID": "uniqueMessageId",
    "originatorConversationID": "",
    "channelCode": "202",
    "timeStamp": "20201117101010"
  },
  "requestPayload": {
    "primaryData": {
      "businessKey": "000000",
      "businessKeyType": "queryBiller"
    },
    "additionalData": {
      "notificationData": {
        "businessKey": "P-INV-001",
        "businessKeyType": "BillReferenceNumber",
        "debitMSISDN": "254722520441",
        "transactionAmt": "100.00",
        "transactionDate": "20201102",
        "transactionID": "FT235373",
        "firstName": "James",
        "middleName": "Jay",
        "lastName": "Armstrong",
        "currency": "KES",
        "narration": "ticket payment",
        "transactionType": "vooma",
        "balance": "0.00"
      }
    }
  }
}
```

**Response (to KCB):**
```json
{
  "header": {
    "messageID": "123456789",
    "originatorConversationID": "214ea73ca36c426b99920aed42fa390c",
    "statusCode": "0",
    "statusMessage": "Notification received"
  },
  "responsePayload": {
    "transactionInfo": {
      "transactionId": "38212940"
    }
  }
}
```

**Implementation Steps:**
- [ ] Verify signature from header (CRITICAL)
- [ ] Extract header fields (messageID, channelCode, timestamp)
- [ ] Parse nested notification data
- [ ] Create till_notification record
- [ ] Link to existing transaction by invoice reference
- [ ] Extract customer name from firstName/lastName
- [ ] Handle idempotency (by messageID)
- [ ] Return proper nested response format

**Database Operations:**
```sql
-- Create till notification record
INSERT INTO till_notifications (
  message_id,
  transaction_id,
  transaction_amount,
  debit_msisdn,
  transaction_date,
  channel_code,
  status,
  payload
) VALUES ($1, $2, $3, $4, $5, $6, 'received', $7)

-- Update linked transaction
UPDATE transactions 
SET status = 'completed', payment_reference = $1
WHERE invoice_number = $2
```

**Tests:**
- [ ] Valid IPN updates database
- [ ] Signature verification works
- [ ] Nested response format is correct
- [ ] Customer name parsed from firstName/lastName
- [ ] Idempotency on duplicate messageID
- [ ] All required fields present in response

---

### [ ] Phase 5: Update Database Schema

**Migration file to create:** `supabase/migrations/add_kcb_buni_tables.sql`

```sql
-- New table: Bill Validations
CREATE TABLE bill_validations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id VARCHAR NOT NULL UNIQUE,
  customer_reference VARCHAR NOT NULL,
  organization_reference VARCHAR NOT NULL,
  customer_name VARCHAR,
  bill_amount DECIMAL(12,2),
  bill_type VARCHAR CHECK (bill_type IN ('FIXED', 'PARTIAL')),
  credit_account_identifier VARCHAR,
  status VARCHAR CHECK (status IN ('received', 'processed', 'failed')),
  response_payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- New table: Till Notifications (IPN)
CREATE TABLE till_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id VARCHAR NOT NULL UNIQUE,
  originator_conversation_id VARCHAR,
  transaction_id VARCHAR NOT NULL,
  transaction_amount DECIMAL(12,2),
  currency VARCHAR DEFAULT 'KES',
  debit_msisdn VARCHAR,
  transaction_date VARCHAR,
  channel_code VARCHAR,
  first_name VARCHAR,
  middle_name VARCHAR,
  last_name VARCHAR,
  narration VARCHAR,
  transaction_type VARCHAR,
  balance DECIMAL(15,2),
  signature_verified BOOLEAN DEFAULT FALSE,
  status VARCHAR CHECK (status IN ('received', 'processed', 'failed')),
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  linked_transaction_id UUID REFERENCES transactions(id)
);

-- Update mpesa_transactions table
ALTER TABLE mpesa_transactions ADD COLUMN IF NOT EXISTS signature_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE mpesa_transactions ADD COLUMN IF NOT EXISTS channel_code VARCHAR;
ALTER TABLE mpesa_transactions ADD COLUMN IF NOT EXISTS till_number VARCHAR;
ALTER TABLE mpesa_transactions ADD COLUMN IF NOT EXISTS customer_first_name VARCHAR;
ALTER TABLE mpesa_transactions ADD COLUMN IF NOT EXISTS customer_last_name VARCHAR;

-- Create indexes for performance
CREATE INDEX idx_bill_validations_request_id ON bill_validations(request_id);
CREATE INDEX idx_till_notifications_message_id ON till_notifications(message_id);
CREATE INDEX idx_till_notifications_transaction_id ON till_notifications(transaction_id);
CREATE INDEX idx_mpesa_transactions_signature_verified ON mpesa_transactions(signature_verified);

-- Enable RLS if using Supabase Auth
ALTER TABLE bill_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE till_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies (adjust based on your auth model)
CREATE POLICY "Authenticated users can view bill validations"
  ON bill_validations FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

CREATE POLICY "Service functions can insert till notifications"
  ON till_notifications FOR INSERT
  WITH CHECK (true);
```

**Migration Steps:**
- [ ] Create migration file
- [ ] Add bill_validations table
- [ ] Add till_notifications table
- [ ] Add columns to mpesa_transactions
- [ ] Create indexes
- [ ] Run migration against Supabase dev/prod
- [ ] Verify schema in Supabase dashboard

---

### [ ] Phase 6: Update Environment Configuration

**File to update:** `.env.example`

```env
# KCB Buni Integration
KCB_PUBLIC_KEY_BASE64=<base64-encoded-RSA-public-key-from-kcb>
KCB_ENVIRONMENT=sandbox
KCB_ORGANIZATION_CODE=<your-org-short-code>

# IPN Endpoints (register these URLs with KCB)
KCB_BILL_VALIDATION_CALLBACK_URL=https://jimwas-enterprises-pos-beta.vercel.app/api/bill-validation
KCB_BILL_NOTIFICATION_CALLBACK_URL=https://jimwas-enterprises-pos-beta.vercel.app/api/bill-notification
KCB_TILL_NOTIFICATION_CALLBACK_URL=https://jimwas-enterprises-pos-beta.vercel.app/api/till-notification

# Signature verification
KCB_SIGNATURE_VERIFICATION_ENABLED=true
```

**Vercel Project Settings:**
- [ ] Add KCB_PUBLIC_KEY_BASE64 to environment variables
- [ ] Set KCB_ENVIRONMENT to "sandbox" initially
- [ ] Register IPN URLs with KCB
- [ ] Configure redirects if needed

---

### [ ] Phase 7: Update Response Structures

**File to update:** `mpesa-callback/index.ts`

**Current Response (WRONG):**
```typescript
return new Response(
  JSON.stringify({ ResultCode: 0, ResultDesc: 'Success' }),
  { status: 200 }
);
```

**New Response (KCB Buni Format):**
```typescript
// For STK Push callbacks (from M-Pesa)
return new Response(
  JSON.stringify({ 
    ResultCode: 0, 
    ResultDesc: 'Success' 
  }),
  { status: 200 }
);

// For Till Notifications (from KCB)
return new Response(
  JSON.stringify({
    header: {
      messageID: req.headers.get('messageID'),
      originatorConversationID: body.header.originatorConversationID,
      statusCode: '0',
      statusMessage: 'Notification received'
    },
    responsePayload: {
      transactionInfo: {
        transactionId: transaction.id
      }
    }
  }),
  { status: 200 }
);
```

**Changes Needed:**
- [ ] Keep STK Push response as-is (M-Pesa format)
- [ ] Add Till Notification response handler
- [ ] Add Bill Notification response handler
- [ ] Ensure response matches exact KCB spec
- [ ] Add logging for response format debugging

---

### [ ] Phase 8: Security Hardening

**File to update:** `supabase/functions/*/index.ts`

**Add to all KCB endpoints:**
```typescript
// 1. Signature verification (REQUIRED)
const signature = req.headers.get('signature');
if (!signature) {
  return new Response(
    JSON.stringify({ error: 'Missing signature' }),
    { status: 401 }
  );
}

const isValid = await verifyKCBSignature(
  signature,
  await req.text(),
  KCB_PUBLIC_KEY
);

if (!isValid) {
  console.error('Signature verification failed');
  return new Response(
    JSON.stringify({ error: 'Invalid signature' }),
    { status: 401 }
  );
}

// 2. Rate limiting
const clientIP = req.headers.get('cf-connecting-ip') || 'unknown';
const rateLimitKey = `kcb:${clientIP}`;
// Check rate limit

// 3. Request logging
console.log(`[KCB] Received from ${clientIP}:`, {
  endpoint: new URL(req.url).pathname,
  timestamp: new Date().toISOString(),
  headers: Object.fromEntries(req.headers),
});

// 4. Input validation
if (!body.requestId || !body.customerReference) {
  return errorResponse(400, 'Missing required fields');
}
```

**Security Checklist:**
- [ ] Signature verification on all endpoints
- [ ] Request validation (no nulls, proper types)
- [ ] Rate limiting per IP
- [ ] Comprehensive logging
- [ ] Error handling without exposing internals
- [ ] HTTPS only (enforced by Vercel)
- [ ] CORS properly configured
- [ ] No hardcoded secrets

---

## Testing Strategy

### [ ] Unit Tests

```typescript
// test/kcb-signature.test.ts
- Test valid signature verification
- Test invalid signature rejection
- Test tampered payload detection
- Test with KCB sample signatures

// test/bill-validation.test.ts
- Test valid bill lookup
- Test invalid invoice number
- Test response format
- Test error cases

// test/bill-notification.test.ts
- Test signature verification
- Test transaction update
- Test idempotency
- Test response format

// test/till-notification.test.ts
- Test nested payload parsing
- Test signature verification
- Test nested response format
- Test duplicate handling
```

### [ ] Integration Tests

```typescript
// test/integration/kcb-flow.test.ts
- Test complete bill-validation → payment → notification flow
- Test error recovery
- Test concurrent requests
- Test database consistency
```

### [ ] KCB Sandbox Testing

**Before UAT with KCB:**
- [ ] Test with KCB sandbox environment
- [ ] Use sample payloads from documentation
- [ ] Verify all endpoints respond correctly
- [ ] Check database updates
- [ ] Verify signature verification works
- [ ] Test error scenarios
- [ ] Monitor logs for issues
- [ ] Performance test with load

---

## Rollout Plan

### Stage 1: Development (Week 1-2)
- [ ] Implement all 5 phases locally
- [ ] Write and run unit tests
- [ ] Deploy to Vercel preview
- [ ] Test in Supabase sandbox

### Stage 2: Staging (Week 3)
- [ ] Deploy to staging environment
- [ ] Register endpoints with KCB sandbox
- [ ] Run KCB integration tests
- [ ] Performance & load testing
- [ ] Security review

### Stage 3: UAT with KCB (Week 4)
- [ ] Provide endpoint URLs to KCB
- [ ] KCB tests signature verification
- [ ] KCB tests all 3 flows
- [ ] KCB verifies response formats
- [ ] Certification sign-off

### Stage 4: Production (After UAT)
- [ ] Deploy to production
- [ ] Update KCB production endpoints
- [ ] Monitor logs closely
- [ ] Prepare incident response plan

---

## Success Criteria

**Code is production-ready when:**
- [ ] All 3 payment flows implemented (Bill-Validation, Bill-Notification, Till-Notification)
- [ ] Signature verification working and tested
- [ ] All response formats match KCB spec exactly
- [ ] Database schema supports all fields
- [ ] 100% unit test coverage for critical paths
- [ ] Signature verification passes UAT verification
- [ ] KCB certifies integration
- [ ] Zero critical security findings

---

## Important Notes

⚠️ **CRITICAL:** Signature verification WILL be verified during KCB UAT. This is not optional.

⚠️ **DO NOT skip phases** - they are sequential and depend on each other.

⚠️ **Test with provided samples** - KCB provides sample payloads in documentation. Use them.

⚠️ **Response format matters** - KCB will reject responses that don't match spec exactly.

✅ **Keep M-Pesa flow** - Don't break existing STK Push functionality while adding KCB support.

---

## Questions to Ask KCB During Integration

1. What is the RSA public key for signature verification (sandbox & production)?
2. Are there sandbox accounts we can test bill-validation with?
3. How do we test till payments in sandbox?
4. What are the retry policies if our endpoint is down?
5. Are there any IP whitelist requirements?
6. What's the expected timeout for each endpoint?
7. Are there transaction volume limits in sandbox?
8. How do we handle failed signature verification?

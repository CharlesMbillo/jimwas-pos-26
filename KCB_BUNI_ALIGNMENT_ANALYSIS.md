# KCB Buni IPN Alignment Analysis & Refactoring Requirements

## Executive Summary

**CRITICAL FINDINGS:** The current M-Pesa IPN implementation requires **MAJOR REFACTORING** to align with KCB Buni documentation. Current code handles only **STK Push callbacks** but is missing two critical integration points required by KCB Buni:

1. ❌ **Bill-Validation Endpoint** (MISSING)
2. ❌ **Bill-Notification Endpoint** (MISSING)  
3. ❌ **Signature Verification** (MISSING - REQUIRED by KCB)
4. ❌ **Till Notification IPN** (MISSING)

---

## 1. KCB Buni Documentation Overview

### Three Distinct Payment Flows

#### A. **STK Push (M-Pesa Express)** - Currently Implemented ✅
- Client initiates payment via STK popup
- M-Pesa sends callback with result
- **Current Implementation:** `mpesa-callback/index.ts` handles this

#### B. **Bill-Validation & Bill-Notification** - NOT Implemented ❌
- KCB queries 3rd party to validate bill details
- 3rd party responds with customer info, amount, bill type
- Payment occurs on KCB system
- KCB notifies 3rd party after crediting account

#### C. **Till Payment Notification (IPN)** - NOT Implemented ❌
- Customer pays to KCB Till
- KCB sends IPN notification to 3rd party
- Different payload structure than STK Push
- Requires signature verification (SHA256withRSA)

---

## 2. Current Implementation Analysis

### ✅ What Exists

**Implemented Functions:**
- `kcb-stk-push` - Initiates STK Push payment
- `mpesa-callback` - Receives STK Push callback
- `mpesa-status` - Polls transaction status
- `mpesa-simulate` - Sandbox testing

**Database Schema:**
- `mpesa_transactions` table stores payment records
- `transactions` table links to POS sales

### ❌ What's Missing

1. **No Bill-Validation Endpoint**
   - KCB will POST validation requests to: `{API_URL}/bill-validation`
   - Expected to validate bills and return customer details
   - Currently no endpoint for this

2. **No Bill-Notification Endpoint**
   - KCB will POST notifications to: `{API_URL}/bill-notification`
   - Confirms payment crediting to account
   - Currently not implemented

3. **No Signature Verification**
   - **CRITICAL SECURITY ISSUE:** All KCB notifications include a signature header
   - Signature type: SHA256withRSA
   - Must verify using KCB's public key
   - Current code ignores the signature header entirely

4. **No Till Notification Handler**
   - Till payments use different IPN payload structure
   - Different field names and header structure
   - No handler exists for this flow

5. **Wrong Callback Payload Structure**
   - Current code expects: `{ Body: { stkCallback: { ... } } }`
   - KCB Buni structure: `{ header: { ... }, requestPayload: { ... } }`
   - These are fundamentally different payload formats

---

## 3. Detailed Payload Alignment Issues

### Issue 1: Current STK Push Callback Format (M-Pesa Direct)

```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "string",
      "CheckoutRequestID": "string",
      "ResultCode": 0,
      "ResultDesc": "string",
      "CallbackMetadata": { "Item": [...] }
    }
  }
}
```

**Source:** Safaricom M-Pesa API (NOT KCB)

### Issue 2: KCB Till Notification Format (KCB Buni)

```json
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
        "lastName": "Armstrong",
        "currency": "KES",
        "narration": "ticket payment",
        "balance": "0.00"
      }
    }
  }
}
```

**Source:** KCB Buni Till Notification API

### Issue 3: Validation Payload (Different Structure)

```json
{
  "requestId": "d115245e-9604-49de-9436-9fdcb539871f",
  "customerReference": "SAMPLE####",
  "organizationReference": "777777"
}
```

**Expected Response:**
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

---

## 4. Critical Security Gap: Signature Verification

### ❌ Current Implementation
```typescript
// NO SIGNATURE VERIFICATION!
const corsHeaders = { /* CORS setup */ };
const body = await req.json();
// Directly processes body without verification
```

### ✅ Required Implementation (KCB Buni)

```
Header: signature: <base64-encoded-RSA-signature>
Algorithm: SHA256withRSA
Required: YES (will be verified during UAT)

Steps:
1. Extract signature from request header
2. Get KCB's public key
3. Decode base64 signature
4. Verify signature against request body
5. If verification fails, reject request
```

**Note:** KCB explicitly states: "This will be verified during UATs to ensure compliance by 3rd party systems."

---

## 5. Refactoring Roadmap

### Phase 1: Implement Missing Endpoints (HIGH PRIORITY)

#### New Endpoint 1: Bill-Validation
- **Route:** `/functions/v1/bill-validation`
- **Method:** POST
- **Purpose:** Validate bill details before payment
- **Flow:**
  1. KCB POSTs validation request with `customerReference`
  2. System looks up customer/bill in database
  3. Return customer name, amount, bill type
  4. Include `creditAccountIdentifier` (your account reference)

#### New Endpoint 2: Bill-Notification
- **Route:** `/functions/v1/bill-notification`
- **Method:** POST
- **Purpose:** Receive payment confirmation after crediting
- **Flow:**
  1. KCB POSTs notification after payment
  2. Verify signature (SHA256withRSA)
  3. Update transaction status to `completed`
  4. Link to POS transaction
  5. Return acknowledgment with `statusCode: 0`

#### New Endpoint 3: Till-Notification (IPN)
- **Route:** `/functions/v1/till-notification`
- **Method:** POST
- **Purpose:** Handle till payment notifications
- **Flow:**
  1. KCB POSTs notification after till payment
  2. Verify signature (SHA256withRSA)
  3. Parse different payload structure
  4. Create/update transaction record
  5. Return acknowledgment

### Phase 2: Implement Signature Verification (CRITICAL)

Create utility function: `verifyKCBSignature()`
```typescript
async function verifyKCBSignature(
  signature: string,      // From header
  body: string,           // Raw request body
  publicKey: string       // KCB's public key
): Promise<boolean> {
  // Use crypto to verify SHA256withRSA signature
}
```

### Phase 3: Refactor Response Structures

#### Current Response (Wrong)
```typescript
return new Response(
  JSON.stringify({ ResultCode: 0, ResultDesc: 'Success' }),
  { status: 200 }
);
```

#### KCB Buni Response Format (Correct)

**For Bill-Notification:**
```json
{
  "transactionID": "123456789",
  "statusCode": "0",
  "statusMessage": "Notification received"
}
```

**For Till-Notification (IPN):**
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

### Phase 4: Update Database Schema

#### New Tables Needed

**1. bill_validations**
```sql
- id (PK)
- request_id (from KCB)
- customer_reference (invoice number)
- organization_reference (org code)
- customer_name
- bill_amount
- bill_type (FIXED/PARTIAL)
- status
- created_at
```

**2. till_notifications**
```sql
- id (PK)
- message_id (from KCB)
- transaction_reference
- transaction_id (KCB's receipt)
- customer_reference
- transaction_amount
- currency
- status
- callback_payload
- signature_verified
- created_at
```

#### Update Existing Tables

**mpesa_transactions:** Add fields
```sql
- bill_type VARCHAR
- channel_code VARCHAR
- customer_first_name VARCHAR
- customer_last_name VARCHAR
- signature_verified BOOLEAN
- till_number VARCHAR
```

### Phase 5: Configuration Updates

Add to `.env.example`:
```
# KCB Buni Signature Verification
KCB_PUBLIC_KEY=<base64-encoded-RSA-public-key>

# IPN Endpoints (register these with KCB)
IPN_BILL_VALIDATION_URL=https://jimwas-enterprises-pos-beta.vercel.app/api/bill-validation
IPN_BILL_NOTIFICATION_URL=https://jimwas-enterprises-pos-beta.vercel.app/api/bill-notification
IPN_TILL_NOTIFICATION_URL=https://jimwas-enterprises-pos-beta.vercel.app/api/till-notification
```

---

## 6. Implementation Priority

| Priority | Task | Effort | Impact |
|----------|------|--------|--------|
| 🔴 CRITICAL | Implement signature verification | HIGH | Security issue - UAT blocker |
| 🔴 CRITICAL | Create bill-validation endpoint | MEDIUM | Required for bill payment flow |
| 🔴 CRITICAL | Create bill-notification endpoint | MEDIUM | Required for payment confirmation |
| 🟠 HIGH | Create till-notification (IPN) endpoint | MEDIUM | Required for till payments |
| 🟠 HIGH | Update database schema | MEDIUM | Support new payment types |
| 🟡 MEDIUM | Refactor response structures | MEDIUM | Align with KCB spec |
| 🟡 MEDIUM | Add configuration for public key | LOW | Enable signature verification |

---

## 7. Recommended Action Plan

### ✅ DO REFACTOR - Here's Why:

1. **Current code will FAIL KCB UAT** because:
   - No signature verification (explicitly tested by KCB)
   - No bill-validation endpoint (required flow)
   - No till-notification handler (required flow)
   - Wrong response formats (will be rejected)

2. **Current code is NOT production-ready** for KCB:
   - Only handles M-Pesa STK Push (Safaricom API)
   - Does NOT handle KCB Buni payments
   - Security gap in signature verification

3. **Compliance requirement:**
   - KCB documentation states signature verification "will be verified during UATs"
   - Refactoring is NOT optional

### Timeline Recommendation

- **Week 1:** Implement signature verification + bill-validation endpoint
- **Week 2:** Implement bill-notification + till-notification endpoints
- **Week 3:** Update database schema + configuration
- **Week 4:** UAT testing with KCB

---

## 8. Side-by-Side Comparison

### Current State vs. KCB Buni Requirements

| Feature | Current | KCB Buni Required | Gap |
|---------|---------|-------------------|-----|
| STK Push callback | ✅ Implemented | ✅ Supported | None |
| Bill-Validation | ❌ Missing | ✅ Required | Must implement |
| Bill-Notification | ❌ Missing | ✅ Required | Must implement |
| Till Notification IPN | ❌ Missing | ✅ Required | Must implement |
| Signature Verification | ❌ None | ✅ Required | CRITICAL |
| Payload Format (Till) | ❌ Wrong | ✅ Specific format | Must update |
| Response Format | ⚠️ Partial | ✅ Specific format | Must update |
| Error Handling | ✅ Exists | ✅ Must handle edge cases | May need update |

---

## Conclusion

**REFACTORING IS REQUIRED AND CRITICAL**

The current implementation:
- ✅ Works for M-Pesa STK Push (Safaricom)
- ❌ Does NOT work for KCB Buni integration
- ❌ Will FAIL KCB UAT
- ⚠️ Has security gap (no signature verification)

**Recommendation:** Proceed with Phase 1-5 refactoring before UAT engagement with KCB.

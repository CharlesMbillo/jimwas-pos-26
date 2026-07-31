# KCB BUNI IPN Endpoints & Sandbox Testing Reference

## Quick Summary - JIMWAS Enterprises Configuration

**Business Details:**
- Business Name: JIMWAS ENTERPRISES
- Paybill: 522522
- Account: 7941675
- Phone Format: 254XXXXXXXXX (Kenya M-Pesa)

---

## IPN Endpoints for Testing & Validation

### 1. Bill-Validation Endpoint

**Endpoint URL:**
```
POST /functions/v1/kcb-bill-validation
```

**Full URL (Supabase):**
```
https://<your-supabase-url>/functions/v1/kcb-bill-validation
```

**Purpose:** Validate if a bill exists when customer enters invoice number

**Request Headers:**
```
Content-Type: application/json
```

**Request Body:**
```json
{
  "requestId": "d115245e-9604-49de-9436-9fdcb539871f",
  "customerReference": "INV-20260729-001",
  "organizationReference": "522522"
}
```

**Success Response (200):**
```json
{
  "transactionID": "JIMWAS-001",
  "statusCode": "0",
  "statusMessage": "Success",
  "CustomerName": "John Doe",
  "billAmount": "1000.00",
  "currency": "KES",
  "billType": "FIXED",
  "creditAccountIdentifier": "7941675"
}
```

**Error Response (200):**
```json
{
  "transactionID": "0",
  "statusCode": "1",
  "statusMessage": "Bill not found",
  "CustomerName": "",
  "billAmount": "0.00",
  "currency": "KES",
  "billType": "FIXED",
  "creditAccountIdentifier": ""
}
```

---

### 2. Bill-Notification Endpoint (IPN)

**Endpoint URL:**
```
POST /functions/v1/kcb-bill-notification
```

**Full URL:**
```
https://<your-supabase-url>/functions/v1/kcb-bill-notification
```

**Purpose:** Receive payment notifications from KCB when customer pays bill

**Request Headers:**
```
Content-Type: application/json
signature: <base64-encoded-RSA-signature>
```

**Request Body (Sample):**
```json
{
  "transactionReference": "FT00026252",
  "requestId": "c7d702cb-6b5f-4fa6-8b57-436d0f789017",
  "channelCode": "202",
  "timestamp": "20260729103000",
  "transactionAmount": "1000.00",
  "currency": "KES",
  "customerReference": "INV-20260729-001",
  "customerName": "John Doe",
  "customerMobileNumber": "254722000001",
  "balance": "50000.00",
  "narration": "Payment for goods",
  "creditAccountIdentifier": "7941675",
  "organizationShortCode": "522522",
  "tillNumber": "000001"
}
```

**Success Response (200):**
```json
{
  "transactionID": "JIMWAS-001",
  "statusCode": 0,
  "statusMessage": "Notification received"
}
```

**Signature Verification Error (401):**
```json
{
  "transactionID": "0",
  "statusCode": 1,
  "statusMessage": "Signature verification failed"
}
```

**Processing Error (200):**
```json
{
  "transactionID": "0",
  "statusCode": 1,
  "statusMessage": "Processing failed"
}
```

---

### 3. Till-Notification Endpoint (IPN)

**Endpoint URL:**
```
POST /functions/v1/kcb-till-notification
```

**Full URL:**
```
https://<your-supabase-url>/functions/v1/kcb-till-notification
```

**Purpose:** Receive till payment notifications (used for unstructured payments)

**Request Headers:**
```
Content-Type: application/json
signature: <base64-encoded-RSA-signature>
```

**Request Body (Sample):**
```json
{
  "header": {
    "messageID": "msg-20260729-001",
    "originatorConversationID": "conv-20260729-001",
    "channelCode": "202",
    "timeStamp": "20260729103000"
  },
  "requestPayload": {
    "primaryData": {
      "businessKey": "000000",
      "businessKeyType": "queryBiller"
    },
    "additionalData": {
      "notificationData": {
        "businessKey": "INV-20260729-001",
        "businessKeyType": "BillReferenceNumber",
        "debitMSISDN": "254722000001",
        "transactionAmt": "1000.00",
        "transactionDate": "20260729",
        "transactionID": "FT000001",
        "firstName": "John",
        "lastName": "Doe",
        "currency": "KES",
        "narration": "Till payment",
        "balance": "50000.00"
      }
    }
  }
}
```

**Success Response (200):**
```json
{
  "header": {
    "messageID": "msg-20260729-001",
    "originatorConversationID": "conv-20260729-001",
    "statusCode": "0",
    "statusMessage": "Notification received"
  },
  "responsePayload": {
    "transactionInfo": {
      "transactionId": "JIMWAS-001"
    }
  }
}
```

**Signature Error (401):**
```json
{
  "header": {
    "messageID": "error",
    "originatorConversationID": "",
    "statusCode": "1",
    "statusMessage": "Signature verification failed"
  },
  "responsePayload": {
    "transactionInfo": { "transactionId": "0" }
  }
}
```

---

## Sandbox Testing Payloads

### Test Scenario 1: Successful Bill Validation & Payment

**Step 1: Bill Validation Request**
```bash
curl -X POST https://your-supabase-url/functions/v1/kcb-bill-validation \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "test-req-001",
    "customerReference": "TEST-INVOICE-001",
    "organizationReference": "522522"
  }'
```

**Expected Response:**
```json
{
  "transactionID": "JIMWAS-001",
  "statusCode": "0",
  "statusMessage": "Success",
  "CustomerName": "Test Customer",
  "billAmount": "500.00",
  "currency": "KES",
  "billType": "FIXED",
  "creditAccountIdentifier": "7941675"
}
```

**Step 2: Bill Notification (IPN from KCB)**
```bash
curl -X POST https://your-supabase-url/functions/v1/kcb-bill-notification \
  -H "Content-Type: application/json" \
  -H "signature: <base64-signature>" \
  -d '{
    "transactionReference": "FT-TEST-001",
    "requestId": "test-req-001",
    "channelCode": "202",
    "timestamp": "20260729120000",
    "transactionAmount": "500.00",
    "currency": "KES",
    "customerReference": "TEST-INVOICE-001",
    "customerName": "Test Customer",
    "customerMobileNumber": "254722000001",
    "balance": "99500.00",
    "narration": "Test payment",
    "creditAccountIdentifier": "7941675",
    "organizationShortCode": "522522",
    "tillNumber": "000001"
  }'
```

**Expected Response:**
```json
{
  "transactionID": "JIMWAS-001",
  "statusCode": 0,
  "statusMessage": "Notification received"
}
```

---

### Test Scenario 2: Bill Not Found

**Request:**
```bash
curl -X POST https://your-supabase-url/functions/v1/kcb-bill-validation \
  -H "Content-Type: application/json" \
  -d '{
    "requestId": "test-req-002",
    "customerReference": "NONEXISTENT-001",
    "organizationReference": "522522"
  }'
```

**Expected Response:**
```json
{
  "transactionID": "0",
  "statusCode": "1",
  "statusMessage": "Bill not found",
  "CustomerName": "",
  "billAmount": "0.00",
  "currency": "KES",
  "billType": "FIXED",
  "creditAccountIdentifier": ""
}
```

---

### Test Scenario 3: Invalid Signature in IPN

**Request (with tampered signature):**
```bash
curl -X POST https://your-supabase-url/functions/v1/kcb-bill-notification \
  -H "Content-Type: application/json" \
  -H "signature: INVALID_BASE64_SIGNATURE_HERE" \
  -d '{
    "transactionReference": "FT-TEST-002",
    ...
  }'
```

**Expected Response:**
```json
{
  "transactionID": "0",
  "statusCode": 1,
  "statusMessage": "Signature verification failed"
}
```

**HTTP Status: 401**

---

### Test Scenario 4: Till Payment Notification

**Request:**
```bash
curl -X POST https://your-supabase-url/functions/v1/kcb-till-notification \
  -H "Content-Type: application/json" \
  -H "signature: <base64-signature>" \
  -d '{
    "header": {
      "messageID": "till-msg-001",
      "originatorConversationID": "till-conv-001",
      "channelCode": "202",
      "timeStamp": "20260729120000"
    },
    "requestPayload": {
      "primaryData": {
        "businessKey": "000000",
        "businessKeyType": "queryBiller"
      },
      "additionalData": {
        "notificationData": {
          "businessKey": "TILL-TEST-001",
          "businessKeyType": "BillReferenceNumber",
          "debitMSISDN": "254722000001",
          "transactionAmt": "250.00",
          "transactionDate": "20260729",
          "transactionID": "FT-TILL-001",
          "firstName": "Till",
          "lastName": "Test",
          "currency": "KES",
          "narration": "Till test payment",
          "balance": "99750.00"
        }
      }
    }
  }'
```

**Expected Response:**
```json
{
  "header": {
    "messageID": "till-msg-001",
    "originatorConversationID": "till-conv-001",
    "statusCode": "0",
    "statusMessage": "Notification received"
  },
  "responsePayload": {
    "transactionInfo": {
      "transactionId": "JIMWAS-TILL-001"
    }
  }
}
```

---

## M-Pesa Express Sample Request Payloads

### Postman Collection Reference

From the M-Pesa Express Postman Collection, the main STK Push request:

**Endpoint:** `POST /mm/api/request/1.0.0/stkpush`

**Headers:**
```
Authorization: Bearer <OAuth-token>
Content-Type: application/json
routeCode: 207
operation: STKPush
messageId: JIMWAS-{timestamp}-{random}
```

**Request Payload:**
```json
{
  "phoneNumber": "254722000001",
  "amount": 1000,
  "invoiceNumber": "INV-20260729-001",
  "orgShortCode": "522522",
  "orgPassKey": "your-pass-key-here",
  "transactionDescription": "JIMWAS ENTERPRISES Payment",
  "callbackUrl": "https://your-domain/functions/v1/kcb-callback",
  "sharedShortCode": false,
  "businessPaybill": "522522",
  "businessAccount": "7941675",
  "businessName": "JIMWASENTERPRISES",
  "metadata": {
    "cashierId": "CASHIER001",
    "cashierName": "John Cashier",
    "accountReference": "POS-20260729-001",
    "paybill": "522522",
    "account": "7941675",
    "businessName": "JIMWASENTERPRISES"
  }
}
```

**Success Response:**
```json
{
  "responseCode": "0",
  "responseMessage": "success",
  "checkoutRequestId": "ws_CO_10072026093000aa42ae6d66efd13d4eb6c",
  "merchantRequestId": "10072026093000aa42ae6d66efd13d4eb6c",
  "customerMessage": "success"
}
```

**Error Response:**
```json
{
  "responseCode": "1",
  "responseMessage": "Invalid phone number or amount",
  "checkoutRequestId": "",
  "merchantRequestId": "",
  "customerMessage": "Invalid phone number"
}
```

---

## Authentication

### OAuth Token Request

**Endpoint:** `POST /oauth/token`

**Headers:**
```
Content-Type: application/x-www-form-urlencoded
Authorization: Basic <base64-encoded-client-credentials>
```

**Body:**
```
grant_type=client_credentials
```

**Response:**
```json
{
  "access_token": "xxxxx",
  "token_type": "Bearer",
  "expires_in": 3599
}
```

---

## Callback Endpoint (for KCB to notify your system)

**Your Callback URL (registered with KCB):**
```
POST https://your-domain/functions/v1/kcb-callback
```

**What KCB sends to your callback:**
- Transaction completion status
- Receipt number
- Payment reference
- Signature for verification

**What you must return:**
```json
{
  "resultCode": "0",
  "resultMessage": "Received"
}
```

---

## Environment Variables Required for Testing

```bash
# KCB Credentials
export KCB_ORG_SHORT_CODE="522522"
export KCB_ORG_PASS_KEY="your-pass-key"
export KCB_ENVIRONMENT="sandbox"

# URLs
export SUPABASE_URL="https://your-supabase-url"
export SUPABASE_KEY="your-supabase-key"

# For OAuth
export KCB_CLIENT_ID="your-client-id"
export KCB_CLIENT_SECRET="your-client-secret"

# Public Key for Signature Verification
export KCB_PUBLIC_KEY="-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKvxF...
-----END CERTIFICATE-----"
```

---

## Testing Checklist

- [ ] Bill validation endpoint returns correct bill details
- [ ] Bill notification endpoint verifies signature
- [ ] Till notification endpoint verifies signature
- [ ] Duplicate messages handled (idempotency)
- [ ] Error responses formatted correctly
- [ ] Transactions logged to database
- [ ] Audit trail captured
- [ ] Receipts generated with reference numbers
- [ ] OAuth token obtained successfully
- [ ] Callback endpoint reachable from KCB

---

## Common Errors & Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| "Signature verification failed" | Invalid signature in header | Verify KCB_PUBLIC_KEY is correct, body wasn't modified |
| "Bill not found" | Invoice doesn't exist | Create test bill first or use existing invoice number |
| "Invalid phone number" | Wrong format (missing 254) | Use format: 254XXXXXXXXX |
| "Amount mismatch" | Amount doesn't match bill | Ensure amount in request matches bill amount |
| "Missing required fields" | Incomplete payload | Verify all required fields present |
| "OAuth token expired" | Token > 1 hour old | Request new token |

---

## Next Steps

1. Register these endpoint URLs with KCB
2. Obtain OAuth credentials from KCB
3. Get KCB public key for signature verification
4. Run all test scenarios
5. Proceed to UAT with KCB

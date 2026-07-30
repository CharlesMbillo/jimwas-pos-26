# KCB Buni Integration Testing Guide

## Phase 9: Comprehensive Testing & Validation

This guide covers all testing scenarios for KCB Buni integration.

### Test Environment Setup

```bash
# Ensure you have:
- Sandbox KCB credentials
- Supabase local development (optional)
- Postman or similar API testing tool
- Test database with sample bills
```

---

## Test Suite 1: Bill-Validation Endpoint

### Test 1.1: Valid Bill Query

**Endpoint:** `POST /functions/v1/kcb-bill-validation`

**Setup:**
```bash
# Create test bill in database
INSERT INTO bill_validations (
  invoice_number, org_short_code, phone_number, amount, 
  customer_name, status
) VALUES (
  'TEST001', 'TEST', '254700000000', 1000, 'Test Customer', 'active'
);
```

**Request:**
```json
{
  "phoneNumber": "254700000000",
  "amount": 1000,
  "invoiceNumber": "TEST001",
  "orgShortCode": "TEST",
  "timestamp": "2026-07-29T10:00:00Z"
}
```

**Expected Response (200):**
```json
{
  "resultCode": "000",
  "resultMessage": "Bill valid",
  "billDetails": {
    "invoiceNumber": "TEST001",
    "amount": 1000,
    "phoneNumber": "254700000000",
    "customerName": "Test Customer"
  },
  "timestamp": "2026-07-29T10:00:00Z"
}
```

**Assertions:**
- [ ] Status code is 200
- [ ] resultCode is "000"
- [ ] billDetails contains correct amount
- [ ] phoneNumber matches request

---

### Test 1.2: Bill Not Found

**Request:**
```json
{
  "phoneNumber": "254700000000",
  "amount": 1000,
  "invoiceNumber": "NONEXISTENT",
  "orgShortCode": "TEST"
}
```

**Expected Response (400):**
```json
{
  "resultCode": "001",
  "resultMessage": "Bill not found",
  "billDetails": null,
  "timestamp": "..."
}
```

**Assertions:**
- [ ] Status code is 400
- [ ] resultCode is "001"
- [ ] billDetails is null

---

### Test 1.3: Amount Mismatch

**Request:**
```json
{
  "phoneNumber": "254700000000",
  "amount": 2000,
  "invoiceNumber": "TEST001",
  "orgShortCode": "TEST"
}
```

**Expected Response (400):**
```json
{
  "resultCode": "002",
  "resultMessage": "Amount mismatch",
  "billDetails": null
}
```

---

### Test 1.4: Phone Number Mismatch

**Request:**
```json
{
  "phoneNumber": "254799999999",
  "amount": 1000,
  "invoiceNumber": "TEST001",
  "orgShortCode": "TEST"
}
```

**Expected Response (400):**
```json
{
  "resultCode": "003",
  "resultMessage": "Phone number mismatch",
  "billDetails": null
}
```

---

### Test 1.5: Missing Required Fields

**Request (missing amount):**
```json
{
  "phoneNumber": "254700000000",
  "invoiceNumber": "TEST001",
  "orgShortCode": "TEST"
}
```

**Expected Response (400):**
```json
{
  "resultCode": "400",
  "resultMessage": "Missing required fields"
}
```

---

## Test Suite 2: Bill-Notification Endpoint (IPN)

### Test 2.1: Valid Payment Notification

**Endpoint:** `POST /functions/v1/kcb-bill-notification`

**Setup:**
```javascript
// Generate test signature (requires KCB private key for testing)
const payload = {
  resultCode: "000",
  resultMessage: "Success",
  invoiceNumber: "TEST001",
  phoneNumber: "254700000000",
  amount: 1000,
  mpesaReceiptNumber: "ABC123XYZ",
  transactionDate: "20260729093000",
  mpesaTransactionId: "TXN123",
  orgShortCode: "TEST"
};

const signature = generateSignature(JSON.stringify(payload), KCB_PRIVATE_KEY);
```

**Request:**
```json
{
  "resultCode": "000",
  "resultMessage": "Success",
  "invoiceNumber": "TEST001",
  "phoneNumber": "254700000000",
  "amount": 1000,
  "mpesaReceiptNumber": "ABC123XYZ",
  "transactionDate": "20260729093000",
  "mpesaTransactionId": "TXN123",
  "orgShortCode": "TEST"
}
```

**Headers:**
```
X-KCB-SIGNATURE: <base64-encoded-signature>
Content-Type: application/json
```

**Expected Response (200):**
```json
{
  "resultCode": "000",
  "resultMessage": "Notification received and processed",
  "timestamp": "..."
}
```

**Assertions:**
- [ ] Status code is 200
- [ ] Transaction created in database
- [ ] Status set to "completed"
- [ ] Audit log created
- [ ] Original transaction updated (if exists)

**Database Verification:**
```sql
SELECT * FROM kcb_transactions 
WHERE invoice_number = 'TEST001' 
ORDER BY created_at DESC LIMIT 1;
-- Should show: status='completed', mpesa_receipt='ABC123XYZ'
```

---

### Test 2.2: Invalid Signature

**Request:** Same as 2.1 but with invalid signature

**Headers:**
```
X-KCB-SIGNATURE: invalid_base64_signature
```

**Expected Response (401):**
```json
{
  "resultCode": "401",
  "resultMessage": "Unauthorized - invalid signature",
  "timestamp": "..."
}
```

**Assertions:**
- [ ] Status code is 401
- [ ] Transaction NOT created
- [ ] Audit log records rejection

---

### Test 2.3: Missing Signature Header

**Headers:** (no X-KCB-SIGNATURE)

**Expected Response (401):**
```json
{
  "resultCode": "401",
  "resultMessage": "Unauthorized - missing signature",
  "timestamp": "..."
}
```

---

### Test 2.4: Payment Failed Notification

**Request (resultCode = "001"):**
```json
{
  "resultCode": "001",
  "resultMessage": "User canceled the transaction",
  "invoiceNumber": "TEST001",
  "phoneNumber": "254700000000",
  "amount": 1000,
  "mpesaReceiptNumber": null,
  "transactionDate": null,
  "mpesaTransactionId": null,
  "orgShortCode": "TEST"
}
```

**Expected Response (200):**
```json
{
  "resultCode": "000",
  "resultMessage": "Notification received and processed"
}
```

**Database Verification:**
```sql
SELECT * FROM kcb_transactions 
WHERE invoice_number = 'TEST001' 
AND status = 'failed';
-- Should exist with result_code='001'
```

---

## Test Suite 3: Till-Notification Endpoint

### Test 3.1: Valid Till Payment Notification

**Endpoint:** `POST /functions/v1/kcb-till-notification`

**Request:**
```json
{
  "resultCode": "000",
  "resultMessage": "Success",
  "tillId": "TILL001",
  "cashierId": "CASHIER001",
  "cashierName": "John Doe",
  "invoiceNumber": "TEST001",
  "phoneNumber": "254700000000",
  "amount": 1000,
  "mpesaReceiptNumber": "ABC123XYZ",
  "transactionDate": "20260729093000",
  "mpesaTransactionId": "TXN123",
  "orgShortCode": "TEST",
  "transactionTime": "093000",
  "reconciliationId": "REC123"
}
```

**Headers:**
```
X-KCB-SIGNATURE: <signature>
```

**Expected Response (200):**
```json
{
  "resultCode": "000",
  "resultMessage": "Notification received and processed"
}
```

**Assertions:**
- [ ] Status code is 200
- [ ] Till transaction created
- [ ] Till ID recorded
- [ ] Cashier details captured
- [ ] POS transaction linked

**Database Verification:**
```sql
SELECT * FROM till_transactions 
WHERE till_id = 'TILL001' 
AND cashier_id = 'CASHIER001';
```

---

### Test 3.2: Missing Till Information

**Request (missing tillId):**
```json
{
  "resultCode": "000",
  "cashierId": "CASHIER001",
  "cashierName": "John Doe",
  ...
}
```

**Expected Response (400):**
```json
{
  "resultCode": "400",
  "resultMessage": "Missing required fields"
}
```

---

## Test Suite 4: Security & Rate Limiting

### Test 4.1: Rate Limiting

**Endpoint:** Any KCB endpoint

**Action:** Send 100 requests in 1 minute

**Expected Behavior:**
- First 60 requests succeed
- Subsequent requests return 429 (Too Many Requests)
- Limit resets after 1 minute

---

### Test 4.2: Certificate Validation

**Setup:** Configure KCB public key

**Verification:**
```javascript
// Verify certificate is valid and not expired
const cert = new X509Certificate(KCB_PUBLIC_KEY);
console.log('Certificate valid until:', cert.validTo);
console.log('Certificate valid from:', cert.validFrom);
```

---

## Test Suite 5: Error Handling

### Test 5.1: Malformed JSON

**Request:** Invalid JSON body

**Expected Response (400):**
```json
{
  "resultCode": "400",
  "resultMessage": "Invalid request format"
}
```

---

### Test 5.2: Database Connection Error

**Setup:** Disable Supabase connection

**Request:** Any endpoint

**Expected Response (500):**
```json
{
  "resultCode": "500",
  "resultMessage": "Internal server error"
}
```

---

### Test 5.3: Timeout Handling

**Setup:** Simulate slow database

**Expected Behavior:**
- Request should timeout after 30 seconds
- Error logged for manual review
- Response sent to KCB (prevents re-sends)

---

## Audit Logging Verification

**Check all audit logs:**
```sql
SELECT * FROM kcb_audit_logs 
ORDER BY timestamp DESC LIMIT 20;

-- Should contain:
-- - bill_validation_query
-- - bill_notification_received
-- - till_notification_received
-- - bill_notification_error
-- - till_notification_error
```

---

## Integration Test Script

```bash
#!/bin/bash

# Test bill validation
echo "Testing bill validation..."
curl -X POST $BASE_URL/functions/v1/kcb-bill-validation \
  -H "Content-Type: application/json" \
  -d '{
    "phoneNumber": "254700000000",
    "amount": 1000,
    "invoiceNumber": "TEST001",
    "orgShortCode": "TEST"
  }'

echo "\nTesting bill notification..."
curl -X POST $BASE_URL/functions/v1/kcb-bill-notification \
  -H "Content-Type: application/json" \
  -H "X-KCB-SIGNATURE: $SIGNATURE" \
  -d '{
    "resultCode": "000",
    "invoiceNumber": "TEST001",
    ...
  }'

echo "\nTesting till notification..."
curl -X POST $BASE_URL/functions/v1/kcb-till-notification \
  -H "Content-Type: application/json" \
  -H "X-KCB-SIGNATURE: $SIGNATURE" \
  -d '{
    "resultCode": "000",
    "tillId": "TILL001",
    ...
  }'
```

---

## UAT Checklist

- [ ] All 5 test suites pass
- [ ] Signature verification working
- [ ] Rate limiting active
- [ ] Audit logs complete
- [ ] Error handling robust
- [ ] Database transactions atomic
- [ ] Performance acceptable (< 500ms per request)
- [ ] SSL/TLS certificates valid
- [ ] Endpoints accessible from KCB sandbox
- [ ] Documentation complete

# KCB Buni Payload Reference - Side-by-Side Comparison

This document shows exact payload structures for each KCB flow. Use these as templates for implementation.

---

## Flow 1: Bill-Validation

### When It Happens
Customer enters invoice number in app → System needs to validate bill → KCB calls your bill-validation endpoint

### KCB Sends (Request to 3rd party)

```json
{
  "requestId": "d115245e-9604-49de-9436-9fdcb539871f",
  "customerReference": "SAMPLE####",
  "organizationReference": "777777"
}
```

**Field Definitions:**
- `requestId` - Unique request identifier from KCB
- `customerReference` - Invoice/bill number
- `organizationReference` - Organization code

### 3rd Party Should Return (Response to KCB)

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

**Field Definitions:**
- `transactionID` - Your internal transaction ID (should be generated/stored)
- `statusCode` - "0" for success, other values for errors
- `statusMessage` - Human-readable status
- `CustomerName` - Full name of customer
- `billAmount` - Amount due (as string, 2 decimals)
- `currency` - Currency code (usually "KES")
- `billType` - Either "FIXED" (exact amount) or "PARTIAL" (customer can pay partial)
- `creditAccountIdentifier` - Your internal identifier (e.g., account number)

### Error Response Example

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

### Implementation Code Template

```typescript
export async function handleBillValidation(req: Request) {
  const body = await req.json();
  const { requestId, customerReference, organizationReference } = body;

  try {
    // Lookup bill in database
    const bill = await lookupBill(customerReference, organizationReference);
    
    if (!bill) {
      return new Response(JSON.stringify({
        transactionID: "0",
        statusCode: "1",
        statusMessage: "Bill not found",
        CustomerName: "",
        billAmount: "0.00",
        currency: "KES",
        billType: "FIXED",
        creditAccountIdentifier: ""
      }), { status: 200 });
    }

    return new Response(JSON.stringify({
      transactionID: bill.id,
      statusCode: "0",
      statusMessage: "Success",
      CustomerName: bill.customer_name,
      billAmount: bill.amount.toFixed(2),
      currency: "KES",
      billType: "FIXED",
      creditAccountIdentifier: bill.account_id
    }), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({
      transactionID: "0",
      statusCode: "1",
      statusMessage: error.message,
      CustomerName: "",
      billAmount: "0.00",
      currency: "KES",
      billType: "FIXED",
      creditAccountIdentifier: ""
    }), { status: 200 });
  }
}
```

---

## Flow 2: Bill-Notification

### When It Happens
Customer pays bill on KCB platform → KCB credits account → KCB notifies 3rd party of payment → 3rd party updates transaction

### KCB Sends (Request to 3rd party - WITH SIGNATURE in header)

**Headers:**
```
Content-Type: application/json
signature: 69EJ7+Km)kYHCu7+2mtAks5aFXyQUcEvuZjlpRMEbNszApUymF9eFt25QDb/r0bFP9...
```

**Body:**
```json
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

**Field Definitions:**
- `transactionReference` - KCB's unique transaction reference
- `requestId` - Unique request from this notification
- `channelCode` - "202" for KCB
- `timestamp` - Transaction timestamp (yyyyMMddHHmmss)
- `transactionAmount` - Amount paid (as string)
- `currency` - Currency (usually "KES")
- `customerReference` - Your invoice number
- `customerName` - Customer full name
- `customerMobileNumber` - Customer phone (254XXXXXXXXX format)
- `balance` - Account balance after transaction
- `narration` - Transaction description/note
- `creditAccountIdentifier` - Your account identifier
- `organizationShortCode` - Org code
- `tillNumber` - Till where payment was made

### 3rd Party Should Return (Response to KCB)

```json
{
  "transactionID": "123456789",
  "statusCode": 0,
  "statusMessage": "Notification received"
}
```

**Field Definitions:**
- `transactionID` - Your internal transaction ID (must be a string representation of a number)
- `statusCode` - Integer: 0 for success, 1 for failure
- `statusMessage` - Human-readable message

### Implementation Code Template

```typescript
export async function handleBillNotification(req: Request) {
  try {
    // CRITICAL: Verify signature first
    const signature = req.headers.get('signature');
    if (!signature || !await verifyKCBSignature(signature, await req.text())) {
      return new Response(JSON.stringify({
        transactionID: "0",
        statusCode: 1,
        statusMessage: "Signature verification failed"
      }), { status: 401 });
    }

    const body = await req.json();
    const {
      transactionReference,
      customerReference,
      transactionAmount,
      customerName,
      customerMobileNumber
    } = body;

    // Idempotency: check if already processed
    const existing = await db.query(
      'SELECT id FROM bill_notifications WHERE transaction_reference = ?',
      [transactionReference]
    );

    let transactionId;
    if (existing.length > 0) {
      transactionId = existing[0].id;
    } else {
      // Create new notification record
      const result = await db.query(
        'INSERT INTO bill_notifications (transaction_reference, customer_reference, amount, status) VALUES (?, ?, ?, ?)',
        [transactionReference, customerReference, transactionAmount, 'completed']
      );
      transactionId = result.insertId;

      // Update linked transaction
      await db.query(
        'UPDATE transactions SET status = ?, payment_reference = ? WHERE invoice_number = ?',
        ['completed', transactionReference, customerReference]
      );
    }

    return new Response(JSON.stringify({
      transactionID: String(transactionId),
      statusCode: 0,
      statusMessage: "Notification received"
    }), { status: 200 });

  } catch (error) {
    console.error('Bill notification error:', error);
    return new Response(JSON.stringify({
      transactionID: "0",
      statusCode: 1,
      statusMessage: "Processing failed"
    }), { status: 200 });
  }
}
```

---

## Flow 3: Till-Notification (IPN)

### When It Happens
Customer makes payment to KCB Till → Payment clears → KCB sends IPN notification to 3rd party → 3rd party records payment

### KCB Sends (Request to 3rd party - WITH SIGNATURE in header)

**Headers:**
```
Content-Type: application/json
signature: 69EJ7+Km)kYHCu7+2mtAks5aFXyQUcEvuZjlpRMEbNszApUymF9eFt25QDb/r0bFP9...
```

**Body:**
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

**Field Definitions (Header):**
- `messageID` - Unique message identifier
- `originatorConversationID` - Conversation chain ID
- `channelCode` - "202" for KCB
- `timeStamp` - Message timestamp (yyyyMMddHHmmss)

**Field Definitions (Notification Data):**
- `businessKey` - Your invoice/bill reference (e.g., "P-INV-001")
- `businessKeyType` - "BillReferenceNumber"
- `debitMSISDN` - Customer phone number (254XXXXXXXXX)
- `transactionAmt` - Amount paid
- `transactionDate` - Date of transaction (yyyyMMdd)
- `transactionID` - KCB receipt number (e.g., "FT235373")
- `firstName` - Customer first name
- `middleName` - Customer middle name (optional)
- `lastName` - Customer last name
- `currency` - Currency code
- `narration` - Transaction description
- `transactionType` - Type of transaction
- `balance` - Account balance after transaction

### 3rd Party Should Return (Response to KCB - NESTED STRUCTURE)

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

**Field Definitions (Response Header):**
- `messageID` - Your unique ID for this response
- `originatorConversationID` - Echo back from request header
- `statusCode` - "0" for success, "1" for failure
- `statusMessage` - Human-readable message

**Field Definitions (Response Payload):**
- `transactionId` - Your internal transaction ID

### Implementation Code Template

```typescript
export async function handleTillNotification(req: Request) {
  try {
    // CRITICAL: Get raw body for signature verification
    const rawBody = await req.text();

    // CRITICAL: Verify signature first
    const signature = req.headers.get('signature');
    if (!signature || !await verifyKCBSignature(signature, rawBody)) {
      return new Response(JSON.stringify({
        header: {
          messageID: "error",
          originatorConversationID: "",
          statusCode: "1",
          statusMessage: "Signature verification failed"
        },
        responsePayload: {
          transactionInfo: { transactionId: "0" }
        }
      }), { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const { header, requestPayload } = body;
    const notifData = requestPayload.additionalData.notificationData;
    const messageID = header.messageID;

    // Idempotency: check if already processed
    const existing = await db.query(
      'SELECT id FROM till_notifications WHERE message_id = ?',
      [messageID]
    );

    let transactionId;
    if (existing.length > 0) {
      transactionId = existing[0].id;
    } else {
      // Parse customer name
      const customerName = `${notifData.firstName} ${notifData.lastName}`;

      // Create notification record
      const result = await db.query(
        `INSERT INTO till_notifications (
          message_id, transaction_id, transaction_amount, customer_reference,
          customer_name, debit_msisdn, status, signature_verified
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          messageID,
          notifData.transactionID,
          notifData.transactionAmt,
          notifData.businessKey,
          customerName,
          notifData.debitMSISDN,
          'completed',
          true
        ]
      );
      transactionId = result.insertId;

      // Update linked transaction
      await db.query(
        'UPDATE transactions SET status = ?, payment_reference = ? WHERE invoice_number = ?',
        ['completed', notifData.transactionID, notifData.businessKey]
      );
    }

    // Response must be nested structure
    return new Response(JSON.stringify({
      header: {
        messageID: messageID,
        originatorConversationID: header.originatorConversationID,
        statusCode: "0",
        statusMessage: "Notification received"
      },
      responsePayload: {
        transactionInfo: {
          transactionId: String(transactionId)
        }
      }
    }), { status: 200 });

  } catch (error) {
    console.error('Till notification error:', error);
    return new Response(JSON.stringify({
      header: {
        messageID: "error",
        originatorConversationID: "",
        statusCode: "1",
        statusMessage: "Processing failed"
      },
      responsePayload: {
        transactionInfo: { transactionId: "0" }
      }
    }), { status: 200 });
  }
}
```

---

## Signature Verification

### All KCB Notifications Include Signature

**Header:**
```
signature: <base64-encoded-RSA-signature>
```

**Algorithm:** SHA256withRSA

**Verification Steps:**
1. Extract signature from header
2. Get raw request body (before JSON parsing)
3. Create SHA256 hash of raw body
4. Verify hash signature using KCB's RSA public key
5. If verification fails, reject request (return 401)

### Code Template

```typescript
import { crypto } from "std/crypto";

async function verifyKCBSignature(
  signatureBase64: string,
  rawBody: string,
  publicKeyBase64: string
): Promise<boolean> {
  try {
    // Decode signature
    const signatureBytes = decode(signatureBase64);

    // Create SHA256 hash of body
    const bodyBytes = new TextEncoder().encode(rawBody);
    const hash = await crypto.subtle.digest("SHA-256", bodyBytes);

    // Decode public key
    const publicKeyDER = decode(publicKeyBase64);
    const publicKey = await crypto.subtle.importKey(
      "spki",
      publicKeyDER,
      {
        name: "RSASSA-PKCS1-v1_5",
        hash: "SHA-256",
      },
      false,
      ["verify"]
    );

    // Verify signature
    const isValid = await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      publicKey,
      signatureBytes,
      hash
    );

    return isValid;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}
```

---

## Common Error Scenarios

### Scenario 1: Bill Not Found
**Request:** Bill-validation with invalid invoice number
**Your Response:**
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

### Scenario 2: Invalid Signature
**Request:** Till-notification with tampered body
**Your Response:**
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
**HTTP Status:** 401

### Scenario 3: Duplicate Notification
**Request:** Same messageID sent twice
**Your Response:** Same as success (same transaction ID returned)
**Action:** Do NOT process duplicate, return previously generated ID
**Why:** Ensures idempotency

### Scenario 4: Database Error
**Request:** Any valid request
**Your Response:**
```json
{
  "transactionID": "0",
  "statusCode": "1",
  "statusMessage": "Database error"
}
```
**Action:** Log error, alert ops team, but return proper response format

---

## Testing with Sample Data

### Sample Bill-Validation Request
```json
{
  "requestId": "test-001",
  "customerReference": "INV-20260729-001",
  "organizationReference": "999999"
}
```

### Sample Bill-Notification Request
```json
{
  "transactionReference": "FT000001",
  "requestId": "test-002",
  "channelCode": "202",
  "timestamp": "20260729103000",
  "transactionAmount": "1000.00",
  "currency": "KES",
  "customerReference": "INV-20260729-001",
  "customerName": "Test Customer",
  "customerMobileNumber": "254722000001",
  "balance": "50000.00",
  "narration": "Test payment",
  "creditAccountIdentifier": "ACC-001",
  "organizationShortCode": "999999",
  "tillNumber": "000001"
}
```

### Sample Till-Notification Request
```json
{
  "header": {
    "messageID": "test-003",
    "originatorConversationID": "test-conv-001",
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
        "firstName": "Test",
        "lastName": "Customer",
        "currency": "KES",
        "narration": "Test till payment",
        "balance": "50000.00"
      }
    }
  }
}
```

---

## Integration Checklist

- [ ] Can your system parse each payload structure?
- [ ] Can your system generate correct response formats?
- [ ] Can your system verify RSA signatures?
- [ ] Can your system handle idempotency?
- [ ] Can your system create/update transactions?
- [ ] Can your system handle timeouts gracefully?
- [ ] Can your system log all transactions?
- [ ] Can your system alert on errors?
- [ ] Can your system recover from failures?
- [ ] Can your system handle concurrent requests?

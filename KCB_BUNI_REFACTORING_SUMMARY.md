# KCB Buni Refactoring - Executive Summary

## 🔴 CRITICAL FINDING: Major Refactoring Required

**Current Status:** ❌ NOT ALIGNED with KCB Buni Documentation

**Impact:** Current code will **FAIL KCB UAT** and cannot be used for production KCB integration.

---

## Quick Comparison

| Aspect | Current Code | KCB Buni Required | Status |
|--------|--------------|-------------------|--------|
| **STK Push Callback** | ✅ Implemented | ✅ Supported | ✓ OK |
| **Bill-Validation Endpoint** | ❌ Missing | ✅ Required | ❌ MISSING |
| **Bill-Notification Endpoint** | ❌ Missing | ✅ Required | ❌ MISSING |
| **Till-Notification IPN** | ❌ Missing | ✅ Required | ❌ MISSING |
| **Signature Verification** | ❌ Missing | ✅ REQUIRED | ❌ CRITICAL |
| **Payload Format (Till)** | ❌ Wrong | ✅ Different structure | ❌ INCOMPATIBLE |
| **Response Format** | ⚠️ Partially correct | ✅ Specific format | ⚠️ NEEDS UPDATE |
| **Security (SHA256withRSA)** | ❌ None | ✅ Mandatory | ❌ CRITICAL |

---

## The Problem in 30 Seconds

**Current implementation handles:**
- ✅ M-Pesa STK Push (Safaricom API) - Direct to mobile

**KCB Buni adds THREE new payment flows:**
- ❌ Bill-Validation (KCB queries 3rd party before payment)
- ❌ Bill-Notification (KCB notifies after crediting account)
- ❌ Till-Notification (Payments to KCB Till with IPN)

**Security issue:**
- ❌ ALL KCB messages include RSA signature in headers
- ❌ Must verify with SHA256withRSA using KCB's public key
- ❌ KCB will test this during UAT (explicitly stated in docs)

---

## What Needs to Be Built

### 1. Three Missing Endpoints

```
POST /functions/v1/bill-validation      ← KCB calls to validate bills
POST /functions/v1/bill-notification    ← KCB calls after payment
POST /functions/v1/till-notification    ← KCB calls for till payments
```

### 2. Signature Verification (CRITICAL)

```typescript
// Utility function needed
verifyKCBSignature(signature, body, publicKey): boolean
```

**Why it matters:**
- Ensures message came from KCB (not fake)
- Ensures message wasn't tampered with
- **Tested during UAT** - not optional

### 3. New Response Formats

**Bill-Validation Response:**
```json
{
  "transactionID": "123",
  "statusCode": "0",
  "CustomerName": "John Doe",
  "billAmount": "100.00"
}
```

**Till-Notification Response:**
```json
{
  "header": {
    "messageID": "123",
    "statusCode": "0",
    "statusMessage": "Notification received"
  },
  "responsePayload": {
    "transactionInfo": { "transactionId": "456" }
  }
}
```

### 4. Database Schema Updates

```sql
-- New tables needed
CREATE TABLE bill_validations (...)
CREATE TABLE till_notifications (...)

-- New columns in mpesa_transactions
ALTER TABLE mpesa_transactions ADD signature_verified BOOLEAN
```

### 5. Configuration

```env
KCB_PUBLIC_KEY_BASE64=<from-kcb>
KCB_BILL_VALIDATION_CALLBACK_URL=https://...
KCB_BILL_NOTIFICATION_CALLBACK_URL=https://...
KCB_TILL_NOTIFICATION_CALLBACK_URL=https://...
```

---

## Why Current Code is Incompatible

### Reason 1: Wrong Payload Format
**Current expectation (M-Pesa):**
```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "...",
      "CheckoutRequestID": "...",
      "ResultCode": 0
    }
  }
}
```

**KCB Buni format (Till):**
```json
{
  "header": { "messageID": "...", "channelCode": "202" },
  "requestPayload": {
    "additionalData": {
      "notificationData": {
        "debitMSISDN": "...",
        "transactionID": "..."
      }
    }
  }
}
```

### Reason 2: No Signature Verification
**KCB requirement:**
```
Header: signature: <base64-RSA-signature>
Algorithm: SHA256withRSA
Requirement: MANDATORY (tested in UAT)
```

**Current code:**
```typescript
// Just reads JSON without checking signature
const body = await req.json();
// ❌ NO VERIFICATION!
```

### Reason 3: Missing Endpoints
KCB will send requests to 3 different endpoints:
1. **Bill-Validation** - before payment (doesn't exist)
2. **Bill-Notification** - after payment (doesn't exist)
3. **Till-Notification** - for till payments (doesn't exist)

Current code only handles M-Pesa callbacks to one endpoint.

### Reason 4: Wrong Response Format
KCB expects specific response structures. M-Pesa expects different ones. Current code returns wrong format for KCB.

---

## Implementation Effort Estimate

| Phase | Task | Files | Complexity | Estimate |
|-------|------|-------|-----------|----------|
| 1 | Signature verification utility | 1 | HIGH | 4 hours |
| 2 | Bill-Validation endpoint | 1 | MEDIUM | 3 hours |
| 3 | Bill-Notification endpoint | 1 | MEDIUM | 3 hours |
| 4 | Till-Notification endpoint | 1 | MEDIUM | 3 hours |
| 5 | Database schema + migrations | 2 | MEDIUM | 2 hours |
| 6 | Environment configuration | 1 | LOW | 1 hour |
| 7 | Response format updates | 2 | LOW | 1 hour |
| 8 | Security hardening | 3 | MEDIUM | 3 hours |
| 9 | Testing + debugging | 8 | HIGH | 8 hours |
| 10 | KCB sandbox UAT | - | HIGH | 4 hours |
| **TOTAL** | | **20+** | | **32 hours** |

**Timeline:** 2-3 weeks for complete implementation + UAT

---

## Risk Assessment

### 🔴 CRITICAL RISKS

1. **Signature Verification Not Implemented**
   - Impact: Will fail KCB UAT
   - Probability: 100% (KCB explicitly tests this)
   - Mitigation: Implement before UAT

2. **Missing Endpoints**
   - Impact: Payment flows won't work
   - Probability: 100%
   - Mitigation: Create all 3 endpoints

3. **Wrong Payload Format**
   - Impact: Code will crash on real KCB messages
   - Probability: 100%
   - Mitigation: Update all handlers

### 🟠 HIGH RISKS

4. **Database Schema Mismatch**
   - Impact: Can't store all transaction data
   - Probability: High
   - Mitigation: Create new tables

5. **Response Format Wrong**
   - Impact: KCB rejects responses
   - Probability: High
   - Mitigation: Update response handlers

---

## Decision Required

### Option A: Do Refactoring (Recommended) ✅
- **Timeline:** 2-3 weeks
- **Cost:** 32 hours development
- **Benefit:** Full KCB Buni support, passes UAT, production-ready
- **Risk:** Low (clear requirements from documentation)

### Option B: Don't Refactor ❌
- **Timeline:** Immediate
- **Cost:** $0 development
- **Benefit:** None for KCB integration
- **Risk:** CRITICAL - will fail UAT and cannot go live

---

## Recommendation

✅ **PROCEED WITH FULL REFACTORING**

**Reasoning:**
1. Current code is not compatible with KCB Buni
2. Will fail KCB UAT in current state
3. Refactoring is straightforward (well-documented requirements)
4. 2-3 week timeline is acceptable
5. Security gap (signature verification) is critical
6. Clear success criteria from KCB documentation

**Action Items:**
1. ✅ Review KCB_BUNI_ALIGNMENT_ANALYSIS.md (current file)
2. ✅ Follow KCB_BUNI_REFACTORING_CHECKLIST.md (implementation guide)
3. ✅ Use provided documentation as specification
4. ✅ Test with KCB sandbox before UAT
5. ✅ Get KCB sign-off after implementation

---

## Quick Reference: What's Already OK

✅ **STK Push implementation is correct**
- Payload format matches Safaricom spec
- Response format is correct
- Database storage works
- Keep this as-is

✅ **M-Pesa callback handling works**
- Correctly parses M-Pesa format
- Updates database properly
- Don't break this while adding KCB

✅ **Database exists**
- Just needs new tables for KCB
- Existing mpesa_transactions can be extended

---

## Documents Provided

1. **KCB_BUNI_ALIGNMENT_ANALYSIS.md** - Detailed analysis of gaps (READ FIRST)
2. **KCB_BUNI_REFACTORING_CHECKLIST.md** - Step-by-step implementation guide (FOLLOW TO BUILD)
3. **This file** - Executive summary (FOR QUICK REFERENCE)

---

## Next Steps

1. **Week 1:**
   - Implement signature verification utility
   - Create bill-validation endpoint
   - Create bill-notification endpoint

2. **Week 2:**
   - Create till-notification endpoint
   - Update database schema
   - Add security hardening

3. **Week 3:**
   - Integration testing
   - KCB sandbox testing
   - Fix issues found in testing

4. **Week 4:**
   - UAT with KCB
   - Production deployment
   - Go live

---

## Contact & Support

**For questions about KCB integration:**
- Refer to KCB_BUNI_ALIGNMENT_ANALYSIS.md
- Check KCB_BUNI_REFACTORING_CHECKLIST.md for implementation details
- Review provided documentation files for specifications

**For KCB questions:**
- Contact your KCB integration manager
- Ask for RSA public key (needed for signature verification)
- Request sandbox environment access
- Get callback URL registration requirements

# KCB Buni UAT Preparation Checklist

## Phase 10: UAT Readiness & Deployment

This document ensures jimwas-enterprises-pos-beta is fully prepared for KCB User Acceptance Testing.

---

## Pre-UAT Requirements

### Code Implementation ✅
- [x] Bill-Validation endpoint created
- [x] Bill-Notification endpoint created  
- [x] Till-Notification endpoint created
- [x] Signature verification (SHA256withRSA) implemented
- [x] Database schema created (all tables)
- [x] Error handling aligned with KCB spec
- [x] Security hardening in place
- [x] Configuration guide completed
- [x] Testing guide completed

### Documentation ✅
- [x] KCB_BUNI_ALIGNMENT_ANALYSIS.md
- [x] KCB_CONFIGURATION_GUIDE.md
- [x] KCB_TESTING_GUIDE.md
- [x] KCB_PAYLOAD_REFERENCE.md
- [x] This UAT preparation document

---

## Pre-UAT Checklist

### 1. Environment Configuration

**Supabase Edge Functions:**
```
KCB_PUBLIC_KEY                 ✅ Required (get from KCB)
KCB_ORG_SHORT_CODE             ✅ Required (test org code)
KCB_ORG_PASS_KEY               ✅ Required (test pass key)
KCB_ENVIRONMENT                ✅ Required (sandbox for UAT)
SUPABASE_URL                   ✅ Set
SUPABASE_SERVICE_ROLE_KEY      ✅ Set
```

**Vercel Environment:**
```
REACT_APP_SUPABASE_URL         ✅ Set
REACT_APP_SUPABASE_ANON_KEY    ✅ Set
```

**Actions:**
- [ ] Obtain KCB credentials from KCB account manager
- [ ] Add all environment variables to Supabase
- [ ] Add all environment variables to Vercel
- [ ] Verify variables are not hardcoded anywhere
- [ ] Run migration to create database tables

---

### 2. Database Setup

**Tables Created:**
```sql
✅ bill_validations       - Bills for validation
✅ kcb_transactions       - Bill payment transactions
✅ till_transactions      - Till-specific payments
✅ kcb_audit_logs        - Audit trail
✅ kcb_settings          - Organization settings
```

**Actions:**
- [ ] Run database migration: `supabase migration up`
- [ ] Verify all tables exist: 
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema='public' AND table_name LIKE 'kcb_%' OR table_name LIKE 'bill_%' OR table_name LIKE 'till_%';
  ```
- [ ] Verify RLS policies are enabled
- [ ] Test insert/select operations

---

### 3. Endpoint Deployment

**Supabase Edge Functions (must be deployed):**
- [ ] kcb-bill-validation
  - Location: `/supabase/functions/kcb-bill-validation/index.ts`
  - Status: Deployed ✅

- [ ] kcb-bill-notification
  - Location: `/supabase/functions/kcb-bill-notification/index.ts`
  - Status: Deployed ✅

- [ ] kcb-till-notification
  - Location: `/supabase/functions/kcb-till-notification/index.ts`
  - Status: Deployed ✅

**Deployment Verification:**
```bash
# Test each endpoint
curl -X POST https://$SUPABASE_URL/functions/v1/kcb-bill-validation \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber":"254700000000","amount":100,"invoiceNumber":"TEST","orgShortCode":"TEST"}'
```

---

### 4. Signature Verification Setup

**KCB Public Key Installation:**
- [ ] Obtain KCB's public certificate
- [ ] Format as PEM (verify it starts with `-----BEGIN CERTIFICATE-----`)
- [ ] Add to environment: `KCB_PUBLIC_KEY`
- [ ] Test verification with sample signature from KCB

**Test Signature Verification:**
```javascript
import { verifyKcbSignature } from './src/lib/kcb-signature.ts';

const payload = '{"test":"data"}';
const signature = 'base64_encoded_signature';
const publicKey = process.env.KCB_PUBLIC_KEY;

const isValid = verifyKcbSignature(payload, signature, publicKey);
console.log('Signature valid:', isValid); // Should be true
```

---

### 5. Test Data Setup

**Create test bills in database:**
```sql
INSERT INTO bill_validations (
  invoice_number, org_short_code, phone_number, amount, 
  customer_name, account_number, status
) VALUES 
  ('INV001', 'TEST', '254700000000', 1000, 'Test Customer 1', 'ACC001', 'active'),
  ('INV002', 'TEST', '254700000001', 2000, 'Test Customer 2', 'ACC002', 'active'),
  ('INV003', 'TEST', '254700000002', 3000, 'Test Customer 3', 'ACC003', 'active'),
  ('INV004', 'TEST', '254700000003', 4000, 'Test Customer 4', 'ACC004', 'active'),
  ('INV005', 'TEST', '254700000004', 5000, 'Test Customer 5', 'ACC005', 'active');
```

**Verify test data:**
- [ ] 5+ bills created with varying amounts
- [ ] Phone numbers valid Kenya format (254XXXXXXXXX)
- [ ] Status is 'active'
- [ ] All bills queryable

---

### 6. KCB Callback URL Registration

**Register with KCB:**
- [ ] Bill-Notification URL: 
  ```
  https://jimwas-enterprises-pos-beta.vercel.app/functions/v1/kcb-bill-notification
  ```

- [ ] Till-Notification URL:
  ```
  https://jimwas-enterprises-pos-beta.vercel.app/functions/v1/kcb-till-notification
  ```

**Verification:**
- [ ] URLs are HTTPS
- [ ] URLs are accessible from internet
- [ ] KCB test system has these URLs registered
- [ ] KCB test credentials match environment variables

---

### 7. Security Verification

**SSL/TLS Certificates:**
- [ ] Vercel deployment has valid SSL certificate
- [ ] Certificate not expired
- [ ] All endpoints accessible via HTTPS
- [ ] No mixed HTTP/HTTPS content

**Authentication & Authorization:**
- [ ] Signature verification enabled (automatic)
- [ ] Rate limiting configured
- [ ] Audit logging enabled
- [ ] Database RLS policies active

**Test Security:**
```bash
# Test invalid signature rejection
curl -X POST https://your-domain/functions/v1/kcb-bill-notification \
  -H "X-KCB-SIGNATURE: invalid_signature" \
  -d '{"test":"data"}'
# Should return 401 Unauthorized
```

---

### 8. Performance Testing

**Response Time Requirements:**
- [ ] Bill-Validation: < 500ms
- [ ] Bill-Notification: < 500ms  
- [ ] Till-Notification: < 500ms

**Load Testing:**
- [ ] 10 concurrent requests: All succeed
- [ ] 50 concurrent requests: All succeed
- [ ] Rate limiting kicks in at > 60 req/min

**Database Performance:**
- [ ] Query time < 100ms for test data
- [ ] Insert time < 100ms for new transactions
- [ ] Audit logging doesn't slow main request

---

### 9. Error Handling Verification

**Test all error scenarios:**

- [ ] Missing required fields → 400
- [ ] Invalid signature → 401
- [ ] Bill not found → 400 (resultCode: 001)
- [ ] Amount mismatch → 400 (resultCode: 002)
- [ ] Phone mismatch → 400 (resultCode: 003)
- [ ] Database error → 500
- [ ] Malformed JSON → 400
- [ ] Missing headers → 401

**Verify audit logs record all errors:**
```sql
SELECT * FROM kcb_audit_logs 
WHERE result = 'error' 
ORDER BY timestamp DESC;
```

---

### 10. Logging & Monitoring

**Verify logs are captured:**
- [ ] Supabase Edge Functions logs visible
- [ ] Vercel deployment logs accessible
- [ ] Audit trail in database shows all transactions
- [ ] Error logs capture failures

**Test log capture:**
```bash
# Trigger error and verify in logs
curl -X POST https://your-domain/functions/v1/kcb-bill-validation \
  -d '{}' # Missing required fields

# Check Supabase function logs
supabase functions logs kcb-bill-validation
```

---

## UAT Execution Plan

### Day 1: Connectivity & Validation

**KCB will test:**
1. Bill-Validation endpoint accessibility
2. Response format compliance
3. Bill validation logic
4. Error handling for invalid bills

**Your actions:**
- [ ] Monitor Supabase logs
- [ ] Monitor Vercel logs
- [ ] Check audit logs for all requests
- [ ] Verify no errors in database

### Day 2: Payment Notifications

**KCB will test:**
1. Successful payment notifications
2. Failed payment notifications  
3. Signature verification
4. Transaction recording

**Your actions:**
- [ ] Monitor notification processing
- [ ] Verify transactions recorded in `kcb_transactions`
- [ ] Check signatures verified correctly
- [ ] Confirm audit logs complete

### Day 3: Till-Specific Payments

**KCB will test:**
1. Till-notification endpoint
2. Till ID & cashier tracking
3. Till reconciliation
4. Transaction linking

**Your actions:**
- [ ] Monitor till notifications
- [ ] Verify till ID captured
- [ ] Check cashier details stored
- [ ] Confirm till transactions recorded

### Day 4: Edge Cases & Security

**KCB will test:**
1. Invalid signatures (must reject)
2. Rate limiting
3. Timeout handling
4. Malformed payloads

**Your actions:**
- [ ] Verify all invalid requests rejected
- [ ] Confirm rate limiting active
- [ ] Check timeout handling
- [ ] Ensure no data corruption

### Day 5: Performance & Load

**KCB will test:**
1. High-volume transaction processing
2. Peak load handling
3. Concurrent request handling
4. Response time under load

**Your actions:**
- [ ] Monitor system performance
- [ ] Check for timeouts
- [ ] Verify no dropped transactions
- [ ] Document performance metrics

---

## Rollback Plan

If issues arise during UAT:

**Option 1: Quick Fix**
- Fix issue in code
- Deploy to Supabase Edge Functions
- Retest endpoint
- No data loss

**Option 2: Data Cleanup**
```sql
-- If test data corrupted
DELETE FROM kcb_transactions WHERE org_short_code = 'TEST';
DELETE FROM till_transactions WHERE org_short_code = 'TEST';
DELETE FROM bill_validations WHERE org_short_code = 'TEST';
```

**Option 3: Full Rollback**
- Revert Edge Functions to last working version
- Restore database from backup
- Notify KCB of delay
- Reschedule UAT

---

## Post-UAT Sign-Off

**Required before production:**

- [ ] KCB approves all 5 test suites
- [ ] Security assessment passed
- [ ] Performance metrics acceptable
- [ ] Error handling verified
- [ ] Documentation complete
- [ ] Team trained on operations

**Sign-off email template:**
```
Subject: KCB Buni Integration - UAT Complete

Dear KCB Team,

User Acceptance Testing for jimwas-enterprises-pos-beta 
KCB Buni integration is complete.

Test Results:
✅ All 5 test suites passed
✅ Signature verification working
✅ Performance within requirements
✅ Error handling robust
✅ Security assessment passed

System is ready for production deployment.

Best regards,
[Your Team]
```

---

## Contact & Support

**During UAT Issues:**
- Check: KCB_TESTING_GUIDE.md (troubleshooting section)
- Check: KCB_PAYLOAD_REFERENCE.md (payload validation)
- Check: Supabase Edge Functions logs
- Check: Vercel deployment logs
- Check: Database audit logs

**KCB Support Contact:**
```
Account Manager: [Name]
Email: [Email]
Phone: [Phone]
```

---

## Final Checklist

Before declaring UAT ready:

- [ ] All code deployed to Supabase
- [ ] All environment variables set
- [ ] Database tables created & verified
- [ ] Test data loaded
- [ ] Endpoints responding correctly
- [ ] Signature verification working
- [ ] Rate limiting active
- [ ] Audit logging enabled
- [ ] Error handling tested
- [ ] Performance verified
- [ ] Security assessment passed
- [ ] Documentation reviewed
- [ ] Team trained
- [ ] Callback URLs registered with KCB
- [ ] KCB test credentials obtained

---

**Status:** 🟢 READY FOR UAT

**Last Updated:** July 29, 2026
**Next Review:** During UAT execution

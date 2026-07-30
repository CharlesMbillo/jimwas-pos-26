# KCB BUNI Payment Gateway Integration - Implementation Guide

## Project Overview

This document provides a comprehensive guide for completing the KCB BUNI STK Push payment gateway integration into Jimwas POS.

**Repository:** CharlesMbillo/jimwas  
**Branch:** jimwas-pos-backup  
**Status:** In Progress - Core Module Structure Created

---

## Architecture

```
src/lib/modules/payments/kcb/
├── types.ts              ✅ Created - All TypeScript interfaces
├── constants.ts          ✅ Created - API constants and defaults
├── config.ts             ✅ Created - Configuration management
├── oauth.ts              ✅ Created - Token management
├── logger.ts             ✅ Created - Structured logging
├── client.ts             ⏳ TODO - Main KCB client
├── stkPush.ts            ⏳ TODO - STK Push operations
├── signature.ts          ⏳ TODO - Signature verification
├── repository.ts         ⏳ TODO - Database operations
├── errors.ts             ⏳ TODO - Error handling
└── utils.ts              ⏳ TODO - Utility functions
```

---

## Environment Variables Required

Add to `.env.local` or `.env.production`:

```env
# KCB BUNI Configuration
VITE_KCB_BASE_URL=https://api.sandbox.kcb.co.ke
VITE_KCB_CLIENT_ID=your_client_id
VITE_KCB_CLIENT_SECRET=your_client_secret
VITE_KCB_ROUTE_CODE=207
VITE_KCB_SHARED_SHORTCODE=true
VITE_KCB_ORG_SHORTCODE=your_org_shortcode
VITE_KCB_ORG_PASSKEY=your_org_passkey
VITE_KCB_CALLBACK_URL=https://your-domain.com/api/payments/kcb/ipn
VITE_KCB_PUBLIC_CERT_PATH=/certs/kcb-public.pem

# Database
DATABASE_URL=your_supabase_url
```

---

## Database Schema

### Tables to Create

```sql
-- Payment Transactions
CREATE TABLE payment_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_request_id VARCHAR(255) UNIQUE NOT NULL,
  checkout_request_id VARCHAR(255) UNIQUE NOT NULL,
  invoice_id VARCHAR(100) NOT NULL,
  customer_id UUID REFERENCES customers(id),
  phone_number VARCHAR(20) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'KES',
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  receipt VARCHAR(255),
  result_code INT,
  result_desc TEXT,
  transaction_date TIMESTAMP,
  raw_payload JSONB NOT NULL,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_merchant_request (merchant_request_id),
  INDEX idx_checkout_request (checkout_request_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);

-- Payment Callbacks
CREATE TABLE payment_callbacks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES payment_transactions(id),
  merchant_request_id VARCHAR(255) NOT NULL,
  checkout_request_id VARCHAR(255) NOT NULL,
  result_code INT NOT NULL,
  result_desc TEXT,
  signature VARCHAR(1024) NOT NULL,
  payload JSONB NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_transaction (transaction_id),
  INDEX idx_verified (verified)
);

-- OAuth Tokens (for server-side token caching)
CREATE TABLE payment_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token TEXT NOT NULL,
  token_type VARCHAR(50) DEFAULT 'Bearer',
  expires_at TIMESTAMP NOT NULL,
  scope TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit Log
CREATE TABLE payment_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES payment_transactions(id),
  action VARCHAR(100) NOT NULL,
  actor VARCHAR(255),
  details JSONB NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_transaction (transaction_id),
  INDEX idx_action (action)
);

-- Retry Queue
CREATE TABLE payment_retry_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES payment_transactions(id) UNIQUE,
  attempt_number INT DEFAULT 1,
  max_attempts INT DEFAULT 3,
  next_retry_at TIMESTAMP NOT NULL,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_next_retry (next_retry_at),
  INDEX idx_transaction (transaction_id)
);
```

---

## Remaining Implementation Tasks

### 1. Create KCB Client (`src/lib/modules/payments/kcb/client.ts`)

Main interface for KCB operations:

```typescript
class KCBClient {
  // OAuth Management
  getToken(): Promise<string>
  
  // STK Push
  initiateSTKPush(request: STKPushRequest): Promise<STKPushResponse>
  queryPaymentStatus(merchantRequestId: string): Promise<PaymentStatus>
  
  // Signature & Verification
  verifySignature(signature: string, payload: string): Promise<boolean>
  parseCallback(ipnRequest: IPNRequest): Promise<IPNPayload>
  
  // Validation
  validate(): Promise<boolean>
  healthCheck(): Promise<HealthCheckResponse>
}
```

### 2. STK Push Operations (`src/lib/modules/payments/kcb/stkPush.ts`)

Handle STK push workflows:

- Generate unique message IDs and correlation IDs
- Build STK push request payloads
- Handle customer cancellation and timeouts
- Implement polling for payment status
- Cache checkout request IDs for duplicate detection

### 3. Signature Verification (`src/lib/modules/payments/kcb/signature.ts`)

- Load KCB public certificate
- Verify SHA256withRSA signatures
- Validate callback signatures
- Implement HMAC validation

### 4. Repository Layer (`src/lib/modules/payments/kcb/repository.ts`)

Database operations:

```typescript
class PaymentRepository {
  createTransaction(payload: PaymentTransaction)
  updateTransaction(id, update: UpdatePaymentStatusDTO)
  getTransaction(id)
  getByMerchantRequestId(id)
  getByCheckoutRequestId(id)
  
  saveCallback(payload: PaymentCallback)
  markCallbackProcessed(id)
  
  saveToken(token: PaymentToken)
  getLatestToken()
  
  createAuditLog(action, details)
  
  // Retry logic
  addToRetryQueue(transactionId, error)
  getPendingRetries()
  updateRetryAttempt(id, success)
}
```

### 5. API Endpoints

#### STK Push Endpoint (`/api/payments/kcb/stk-push`)

```typescript
POST /api/payments/kcb/stk-push
Content-Type: application/json

{
  "phoneNumber": "254712345678",
  "amount": 1000,
  "invoiceNumber": "INV-001",
  "description": "Sale of Product X"
}

Response:
{
  "success": true,
  "data": {
    "merchantRequestId": "...",
    "checkoutRequestId": "...",
    "customerMessage": "STK push sent to your phone"
  }
}
```

#### Status Check Endpoint (`/api/payments/kcb/status`)

```typescript
POST /api/payments/kcb/status
Content-Type: application/json

{
  "merchantRequestId": "...",
  "checkoutRequestId": "..."
}

Response:
{
  "success": true,
  "data": {
    "status": "paid|failed|timeout|cancelled",
    "receipt": "...",
    "resultCode": 0,
    "resultDesc": "..."
  }
}
```

#### IPN/Callback Endpoint (`/api/payments/kcb/ipn`)

```typescript
POST /api/payments/kcb/ipn
Content-Type: application/json
X-Signature: <signature>

{
  "MerchantRequestID": "...",
  "CheckoutRequestID": "...",
  "ResultCode": 0,
  "ResultDesc": "Success",
  "Amount": 1000,
  "MpesaReceiptNumber": "...",
  "PhoneNumber": "254712345678"
}
```

### 6. POS Integration

Modify `src/routes/pos.tsx`:

- Add KCB STK Push button to payment methods
- Create KCB payment modal with phone number input
- Implement status polling with loading spinner
- Update transaction with KCB payment details
- Auto-complete sale on success
- Handle payment failures gracefully

### 7. Database Migrations

Create migration file: `supabase/migrations/20260716_kcb_payments.sql`

Include all table definitions and indexes from Schema section above.

### 8. Components

#### PaymentMethodSelector Enhancement
Add KCB as payment option alongside Cash, Card, M-Pesa

#### KCBPaymentModal Component
- Phone number input with validation
- Amount confirmation
- STK push status display
- Retry logic UI
- Error messages

#### PaymentsDashboard Component
- Today's collections by payment method
- Pending STK push transactions
- Failed payment notifications
- Transaction history

---

## Implementation Checklist

- [ ] Create `client.ts` with KCBClient class
- [ ] Create `stkPush.ts` with STK push workflows
- [ ] Create `signature.ts` with signature verification
- [ ] Create `repository.ts` with database layer
- [ ] Create `errors.ts` with custom error types
- [ ] Create `utils.ts` with helper functions
- [ ] Create database migration file
- [ ] Create `/api/payments/kcb/stk-push` endpoint
- [ ] Create `/api/payments/kcb/status` endpoint
- [ ] Create `/api/payments/kcb/ipn` endpoint
- [ ] Create KCBPaymentModal component
- [ ] Integrate KCB into POS payment screen
- [ ] Create payments dashboard
- [ ] Add WebSocket or SSE for real-time updates
- [ ] Add comprehensive error handling
- [ ] Add audit logging
- [ ] Add unit tests
- [ ] Add integration tests
- [ ] Create API documentation
- [ ] Add security hardening
- [ ] Test in KCB sandbox environment
- [ ] Deploy to production

---

## Security Checklist

- [ ] All credentials in environment variables
- [ ] Signature verification implemented
- [ ] Rate limiting on callbacks
- [ ] Request validation with Zod
- [ ] CSRF protection
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention
- [ ] Timeout protection
- [ ] Duplicate transaction detection
- [ ] Idempotent webhook processing
- [ ] Audit logging for compliance
- [ ] Error messages don't leak sensitive info

---

## Testing Strategy

### Unit Tests
- OAuth token manager
- Signature verification
- Configuration validation
- Payment status transitions
- Error handling

### Integration Tests
- Full STK push flow
- Callback processing
- Database operations
- Retry logic

### End-to-End Tests
- Complete payment flow
- Error recovery
- Concurrent transactions
- Webhook delivery

---

## Deployment Considerations

1. **KCB Sandbox Testing**
   - Test all endpoints in sandbox first
   - Use test credentials provided by KCB
   - Verify callback delivery

2. **Production Setup**
   - Request production credentials from KCB
   - Upload production public certificate
   - Configure production callback URL
   - Enable rate limiting
   - Set up monitoring/alerting

3. **Monitoring**
   - Track transaction success rate
   - Monitor callback latency
   - Alert on payment failures
   - Track retry attempts

4. **Rollback Plan**
   - Keep M-Pesa payment method active
   - Use feature flags to toggle KCB on/off
   - Have manual transaction resolution process

---

## Files Already Created

1. `src/lib/modules/payments/kcb/types.ts` - 247 lines
2. `src/lib/modules/payments/kcb/constants.ts` - 105 lines
3. `src/lib/modules/payments/kcb/config.ts` - 153 lines
4. `src/lib/modules/payments/kcb/oauth.ts` - 187 lines
5. `src/lib/modules/payments/kcb/logger.ts` - 167 lines

**Total Created:** ~860 lines of production-ready code

---

## Next Steps

1. Continue with `client.ts` implementation
2. Build out API endpoints in Supabase functions
3. Create database migration
4. Integrate into POS UI
5. Comprehensive testing in sandbox
6. Security audit
7. Production deployment

---

## References

- KCB BUNI API Documentation
- OpenAPI SDK Specification
- Postman Collection (provided)
- Existing M-Pesa integration patterns in `src/lib/mpesa.ts`
- Transaction utilities in `src/lib/transaction-utils.ts`

---

**Last Updated:** July 16, 2026  
**Implementation Status:** 15% Complete - Core Modules Ready


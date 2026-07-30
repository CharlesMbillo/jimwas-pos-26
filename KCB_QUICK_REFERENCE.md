# KCB BUNI - Quick Reference Guide

## Module Location
```
src/lib/modules/payments/kcb/
```

## Main Entry Point
```typescript
import { getKCBClient } from 'src/lib/modules/payments/kcb';

const client = getKCBClient();
```

## Core Operations

### 1. Validate Configuration
```typescript
const isValid = await client.validate();
```

### 2. Initiate STK Push
```typescript
const result = await client.initiateSTKPush({
  phoneNumber: '254712345678',
  amount: 1000,
  invoiceNumber: 'INV-001',
  description: 'Product sale'
});

// Returns:
// {
//   merchantRequestId: "...",
//   checkoutRequestId: "...",
//   messageId: "...",
//   correlationId: "...",
//   timestamp: "2026-07-16T10:30:00Z"
// }
```

### 3. Check Payment Status
```typescript
const status = await client.queryPaymentStatus(
  result.merchantRequestId,
  result.checkoutRequestId
);

// Returns: 
// {
//   status: 'paid' | 'failed' | 'timeout' | 'cancelled' | 'pending' | 'insufficient_funds',
//   receipt: "...",
//   resultCode: 0,
//   resultDesc: "Success"
// }
```

### 4. Health Check
```typescript
const health = await client.healthCheck();
// Returns: { status: 'healthy' | 'unhealthy', oauth: boolean, database: boolean }
```

## Error Handling

```typescript
import { 
  KCBPaymentError, 
  getErrorMessage,
  isRetryableError,
  isCustomerError
} from 'src/lib/modules/payments/kcb';

try {
  await client.initiateSTKPush({...});
} catch (error) {
  if (error instanceof KCBPaymentError) {
    console.log(error.code);        // 'INVALID_PHONE', 'NETWORK_ERROR', etc.
    console.log(error.message);     // Technical message
    console.log(error.statusCode);  // HTTP status if applicable
    
    const userMessage = getErrorMessage(error.code);
    alert(userMessage); // User-friendly message
    
    if (isRetryableError(error)) {
      // Retry logic
    }
    
    if (isCustomerError(error)) {
      // Ask customer to fix (e.g., insufficient funds)
    }
  }
}
```

## Utility Functions

### Phone Number Validation & Normalization
```typescript
import { 
  validatePhoneNumber, 
  normalizePhoneNumber 
} from 'src/lib/modules/payments/kcb';

validatePhoneNumber('254712345678');  // true
validatePhoneNumber('712345678');     // false
normalizePhoneNumber('0712345678');   // '254712345678'
normalizePhoneNumber('+254712345678'); // '254712345678'
```

### Amount Formatting
```typescript
import { validateAmount, formatAmount } from 'src/lib/modules/payments/kcb';

validateAmount(1000);       // true
validateAmount(-100);       // false
validateAmount(1000000000); // false (over max)
formatAmount(1000, 'KES');  // "KES 1,000.00"
```

### Retry Logic
```typescript
import { retry, delay } from 'src/lib/modules/payments/kcb';

// Retry with exponential backoff
const result = await retry(
  () => client.queryPaymentStatus(...),
  3,    // max attempts
  1000  // initial delay in ms
);

// Or manual delay
await delay(5000); // Wait 5 seconds
```

## Logging

```typescript
import { createLogger } from 'src/lib/modules/payments/kcb';

const logger = createLogger('MyModule');

logger.info('Payment started', { amount: 1000, phone: '254712345678' });
logger.error('Payment failed', { reason: 'Network error' }, error);
logger.debug('Debug info', { details: 'value' });

// Sensitive data automatically masked:
// - access_token
// - client_secret
// - password
// - pin
```

## Token Management

```typescript
import { 
  getAccessToken, 
  clearTokenCache,
  getTokenCacheInfo
} from 'src/lib/modules/payments/kcb';

// Get token (cached automatically)
const token = await getAccessToken();

// Check cache status
const info = getTokenCacheInfo();
// Returns: { hasCachedToken, expiresAt, expiresIn, cached }

// Force token refresh
clearTokenCache();
const newToken = await getAccessToken(); // Will request new token
```

## Configuration

```typescript
import { getKCBConfig, isKCBConfigured } from 'src/lib/modules/payments/kcb';

// Get configuration
const config = getKCBConfig();
// Returns: KCBConfig with all settings

// Check if configured
if (isKCBConfigured()) {
  console.log('KCB is properly configured');
}
```

## Environment Variables

```env
VITE_KCB_BASE_URL=https://api.sandbox.kcb.co.ke
VITE_KCB_CLIENT_ID=your_id
VITE_KCB_CLIENT_SECRET=your_secret
VITE_KCB_ROUTE_CODE=207
VITE_KCB_SHARED_SHORTCODE=true
VITE_KCB_ORG_SHORTCODE=your_shortcode
VITE_KCB_ORG_PASSKEY=your_passkey
VITE_KCB_CALLBACK_URL=https://your-domain.com/api/payments/kcb/ipn
VITE_KCB_PUBLIC_CERT_PATH=/certs/kcb-public.pem
```

## Type Definitions

### Payment Request
```typescript
interface CreatePaymentDTO {
  phoneNumber: string;      // "254712345678"
  amount: number;           // 1000
  invoiceNumber: string;    // "INV-001"
  description?: string;     // Optional
  customerId?: string;      // Optional
}
```

### Payment Response
```typescript
interface STKPushPayload {
  messageId: string;
  phoneNumber: string;
  amount: number;
  invoiceNumber: string;
  description: string;
  correlationId: string;
  timestamp: string;
  merchantName: string;
  merchantRequestId: string;
  checkoutRequestId: string;
}
```

### Payment Status
```typescript
interface PaymentStatus {
  status: 'paid' | 'failed' | 'timeout' | 'cancelled' | 'pending' | 'insufficient_funds';
  receipt?: string;
  resultCode?: number;
  resultDesc?: string;
}
```

## Error Codes

| Code | Message | Retry? |
|------|---------|--------|
| INVALID_PHONE | Invalid phone number | ❌ |
| INVALID_AMOUNT | Invalid or negative amount | ❌ |
| TOKEN_EXPIRED | Payment session expired | ✅ |
| TOKEN_FAILED | Failed to authenticate service | ✅ |
| STK_FAILED | STK Push request failed | ❌ |
| NETWORK_ERROR | Network error | ✅ |
| INVALID_SIGNATURE | Invalid payment signature | ❌ |
| DUPLICATE_TRANSACTION | Duplicate transaction | ❌ |
| CUSTOMER_CANCELLED | Payment cancelled by customer | ❌ |
| INSUFFICIENT_FUNDS | Insufficient funds | ❌ |
| TRANSACTION_TIMEOUT | Payment request timed out | ❌ |
| INVALID_RESPONSE | Invalid response from service | ✅ |

## Payment Status Flow

```
START
  ↓
initiateSTKPush()
  ├─ Phone validated
  ├─ Amount validated
  ├─ Sent to KCB
  ├─ merchantRequestId generated
  └─ checkoutRequestId received
  ↓
queryPaymentStatus()
  ├─ Pending
  ├─ Waiting (customer hasn't entered PIN)
  ├─ Paid ✅
  ├─ Failed ❌
  ├─ Cancelled ❌
  ├─ Timeout ❌
  └─ Insufficient Funds ❌
```

## Complete Example

```typescript
import {
  getKCBClient,
  formatAmount,
  getErrorMessage,
  isRetryableError,
  createLogger
} from 'src/lib/modules/payments/kcb';

const logger = createLogger('PaymentFlow');
const client = getKCBClient();

async function processPayment(phone: string, amount: number, invoice: string) {
  logger.setCorrelationId(`payment-${Date.now()}`);
  
  try {
    // Validate config
    const isValid = await client.validate();
    if (!isValid) throw new Error('KCB not configured');

    // Initiate payment
    logger.info('Initiating payment', { phone, amount, invoice });
    const payment = await client.initiateSTKPush({
      phoneNumber: phone,
      amount: amount,
      invoiceNumber: invoice,
      description: `Payment for ${invoice}`
    });

    logger.info('STK sent', { 
      merchantRequestId: payment.merchantRequestId,
      amount: formatAmount(amount, 'KES')
    });

    // Poll for status
    for (let i = 0; i < 60; i++) {
      await new Promise(r => setTimeout(r, 1000)); // Poll every second

      const status = await client.queryPaymentStatus(
        payment.merchantRequestId,
        payment.checkoutRequestId
      );

      if (status.status === 'paid') {
        logger.info('Payment successful', { receipt: status.receipt });
        return { success: true, receipt: status.receipt };
      }

      if (status.status === 'failed' || status.status === 'cancelled') {
        logger.warn('Payment failed', { reason: status.resultDesc });
        return { success: false, reason: status.resultDesc };
      }
    }

    logger.warn('Payment timeout');
    return { success: false, reason: 'Payment timeout' };

  } catch (error) {
    logger.error('Payment error', {}, error);
    
    if (isRetryableError(error)) {
      // Could retry
    }
    
    const message = getErrorMessage(error?.code || 'UNKNOWN_ERROR');
    return { success: false, reason: message };
  }
}
```

## Files to Know

| File | Purpose |
|------|---------|
| `types.ts` | All TypeScript interfaces |
| `constants.ts` | API endpoints, status codes |
| `config.ts` | Configuration management |
| `oauth.ts` | Token caching and refresh |
| `client.ts` | Main KCB client |
| `utils.ts` | Helper functions |
| `errors.ts` | Error handling |
| `logger.ts` | Structured logging |
| `index.ts` | Module exports |

## Next Steps for Implementation

1. **Database** → Create `repository.ts` and migrations
2. **API** → Create endpoint handlers in Supabase
3. **UI** → Add KCB payment modal to POS
4. **Signature** → Create `signature.ts` for callback verification
5. **Testing** → Add unit and integration tests
6. **Deploy** → Move to production with real credentials

See `KCB_IMPLEMENTATION_GUIDE.md` for complete details.

# KCB Frontend Integration Guide

Complete guide for integrating KCB edge functions into React components.

## Quick Start

### 1. Using the Hook (Recommended)

```typescript
import { useKCB } from '@/hooks/useKCB';

function MyComponent() {
  const { 
    checkBill, 
    loading, 
    error, 
    data 
  } = useKCB({
    autoRetry: true,
    maxRetries: 3,
    onError: (error) => console.error('KCB Error:', error),
    onSuccess: (message) => console.log(message),
  });

  const handleValidateBill = async () => {
    const result = await checkBill('INV-123', '0708374149', 1000);
    if (result.valid) {
      console.log('Bill details:', result.billDetails);
    }
  };

  return (
    <div>
      <button onClick={handleValidateBill} disabled={loading}>
        {loading ? 'Validating...' : 'Validate Bill'}
      </button>
      {error && <p className="text-red-500">{error}</p>}
      {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
    </div>
  );
}
```

### 2. Using the Utility Functions Directly

```typescript
import { 
  validateBill, 
  formatPhoneForKCB,
  formatAmountForKCB 
} from '@/lib/kcb-edge-functions';

async function handlePayment(invoiceNumber, phone, amount) {
  const result = await validateBill({
    invoiceNumber,
    phoneNumber: formatPhoneForKCB(phone),
    amount: formatAmountForKCB(amount),
  });

  if (result.valid) {
    // Proceed with payment
  } else {
    // Show error to user
    console.error(result.errorMessage);
  }
}
```

## Available Functions

### validateBill()

Query KCB to validate a bill before payment.

```typescript
const result = await validateBill({
  invoiceNumber: 'INV-2026-001',
  phoneNumber: '254708374149',
  amount: 1000,
});

// Response
if (result.valid) {
  console.log(result.billDetails);
  // {
  //   invoiceNumber: 'INV-2026-001',
  //   phoneNumber: '254708374149',
  //   amount: 1000,
  //   description: 'School fees payment',
  //   dueDate: '2026-08-31'
  // }
}
```

**Parameters:**
- `invoiceNumber` (string, required) - Unique bill identifier
- `phoneNumber` (string, required) - Customer phone number
- `amount` (number, optional) - Expected amount to validate

**Returns:**
- `success` (boolean) - Operation succeeded
- `valid` (boolean) - Bill is valid and ready for payment
- `billDetails` (object, optional) - Details if valid
- `errorCode` (string, optional) - Error code if invalid
- `errorMessage` (string, optional) - Human-readable error

### validateBillWithRetry()

Validate bill with automatic retry on transient errors.

```typescript
const result = await validateBillWithRetry(
  {
    invoiceNumber: 'INV-2026-001',
    phoneNumber: '254708374149',
  },
  {
    maxAttempts: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
  }
);
```

**Options:**
- `maxAttempts` (number) - Maximum retry attempts (default: 3)
- `initialDelayMs` (number) - Initial delay before retry (default: 1000)
- `maxDelayMs` (number) - Maximum delay (default: 10000)

### notifyBillPayment()

Send payment confirmation to KCB (typically from backend).

```typescript
const result = await notifyBillPayment({
  invoiceNumber: 'INV-2026-001',
  transactionId: generateKCBTransactionId(),
  amount: 1000,
  phoneNumber: '254708374149',
  transactionDate: new Date().toISOString(),
  mpesaReceiptNumber: 'ABC123XYZ',
  signature: 'SHA256withRSA...',
});
```

### notifyTillPayment()

Send till-specific payment notification (for till reconciliation).

```typescript
const result = await notifyTillPayment({
  invoiceNumber: 'INV-2026-001',
  transactionId: generateKCBTransactionId(),
  amount: 1000,
  phoneNumber: '254708374149',
  tillId: 'TILL-001',
  cashierId: 'CASHIER-123',
  cashierName: 'John Doe',
  transactionDate: new Date().toISOString(),
  signature: 'SHA256withRSA...',
});
```

## Utility Functions

### formatPhoneForKCB()

Convert phone number to KCB format (254XXXXXXXXX).

```typescript
formatPhoneForKCB('0708374149');        // → '254708374149'
formatPhoneForKCB('+254708374149');     // → '254708374149'
formatPhoneForKCB('254708374149');      // → '254708374149'
```

### formatAmountForKCB()

Ensure amount is integer (for currency consistency).

```typescript
formatAmountForKCB(1000.50);    // → 1000
formatAmountForKCB(-100);       // → 0
```

### generateKCBTransactionId()

Generate unique transaction ID for KCB.

```typescript
const txnId = generateKCBTransactionId();
// → 'TXN-ABC123-XYZ789'
```

### getKCBErrorMessage()

Get human-readable error message from error code.

```typescript
getKCBErrorMessage('BILL_NOT_FOUND');    // → 'Bill not found in system'
getKCBErrorMessage('INVALID_AMOUNT');    // → 'Amount does not match bill'
getKCBErrorMessage('UNKNOWN_CODE');      // → 'An error occurred'
```

### isRetryableError()

Check if error is transient and should be retried.

```typescript
isRetryableError('SERVICE_UNAVAILABLE');  // → true
isRetryableError('NETWORK_ERROR');        // → true
isRetryableError('BILL_NOT_FOUND');       // → false
```

## React Hook: useKCB()

Recommended for React components. Provides state management and callbacks.

### Basic Usage

```typescript
const { 
  checkBill,
  loading, 
  error, 
  data 
} = useKCB();

// Validate a bill
const result = await checkBill('INV-123', '0708374149', 1000);
```

### With Options

```typescript
const { 
  checkBill,
  notifyBill,
  notifyTill,
  loading,
  error,
  data,
  formatPhone,
  generateTransactionId,
  getErrorMessage,
  clearError,
  reset,
} = useKCB({
  autoRetry: true,              // Retry failed validations
  maxRetries: 3,                // Number of retries
  onError: (msg) => {           // Error callback
    showNotification(msg, 'error');
  },
  onSuccess: (msg) => {         // Success callback
    showNotification(msg, 'success');
  },
});
```

### State Properties

- `loading` (boolean) - Operation in progress
- `error` (string | null) - Error message if failed
- `data` (any | null) - Result data if successful

### Operations

- `checkBill(invoiceNumber, phone, amount?)` - Validate bill
- `notifyBill(payload)` - Notify KCB of payment
- `notifyTill(payload)` - Notify KCB of till payment

### Utilities

- `formatPhone(phone)` - Format phone number
- `formatAmount(amount)` - Format amount
- `generateTransactionId()` - Generate transaction ID
- `getErrorMessage(code)` - Get error message
- `checkRetryable(code)` - Check if retryable

### State Management

- `clearError()` - Clear error state
- `reset()` - Reset all state

## Example Components

### Bill Validation Form

```typescript
import { useKCB } from '@/hooks/useKCB';
import { useState } from 'react';

export function BillValidationForm() {
  const { checkBill, loading, error, data, clearError } = useKCB({
    autoRetry: true,
    maxRetries: 3,
  });

  const [form, setForm] = useState({
    invoiceNumber: '',
    phone: '',
    amount: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();

    const result = await checkBill(
      form.invoiceNumber,
      form.phone,
      parseInt(form.amount)
    );

    if (result.valid) {
      // Show bill details
      console.log('Bill valid:', result.billDetails);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        placeholder="Invoice Number"
        value={form.invoiceNumber}
        onChange={(e) =>
          setForm({ ...form, invoiceNumber: e.target.value })
        }
        disabled={loading}
      />

      <input
        type="tel"
        placeholder="Phone Number"
        value={form.phone}
        onChange={(e) => setForm({ ...form, phone: e.target.value })}
        disabled={loading}
      />

      <input
        type="number"
        placeholder="Amount"
        value={form.amount}
        onChange={(e) => setForm({ ...form, amount: e.target.value })}
        disabled={loading}
      />

      {error && <div className="text-red-500">{error}</div>}

      {data && (
        <div className="bg-green-50 p-4 rounded">
          <h3 className="font-semibold">Bill Details</h3>
          <p>Amount: {data.amount}</p>
          <p>Description: {data.description}</p>
          <p>Due: {data.dueDate}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Validating...' : 'Validate Bill'}
      </button>
    </form>
  );
}
```

### Payment Processing Component

```typescript
import { useKCB } from '@/hooks/useKCB';
import { useState } from 'react';
import { initiateSTKPush } from '@/lib/mpesa';

export function PaymentProcessor() {
  const { checkBill, notifyBill, loading, error } = useKCB();
  const [status, setStatus] = useState('');

  const handlePayment = async (invoiceNumber, phone, amount) => {
    try {
      // Step 1: Validate bill
      setStatus('Validating bill...');
      const validation = await checkBill(invoiceNumber, phone, amount);

      if (!validation.valid) {
        setStatus(`Validation failed: ${validation.errorMessage}`);
        return;
      }

      // Step 2: Initiate M-Pesa payment
      setStatus('Initiating M-Pesa payment...');
      const mpesaResult = await initiateSTKPush(phone, amount, {
        transactionId: invoiceNumber,
      });

      if (!mpesaResult.success) {
        setStatus(`Payment failed: ${mpesaResult.error}`);
        return;
      }

      // Step 3: Notify KCB (after M-Pesa success)
      setStatus('Notifying KCB...');
      const notifyResult = await notifyBill({
        invoiceNumber,
        amount,
        phoneNumber: phone,
        mpesaReceiptNumber: mpesaResult.mpesaTransactionId,
        signature: 'SIGNATURE_FROM_KCB', // Would come from backend
      });

      if (notifyResult.success) {
        setStatus('Payment successful!');
      } else {
        setStatus(`Notification failed: ${notifyResult.error}`);
      }
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-gray-600">{status}</div>
      {error && <div className="text-red-500">{error}</div>}

      <button
        onClick={() => handlePayment('INV-123', '0708374149', 1000)}
        disabled={loading}
        className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {loading ? 'Processing...' : 'Process Payment'}
      </button>
    </div>
  );
}
```

## Error Handling

### Common Errors

| Error Code | Cause | Resolution |
|---|---|---|
| `BILL_NOT_FOUND` | Bill doesn't exist in KCB | Check invoice number |
| `INVALID_AMOUNT` | Amount doesn't match | Verify amount |
| `INVALID_PHONE` | Phone doesn't match | Verify phone number |
| `SIGNATURE_VERIFICATION_FAILED` | Invalid signature | Check signature generation |
| `SERVICE_UNAVAILABLE` | KCB service down | Retry with exponential backoff |

### Error Recovery Pattern

```typescript
const { checkBill, error, checkRetryable, clearError } = useKCB();

async function validateWithRecovery(invoice, phone) {
  try {
    const result = await checkBill(invoice, phone);

    if (!result.success && checkRetryable(result.errorCode)) {
      // Transient error - retry after delay
      setTimeout(() => validateWithRecovery(invoice, phone), 3000);
    } else if (!result.success) {
      // Permanent error - show to user
      console.error(result.errorMessage);
    }
  } catch (err) {
    console.error('Unexpected error:', err);
  }
}
```

## Performance Optimization

### Caching Bill Validations

```typescript
import { useMemo } from 'react';
import { validateBill } from '@/lib/kcb-edge-functions';

export function CachedBillValidation({ invoice, phone, amount }) {
  const result = useMemo(
    () => validateBill({ invoiceNumber: invoice, phoneNumber: phone, amount }),
    [invoice, phone, amount]
  );

  return <div>{/* Use result */}</div>;
}
```

### Batch Validations

```typescript
import { validateMultipleBills } from '@/lib/kcb-edge-functions';

async function validateBatch(bills) {
  const results = await validateMultipleBills(bills);

  // Process results
  for (const [invoice, result] of results.entries()) {
    console.log(`${invoice}: ${result.valid ? 'Valid' : 'Invalid'}`);
  }
}
```

## Troubleshooting

### Issue: "Empty response from KCB service"

**Cause:** Edge function not returning data

**Solution:**
1. Verify edge function is deployed
2. Check Supabase logs for errors
3. Ensure environment variables are set

### Issue: "Signature verification failed"

**Cause:** Invalid X-KCB-SIGNATURE header

**Solution:**
1. Ensure signature is generated correctly
2. Use SHA256withRSA algorithm
3. Use correct certificate from KCB

### Issue: High latency on bill validation

**Cause:** Network or KCB service delays

**Solution:**
1. Use `validateBillWithRetry()` with backoff
2. Implement request timeout
3. Cache results when appropriate

## Support & Documentation

- **API Endpoints:** See `KCB_PAYLOAD_REFERENCE.md`
- **Configuration:** See `KCB_CONFIGURATION_GUIDE.md`
- **Testing:** See `KCB_TESTING_GUIDE.md`
- **UAT Preparation:** See `KCB_UAT_PREPARATION.md`

---

**Last Updated:** July 30, 2026
**Version:** 1.0
**Status:** Production Ready

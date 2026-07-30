# KCB Buni Configuration Guide

## Phase 7 & 8: Environment Variables & Security Configuration

This guide covers all configuration required for KCB Buni integration.

### Environment Variables Required

Add these to your Supabase Edge Functions environment:

```bash
# KCB Authentication (from KCB)
KCB_ORG_SHORT_CODE=YOUR_ORG_CODE
KCB_ORG_PASS_KEY=YOUR_PASS_KEY

# KCB Public Key for Signature Verification (PEM format)
# Get this from KCB during onboarding
KCB_PUBLIC_KEY="-----BEGIN CERTIFICATE-----
MIIDXTCCAkWgAwIBAgIJAKvxF... (full certificate)
-----END CERTIFICATE-----"

# KCB API Endpoints
KCB_BILL_VALIDATION_URL=https://sandbox.kcbgroup.com/api/bill-validation
KCB_CALLBACK_URL=https://sandbox.kcbgroup.com/api/payment-confirmation

# Environment
KCB_ENVIRONMENT=sandbox  # or production

# Optional: Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_REQUESTS_PER_MINUTE=60
```

### Supabase Setup

1. **Add Environment Variables**
   - Go to Supabase Dashboard → Project Settings → Edge Functions
   - Add all variables from above
   - Restart Edge Functions

2. **Run Database Migrations**
   ```bash
   supabase migration up
   ```
   This creates:
   - `bill_validations` table
   - `kcb_transactions` table
   - `till_transactions` table
   - `kcb_audit_logs` table
   - `kcb_settings` table

3. **Configure CORS**
   ```sql
   -- Your Supabase Edge Functions have CORS enabled by default
   -- No additional configuration needed
   ```

### Vercel Deployment

1. **Add Environment Variables to Vercel**
   ```bash
   vercel env add KCB_PUBLIC_KEY
   vercel env add KCB_ORG_SHORT_CODE
   vercel env add KCB_ORG_PASS_KEY
   vercel env add KCB_ENVIRONMENT
   ```

2. **Verify Edge Functions are Deployed**
   - `kcb-bill-validation`
   - `kcb-bill-notification`
   - `kcb-till-notification`

3. **Test Endpoints**
   ```bash
   curl -X POST https://your-supabase-url/functions/v1/kcb-bill-validation \
     -H "Content-Type: application/json" \
     -d '{
       "phoneNumber": "254700000000",
       "amount": 100,
       "invoiceNumber": "INV001",
       "orgShortCode": "YOUR_ORG_CODE"
     }'
   ```

### KCB Registration

**Register these callback URLs with KCB:**

1. Bill-Notification URL
   ```
   https://{your-domain}/functions/v1/kcb-bill-notification
   ```

2. Till-Notification URL
   ```
   https://{your-domain}/functions/v1/kcb-till-notification
   ```

### Security Checklist

- [ ] KCB_PUBLIC_KEY is stored securely (Supabase secrets)
- [ ] HTTPS enforced on all endpoints
- [ ] Signature verification enabled (automatic)
- [ ] Rate limiting configured
- [ ] Audit logs enabled
- [ ] CORS properly configured
- [ ] Environment set to "production" for live
- [ ] Certificate validation enabled

### Testing Configuration

**Sandbox Testing URLs (from KCB):**

```
Bill Validation (Query):
POST https://sandbox.kcbgroup.com/api/bill-validation

Bill Notification (IPN):
POST https://your-domain/functions/v1/kcb-bill-notification
Headers: X-KCB-SIGNATURE: <base64-signature>

Till Notification (IPN):
POST https://your-domain/functions/v1/kcb-till-notification
Headers: X-KCB-SIGNATURE: <base64-signature>
```

### Configuration Verification Checklist

```bash
# 1. Verify Supabase Connection
curl -H "Authorization: Bearer $SUPABASE_KEY" \
  https://$SUPABASE_URL/rest/v1/kcb_settings?select=count

# 2. Verify Edge Functions Deployed
curl https://$SUPABASE_URL/functions/v1/kcb-bill-validation -X OPTIONS

# 3. Verify Environment Variables
echo $KCB_PUBLIC_KEY (should contain certificate)
echo $KCB_ENVIRONMENT (should be sandbox or production)

# 4. Test Bill Creation
curl -X POST https://your-app/api/bills \
  -H "Content-Type: application/json" \
  -d '{
    "invoiceNumber": "TEST001",
    "orgShortCode": "YOUR_ORG_CODE",
    "phoneNumber": "254700000000",
    "amount": 100
  }'
```

### Troubleshooting

**Issue: Signature verification fails**
- Verify KCB_PUBLIC_KEY is correctly formatted (PEM)
- Check X-KCB-SIGNATURE header is present
- Ensure body hasn't been modified after receipt

**Issue: Bill validation returns 404**
- Verify bill exists in database
- Check orgShortCode matches
- Verify phone number format (254XXXXXXXXX)

**Issue: Audit logs not showing**
- Check RLS policies are correct
- Verify Supabase credentials
- Check if user is authenticated

### Next Steps

1. Get KCB credentials and public key
2. Add environment variables to Supabase
3. Deploy Edge Functions
4. Register callback URLs with KCB
5. Run integration tests
6. Proceed to UAT

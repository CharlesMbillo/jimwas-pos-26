# KCB BUNI operations

## Runtime contract

- STK initiation remains `kcb-stk-push`.
- Callback remains `kcb-ipn-notification`.
- Status polling remains `mpesa-status`; it reads the authoritative `kcb_payments` row and must not create a payment.
- The default callback is `${SUPABASE_URL}/functions/v1/kcb-ipn-notification`; a configured callback override is used only when it is explicitly set.

## Security controls

- KCB client credentials, passkeys, and OAuth tokens are server-side only.
- STK requests validate Kenyan `07`, `01`, `254`, and `+254` phone forms and positive KES amounts with at most two decimals.
- Idempotency is keyed by the caller's idempotency header or the transaction/reference, phone, and amount tuple. Retrying an active attempt reuses it instead of sending another push.
- Callbacks correlate by checkout or merchant request ID, are replay-safe, and cannot regress a finalized success.
- Payment records are service-role writable. Anonymous clients no longer have read/write/delete access to `kcb_payments`.
- The administrator diagnostics panel never displays secrets and explicitly marks deployment/provider behavior that has not been verified.

## Not verified

The repository has conflicting historical endpoint assumptions (`/oauth/token`, older `/api/v1` paths, and `/mm/api/request/1.0.0/stkpush`). The active function uses `KCB_BUNI_BASE_URL`, `KCB_BUNI_TOKEN_URL` when present, and the existing BUNI STK path. Confirm the exact sandbox and production paths, callback acknowledgment, provider signature/HMAC scheme, and status code catalog with KCB before go-live; this implementation does not invent a signature mechanism.

## Go-live checklist

1. Confirm KCB has approved the production application and callback URL.
2. Confirm `KCB_BUNI_BASE_URL`, `KCB_BUNI_TOKEN_URL`, client credentials, and shortcode/passkey are production values.
3. Deploy and verify `kcb-stk-push`, `kcb-ipn-notification`, `mpesa-status`, and `mpesa-timeout`.
4. Send one controlled sandbox payment and verify one `kcb_payments` row, one callback update, one receipt, and no duplicate invoice/inventory effects.
5. Confirm duplicate callbacks and repeated browser requests are no-ops.
6. Keep the administrator diagnostics warning visible until provider endpoints and callback security are independently confirmed.

## Rollback

Disable KCB in Settings > Payments. Do not delete pending rows or manually mark payments successful. Investigate by checkout/merchant request ID, preserve callback payloads for audit, and only allow the authoritative callback/status flow to finalize a payment.

# Cashfree architecture — Skiplines

**Status:** Production uses **one-time ₹999 PG orders**, not Cashfree autopay subscriptions.

## Active production path (GREEN — do not break)

| Step | Route / module | Notes |
|------|----------------|-------|
| Create order | `POST /api/cashfree/create-order` | Server sets `order_amount = 999` |
| Checkout | `@cashfreepayments/cashfree-js` via `lib/cashfree-checkout.ts` | Dashboard only |
| Browser return | `POST /api/cashfree/verify-payment` | Doctor-auth + amount check |
| Webhook | `POST /api/webhooks/cashfree` (+ alias `/api/cashfree/webhook`) | Signature + amount + idempotency |
| Activation | `lib/cashfree-payment.ts` | `activateClinicSubscription` |

Webhook handler also understands subscription *events* for forward-compatibility
(`SUBSCRIPTION_*` in `lib/cashfree-webhook-handler.ts`). That does **not** mean
autopay is the active product path.

## Reserved / not wired in UI (do not delete without re-proof)

These routes exist and require doctor auth, but **no frontend**.tsx caller
invokes them. Kept for webhook compatibility and possible future autopay enablement:

- `POST /api/cashfree/create-subscription`
- `POST /api/cashfree/verify-subscription`
- `POST /api/cashfree/cancel-subscription`
- `POST /api/cashfree/verify` (legacy alias toward payment verification)

**Deletion policy:** Only remove after proving zero dashboard callers, zero
webhook dependency, and a dedicated migration if DB columns are retired.

## Production invariants

- `SUBSCRIPTION_TEST_MODE` must not be `true` on Production
- Amount is always server-authoritative via `getSubscriptionAmountInr()`
- Client-supplied amounts are ignored

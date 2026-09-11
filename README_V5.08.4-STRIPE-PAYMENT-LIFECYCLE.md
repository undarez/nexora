# NEXORA V5.08.4 — Stripe Payment Lifecycle

## Objective

Extend the Stripe foundation into a server-controlled payment lifecycle without confusing Stripe Payments with European Open Banking aggregation.

- Powens remains the Open Banking provider for the current France/Europe banking aggregation path.
- Stripe handles NEXORA payment capabilities.
- Stripe secrets remain server-side.
- PaymentIntent creation is idempotent and mapped to the authenticated NEXORA user.
- Stripe webhooks are signature-verified before state changes.
- Webhook events are deduplicated by Stripe event ID.
- Raw Stripe webhook payloads are not persisted.

## Environment

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Routes

- `POST /api/payments/stripe/payment-intent`
- `POST /api/payments/stripe/webhook`

## Payment flow

1. Authenticated NEXORA user submits a payment request with an application-owned idempotency key.
2. Server checks the `(user_id, idempotency_key)` ledger.
3. If absent, server creates the Stripe PaymentIntent using the same idempotency key.
4. Server stores only the normalized payment state needed by NEXORA.
5. Stripe sends asynchronous webhook events.
6. Server verifies `Stripe-Signature` with a 5-minute replay window.
7. Duplicate event IDs are acknowledged without being processed twice.
8. PaymentIntent state is updated from verified Stripe events.

## Security decisions

- No Stripe secret key in client code.
- No unauthenticated PaymentIntent creation.
- No trust in client-provided `nexora_user_id`; the server injects it into metadata.
- No raw webhook payload storage.
- Webhook endpoint does not use a Supabase user session.
- Webhook state writes use the server-only Supabase admin client.
- Database RLS exposes payment rows only to their owner for SELECT; mutation is server-side.

## Stripe/Open Banking boundary

This module is intentionally **not** a Stripe replacement for Powens. Stripe PaymentIntents are payment-collection primitives. Open Banking aggregation remains provider-neutral and is implemented through the banking adapter layer.

## Verification

The implementation was statically reviewed after the Stripe lifecycle changes. A full TypeScript/build verification could not be completed in this environment because dependencies were not installed and the dependency installation exceeded the available execution window. No `node_modules` directory is included in the delivery archive.

# WazLink Billing, Payments, and Tax Architecture

> Architecture and contracts only. Tap, ZATCA, invoices, payment processing, and secrets are not implemented in B0.

## Separation

Platform Billing owns WazLink plans, subscriptions, usage, invoices, payment attempts, refunds, and tax documents. Customer Revenue owns RevenueEvent, AttributionTouchpoint, and sales outcomes. The two domains use separate tables, services, permissions, DTOs, events, and analytics semantics.

## Billing flow

```text
select plan → server validates workspace/permission/entitlement
→ quote → tokenized/hosted Tap session → provider result
→ signed webhook receipt → payment reconciliation
→ subscription update → entitlement update → invoice
→ TaxInvoice/ZATCA handling
```

A browser redirect is never payment truth. `PaymentSucceeded` requires a verified provider callback or reconciled provider query. Subscription activation requires a captured payment or an explicitly accepted provider state. Query parameters cannot grant a plan or entitlement.

## Payment state

`created → pending → authorized → captured`; terminal alternatives are `failed` and `cancelled`; captured payments can become `refunded` or `partially_refunded`. Provider mapping is marked **REQUIRES PROVIDER CONTRACT VALIDATION** before coding. Each payment has provider ID, amount/currency, subscription/invoice references, idempotency record, attempts, callback history, and audit log. Raw card data is never stored; prefer Tap-hosted/tokenized flow to reduce PCI scope.

## Subscription state

Phase 1 supports `active`, `past_due`, `suspended`, `cancelled`, and `expired`. `trialing` is permitted only if the Product Owner confirms trial semantics. A subscription transition is a Billing service command and emits an outbox event. Entitlements are re-evaluated from the authoritative subscription and plan catalog.

## Invoice and tax

Invoice and TaxInvoice are separate. Invoice represents the commercial billing document; TaxInvoice represents the Saudi tax document and submission lifecycle. Tax fields include seller/buyer data, VAT number, tax rate/amount, subtotal/total, currency, invoice UUID, issue timestamp, QR payload, and ZATCA status, subject to **REQUIRES OFFICIAL ZATCA VALIDATION**. Tap does not itself establish ZATCA compliance.

## Idempotency and reconciliation

Payment initiation, callback handling, invoice creation, subscription update, refund, and tax submission require stable idempotency keys and unique provider references. Reconciliation compares Payment, Invoice, Subscription, Tap status, and Tax/ZATCA status on a scheduled Celery queue. A missing callback leaves payment pending; it does not activate a subscription from redirect evidence alone.

## Revenue boundary

No Billing event creates customer RevenueEvent unless an explicit, separately approved revenue-recognition rule exists. A successful WazLink subscription payment is platform Billing, not a customer Deal revenue event. A customer Deal becoming Won does not create a Billing payment, invoice, or RevenueEvent.

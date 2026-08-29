# WazLink Billing, Payments, and Tax Architecture

> Architecture and contracts only. Tap, ZATCA, invoices, payment processing, and secrets are not implemented in B0.

## Separation

Platform Billing owns WazLink plans, subscriptions, upgrade quotes, usage, invoices, payment attempts, refunds, and tax documents. Customer Revenue owns RevenueEvent, AttributionTouchpoint, and sales outcomes. The two domains use separate tables, services, permissions, DTOs, events, and analytics semantics.

## Billing flow

```text
select plan → server validates workspace/permission/entitlement
→ server-priced durable quote (UPQ-*, expiring) → payment initiation loads and consumes the stored quote
→ tokenized/hosted Tap session → provider result
→ signed webhook receipt → payment reconciliation
→ subscription update → entitlement update → invoice
→ TaxInvoice/ZATCA handling
```

## UpgradeQuote — durable server-authoritative pricing

`POST /api/v1/billing/upgrade-quotes` creates a **durable** UpgradeQuote row in `upgrade_quotes` with an immutable `UPQ-*` public ID. The quote is Platform Billing truth, workspace-scoped, and server-priced.

The server computes and stores the authoritative plan, amount, and currency from the Entitlements plan catalog and billing policy at issue time, together with `status`, `created_at`, and `expires_at`. Nothing a client sends sets those values: `QuoteRequest.plan_ref` names the target plan and `QuoteRequest.currency` is a requested presentation currency that the server may reject but never prices from.

Payment initiation is quote-driven. `POST /api/v1/billing/payments` resolves `PaymentCreate.quote_ref` to a stored `UPQ-*` row **under workspace scope before object resolution**, then derives the plan, amount, and currency from that row. A client MUST NOT be able to alter the quoted plan, the authoritative amount, the authoritative currency, or any discount/price calculation by changing fields in `PaymentCreate`. `PaymentCreate.amount` and `PaymentCreate.currency` are retained as **non-authoritative validation mirrors**: they must equal the stored quote, a mismatch is a validation error, and the provider payment request is always built from the stored quote values, never from the request body.

A quote is usable only while `active` and unexpired. One quote authorizes **at most one payment-initiation lineage**: consumption sets `status = consumed`, `consumed_at`, and `payment_id` in the same transaction that creates the Payment, so a concurrent or later independent attempt against the same quote conflicts. Retries carrying the same `Idempotency-Key` and body replay the original result and are not a second consumption. A cross-workspace quote is treated as absent and never discloses that the object exists elsewhere.

An UpgradeQuote is commercial authorization only. Issuing, consuming, expiring, or cancelling a quote never creates, implies, or mutates a customer `REV-*` RevenueEvent.

## Payment truth

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

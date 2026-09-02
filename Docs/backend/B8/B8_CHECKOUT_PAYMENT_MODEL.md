# B8 — Checkout & Payment Model

> Design only. Reuses frozen `UpgradeQuote`/`Payment` verbatim; details the previously-undetailed `billing_customers` and `payment_attempts` tables, and states the exact orchestration boundary.

## 1. No `Checkout`/`BillingCheckout` aggregate

Per `B8_TAP_PROVIDER_BOUNDARY.md`'s evidence and the frozen public-ID registry's own note (`CHK-*` is explicitly a non-canonical frontend fixture — "B0 models no `checkouts` table; the durable platform-billing identities for this flow are `UPQ-*`, `PAY-*`, `INV-BILL-*`, and `SUB-*`"), B8 does **not** introduce a `Checkout`/`BillingCheckout`/`PaymentAttempt`-as-top-level-aggregate entity. The already-frozen `UpgradeQuote` (price/plan snapshot, single-consumption) plus `Payment` (provider-neutral lifecycle) together satisfy every requirement the brief's §17 lists: workspace, subscription intent (`quote_ref`→`plan_ref`), plan/version snapshot (§2), amount/currency snapshot (on the quote), provider, provider reference, idempotency, status, redirect/callback correlation, `created_by`, timestamps, failure classification. Introducing a third aggregate would duplicate state the quote+payment pair already owns.

## 2. Price snapshot (brief §18)

`UpgradeQuote.amount`/`.currency` are computed and stored once, at `CreateUpgradeQuote` time, from the target plan's **current** `PlanVersion` (§`B8_PLAN_CATALOG.md` §5) — this is already the frozen mechanism ("The server computes and stores the authoritative plan, amount, and currency... at issue time... Nothing a client sends sets those values," `BACKEND_BILLING_TAX_ARCHITECTURE.md`). `CreatePayment` never re-derives price from the live catalog — it derives exclusively from the stored quote row (frozen). This already fully satisfies brief §18 without any B8-invented mechanism; B8's only addition is that the quote's snapshot is now sourced from an immutable `PlanVersion` row rather than a mutable `Plan` row, closing the gap `B8_PLAN_CATALOG.md` §2 identifies.

## 3. `payment_attempts` (frozen table name, newly detailed, `B8-D-A017`)

One `Payment` may correspond to more than one round-trip to the provider (an initial charge call, a 3DS-challenge continuation, a reconciliation retrieve-charge call). `payment_attempts` records each: `id`, `payment_id` FK, `attempt_number` (sequential per payment), `kind` (`create` | `reconciliation_query` | `retry`), `provider_request_ref` (opaque, nullable until the provider responds), `outcome_status` (the normalized status returned, §`B8_PAYMENT_PROVIDER_PORT.md` §3), `occurred_at`. It is **not** independently publicly addressable (no new public-ID prefix, brief §45) — always accessed as a child list under a `PAY-*` Payment. `payment_attempts` is the audit trail of *how* a Payment reached its current status; `Payment.status` itself is always the current, authoritative, single value.

## 4. `refunds` (frozen table name, newly detailed)

`id`, `payment_id` FK (the original captured Payment being reversed), `provider_refund_ref`, `amount` (`NUMERIC(19,4)`), `currency`, `reason` (`duplicate`|`fraudulent`|`requested_by_customer`|free text, mirroring Tap's own reason vocabulary, `B8-X-008`), `status` (`pending`|`refunded`|`failed`), `created_at`, `created_by_membership_id`. A refund never creates a new `PAY-*`; it is a child record. `Payment.status` transitions to `refunded`/`partially_refunded` (frozen) once its refund(s) fully or partially cover `amount`. No independent public ID (brief §45).

## 5. `billing_customers` (frozen table name, newly detailed, `B8-D-A018`)

`id`, `workspace_id` (unique — one Tap customer per workspace, ever, per `B8_TAP_PROVIDER_BOUNDARY.md` `B8-X-013`), `provider` (`tap`), `provider_customer_ref` (opaque), `provider_agreement_ref` (opaque, nullable — populated once a recurring-payment agreement exists, §`B8_PAYMENT_PROVIDER_PORT.md` §6), `created_at`. This is also the **webhook workspace-resolution join** the research digest surfaced from `B1_WORKSPACE_MEMBERSHIP_MODEL.md` §1.4 — an inbound Tap webhook resolves its workspace by looking up `provider_customer_ref`/`provider_agreement_ref` here, never by trusting a `workspace_id` embedded in the provider payload; a receipt that resolves to zero or more than one workspace is quarantined and alerted, never guessed (§`B8_WEBHOOK_MODEL.md` §3).

## 6. Orchestration sequence (restates the frozen sequence diagram, closing brief §17's "orchestration boundary")

```
1. CreateUpgradeQuote      → UpgradeQuote{active}, priced from current PlanVersion
2. CreatePayment           → locks subscription row (§B8_UPGRADE_DOWNGRADE_MODEL.md §3),
                              locks+consumes the quote, creates Payment{created→pending}
                              in one transaction; ensures billing_customers row exists
3. adapter: create_charge  → Payment{pending}, provider_payment_ref set, payment_attempts row appended
4. browser redirect        → UX only; never mutates Payment/Subscription (§8)
5. signed webhook          → WebhookReceipt{verified} → ProcessPaymentWebhook →
                              Payment{captured} → payment_attempts row appended →
                              PaymentSucceeded → SubscriptionActivated → entitlements re-resolved live
```

Every arrow is a single Billing-owned transaction boundary; no step spans two transactions.

## 7. Renewal (recurring) charges

A scheduled Billing task (Celery, per ADR-004) identifies subscriptions whose `current_period_end` is approaching (illustrative: within 24 hours) and, for each `active` one with a stored `provider_agreement_ref`, creates a new `Payment` via `create_recurring_charge` (§`B8_PAYMENT_PROVIDER_PORT.md` §6) — following the identical webhook-first confirmation path as §6 steps 3–5, landing on either a renewed `current_period_start`/`current_period_end` (on `captured`) or `active→past_due` (on `failed`/no response by the boundary, §`B8_SUBSCRIPTION_STATE_MACHINE.md` §2). A cancelled (`cancel_at_period_end=true`) subscription is excluded from this scan — no renewal charge is ever attempted for a subscription already scheduled to end.

## 8. Payment truth (restated, load-bearing)

A browser redirect is UX evidence only and never mutates `Payment`/`Subscription` state (frozen `BACKEND_BILLING_TAX_ARCHITECTURE.md`, corroborated independently by Tap's own official documentation, `B8_TAP_PROVIDER_BOUNDARY.md` `B8-X-011`: "the redirect alone does not prove payment success... must make a `/charge` request to retrieve the transaction details"). The redirect handler's only legal action is to trigger a **read-only, idempotent** reconciliation check (`retrieve_charge`) for UX purposes (e.g., showing a spinner vs. a result) — never a write. `PaymentSucceeded`/`SubscriptionActivated` are produced exclusively by `ProcessPaymentWebhook` or `ReconcilePayment` (§`B8_RECONCILIATION_MODEL.md`).

## 9. Storage summary

| Table | Scope | Mutability |
|---|---|---|
| `upgrade_quotes` | workspace | frozen, unchanged |
| `payments` | workspace | frozen, unchanged |
| `payment_attempts` | workspace (via payment) | append-only |
| `refunds` | workspace (via payment) | append-only, status field updatable until terminal |
| `billing_customers` | workspace, unique | `provider_agreement_ref` updatable once; rest immutable after creation |
| `invoices`, `invoice_lines` | workspace | append-only once `issued`, per `BACKEND_DATA_MODEL.md`'s append-orientation for financial records |

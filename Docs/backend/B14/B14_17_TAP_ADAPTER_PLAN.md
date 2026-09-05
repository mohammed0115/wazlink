# B14_17 — Tap Adapter Plan

> Preserves frozen B8. **Platform billing only — WazLink → workspace.** Tap-specific contracts are verified from official documentation during slice I9.

## 1. Boundary

```
apps/billing (B8)  →  PaymentProviderPort  →  adapters/tap  →  Tap API
```

`apps/billing` owns subscription, invoice and payment truth. The adapter owns translation only. **No Tap field name, status string or error code appears in a billing model, DTO, event or API response.**

## 2. Implementation order

1. **Configuration + health** — `CheckProviderConfiguration`, credential validation, `integration_connections` row. Nothing charges yet.
2. **Checkout initiation** — `StartCheckout` prices server-side from `upgrade_quotes` (**the client never supplies plan, amount or currency**), writes a `payment_attempts` row **before** the call, returns a redirect/session reference.
3. **Webhook ingestion** — `POST /webhooks/tap`, `hashstring` verification, receipt + dedup, fast-ack, `webhooks` queue → `ApplyPaymentWebhook`.
4. **Payment status application** — monotonic, idempotent on the provider payment reference.
5. **Reconciliation** — `P-1` for `unknown` charge outcomes; `payment_without_recognition` is **`info`, usually correct** — platform billing is never customer revenue (`B9-D-A021`).
6. **Refund / cancel** — only to the extent frozen B8 scopes them; nothing is invented here.

## 3. Money and safety rules

`NUMERIC(19,4)` + ISO-4217, as frozen B0 requires · amounts are **server-priced**; no client request may write plan, amount or currency · **an `unknown` charge outcome is never retried** (`B12-D-A020`) — a duplicate charge is the canonical harm that rule exists to prevent · card data is **never** stored, logged or received by WazLink; only the frozen safe metadata (`http_status`, `provider_code`, `provider_request_reference`, `error_class`) is retained.

## 4. Revenue firewall

**Subscription Billing ≠ Customer Revenue.** Nothing in `adapters/tap` or `apps/billing` may write `revenue_events`, and `payment_without_recognition` is an expected `info` case, not a defect. `RecordRevenueEvent` remains the sole writer, human-membership-only, in `apps/revenue`.

`tax_invoices` remain **WazLink → workspace** (B10). No customer-facing invoice is produced (`B9-D-C004` stays deferred).

## 5. Configuration

`TAP_SECRET_KEY` (secret) · `TAP_PUBLIC_KEY` · `TAP_WEBHOOK_SECRET` (secret). Missing ⇒ connection `not_connected`; checkout unavailable; **the platform starts and every non-billing flow works normally.**

**Implementation-time verification required** for Tap's current API surface, webhook signature scheme, status vocabulary and sandbox/test-mode availability. B14 asserts none of these.

## 6. Tests

| ID | Precondition | Action | Expected assertion |
|---|---|---|---|
| `T-TAP-1` **(NC)** | A valid `upgrade_quote` | `POST /billing/checkout` supplying `amount`, `currency` and `plan` in the request body | **All three ignored or rejected**; the charge uses the **server-priced** quote only |
| `T-TAP-2` | Webhook secret configured | POST with a valid, then an invalid, `hashstring` (field-concatenation HMAC-SHA256) | Valid ⇒ accepted; **invalid ⇒ rejected**; verification happens **before any parse** |
| `T-TAP-3` **(NC)** | A processed Tap callback | Re-deliver it | **No-op** — dedup on `(provider, object_id, status, created)` from Tap's own **signed** fields (`B12-X-005`, `B12-D-A032`) |
| `T-TAP-4` **(NC)** | A charge whose outcome is forced to `unknown` | Run every retry and sweep path | **Never retried**; `P-1` case opened. A duplicate charge is the canonical harm `B12-D-A020` prevents |
| `T-TAP-5` **(NC)** | A payment captured successfully | Inspect `revenue_events` | **No row written by any billing path** — `RecordRevenueEvent` remains the sole writer |
| `T-TAP-6` **(NC)** | Sentinel secret; a payment flow with card-shaped input | Inspect every log record, `provider_request_attempts` row and error message | **No card data and no secret anywhere**; only the frozen safe metadata (`http_status`, `provider_code`, `provider_request_reference`, `error_class`) |
| `T-TAP-7` | `TAP_SECRET_KEY` absent | Start the platform; exercise every non-billing flow | Connection `not_connected`; **checkout unavailable; the platform starts and every non-billing flow works normally** |
| `T-TAP-8` | Reconciliation sweep | Observe a captured payment with no revenue recognition | `payment_without_recognition` is an **`info`** case, *usually correct* — **not a defect** (`B9-D-A021`) |

# B8 — Payment Provider Port

> Design only. `PaymentProviderPort` is the name already frozen in `BACKEND_INTEGRATION_BOUNDARIES.md` ("Tap Payments | `PaymentProviderPort` | outbound + webhook | Billing/Payments | hosted/tokenized session, provider status, signature, webhook-first truth, reconciliation"); this document specifies its provider-neutral shape.

## 1. Purpose

Tap is an adapter behind this port. No Tap-specific ID, status string, or payload shape ever appears in a B8 domain model, DTO, or command signature — only in the adapter implementation (out of scope for B8; design only) described at the boundary in `B8_TAP_PROVIDER_BOUNDARY.md`. Replacing Tap with a different provider requires only a new adapter implementing this same port; zero B8 aggregate, state machine, or API contract changes.

## 2. Port interface (conceptual — no code authored)

| Operation | Input (provider-neutral) | Output (provider-neutral) |
|---|---|---|
| `ensure_customer(workspace_id)` | workspace identity | opaque `provider_customer_ref` |
| `create_charge(payment, quote)` | `Payment` internal id, amount, currency, customer ref, idempotency key, redirect URL, webhook URL | `provider_payment_ref` (opaque), initial normalized status |
| `retrieve_charge(provider_payment_ref)` | opaque ref | normalized status, amount, currency, timestamps |
| `create_refund(provider_payment_ref, amount, reason)` | opaque ref, amount, reason | `provider_refund_ref`, normalized refund status |
| `verify_webhook(raw_headers, raw_body)` | raw inbound webhook | boolean authenticity result + normalized event |
| `create_recurring_charge(agreement_ref, payment, quote)` | stored agreement reference, amount, currency | `provider_payment_ref`, initial normalized status |

Every output crossing this port is normalized (§3) before it reaches any B8 command. No raw provider payload, HTTP header, or SDK object crosses it.

## 3. Provider-neutral status normalization (`B8-D-B002` — exact mapping gated `REQUIRES PROVIDER CONTRACT VALIDATION`)

| B8 `Payment.status` | Meaning | Tap statuses that map here (adapter-internal only, per `B8_TAP_PROVIDER_BOUNDARY.md` `B8-X-005a`) |
|---|---|---|
| `created` | Payment row exists; no provider call made yet | *(pre-provider)* |
| `pending` | Provider call made; outcome not yet known | `INITIATED` (`100`), `DEFERRED` (`303`) |
| `authorized` | Provider confirms fund availability, not yet captured | `Authorized` (`001`, authorize-only flows) |
| `captured` | Funds captured — the only status that may trigger `SubscriptionActivated` | `Captured` (`000`) |
| `failed` | Terminal failure | any `401–408`, `501–516`, `701–704` code |
| `cancelled` | Customer/merchant cancelled before capture | `Abandoned` (`301`), `Canceled` (`302`), `Void` (`601`) |
| `partially_refunded` | Captured, then partially reversed | derived from a successful partial `create_refund` against a `captured` Payment |
| `refunded` | Captured, then fully reversed | derived from a successful full `create_refund` |
| *(fail-closed)* | Unrecognized/unmapped provider status | `Unknown` (`901`), `Expired` (`304`), `Timed Out` (`801`) → **mapped to `pending` plus a mandatory reconciliation flag**, never silently to `captured` or `failed` |

The fail-closed row is the concrete mechanism for brief §21's "unknown provider status must fail closed and be observable": an unmapped status never advances a Payment past `pending`, and the reconciliation sweep (§`B8_RECONCILIATION_MODEL.md`) picks it up on its next pass with an elevated alert.

## 4. What never crosses the port

Raw card PAN/CVV (never collected — Tap-hosted/tokenized flow only, per `BACKEND_SECURITY_ARCHITECTURE.md`/`BACKEND_BILLING_TAX_ARCHITECTURE.md`), the Tap secret API key (adapter-internal only, injected from environment/secret management per `BACKEND_SECURITY_ARCHITECTURE.md`), and the raw webhook payload beyond what `verify_webhook` normalizes (retained, if at all, only as short-lived provider metadata under the minimal-retention rule in `B8_PRIVACY_RETENTION.md`).

## 5. Domain states are not copies of provider states

`Subscription.status` (`trialing`/`active`/`past_due`/`suspended`/`cancelled`/`expired`) has no Tap analog at all — it is derived entirely from B8's own business rules (§`B8_SUBSCRIPTION_STATE_MACHINE.md`) applied to the normalized `Payment.status` stream, never a direct copy of any provider field. `UpgradeQuote.status` (`active`/`expired`/`consumed`/`cancelled`) is pure B8 domain state with no provider involvement at all — a quote is never sent to Tap.

## 6. Recurring charges (`B8-D-B003` — exact adapter request shape gated `REQUIRES PROVIDER CONTRACT VALIDATION`)

`create_recurring_charge` is the port operation backing subscription renewal, built on Tap's Payment Agreement / Merchant-Initiated-Transaction mechanism (`B8_TAP_PROVIDER_BOUNDARY.md` `B8-X-012`). The stored `agreement_ref` lives on `billing_customers` (§`B8_CHECKOUT_PAYMENT_MODEL.md` §7), never on `Subscription` directly, keeping the port's only Subscription-facing input the same provider-neutral `(amount, currency, customer)` shape as a first-time charge. A renewal charge always creates a **new** `Payment` row (new `PAY-*`) — never a mutation of the prior period's Payment — so every charge remains individually auditable and refundable.

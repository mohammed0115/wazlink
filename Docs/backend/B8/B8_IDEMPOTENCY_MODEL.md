# B8 — Idempotency Model

> Design only. Adopts the frozen platform standard (`BACKEND_IDEMPOTENCY_STANDARD.md`) verbatim; this document enumerates B8's specific stable identities.

## 1. Frozen mechanics reused verbatim

`Idempotency-Key` is an HTTP header (never a request body field — `B1_CONCURRENCY_IDEMPOTENCY.md` §3, "no B1 request DTO carries an idempotency field"), scoped by workspace + authenticated principal + endpoint/command + request-body hash. Command services create an `IdempotencyRecord` inside the same transaction as the command's durable state; a unique constraint prevents concurrent duplicate execution; reuse with a different body returns `409 IDEMPOTENCY_CONFLICT`. Retention: **7 days for every B8 command** — B0 already reserves this longer tier specifically for "payment/webhook operations" (`BACKEND_IDEMPOTENCY_STANDARD.md`), and B8 applies it to every one of its own commands, not only payment ones, since a subscription-lifecycle mistake (duplicate cancel/downgrade) is exactly as costly to replay incorrectly as a duplicate payment.

## 2. Stable identities per command

| Command | Idempotency key scope | Additional stable identity |
|---|---|---|
| `CreateUpgradeQuote` | header, per workspace+principal+body-hash | none additional — quotes are cheap; a retry simply returns the same quote |
| `CreatePayment` | header (frozen) | `UpgradeQuote.payment_id` partial unique index (frozen) — one quote yields at most one payment lineage, enforced at the database level independent of the header |
| `ProcessPaymentWebhook` | not client-facing — `(provider, provider_event_identity, payload_hash)` at the Webhooks-domain layer (frozen), plus `(command_id, Payment.id, resulting status)` at B8's own consumer layer (§`B8_WEBHOOK_MODEL.md` §4) | Payment state machine's legal-transition check (no backward/duplicate application) |
| `ReconcilePayment` | admin-invoked: header, per operator+body-hash; scheduled: `(command_id="ReconcilePayment", Payment.id)` | same legal-transition check as webhook processing |
| `CancelSubscription` / `ReactivateSubscription` | header | `Subscription.version` (optimistic concurrency, §`B8_CONCURRENCY_MODEL.md`) |
| `ScheduleDowngrade` / `ApplyScheduledDowngrade` | header (schedule); `(command_id, Subscription.id, current_period_end)` (system apply) | `Subscription.version` |
| `GrantEntitlementOverride` / `RevokeEntitlementOverride` | header | none additional — grants are idempotent by `(workspace_id, code, granted_by, reason)` natural key at the application layer, but the header remains authoritative |
| `BootstrapWorkspaceSubscription` | not client-facing — `(consumer="billing", event_id)` on the consumed `WorkspaceCreated` event (frozen at-least-once-consumer dedup pattern) | `subscriptions.workspace_id` unique constraint (database-level backstop) |

## 3. Provider-side idempotency (Tap)

The adapter derives Tap's `reference.idempotent` field (§`B8_TAP_PROVIDER_BOUNDARY.md` `B8-X-006`) from WazLink's own internal `Payment.public_id` — never from a client-supplied string and never regenerated on retry. Because `Payment.public_id` is immutable and created once inside `CreatePayment`'s own transaction, a client retry under the same `Idempotency-Key` never reaches the adapter a second time at all (the frozen `IdempotencyRecord` replay happens before the adapter is called) — Tap's own 24-hour idempotency window is a secondary backstop, never the primary mechanism.

## 4. Worker/effect idempotency

Every asynchronous side effect (renewal-charge scheduling, reconciliation sweep iteration, outbox dispatch) is idempotent by `(command_id, effect_type)` per the frozen worker-idempotency rule, and re-reads current state before applying — a redelivered Celery task for an already-processed record checks the record's current status first and no-ops if nothing remains to do (§`B8_WEBHOOK_MODEL.md` §6's "no backward transition" rule is the concrete instance of this for payments).

## 5. What is never idempotency-protected by Redis

No B8 idempotency decision — client-header replay, quote consumption, subscription version check, webhook dedup — is ever backed by a Redis key. PostgreSQL's unique constraints and row locks are the sole authority, identical to the frozen doctrine restated in `B8_USAGE_QUOTA_MODEL.md` §4 and `B8_CONCURRENCY_MODEL.md` §1.

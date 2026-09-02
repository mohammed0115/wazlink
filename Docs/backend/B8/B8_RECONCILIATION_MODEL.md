# B8 — Reconciliation Model

> Design only. Realizes the two Billing rows already named in frozen `BACKEND_RECONCILIATION.md` ("Payments | internal Payment vs Tap status | every 15 min | Billing service/admin command"; "Subscriptions | Subscription vs payment/invoice | hourly | Billing service") plus the Usage row Entitlements owns (§`B8_USAGE_QUOTA_MODEL.md` §2).

## 1. Eligible records

**Payment reconciliation (every 15 min, frozen cadence):** every `Payment` in `pending` or `authorized` for longer than a bounded window (illustrative: 30 minutes — configuration data, not architecture), plus every `Payment` whose most recent `payment_attempts` row is older than the window with no terminal status. **Subscription reconciliation (hourly, frozen cadence):** every `Subscription` in `past_due` (checked against the grace-window deadline, §`B8_SUBSCRIPTION_STATE_MACHINE.md` §4) and every `active` subscription whose `current_period_end` has passed with no corresponding renewal `Payment` at all (a scheduling failure, not a payment failure — the renewal task itself never ran).

## 2. Invocation

Celery-scheduled (ADR-004), never triggered by a user request, and additionally invokable as an explicit, permissioned admin command (`ReconcilePayment`, frozen name, extended to accept a specific `payment_ref` for targeted repair) per `BACKEND_OPERATIONS_OBSERVABILITY.md`'s "Repairs such as retry webhook, retry job, reconcile payment... are explicit commands, idempotent, permissioned, and always append an AuditLog."

## 3. Provider query boundary

Reconciliation calls `PaymentProviderPort.retrieve_charge(provider_payment_ref)` — the same normalized read operation the redirect handler uses for UX purposes (§`B8_CHECKOUT_PAYMENT_MODEL.md` §8), now used authoritatively. It never queries Tap for records it cannot correlate to an existing `payments` row — reconciliation repairs known-ambiguous local state, it does not discover new payments from the provider side.

## 4. Idempotency

Identical to `ProcessPaymentWebhook`'s (§`B8_WEBHOOK_MODEL.md` §4) — idempotent by `(command_id="ReconcilePayment", target Payment.id, resulting status)`. Running reconciliation twice against an already-resolved Payment is a no-op.

## 5. State transition rules — precedence (`B8-D-A019`)

1. **A verified webhook always wins over a reconciliation guess that hasn't happened yet** — reconciliation never runs ahead of processing a `WebhookReceipt` already sitting in `queued`; the scheduled sweep processes any backlog of verified-but-unprocessed receipts first, then queries the provider only for Payments still ambiguous afterward.
2. **A direct provider query (via reconciliation) is authoritative once made** — its result is applied through the identical legal-transition check §`B8_WEBHOOK_MODEL.md` §6 uses (no backward transition), so a reconciliation query and a slightly-stale webhook arriving moments apart converge on the same outcome regardless of which is processed first.
3. **Reconciliation never overwrites a newer authoritative provider state with an older one** — if `retrieve_charge` returns a status that predates (per Tap's own `activities[]` timeline, `B8_TAP_PROVIDER_BOUNDARY.md` `B8-X-004`) an already-applied local status, the query result is discarded as stale, not applied. This is the concrete mechanism for frozen `BACKEND_RECONCILIATION.md`'s "must not guess or overwrite a newer authoritative provider state without a documented precedence rule" — the documented rule is: local terminal state always outranks a provider read reporting an earlier moment in that same charge's timeline.
4. **A genuine local/provider disagreement at the same moment** (both terminal, both claim finality, and disagree) is never auto-resolved — it is recorded as `RECONCILIATION_MISMATCH` (§`B8_WEBHOOK_MODEL.md` §5) and surfaced to the admin repair queue; only an explicit, permissioned admin action resolves it, never an automatic sweep.

## 6. Subscription reconciliation specifics

For a subscription whose grace window (`past_due`) has elapsed with no successful renewal, the sweep performs the `past_due → suspended` transition (§`B8_SUBSCRIPTION_STATE_MACHINE.md` §2) as its repair action — this is the one case where reconciliation *causes* a state transition rather than only resolving payment ambiguity, and it is still logged identically (evidence, attempted repair record, operator=`system:reconciliation`, request ID, next review time — the exact fields frozen `BACKEND_RECONCILIATION.md` requires for every mismatch).

## 7. Audit

Every reconciliation pass — whether it finds anything to repair or not — appends one summary `AUD-*` row per record examined that changed state, and a `PaymentReconciled` (new event, observability-only, does not itself imply a `Payment.status` change) for every record examined at all, giving `B8_OBSERVABILITY_AUDIT.md` a complete pass-by-pass trail without conflating "we looked" with "we changed something."

## 8. Retry/dead-letter boundary

A reconciliation pass that itself fails (provider timeout, network error) follows the frozen `ZATCA unavailable`-shaped retry class's sibling for payments — frozen `BACKEND_RETRY_POLICY.md`'s "Payment pending | scheduled poll | max 8 | pending/reconciliation" row: after 8 unsuccessful reconciliation attempts for the same record, it is dead-lettered with an operational alert (`BACKEND_OPERATIONS_OBSERVABILITY.md` "Alerting": "missing callbacks" class), requiring manual admin intervention — reconciliation itself never retries unboundedly.

# B8 — Observability & Audit

> Design only. Adopts frozen correlation/logging/Sentry/OpenTelemetry conventions verbatim (`BACKEND_OPERATIONS_OBSERVABILITY.md`).

## 1. Metrics/logs/traces per brief §39

| Event | Log/metric | Trace span | Audit (`AUD-*`) |
|---|---|---|---|
| Checkout created (`CreateUpgradeQuote`) | count, latency | yes | no (not yet a commercial commitment) |
| Checkout completed/failed (`Payment` reaches `captured`/`failed`) | count by outcome, latency from creation | yes | yes |
| Webhook received | count by provider/event type | yes | no (receipt-level, Webhooks-domain owns its own audit) |
| Webhook invalid | count, alert threshold | yes | yes — signature failures are always audited (security-relevant) |
| Webhook duplicate | count only | yes | no |
| Provider latency | histogram per `PaymentProviderPort` operation | yes | no |
| Provider error | count by normalized error class | yes | no |
| Reconciliation pass | records examined, records repaired, duration | yes | yes, one row per repaired record (§`B8_RECONCILIATION_MODEL.md` §7) |
| Subscription transitions | count by from→to state | yes | yes, every transition |
| Entitlement resolution failure (fail-closed `500`) | count, alert threshold | yes | no (system fault, not a business action) |
| Quota denial | count by metric/workspace | yes | no (high-volume, not per-denial audited — aggregated metric only) |
| Configuration health check | count, last result | yes | yes, when `configured` flips |

## 2. Audit actions (new, added to the platform's audit vocabulary)

`subscription.bootstrapped`, `subscription.upgraded`, `subscription.cancel_scheduled`, `subscription.reactivated`, `subscription.downgrade_scheduled`, `subscription.downgrade_applied`, `subscription.suspended`, `subscription.expired`, `payment.captured`, `payment.failed`, `payment.refunded`, `entitlement_override.granted`, `entitlement_override.revoked`, `reconciliation.repaired`, `provider_configuration.changed`. Naming follows the frozen `<resource>.<action>` convention already used across B1–B7 audit vocabularies; none collides with an existing action name (cross-checked against B2's 24 and B7's automation audit actions).

## 3. No secrets, no sensitive payment data

Every row above excludes provider secrets, full card data, and raw provider JSON payloads (§`B8_PRIVACY_RETENTION.md` §5). Sentry/OpenTelemetry scrubbing rules are inherited unmodified from `BACKEND_OPERATIONS_OBSERVABILITY.md` — B8 adds no new PII field requiring a new scrub rule.

## 4. Alerting (new rows, additive to the frozen alert list)

Extending `BACKEND_OPERATIONS_OBSERVABILITY.md`'s "Alerting" section (already lists "repeated payment mismatch, signature failures... missing callbacks" generically) with B8-specific thresholds: `RECONCILIATION_MISMATCH` count > 0 in a single sweep (page); `PROVIDER_CONFIGURATION_INVALID` occurring in production environment (page — indicates a live outage, not a test-mode gap); grace-window (`past_due→suspended`) transition rate exceeding a baseline (informational, business-health signal, not a page).

## 5. Correlation

Every B8 command/webhook/reconciliation action propagates `request_id`/`correlation_id` per the frozen platform-wide rule — a support engineer can trace one `CreatePayment` call from the initial API request through the adapter call, the webhook receipt, `ProcessPaymentWebhook`, and the resulting `SubscriptionActivated` outbox event using a single correlation ID, matching the frozen sequence diagram's own implicit correlation chain.

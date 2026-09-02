# B10 — Observability

> Design only. Adopts frozen correlation/logging/Sentry/OpenTelemetry conventions verbatim (`BACKEND_OPERATIONS_OBSERVABILITY.md`).

## 1. Metrics/logs/traces

| Event | Log/metric | Trace span | Audit (`AUD-*`) |
|---|---|---|---|
| Tax profile updated | count, field diff (non-secret fields only) | yes | yes |
| Applicability changed | count by from→to state | yes | yes, always (high-privilege action) |
| Tax invoice issued | count by `document_kind`/`invoice_classification` (renamed from `document_type` under `B10-FIX.1`) | yes | yes |
| Tax classification deferred (`unknown` backlog, durable model `B10-FIX.1`) | count, backlog depth gauge (`pending_tax_document_classifications` where `status=pending`) | yes | no (system state, not an operator action) |
| Tax classification resolved (new, `B10-FIX.1`) | count by outcome (`resolved_not_applicable`\|`resolved_for_issuance`) | yes | yes |
| Cumulative correction rejected (new, `B10-FIX.1`, `B10-D-A021`) | count | yes | yes — a rejected over-correction attempt is itself audit-relevant |
| Tax invoice cancelled | count | yes | yes |
| Credit/debit note issued | count by reason category | yes | yes |
| ZATCA submission attempt | count by outcome | yes | yes, one row per attempt (mirrors `B8_RECONCILIATION_MODEL.md` §7's "we looked" vs "we changed something" distinction) |
| ZATCA submission accepted/rejected | count, latency | yes | yes |
| Fail-closed `pending` outcome (`B10-D-A019`) | count, alert threshold | yes | yes — always audited (ambiguity is security/compliance-relevant) |
| ZATCA configuration health check | count, last result | yes | yes, when `configured` flips |
| Credential/certificate expiry proximity | gauge, alert threshold | n/a | no (system health, not an action) |

## 2. Audit actions (new, added to the platform's audit vocabulary)

`tax_profile.updated`, `tax_applicability.changed`, `tax_invoice.issued`, `tax_invoice.cancelled`, `tax_credit_note.issued`, `tax_debit_note.issued`, `tax_submission.accepted`, `tax_submission.rejected`, `zatca_configuration.changed`, `tax_classification.resolved` (new, `B10-FIX.1`), `tax_correction.rejected` (new, `B10-FIX.1`). Naming follows the frozen `<resource>.<action>` convention already used across B1–B9 audit vocabularies; none collides with an existing action name.

## 3. No secrets, no sensitive payload

Every row above excludes provider secrets and raw ZATCA payloads (§`B10_SECURITY_PRIVACY.md` §4, `B10_ZATCA_SECURITY_CREDENTIALS.md` §4).

## 4. Alerting (additive to the frozen alert list)

`RECONCILIATION_MISMATCH`-class alert (reused code) on: any fail-closed `pending` outcome persisting past a bounded window; the pending-classification backlog growing past a baseline depth while `zatca_applicability=unknown`; a `ZATCA_CERTIFICATE_EXPIRED`/proximity-to-expiry signal.

## 5. Health checks never fail on dormant ZATCA (brief §40, `B10-D-A003`)

The platform's overall health/readiness check **never** marks itself unhealthy merely because `zatca_applicability ∈ {unknown, not_applicable}` and no ZATCA credential is configured — this is the expected, correct Phase-1 posture, not a degraded state. A health check only flags a problem when `zatca_applicability = enabled` **and** `ValidateZatcaConfiguration` reports `configured=false`, or when the fail-closed/backlog thresholds in §4 are exceeded.

## 6. Correlation

Every B10 command/event propagates `request_id`/`correlation_id` per the frozen platform-wide rule, identical to B8/B9's own discipline.

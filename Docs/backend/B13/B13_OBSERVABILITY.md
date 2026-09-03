# B13 — Observability

> Design only. Fulfills what `B12_OBSERVABILITY_HANDOFF.md` explicitly handed to B13 (`FI-B12-05`, `FI-B12-13`): log aggregation and storage, metric backend and retention, tracing backend and sampling, alert thresholds and routing, dashboards, SLI/SLO definition. Uses the planned Sentry + OpenTelemetry stack without hardcoding deployment implementation (per the brief's own instruction).

## 1. Runtime/vendor boundary

Sentry and OpenTelemetry are the planned products (`FI-B0-05`, `FI-B0-12`). B13 does not fix a specific OTel backend (Jaeger, Tempo, a vendor SaaS) or a specific metrics store (Prometheus, a vendor SaaS) — that choice is `B14`/deployment, gated only by the requirement that it can ingest the bounded-cardinality signal set in §2 and honor the redaction contract in `B13_LOGGING_REDACTION.md`.

## 2. Signal inventory — inherited and extended

`FI-B12-05` §3 fixes the bounded-cardinality fields (`correlation_id`, `provider`, `operation`, `queue`, `attempt_no`, `outcome`, `failure_class`, `http_status`, `latency_ms`, `queue_delay_ms`, `retryable`, `schema_version`). B13 adds the application-facing signals every domain's own observability document already named:

| Domain | Additional signals | Source |
|---|---|---|
| Automation | `loop_prevention_blocks{block_reason}`, `executions_skipped{skip_reason}`, `approval_wait_duration` | B7 research brief |
| Finance | `revenue_recognition_success/failure_total`, `duplicate_recognition_suppressed_total`, `unattributed_revenue_ratio`, `attribution_integrity_failure_total`, `currency_mismatch_total` | `FI-B9-01` |
| Billing | webhook-invalid events, `RECONCILIATION_MISMATCH` count per sweep | `FI-B8-02` |
| Files | 13 metrics (`files_upload_*`, `files_verification_failed_total{failure_reason}`, `files_reconciliation_*`) | `FI-B11-01` |
| Platform | `platform_dead_letters_total{origin_kind}`, `provider_unknown_outcomes_total{provider}`, `webhook_verification_failed_total{provider}` | `FI-B12-05` |

## 3. Cardinality discipline

Never a metric label: a workspace ID, user ID, correlation ID, event ID, public ID, credential, URL, provider host, payload, filename, phone number, or raw provider error string (`FI-B12-05` §5, extended identically by every domain's own metrics document, e.g. `FI-B11-01` §"cardinality rule"). Workspace-level attribution lives in the structured **log**, queryable and bounded by retention, never in a time series that would create one series per workspace forever.

## 4. Metric → alert-class binding, with severity and owner

| Metric | Frozen alert class | Severity | Owner | Runbook |
|---|---|---|---|---|
| `platform_dead_letters_total{origin_kind}` | dead letters | page (initial default) | Platform on-call | `B13_RUNBOOKS.md` §"Dead-letter growth" |
| `provider_unknown_outcomes_total{provider="tap"}` | quota/payment unknown outcome | page | Billing/Platform on-call | `B13_RUNBOOKS.md` §"Tap/payment unknown outcome" |
| `webhook_verification_failed_total{provider}` | signature failures | page | Platform on-call | `B13_RUNBOOKS.md` §"Suspected cross-tenant access" (if paired with binding anomalies) |
| `platform_cross_workspace_denied_total` | cross-workspace authorization errors | page | Platform on-call | `B13_RUNBOOKS.md` §"Suspected cross-tenant access" |
| `platform_reconciliation_cases_total{class}` | quota-ledger divergence | page for `P-1`/`P-5`/`P-6`/`P-7`; informational for auto-repaired classes | Platform on-call | `B13_RUNBOOKS.md` §"Reconciliation growth" |
| `provider_requests_total{provider="storage",outcome}` | storage failures | page | Platform on-call | `B13_RUNBOOKS.md` §"File storage outage" |
| `attribution_integrity_failure_total` | *(new binding)* impossible financial state | page, SEV-1 | Finance/Platform on-call | `B13_INCIDENT_MANAGEMENT.md` §5 "Financial corruption" |
| `queue_delay_ms{queue}` | *(new binding)* queue backlog | warning, escalates to page past a tuned threshold | Platform on-call | `B13_RUNBOOKS.md` §"Queue backlog" |
| `security.rate_limited` / `security.credential_stuffing_suspected` rate | *(new binding)* authentication anomaly | page on sustained trigger | Security/Platform on-call | `B13_INCIDENT_MANAGEMENT.md` §5 "Authentication compromise" |

Exact numeric thresholds are **initial operational defaults**, tunable in production (`B13-D-B019`, Class B) — B13 fixes which signal binds to which alert class and severity floor, not the precise trigger value, per the brief's instruction to avoid fake universal thresholds.

## 5. SLI/SLO philosophy

Phase 1 does not commit to a published external SLO (no customer-facing uptime commitment exists yet — that is a business decision, `B13-D-C006`, Class C). Internally, B13 recommends tracking the following as **SLIs** without yet fixing an SLO target:

- API availability (`/health/ready` success rate)
- P95 request latency by endpoint class
- Webhook processing latency (ingress-to-domain-effect) — safety-critical given Tap's 3-attempt retry bound
- Dead-letter open count trend
- Reconciliation case open count trend

## 6. Dashboards — informative, not architecture

A minimal first dashboard set (per-domain health, platform operations, financial integrity) is recommended but not architecturally required by B13; dashboard layout is explicitly named by `FI-B12-13` as something B12 leaves to B13's operations, and B13 in turn leaves exact layout to implementation, fixing only that every alert in §4 must have a corresponding dashboard panel before that alert is enabled in production (`B13-D-B020`).

## 7. Audit versus telemetry — restated once for this document

Audit entries are durable business records with their own immutability guarantee; telemetry is operational and may be sampled, aggregated, and expired (`FI-B12-05` §6, `FI-B9-01`: "a metric is never evidence of a financial fact"). No B13 control ever substitutes a metric for an audit requirement.

## 8. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13OBS-1` | No metric label in the deployed metrics backend contains a workspace ID, user ID, correlation ID, or raw provider error string |
| `AT-B13OBS-2` | Every alert in §4 has a corresponding dashboard panel before it is enabled |
| `AT-B13OBS-3` | `attribution_integrity_failure_total > 0` triggers a SEV-1 page within the tuned threshold |
| `AT-B13OBS-4` | Sentry/OTel context for any captured span/exception contains no item from `B13_LOGGING_REDACTION.md` §2 |
| `AT-B13OBS-5` | A financial fact is never asserted from a metric alone — every alert response in `B13_RUNBOOKS.md` requires confirming against the durable domain record before acting |

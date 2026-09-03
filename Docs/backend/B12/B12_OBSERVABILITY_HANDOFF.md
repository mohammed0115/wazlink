# B12 — Observability Handoff

> Design only. **B13 owns the observability and security *system*.** B12 defines only the signals B13 will need and the correlation contract that makes them joinable.

## 1. What B12 owes B13

Not dashboards, not alert routing, not retention — those are B13's. B12 owes exactly three things: a **correlation contract** that survives every hop, a **bounded-cardinality signal set**, and a **redaction rule** B13 can rely on rather than re-derive.

## 2. Correlation contract

> **`B12-D-A047`. `correlation_id` is minted once at the API edge and propagated unchanged through every hop. `causation_id` names the immediate predecessor. Neither is ever replaced by a provider identifier.**

```
API request        request_id (per HTTP) + correlation_id (per workflow)
  → domain txn     correlation_id carried; outbox row stores both
  → outbox event   event_id (new) · causation_id = the command's id
  → Celery task    payload carries correlation_id + event_id only
  → worker exec    worker_executions.correlation_id = the same value
  → provider call  provider_request_reference recorded ALONGSIDE, never instead
  → webhook        a NEW request_id; correlation joined via the provider reference
  → inbox/receipt  receipt carries its own request_id + the joined correlation
  → domain txn     correlation_id restored; causation_id = the receipt
```

**The webhook hop is the one that must be stated explicitly**, because it is where correlation is usually lost: an inbound callback is a *new* HTTP request with no knowledge of the workflow that caused it. The join is made through the provider's own object reference, which B12 recorded on the outbound `provider_request_attempts` row. That is why `provider_request_reference` is stored even when nothing else needs it — it is the only bridge across the provider.

**A provider ID is never reused as a WazLink event ID** (`B12-D-A029` rule 5): it is a join key in a column, not an identity.

## 3. Required signals

| Field | On | Cardinality |
|---|---|---|
| `correlation_id`, `causation_id`, `request_id`, `event_id` | every hop | unbounded — **log/trace only, never a metric label** |
| `workspace_id` | every workspace-scoped record | unbounded — **log only** |
| `provider` | provider work | closed enum (6) |
| `operation` | provider work | closed enum per port |
| `queue`, `task_kind` | executions | closed enums (5, small) |
| `attempt_no` | executions, attempts | small integer |
| `outcome` | attempts | 3 values |
| `failure_class` | failures | closed enum |
| `http_status` | provider calls | bounded |
| `latency_ms` | provider calls, executions | histogram |
| `queue_delay_ms` | executions | histogram — **publish-to-start, the earliest backlog signal** |
| `processing_duration_ms` | executions, receipts | histogram |
| `retryable` | failures | boolean |
| `schema_version` | events | small integer |

## 4. Metric set, bound to the frozen alert classes

Frozen `BACKEND_OPERATIONS_OBSERVABILITY.md` already names "storage failures", "cross-workspace authorization errors", "quota ledger divergence", and "dead letters" as page-worthy. B12 binds each to a concrete signal rather than adding an alert class:

| Frozen alert class | B12 signal |
|---|---|
| dead letters | `platform_dead_letters_total{origin_kind}`, `platform_dead_letters_open_gauge{owning_domain}` |
| cross-workspace authorization errors | `webhook_binding_unresolved_total`, `platform_cross_workspace_denied_total` |
| quota ledger divergence | `platform_reconciliation_cases_total{class}` |
| storage failures | `provider_requests_total{provider="storage",outcome}` |
| *(new binding, same class)* **unknown outcomes** | `provider_unknown_outcomes_total{provider}` and `platform_reconciliation_open_gauge{class="P-1"}` — **the highest-signal metric in this pack**; a rise means WazLink does not know what the outside world did |
| *(new binding, same class)* forged webhooks | `webhook_verification_failed_total{provider}` |

Other counters and histograms: `outbox_pending_gauge`, `outbox_dispatch_attempts_total{outcome}`, `webhook_receipts_total{provider,status}`, `worker_executions_total{queue,outcome}`, `queue_delay_ms{queue}`, `provider_request_latency_ms{provider,operation}`, `provider_rate_limited_total{provider}`, `integration_health_gauge{provider,fact}`.

## 5. Cardinality discipline

> **Never a metric label:** a workspace ID, user ID, correlation ID, event ID, public ID, credential, URL, provider host, payload, filename, phone number, or raw provider error string.

Every label above is drawn from a closed enum fixed at design time — the largest is `failure_class`, and `provider` has six values. Workspace-level attribution lives in the structured **log** line, which is queryable and bounded by retention, not in a time series that would create one series per workspace forever. `AT-B12OBS-2`.

## 6. Audit versus telemetry

Audit entries (`B12_COMMAND_EVENT_CATALOG.md` §5) are **durable business records** in the frozen `audit_logs` table with their own immutability guarantee. Telemetry is **operational** and may be sampled, aggregated, and expired. `webhook.rejected` is deliberately an audit entry rather than an event so an attacker cannot generate unbounded event-bus traffic.

## 7. What B13 owns

Log aggregation and storage, metric backend and retention, tracing backend and sampling, alert thresholds and routing, on-call and escalation, dashboards, SLI/SLO definition, incident management, and log-retention policy. B12 defines the fields and their cardinality; it defines no threshold, no destination, and no retention period.

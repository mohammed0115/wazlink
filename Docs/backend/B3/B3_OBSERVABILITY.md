# B3 — Observability

> **B3 status:** Target design only. Inherits frozen `BACKEND_OPERATIONS_OBSERVABILITY.md` and the `ErrorReporter` / `Tracer` ports of `BACKEND_INTEGRATION_BOUNDARIES.md`. No dashboard, exporter, or alert rule is implemented.

## 1. What observability must answer

| Question | Signals |
|---|---|
| Is discovery working? | job success rate, failure rate by code, duration |
| Is a provider healthy? | provider error rate, latency, rate-limit rate by provider |
| **What are we spending?** | provider calls, cost units, calls per acquired business |
| Is the search efficient? | duplicate ratio, results per call, truncation rate |
| Is identity resolution sound? | link rate, candidate rate, ambiguity rate, merge rate |
| Did partial success occur, and where? | `completion_kind`, failed-execution counts by class |
| Is anything silently lost? | rejected records, dropped stale callbacks, dead-lettered executions |

The last row exists because every failure mode in this design is *designed to be survivable* — which means each one can also hide. Each is therefore counted.

## 2. Metrics

### 2.1 Jobs

| Metric | Type | Labels |
|---|---|---|
| `discovery_jobs_created_total` | counter | workspace, provider_source |
| `discovery_jobs_completed_total` | counter | workspace, `completion_kind` |
| `discovery_jobs_failed_total` | counter | workspace, `failure_code` |
| `discovery_jobs_cancelled_total` | counter | workspace, `cancelled_from` |
| `discovery_jobs_retried_total` | counter | workspace |
| `discovery_job_duration_seconds` | histogram | `completion_kind` |
| `discovery_jobs_running` | gauge | workspace |

### 2.2 Query executions

`discovery_query_executions_total{outcome}` (the seven outcomes) · `discovery_query_execution_duration_seconds` · `discovery_query_retries_total{error_class}` · `discovery_query_executions_dead_lettered_total` — **alerting** · `discovery_partial_completions_total`.

### 2.3 Provider

| Metric | Type | Labels |
|---|---|---|
| `discovery_provider_calls_total` | counter | provider, outcome_class |
| `discovery_provider_latency_seconds` | histogram | provider |
| `discovery_provider_rate_limited_total` | counter | provider |
| `discovery_provider_errors_total` | counter | provider, outcome_class |
| `discovery_provider_cost_units_total` | counter | provider, workspace |
| `discovery_provider_cost_unknown_total` | counter | provider — **calls whose cost the adapter could not report** |
| `discovery_provider_pages_fetched` | histogram | provider |

`discovery_provider_cost_unknown_total` exists so an incomplete cost picture is *visible* rather than being silently under-reported as zero (`B3_QUOTA_COST_CONTROL.md` §7).

### 2.4 Results, identity, and quality

`discovery_results_ingested_total` · `discovery_results_rejected_total{reason}` · `discovery_results_filtered_total{filter}` · `discovery_businesses_created_total` · `discovery_businesses_rediscovered_total` · `discovery_identity_links_total{link_basis}` · `discovery_match_candidates_total{classification}` — **the auto-merge-refusal rate** · `discovery_business_merges_total{reason}` · `discovery_normalization_failures_total{field}` · `discovery_duplicate_ratio` (gauge, `duplicate/found`) · `discovery_results_per_provider_call` (histogram) · `discovery_stale_callbacks_dropped_total` · `discovery_duplicate_requests_suppressed_total` — **cost avoided** · `discovery_bound_truncations_total{bound}`.

### 2.5 Quota

`discovery_quota_reservations_total` · `discovery_quota_releases_total{reason}` · `discovery_quota_rejections_total` · `discovery_rate_limit_rejections_total`.

## 3. Logging

Structured, JSON, correlated. One log line per **state transition**, per **provider call**, and per **rejected record** — not per result row, which would be 2000 lines per job.

**Every line carries:** `request_id`, `workspace_id`, `job_public_id`, plus `execution_id` and `provider_request_id` where applicable.

**No line ever carries** (`B3-INV-3`, and frozen B0 "scrub PII"):

| Never logged | Reason |
|---|---|
| raw provider payload or any fragment | privacy classification + payload leakage |
| provider credential, API key, webhook secret, or auth header | secret exposure |
| **provider continuation token or provider job ID** | `B3-INV-12` |
| contact PII — phone, email, contact name | frozen privacy: "Contact PII → masking, purpose limitation" |
| business `name` at debug volume | it is business PII in aggregate; use `BUS-*` |
| full request keywords/locations at info level | they are user-authored search intent; hashed at info, full only at debug with PII scrubbing enabled |
| internal UUIDs | public IDs only (ADR-006) |
| stack traces across the API boundary | frozen error catalog |

A provider error is logged as its **normalized outcome class**, never as the vendor's message.

## 4. Tracing and the correlation chain

The chain that makes an incident answerable end to end:

```
request_id            (HTTP request — every response carries it)
   └─ job_public_id        JOB-*
        └─ query_id             keyword × location
             └─ execution_id         attempt N
                  └─ provider_request_id   one provider call
                       └─ RES-*                  one provenance row
                            └─ BUS-*                  the resolved Business
```

Every link is stored, so "why does `BUS-1042` exist?" resolves backwards through `discovery_results` to the exact provider call, and "what did request X cost?" resolves forwards to every call it caused.

Spans: `discovery.create_job`, `discovery.execute_query`, `discovery.provider_call`, `discovery.ingest_page`, `discovery.normalize`, `discovery.resolve_identity`, `discovery.evaluate_completion`. Per frozen B0, traces carry no sensitive payload.

## 5. Operator diagnostics

Provider request IDs and — where enabled — bounded raw snapshots are reachable only through an **operator-scoped** diagnostic surface, never through the tenant API (`B3_API_DTO_CONTRACTS.md` §6). Access is itself audited: reading a raw snapshot writes an `AUD-*` row naming the operator, the ingestion row, and the reason.

## 6. Alerts

| Condition | Severity |
|---|---|
| provider auth failure | **critical** — every job will fail |
| provider account quota exceeded | **critical** |
| provider error rate above threshold, sustained | high |
| execution dead-lettered | high |
| forged webhook signature | **security** |
| internal invariant violation | **critical** |
| cost units above the workspace budget ceiling | high |
| ambiguous-match rate above threshold | medium — identity signals may be degrading |
| stale-callback drop rate above threshold | medium — provider latency exceeds the deadline |
| rejected-record rate above threshold | medium — a provider contract may have changed |

The last three matter because each corresponds to a *silent* degradation: results still flow, but identity quality, callback timeliness, or payload compatibility is quietly eroding. Without an alert, each would surface only as an unexplained drop in result quality weeks later.

## 7. What is observed but not audited

Machine execution — query execution, page ingestion, business upsert, provenance append, identity link — is **traced and metered, never audited**. Only actor-initiated commands reach `audit_logs` (`B3_AUTHORIZATION_TENANCY.md` §5). A 50-combination job would otherwise write hundreds of audit rows describing the mechanical consequences of one already-audited human action.

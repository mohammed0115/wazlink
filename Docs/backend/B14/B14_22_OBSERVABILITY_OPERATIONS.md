# B14_22 — Observability and Operations

## 1. Correlation

Every request generates a `request_id`; every domain flow carries a `correlation_id` (shared across a whole lineage) and a `causation_id` (parent→child edge). Both propagate through the outbox envelope, Celery arguments, provider attempts and webhook receipts, so one query reconstructs *what happened, in what order, caused by what* — **without joining across workspaces**.

Frozen chain: `HTTP request_id → command → outbox event_id → worker_executions.correlation_id → provider_request_attempts.request_id → webhook_receipts.request_id`.

## 2. Structured logs

JSON lines carrying `timestamp`, `level`, `event`, `request_id`, `correlation_id`, `workspace_ref`, `actor_ref`, `outcome`, `latency_ms`, `error_class`.

**Never logged** (frozen B13 exhaustive list, restated, not extended): any credential or `*_REF` resolved value · `Authorization`, `X-Hub-Signature-256`, `hashstring` · raw provider request/response bodies · contact PII (name, phone, email) · message body content · prompt or completion text · card data.

The redaction processor in `common/` is the safety net; the control is that these never enter the record.

## 3. Metrics

Frozen B12/B13 signal set reused: `outbox_pending_gauge` · `outbox_dispatch_attempts_total{outcome}` · `webhook_receipts_total{provider,status}` · `worker_executions_total{queue,outcome}` · `queue_delay_ms{queue}` · `provider_request_latency_ms{provider,operation}` · `provider_rate_limited_total{provider}` · `integration_health_gauge{provider,fact}` · `platform_dead_letters_open_gauge{owning_domain}`.

New, additive: `import_rows_total{outcome}` · `agent_proposals_total{kind,outcome}` · `ticket_sla_breach_total{policy}` · `identity_resolution_total{result}` (`resolved|unresolved|ambiguous`).

**No metric label carries a raw public ID, a free-text field, per-customer content or an unbounded external identifier.** Amounts appear only as aggregates, never per-customer series.

## 4. Traces

OpenTelemetry spans across request → command → task → provider call. Span attributes carry references and outcome classes only — **never bodies, PII or secrets**. Sampling is configurable; error traces are always kept.

## 5. Sentry

`SENTRY_DSN` optional; absence disables telemetry without affecting the app. **Before-send scrubbing is mandatory** and reuses the same redaction processor. Breadcrumbs and context are subject to the identical never-log list.

## 6. Health surfaces

**Three-tier, never provider-dependent** (frozen B13): `/health` (process alive) · `/ready` (PostgreSQL + Redis reachable) · provider health, which is **`integration_connections` + the six health facts** and is **never** allowed to fail `/ready`. A dead provider must not take the platform out of rotation.

## 7. Alerts

Bound to the frozen B13 alert table: outbox backlog · queue delay · dead-letter growth by owning domain · reconciliation case growth · webhook failure rate · provider `credential_valid=false` (**`401`/`403` — no automatic retry**) · `degraded` provider · security events (repeated `authz.permission_denied`, credential-stuffing signal, CSRF rejection spike) · **import batches stuck in `committing`** · **SLA breach volume**.

Every alert names its runbook. Frozen B13 supplies 18 runbooks; the new surfaces reuse the closest existing one rather than inventing a parallel process.

## 8. Audit

`audit_logs` is append-only and immutable. ~30 additive codes across customer, contact, import, custom field, conversation mode/takeover, agent proposal, ticket, SLA, knowledge and assignment events, each `<resource>.<past participle>`, none colliding with a permission code. **Audit records field *names*, never values**, and a bulk contact read is itself audited (`contact.listed`).

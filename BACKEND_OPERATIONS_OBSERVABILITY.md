# WazLink Operations, Observability, and Recovery Architecture

> Conceptual operations design only. No Sentry, OpenTelemetry, Redis, worker, infrastructure, or deployment configuration is created in B0.

## Correlation and logging

Every HTTP request receives a `request_id`/`correlation_id`, propagated to application services, DB spans, Celery tasks, provider calls, webhook receipts, Sentry, and OpenTelemetry. Structured logs include timestamp, level, service, environment, request ID, workspace ID when safe, user ID when safe, job ID, provider, event, duration, and outcome. Logs must not include passwords, tokens, authorization headers, raw payment data, or unnecessary private message content.

## Sentry and OpenTelemetry

Sentry captures backend exceptions, job failures, provider error classes, environment, release SHA, request correlation, and scrubbed context. OpenTelemetry traces HTTP, DB, Redis, worker, provider, webhook, payment, and reconciliation boundaries. Sampling is higher for errors and low-volume financial/provider flows. Payloads and PII are excluded or redacted.

## Health endpoints

`/health/live` checks process responsiveness only. `/health/ready` checks PostgreSQL and Redis connectivity and migration compatibility; it does not depend on every external provider. Provider availability is represented by integration health metrics and operational alerts, not readiness failure unless the provider is mandatory for the deployed role.

## Backups and disaster recovery

PostgreSQL backups must be encrypted, access-controlled, monitored, and restore-tested. Initial target proposal: daily full backup plus point-in-time recovery/WAL retention, with RPO 24 hours and RTO 4 hours for a first production tier. These are targets, not guarantees, and require Product/Operations approval. Financial, tax, audit, and webhook records receive stronger retention. Data locality and cross-region recovery are **PRODUCT / LEGAL DECISION REQUIRED**.

## Internal operations

Django Admin is restricted to internal operations and never becomes the public CRM. It may expose failed jobs, webhook receipts, provider failures, payments, tax status, usage corrections, and support views with least privilege. An internal admin API or future ops console is preferred for auditable repair workflows. Repairs such as retry webhook, retry job, reconcile payment, or correct usage are explicit commands, idempotent, permissioned, and always append an AuditLog; direct ad-hoc SQL is not a normal business workflow.

## Alerting

Page on repeated payment mismatch, signature failures, cross-workspace authorization errors, dead letters, quota ledger divergence, provider outage thresholds, missing callbacks, ZATCA rejection spikes, storage failures, and database/Redis readiness failures. Alerts include request/correlation IDs and safe entity references, never secrets or raw PII.

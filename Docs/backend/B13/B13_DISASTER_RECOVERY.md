# B13 — Disaster Recovery

> Design only. Fixes recovery **ordering** — the principle that authority precedes derived execution — for every disaster class the brief names. Does not author deployment/infrastructure files.

## 1. The one ordering principle

> **Authority before derived execution. PostgreSQL recovery precedes Redis/Celery replay.**

Redis/Celery hold no durable domain truth (`FI-B0-16`, `FI-B12-10`); replaying queued work against a PostgreSQL instance that has not yet finished recovering risks acting on stale or partially-restored state. Every recovery procedure below follows this ordering without exception: **bring PostgreSQL to a consistent, verified state first; only then resume Redis/Celery/worker activity.**

## 2. Disaster scenarios

### 2.1 Database corruption

1. Stop write traffic (readiness probe reports `not_ready`, `B13_HEALTH_READINESS.md` §3).
2. Assess corruption scope; if isolated to a table/index, a targeted repair may avoid a full restore.
3. If a full restore is required: restore from the most recent verified backup (`B13_BACKUP_RESTORE.md`), then replay WAL to the most recent recoverable point.
4. Verify integrity (checksum/row-count spot checks, especially financial tables per `B13_BACKUP_RESTORE.md` §9).
5. **Only after PostgreSQL is verified consistent**, resume workers and allow queued Celery tasks to process — any task that references state now known to be older than expected re-reads current state and re-checks its own preconditions before acting (`FI-B12-01`, the frozen "references, not snapshots" payload rule already makes this safe).
6. Resume write traffic.

### 2.2 Host loss (application/API host)

Stateless application hosts — a lost host is replaced by the orchestrator/deployment pipeline with no data-recovery step required, provided PostgreSQL and Redis are unaffected. No B13-specific procedure beyond standard infrastructure redundancy (`B13_DEPLOYMENT_SECURITY.md` §5).

### 2.3 Redis loss

1. Provision a fresh Redis instance.
2. **No data recovery is attempted or needed** — Redis holds no durable truth (§1).
3. Rate-limit counters reset (a transient availability effect, not a security failure — PostgreSQL-authoritative quotas are unaffected, `FI-B0-16`).
4. Celery workers reconnect to the new broker; in-flight tasks that were mid-execution when Redis was lost are recovered by the standard stale-worker/lease-expiry mechanism (`FI-B12-01`, `B12-D-A055`) once workers resume, **after** confirming PostgreSQL is healthy (§1).

### 2.4 Worker loss

Workers are stateless relative to PostgreSQL; a lost worker's claimed rows are recovered via lease expiry and re-claimed by a surviving worker (`FI-B12-06`, `B12_DEAD_LETTER_REPLAY_MODEL.md` §"worker crash" discipline). No manual recovery procedure needed beyond restarting worker processes.

### 2.5 Storage outage

1. Uploads/downloads fail fast with `PROVIDER_UNAVAILABLE`/`unknown` outcome recorded per `FI-B12-08`'s unknown-outcome discipline — never silently retried against a non-idempotent write without first checking via `stat_object` once the provider returns (`FI-B11-01` §9).
2. Once the provider returns, reconciliation (`FI-B12-07`) resolves any `unknown`-state file operations.
3. No PostgreSQL recovery is needed for this scenario — file metadata rows are unaffected; only the byte-storage side effect was interrupted.

### 2.6 Provider outage (messaging, discovery, AI, payment)

Each domain's own retry/reconciliation mechanism handles this without a "disaster recovery" procedure distinct from ordinary operations — see `B13_RUNBOOKS.md` for the per-provider runbook. The disaster-recovery-relevant fact: **no provider outage, however long, corrupts PostgreSQL state** — the worst case is a growing reconciliation-case backlog or dead-letter count, both durable, both recoverable once the provider returns, and neither requiring a restore.

### 2.7 Credential compromise

Not a data-loss disaster; handled as an incident (`B13_INCIDENT_MANAGEMENT.md` §2.3) and a runbook (`B13_RUNBOOKS.md` §"Leaked provider credential"). No database/Redis recovery ordering applies.

### 2.8 Bad deployment

1. Roll back to the prior release.
2. The rolling-deploy compatibility rule (`FI-B12-13`, `B12-D-A049`) guarantees a consumer running the prior version either handles an event produced by the newer version (additive fields ignored) or fails the execution and **retains** the event rather than discarding it — so a rollback never silently drops in-flight async work.
3. If the bad deployment included a destructive migration, recovery follows §2.1 (database corruption) — this is exactly why `B13_DATABASE_SECURITY.md` §8 requires destructive migrations to be split into a safe multi-step rollout.

### 2.9 Accidental destructive operation (operator error)

1. Identify the exact command/operator/timestamp via the audit trail (`B13_AUDIT_LOGGING.md`) — every privileged action is audited with a mandatory reason where destructive.
2. If the operation is reversible by domain command (e.g., re-enabling a disabled provider), use the domain command — never a direct SQL fix (`FI-B0-14`).
3. If genuinely irreversible at the application layer (e.g., a mistaken `abandoned` dead-letter resolution), assess whether the underlying business fact can be reconstructed from other durable records (the domain's own event history, the immutable financial ledger) before considering a point-in-time restore, which would roll back every other workspace's legitimate writes since that point too — the tenant-aware limitation already noted in `B13_BACKUP_RESTORE.md` §6.

### 2.10 Queue backlog after outage

Once the underlying cause (provider outage, Redis loss, worker loss) resolves, the queue drains under the existing backoff/retry discipline — no special "backlog recovery mode" exists. `maintenance`-queue reconciliation sweeps are deliberately the *last* to catch up (queue isolation, `FI-B12-10`), so a large backlog there does not indicate user-facing impact.

### 2.11 Webhook replay after outage

Meta retries automatically for ~36 hours (`B12-X-003`); Tap does not (3 attempts total, `B12-X-006`). After a WazLink-side outage: Meta-sourced backlog typically self-heals via provider retry; Tap-sourced gaps require `retrieve_charge` reconciliation (`FI-B8-01`) because the provider will not re-deliver. **This asymmetry is why a webhook-ingress outage is never treated as low-severity merely because "the provider will just retry"** — that assumption is false for Tap.

## 3. What disaster recovery must never do

Reconstruct queue state as if it were authoritative over PostgreSQL — a Celery result backend or a Redis snapshot is never used to "figure out what was in flight" during recovery; the durable PostgreSQL rows (`outbox_events`, `worker_executions`, `provider_request_attempts`) are the only recovery-time source of truth for what was attempted (`FI-B12-01`).

## 4. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13DR-1` | A disaster-recovery drill resumes Celery/worker activity only after PostgreSQL is verified healthy, never concurrently |
| `AT-B13DR-2` | A Redis loss during active traffic produces zero durable data loss, verified against `B13_REDIS_CELERY_SECURITY.md` `AT-B13CEL-4` |
| `AT-B13DR-3` | A rollback after a bad deployment does not discard an in-flight event produced by the newer schema version |
| `AT-B13DR-4` | A storage-outage-induced `unknown` file operation resolves via `stat_object` before any state transition, once the provider returns |
| `AT-B13DR-5` | A Tap webhook-ingress outage longer than Tap's retry window is confirmed to have every affected charge resolved via `retrieve_charge`, not assumed resolved by provider retry |

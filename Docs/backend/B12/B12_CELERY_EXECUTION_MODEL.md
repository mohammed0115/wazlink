# B12 — Celery Execution Model

> Design only. **No Celery task, decorator, queue declaration, beat entry, or configuration value is written.** Realizes frozen ADR-004 (*"Celery is selected for routed asynchronous queues, durable retry policies, scheduled reconciliation, provider workflows, task metadata, and mature Django integration. Kafka and alternative worker frameworks are not justified for Phase 1."*).

## 1. What a Celery task is, and is not

> **`B12-D-A010`. A Celery task is a *hint that durable work is waiting*, carrying references only. It is never the work itself, never the identity of the work, and never the record of whether the work happened.**

| A Celery task **is** | A Celery task **is not** |
|---|---|
| a pointer to committed PostgreSQL rows | a container for domain state |
| a scheduling artifact | a business identity (`B12-D-A003`) |
| retryable at the transport level | the owner of a business retry budget |
| losable without data loss | a durable queue of intents |

## 2. Payload rule

> **`B12-D-A011`. A task payload carries: the `outbox_events.event_id` (or the source reference), the `workspace_id`, the `correlation_id`, and nothing else that is not an immutable identifier.** The worker re-reads authoritative state from PostgreSQL as its first action.

Forbidden in any task payload, without exception: a secret or credential of any kind; a full Lead/Business/Conversation/Message/Payment/FileAsset object; a provider access token; a webhook body; customer PII beyond an identifier. `B12_SECURITY_PRIVACY.md` §3, negative controls `AT-B12CEL-4`, `AT-B12SEC-2`.

**Why re-read rather than carry.** A payload is a snapshot of a moment that has already passed by the time a worker sees it. Between publish and execution the row may have been cancelled, superseded, or deleted — B3 jobs can be cancelled, B5 sends can be blocked by a consent change, B11 files can be archived. A worker acting on a carried snapshot would act on a state that no longer exists. Re-reading also makes the payload small, which keeps Redis a *broker* rather than a *store*.

## 3. Execution accounting — `worker_executions`

The frozen `Jobs` row (`BACKEND_DOMAIN_OWNERSHIP.md` line 29) names the aggregate `WorkerExecution`, the table `worker executions`, the writer *"worker coordinator"*, the commands `SubmitJob`/`RetryJob`, and the events `JobSucceeded`/`JobFailed`. B12 reuses all six names verbatim.

A `worker_executions` row is opened **before** any side effect and closed after, giving five states (machine 3, `B12_STATE_MACHINES.md` §3): `claimed → running → succeeded | failed | dead_lettered`.

It records: `workspace_id`, `queue`, `task_kind`, `source_type`/`source_ref` (opaque), `attempt_no`, `started_at`, `finished_at`, `outcome`, `failure_class`, `correlation_id`, `request_id`, and **result metadata only** — never a result payload that would duplicate domain state.

## 4. Acknowledgement and crash semantics

| Concern | Design position |
|---|---|
| **Acknowledgement** | Late acknowledgement (`acks_late`-equivalent semantics): a message is acknowledged **after** the worker finishes, so a crash redelivers rather than silently drops. The cost is duplicate delivery, which §5's guards absorb; the alternative cost is silent loss, which nothing absorbs |
| **Worker crash mid-task** | the message is redelivered; `worker_executions` shows a `running` row with no `finished_at`; the reconciliation sweep classifies it (`B12_RECONCILIATION_MODEL.md` §3, class `P-3`) |
| **Redelivery assumption** | assumed **possible at any time**. No design element may assume a message is delivered once |
| **Visibility timeout** | must exceed the task's hard time limit, or a long task is redelivered while still running. Concrete values are operations tuning (`B12_B13_BOUNDARY.md`) |
| **Poison task** | a task that fails deterministically is bounded by its attempt budget and then dead-lettered — never retried forever (`B12_DEAD_LETTER_REPLAY_MODEL.md`) |

## 5. Duplicate execution is expected, and guarded

Because acknowledgement is late and the broker is at-least-once, **the same task may execute twice**. Three guards, in this order:

1. **The consumer's durable uniqueness constraint** (`B12_INBOX_MODEL.md` §3) — the second insert loses.
2. **State-machine preconditions re-checked under `SELECT … FOR UPDATE`** — the second execution observes the first's committed transition and no-ops. Frozen `BACKEND_IDEMPOTENCY_STANDARD.md` already requires this: *"Worker execution is idempotent by `(command_id, effect_type)` and checks the target version/state before side effects."*
3. **The provider attempt record** — a `provider_request_attempts` row for this `(source_ref, effect_type)` already in a terminal state means the outside world was already contacted; the second execution reconciles instead of re-calling (`B12_UNKNOWN_OUTCOME_MODEL.md` §4).

## 6. Timeouts

Every task carries a **soft** limit (raises a catchable timeout so the worker can record `unknown` and exit cleanly) and a **hard** limit (kills the worker process). The soft limit must exceed the provider request budget it wraps; the hard limit must exceed the soft one. Job-level ceilings are the frozen `BACKEND_TIMEOUT_POLICY.md` "Job" column, reused verbatim and never widened:

| Operation | Connect | Request | Job |
|---|---:|---:|---:|
| Google Places | 3s | 15s | 5m |
| Scraper submit/poll | 5s | 30s | 30m |
| Meta send | 3s | 15s | 2m |
| AI Gateway | 3s | 60s | 5m |
| Tap API | 3s | 20s | 5m |
| ZATCA | 5s | 30s | 10m |
| Hostinger storage | 5s | 60s | 10m |
| Webhook processing | n/a | fast ack <3s | 5m |

> **A soft timeout is not a failure — it is an `unknown`.** A task killed while a provider call was in flight has no evidence about the provider's state, and `B12_UNKNOWN_OUTCOME_MODEL.md` governs what happens next. Recording it as `failed` would be a fabrication.

## 7. What B12 does not specify here

Worker concurrency, prefetch multiplier, pool type, autoscaling, heartbeat interval, broker connection settings, and beat schedule entries are **operations configuration**, not architecture. They belong to B13 (`B12_B13_BOUNDARY.md` §2). B12 fixes only the properties correctness depends on: late acknowledgement, re-read-don't-carry, bounded timeouts, and durable execution accounting.

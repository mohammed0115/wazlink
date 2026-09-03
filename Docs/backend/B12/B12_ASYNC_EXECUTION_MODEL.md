# B12 — Async Execution Model

> Design only. This is the spine of the pack; `B12_OUTBOX_MODEL.md`, `B12_CELERY_EXECUTION_MODEL.md`, `B12_PROVIDER_PORT_ARCHITECTURE.md`, and `B12_UNKNOWN_OUTCOME_MODEL.md` each expand one layer of it.

## 1. Six layers, never collapsed

> **`B12-D-A001`.** WazLink's asynchronous path has **six distinct layers**, each with its own identity, its own durability guarantee, and its own failure mode. Collapsing any two of them is the defect this document exists to prevent.

| # | Layer | Identity | Durable in | Survives a Redis flush? | Owns |
|---:|---|---|---|:--:|---|
| 1 | **Business command** | `Idempotency-Key` (frozen `BACKEND_IDEMPOTENCY_STANDARD.md`) | PostgreSQL | **yes** | the client's request identity |
| 2 | **Durable domain intent** | the domain aggregate's own PK / public ID | PostgreSQL | **yes** | *what must happen* |
| 3 | **Outbox event** | `outbox_events.event_id` (UUIDv7) | PostgreSQL | **yes** | *that it must be announced* |
| 4 | **Broker delivery** | Celery message id | Redis | **no — by design** | *a hint that work is waiting* |
| 5 | **Worker execution** | `worker_executions.id` | PostgreSQL | **yes** | *that an attempt was made, and its outcome* |
| 6 | **Provider request attempt** | `provider_request_attempts.id` + the provider idempotency key where one exists | PostgreSQL | **yes** | *what the outside world was asked, and what it said* |

**Layer 4 is the only layer that may be lost.** Everything above and below it is a committed PostgreSQL row. That single property is what makes the whole design recoverable: losing the broker degrades *latency*, never *correctness*, because layer 3 can always be re-scanned and layer 5/6 always record whether the work already happened.

## 2. The canonical sequence

```
  [1] API command (Idempotency-Key)
        │  ONE PostgreSQL transaction
        ├── domain state written            ← layer 2, the authoritative intent
        ├── IdempotencyRecord written       ← frozen B0 standard
        └── outbox_events row INSERTed      ← layer 3, same transaction (ADR-005)
        ▼  COMMIT  ─ the only point at which anything is promised
  [2] Dispatcher   claims an outbox row, publishes to Celery      ← layer 4 begins
  [3] Worker       re-reads authoritative state from PostgreSQL
                   opens worker_executions row                    ← layer 5
  [4] Adapter      provider call, recorded before and after       ← layer 6
  [5] Worker       records outcome; invokes the DOMAIN's own
                   guarded command to apply any result            ← back to layer 2
  [6] Webhook      later provider callback re-enters at the
                   gateway, is verified, receipted, and applied
                   through the same domain command                ← layer 6', then 2
```

**Step [1] is the promise.** Nothing before the commit is durable; nothing after it may be lost without being recoverable. Frozen ADR-005 states this as *"Transactional domain changes and an `OutboxEvent` commit in one transaction"* — B12 adds only the consequence: **no B12 code path may create an outbox row outside the transaction that created the state it announces** (`B12_OUTBOX_MODEL.md` §2, negative control `AT-B12OBX-9`).

## 3. What each layer owns — the anti-collapse table

The brief's §7 asks which layer owns which attribute. Answering it precisely is what prevents the two most common defects in this architecture: treating a Celery retry counter as a business budget, and treating a Celery task ID as a domain identity.

| Attribute | Owned by | **Never** owned by |
|---|---|---|
| Business identity | layer 2 (the domain aggregate) | the Celery task id, the outbox `event_id`, a provider object id |
| Business status | layer 2 | `worker_executions.status`, `outbox_events.status`, a Celery result |
| Business retry budget | the **domain** (e.g. `MAX_JOB_ATTEMPTS = 3`, `B3-D-A031`) | Celery's `max_retries`, `worker_executions.attempt_no` |
| Transport retry count | layer 5 (`worker_executions.attempt_no`) | the domain |
| Provider attempt count | layer 6 (`provider_request_attempts`) | layer 5, and never the domain's *actor-retry* counter |
| Dispatch attempt count | layer 3 (`outbox_events.dispatch_attempts`) | Celery |
| Correlation / causation | layers 1→6, propagated unchanged | any layer that mints a fresh one mid-flow |
| Result payload | layer 2, applied by the domain's own command | `worker_executions.result` (which holds *metadata only*) |
| Error state | each layer records its own; only layer 2's is business-visible | — |

> **`B12-D-A003`. A Celery task ID is never a WazLink identity, and a Celery retry counter is never a business budget.** Both are layer-4 artifacts of a store that may be flushed. Negative controls `AT-B12CEL-6`, `AT-B12RTY-7`.

## 4. Delivery semantics, stated honestly

> **`B12-D-A004`. Broker delivery is AT-LEAST-ONCE. WazLink does not claim, implement, or depend on exactly-once distributed delivery.**

Effectively-once *business effect* is obtained by five mechanisms, none of which is the broker:

| # | Mechanism | Where |
|---:|---|---|
| 1 | Durable uniqueness constraints at the consumer | `B12_INBOX_MODEL.md` §3; e.g. `uq_automation_runs_event_rule` (`B7_DATA_MODEL.md` §3) |
| 2 | State-machine preconditions re-checked under a row lock | `B12_CONCURRENCY_MODEL.md` §2 |
| 3 | The frozen platform `IdempotencyRecord` for client-originated commands | `BACKEND_IDEMPOTENCY_STANDARD.md` |
| 4 | Provider-side idempotency **where evidence shows it exists** | `B12_PROVIDER_CAPABILITY_MODEL.md` §3 |
| 5 | Reconciliation, for everything the first four cannot settle | `B12_RECONCILIATION_MODEL.md` |

Mechanism 4 is deliberately last and deliberately conditional: `B12_PROVIDER_RESEARCH_REGISTER.md` records that **no** Phase-1 provider is confirmed to offer a client-supplied idempotency key. The design therefore does not rest on one anywhere (`B12-D-A012`).

## 5. Why not "request → task → provider → hope"

The naive shape fails four ways this model closes:

| Naive failure | Why it happens | What layer closes it |
|---|---|---|
| Intent lost when the broker restarts | the task *was* the intent | layer 3 — the intent is a committed row; the sweep re-dispatches it |
| Duplicate business effect on redelivery | no durable dedup at the destination | layer 5/consumer constraint — the second delivery loses an insert |
| Double provider charge after a worker crash | no record that the call was already made | layer 6 — the attempt row is written *before* the call, so a crash leaves evidence |
| Silent guess after a timeout | success/failure treated as binary | layer 6 — `unknown` is a first-class outcome (`B12_UNKNOWN_OUTCOME_MODEL.md`) |

## 6. Synchronous paths are preserved, not asyncified

Several frozen domains state that their write paths are synchronous and must stay so. B12 honors each verbatim and adds nothing to them:

- **B9:** *"B9's financial write paths are entirely synchronous… No revenue is ever created by a worker"* (`B9_B12_ASYNC_BOUNDARY.md` §1). B12 never wraps `RecordRevenueEvent` in a task.
- **B11:** *"B11's user-facing write paths are entirely synchronous… No file becomes usable because a worker ran"* (`B11_B12_ASYNC_BOUNDARY.md` §1).
- **B7:** Phase 1 requires *"no timer-driven automation scheduling, no scheduled-trigger sweep, and no `automation_wakeups` polling mechanism"* (`B7_B12_ASYNC_BOUNDARY.md`). B12 builds none.

> **`B12-D-A005`. B12 never converts a synchronous frozen write path into an asynchronous one.** Async is added only where a frozen domain asked for it. Negative control `AT-B12FW-1`.

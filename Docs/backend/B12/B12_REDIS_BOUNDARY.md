# B12 — Redis Authority Boundary

> Design only. Realizes frozen `BACKEND_ARCHITECTURE_DECISIONS.md` line 18 verbatim: *"Redis is limited to broker/cache/short-lived lock duties and is never canonical storage."*

## 1. The test

> **`B12-D-A014`. For every use of Redis, one question must have the answer "yes": *if this Redis instance is flushed right now, does the system remain correct after recovery from PostgreSQL?* A "no" means the use is forbidden, not that it needs a backup.**

## 2. Permitted uses

| Use | Why it survives a flush |
|---|---|
| **Celery broker** | a lost message loses a *notification*; the outbox sweep re-dispatches from committed rows (`B12_OUTBOX_MODEL.md` §3) |
| **Cache of derived reads** | recomputable from PostgreSQL by definition |
| **Short-lived advisory locks** | a lost lock degrades to contention, never to incorrectness, because the durable guard underneath is a row lock or a unique constraint (`B12_CONCURRENCY_MODEL.md` §5) |
| **Abuse/rate-limit counters** | a flush makes the limiter *more permissive for one window*, which is acceptable **only** for abuse controls — never for a business budget (§4) |
| **Ephemeral coordination** (worker heartbeats, queue depth gauges) | operational telemetry; B13 owns durable retention |

## 3. Forbidden uses — enumerated, not implied

None of the following may exist **only** in Redis, at any time, for any duration:

committed business intent · payment or subscription state · Message or delivery state · entitlement or quota decisions · revenue or attribution facts · webhook receipt or its dedup key · retry counters that bound a business budget · dead-letter records · reconciliation cases · integration credentials or credential references · outbox rows · idempotency records for client commands · provider request attempt outcomes.

`REDIS_DURABLE_AUTHORITY_LEAKS = 0` rests on this list. Negative control `AT-B12RDS-1`.

## 4. The rate-limit split — the one genuinely subtle case

Frozen `BACKEND_RATE_LIMIT_POLICY.md` closes with the governing sentence: *"Quota enforcement remains transactional and authoritative in PostgreSQL; Redis counters are acceleration/abuse controls, not the source of truth."* B12 makes the consequence explicit, because this is where a Redis flush could otherwise become a budget bypass:

| Counter | Nature | Store | Effect of a Redis flush |
|---|---|---|---|
| API requests/min/workspace | abuse control | Redis | one window is more permissive. **Acceptable** |
| Webhook ingress rate | abuse control | Redis | same. **Acceptable** |
| `MAX_JOB_ATTEMPTS = 3` per Discovery Job (`B3-D-A031`) | **business budget** | **PostgreSQL** (`discovery_jobs.attempt_no`) | **none** — the counter is a committed column |
| `MAX_ACTOR_RETRY_REQUESTS_PER_WORKSPACE_PER_HOUR = 10` (`B3-D-A032`) | **admission budget** | **PostgreSQL-backed admission record** | **none** — a Redis-only implementation would let a flush hand a workspace ten free provider-cost retries |
| B4 provider-attempt maximum | **business budget** | **PostgreSQL** (`B4` run/attempt rows) | **none** |
| B8 quota `usage_counters` | **business budget** | **PostgreSQL** (frozen B8) | **none** |

> **`B12-D-A015`. A counter that bounds provider cost or commercial entitlement is a PostgreSQL row. A counter that only shapes traffic may live in Redis.** The distinguishing test: *would a reset give a workspace something it did not pay for, or spend money on its behalf?* If yes, it is durable. `RATE_LIMIT_BUDGET_GAPS = 0` and `RETRY_BUDGET_OVERRIDE_GAPS = 0` rest on this decision; negative controls `AT-B12RL-4`, `AT-B12RL-5`.

## 5. Recovery posture after a Redis loss

| Loss | Immediate effect | Recovery | Data lost |
|---|---|---|---|
| Broker flush | queued notifications gone | outbox sweep re-dispatches `pending`/`failed`; `dispatching` rows with expired leases are reclaimed | **none** |
| Cache flush | cold reads | recomputed on demand | none |
| Lock keys flushed | brief contention | PostgreSQL row locks and unique constraints still hold every invariant | none |
| Abuse counters flushed | one permissive window | counters refill | none that matters |
| **Business budget counters** | — | — | **cannot happen: none live there** |

**Worked example.** Redis is restarted while 400 outbox rows are `pending`, 30 are `dispatching`, and 12 Celery messages are in flight. After restart: the 400 are re-claimed normally; the 30 have expired leases and are reclaimed to `failed` then re-published (duplicate delivery, absorbed by consumer constraints); the 12 in-flight messages are gone but their outbox rows are among the 30. Net effect: some duplicate deliveries, zero lost intents, zero incorrect business state. That is the whole point of ADR-005.

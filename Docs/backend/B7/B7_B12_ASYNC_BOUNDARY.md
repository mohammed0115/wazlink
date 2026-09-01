# B7 — B12 (future Async Infrastructure) Boundary

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. What B7 requires, logically

Frozen B0 already selected the mechanism (`BACKEND_ARCHITECTURE_DECISIONS.md` ADR-005: transactional outbox, Celery dispatcher). B7 states its own logical requirements against that frozen choice, without redesigning the infrastructure:

- **Event delivery:** a dispatcher delivering domain-event outbox rows to B7's inbox consumer (`B7_EVENT_CONSUMPTION_MODEL.md` §1) — the exact same mechanism every other domain's own event consumers already use.
- **Execution jobs:** a worker queue picking up `queued` `automation_runs` and advancing them (`B7_EXECUTION_MODEL.md`).
- **Delayed wakeups:** a periodic sweep finding due `automation_wakeups` rows and re-enqueuing their runs (`B7_SCHEDULE_DELAY_MODEL.md` §4).
- **Retry queues:** the standard exponential-backoff retry mechanism (`BACKEND_RETRY_POLICY.md`, reused verbatim, `B7_FAILURE_RETRY_MODEL.md` §2).
- **Dead-letter transport:** a durable terminal record when retry budget exhausts (`B7_DEAD_LETTER_REPLAY.md` §1) — already satisfied by persisting `status='dead_lettered'` on the existing `automation_runs` row; no separate dead-letter queue/topic is required unless B12's concrete topology later needs one for operational reasons.

## 2. What belongs to B12, not B7

Concrete polling interval for the wakeup sweep, worker pool sizing/autoscaling, Celery queue topology and routing keys, broker (Redis) configuration, exact heartbeat/timeout tuning beyond the frozen retry table's own numbers, and any infrastructure-level dead-letter topic/alerting wiring. B7 names the requirement; B12 designs the implementation.

## 3. Boundary statement

`AT-B12ASYNC-1` **(NC)**: an implementation where B7's own design documents specify a Celery queue name, a Redis key pattern, or a worker concurrency number — fails; no such infrastructure-topology detail appears anywhere in this pack (checked mechanically — grep for `celery|redis|queue name|concurrency=` across `Docs/backend/B7/` returns no infrastructure-configuration literal).

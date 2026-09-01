# B7 — B12 (future Async Infrastructure) Boundary

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. What B7 requires, logically

Frozen B0 already selected the mechanism (`BACKEND_ARCHITECTURE_DECISIONS.md` ADR-005: transactional outbox, Celery dispatcher). B7 states its own logical requirements against that frozen choice, without redesigning the infrastructure.

**Every requirement below is a Phase-1 requirement backed by a Phase-1 B7 behavior.** In particular B7 Phase 1 requires **no timer-driven automation scheduling, no scheduled-trigger sweep, and no `automation_wakeups` polling mechanism**: Phase 1 has no time-based trigger, no delay action, no `waiting` run state, and no `automation_wakeups` table for anything to poll (`B7-D-A035`, `B7_DATA_MODEL.md` §7, `AT-SCHED-3` **NC**). An earlier draft of this list asked B12 for a periodic wakeup sweep; that requirement is **removed**, not deferred to a footnote, because B7 has nothing that would write a row for it to find. `B7_SCHEDULE_DELAY_MODEL.md` states what a *later* phase would need, and nothing in this document depends on it. The reconciliation requirement below is **not** an exception to any of this: it is a liveness mechanism that recovers already-`queued` work whose dispatch was lost, never a schedule that decides when automation runs.

- **Event delivery:** a dispatcher delivering domain-event outbox rows to B7's inbox consumer (`B7_EVENT_CONSUMPTION_MODEL.md` §1) — the exact same mechanism every other domain's own event consumers already use.
- **Execution jobs:** a worker queue picking up `queued` `automation_runs` and advancing them (`B7_EXECUTION_MODEL.md`).
- **Approval continuation:** re-enqueuing a run that leaves `awaiting_approval` for `queued` on an `ApproveAutomationRun` decision — an approval-gated run holds no worker while it waits (`B7_FAILURE_RETRY_MODEL.md` §2), so the decision, not a timer, is what puts it back on a queue.
- **Reconciliation:** the periodic sweep that re-enqueues a `queued` run whose Celery task was lost between admission commit and dispatch (`B7_EVENT_CONSUMPTION_MODEL.md` §4 step 7).
- **Retry queues:** the standard exponential-backoff retry mechanism (`BACKEND_RETRY_POLICY.md`, reused verbatim, `B7_FAILURE_RETRY_MODEL.md` §2).
- **Dead-letter transport:** a durable terminal record when retry budget exhausts (`B7_DEAD_LETTER_REPLAY.md` §1) — already satisfied by persisting `status='dead_lettered'` on the existing `automation_runs` row; no separate dead-letter queue/topic is required unless B12's concrete topology later needs one for operational reasons.

## 2. What belongs to B12, not B7

Worker pool sizing/autoscaling, the reconciliation sweep's polling interval (`B7_EVENT_CONSUMPTION_MODEL.md` §4 step 7), Celery queue topology and routing keys, broker (Redis) configuration, exact heartbeat/timeout tuning beyond the frozen retry table's own numbers, and any infrastructure-level dead-letter topic/alerting wiring. B7 names the requirement; B12 designs the implementation.

## 3. Boundary statement

`AT-B12ASYNC-1` **(NC)**: an implementation where B7's own design documents specify a Celery queue name, a Redis key pattern, or a worker concurrency number — fails; no such infrastructure-topology detail appears anywhere in this pack (checked mechanically — grep for `celery|redis|queue name|concurrency=` across `Docs/backend/B7/` returns no infrastructure-configuration literal).

# B9 — B12 Async / Platform Boundary

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.
> **No B12 file is created by this document.** `B12_FILES_CREATED = 0`.

## 1. What B9 requires, semantically

Frozen B0 ADR-005 already selected the mechanism (transactional outbox + Celery dispatcher). B9 states logical requirements against that frozen choice and designs no infrastructure.

**Every requirement below is a Phase-1 requirement backed by a Phase-1 B9 behavior.** In particular:

> **B9's financial write paths are entirely synchronous.** `RecordRevenueEvent` and `ReverseRevenueEvent` validate, write, and publish inside one request-scoped transaction. No revenue is ever created by a worker, and no financial correctness depends on a job running. If every B9 background job stopped forever, the register would remain complete and correct — only reconciliation detection and projection freshness would lag.

| Requirement | What B12 provides |
|---|---|
| **Event publication** | The frozen outbox dispatcher publishing B9's six produced events. Identical to every other domain's; B9 adds no new transport |
| **Reconciliation scans** | Periodic execution of the three read-only scans (`B9_RECONCILIATION_MODEL.md` §8). These are **detection** jobs — they open cases and never write financial tables |
| **Projection refresh** | If and when Analytics materialises B9's selectors, the refresh cadence and its freshness contract (`B9_ANALYTICS_PROJECTIONS.md` §6) |
| **Retry / dead-letter** | The standard exponential-backoff retry (`BACKEND_RETRY_POLICY.md`, reused verbatim) for the outbox dispatcher and the scan jobs |

**B9 requires no timer-driven financial action, no scheduled recognition, no wake-up mechanism, and no delayed financial write.** There is no time-based trigger anywhere in B9: recognition happens when a human commands it, and nothing in the domain becomes true merely because time passed. The reconciliation scans above are periodic *detection*, not scheduled financial behavior — they are read-only by construction (`AT-RECON-1` **NC**).

## 2. What belongs to B12, not B9

Worker pool sizing and autoscaling; the scan cadence's concrete interval; Celery queue topology and routing keys; broker (Redis) configuration; heartbeat/timeout tuning beyond the frozen retry table's numbers; dead-letter topic and alerting wiring; projection store technology.

B9 names the requirement; B12 designs the implementation.

## 3. What B9 does not do

No Celery configuration, no Redis configuration, no worker code, no queue definition, no scheduler entry, no beat schedule, and no B12 file. B9 declares semantics only.

## 4. Failure posture

| If this fails | Consequence | Financial correctness |
|---|---|---|
| Outbox dispatcher stops | B9 events are not delivered downstream | **unaffected** — rows are committed; events replay when it resumes |
| Reconciliation scan stops | Discrepancies go undetected | **unaffected** — no case ever changed a financial fact |
| Projection refresh stops | Dashboards go stale | **unaffected** — selectors read the register directly |
| A scan crashes mid-run | Partial detection | **unaffected**; the fingerprint index makes the next run idempotent (`B9_RECONCILIATION_MODEL.md` §6) |

This is the property worth stating plainly: **no asynchronous failure can corrupt, lose, or invent recognized revenue.**

## 5. Negative controls

`AT-B12-1` **(NC)**: a worker or scheduled job writing `revenue_events` or `revenue_reversals` — fails.
`AT-B12-2` **(NC)**: recognition made asynchronous, so a command returns before the row is committed — fails.
`AT-B12-3` **(NC)**: a B9 document specifying Celery/Redis/worker configuration — fails.
`AT-B12-4` **(NC)**: a time-based trigger creating or reversing revenue — fails.

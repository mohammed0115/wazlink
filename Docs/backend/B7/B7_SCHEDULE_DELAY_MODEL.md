# B7 — Scheduled Automations and Delay/Wait Action

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 0. PHASE 2 — DEFERRED DESIGN ONLY. NOT PART OF THE PHASE-1 SURFACE.

**Phase 1 supports none of it.** Explicitly, Phase 1 has:

- **no scheduled trigger** of any kind
- **no absolute schedule** (fixed-timestamp firing)
- **no relative schedule** (offset-from-an-event firing)
- **no `wait` / delay / sleep action**
- **no `waiting` run state**
- **no `automation_wakeups` table**, and no sweep, timer, or wake-up mechanism to poll one

Each of those absences is enforced, not merely asserted: the closed Phase-1 trigger catalog contains no schedule-shaped entry (`B7_TRIGGER_CATALOG.md` §2), the closed Phase-1 action catalog contains no delay action (`B7_ACTION_CATALOG.md` §2), the `automation_runs` status enum contains no `waiting` value (`B7_DATA_MODEL.md` §3), the Phase-1 owned-table set contains no wakeup table (`B7_DATA_MODEL.md` §7, `B7_DOMAIN_OWNERSHIP.md` §2), B7 asks B12 for no timer (`B7_B12_ASYNC_BOUNDARY.md` §1), and `AT-SCHED-1`…`AT-SCHED-3` **(NC)** fail any implementation that ships one anyway. The governing decisions are `B7-D-A028`, `B7-D-A029` and `B7-D-A035`; the evidentiary basis is FB-A57 — the frozen frontend contains no delay action, no time-based trigger, and no scheduling affordance, verified across `automationTriggerCatalog`, `automationActionCatalog`, `Automation.tsx`, and `AutomationModal.tsx`.

**Everything from §1 onward is future design guidance for a later phase and MUST NOT be implemented in Phase 1.** It is retained so that a later phase inherits a resolved answer rather than an open question, and it is written in the conditional throughout: it describes what a scheduling phase *would* define, never what B7 Phase 1 does define. An implementation agent building Phase-1 B7 from this pack must treat this entire document as out of scope.

---

## 1. Scheduled triggers — Phase-2 forward design (`B7-D-A028`)

Deliberately not overbuilt: a scheduling phase would add **no cron-expression support**, because no product or frontend evidence justifies recurring-cron rules — `automationTriggerCatalog` (FB-A04) contains no schedule-shaped entry at all. Such a phase would introduce exactly two shapes:

- **Absolute:** a fixed UTC timestamp (`scheduled_time`), one-shot.
- **Relative:** an offset from another trigger's `event.occurred_at` (e.g. "3 days after `LeadCreated`") — implemented identically to the wait action's mechanism (§2), not as a separate scheduling engine.

Adding either would additionally require the `scheduled` value on `automation_runs.trigger_source`, which the Phase-1 enum deliberately omits (`B7_DATA_MODEL.md` §3). `resume_at` would always be stored and compared in UTC, on the `automation_wakeups` table §2 sketches — a table `B7_DATA_MODEL.md` §7 records as **not existing in Phase 1** — matching this corpus's precedent of never storing a naive local timestamp. Display-timezone conversion would remain a frontend concern. DST would not affect UTC storage/comparison by construction: nothing is ever compared in local time server-side, so there is no "2:30 AM on the day clocks change" ambiguity.

## 2. Wait/delay action — Phase-2 forward design (`B7-D-A029`, task brief §30)

**It would never hold a worker process.** A `wait` action would transition its `AutomationRunStep` to `completed` immediately upon *scheduling* the wake-up (not upon the wake-up firing) and transition the parent `AutomationRun` to a `waiting` state that phase would have to add. An `automation_wakeups` row would be inserted (`resume_at = now() + duration`, `run_id`, `action_index` = the *next* action's index) in the same transaction. No process would block; the run would simply have no active worker task until a scheduled sweep — which Phase 1 does not have and does not ask B12 for (`B7_B12_ASYNC_BOUNDARY.md` §1) — found due wakeups and re-enqueued the run's continuation.

| Field | Phase-2 resolution |
|---|---|
| `resume_at` | UTC, `now() + duration` at scheduling time — never recomputed relative to "now" at wake-up time |
| `status` | `pending` → `fired` (consumed) or `cancelled` |
| Wake-up identity | `automation_wakeups.id`, referenced by `(run_id, action_index)` |
| Dedup | unique `(run_id, action_index)` — a duplicate sweep pickup of the same due wakeup would be a no-op past the first `fired` transition |
| Cancel | `CancelAutomationExecution` on a `waiting` run would cancel its open wakeup row (`status='cancelled'`) and the run itself would transition `cancelled` — no later actions would run |
| Rule disabled during wait | The `waiting` run would **not** be interrupted — it would wake and continue against its already-captured `rule_revision_id`; only *new* trigger admission is affected by disabling a rule, exactly as `B7_RULE_LIFECYCLE.md` §3 already resolves for `running` runs in Phase 1 |
| Target entity deleted/archived during wait | The next action's own invocation would perform its ordinary target-domain read/validation at wake-up time — if the target Lead/Deal no longer resolved, that action would fail normally (`PERMANENT`, `B7_FAILURE_RETRY_MODEL.md` §1), exactly as if the entity had disappeared between any two ordinary sequential actions |
| Entitlement changed during wait | Re-checked at wake-up, identically to `B7_ACTION_AUTHORIZATION.md` §4's "entitlement changes mid-run" resolution — a lost entitlement would block the *next* action, not retroactively the already-`completed` `wait` step |

## 3. Missed schedules, late workers, clock skew, duplicate wakeups — Phase-2 forward design

- **Missed/late:** a wakeup whose `resume_at` had passed would still be `pending` until a sweep processed it — there would be no "missed" state. Lateness would affect only whatever wake-up-latency metric that phase chose to define; **Phase 1 defines no such metric**, and `B7_OBSERVABILITY_AUDIT.md` §2's metric set deliberately contains none, because nothing in Phase 1 can be late in this sense.
- **Clock skew:** the sweep query would be `resume_at <= now()` evaluated by the database server's own clock, matching every other domain's existing timestamp discipline in this corpus (no B7-specific clock-sync mechanism would be introduced).
- **Duplicate wakeups:** the `(run_id, action_index)` unique constraint (§2) would make a wakeup's `fired` transition idempotent — two sweep workers racing to claim the same due row would resolve via `SELECT ... FOR UPDATE SKIP LOCKED` (matching this corpus's established row-locking idiom, `B6_CONCURRENCY_IDEMPOTENCY.md` §1), so exactly one worker would process it.

## 4. Boundary with B12, if this phase is ever built

The logical requirement — "durably persist a wake-up time, and have *something* poll for due wake-ups and re-enqueue the associated work" — would be B7's to state **at that time**. It is not stated now: `B7_B12_ASYNC_BOUNDARY.md` §1 lists B7's Phase-1 async requirements and deliberately contains no timer or sweep, because Phase 1 writes no row for one to find. The concrete polling interval, worker pool sizing, and Celery-beat-vs-alternative infrastructure choice would belong to B12, exactly as the task brief's §56 draws that line.

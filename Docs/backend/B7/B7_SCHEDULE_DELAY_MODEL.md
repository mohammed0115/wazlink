# B7 — Scheduled Automations and Delay/Wait Action

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Scheduled triggers — resolved (Class A, `B7-D-A028`)

Not overbuilt: no cron-expression support (no product/frontend evidence justifies recurring-cron rules — `automationTriggerCatalog`, FB-D02, contains no schedule-shaped entry at all). Phase-1 supports exactly two shapes, matching the task brief's own minimum (§29):

- **Absolute:** a fixed UTC timestamp (`scheduled_time`), one-shot.
- **Relative:** an offset from another trigger's `event.occurred_at` (e.g. "3 days after `LeadCreated`") — implemented identically to the Wait action's mechanism (§2), not as a separate scheduling engine.

`resume_at` is always stored and compared in UTC (`automation_wakeups.resume_at`, `B7_DATA_MODEL.md` §7) — matching `B6_CURRENCY_MODEL.md`-adjacent precedent elsewhere in this corpus of never storing a naive local timestamp. Display-timezone conversion is a frontend concern only. DST does not affect UTC storage/comparison by construction — there is no "2:30 AM on the day clocks change" ambiguity because nothing is ever compared in local time server-side.

## 2. Wait/delay action — resolved (Class A, `B7-D-A029`, task brief §30)

**Never holds a worker process.** A `wait` action transitions its `AutomationActionExecution` to `succeeded` immediately upon *scheduling* the wake-up (not upon the wake-up firing) and transitions the parent `AutomationRun` to `waiting` (`B7_EXECUTION_MODEL.md` §3). An `automation_wakeups` row is inserted (`resume_at = now() + duration`, `run_id`, `action_index` = the *next* action's index) in the same transaction. No process blocks; the run simply has no active worker task until a scheduled sweep (`B12`'s Celery-beat-equivalent, per §6) finds due wakeups and re-enqueues the run's continuation.

| Field | Resolution |
|---|---|
| `resume_at` | UTC, `now() + duration` at scheduling time — never recomputed relative to "now" at wake-up time |
| `status` | `pending` → `fired` (consumed) or `cancelled` |
| Wake-up identity | `automation_wakeups.id`, referenced by `(run_id, action_index)` |
| Dedup | unique `(run_id, action_index)` — a duplicate sweep pickup of the same due wakeup is a no-op past the first `fired` transition |
| Cancel | `CancelAutomationExecution` on a `waiting` run cancels its open wakeup row (`status='cancelled'`) and the run itself transitions `cancelled` — no later actions ever run |
| Rule disabled during wait | Per `B7_RULE_LIFECYCLE.md` §3: the `waiting` run is **not** interrupted — it wakes and continues normally when `resume_at` arrives, using its already-captured `rule_revision_id`; only *new* trigger admission is affected by disabling the rule |
| Target entity deleted/archived during wait | The next action's own invocation performs its ordinary target-domain read/validation at wake-up time — if the target Lead/Deal no longer resolves, that action fails normally (`PERMANENT`, §`B7_FAILURE_RETRY_MODEL.md` §1), exactly as if the entity had disappeared between any two ordinary sequential actions |
| Entitlement changed during wait | Re-checked at wake-up, identically to §`B7_ACTION_AUTHORIZATION.md` §4's "entitlement changes mid-run" resolution — a lost entitlement blocks the *next* action, not retroactively the already-`succeeded` `wait` step itself |

## 3. Missed schedules, late workers, clock skew, duplicate wakeups

- **Missed/late:** a wakeup whose `resume_at` has passed is still `pending` until a sweep processes it — there is no "missed" state; lateness only affects `B7_OBSERVABILITY_AUDIT.md`'s `scheduled_wakeup_delay` metric (§`B7_OBSERVABILITY_AUDIT.md` §2), never correctness.
- **Clock skew:** the sweep query is `resume_at <= now()` evaluated by the database server's own clock, matching every other domain's existing timestamp discipline in this corpus (no B7-specific clock-sync mechanism is introduced).
- **Duplicate wakeups:** the `(run_id, action_index)` unique constraint (§2) makes a wakeup's `fired` transition idempotent — two sweep workers racing to claim the same due row resolve via `SELECT ... FOR UPDATE SKIP LOCKED` (matching this corpus's established row-locking idiom, `B6_CONCURRENCY_IDEMPOTENCY.md` §1), so exactly one worker processes it.

## 4. Boundary with B12

The logical requirement — "durably persist a wake-up time, and have *something* poll for due wake-ups and re-enqueue the associated work" — is B7's to state. The concrete polling interval, worker pool sizing, and Celery-beat-vs-alternative infrastructure choice belong to B12 (`B7_B12_ASYNC_BOUNDARY.md`), exactly as the task brief's §56 draws that line.

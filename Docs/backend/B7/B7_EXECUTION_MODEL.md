# B7 — Execution Model (AutomationRun)

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Fields

See `B7_DATA_MODEL.md` §3 for the full column list. Summarizing against the task brief's §20 minimum: public ID (`RUN-*`), workspace, rule + rule revision (nullable — §5), trigger event identity (`source_event_id`, nullable for manual), status, `started_at`/`completed_at`/`failed_at` (folded into `status`+timestamp columns, not three separate booleans — a run's terminal timestamp is `completed_at`, with `status` disambiguating success/failure/cancellation/skip rather than four redundant nullable timestamp columns), current action (`FK` via the latest `automation_run_steps` row for this `run_id`, not a duplicated column), attempt (owned per-action, §`B7_ACTION_EXECUTION_MODEL.md` — a run itself has no single "attempt count," only its actions do), `correlation_id`/`causation_id`/`root_run_id`, error classification, and `created_at`.

**The five timestamps are distinct and ordered with the state machine** (`B7_DATA_MODEL.md` §3, `B7-D-A042`): `created_at` (insert, at `created` — **not null**) → `evaluated_at` (leaving `evaluating`) → `queued_at` (entering `queued`) → `started_at` (entering `running`) → `completed_at` (any terminal state). `created_at` is **never** an alias for `queued_at`: a `skipped` run, or one cancelled before queueing, has a `created_at` and no `queued_at` at all; and an approval-requiring run's `queued_at` is set at the approval decision, minutes or hours after `created_at`. An earlier draft equated the two, which made both the run-age and the queue-latency readings wrong for exactly those cases.

## 2. States — anchored on the frozen B0 state machine (Class A, `B7-D-A018`)

Frozen `BACKEND_STATE_MACHINES.md` **already fixes this aggregate's lifecycle**, before B7 existed:

> `AutomationRun` is `created→awaiting_approval→queued→running→completed/failed/cancelled`; sensitive actions cannot skip approval.

B7 **adopts those seven state names verbatim** — `created`, `awaiting_approval`, `queued`, `running`, `completed`, `failed`, `cancelled` — and preserves the frozen ordering, including the load-bearing detail that **approval precedes queueing**, not the reverse. B7 renames nothing: in particular the frozen terminal is `completed`, never `succeeded`, and the frozen initial state is `created`, never an implicit `queued`.

Three states are **added** — and, after the Phase-2 scope reduction removed `wait`/`scheduled` (`B7-D-A035`), exactly three: `evaluating`, `skipped`, `dead_lettered`. Each is retained only because it names a condition a durable, asynchronous, retrying implementation genuinely has, the frozen synchronous sketch had no word for, and no existing state can carry without misreporting; each has defined transitions (§3), a run-DTO representation (`B7_API_DTO_CONTRACTS.md` §2), acceptance coverage (`AT-EXEC-*`, `AT-TRIG-*`, `AT-DL-*`), and amendment coverage (`B7-AM-003`). All three are declared as an ADDITIVE amendment in `B7_CONTROLLED_AMENDMENTS.md` (`B7-AM-003`) rather than introduced silently:

| Added state | Why the frozen seven cannot express it | Terminal? |
|---|---|---|
| `evaluating` | between admission and the approval/queue decision the run must evaluate its conditions; the frozen sketch had no condition-evaluation step because B0 modelled no condition engine | no |
| `skipped` | a run that was admitted but never acted — conditions did not match (directly evidenced, FB-A26: the mock persists exactly this outcome with a reason), the `automationRuns` quota was exhausted, or loop-prevention blocked it. Not representable as `completed` without misreporting "the rule acted". It carries a closed `skip_reason` and emits `AutomationRunSkipped` (`B7-D-A041`) | **yes** |
| `dead_lettered` | frozen `BACKEND_RETRY_POLICY.md` already names `dead_lettered` as the terminal disposition after exhausted attempts; the frozen AutomationRun sketch predates any retry design for this aggregate | **yes** |

A fourth state, **`waiting`** (durably paused inside a delay action), is defined in `B7_SCHEDULE_DELAY_MODEL.md` but is **Phase-2 only** and is not reachable by any Phase-1 rule — see §7.

`matched` is deliberately **not** a state: a matched run transitions straight from `evaluating` into `awaiting_approval` or `queued`, because "matched" carries no distinct outbound transition of its own.

## 3. Legal transitions

The frozen chain `created→awaiting_approval→queued→running→completed/failed/cancelled` yields exactly **six** literal adjacencies. Each row below is labelled against that set: **(F)** = a frozen adjacency, present unchanged; **(F-refined)** = a frozen adjacency preserved as an ordering, with one added intermediate state on the path; **(A)** = an added edge. The labels are stated this precisely because an earlier draft of this section marked several added edges **(F)** and claimed "no frozen edge is re-pointed," which was not true of its own table.

```
created            → evaluating                    (F-refined, 1 of 2 — see below)
evaluating         → awaiting_approval             (F-refined, 2 of 2 — an action requires approval)
evaluating         → queued                        (A — no action requires approval)
evaluating         → skipped                       (A, terminal)
awaiting_approval  → queued                        (F — approved)
queued             → running                       (F — a worker claims the run)
running            → completed                     (F — every action reached a terminal disposition)
running            → failed                        (F — PERMANENT or retry-exhausted action failure)
running            → cancelled                     (F — explicit cancel)
created            → cancelled                     (A)
evaluating         → cancelled                     (A)
queued             → cancelled                     (A)
awaiting_approval  → cancelled                     (A — rejected, or rule disabled while awaiting)
queued/awaiting_approval/running → dead_lettered   (A, terminal)
```

**Five of the six frozen adjacencies are present verbatim.** The sixth, `created → awaiting_approval`, is refined into `created → evaluating → awaiting_approval`: no frozen state is renamed, removed, reordered, or made unreachable, no frozen edge is reversed, and the frozen ordering — including approval strictly before queueing — is preserved exactly. `B7-AM-003` classifies that refinement ADDITIVE and records, openly, the alternative reading under which it would not be (`B7_CONTROLLED_AMENDMENTS.md`).

`completed`, `failed`, `cancelled`, `skipped`, `dead_lettered` are terminal — no legal outbound transition from any of them, and **each reports itself with exactly one event**: `AutomationRunCompleted`, `AutomationRunFailed`, `AutomationRunCancelled`, `AutomationRunSkipped`, `AutomationRunDeadLettered` respectively (`B7_COMMAND_EVENT_CATALOG.md` §2, `B7-D-A041`). No terminal state is externally silent, and `AutomationRunCompleted` never describes a run that did not act. `AT-EXEC-2` **(NC)**: an implementation transitioning a `completed` or `failed` run back to `running` (for anything other than creating a *new*, separate replay run per `B7_DEAD_LETTER_REPLAY.md`) — fails; no such transition is legal.

**Every run enters at `created`.** Admission inserts the row at `created` and advances it within the admission transaction (`B7_TRIGGER_ADMISSION.md` steps 10-11, `B7_EVENT_CONSUMPTION_MODEL.md` §4); `RunAutomationNow` does the same. No code path inserts a run directly at `evaluating`, `awaiting_approval`, `queued`, or any terminal state. `AT-EXEC-4` **(NC)** holds this line.

**Approval strictly precedes execution.** There is no `evaluating → running` edge and no `awaiting_approval → running` edge: a run whose planned actions include an `approval_required` tier reaches `running` only by way of `queued`, and it reaches `queued` only by way of an `ApproveAutomationRun` decision. This is the structural form of the frozen sentence *"sensitive actions cannot skip approval."* `AT-EXEC-5` **(NC)** holds it.

## 4. Rule-less runs — resolved (Class A, `B7-D-A019`)

`rule_id` is nullable specifically to represent the AGA-/RUN- unification `BACKEND_PUBLIC_ID_REGISTRY.md` §C already froze (FB-A60): an approved AI/Copilot-recommended action becomes an `AutomationRun` with `trigger_source='recommendation'`, `rule_id=NULL`, `rule_revision_id=NULL`, and its single action carried on the run's own step row rather than resolved from a revision's `automation_rule_actions` rows. This does **not** grant B4 execution authority — B4 only produces the recommendation; a human explicitly accepting it is what creates the run, through a governed B7 command (`RunAutomationNow` supplied with an explicit ad-hoc action payload rather than a `rule_id`), preserving the frozen B4 boundary that "AI recommendation does not authorize action" (task brief §50).

## 5. Dry-run / test mode — resolved (Class A, `B7-D-A020`, task brief §31)

Directly evidenced (FB-A38), and proven by `AT-EXEC-7`: `RunAutomationTest` evaluates a rule's trigger/condition match against a supplied fixture context and returns the match result **without persisting an `automation_runs` row and without invoking any action**. It is a pure read/compute operation, not a lighter-weight execution — the distinction from `RunAutomationNow` (§`B7_COMMAND_EVENT_CATALOG.md`) is exact and structural: `RunAutomationTest` never reaches action invocation under any circumstance, even for `auto_safe` actions; `RunAutomationNow` is a genuine execution (creates a real `automation_runs` row, `trigger_source='manual'`) subject to the identical approval gate as any event-triggered run.

## 6. Terminal-state clarity

No run ever ends in an ambiguous or unset terminal state — `AT-EXEC-6` **(NC)**: an implementation leaving a run in `running` indefinitely with no worker heartbeat and no dead-letter transition — fails; `B7_FAILURE_RETRY_MODEL.md` §3's worker-heartbeat/timeout discipline (reusing `BACKEND_RETRY_POLICY.md`'s frozen "workers must use timeouts, heartbeats" standard) guarantees every run eventually reaches a terminal state, `dead_lettered` included. (An `awaiting_approval` run is not an exception: it holds no worker and no attempt budget, and is settled by an approval decision or a cancel, `B7_PAUSE_DISABLE_CANCEL.md` §2.)

## 7. `waiting` is Phase-2, not Phase-1 — resolved (Class A, `B7-D-A035`)

The frozen frontend contains **no delay action, no time-based trigger, and no scheduling affordance of any kind** (FB-A57, an absence verified across `automationTriggerCatalog`, `automationActionCatalog`, `Automation.tsx`, and `AutomationModal.tsx`). Phase-1's closed action catalog (`B7_ACTION_CATALOG.md` §2) therefore contains no `wait` action, and Phase-1's closed trigger catalog (`B7_TRIGGER_CATALOG.md` §2) contains no scheduled trigger.

Consequently **no Phase-1 rule can reach the `waiting` state**, and Phase 1 defines no wakeup/timer table at all (`B7_DATA_MODEL.md` §7) — not one without a writer, but none. `B7_SCHEDULE_DELAY_MODEL.md` is retained as the *forward* design for the moment product evidence appears, so that a later phase inherits a resolved answer rather than an open question — but it is explicitly out of the Phase-1 surface, and an implementation agent must not build it from this pack.

`AT-SCHED-1`/`AT-SCHED-2`/`AT-SCHED-3` **(NC)**: an implementation shipping a Phase-1 scheduled trigger, `wait` action, `waiting` state, or wakeup table — fails; none appears in either closed Phase-1 catalog, and the DTO layer rejects any `action.type`/`trigger.type` outside them (`B7_API_DTO_CONTRACTS.md` §3).

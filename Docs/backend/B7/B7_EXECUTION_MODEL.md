# B7 — Execution Model (AutomationRun)

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Fields

See `B7_DATA_MODEL.md` §3 for the full column list. Summarizing against the task brief's §20 minimum: public ID (`RUN-*`), workspace, rule + rule revision (nullable — §5), trigger event identity (`source_event_id`, nullable for manual), status, `started_at`/`completed_at`/`failed_at` (folded into `status`+timestamp columns, not three separate booleans — a run's terminal timestamp is whichever of `completed_at` is set, with `status` disambiguating success/failure/cancellation rather than three redundant nullable timestamp columns), current action (`FK` via the latest `automation_action_executions` row for this `run_id`, not a duplicated column), attempt (owned per-action, §`B7_ACTION_EXECUTION_MODEL.md` — a run itself has no single "attempt count," only its actions do), `correlation_id`/`causation_id`/`root_run_id`, error classification, `created_at` (= `queued_at`).

## 2. States — resolved (Class A, `B7-D-A018`)

**`queued`, `evaluating`, `skipped`, `awaiting_approval`, `running`, `waiting`, `succeeded`, `failed`, `cancelled`, `dead_lettered`.** Ten states, extending the evidenced-but-synchronous frontend vocabulary (FB-D09: `evaluating`/`matched`/`skipped`/`awaiting_approval`/`executed`/`failed`/`cancelled`) with the states a genuinely durable async system requires and the mock — by its own admission (FB-D23) — never needed: `queued` (persisted, not yet picked up by a worker), `running` (a worker is actively invoking actions), `waiting` (durably paused mid-execution inside a `wait` action), `dead_lettered` (retry budget exhausted). `matched` is not a separate state — a matched run transitions directly from `evaluating` into whichever of `awaiting_approval`/`running` its first action requires, since "matched" alone carries no distinct further transition of its own.

## 3. Legal transitions

```
queued → evaluating
evaluating → skipped                         (conditions did not match; terminal)
evaluating → awaiting_approval                (first action requires approval)
evaluating → running                          (first action is auto_safe)
awaiting_approval → running                   (approved)
awaiting_approval → cancelled                 (rejected, OR rule disabled while awaiting — §`B7_PAUSE_DISABLE_CANCEL.md`)
running → waiting                             (a `wait` action begins its durable pause)
waiting → running                             (wakeup fires, §`B7_SCHEDULE_DELAY_MODEL.md`)
running → awaiting_approval                   (a later action in the sequence requires approval)
running → succeeded                           (all actions completed; includes `stop_execution` early-exit)
running → failed                              (an action reaches PERMANENT/exhausted-retry failure, §`B7_FAILURE_RETRY_MODEL.md`)
running/waiting/awaiting_approval → dead_lettered   (retry budget exhausted at the run level — §`B7_FAILURE_RETRY_MODEL.md` §3)
queued/evaluating/awaiting_approval/running/waiting → cancelled   (explicit `CancelAutomationExecution`, §`B7_PAUSE_DISABLE_CANCEL.md`)
```

`succeeded`, `failed`, `cancelled`, `skipped`, `dead_lettered` are terminal — no legal outbound transition from any of them. `AT-EXEC-1` **(NC)**: an implementation transitioning a `succeeded` or `failed` run back to `running` (for anything other than creating a *new*, separate replay run per `B7_DEAD_LETTER_REPLAY.md`) — fails; no such transition is legal.

## 4. Rule-less runs — resolved (Class A, `B7-D-A019`)

`rule_id` is nullable specifically to represent the AGA-/RUN- unification `BACKEND_PUBLIC_ID_REGISTRY.md` §C already froze (FB-D24): an approved AI/Copilot-recommended action becomes an `AutomationRun` with `trigger_source='recommendation'`, `rule_id=NULL`, `rule_revision_id=NULL`, and its single action embedded directly on the run rather than resolved from a revision's `action_definitions`. This does **not** grant B4 execution authority — B4 only produces the recommendation; a human explicitly accepting it is what creates the run, through a governed B7 command (`RunAutomationNow` supplied with an explicit ad-hoc action payload rather than a `rule_id`), preserving the frozen B4 boundary that "AI recommendation does not authorize action" (task brief §50).

## 5. Dry-run / test mode — resolved (Class A, `B7-D-A020`, task brief §31)

Directly evidenced (FB-D12): `RunAutomationTest` evaluates a rule's trigger/condition match against a supplied fixture context and returns the match result **without persisting an `automation_runs` row and without invoking any action**. It is a pure read/compute operation, not a lighter-weight execution — the distinction from `RunAutomationNow` (§`B7_COMMAND_EVENT_CATALOG.md`) is exact and structural: `RunAutomationTest` never reaches action invocation under any circumstance, even for `auto_safe` actions; `RunAutomationNow` is a genuine execution (creates a real `automation_runs` row, `trigger_source='manual'`) subject to the identical approval gate as any event-triggered run.

## 6. Terminal-state clarity

No run ever ends in an ambiguous or unset terminal state — `AT-EXEC-2` **(NC)**: an implementation leaving a run in `running` indefinitely with no worker heartbeat and no dead-letter transition — fails; `B7_FAILURE_RETRY_MODEL.md` §3's worker-heartbeat/timeout discipline (reusing `BACKEND_RETRY_POLICY.md`'s frozen "workers must use timeouts, heartbeats" standard) guarantees every non-`waiting` run eventually reaches a terminal state or `dead_lettered`.

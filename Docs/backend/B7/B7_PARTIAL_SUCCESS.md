# B7 — Partial Success

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Resolved status — no state explosion (Class A, `B7-D-A032`)

The task brief's own example — action 1 (create Task) succeeds, action 2 (send Message) fails, action 3 (move Deal) never runs — is labeled **`failed`** at the run level, exactly as the task brief instructs ("Do not label this as fully successful"). Phase-1 does **not** introduce a distinct `partially_succeeded` run status: `B7_ACTION_EXECUTION_MODEL.md` §2's per-action status column already carries the complete, granular truth (`succeeded`/`failed`/`skipped` per action index), so a run-level status enum bloated with a `partially_succeeded` variant would duplicate information the action-execution rows already carry precisely, while adding an ambiguous new terminal state to every consumer of run status (§`B7_EXECUTION_MODEL.md`'s ten-state enum stays ten).

A run is `succeeded` **only if every one of its actions reached `succeeded` or was deliberately skipped by `stop_execution`** (§`B7_ACTION_CATALOG.md` §5 — an early, intentional stop is not a partial failure). Any other combination — one or more actions `failed`, or any action never reached because an earlier one halted the sequence (`skipped` due to failure, not due to `stop_execution`) — is `failed`.

## 2. Truth is never hidden

The run's own `error_classification`/`failure_reason` names *which* action failed and why; every action's individual status remains independently queryable (`B7_READ_MODELS_QUERY.md` §3's action-execution history view) — a consumer inspecting a `failed` run sees exactly "action 1 succeeded (created `TSK-1042`), action 2 failed (`invalid_phone`), action 3 skipped" rather than a flattened boolean.

## 3. `stop_execution` is not a partial failure

Distinguished explicitly (§`B7_ACTION_CATALOG.md` §5): a rule author's own `stop_execution` action, reached deliberately, ends the run `succeeded` with the remaining actions marked `skipped` — this is intentional early exit, not truncation by error, and is never confused with the failure case in either the status enum or the audit trail (the `skipped` action rows carry a distinguishing `skip_reason` of `stop_execution` vs. `upstream_failure`).

## 4. No implied rollback

Consistent with `B7_PAUSE_DISABLE_CANCEL.md` §3 and the task brief's own §36 instruction: a `failed` run's already-`succeeded` prior actions are never automatically compensated/undone. `AT-PARTIAL-1` **(NC)**: an implementation that, on run failure, attempts to reverse an earlier `succeeded` action (e.g. deleting the Task action 1 created) — fails; no such compensating step exists anywhere in the closed action catalog, and none is invoked implicitly.

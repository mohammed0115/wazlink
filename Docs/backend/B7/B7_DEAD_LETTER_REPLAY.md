# B7 — Dead Letter and Replay

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Dead-letter record

A `dead_lettered` `AutomationRun` (§`B7_FAILURE_RETRY_MODEL.md` §3) preserves, unmodified: `rule_id`/`rule_revision_id` (the exact definition that ran), every `AutomationActionExecution` row completed or attempted (with full attempt history via each execution's `attempt` counter and the retry timestamps implicit in its state transitions), the specific failed action's `error_classification`/`error_code`, `correlation_id`/`causation_id`, `workspace_id`, and every timestamp already on the row (`B7_DATA_MODEL.md` §3). Nothing is summarized away — this is the same "preserve everything for reconstruction" discipline `B7_OBSERVABILITY_AUDIT.md` §1 states generally.

## 2. Manual replay — resolved (Class A, `B7-D-A031`)

`ReplayAutomationExecution` **creates a new `AutomationRun`** (a fresh `RUN-*` public id) rather than mutating the dead-lettered one — the original stays immutable and inspectable exactly as it dead-lettered (matching `B7_RULE_REVISION_MODEL.md`'s immutability discipline extended to run history). The new run:

- Links to the original via `causation_id = {original_dead_lettered_run.id}`-equivalent metadata (a dedicated `replayed_from_run_id` field, distinct from ordinary causation since a replay is an operator action, not a domain-event causation chain) and shares the original's `correlation_id`.
- Binds to the **same** `rule_revision_id` the original ran against — a replay reproduces history, it does not silently pick up whatever the rule looks like today (consistent with `B7_RULE_REVISION_MODEL.md`'s entire purpose).
- **Resumes from the failed action by default — does not restart from action 0.** Every action the original run already recorded `succeeded` is copied into the new run's `automation_action_executions` as pre-completed (`status='succeeded'`, `target_ref` copied, **no re-invocation**) — this is the Phase-1 default policy and the one the task brief asks be made deterministic (§37): "avoid re-running already-successful side effects unless replay policy explicitly allows it." A distinct `replay_mode='restart'` (re-run every action from 0, deliberately re-attempting already-succeeded steps) is a separate, explicitly-opted-in request parameter, never the default — appropriate only when an operator knows a "succeeded" action's effect was itself since undone out-of-band, which Phase-1 leaves to explicit operator judgment rather than trying to detect automatically.
- Reuses each resumed action's **original** idempotency key when in `resume` mode (§`B7_IDEMPOTENCY_MODEL.md` §4) — so even if `resume` mode's "already succeeded, don't re-invoke" logic somehow failed to short-circuit, the target command's own idempotency guard would still prevent a duplicate side effect as a second line of defense.

## 3. Acceptance proof

`AT-REPLAY-1` **(NC)**: replaying a dead-lettered run whose first two of three actions had already `succeeded` — the replay's action-execution log shows all three actions, but only the third is actually invoked against its target command; the first two are carried forward as historical fact with no new invocation, no duplicate `TSK-*`/`DEAL-*`/`MSG-*` created, and the target domain records exactly one mutation per originally-successful action, not two.

# B7 — Action Execution Model (AutomationRunStep)

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Fields

See `B7_DATA_MODEL.md` §4: action index, action definition (read from the `automation_rule_actions` row at `(revision_id = the parent run's `rule_revision_id`, position = this step's `action_index`)` — not duplicated onto the execution row, since that row is immutable and authoritative), target command, target aggregate reference, idempotency key, status, attempt, `started_at`/`completed_at`, provider/domain result reference (`target_ref`), error code.

## 2. States

**`proposed`, `awaiting_approval`, `approved`, `rejected`, `running`, `completed`, `failed`, `blocked`, `skipped`, `cancelled`.** Near-verbatim reuse of the evidenced frontend vocabulary (FB-A21: `proposed`/`awaiting_approval`/`approved`/`rejected`/`executed`/`failed`/`blocked`), renaming `executed`→`completed` for consistency with the run-level vocabulary and adding `running` (the invocation is in flight — meaningful once invocation is a genuine network/DB round-trip, not a same-tick mock call), `skipped` (this specific action never ran because an earlier action in the same run failed and the run's fixed no-continue-on-failure policy halted the sequence, `B7_AUTOMATION_RULE_AGGREGATE.md` §2), and `cancelled` (the parent run was cancelled while this action was `proposed`/`awaiting_approval`/`running`).

## 3. Legal transitions

```
proposed → awaiting_approval     (safety tier requires it)
proposed → running               (auto_safe, no approval required)
awaiting_approval → approved → running
awaiting_approval → rejected     (terminal)
awaiting_approval → cancelled    (parent run cancelled while pending)
running → completed | failed | blocked
(not yet reached, because an earlier action in the sequence failed) → skipped
running/awaiting_approval → cancelled
```

`blocked` is reached, not `failed`, specifically for a permission/entitlement denial at invocation time (§`B7_FAILURE_RETRY_MODEL.md` §1's `AUTHORIZATION`/`ENTITLEMENT` classes) — distinguishing "the target domain refused this on policy grounds" from "the target domain attempt itself errored," matching the evidenced distinction in the frontend's own status set (FB-A21 already separates `blocked` from `failed`).

## 4. Sequential execution only — resolved (Class A, `B7-D-A021`)

Phase 1 supports **sequential actions only** — no branching, no parallel actions. Justification: zero frontend evidence shows a rule with conditional branching or fan-out (`AutomationModal.tsx`'s form authors exactly one action per rule in the evidenced fixture, and `rule.actionIds` is consumed as an ordered list, never a graph); the task brief's own §21 explicitly prefers "the smallest deterministic Phase-1 model unless frontend/frozen evidence requires more." A revision's `automation_rule_actions` rows are executed strictly in `position` order; a `failed` action halts the run (§`B7_PARTIAL_SUCCESS.md`) rather than branching to an alternative path, and there is no fan-out to multiple actions "in parallel". The one Phase-1 control action, `stop_execution` (`B7_ACTION_CATALOG.md` §5), is likewise just another sequential step — it ends the sequence early rather than branching.

## 5. Per-action idempotency and expected-version

Derivation formulas are in `B7_IDEMPOTENCY_MODEL.md` §2 and `B7_CONCURRENCY_MODEL.md` §5 respectively — this document only fixes that both are properties of the **action execution**, never of the run as a whole, because a run with three actions makes three independent target-command invocations, each needing its own idempotency key and (where applicable) its own freshly-captured `expected_version`.

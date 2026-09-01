# B7 — Re-entrancy Policy

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. The distinction — resolved (Class A, `B7-D-A027`)

**Legitimate downstream causation** is a *different* rule reacting to a *different* event, even when that event was itself produced by a prior automation action — this must remain possible, and `B7_LOOP_PREVENTION.md` §1's same-rule suppression is deliberately scoped to the *same rule*, never to "any rule downstream of automation," precisely so it does not block this case.

**Unsafe recursive re-entry** is the same rule (or a short cycle among a small set of rules) causing itself to fire again, unboundedly.

## 2. Worked example (the task brief's own)

Rule A: trigger `deal_created` → action `create_task`. A human later completes that task. Rule B: trigger `task_completed` → action `send_message`.

`TaskCreated` (produced by Rule A's action) is not itself a trigger in the Phase-1 catalog (`B7_TRIGGER_CATALOG.md` §2 includes it as a *trigger*, but Rule A's action producing it does not cause Rule A to re-admit, because Rule A's own trigger is `deal_created`, not `task_created` — same-rule suppression never even needs to engage here, since Rule A was never a candidate match for the `TaskCreated` event in the first place). The human's `CompleteTask` action produces `TaskCompleted` — a genuinely new, human-caused event, entirely outside B7's own lineage (no `causation_id` traces back to any `AutomationRunStep`, because a human action, not an automation action, produced it). Rule B admits normally, `depth=0`, fresh `correlation_id` — this is not re-entrancy at all, it is an ordinary, independent trigger.

**The harder case:** suppose no human intervenes and some future action type could complete a task automatically. Then `TaskCompleted`'s causation *would* trace back to an `AutomationRunStep`, `depth` would increment, and Rule B would still admit (different `rule_id` from Rule A, same-rule suppression does not fire) — correctly, because Rule A causing Rule B is exactly the "legitimate downstream causation" §1 preserves. Only Rule A causing *Rule A again*, or a short A↔B↔A cycle, is what `B7_LOOP_PREVENTION.md` blocks.

## 3. Policy statement

Loop prevention suppresses **rule recurrence within a lineage**, never **causation depth alone** and never **cross-rule causation** — a chain of N *distinct* rules, each firing at most once per lineage, is always legitimate re-entrancy and is bounded only by `MAX_AUTOMATION_DEPTH`/the execution budget as a safety ceiling (§`B7_LOOP_PREVENTION.md` §1), not treated as suspicious on its own. This is why same-rule suppression, not a blanket "any automation-caused event is ineligible" rule (the mock's own blunt approach, FB-A23), is the correct Phase-1 design — a blanket rule would silently break the exact downstream-task-then-message pattern the product needs to support.

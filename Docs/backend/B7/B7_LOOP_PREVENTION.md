# B7 — Loop Prevention

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Structural algorithm — resolved (Class A, `B7-D-A026`)

Combines lineage, same-rule suppression, depth bound, and execution budget, per the task brief's own explicit instruction not to rely on a depth limit alone. Frontend evidence (FB-A23) confirms the *concept* of a "loop guard" is real product intent; this document designs the actual algorithm, since the mock's blunt always-skip rule is not adopted verbatim.

**Lineage.** Every `AutomationRun` carries `correlation_id` (shared by every run/action descending from one root cause), `causation_id` (the specific upstream `AutomationRunStep.id` that produced the event this run reacted to, if any), `root_run_id`, and `depth` (`B7_DATA_MODEL.md` §3). When an action execution's target-command invocation produces a domain event (e.g. `MoveDealStage` → `DealStageChanged`), B7 stamps that outbound event's causation metadata with `causation_id = {this action_execution.id}` and `correlation_id = {this run.correlation_id}` — this is a property of how B7 invokes commands (an envelope-metadata pass-through argument every governed command already accepts for its own audit trail, not a new cross-domain contract), so that if this event later re-enters B7's own inbox as a *new* trigger, admission (§`B7_TRIGGER_ADMISSION.md` step 8) can recover the full lineage from the event alone.

**Depth bound.** `MAX_AUTOMATION_DEPTH = 5`. `depth` on a root run (no `causation_id`) is 0; a run admitted from an event whose causation traces to another run's action has `depth = {causation run.depth} + 1`. Admission rejects (persisted `status='skipped'`, `error_classification='POLICY'`, reason `depth_exceeded`) if the computed depth would exceed `MAX_AUTOMATION_DEPTH`.

**Same-rule suppression.** Within one `correlation_id` lineage, the *same* `rule_id` may not admit a second run — a rule cannot cause its own re-triggering even through an intermediate chain (`Rule A → event → Rule B → event → Rule A` is blocked at the second `Rule A` admission, not just direct immediate self-loops). This is checked by walking the lineage's `root_run_id` chain (bounded by `MAX_AUTOMATION_DEPTH`, so the walk is always short) for any prior run sharing both `correlation_id` and `rule_id`.

**Execution budget / rate guard.** Independent of depth, no more than 20 runs may share one `correlation_id` within a rolling 5-minute window (`B7_RATE_COST_MODEL.md` §2) — this catches wide fan-out cycles (multiple *different* rules cross-triggering each other) that a per-lineage depth/same-rule check alone would not bound tightly enough, since depth only counts the longest chain, not total breadth.

Any one of the three checks failing blocks admission; none is sufficient alone (a depth bound alone cannot catch a two-rule ping-pong that never exceeds depth 5 within one rolling window if each hop is fast — the same-rule suppression closes exactly that gap; the same-rule suppression alone cannot catch a *three*-or-more-rule cycle that never repeats the same rule twice before the budget catches it — the execution budget closes that gap).

## 2. Detection worked through the task brief's named cases

| Case | Caught by |
|---|---|
| Self-loop (`LeadUpdated → automation updates Lead → LeadUpdated → same rule fires`) | Same-rule suppression — the second admission attempt for the identical `rule_id` within the lineage is rejected at depth 1 |
| Two-rule cycle (`Rule A → Rule B → Rule A → Rule B → ...`) | Same-rule suppression catches it by depth 2 (Rule A reappears) — well inside `MAX_AUTOMATION_DEPTH` |
| Multi-rule cycle (three or more distinct rules, each appearing once per cycle) | Depth bound (`MAX_AUTOMATION_DEPTH=5`) catches any cycle longer than 5 hops; execution budget catches a *short* multi-rule cycle spinning fast within the 5-minute window even if no single rule repeats within 5 hops |
| Message-response loop (automation sends a message, a webhook-driven reply re-triggers automation) | Same mechanism — an inbound-message-triggered rule that itself causes `send_message` is lineage-tracked identically; Phase-1 has no inbound-message trigger at all (`B7_TRIGGER_CATALOG.md` §3), so this specific case cannot occur yet, but the algorithm generalizes without modification if it is added later |
| Deal-stage ping-pong (Rule A moves to Stage X, Rule B reacts by moving back to Stage Y) | Same-rule suppression stops each rule from re-firing itself; a genuine A↔B alternation is caught by the execution budget once it exceeds 20 hops in 5 minutes, and by the depth bound once it exceeds 5 |

## 3. Structural (design-time) check vs. runtime lineage

`B7_AUTOMATION_RULE_AGGREGATE.md` §4 additionally rejects, at `Create`/`Update`/`Activate` time, a rule whose own trigger type exactly matches an event its own action list could directly and unconditionally produce (e.g. a rule triggered by `task_completed` whose only action is `create_task` with no distinguishing condition) — this is a best-effort author-time hint, not a substitute for §1's runtime lineage tracking, which remains the actual safety net for every case a static check cannot see (chains through other rules, conditional actions, cross-domain hops).

`AT-LOOP-1` **(NC)**: same rule cannot recursively trigger itself without bound — proven by same-rule suppression at depth 1 (§1-2). `AT-LOOP-2` **(NC)**: a two-rule cycle is bounded — proven at depth 2 (§2).

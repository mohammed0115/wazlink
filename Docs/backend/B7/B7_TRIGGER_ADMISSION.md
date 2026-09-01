# B7 — Trigger Admission Sequence

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Exact sequence — resolved (Class A, `B7-D-A011`)

1. **Receive event** from the Celery dispatcher (`B7_EVENT_CONSUMPTION_MODEL.md` §1).
2. **Verify envelope/schema** — `event_id`, `workspace_id`, `event_type`, `schema_version` present and well-formed; malformed envelopes are logged and dropped (not retried — a malformed envelope is a producer bug, not a transient failure, `B7_FAILURE_RETRY_MODEL.md` §1 classifies this `VALIDATION`, non-retryable).
3. **Derive workspace** from the trusted envelope field only (§`B7_EVENT_CONSUMPTION_MODEL.md` §2) — never from payload content.
4. **Inbox dedup** — insert `automation_inbox_records`; conflict means already-processed, acknowledge and stop (§`B7_EVENT_CONSUMPTION_MODEL.md` §4 step 2).
5. **Locate active matching rules** — `automation_rules` where `workspace_id` matches, `status='active'`, and the active revision's single `automation_rule_triggers.trigger_type` row (`B7_DATA_MODEL.md` §2a) equals this `event_type`.
6. **Entitlement check** — the workspace's `automation.rules` capability must currently be granted (§`B7_ENTITLEMENT_RBAC_TENANCY.md` §4). A workspace that loses entitlement mid-flight admits **no new runs** from this point forward, but §5's already-located rule list for *this* event is still evaluated against the entitlement snapshot taken *now* — if entitlement is absent, every matching rule for this event is skipped with `error_classification='ENTITLEMENT'`, not silently dropped (still auditable).
6b. **Quota reservation** — for each rule that will produce a run, reserve one `automationRuns` unit against the workspace's `usage_counters` row, transactionally, inside this same admission transaction (§`B7_ENTITLEMENT_RBAC_TENANCY.md` §4.1, reusing frozen `B1_FAILURE_SCENARIOS.md` F16's mechanism unmodified). If the metric is exhausted, that rule admits no run: a `skipped` run is persisted with `error_classification='ENTITLEMENT'`, `error_code='QUOTA_EXHAUSTED'` and `metric='automationRuns'` in `failure_reason`, so exhaustion is auditable rather than invisible.
7. **Rule revision snapshot** — for each matching rule, resolve `active_revision_id` to its immutable `automation_rule_revisions` row (this is the exact revision the run will bind to, §`B7_RULE_REVISION_MODEL.md`).
8. **Loop/safety check** — derive `correlation_id`/`causation_id`/`root_run_id`/`depth` from the triggering event's own causation metadata, if the event itself originated from a prior B7 action (§`B7_LOOP_PREVENTION.md` §2); reject admission for this rule (persisted as `status='skipped'`, `error_classification='POLICY'`, reason `loop_prevention`) if depth/budget bounds are already exceeded.
9. **Condition evaluation** (§`B7_CONDITION_ENGINE.md`) — synchronous; produces `matched_conditions` + `condition_snapshot`.
10. **Persist the run at the frozen initial state** — insert one `automation_runs` row per matching rule at **`status='created'`** with `created_at = now()` (the frozen initial state, `BACKEND_STATE_MACHINES.md`), in the same transaction as steps 4-9 (§`B7_EVENT_CONSUMPTION_MODEL.md` §4). No run is ever inserted directly at `queued`. Each insert is guarded by `uq_automation_runs_event_rule` — `(workspace_id, rule_id, source_event_id)` partial-unique, **carrying no revision component** (`B7_DATA_MODEL.md` §3, `B7_IDEMPOTENCY_MODEL.md` §1.1). This is the second, business-level dedup layer; the step-4 inbox record is the first, and neither substitutes for the other (`B7_IDEMPOTENCY_MODEL.md` §4a). A constraint violation here means this event has already executed this rule: the transaction is rolled back for that rule — releasing its step-6b quota reservation with it — and admission continues for the remaining rules.
11. **Advance the run through the state machine, in this same transaction** (`B7_EXECUTION_MODEL.md` §3): `created → evaluating`, then exactly one of —
    - `evaluating → skipped` (terminal) if conditions did not match (`skip_reason='conditions_not_matched'`), step 8's loop bounds were exceeded (`skip_reason='loop_prevention_blocked'`), or step 6b's `automationRuns` reservation failed (`skip_reason='quota_exhausted'`) — the three closed Phase-1 skip reasons (`B7_DATA_MODEL.md` §3), each emitting `AutomationRunSkipped` (`B7_COMMAND_EVENT_CATALOG.md` §2);
    - `evaluating → awaiting_approval` if any planned action's **effective** safety tier is `approval_required` (the catalog tier, or the rule's own stricter `execution_policy` — §`B7_ACTION_AUTHORIZATION.md` §2). This is the structural form of frozen *"sensitive actions cannot skip approval"*: such a run reaches `queued` only through an `ApproveAutomationRun` decision;
    - `evaluating → queued` otherwise.
12. **Enqueue processing** — after commit, dispatch one Celery task per run that reached `queued`. A run left in `awaiting_approval` is not enqueued; its approval decision enqueues it.
13. **Acknowledge event** — return success to the dispatcher only after commit (step 11); a crash before commit leaves nothing durable and the event is safely redelivered (dedup absorbs it, per step 4 on redelivery).

This sequence is identical in shape to the task brief's own §12 example structure, with steps 8-10 reordered slightly (loop check before condition evaluation, since a loop-blocked rule should not pay the cost of full condition evaluation, and both happen before the row is persisted so a single transaction covers all of §4-11).

## 2. Transaction boundary

One transaction covers steps 4 through 11, including the step-6b quota reservation (§`B7_EVENT_CONSUMPTION_MODEL.md` §4) — the same guarantee against "event consumed but execution lost" applies here; this document is that section's per-rule elaboration, not a competing design.

## 3. Multiple matching rules

Steps 5-11 iterate every matching `active` rule independently — one `automation_runs` row per rule, all within the same admission transaction. One rule's condition-evaluation failure (an unexpected error reading a `current.*` field, not a business "no match") does not prevent other matching rules from being evaluated; it is caught per-rule, that rule's run is persisted `status='failed'`, `error_classification` set, and the transaction continues for the remaining rules — a single misbehaving rule cannot black-hole every other rule's admission for the same event.

# B7 — Idempotency Model

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Run-level idempotency — evidenced formula, refined

Frontend evidence (FB-D17) already derives exactly this shape: `automationIdempotencyKey(rule, triggerEvent, actionId) = \`${rule.id}:${rule.version}:${triggerEvent.eventId}:${actionId}\`` (`data.js:926`). B7 adopts the same *structure* but splits it correctly across two levels the mock's single-action fixture never needed to distinguish:

**Run idempotency key:** `{rule_id}:{rule_revision_id}:{source_event_id}` (or, for `trigger_source='manual'`, `{rule_id}:{rule_revision_id}:{triggered_by}:{request_idempotency_key}`, since there is no `source_event_id` to anchor on). Unique per `(workspace_id, idempotency_key)` on `automation_runs` (`B7_DATA_MODEL.md` §3). This governs "does this exact (rule revision, triggering event) pair already have a run" — matching FB-D18's evidenced dedup-to-existing-run behavior exactly.

Using `rule_revision_id` rather than bare `rule.version` (the mock's field) is the one deliberate refinement: it guarantees the key is stable even across the exact edge case `B7_RULE_REVISION_MODEL.md` exists to prevent — a rule edited between an event's production and its admission must not silently bind the redelivered event to a *different* revision than the first attempt did, which a bare integer `version` re-read at redelivery time could not guarantee as cleanly as a fixed revision id can.

## 2. Action idempotency key — resolved (Class A, `B7-D-A023`)

`{run_id}:{action_index}:{attempt_generation}`, where `attempt_generation` is **not** the raw retry `attempt` counter (§3) but a stable identity for "this logical attempt" — concretely, the tuple collapses to `{run_id}:{action_index}` alone, because a retry of the *same* logical action must reuse the *identical* key on every attempt (task brief §24's explicit instruction: "Do not use random idempotency keys on every retry"). The target command's own `Idempotency-Key` header/field is populated with this exact value on every invocation attempt, so B2/B5/B6's own idempotency machinery (`B6_CONCURRENCY_IDEMPOTENCY.md` §3's frozen doctrine, reused unmodified) recognizes attempt 2 of the same action as a replay of attempt 1, not a new command.

## 3. Same-key/different-payload conflict — resolved (Class A, `B7-D-A024`)

Cannot occur through B7's own retry path by construction: an action's payload is derived once, at the moment the action first becomes `running`, from the immutable rule revision plus the immutable `condition_snapshot` (`B7_CONDITION_SNAPSHOT_SEMANTICS.md` §4) — every retry of that same action re-sends the identical payload, because both of its inputs are frozen. If the target domain's own `409 IDEMPOTENCY_CONFLICT` (frozen general error code, `B6_CONCURRENCY_IDEMPOTENCY.md` §3) is ever returned anyway, B7 treats it as a `CONCURRENCY`-class failure (§`B7_FAILURE_RETRY_MODEL.md` §1) and does not retry blindly — a same-key/different-payload conflict from the target's perspective means B7's own payload derivation broke its own frozen-input guarantee, which is a bug to surface (alert), not a condition to paper over with a fresh key.

## 4. Manual replay identity

`B7_DEAD_LETTER_REPLAY.md` §2 — a replay creates a **new** `AutomationRun` with its own new run-level idempotency key (distinct `source_event_id`-equivalent: the original run's `RUN-*` plus a replay sequence number), while each replayed action execution reuses the *original* action's idempotency key only if replay policy says "skip already-succeeded actions" (the default) — never re-deriving a fresh key for an action already known to have succeeded, which is exactly how replay avoids duplicating a completed side effect.

## 5. Duplicate source event cannot duplicate logical execution — acceptance proof

`AT-IDEM-B7-1` **(NC)**: the same domain event redelivered twice (identical `event_id`) — first delivery admits a run (or persists a `skipped` run); second delivery's inbox-record insert (`B7_EVENT_CONSUMPTION_MODEL.md` §4 step 2) hits the unique constraint, acknowledges, and creates nothing — zero duplicate `automation_runs` rows for the same `(workspace_id, rule_id, source_event_id)`.

`AT-IDEM-B7-2` **(NC)**: a `running` action's Celery task crashes after invoking `MoveDealStage` successfully but before persisting `succeeded`, and the worker's retry re-invokes the same action — the retry reuses the identical action idempotency key (§2), so B6's own `Idempotency-Key` dedup returns the *stored* terminal response from the first invocation rather than moving the deal a second time; B7 then persists `succeeded` from that replayed response. No duplicate `DealStageChanged` event, no duplicate `deal_stage_transitions` row.

# B7 — Idempotency Model

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Run-level idempotency — resolved (Class A, `B7-D-A040`)

Frontend evidence (FB-A22) already derives exactly this shape: `automationIdempotencyKey(rule, triggerEvent, actionId) = \`${rule.id}:${rule.version}:${triggerEvent.eventId}:${actionId}\`` (`data.js:926`). B7 adopts the same *structure* but splits it correctly across two levels the mock's single-action fixture never needed to distinguish:

### 1.1 The logical identity

**The dedup identity of an event-triggered rule run is `(workspace_id, rule_id, source_event_id)`.** One source event admits **at most one** logical execution of a given `AutomationRule` in a workspace — full stop.

**The bound revision is execution provenance, not identity.** `rule_revision_id` records *which immutable definition this run executed against* (`B7_RULE_REVISION_MODEL.md` §2) and stays on the run row forever. It is deliberately **excluded** from the dedup identity, because including it would mean that activating a new revision between two deliveries of the *same* event lets that event execute the *same* rule twice — precisely the duplicate the constraint exists to prevent. An earlier draft of this section carried `rule_revision_id` inside the key and argued the opposite outcome in its own prose; the identity below is the resolved one, and `B7-D-A040` records the decision rather than leaving it inferable from a formula.

### 1.2 Canonical key derivations

| `trigger_source` | Run idempotency key | Logical identity it enforces |
|---|---|---|
| `event` | `automation-run:event:{workspace_id}:{rule_id}:{source_event_id}` | one run per (workspace, rule, source event) — **no revision component** |
| `manual` | `automation-run:manual:{workspace_id}:{rule_id}:{triggered_by}:{request_idempotency_key}` | one run per submitted `RunAutomationNow` request; a retried submission replays rather than re-executing |
| `recommendation` | `automation-run:recommendation:{workspace_id}:{triggered_by}:{request_idempotency_key}` | one run per accepted recommendation submission; `rule_id` is null on this path (`B7_EXECUTION_MODEL.md` §4), so it cannot appear in the key |

All three are stored in `automation_runs.idempotency_key` under the unique `(workspace_id, idempotency_key)` constraint (`B7_DATA_MODEL.md` §3). The `automation-run:{trigger_source}:` discriminator prefix is what keeps the three namespaces from ever colliding: **a manual run can never collide with an event run**, even for the same rule, because their keys begin with different literals and carry different operands.

For the `event` path this key is a serialization of §1.1's identity and nothing more. Its exact encoding is secondary; the invariant is not:

> same workspace + same rule + same source event = same logical run, regardless of any revision change between deliveries.

### 1.3 The database-level invariant

The idempotency-key constraint is a general guard over all three paths. The `event` path additionally carries its **own** partial unique constraint, stated directly over the semantic columns rather than over a derived string — `B7_DATA_MODEL.md` §3's `uq_automation_runs_event_rule`. This is the constraint frozen `BACKEND_DATA_MODEL.md` row 21's *"event/rule/action idempotency unique"* names on the event/rule half, and it is now declared in the schema rather than merely cited. Two constraints, not one, is deliberate defence in depth: a defect in key derivation cannot produce a duplicate logical run, because the semantic constraint does not depend on the derivation being correct.

### 1.4 Why the mock's `rule.version` component is dropped, not translated

FB-A22's fixture key carries `rule.version`. B7 drops that component rather than translating it to `rule_revision_id`, for the reason §1.1 gives: a version/revision component makes the identity *weaker* under exactly the condition it looks like it strengthens. The mock never distinguished the two, because its rules were never edited between two deliveries of one event. `AT-IDEM-4` **(NC)** holds the corrected semantics.

## 2. Action idempotency key — resolved (Class A, `B7-D-A023`)

`{run_id}:{action_index}:{attempt_generation}`, where `attempt_generation` is **not** the raw retry `attempt` counter (§3) but a stable identity for "this logical attempt" — concretely, the tuple collapses to `{run_id}:{action_index}` alone, because a retry of the *same* logical action must reuse the *identical* key on every attempt (task brief §24's explicit instruction: "Do not use random idempotency keys on every retry"). The target command's own `Idempotency-Key` header/field is populated with this exact value on every invocation attempt, so B2/B5/B6's own idempotency machinery (`B6_CONCURRENCY_IDEMPOTENCY.md` §3's frozen doctrine, reused unmodified) recognizes attempt 2 of the same action as a replay of attempt 1, not a new command.

## 3. Same-key/different-payload conflict — resolved (Class A, `B7-D-A024`)

Cannot occur through B7's own retry path by construction: an action's payload is derived once, at the moment the action first becomes `running`, from the immutable rule revision plus the immutable `condition_snapshot` (`B7_CONDITION_SNAPSHOT_SEMANTICS.md` §4) — every retry of that same action re-sends the identical payload, because both of its inputs are frozen. If the target domain's own `409 IDEMPOTENCY_CONFLICT` (frozen general error code, `B6_CONCURRENCY_IDEMPOTENCY.md` §3) is ever returned anyway, B7 treats it as a `CONCURRENCY`-class failure (§`B7_FAILURE_RETRY_MODEL.md` §1) and does not retry blindly — a same-key/different-payload conflict from the target's perspective means B7's own payload derivation broke its own frozen-input guarantee, which is a bug to surface (alert), not a condition to paper over with a fresh key.

## 4. Manual replay identity

`B7_DEAD_LETTER_REPLAY.md` §2 — a replay creates a **new** `AutomationRun` whose key is `automation-run:replay:{workspace_id}:{source_run_public_id}:{replay_sequence_number}`. A replay run carries `trigger_source` unchanged from its source run but sets `replayed_from_run_id`, and it is **not** subject to §1.3's event/rule partial unique constraint, which is scoped to `replayed_from_run_id IS NULL` for exactly this reason: a replay is a deliberate operator re-execution of a known-dead-lettered run, not a second admission of the source event.

Each replayed action execution reuses the *original* action's idempotency key when replay policy says "skip already-succeeded actions" (the default) — never re-deriving a fresh key for an action already known to have succeeded, which is exactly how replay avoids duplicating a completed side effect.

## 4a. Two independent dedup layers, and why neither is sufficient alone

Duplicate protection is layered. The layers guard different things and neither subsumes the other:

| Layer | Constraint | What it protects | What it does **not** protect |
|---|---|---|---|
| **1 — delivery** | `automation_inbox_records` unique `(workspace_id, source_event_id)` (`B7_DATA_MODEL.md` §6) | *event consumption*: one delivery of one `event_id` is processed once, whatever set of rules it matches | nothing about rule-execution identity — it is keyed on the event alone, and knows nothing about which rules the event admitted |
| **2 — execution** | `automation_runs` partial unique `(workspace_id, rule_id, source_event_id)` — §1.3, `B7_DATA_MODEL.md` §3 | *business identity*: one source event executes one rule at most once, permanently, independent of delivery mechanics | nothing about the event being consumed twice — a second consumption is stopped earlier, by layer 1 |

**B7 does not rely on inbox dedup alone.** Layer 1 is a transport-level guard on a table whose rows are explicitly prunable on a short window (`B7-D-B012`, `B7_RETENTION_DELETION.md` §1); layer 2 is a durable business invariant on a row retained for the full audit window. If a pruned inbox record, a reconciliation sweep, an operator-driven outbox replay of the producing domain, or an admission-code defect ever lets the same `event_id` reach admission a second time, layer 2 is what still refuses the duplicate run. A redelivery — absorbed at either layer — therefore **cannot** create a second run, **cannot** reserve a second `automationRuns` unit (the reservation shares the admission transaction and rolls back with the rejected insert, `B7_ENTITLEMENT_RBAC_TENANCY.md` §4.1), and **cannot** invoke any action a second time (actions are only ever invoked from a committed run row).

`AT-DEDUP-5` **(NC)** proves layer 2 standing alone, with layer 1 bypassed.

## 5. Duplicate source event cannot duplicate logical execution — acceptance proof

`AT-IDEM-1` / `AT-DEDUP-1` **(NC)**: the same domain event redelivered twice (identical `event_id`) — first delivery admits a run (or persists a `skipped` run); second delivery's inbox-record insert (`B7_EVENT_CONSUMPTION_MODEL.md` §4 step 2) hits the unique constraint, acknowledges, and creates nothing — zero duplicate `automation_runs` rows for the same `(workspace_id, rule_id, source_event_id)`.

`AT-IDEM-4` **(NC)**: the rule is edited and a new revision activated *between* the first delivery and a redelivery of the same `event_id` — still exactly one run, still one `automationRuns` unit, still one set of action invocations; an implementation whose run key or unique constraint includes `rule_revision_id` (and therefore admits a second run bound to the new revision) fails (§1.1).

`AT-IDEM-2` **(NC)**: a `running` action's Celery task crashes after invoking `MoveDealStage` successfully but before persisting `completed`, and the worker's retry re-invokes the same action — the retry reuses the identical action idempotency key (§2), so B6's own `Idempotency-Key` dedup returns the *stored* terminal response from the first invocation rather than moving the deal a second time; B7 then persists `completed` from that replayed response. No duplicate `DealStageChanged` event, no duplicate `deal_stage_transitions` row.

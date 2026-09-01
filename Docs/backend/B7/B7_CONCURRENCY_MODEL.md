# B7 — Concurrency Model

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Same rule triggered concurrently

Two events matching the same rule at nearly the same instant produce two independent `automation_runs` rows (different `source_event_id`s → different idempotency keys, §`B7_IDEMPOTENCY_MODEL.md` §1) — this is correct, not a race to prevent: two different Leads both becoming `status=qualified` should genuinely produce two separate runs. Concurrency control is scoped to **same rule, same target entity** (§2), never "same rule" alone.

## 2. Same rule, same target entity, concurrently

`B7_AUTOMATION_RULE_AGGREGATE.md` §2's fixed concurrency policy: an advisory lock keyed `(workspace_id, rule_id, trigger_entity_ref)` is held for the duration of a run's action phase (from first action `running` to the run's terminal state). A second run for the same rule against the same entity that would otherwise start its action phase while the lock is held instead waits for the lock (bounded — §4) rather than executing concurrently, preventing two runs from racing to invoke conflicting mutations against the same Lead/Deal.

## 3. Rule edited / paused / disabled while a run is in flight

Resolved identically to `B7_RULE_LIFECYCLE.md` §3: a `running`/`waiting`/`awaiting_approval` run is unaffected — it keeps executing against the `rule_revision_id` it already captured (`B7_RULE_REVISION_MODEL.md`), regardless of what the live rule row now says. Only *new* trigger admission observes the rule's current `status`/`active_revision_id`.

## 4. Two scheduled wakeups / duplicate domain events

Both dedup structurally, not by locking: a wakeup's `dedup_key = (run_id, action_index)` unique constraint (`B7_DATA_MODEL.md` §7) makes a duplicate wakeup delivery a no-op; a duplicate domain event dedups via `B7_EVENT_CONSUMPTION_MODEL.md` §3-4's inbox unique constraint. Neither needs a lock because both are idempotent-by-insert.

## 5. Expected-version strategy — resolved (Class A, `B7-D-A025`, task brief §26)

**Read authoritative target → capture version → invoke command with `expected_version` → on conflict, classify and stop; never blindly retry a stale business action.**

Precisely: immediately before an action transitions from `approved`/`proposed` into `running`, B7 issues a synchronous read of the target aggregate (the same read `B7_CONDITION_SNAPSHOT_SEMANTICS.md` §2's `current.*` conditions use) and captures its `version` into `automation_action_executions.expected_version`. The target command is invoked with that version as `If-Match`. On `409 STALE_VERSION`:

- The action is classified `CONCURRENCY` (§`B7_FAILURE_RETRY_MODEL.md` §1).
- **B7 does not automatically re-read-and-retry the same mutation against the new state.** The worked example the task brief names — automation intends to move a Deal to Stage B, but a human already moved it to Stage C — is resolved by treating the human's change as authoritative and final: the action transitions `failed` (not retried), with `error_code='target_state_changed'`, and the run proceeds per `B7_PARTIAL_SUCCESS.md`'s ordinary halt-on-failure behavior.
- A bounded re-evaluation is permitted **only** as a distinct, explicit future capability (deferred Class B) — Phase-1 has no rule-level "re-evaluate conditions and retry on conflict" policy. This is the conservative, evidence-consistent choice: nothing in the frontend or any frozen document shows product intent for automation to silently out-compete a human's own concurrent decision, and the task brief itself frames this exact scenario as something to actively avoid, not merely to handle gracefully.

## 6. Target-domain version semantics are never bypassed

`AT-CONC-B7-1` **(NC)**: an implementation retrying a stale-version action by simply re-reading the new version and re-submitting the identical mutation without re-evaluating whether that mutation is still the right one — fails; §5 requires the action to fail and the run to halt, never a silent overwrite of intervening state.

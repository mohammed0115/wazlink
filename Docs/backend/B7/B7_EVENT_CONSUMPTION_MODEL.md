# B7 — Event Consumption Model

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Pipeline

`domain event → transactional outbox (producing domain, frozen ADR-005) → dispatcher → Celery → B7 inbox consumer → automation_inbox_records dedup → trigger matching → run admission`.

This preserves frozen B0 doctrine exactly: `BACKEND_ARCHITECTURE_DECISIONS.md` ADR-005 — "Transactional domain changes and an `OutboxEvent` commit in one transaction. A dispatcher publishes internal work to Celery." B7 adds nothing to the producing side; it is purely a consumer, symmetric with how Analytics/Notifications/Entitlements already consume the same domain events per B2's own consumer-list column (`B2_COMMAND_EVENT_CATALOG.md` §2).

## 2. Envelope fields B7 relies on

| Field | Use |
|---|---|
| `event_id` | dedup key (`automation_inbox_records.source_event_id`) |
| `workspace_id` | trusted, taken from the envelope — never re-derived from event payload content (mirrors `B6_API_DTO_CONTRACTS.md` Doctrine R-1's workspace-trust discipline) |
| `event_type` | matched against the closed catalog (`B7_TRIGGER_CATALOG.md` §2) — an unrecognized `event_type` is acknowledged and dropped, not queued (§4) |
| `schema_version` | events with a `schema_version` newer than what B7's admission code understands are acknowledged and dropped with an observability counter increment (`schema_version_unknown`), never crash the consumer |
| `aggregate_ref` | becomes `AutomationRun.trigger_entity_ref` |
| `occurred_at` | the producing domain's commit time — used for ordering assumptions (§5), not treated as B7's own `received_at` |
| `received_at` | B7's own consumption timestamp, for queue-latency observability |

## 3. Dedup

Unique constraint `(workspace_id, source_event_id)` on `automation_inbox_records` (`B7_DATA_MODEL.md` §6). The consumer inserts this row **before** evaluating any rule, inside the same transaction as reading active rules for that trigger type — a unique-constraint violation on insert means "already processed," and the consumer acknowledges the event and returns without re-evaluating (§4 resolves the transaction boundary precisely).

## 4. Transaction boundary — resolved (Class A, `B7-D-A009`)

Per task brief §12's explicit "prevent event consumed but execution lost" requirement:

1. Begin transaction.
2. Insert `automation_inbox_records` row (unique constraint is the dedup gate). On conflict: commit nothing new, acknowledge the source event, return.
3. Query `automation_rules` for `status='active'` rows matching this trigger type in this workspace, `FOR SHARE` (read-only — no lock contention with concurrent rule edits, which go through the rule's own `version` check independently).
4. For each matching rule: evaluate conditions synchronously against the event payload plus any required `current.*` reads (§`B7_CONDITION_SNAPSHOT_SEMANTICS.md`).
4b. For each rule that matched: reserve one `automationRuns` unit on the workspace's `usage_counters` row (§`B7_ENTITLEMENT_RBAC_TENANCY.md` §4.1) — inside this transaction, so it rolls back with everything else and one logical run can never consume two units.
4c. Insert one `automation_runs` row per matching rule at `status='created'`, under `uq_automation_runs_event_rule` — `(workspace_id, rule_id, source_event_id)` partial-unique, with **no revision component** (`B7_DATA_MODEL.md` §3, `B7_IDEMPOTENCY_MODEL.md` §1.1). Then advance it through the state machine within this transaction (`B7_EXECUTION_MODEL.md` §3): to `skipped` with its `skip_reason` if conditions did not match, loop bounds were exceeded, or the `automationRuns` reservation failed; otherwise to `awaiting_approval` if any planned action's effective safety tier requires approval, else to `queued`. A `skipped` run is still persisted and still emits `AutomationRunSkipped`, for the audit trail evidenced at FB-A42/FB-A23, never silently discarded.
5. Update `automation_inbox_records.admitted_run_ids`.
6. Commit.
7. Only after commit: enqueue a Celery task per admitted `queued` run, to begin evaluation/execution asynchronously.

Because steps 2-6 are one transaction, "event consumed but execution lost" cannot happen: either the whole admission (inbox record + zero-or-more run rows) commits together, or none of it does and the source event redelivers safely (idempotent — step 2's unique constraint makes a redelivery after a crash between commit and enqueue merely re-detect "already processed" and skip straight to re-enqueuing any `queued` runs that never got their Celery task dispatched, via a periodic reconciliation sweep matching `BACKEND_RETRY_POLICY.md`'s general "workers must use timeouts, heartbeats" discipline).

## 5. Tolerances — resolved (Class A, `B7-D-A010`)

Automation **does not** rely on exactly-once delivery, ordering, or freshness:

- **Duplicate events:** the unique `(workspace_id, source_event_id)` constraint on `automation_inbox_records` makes redelivery a safe no-op (§3-4), and `uq_automation_runs_event_rule` independently guarantees the business invariant even if that first layer is ever bypassed (`B7_IDEMPOTENCY_MODEL.md` §4a). A redelivery creates no second run, reserves no second `automationRuns` unit, and invokes no action a second time.
- **Late events:** admission has no freshness window in Phase 1 — an event delivered an hour late still admits a run if a matching `active` rule exists at admission time; this is deliberately simple (no "stale trigger" rejection) and is revisited only if a concrete abuse/correctness case emerges (deferred Class B).
- **Out-of-order events:** condition evaluation uses `event.*` (the payload as delivered) plus, where a condition names `current.*`, a synchronous read of the live aggregate at evaluation time (§`B7_CONDITION_SNAPSHOT_SEMANTICS.md` §2) — an out-of-order `LeadStatusChanged` evaluated after a later status change has already landed simply sees the *current* live status for any `current.*` condition, and its own stale `event.from`/`event.to` for any `event.*` condition; this is the same non-guarantee every other domain's own read models already accept (`B2_LEAD360_READ_MODEL.md`'s eventual-consistency posture).
- **Replayed events** (an operator manually replays a producing domain's outbox for recovery): identical to duplicate events — the dedup constraints absorb it. This is the case where layer 2 matters most, since a replay long after the fact may arrive once the inbox record has been pruned (`AT-DEDUP-5` **NC**).

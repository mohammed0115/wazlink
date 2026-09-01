# B7 — Observability and Audit

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Audit model

Every meaningful change is reconstructable from durable rows alone, matching the exact trail already evidenced at FB-A42: rule created/edited (revision history, `B7_RULE_REVISION_MODEL.md`), revision activated/superseded, paused/disabled/archived (`AutomationRule*` events), execution admitted (`AutomationRunCreated` + `automation_inbox_records`), trigger source (`source_event_id`, `trigger_entity_ref`), condition result (`condition_snapshot`), action planned (the action-execution row's initial `proposed` state), action invoked (`running` transition + `action_idempotency_key`), action result (`completed`/`failed`/`blocked` + `target_ref`/`error_code`), retry (`attempt` counter, each attempt's timestamp implicit in state history), failure (`error_classification`/`failure_reason`), dead letter (`B7_DEAD_LETTER_REPLAY.md` §1), cancel (`AutomationRunCancelled`), replay (`replayed_from_run_id` linkage). Every row carries `workspace_id`, actor (where applicable — `created_by`/`decided_by`/`triggered_by`), `rule_id`/`rule_revision_id`, `run_id`, `source_event_id`, `correlation_id`/`causation_id`, and timestamps (`B7_DATA_MODEL.md`).

**Never logged:** provider credentials, raw message body content beyond what the target domain's own audit already governs (B7's audit references `target_ref` — an opaque public ID — never the message body itself, which is B5's own `BACKEND_PRIVACY_AND_DATA_HANDLING.md`-governed data class), or any secret (this is §1's never-logged rule, referenced from `B7_SECURITY_THREAT_MODEL.md`). B7's audit rows are metadata about *that a mutation happened and why*, never a second copy of the mutated content.

## 2. Metrics — workspace-safe dimensions

| Metric | Dimensions | Notes |
|---|---|---|
| `trigger_events_received` | `workspace_id`, `event_type` | counter |
| `trigger_events_deduped` | `workspace_id`, `event_type` | counter — duplicate/redelivered events absorbed |
| `executions_created` | `workspace_id`, `rule_id` | counter — high-cardinality-safe: `rule_id` is workspace-scoped and bounded by the workspace's own quota (`B7_ENTITLEMENT_RBAC_TENANCY.md` §4), never an unbounded external identifier |
| `executions_succeeded` / `executions_failed` / `executions_dead_lettered` | `workspace_id`, `rule_id`, `error_classification` (failed/dead-lettered only) | counters |
| `actions_invoked` / `actions_failed` | `workspace_id`, `action_type` | counters — `action_type` is a closed catalog value (`B7_ACTION_CATALOG.md` §2), never high-cardinality |
| `retry_count` | `workspace_id`, `error_classification` | counter |
| `loop_prevention_blocks` | `workspace_id`, `rule_id`, `block_reason` (`depth_exceeded`\|`same_rule`\|`budget_exceeded`) | counter — `B7_LOOP_PREVENTION.md` §1 |
| `executions_skipped` | `workspace_id`, `rule_id`, `skip_reason` (`conditions_not_matched`\|`quota_exhausted`\|`loop_prevention_blocked`) | counter — the closed Phase-1 skip-reason set (`B7_DATA_MODEL.md` §3); pairs with the `AutomationRunSkipped` event (`B7-D-A041`) |
| `execution_duration` | `workspace_id` | histogram, `created_at`→`completed_at` — total wall-clock life of a run, including any approval wait |
| `evaluation_latency` | `workspace_id` | histogram, `created_at`→`evaluated_at` — how long condition evaluation took. Measured separately from queue latency, because the two answer different questions and occur in that order |
| `queue_latency` | `workspace_id` | histogram, **`queued_at`→`started_at`** — how long a `queued` run waited for a worker. It is not `created_at`→anything: a run's time in `created`/`evaluating` is `evaluation_latency`, and an approval wait is `approval_wait_duration`, so neither inflates this figure |
| `approval_wait_duration` | `workspace_id` | histogram, `awaiting_approval`-transition→decision timestamp — how long sensitive runs sit unapproved |

No metric label carries a raw `RUN-*`/`AUTO-*` public ID or any free-text field (rule name, failure reason) — those live in logs/traces, keyed by `correlation_id`, per the task brief's own instruction to keep IDs out of metric labels and use correlation IDs in logs/traces instead.

## 3. Traces

Every admission-through-terminal-state path for one run is traceable end-to-end via `correlation_id` (shared across the whole lineage, including any re-entrant downstream runs, `B7_LOOP_PREVENTION.md` §1) and `causation_id` (parent-child edges within that lineage) — a single trace query reconstructs "what happened, in what order, caused by what" without joining across workspaces or leaking cross-tenant data (`correlation_id` values are never reused across workspaces, since a run's lineage never crosses a workspace boundary by construction, `B7_ENTITLEMENT_RBAC_TENANCY.md` §3).

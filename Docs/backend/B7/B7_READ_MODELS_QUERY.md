# B7 — Read Models / Query

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Automation list

Backing `GET /automation/rules`: `public_id, name, status, trigger_type, execution_policy, last_triggered_at, last_run_status, active_rule_count_towards_quota`. `last_triggered_at`/`last_run_status` are derived from the most recent `automation_runs` row for the rule — a read-time join/subquery, never a denormalized column the write path must keep in sync (avoiding the dual-write consistency risk that pattern would introduce).

## 2. Rule detail

`GET /automation/rules/{id}`: the full `AutomationRule` DTO (`B7_API_DTO_CONTRACTS.md` §2) plus the active revision's trigger/conditions/actions, plus summary counters: `execution_count`, `success_count`, `failure_count`, `last_triggered_at`, `last_success_at`, `last_failure_at` — all read-time aggregates over `automation_runs`, matching the metric cards evidenced at FB-D20.

## 3. Execution list / detail / action history

`GET /automation/runs`: `public_id, rule_ref (nullable), rule_name_snapshot, status, trigger_source, trigger_entity_ref, queued_at, completed_at`. `rule_name_snapshot` is read from the bound `automation_rule_revisions.name_snapshot` — never from the live rule's current name, preserving FB-D16's evidenced behavior even in the list view. `GET /automation/runs/{id}`: full detail plus `condition_snapshot`. `GET /automation/runs/{id}/actions`: every `AutomationActionExecution` in order, each with its approval decision (`decided_by`/`decided_at`) inlined from `automation_approvals` where present.

## 4. Failure / dead-letter view

A filtered slice of the run list (`status=dead_lettered`), surfacing `error_classification`, `failure_reason`, and a `replay_available: true` flag — no separate table or DTO; dead-letter is a `status` value, not a distinct read model (`B7_DEAD_LETTER_REPLAY.md` §1).

## 5. No financial truth

No B7 read model exposes, derives, or aggregates anything resembling revenue, weighted pipeline value, or attribution — `execution_count`/`success_count`/`failure_count` are automation-operational counters only, structurally incapable of being mistaken for commercial metrics (`B7_REVENUE_FIREWALL.md` §4's false-positive-guard discipline extends to read models too: none of these fields ever touches a `revenue_events`/`attribution_touchpoints` table).

# B7 — AutomationRule Aggregate

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Aggregate boundary

`AutomationRule` is the aggregate root. Its active `AutomationRuleRevision` is loaded with it for read purposes but is never mutated in place (`B7_RULE_REVISION_MODEL.md`). `AutomationRun` is a separate aggregate that *references* a rule and a specific revision by id; it is not a child of the rule aggregate (a run must outlive edits, pauses, and even archival of the rule that spawned it — `B7_RETENTION_DELETION.md`).

## 2. Fields — resolved (Class A, `B7-D-A003`, resolves task brief §7)

| Field | Resolution |
|---|---|
| `workspace` | required, immutable after creation |
| `name` | required, 1-200 chars |
| `description` | optional, free text |
| `status` | `draft`\|`active`\|`disabled`\|`archived` — `B7_RULE_LIFECYCLE.md` |
| `trigger` | exactly one, from the closed `B7_TRIGGER_CATALOG.md` — lives on the active revision, not the rule row |
| `conditions` | zero or more, from the closed `B7_CONDITION_ENGINE.md` — lives on the active revision |
| `actions` | one or more, ordered, from the closed `B7_ACTION_CATALOG.md` — lives on the active revision |
| `created_by` | the authoring Membership; retained even if that member later leaves the workspace (`B7_ACTION_AUTHORIZATION.md` §4) |
| `owner` | **not distinct from `created_by` in Phase 1** — no frontend evidence or product requirement for rule reassignment/ownership-transfer independent of the RBAC permission model (`automation.rule.manage` already gates who may edit any workspace rule, regardless of authorship); a future phase may add it, deferred Class B |
| `version` | integer, optimistic concurrency (frozen pattern, `BACKEND_ARCHITECTURE_DECISIONS.md`) |
| `revision` | `active_revision_id` + `revision_number` — `B7_RULE_REVISION_MODEL.md` |
| `enabled_at` / `disabled_at` / `archived_at` | set exactly once per transition into that state (re-entering a state after leaving it updates the timestamp again; history of *all* transitions lives in `B7_OBSERVABILITY_AUDIT.md`'s audit log, not as repeated columns on the rule row) |
| `execution_policy` | `auto_safe`\|`approval_required`\|`manual_only` — reused verbatim from evidenced `automationApprovalPolicies` (FB-D07) |
| `concurrency_policy` | Phase-1 fixed value: **no two runs of the same rule execute their action phase concurrently against the same trigger entity** — enforced by `B7_CONCURRENCY_MODEL.md` §1's advisory lock, not a per-rule configurable field (smallest deterministic model; no evidence justifies a per-rule concurrency knob in Phase 1) |
| `failure_policy` | Phase-1 fixed value: a failed action halts the run at that action (no configurable "continue on failure" toggle) — `B7_PARTIAL_SUCCESS.md` |

## 3. Trigger/condition/action representation — resolved

**Hybrid, decided in `B7_DOMAIN_OWNERSHIP.md` §2**: normalized internal rows (`triggers`/`conditions`/`actions` per frozen `BACKEND_DATA_MODEL.md` row 21) collapsed into structured `jsonb` columns on `automation_rule_revisions` (`trigger_definition`, `condition_definition`, `action_definitions`) for Phase-1 implementation simplicity, never exposed as standalone public-ID resources (`BACKEND_PUBLIC_ID_REGISTRY.md` §B already forecloses `COND-`/`AUTOACT-`/`AUTOEXEC-` as independent resources). The DTO the API exposes nests these directly inside the rule/revision representation (`B7_API_DTO_CONTRACTS.md` §2).

## 4. Validation before persistence

Every `CreateAutomationRule`/`UpdateAutomationRule` call runs the same structural validator that `ActivateAutomationRule` re-runs before allowing `draft → active` (`B7_RULE_VALIDATION` folded into `B7_RULE_LIFECYCLE.md` §4, resolving task brief §32): trigger type is in the closed catalog; every condition field is in the closed allow-list for the trigger's `entity_type` with an operator legal for that field's `data_type`; every action type is in the closed catalog and its required parameters are present; a referenced `PipelineStage`/`AutomationRule` (self-clone target — not supported, §2) resolves within the workspace; the rule's own trigger+action combination does not create an *unconditional* same-rule self-loop (`B7_LOOP_PREVENTION.md` §3's structural check, not a full runtime guarantee — runtime lineage tracking is the real safety net).

`CreateAutomationRule` always persists in `status='draft'` regardless of what the client requests (the create-form's direct "enabled" option, evidenced at FB-D08, is a client-side convenience that issues `CreateAutomationRule` then `ActivateAutomationRule` — never a single call that skips validation).

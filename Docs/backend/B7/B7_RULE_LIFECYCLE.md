# B7 — Rule Lifecycle State Machine

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. States — resolved (Class A, `B7-D-A004`)

**`draft`, `active`, `disabled`, `archived`.** Frontend evidence (FB-D08) shows only `draft`/`enabled`/`disabled`; this document renames `enabled`→`active` for symmetry with every other B-phase's aggregate-status vocabulary (Deal/Lead use `status`, never `enabled`) and **adds `archived`** as a fourth, terminal state.

`archived` is added because retention/audit requires a way to permanently retire a rule (remove it from active-rule lists and quota counts) while keeping its full revision and run history intact for `B7_RETENTION_DELETION.md` — `disabled` alone cannot mean both "temporarily off, one click from reactivation" and "permanently retired, never coming back," and conflating them would violate the task brief's own §34 instruction not to use synonyms accidentally.

**`paused` is deliberately not a separate state from `disabled`.** No frontend evidence shows two distinct temporarily-off states, and the task brief's own smallest-deterministic-model principle (§21, generalized) argues against inventing a second one without product evidence. §2 below resolves the "does pause stop new triggers but let running executions finish" question as a property of the `disabled` transition itself, so nothing `paused` would have offered is lost.

## 2. Transitions

| From | To | Command | Permission | Preconditions | Version check | Side effects | Event |
|---|---|---|---|---|---|---|---|
| — | `draft` | `CreateAutomationRule` | `automation.rule.manage` | DTO passes structural validation (`B7_AUTOMATION_RULE_AGGREGATE.md` §4) | n/a (new row) | creates rule row + revision 1 | `AutomationRuleCreated` |
| `draft` | `active` | `ActivateAutomationRule` | `automation.rule.manage` | full structural + reference validation re-run; `execution_policy` present | `If-Match` on rule `version` | `enabled_at` set; `active_revision_id` set | `AutomationRuleActivated` |
| `active` | `draft` | not permitted | — | — | — | — | — |
| `active`/`draft` | edited | `UpdateAutomationRule` | `automation.rule.manage` | new definition passes validation | `If-Match` on rule `version` | creates revision N+1 (§`B7_RULE_REVISION_MODEL.md`); if rule was `active`, the new revision becomes `active_revision_id` **atomically** — no intermediate state where the rule has no active revision | `AutomationRuleUpdated` |
| `active` | `disabled` | `DisableAutomationRule` | `automation.rule.manage` | none | `If-Match` | `disabled_at` set; blocks new trigger admission (§3); queued/`awaiting_approval` runs are cancelled (§3); running runs finish uninterrupted | `AutomationRuleDisabled` |
| `disabled` | `active` | `ActivateAutomationRule` | `automation.rule.manage` | re-runs full validation (a stage/target referenced by the rule may have been archived while disabled) | `If-Match` | `enabled_at` set again | `AutomationRuleActivated` |
| `draft`/`disabled` | `archived` | `ArchiveAutomationRule` | `automation.rule.manage` | none | `If-Match` | `archived_at` set; irreversible | `AutomationRuleArchived` |
| `active` | `archived` | not permitted directly | — | must `DisableAutomationRule` first | — | — | — |
| `archived` | anything | not permitted | — | terminal | — | — | — |

Idempotency: every lifecycle command requires `Idempotency-Key`, matching the frozen general standard's treatment of every other domain's mutating aggregate command.

## 3. Resolved questions (task brief §8)

- **Can `draft` execute?** No. `draft` admits no triggers, evaluates nothing, and cannot be targeted by `RunAutomationNow`. Only `RunAutomationTest` (dry-run, §`B7_DEAD_LETTER_REPLAY` sibling doc `B7_PAUSE_DISABLE_CANCEL.md` n/a — see `B7_EXECUTION_MODEL.md` §5) may evaluate a `draft` rule's conditions, and it never invokes an action.
- **Can `paused` receive triggers?** N/A — no `paused` state (§1). `disabled` receives triggers at the inbox layer (the event is still consumed and deduped, §`B7_TRIGGER_ADMISSION.md`) but admits no new run for that rule — the trigger is acknowledged, not queued.
- **Can `archived` reactivate?** No. Terminal by design (§2). A workspace that wants the same behavior again authors a new rule (cheap — Phase-1 has no `CloneAutomationRule` command, deferred Class B, §`B7_COMMAND_EVENT_CATALOG.md`).
- **Can active rules be edited directly?** No in-place edit exists. Every edit goes through `UpdateAutomationRule`, which always creates a new revision (§2, `B7_RULE_REVISION_MODEL.md` §1).
- **Does editing create a revision?** Always, unconditionally — even a no-op edit (same content resubmitted) creates a new revision number, matching the frozen "never rewrite frozen truth" discipline applied at rule-instance scope: immutability is structural, not best-effort.
- **What happens to already-running executions when a rule is paused/disabled?** `DisableAutomationRule` (§2): `queued` and `awaiting_approval` runs for that rule are transitioned to `cancelled` (nothing has committed yet — safe); `running`/`waiting` runs are **not** interrupted — they continue against the rule revision they already captured, because an action may have partially committed and an abrupt stop would leave `B7_PARTIAL_SUCCESS.md`-shaped ambiguity with no compensating mechanism (§36 of the task brief: no distributed rollback). This mirrors `B6_DEAL_STATE_MACHINE.md`'s own precedent of never retroactively invalidating an in-flight, already-committed transaction.

`CLASS_A_UNRESOLVED` contribution from this document: 0 — every question the task brief poses in §8 is resolved above.

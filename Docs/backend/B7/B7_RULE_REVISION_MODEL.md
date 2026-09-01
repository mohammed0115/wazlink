# B7 — Rule Revision / Immutable Execution Snapshot Model

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. The invariant

**An `AutomationRun` MUST be reproducible against the exact rule definition that ran, and a later rule edit MUST NOT change that historical record.** This is the single most safety-critical modeling decision in B7 (task brief §9) and is directly evidenced: every frontend run record already carries `ruleNameSnapshot` and `automationRuleVersion` (FB-D16, `data.js` mock model), captured once at trigger time and never recomputed from the live rule.

## 2. Design

`AutomationRule` (mutable head) + `AutomationRuleRevision` (immutable, append-only, `B7_DATA_MODEL.md` §2). Every `AutomationRun.rule_revision_id` is a foreign key to one specific, immutable revision row — never to the rule row itself. Reading a historical run's trigger/condition/action definitions means reading `automation_rule_revisions` by that fixed id; the current state of `automation_rules.active_revision_id` is irrelevant to that read.

## 3. Lifecycle of a revision

- **Creation:** every `CreateAutomationRule` (revision 1) and every `UpdateAutomationRule` (revision N+1) inserts a new, immutable `automation_rule_revisions` row. No `UPDATE` statement against this table exists in the application service layer (structural immutability, matching `B6_DEAL_STATE_MACHINE.md`'s "no code path" precedent).
- **Activation:** a revision becomes "the one that runs" only when `automation_rules.active_revision_id` points to it — set atomically in the same transaction as `ActivateAutomationRule`/`UpdateAutomationRule` on an already-`active` rule (§`B7_RULE_LIFECYCLE.md` §2). A `draft` rule's revision exists but is never activated until `ActivateAutomationRule` succeeds.
- **Supersession:** the previous `active_revision_id`'s row gets `superseded_at` set, in the same transaction. A superseded revision is never deleted — it remains readable for every run that referenced it.
- **Rollback:** Phase-1 has no `RollbackAutomationRule` command. "Rolling back" is authoring a new `UpdateAutomationRule` call whose content matches an earlier revision — which itself creates revision N+1, never reactivates revision N-2. This keeps the revision sequence strictly monotonic and avoids the ambiguity of "is revision 3 a copy of revision 1, or literally revision 1 again" (deferred Class B if product evidence later shows this matters).
- **Editing an active rule:** always goes through `UpdateAutomationRule`; there is no separate "edit the draft, then promote" path once a rule is `active` — the new revision activates in the same atomic transaction as its creation (§`B7_RULE_LIFECYCLE.md` §2), so there is never a window where `active_revision_id` is null on an `active` rule.
- **Historical inspection:** `GET /automation/rules/{id}/revisions` and `GET /automation/rules/{id}/revisions/{revision_number}` (§`B7_API_DTO_CONTRACTS.md`) expose the full revision history read-only.
- **Retention:** revisions are retained for as long as any `AutomationRun` references them, and beyond that per `B7_RETENTION_DELETION.md`'s general audit-retention window — never deleted merely because they are superseded.

## 4. Acceptance proof (resolves task brief §9's closing requirement)

`AT-RVN-1`: create a rule, trigger a run, record its `rule_revision_id` and the revision's `action_definitions`. Edit the rule (`UpdateAutomationRule`, different action). Re-fetch the original run: its `rule_revision_id` and the referenced revision's `action_definitions` are byte-identical to what was recorded before the edit. `AT-RVN-2` **(NC)**: an implementation that recomputes a historical run's displayed action list from the *current* `active_revision_id` rather than the run's own stored `rule_revision_id` — fails, because the two revisions' `action_definitions` differ after the edit in `AT-RVN-1` and the displayed history would silently change.

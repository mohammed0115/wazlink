# B7 — Pause / Disable / Cancel Semantics

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Pause vs. disable vs. archive — no accidental synonyms

Resolved fully in `B7_RULE_LIFECYCLE.md` §1: **there is no separate `paused` state.** `disabled` carries exactly the semantics the task brief's §34 example asks about ("does pause stop new executions but let running finish" — yes, and that is what `disabled` does, §2 below), and `archived` is the distinct, terminal, permanently-retired state. Using three words for what Phase-1 evidence and architecture justify as two states would itself be the "synonym" mistake the task brief warns against — the resolution here is to *not* create a third word for a behavior neither evidence nor architecture requires to be distinct from `disabled`.

## 2. Behavior by trigger-admission stage

| Rule status | New triggers | Queued / awaiting-approval runs | Running runs | Manual replay |
|---|---|---|---|---|
| `draft` | never admitted (rule was never `active`) | n/a | n/a | not permitted (`B7_RULE_LIFECYCLE.md` §3) |
| `active` | admitted normally | processed normally | run normally | permitted |
| `disabled` | **not admitted** — event still consumed/deduped (inbox record written), but no run is created for this rule and no `automationRuns` unit is reserved | any run of this rule already `queued`/`awaiting_approval` at the moment of disabling is transitioned `cancelled` (nothing committed yet) | **unaffected** — finishes against its captured revision | permitted (replaying history is not "triggering," §`B7_DEAD_LETTER_REPLAY.md`) |
| `archived` | not admitted (rule cannot be `archived` while it was `active`; must be `disabled` first, `B7_RULE_LIFECYCLE.md` §2) | n/a (already resolved before archival was possible) | n/a | permitted |

Phase 1 has no `waiting` runs and no scheduled wakeups to place in this table (`B7_EXECUTION_MODEL.md` §7).

## 3. Cancellation — resolved (Class A, `B7-D-A030`)

**Who:** any Membership holding `automation.rule.manage` for the workspace, or the run's own `triggered_by` for a manual run — no special "cancel" permission beyond the existing rule-management grant (no frontend/architecture evidence justifies a separate one).

**Which states can cancel:** `created`, `evaluating`, `queued`, `awaiting_approval`, `running` — every non-terminal state, and no others (`B7_EXECUTION_MODEL.md` §3). Cancelling a `running` run does **not** interrupt whichever single action is currently mid-invocation (§4) — it prevents the *next* action from starting.

**Can the current target-domain command be interrupted?** No. Once an action's invocation of a target command has been sent, it runs to whatever conclusion that command's own transaction reaches — B7 has no mechanism to abort another domain's in-flight transaction, and inventing one would itself be a direct-write-firewall-adjacent violation (reaching into another domain's execution). `CancelAutomationExecution` against a `running` run marks the run `cancelled` **after** the in-flight action settles (succeeded or failed), and skips every action after it.

**Already-committed action:** if a Deal was already moved successfully before cancellation was requested, cancelling the automation does **not** reverse it (task brief's own explicit example). No rollback illusion — `B7_COMMAND_EVENT_CATALOG.md`'s `CancelAutomationExecution` response makes this explicit in its own result shape (`already_committed_actions: [...]`, informational, never implying reversal).

**Audit/event behavior:** `AutomationRunCancelled` (`B7_COMMAND_EVENT_CATALOG.md` §2) fires once, listing exactly which actions had already reached a terminal state (`completed`/`failed`) versus which were skipped by the cancellation — full transparency, no silent gaps in the trail evidenced at FB-A42.

## 4. Negative control

`AT-CANCEL-1` **(NC)**: an implementation that, upon `CancelAutomationExecution`, attempts to invoke a compensating "undo" command against a target domain for an already-succeeded action — fails; no such compensating command exists or is invoked (`B7_PARTIAL_SUCCESS.md` §4 restates this from the partial-success angle).

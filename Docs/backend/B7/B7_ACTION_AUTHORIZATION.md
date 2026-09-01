# B7 — Action Authorization

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Five separately-checked layers — resolved (Class A, `B7-D-A017`)

Restated precisely for actions (extends `B7_SYSTEM_ACTOR_AUTHORIZATION.md` §3 from "may a rule run at all" to "may this specific action execute"):

| Layer | Question | Checked by | Checked when |
|---|---|---|---|
| A. Trigger eligibility | did a legitimate, deduplicated event admit this run? | `B7_TRIGGER_ADMISSION.md` | admission |
| B. Rule ownership | who authored this rule? | audit attribution only — **never** an authority source (§`B7_SYSTEM_ACTOR_AUTHORIZATION.md` §3.2) | — |
| C. Workspace entitlement | does the workspace's plan include automation, and does this action's target capability remain entitled? | `B7_ENTITLEMENT_RBAC_TENANCY.md` §2, §4 | admission and immediately before each action invocation |
| D. Command authorization | does the workspace have RBAC standing for the target command's permission, and (for `approval_required`/`manual_only` actions) has a human with `automation.run.approve` actually approved? | the target command's own guard, plus B7's approval gate (§2) | immediately before invocation |
| E. Domain validation | does the target aggregate's own business-rule state permit this specific mutation right now? | the target command itself | invocation |

**"Rule exists" never becomes "rule can do anything":** layers A-C answer only "is automation permitted to attempt something in this workspace at all," never "is this specific mutation permitted" — that is exclusively layers D-E, both owned entirely by the target domain's own governed command, unmodified.

## 2. The approval gate

For every action whose effective safety tier is `approval_required` (§`B7_ACTION_CATALOG.md` §2's fixed tiers, or a rule's own `manual_only` policy applied to an otherwise-`auto_safe` action — a rule's `execution_policy` may only make a tier *stricter*, never looser, so a rule cannot mark `send_message` `auto_safe`): the action execution is created `status='awaiting_approval'` and an `automation_approvals` row is opened (`B7_DATA_MODEL.md` §5). No invocation of the target command occurs until `ApproveAutomationAction` succeeds. `RejectAutomationAction` transitions the action to `rejected`, terminal, no invocation ever occurs — matching evidenced copy "لم تُنفذ أي mutation" (FB-D11).

`automation.run.approve` gates who may decide (`B1_AUTHORIZATION_RBAC.md` row, owner/admin/manager: `A`; sales: `C` "never self-approve where policy forbids"). B7 enforces the self-approval prohibition structurally: `ApproveAutomationAction` rejects with `403` if `decided_by == rule.created_by` **and** the approver's role is below `manager` rank — mirroring the frozen condition text exactly, not loosening it.

## 3. Idempotent approval

A second `ApproveAutomationAction` call against an already-`approved`/`executed` action returns the existing terminal result (`no_op`, evidenced FB-D11) rather than re-invoking the target command — the action's own idempotency key (§`B7_IDEMPOTENCY_MODEL.md` §2) makes this safe even if the "already decided" check were somehow bypassed, in the same defense-in-depth spirit as B6's version-check-plus-idempotency-key double guard.

## 4. Resolved edge cases (task brief §18's exact list)

| Case | Resolution |
|---|---|
| Creator leaves the workspace | No effect on already-`active` rules or in-flight runs — authority is never creator-sourced (§`B7_SYSTEM_ACTOR_AUTHORIZATION.md` §3.2). A departed member's name remains on `created_by` for historical attribution only |
| Owner is suspended | Phase-1 has no distinct owner (`B7_AUTOMATION_RULE_AGGREGATE.md` §2) — same resolution as creator |
| Workspace entitlement changes | Checked fresh at both admission (layer C, trigger time) and immediately before each action invocation (layer C, action time) — an entitlement lost between a run's admission and its action's invocation blocks that specific action with `error_classification='ENTITLEMENT'`, non-retryable, without retroactively invalidating the run's already-completed prior actions (§`B7_PARTIAL_SUCCESS.md`) |
| Action permission is revoked | The target command's own RBAC re-check (layer D/E) rejects at invocation time — `error_classification='AUTHORIZATION'`, non-retryable |

`AT-SEC-AUTOMATION-2` **(NC)**: an implementation that treats `automation.rule.manage` (may author/edit rules) as sufficient standing to also approve that same rule's actions without holding `automation.run.approve` — fails; the two permissions are checked independently, per the frozen B1 matrix's separate rows.

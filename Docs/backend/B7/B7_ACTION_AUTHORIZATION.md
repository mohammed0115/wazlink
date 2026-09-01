# B7 — Action Authorization

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Five separately-checked layers — resolved (Class A, `B7-D-A017`)

Restated precisely for actions (extends `B7_SYSTEM_ACTOR_AUTHORIZATION.md` §3 from "may a rule run at all" to "may this specific action execute"):

| Layer | Question | Checked by | Checked when |
|---|---|---|---|
| A. Trigger eligibility | did a legitimate, deduplicated event admit this run? | `B7_TRIGGER_ADMISSION.md` | admission |
| B. Rule authorship | who authored this rule? | `automation_rules.created_by` — audit attribution only, **never** an authority source (§`B7_SYSTEM_ACTOR_AUTHORIZATION.md` §3.2) | — |
| C. Workspace entitlement | does the workspace's plan include automation, and does this action's target capability remain entitled? | `B7_ENTITLEMENT_RBAC_TENANCY.md` §2, §4 | admission and immediately before each action invocation |
| D. Command authorization | does the **authority principal** — `automation_rule_revisions.activated_by_membership_id`, a real membership, read live — still hold the target command's permission under their *current* role, and (for `approval_required`/`manual_only` actions) has a human holding `automation.run.approve` actually approved? | the target command's own guard evaluated against the authority principal (§`B7_SYSTEM_ACTOR_AUTHORIZATION.md` §3.1), plus B7's approval gate (§2) | immediately before invocation |
| E. Domain validation | does the target aggregate's own business-rule state permit this specific mutation right now? | the target command itself | invocation |

**"Rule exists" never becomes "rule can do anything":** layers A-C answer only "is automation permitted to attempt something in this workspace at all," never "is this specific mutation permitted" — that is exclusively layers D-E, both owned entirely by the target domain's own governed command, unmodified.

**There is exactly one permission authority, and it is a membership.** `system:automation` is the *caller identity* supplied for audit and idempotency attribution (§`B7_SYSTEM_ACTOR_AUTHORIZATION.md` §1); it carries no grant of its own. No workspace-level RBAC standing, workspace-held permission, or workspace automation permission principal exists anywhere in B7 — `B1_AUTHORIZATION_RBAC.md` §3 attaches every grant to a role and every role to a membership, and B7 borrows rather than invents (`B7_SYSTEM_ACTOR_AUTHORIZATION.md` §3, `B7_ENTITLEMENT_RBAC_TENANCY.md` §2, `AT-SEC-9` **NC**). Workspace-scoped entitlement (layer C) is a commercial gate, never a permission.

## 2. The approval gate

For every action whose effective safety tier is `approval_required` (§`B7_ACTION_CATALOG.md` §2's fixed tiers, or a rule's own `manual_only` policy applied to an otherwise-`auto_safe` action — a rule's `execution_policy` may only make a tier *stricter*, never looser, so a rule cannot mark `send_message` `auto_safe`): the action execution is created `status='awaiting_approval'` and an `automation_run_approvals` row is opened (`B7_DATA_MODEL.md` §5). No invocation of the target command occurs until `ApproveAutomationRun` succeeds with `approved:true`. Approval is **run-granular** — the frozen request body carries no action selector (`B7_COMMAND_EVENT_CATALOG.md` §4) — so one decision governs every action of that run awaiting it. `ApproveAutomationRun` with `approved:false` transitions every awaiting action of the run to `rejected`, terminal, and no invocation ever occurs — matching evidenced copy "لم تُنفذ أي mutation" (FB-A31).

`automation.run.approve` gates who may decide (`B1_AUTHORIZATION_RBAC.md` row, owner/admin/manager: `A`; sales: `C` "never self-approve where policy forbids"). B7 enforces the self-approval prohibition structurally: `ApproveAutomationRun` rejects with `403` if `decided_by == rule.created_by` **and** the approver's role is below `manager` rank — mirroring the frozen condition text exactly, not loosening it.

## 3. Idempotent approval

A second `ApproveAutomationRun` call against an already-`approved`/`executed` action returns the existing terminal result (`no_op`, evidenced FB-A31) rather than re-invoking the target command — the action's own idempotency key (§`B7_IDEMPOTENCY_MODEL.md` §2) makes this safe even if the "already decided" check were somehow bypassed, in the same defense-in-depth spirit as B6's version-check-plus-idempotency-key double guard.

## 4. Resolved edge cases (task brief §18's exact list)

| Case | Resolution |
|---|---|
| Creator leaves the workspace | No effect on already-`active` rules or in-flight runs — authority is never creator-sourced (§`B7_SYSTEM_ACTOR_AUTHORIZATION.md` §3.2). A departed member's name remains on `created_by` for historical attribution only |
| Owner is suspended | Phase-1 has no distinct owner (`B7_AUTOMATION_RULE_AGGREGATE.md` §2) — same resolution as creator |
| **The authority principal (activator) leaves or is suspended** | Layer D fails at the next invocation: the action is `blocked`, classified `AUTHORIZATION`, non-retryable, and the run settles `failed`. The rule's own `status` is **not** mutated — see `B7_SYSTEM_ACTOR_AUTHORIZATION.md` §3.3a for why Phase-1 declines an implicit lifecycle mutation. Recovery is explicit: any member holding `automation.rule.manage` re-runs `ActivateAutomationRule`, rebinding `activated_by_membership_id` to themselves |
| **The authority principal's role is downgraded** | Layer D is evaluated against their *current* role, uncached (`B1-D-006`), so exactly those actions their new role no longer permits are `blocked`/`AUTHORIZATION`; actions still within their role continue to succeed |
| Workspace entitlement changes | Checked fresh at both admission (layer C, trigger time) and immediately before each action invocation (layer C, action time) — an entitlement lost between a run's admission and its action's invocation blocks that specific action with `error_classification='ENTITLEMENT'`, non-retryable, without retroactively invalidating the run's already-completed prior actions (§`B7_PARTIAL_SUCCESS.md`) |
| Action permission is revoked | The target command's own RBAC re-check (layer D/E) rejects at invocation time — `error_classification='AUTHORIZATION'`, non-retryable |

`AT-RBAC-5` **(NC)**: an implementation that treats `automation.rule.manage` (may author/edit rules) as sufficient standing to also approve that same rule's runs without holding `automation.run.approve` — fails; the two permissions are separate rows in the frozen `B1_AUTHORIZATION_RBAC.md` matrix and are checked independently.

`AT-RBAC-6` **(NC)**: an implementation evaluating a target command's permission against the workspace, against `system:automation`, or against `automation_rules.created_by` rather than against `automation_rule_revisions.activated_by_membership_id` — fails; §1 layer D names exactly one authority principal.

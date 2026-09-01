# B7 — System Actor Model and Authorization

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. The actor identity — already partially frozen

`BACKEND_COMMAND_EVENT_CATALOG.md`-adjacent frozen `B2_COMMAND_EVENT_CATALOG.md` already specifies the exact caller identity B7 uses when invoking another domain's governed command: **`actor_type = 'system:automation'`, `actor_label = 'automation_run:RUN-*'`** ("Automation as actor" note, binding `CreateTask`, `ScheduleAppointment`, `ChangeLeadStatus`, `ChangeLeadPriority`, `AssignLeadOwner`). B6 independently reserved the equivalent schema slot for Deal-stage transitions (`deal_stage_transitions.actor_membership_id = NULL` with `reason_source='automation'`, `B6_DATA_MODEL.md` §4), and B5 reserved `senderType='system'` for message sends (`B5_MESSAGE_MODEL.md` §2). B7 **adopts this exact convention uniformly** across every command it invokes — it does not invent a competing actor-identity scheme:

| Target domain | Actor field(s) the target command reads | Value B7 supplies |
|---|---|---|
| B2 (CRM) | `actor_type`, `actor_label` | `system:automation`, `automation_run:{RUN-*}` |
| B5 (Messaging) | `senderType`, `senderRef` | `system`, `{RUN-*}` |
| B6 (Pipeline) | `actor_membership_id`, `reason_source` | `NULL`, `automation` |

`B7-D-A005` (Class A, resolved): the `RUN-*` public ID of the specific `AutomationRun` performing the invocation is *always* present in the actor label/reference supplied to the target command, regardless of the target domain's exact field name for it. This is what makes every automation-caused mutation traceable back to one run without a join through B7's internal tables.

## 2. `system:automation` is not superuser — resolved (Class A, `B7-D-A006`)

Five separate, structural facts jointly guarantee this, none of them optional:

1. **No second command path exists.** B7 never writes another domain's table. It calls the identical governed command a human actor calls, through the identical admission sequence (`B6-D-A026`, `B5-D-A025`, and the equivalent B2 "Automation as actor" note all state this independently for their own domain). There is no `internal_execute()` bypass.
2. **The invoked command still runs its own RBAC check** — against the *rule's* authorization context (§3), not an unconditional grant. A workspace whose plan/role configuration would deny a human actor `deal.update` denies the automation-invoked `MoveDealStage` identically.
3. **The invoked command still runs its own entitlement check** (§`B7_ENTITLEMENT_RBAC_TENANCY.md`; e.g. `message.send`'s "channel + entitlement + approval policy" condition, `B1_AUTHORIZATION_RBAC.md` row `message.send`, applies to an automation-invoked send exactly as it applies to a human-invoked one).
4. **The invoked command still runs its own domain validation, concurrency, and idempotency guards** — a stale `expected_version`, an already-`won` Deal, an inactive `PipelineStage`, or a closed conversation service window rejects an automation-invoked command exactly as it rejects a human one (§`B7_CONCURRENCY_MODEL.md`, `B7_EXECUTION_MODEL.md`).
5. **A dedicated permission gates whether automation may act *at all* in a given workspace/role context** (§3) — `system:automation` is a caller identity for audit/idempotency attribution, never itself a grant of authority.

## 3. Authorization model — resolved (Class A, `B7-D-A007`)

**Workspace-capability-plus-rule-authorization-context, not creator-delegated authority.** Concretely, for every action a run attempts:

1. **Trigger eligibility** (can this event admit a run at all) is answered by `B7_TRIGGER_ADMISSION.md` — workspace entitlement (`automation.rules`, FB-D22) and the rule's own `status='active'`.
2. **Rule ownership/authorship** (`created_by`) is retained for audit attribution only. It is **not** re-checked at execution time and does **not** supply the authority under which an action's target command executes — resolving the task brief's own "what happens if the creator leaves the workspace" question directly: **nothing happens to already-active rules.** A rule created by a member who has since left the workspace continues to execute exactly as before, because authority was never sourced from that member's personal grant.
3. **Workspace entitlement** (§`B7_ENTITLEMENT_RBAC_TENANCY.md`) gates whether the workspace's plan includes automation at all and whether it has execution quota remaining.
4. **Command authorization**, at the moment each action invokes its target command, is evaluated against **the target domain's own permission catalog, checked for the workspace** (not against any individual member's grant) — e.g. `MoveDealStage` requires the workspace to have *some* role capable of `deal.update` in its frozen matrix; since RBAC in this corpus is role-based per workspace membership rather than per-token delegated scopes, and `system:automation` is not a Membership row, the invoked command's authorization check resolves against a **workspace-level automation capability flag** (§`B7_ENTITLEMENT_RBAC_TENANCY.md` §2) layered *in front of* the target command's ordinary RBAC check — the target command's guard still runs in full; the workspace capability flag is an additional, not a substitute, gate. This is deliberately conservative: it means a workspace can be entitled to `automation.rules` yet have automation-invoked `deal.update`-class actions blocked at the target-command boundary if the workspace's automation capability is scoped narrower than a member's own role would allow — never the reverse.
5. **Domain validation** is the target command's own business-rule guard (closed stage, invalid loss reason, etc.) — automation gets no exemption.

**No implicit superuser, resolved for every named edge case:**

| Case | Resolution |
|---|---|
| Creator leaves the workspace | No effect on an already-`active` rule (§2 above) — authority was never creator-sourced |
| Rule owner is suspended | Same as above — Phase-1 has no distinct "owner" (§`B7_AUTOMATION_RULE_AGGREGATE.md` §2); a suspended member's `automation.rule.manage` grant is revoked for *future edits* by the RBAC check on `UpdateAutomationRule`/lifecycle commands, but an already-`active` rule's execution is unaffected |
| Workspace entitlement changes mid-run | A `running` run finishes uninterrupted (no abrupt stop, §`B7_RULE_LIFECYCLE.md` §3); the *next* trigger-admission check re-evaluates entitlement fresh (§`B7_ENTITLEMENT_RBAC_TENANCY.md` §4) |
| Action permission is revoked (workspace downgrades a role's grant) | The target command's own RBAC check, re-run at invocation time, rejects the action with the target domain's ordinary `403`-class failure — classified `AUTHORIZATION`, non-retryable (§`B7_FAILURE_RETRY_MODEL.md`) |

`AT-SEC-AUTOMATION-1` **(NC)**: an implementation letting a rule's `created_by` grant execution authority independent of workspace/role checks — fails; §3.2 above structurally forbids sourcing authority from authorship.

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
2. **The invoked command still runs its own RBAC check** — against the revision's **authority principal** (§3.1), a real and currently-active membership, not an unconditional grant. A workspace whose plan/role configuration would deny a human actor `deal.update` denies the automation-invoked `MoveDealStage` identically.
3. **The invoked command still runs its own entitlement check** (§`B7_ENTITLEMENT_RBAC_TENANCY.md`; e.g. `message.send`'s "channel + entitlement + approval policy" condition, `B1_AUTHORIZATION_RBAC.md` row `message.send`, applies to an automation-invoked send exactly as it applies to a human-invoked one).
4. **The invoked command still runs its own domain validation, concurrency, and idempotency guards** — a stale `expected_version`, an already-`won` Deal, an inactive `PipelineStage`, or a closed conversation service window rejects an automation-invoked command exactly as it rejects a human one (§`B7_CONCURRENCY_MODEL.md`, `B7_EXECUTION_MODEL.md`).
5. **`system:automation` carries no grant of its own.** It is a caller *identity*, used for audit and idempotency attribution. Every permission it exercises is borrowed, live, from the membership that activated the rule revision (§3.1), and evaporates the moment that membership does.

## 3. Authorization model — resolved (Class A, `B7-D-A007`)

**Delegated authority, bound to the membership that activated the revision, re-resolved live at every invocation.**

The reason this, and not a "workspace-level automation capability": in this corpus RBAC is **role-based per membership** (`B1_AUTHORIZATION_RBAC.md` §3 — every cell in the matrix is a role's grant, and `B1-D-006` requires the membership, role, and matrix to be read per request inside the request transaction, with no caching). There is no such thing as a permission held by a workspace rather than by a member. Inventing one would (a) create authority with no human accountable for it, and (b) invent entitlement truth that belongs to B8. So B7 borrows authority instead of manufacturing it.

### 3.1 Where authority comes from

`automation_rule_revisions.activated_by_membership_id` records the membership that executed `ActivateAutomationRule` for that revision — a command already gated by `automation.rule.manage`. That membership is the revision's **authority principal**.

When a run executes an action, the target command's own RBAC check is evaluated against the **authority principal's current role, read live** at invocation time. The caller *identity* remains `system:automation` / `automation_run:RUN-*` (§1) — so audit stays distinguishable from a human actor, satisfying B2's `AT-AUD-6` — while the *authority* is a real, named, currently-active membership.

Consequence, stated plainly: **automation can never do anything the member who switched it on could not do themselves, at the moment it acts.** A rule activated by a `sales`-role member inherits `lead.assign` only conditionally ("sales: own assignments only"), so an `assign_lead_owner` action targeting someone else's Lead fails — correctly.

### 3.2 The five layers, kept separate

| Layer | Question | Answered by |
|---|---|---|
| A — trigger eligibility | may this event admit a run at all? | rule `status='active'` + workspace holds `automation.rules` (`B7_TRIGGER_ADMISSION.md`) |
| B — rule authorship | who wrote it? | `automation_rules.created_by` — **audit attribution only**, never authority |
| C — workspace entitlement | is automation sold to this workspace, with quota left? | `B7_ENTITLEMENT_RBAC_TENANCY.md` §4 |
| D — command authorization | may *this principal* invoke *this command*? | the target domain's own frozen permission row, evaluated against the **authority principal** (§3.1) |
| E — domain validation | is the operation legal right now? | the target command's own guards — state machine, `expected_version`, consent, service window |

Layer B is deliberately not layer D. Authorship and authority are different questions, and conflating them is what produces rules that outlive the accountability for them.

### 3.3 Every named edge case, resolved

| Case | Resolution |
|---|---|
| **The activating member leaves the workspace** | Their membership is no longer active, so layer D fails at the next invocation: the action is `blocked`, classified `AUTHORIZATION`, **non-retryable** (`B7_FAILURE_RETRY_MODEL.md` §1), and the run settles `failed` (`B7_PARTIAL_SUCCESS.md`). **The rule's own `status` is not mutated** — see §3.3a. **Recovery is explicit:** any member holding `automation.rule.manage` re-runs `ActivateAutomationRule`, which rebinds `activated_by_membership_id` to themselves. Authority is never silently inherited, and a departed member's grant never keeps acting. |
| **The activating member is suspended** | Identical to removal — a suspended membership grants nothing. The rule is not disabled, archived, or edited; its actions simply fail deterministically until someone who can re-activates it. |
| **The activating member's role is downgraded** | Layer D is evaluated against their *current* role, so the specific actions their new role no longer permits begin failing `AUTHORIZATION`/PERMANENT, while actions still within their role keep working. No cached decision can mask this (`B1-D-006`). |
| **Workspace entitlement changes mid-run** | A `running` run finishes uninterrupted; the *next* trigger admission and the *next* not-yet-invoked action observe the downgrade (`B7_ENTITLEMENT_RBAC_TENANCY.md` §4). |
| **A target-domain permission is revoked outright** | Same as a role downgrade — the target command's own check rejects, classified `AUTHORIZATION`, non-retryable. |
| **A transient failure reading the membership/role** | Classified `TRANSIENT`, retried on the frozen backoff schedule (`B7_FAILURE_RETRY_MODEL.md` §1-§2) — it is **not** an authorization failure, and it can never be mistaken for one, because "authority lost" is only ever concluded from a definitive negative answer, never from the absence of an answer. |

### 3.3a Authorization failure never mutates rule lifecycle — resolved (Class A, `B7-D-A038`)

An `AUTHORIZATION` failure **fails the affected action and its run, and does nothing else.** Phase-1 declares **no** automatic rule-lifecycle mutation on authority loss: no failure-count threshold, no system-initiated `active → disabled` transition, no `reason='authority_lost'` event field, no system actor performing a lifecycle command. An earlier draft of this pack promised exactly that behavior in prose while defining no threshold value, no transition, no actor, no event field to carry the reason, and no test — a hidden safety behavior specified inside error handling, which is precisely what must not ship.

Three reasons this is the right Phase-1 answer, not merely the smaller one:

1. **Authorization is per-command, and a rule's actions are heterogeneous.** A role downgrade may revoke `lead.assign` while leaving `task.manage` intact. Disabling the whole rule on the first such failure would stop actions that remain perfectly authorized; not disabling it stops exactly the actions that are not.
2. **Escalation is already prevented without it.** `ActivateAutomationRule` validates the principal at activation, and layer D re-validates live at every invocation (§3.1). A rule whose authority has evaporated executes nothing, whether or not its `status` column says `active`.
3. **It would be an undeclared lifecycle authority.** A system-initiated `DisableAutomationRule` needs an actor, a permission posture, an `If-Match` story, and a concurrency story against a concurrent human edit. Inventing all four for an unevidenced behavior is exactly the overbuild the brief forbids.

The operational visibility this trades away is supplied instead by data that already exists: `B7_READ_MODELS_QUERY.md` §1's `last_run_status` and §4's failure view surface a rule whose runs are failing `AUTHORIZATION`, and the `executions_failed{error_classification="AUTHORIZATION"}` metric (`B7_OBSERVABILITY_AUDIT.md` §2) alerts on it. An admin then re-activates deliberately.

Automatic disabling after repeated authorization failures is recorded as `B7-D-C006` — a future **operational policy** decision requiring product evidence and, if ever adopted, a first-class Class-A lifecycle transition with its own actor, threshold, event field, and tests. It is not deferred *implementation* of something Phase 1 promises; Phase 1 promises nothing here.

### 3.4 What this deliberately costs

Binding authority to a single membership means a rule stops acting when that member does. That is the intended trade: the alternative — authority that outlives every human who granted it — is precisely the implicit superuser the brief forbids. The cost is bounded and visible without any hidden state change: the rule stays `active`, its runs fail `AUTHORIZATION` deterministically, and `B7_READ_MODELS_QUERY.md` §1/§4 plus the `executions_failed` metric surface it so an admin re-activates deliberately rather than discovering it silently (§3.3a).

`AT-SEC-7` **(NC)**: an implementation letting a rule's `created_by` grant execution authority — fails; §3.2 layer B is audit attribution only, and authority comes from `activated_by_membership_id` (§3.1).

`AT-SEC-8` **(NC)**: an implementation in which a rule keeps invoking target commands after its authority principal is removed or suspended — fails; §3.3 requires a non-retryable `AUTHORIZATION` failure at the next invocation.

`AT-SEC-10` **(NC)**: an implementation that mutates a rule's `status` from any authorization-failure path — fails; §3.3a declares no such transition, and `B7_RULE_LIFECYCLE.md` §2's table contains no system-initiated edge to drive it.

`AT-SEC-9` **(NC)**: an implementation introducing a workspace-level permission or capability that grants automation an action no membership in that workspace could perform — fails; no such construct exists, and §3 sources every grant from the frozen per-membership role matrix.

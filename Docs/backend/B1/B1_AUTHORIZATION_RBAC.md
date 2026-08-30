# B1 — Authorization Pipeline, RBAC, and Resource Authorization

> **B1 status:** Target design only. No middleware, permission class, or queryset code is authorized.

## 1. The authorization decision chain (frozen for B1)

Every authenticated API operation passes these steps **in this order**, inside the request transaction. Any step that fails terminates the chain; no later step runs.

| # | Step | Question | Failure | Discloses |
|---|---|---|---|---|
| 1 | **Authenticated** | Is there a decodable session cookie? | `401 AUTH_REQUIRED` | nothing |
| 2 | **Session valid** | Registry row `active`, not past idle/absolute expiry? | `401 SESSION_REVOKED` / `401 AUTH_REQUIRED` | nothing |
| 3 | **User usable** | `users.status = 'active'`? | `401 AUTH_REQUIRED` (session also revoked) | nothing |
| 4 | **Email verified** | `email_verified_at` set, unless the operation is on the verification-exempt list? | `403 EMAIL_VERIFICATION_REQUIRED` | nothing new (caller owns the account) |
| 5 | **Workspace resolved** | Does `sessions.active_workspace_id` resolve to a workspace? `NULL` (no-workspace session, `B1_AUTH_SESSION_DESIGN.md` §4.6) terminates here. | `404 WORKSPACE_NOT_FOUND` | nothing |
| 6 | **Membership active** | Live membership for (user, active workspace) with `status='active'`? | `suspended` ⇒ `403 MEMBERSHIP_INACTIVE`; `removed`/absent ⇒ re-resolve, else `401`/`404 WORKSPACE_NOT_FOUND` | nothing |
| 7 | **Workspace state** | Is the workspace state compatible with the operation's safety class? | `403 WORKSPACE_INACTIVE` | nothing new |
| 8 | **RBAC permission** | Does `membership.role` grant the operation's permission code? | `403 PERMISSION_DENIED` | nothing new |
| 9 | **Tenant-scoped object resolution** | Does the target exist **within the active workspace**? | `404 ENTITY_NOT_FOUND` | nothing — this is the IDOR control |
| 10 | **Object-level condition** | Assignment/ownership conditions for `conditional` grants | `403 PERMISSION_DENIED` | nothing new |
| 11 | **Entitlement** | Does the workspace plan include the capability? | `403 ENTITLEMENT_LOCKED` | plan capability only |
| 12 | **Quota** | Is there allowance left for the metric/period? | `403 QUOTA_EXHAUSTED` | usage only |
| 13 | **Concurrency** | `If-Match`/`version` matches? | `409 STALE_VERSION` | nothing |
| 14 | **Idempotency** | Key reuse with a different body? | `409 IDEMPOTENCY_CONFLICT` | nothing |
| 15 | **Domain invariant** | Aggregate guards (last owner, invitation state, …) | `409 <specific>` | nothing new |
| 16 | **Allow** | execute + audit + outbox | — | — |

### Why this order

- **Step 9 before steps 10–12.** Object resolution must be tenant-scoped *before* any check that could leak a fact about the object. If entitlement were evaluated before resolution, a caller could distinguish "object not in my workspace" from "capability locked" and use that as a cross-tenant existence oracle.
- **Step 8 before step 9.** Permission is a property of the *caller*, not of the object; checking it first avoids a database read on a request that can never succeed and prevents a permission-less caller from timing object existence.
- **Steps 11–12 after step 8.** A caller who may not perform the action at all must never learn the workspace's plan or usage. RBAC deny always wins over entitlement/quota deny.
- **Step 12 after step 11.** Quota is meaningless for a capability the plan does not include; `not_included` is an entitlement fact (`LOCKED`), not a quota fact.
- **Steps 13–14 after authorization.** Never let an unauthorized caller probe versions or idempotency keys.
- **Step 4 late enough to keep the frozen login contract intact**, early enough that an unverified account can do nothing but verify.

### 401 vs 403 vs 404 vs 409 vs 429

| Status | Meaning in B1 | Never used for |
|---|---|---|
| `401` | The **caller is not established**: no session, expired, revoked, disabled account, bad credentials | authorization failures of an established caller |
| `403` | The caller is established but **this workspace/role/plan/quota/verification state forbids it** | anything that would reveal an out-of-tenant object |
| `404` | The target is **not visible within the active workspace** — whether it does not exist, is in another tenant, or the caller has no membership in the named workspace | signalling "exists but forbidden" |
| `409` | **State/version/invariant conflict** for an authorized caller | authorization failures |
| `429` | Rate limit, with `Retry-After` | quota exhaustion (that is `403 QUOTA_EXHAUSTED`) |

**Enumeration doctrine.** `404` is deliberately overloaded. Cross-workspace access, a workspace the caller has no membership in, and a genuinely absent object are indistinguishable. `403` is only ever returned once membership in the *active* workspace is already proven, so a `403` reveals nothing the caller did not already possess.

## 2. Permission catalog

Naming rule: `<resource>.<action>` in `snake_case` segments, dot-separated, lowercase, singular resource. A qualified sub-action adds a third segment (`member.role.change`). Permission codes are stable identifiers and are never renamed.

| Domain | Permission codes |
|---|---|
| Workspace | `workspace.view`, `workspace.manage`, `workspace.suspend`, `workspace.archive`, `workspace.delete` |
| Members | `member.view`, `member.invite`, `member.remove`, `member.suspend`, `member.role.change` |
| Ownership | `ownership.transfer` |
| Invitations | `invitation.view`, `invitation.cancel`, `invitation.resend` |
| Sessions | `session.self.manage` (list/revoke own sessions — granted to every role) |
| Discovery | `discovery.view`, `discovery.run`, `discovery.export` |
| Businesses | `business.view`, `business.convert` |
| Leads | `lead.view`, `lead.create`, `lead.update`, `lead.assign` |
| Tasks | `task.view`, `task.manage` |
| Appointments | `appointment.view`, `appointment.manage` |
| Conversations | `conversation.view` |
| Messages | `message.send` |
| Deals | `deal.view`, `deal.create`, `deal.update`, `deal.close` |
| Automation | `automation.rule.view`, `automation.rule.manage`, `automation.run.approve` |
| Analytics | `analytics.view`, `crm.export` |
| Billing | `billing.view`, `billing.manage` |
| Subscription | `subscription.change` |
| Payments | `payment.manage` |
| Tax | `tax.view` |
| Files | `file.upload`, `file.download` |
| Audit | `audit.view` |
| Settings | `settings.manage`, `integration.manage` |
| AI | `ai.use` |

**Namespace disambiguation.** Permission codes and audit action codes share a dotted lowercase shape but are different namespaces and must never be conflated. A **permission** is an imperative capability the caller may exercise (`invitation.cancel`, `workspace.manage`, `member.remove`); an **audit action** is a past-tense record of something that happened (`invitation.cancelled`, `workspace.updated`, `membership.removed`), catalogued in `B1_PRIVACY_AUDIT_MODEL.md` §3. Permission codes are always `<resource>.<imperative verb>`; audit actions are always `<resource>.<past participle>`. No string is valid in both namespaces.

## 3. Role → permission matrix

Derived from `BACKEND_AUTHORIZATION_MATRIX.md` without altering a single `allow`/`conditional`/`deny` cell. Legend: **A** = allow, **C** = conditional (allowed only after the stated object/state condition also passes), **·** = deny.

| Permission | owner | admin | manager | sales | member | viewer | Condition for `C` |
|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| `workspace.view` | A | A | A | A | A | A | — |
| `workspace.manage` | A | A | C | · | · | · | manager: non-billing settings only |
| `workspace.suspend` | A | · | · | · | · | · | — |
| `workspace.archive` | A | · | · | · | · | · | — |
| `workspace.delete` | A | · | · | · | · | · | — |
| `ownership.transfer` | A | · | · | · | · | · | — |
| `member.view` | A | A | A | A | A | A | — |
| `member.invite` | A | A | C | · | · | · | manager: may invite at rank < manager only |
| `member.remove` | A | A | C | · | · | · | manager: target rank < manager; never the last owner |
| `member.suspend` | A | A | C | · | · | · | same as `member.remove` |
| `member.role.change` | A | A | · | · | · | · | actor rank > target's current rank and > new rank; never `owner`; never self |
| `invitation.view` | A | A | A | · | · | · | — |
| `invitation.cancel` | A | A | C | · | · | · | manager: only invitations they issued |
| `invitation.resend` | A | A | C | · | · | · | manager: only invitations they issued |
| `session.self.manage` | A | A | A | A | A | A | own sessions only |
| `subscription.change` | A | C | · | · | · | · | admin: Billing permission and confirmed workspace |
| `payment.manage` | A | C | · | · | · | · | admin: provider flow; no raw card data |
| `billing.view` | A | A | · | · | · | · | — |
| `billing.manage` | A | C | · | · | · | · | admin: as `subscription.change` |
| `tax.view` | A | A | · | · | · | · | — |
| `discovery.run` | A | A | A | A | C | · | member: entitlement + quota |
| `discovery.view` | A | A | A | A | A | C | viewer: read-only workspace scope |
| `discovery.export` | A | A | A | C | C | · | export permission + quota |
| `business.view` | A | A | A | A | A | C | — |
| `business.convert` | A | A | A | A | C | · | object workspace scope |
| `lead.view` | A | A | A | A | A | C | — |
| `lead.create` | A | A | A | A | C | · | object workspace scope |
| `lead.update` | A | A | A | A | C | · | object workspace scope |
| `lead.assign` | A | A | A | C | · | · | sales: own assignments only |
| `task.view` / `appointment.view` | A | A | A | A | A | C | — |
| `task.manage` / `appointment.manage` | A | A | A | A | C | · | assigned/team scope |
| `conversation.view` | A | A | A | A | A | C | — |
| `message.send` | A | A | A | A | C | · | channel + entitlement + approval policy |
| `ai.use` | A | A | A | C | C | · | AI quota and data policy |
| `deal.view` | A | A | A | A | A | C | — |
| `deal.create` / `deal.update` | A | A | A | A | C | · | assigned/team scope |
| `deal.close` | A | A | A | C | · | · | explicit confirmation; audit |
| `automation.rule.view` | A | A | A | A | A | C | — |
| `automation.rule.manage` | A | A | A | C | · | · | sensitive actions need approval |
| `automation.run.approve` | A | A | A | C | · | · | never self-approve where policy forbids |
| `analytics.view` | A | A | A | A | A | C | workspace scope |
| `crm.export` | A | A | C | C | · | · | data export permission and audit |
| `file.upload` | A | A | A | A | C | · | owning resource in workspace |
| `file.download` | A | A | A | A | A | C | owning resource in workspace |
| `integration.manage` | A | A | C | · | · | · | secret access never returned to client |
| `settings.manage` | A | A | C | · | · | · | non-billing settings |
| `audit.view` | A | A | · | · | · | · | — |

**Resolution rules.**
- **Deny by default.** A permission code absent from a role's row is denied. A permission code that does not exist in the catalog is denied — an unknown code is never treated as unrestricted.
- **`conditional` is not a weaker allow.** It means: the role passes the role check *and* the stated object/state condition must additionally pass. If the condition fails, the result is `403 PERMISSION_DENIED`, identical in shape to a flat deny.
- **No rank inheritance.** `rank` is used only for the role-mutation guard. Owner does not "inherit" permissions from Admin; every Owner cell above is an explicit grant.
- **Role mutation guards.** An actor may never (a) change their own role, (b) grant a role at or above their own rank, (c) modify a member whose current rank is at or above their own, or (d) set `owner` — that path is `TransferOwnership` alone.
- **No caching.** B0 `BACKEND_DATA_GOVERNANCE.md` prohibits caching authorization decisions without formally proven invalidation. Membership, role, and the permission matrix are read per request inside the request transaction. There is therefore no stale-permission window and no cache-invalidation surface (`B1-D-006`).
- **Custom roles are deferred** (`B1-D-009`, Class C). Phase 1 has exactly six roles.
- **Enforcement location.** Authorization is enforced in application services, per B0. Serializers and views must not be the only gate, and UI visibility is never a control.

## 4. Resource authorization doctrine

> **DOCTRINE R-1.** Every tenant-owned resource is resolved through a workspace-scoped queryset derived from the *resolved* active workspace, never by public ID alone.

Conceptually required shape (not code):

```
resource = Resource.objects.for_workspace(active_workspace).get(public_id=...)   # correct
resource = Resource.objects.get(public_id=...)                                    # FORBIDDEN
```

- A miss raises `404 ENTITY_NOT_FOUND`. It must never be possible to tell a cross-tenant hit from a miss.
- The manager entry point must be the *only* way domain services reach tenant-owned tables, so that forgetting the scope is a review-visible omission rather than an invisible default.

> **DOCTRINE R-2 (relationship injection).** When a command accepts a reference to another resource, that reference is resolved through the **same** active-workspace scope, and the resulting object's `workspace_id` must equal the active workspace. A reference that resolves outside the scope is `404`, never a validation error, because a validation error would confirm existence.

| Relationship | Both sides scoped to the active workspace |
|---|---|
| Lead → Business | `business_ref` resolved in-scope; `lead.workspace_id == business.workspace_id` |
| Conversation → Lead | `lead_ref` in-scope |
| Deal → Lead, Pipeline, Stage | all three in-scope; `stage.pipeline_id == pipeline.id` |
| Task / Appointment → Lead | `lead_ref` in-scope |
| RevenueEvent → `source_ref` | polymorphic source resolved in-scope by `source_type` |
| AttributionTouchpoint → `source_ref` | in-scope |
| Payment → UpgradeQuote | B0 already requires "workspace-scoped load … **before object resolution**"; B1 restates it as the general rule |
| FileAsset → owning resource | owner in-scope; signed download URLs are single-use, short-lived, and bound to the resolved workspace |
| Membership / Invitation → Workspace | path workspace must equal the active workspace, else `404 WORKSPACE_NOT_FOUND` |

> **DOCTRINE R-3 (path/active agreement).** For routes carrying a `{workspace_id}` path segment (`/workspaces/{id}/members`, `/workspaces/{id}/invitations`), the segment is **validated against**, never substituted for, `sessions.active_workspace_id`. If the path names a different workspace, the response is `404 WORKSPACE_NOT_FOUND` even when the caller is a member of it — the correct action is `SwitchWorkspace` first. This removes the entire class of "path parameter overrides tenant" bugs.

> **DOCTRINE R-4 (mass assignment).** Request DTOs are explicit allow-lists. `workspace_id`, `public_id`, `id`, `status`, `version`, `role` on self, and every server-generated timestamp are never client-writable. B0 already requires "Serializer fields are allow-listed to prevent mass assignment"; B1 adds that any unknown field is rejected with `400 VALIDATION_ERROR` (`additionalProperties: false`), never silently ignored.

## 5. Privileged actions

| Action | Permission | Preconditions | Concurrency | Idempotency | Audit | Notify | Re-auth |
|---|---|---|---|---|---|---|---|
| `TransferOwnership` | `ownership.transfer` | actor is active Owner; target membership `active` in same workspace; workspace `active` | lock both membership rows in ascending `id`; `If-Match` on target; re-check INV-WS-1 after locking | `Idempotency-Key` required | `ownership.transferred` (actor, from, to, actor's resulting role) → `200 OwnershipTransferResult` | both members | **Class B** (`B1-D-005`) |
| `ChangeMemberRole` | `member.role.change` | rank guards; never self; never `owner` | `SELECT … FOR UPDATE` + `If-Match` | not required (naturally idempotent under `If-Match`) | `membership.role_changed` (before/after) | target | no |
| `RemoveMember` | `member.remove` | not the last active Owner; **INV-USER-1 if self**; not enforced when removing another member (`B1_WORKSPACE_MEMBERSHIP_MODEL.md` §3.1 exception) | `FOR UPDATE` + `If-Match` + owner-count guard | not required (`If-Match` makes retries safe) | `membership.removed` | target | no |
| `SuspendMembership` | `member.suspend` | not the last active Owner; never self; **INV-USER-1 must still hold for the target** — suspending their final eligible membership is `409 CONFLICT` · `last_active_membership` | `FOR UPDATE` + `If-Match` + eligible-membership-count guard | not required | `membership.suspended` | target | no |
| `InviteMember` | `member.invite` | workspace `active`; role assignable and below actor rank; not already a member; no pending invitation | partial unique `(workspace, email) WHERE pending` | **required** (already declared on the frozen operation, header transport) | `invitation.created` (never the token) | invitee, out-of-band | no |
| `CancelInvitation` | `invitation.cancel` | invitation `pending` and in the active workspace | `FOR UPDATE` + `If-Match` | not required | `invitation.cancelled` | invitee (optional) | no |
| `LeaveWorkspace` | — (self) | not the last active Owner; **INV-USER-1 must still hold** | `FOR UPDATE` + `If-Match` + eligible-membership-count guard | not required | `membership.removed` | remaining Owners | no |
| `RevokeSession` / `RevokeAllSessions` | `session.self.manage` | session belongs to the caller | `FOR UPDATE` on each row | `RevokeAllSessions` accepts a key; both are naturally idempotent | `auth.session_revoked` / `auth.sessions_revoked_all` | user | no |
| `SuspendWorkspace` / `ArchiveWorkspace` / `DeleteWorkspace` | `workspace.suspend` / `.archive` / `.delete` | Owner; `If-Match`; `DeleteWorkspace` also requires INV-USER-1 | `FOR UPDATE` on workspace | `DeleteWorkspace` requires a key | `workspace.*` | all Owners/Admins | **Class B** for delete |
| `ChangePassword` | self | current password correct | `FOR UPDATE` on `user_credentials` | not required | `auth.password_changed` | user | **yes — current password is the re-auth** |
| `SubscriptionChange` / `PaymentManage` | `subscription.change` / `payment.manage` | Billing conditions from the B0 matrix | B0 billing doctrine (unchanged) | B0 doctrine | B0 doctrine | Owners | **Class B** |

**Re-authentication scope.** Password change requires the current password — decided, not a product question. Whether owner transfer, workspace deletion, and billing changes additionally require a step-up re-authentication (password re-entry or a second factor) is a genuine product/security-policy decision that B1 must not invent; it is recorded as `B1-D-005` (**Class B**: does not block B1 architecture, must be resolved before implementation). The pipeline reserves step 15 as the insertion point so adding it later requires no re-architecture.

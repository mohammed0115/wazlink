# B1 — Workspace, User, Membership, Invitation, Owner

> **B1 status:** Target design only. No implementation is authorized.

## 1. Workspace — what a tenant is

A **Workspace** is the WazLink tenant boundary and the unit of commercial subscription. Every tenant-owned row carries `workspace_id`; every tenant-scoped query filters on the *resolved* active workspace before object resolution. Global catalogs (`plans`, `capabilities`, `roles`) are explicitly not tenant-owned, per B0.

A Workspace owns: Discovery jobs/results, Businesses, Leads, Contacts, Tasks, Appointments, Conversations, Messages, Pipelines/Stages/Deals, Automation rules/runs, RevenueEvents, AttributionTouchpoints, Subscription, UpgradeQuotes, Invoices, Payments, TaxInvoices, FileAssets, Memberships, Invitations, usage counters, and audit records. A Workspace does **not** own Users — it references them through Membership.

### 1.1 Creation

`CreateWorkspace` is issued by an authenticated User and, in one transaction, creates the `workspaces` row in `active` and the founder's `memberships` row with `role='owner'`, `status='active'`, `invited_by_user_id=NULL`. A workspace can never exist without at least one active Owner; the two writes are inseparable.

Self-registration (`Register`) always provisions a workspace for the new user, so a User always begins life with one eligible workspace.

> **INV-USER-1 (repaired in B1-FIX.1).** For every User with `users.status = 'active'`, `|E(U)| ≥ 1`, where
>
> ```
> E(U) = { W : membership(U, W).status = 'active'
>              AND W.status IN ('active', 'suspended', 'archived') }
> ```
>
> `E(U)` is **the same eligible set** defined by the canonical active-workspace predicate in `B1_AUTH_SESSION_DESIGN.md` §4.1. The two are one rule stated in two places and must never diverge.

**Why the earlier form was insufficient.** B1 previously stated INV-USER-1 as "at least one Membership whose `status <> 'removed'`". That admits a User whose every membership is `suspended`, which satisfies the old wording but yields `|E(U)| = 0` — the invariant did not guarantee the property it existed to guarantee. `status <> 'removed'` is **not** sufficient anywhere in this package.

**INV-USER-1 is a guarded invariant with exactly one enumerated exception, not a total one.** See §3.1 for the guard set, the exception, and the deterministic behavior when `|E(U)| = 0`.

### 1.2 Default workspace, naming, and identity

- There is no "default workspace" flag. The active workspace is resolved per session (see `B1_AUTH_SESSION_DESIGN.md` §4); `users.last_active_workspace_id` is a **hint**, re-validated against live membership on every use.
- `name` is mutable, audited, and non-unique. Two workspaces may share a name; identity is `WORK-*`.
- **No slug or human-readable code is modelled** (`B1-D-004`). A slug is a public namespace: it needs a uniqueness policy, a squatting policy, a rename/redirect policy, and it leaks tenant existence through enumeration. Nothing in the frozen frontend or B0 addresses a workspace by anything but its opaque ID. Deferred as Class C.

### 1.3 Multi-workspace membership

A User may hold Memberships in many Workspaces with a **different role in each**. Nothing about a role in workspace A grants anything in workspace B. A Workspace contains many Users through Membership. There is no Team entity: B0's registry states plainly that `TEAM-` is a fixture and "B0 uses Workspace/User/Membership".

### 1.4 Tenant-context propagation

| Context | How the workspace is obtained | Forbidden |
|---|---|---|
| HTTP request | `session.active_workspace_id` → live Membership re-read in the request transaction | Reading it from a body field, header, query parameter, or resource public ID |
| Application service | Explicit `workspace_id` argument in the service signature | Thread-locals or implicit "current workspace" globals |
| Celery task | Explicit `workspace_id`, `command_id`, `request_id` in the task payload | Inheriting the enqueuing request's context implicitly |
| Outbox dispatch | `workspace_id` copied onto the `OutboxEvent` at write time, inside the same transaction | Re-deriving the tenant at dispatch time |
| Webhook inbound | Provider identity → workspace resolution table (e.g. `billing_customers.provider_customer_id`, messaging WABA/phone ID). A receipt that resolves to **zero or more than one** workspace is quarantined and alerted, never guessed | Trusting a `workspace_id` present in the provider payload |
| Audit | `workspace_id` recorded from the resolved context, never from the request body | Nullable workspace on tenant-scoped actions |

### 1.5 Workspace lifecycle

States are exactly B0's: `active`, `suspended`, `archived`, `deleting`.

| FROM | COMMAND | PRECONDITIONS | TO | SIDE EFFECTS | FORBIDDEN EFFECTS | EVENT | AUDIT |
|---|---|---|---|---|---|---|---|
| — | `CreateWorkspace` | authenticated, verified user; seat quota permits 1 seat | `active` | workspace row + owner membership + subscription bootstrap request to Entitlements | creating a workspace without an owner membership | `WorkspaceCreated` | `workspace.created` |
| `active` | `UpdateWorkspace` | `workspace.manage`; `If-Match` version | `active` | name/timezone/currency/locale updated | changing `public_id` or `created_by_user_id` | `WorkspaceUpdated` | `workspace.updated` (before/after) |
| `active` | `SuspendWorkspace` | `workspace.suspend` (Owner only) **or** platform-operator action | `suspended` | all writes and provider side effects blocked; sessions remain valid; reads allowed for administrative roles | deleting data; revoking Owner/Admin read access | `WorkspaceSuspended` | `workspace.suspended` |
| `suspended` | `ResumeWorkspace` | `workspace.suspend`; no unresolved billing hold | `active` | writes re-enabled | silently clearing the suspension reason | `WorkspaceResumed` | `workspace.resumed` |
| `active` \| `suspended` | `ArchiveWorkspace` | `workspace.archive` (Owner only); `If-Match` | `archived` | normal access prevented; the workspace remains **resolvable as an active-workspace selection** so its members are never locked out of the product | removing memberships; purging data | `WorkspaceArchived` | `workspace.archived` |
| `archived` | `ResumeWorkspace` | Owner; entitlement re-check | `active` | restored | resurrecting purged data | `WorkspaceResumed` | `workspace.resumed` |
| `active` \| `suspended` \| `archived` | `DeleteWorkspace` | Owner only; `If-Match`; **INV-USER-1** holds for the requester after deletion (§3.1) | `deleting` | async audited purge job enqueued; all memberships → `removed`; all sessions whose `active_workspace_id` is this workspace → `revoked(workspace_deleting)` | synchronous destruction; deleting financial/tax/audit/webhook rows | `WorkspaceDeletionRequested` | `workspace.deletion_requested` |

`deleting` is terminal for the API: no command re-activates it. The purge job runs asynchronously, anonymizes CRM PII, and preserves legally retained financial, tax, and audit records per B0 privacy doctrine. Retention durations remain **PRODUCT / LEGAL DECISION REQUIRED** (inherited unresolved from B0, Class C).

**Write-blocking rule.** In `suspended`, `archived`, and `deleting`, every unsafe tenant operation returns `403 WORKSPACE_INACTIVE`. Reads are permitted in `suspended`/`archived` for members holding the relevant `*.view` permission, so an Owner can still see billing state and resolve the suspension. In `deleting`, all tenant operations are refused.

### 1.6 `suspended` vs `archived` — identical authorization, different meaning

**Their Phase-1 authorization effect is deliberately identical**, and B1 says so rather than implying a distinction it does not implement:

| | `suspended` | `archived` |
|---|---|---|
| Unsafe operations | `403 WORKSPACE_INACTIVE` | `403 WORKSPACE_INACTIVE` |
| Reads by `*.view` holders | permitted | permitted |
| In `E(U)` (selectable as active workspace) | yes | yes |
| Login selection priority (§4.1) | 1 (recovery-only) | 1 (recovery-only) |
| Error code | `WORKSPACE_INACTIVE` | `WORKSPACE_INACTIVE` |

**No separate error code is minted for them.** One code across `suspended`, `archived`, and `deleting` is a deliberate anti-enumeration choice: a caller cannot learn *which* lifecycle state a workspace is in beyond what `GET /workspaces` already shows them as a member. `WORKSPACE_SUSPENDED` is explicitly rejected in `B1_API_DTO_CONTRACTS.md` §4.3.

**They differ in lifecycle and business meaning, not in permissions:**

| | `suspended` | `archived` |
|---|---|---|
| Who initiates | Owner (`workspace.suspend`) **or** a platform operator, typically for a billing hold or policy action | Owner only (`workspace.archive`) — a voluntary decision to mothball |
| Intent | involuntary, corrective — *something must be resolved* | voluntary, deliberate — *this workspace is finished for now* |
| Exit condition | `ResumeWorkspace` once the underlying hold clears (no unresolved billing hold) | `ResumeWorkspace` plus an **entitlement re-check**, because the plan may have lapsed while dormant |
| Billing/entitlement posture | subscription typically still live; the hold is the point | subscription may have lapsed; reactivation must re-qualify |
| Expected duration | short, remedial | indefinite |
| Audit action | `workspace.suspended` / `workspace.resumed` | `workspace.archived` / `workspace.resumed` |
| Event | `WorkspaceSuspended` | `WorkspaceArchived` |

**On B0's wording.** `BACKEND_WORKSPACE_AUTH.md` says suspension "blocks writes and provider side effects while preserving authorized administrative access" and that archive "prevents normal access". B0 does not define "normal access". B1 reads it as *normal tenant operation* — i.e. writes — and preserves authorized reads in both states, because a member who cannot read cannot discover why they are blocked, and an Owner who cannot reach billing cannot un-suspend. This is a B1 refinement of an undefined B0 term, stated here rather than left implicit.

## 2. User — global identity

A User is a person, not a tenant member. Identity is `email_normalized` (lowercase + trim only; B0 forbids altering local-part semantics).

**Can one email belong to multiple workspaces?** **Yes — through Membership, and only through Membership.** This is verified against repository truth: `BACKEND_WORKSPACE_AUTH.md` states "User identity is global; Membership connects a User to a Workspace"; the frozen `GET /workspaces` returns a *list* of `Workspace{public_id, name, role, status}` with a per-workspace `role`, which is only meaningful if one authenticated user can hold several memberships with different roles. A single-workspace-per-user model would make that frozen contract unreachable.

| Aspect | Decision |
|---|---|
| Uniqueness | `email_normalized` unique among non-deleted users |
| Verified/unverified | `email_verified_at`. **Verification is enforced in the authorization pipeline, not at login.** An unverified user may create a session and read their own session/verification state; every other operation returns `403 EMAIL_VERIFICATION_REQUIRED`. This keeps the frozen login contract (`200/400/401/429/500` only) intact — a `403` on login would violate it. |
| Invited users | Accepting an invitation proves control of the mailbox and sets `email_verified_at` if unset |
| Display name | `display_name` required; `title` (job title) optional and display-only |
| Account state | `active` \| `disabled` \| `deleted` |
| Disable | `disabled` blocks authentication and revokes all sessions (`user_disabled`); memberships are **not** modified so the user's workspace history and last-owner protection stay intact |
| Delete | soft: pseudonymize, `deleted_at`, revoke all sessions, all memberships → `removed`. Blocked while the user is the sole Owner of any workspace not in `deleting` |
| Password | owned by `user_credentials`; changing it revokes every other session |
| Last login | `last_login_at` set on session creation; failures increment `failed_login_count` and never reveal account existence |
| Preferences | `locale`/`timezone` are **global user** preferences. `workspaces.timezone`/`currency`/`locale` are **workspace reporting** settings and govern period boundaries per ADR-011. They are different authorities and neither overrides the other. |

## 3. Membership — first-class

Membership is the authoritative relationship for workspace access. Nothing else grants tenant access: not a session, not an invitation, not a plan.

**States: `active`, `suspended`, `removed`.**

`invited` is deliberately **not** a Membership state. Pre-join state is owned by the Invitation aggregate. Modelling it in both places would give two aggregates authority over the same fact and would let a "membership that is not yet a membership" appear in `GET /workspaces` and in seat counts. Membership begins to exist at acceptance.

| FROM | COMMAND | GUARD | TO | EVENT | AUDIT |
|---|---|---|---|---|---|
| — | `AcceptInvitation` | valid unconsumed token; invitation `pending`; workspace `active`; not already an active member; **seat quota available** | `active` | `MembershipActivated` | `membership.activated` |
| — | `CreateWorkspace` | founder | `active` (role `owner`) | `MembershipActivated` | `membership.activated` |
| `active` | `ChangeMemberRole` | `member.role.change`; `If-Match`; actor rank > target's current rank **and** > new rank; never self; owner grant only via `TransferOwnership` | `active` | `MemberRoleChanged` | `membership.role_changed` (before/after) |
| `active` | `SuspendMembership` | `member.suspend`; `If-Match`; target is not the last active Owner; never self; **INV-USER-1 must still hold for the target** (§3.1) | `suspended` | `MembershipSuspended` | `membership.suspended` |
| `suspended` | `ReactivateMembership` | `member.suspend`; `If-Match`; seat quota available; user `active` | `active` | `MembershipActivated` | `membership.activated` |
| `active` \| `suspended` | `RemoveMember` | `member.remove`; `If-Match`; target is not the last active Owner; **if self, INV-USER-1 must still hold**; if the target is another member, INV-USER-1 is *not* enforced (§3.1 exception) | `removed` | `MembershipRemoved` | `membership.removed` |
| `active` \| `suspended` | `LeaveWorkspace` | self; not the last active Owner; **INV-USER-1 must still hold afterwards** (§3.1) | `removed` | `MembershipRemoved` | `membership.removed` |
| `removed` | — | terminal | — | — | — |

**Rules.**
- *Duplicate membership* is impossible: partial unique `(workspace_id, user_id) WHERE status <> 'removed'`. A second concurrent acceptance loses the constraint and receives `409 ALREADY_MEMBER`.
- *Re-invitation after removal* creates a **new** membership row (new `MEM-*`). The removed row is retained. History is never rewritten.
- *Suspended membership* authenticates but is denied every tenant operation with `403 MEMBERSHIP_INACTIVE`, and the workspace is **not** in `E(U)` — it is not selectable as the active workspace. Because a suspended membership leaves `E(U)`, suspending a member's final eligible membership is refused (§3.1).
- *Removed membership* is invisible: the workspace disappears from `GET /workspaces`, and any object in it resolves as `404`.
- *Disabled user* — membership rows are untouched; access is blocked at the user layer. Reactivating the user restores the memberships exactly.
- *Workspace suspended/archived* — memberships are untouched; access is blocked at the workspace layer.
- *Role change never mutates a session.* Because no authorization decision is cached, the very next request already sees the new role.
- *Concurrent membership mutation* — every mutation takes `SELECT … FOR UPDATE` on the membership row and requires `If-Match`. The loser gets `409 STALE_VERSION`.

### 3.1 Last-active-membership protection (INV-USER-1 enforcement)

**Guarded transitions.** A transition that would reduce an `active` User to `|E(U)| = 0` is refused with **`409 CONFLICT`** and `details.reason = "last_active_membership"`:

| Command | Guarded because | Refusal |
|---|---|---|
| `SuspendMembership` | suspension removes the membership from `E(U)`; it is a *reversible pause*, not an eviction, so leaving the target unable to reach any workspace is never the intended outcome | `409 CONFLICT` · `last_active_membership` |
| `LeaveWorkspace` | self-initiated; a user may not strand themselves | `409 CONFLICT` · `last_active_membership` |
| `RemoveMember` **on self** | self-initiated leave by another name | `409 CONFLICT` · `last_active_membership` |
| `DeleteWorkspace` | terminal for every membership in the workspace | `409 CONFLICT` · `last_workspace` (retained: the actionable fact is the workspace, not the membership) |

**Enforcement is transactional and PostgreSQL-authoritative.** Inside the mutating transaction, after locking the membership row, the service re-counts the target's eligible memberships under lock:

```
SELECT count(*) FROM memberships m JOIN workspaces w ON w.id = m.workspace_id
 WHERE m.user_id = :target AND m.status = 'active'
   AND w.status IN ('active','suspended','archived')
 FOR UPDATE OF m
```

and refuses if the count would reach zero. No Redis lock, counter, or cache participates. This mirrors the INV-WS-1 owner-count guard exactly (§5), so the two invariants use one enforcement pattern.

**No new error code.** `409 CONFLICT` with a `details.reason` is the same mechanism B1 already uses for `invitation_pending`, `membership_removed`, and `last_workspace`. A dedicated `LAST_ACTIVE_MEMBERSHIP_REQUIRED` code is rejected for the reason `LAST_WORKSPACE_REQUIRED` was rejected: it is a rare guard whose remedy is fully carried by the reason string.

**The one enumerated exception: `RemoveMember` on another member.** An authorized administrator removing a *different* member is **not** guarded, and is the single transition permitted to leave a User with `|E(U)| = 0`.

The alternative was considered and rejected. Guarding it would mean a workspace could not evict its own last single-workspace member — one User's *global* state would veto a tenant's control of its own membership list. That is the mirror image of the isolation violation this package forbids in the other direction (`B1-D-A17`), and with `SuspendMembership` also guarded it would leave an administrator with **no** way to revoke access at all. Removal is terminal and deliberate; a full sign-out is its honest, expected consequence.

**Global identity is never disabled as compensation.** When a guard fires, B1 rejects *the membership transition* and changes nothing else. No path in B1 lets a workspace administrator set `users.status` — `DisableUser`/`DeleteUser` are platform-operator commands unreachable from any tenant role (`B1-D-A17`). A User who reaches `|E(U)| = 0` therefore keeps an `active` global account.

**Deterministic behavior at `|E(U)| = 0`.** Exactly one behavior, stated once and referenced everywhere:

| Aspect | Behavior |
|---|---|
| Global account | stays `active`. Never disabled, never deleted. |
| Existing sessions | revoked `membership_removed`; audit `session.revoked_no_workspace` (already specified) |
| Login | **succeeds.** A session is created with `sessions.active_workspace_id = NULL` and the response carries `workspace_ref: null` (`B1-D-A23`; see `B1_AUTH_SESSION_DESIGN.md` §4.2). |
| That session | is a **no-workspace session**: every tenant-scoped operation fails at pipeline step 5 with `404 WORKSPACE_NOT_FOUND`. It reaches only the non-tenant surface. |
| Recovery | `POST /invitations/accept` (join an existing workspace) or `POST /workspaces` (create one). Both are non-tenant-scoped and therefore reachable from a no-workspace session. |
| Alerting | **none.** This is a supported product state, not an invariant violation. No `identity.invariant_violation` alert is raised. |

Recovery is why login must succeed rather than be refused: every recovery path in B1 requires an authenticated session, so refusing login would make `|E(U)| = 0` a permanent, tenant-inflicted lockout of a global identity — precisely what `B1-D-A17` exists to prevent.

## 4. Invitation

An Invitation is a workspace-scoped, expiring, single-use offer to join at a stated role.

**States: `pending`, `accepted`, `cancelled`, `expired`.**

| Aspect | Decision |
|---|---|
| Target | `email_normalized` at issue time. The invitation binds to the **email**, not to a user account, so it works whether or not the invitee has registered. |
| Role | any assignable role; **`owner` is forbidden** (`role <> 'owner'` check). Ownership is only conferred by `TransferOwnership`. |
| Token | ≥256-bit CSPRNG value. It is **never returned in any API response**, including the `201` creation response and the resend response. It exists in cleartext only inside the issuing transaction, is handed to the delivery boundary out-of-band (`B1_COMMAND_EVENT_CATALOG.md` §3.3), and is stored only as `sha256(token)`. See `B1_API_DTO_CONTRACTS.md` §3 `Invitation`. |
| Token storage/logging | the raw token never enters logs, audit payloads, events, error messages, or the outbox. Audit records the `WINV-*` public ID only. |
| Expiry | 7 days. Evaluated server-side against `expires_at` at use time, never trusted from the client. |
| Acceptance | authenticated user whose `email_normalized` equals the invitation's; consumes the invitation and creates the Membership in one transaction |
| Cancellation | `invitation.cancel`; only from `pending`; nulls `token_hash` |
| Resend | `invitation.resend`; only from `pending`; **rotates the token** (old token dies), extends `expires_at`, increments `resend_count`. The new raw token is delivered out-of-band exactly as at issue and is **not** in the response. Rate-limited to **5 resends per invitation per 24h** and **20 per workspace per hour** (`B1-D-014`). |
| Duplicate invite | partial unique `(workspace_id, email_normalized) WHERE status='pending'` ⇒ `409 CONFLICT` with `details.reason="invitation_pending"`. The correct action is resend, not a second invitation. |
| Already a member | `409 ALREADY_MEMBER` at invite time and again at acceptance time (the state can change in between) |
| Changed email | the invitation is immutable in `email_normalized`. A user whose account email differs from the invitation email gets `403 PERMISSION_DENIED`; the invitation must be cancelled and reissued. |
| Expired token | `409 INVITATION_EXPIRED` |
| Reused token | `409 INVITATION_ALREADY_ACCEPTED` |
| Cancelled token | `409 INVITATION_CANCELLED` |
| Unknown/invalid token | `404 ENTITY_NOT_FOUND` — indistinguishable from "never existed", which is what prevents token probing |
| Concurrent acceptance | `SELECT … FOR UPDATE` on the invitation row plus the membership partial unique index. Exactly one acceptance wins; the other gets `409 INVITATION_ALREADY_ACCEPTED` |
| Invite to non-`active` workspace | `403 WORKSPACE_INACTIVE`; acceptance into a non-`active` workspace is likewise refused |
| Unauthorized inviter | `403 PERMISSION_DENIED`; if the actor has no membership in the target workspace at all, `404 WORKSPACE_NOT_FOUND` (no existence disclosure) |
| Seat quota | checked at **acceptance**, not at invitation, because a pending invitation consumes no seat. Failure is `403 QUOTA_EXHAUSTED`. |
| Expiry sweep | a scheduled Celery job transitions overdue `pending` rows to `expired`; acceptance also evaluates expiry inline so a late sweep can never permit a stale acceptance |

## 5. Owner semantics

| Question | Decision |
|---|---|
| Is Owner a Membership role? | **Yes.** `role='owner'` on `memberships`. There is no separate owner column on `workspaces`; `created_by_user_id` is provenance only and confers nothing. |
| Can multiple owners exist? | **Yes.** Co-ownership is permitted and is the recommended way to avoid a single point of failure. |
| Who may promote another Owner? | Only an active Owner, and only via `TransferOwnership` (`ownership.transfer`). `ChangeMemberRole` may never set `owner`. |
| Who may demote an Owner? | Only another active Owner, and only while ≥1 active Owner would remain. An Owner may demote themselves under the same guard. |
| Last-owner protection | **Invariant INV-WS-1: every Workspace not in `deleting` has ≥1 Membership with `role='owner'` and `status='active'`.** Enforced transactionally: `SELECT count(*) … WHERE workspace_id=? AND role='owner' AND status='active' FOR UPDATE` inside the mutating transaction, refusing with `409 LAST_OWNER_REQUIRED`. Guarded commands: `ChangeMemberRole` (demoting an owner), `SuspendMembership`, `RemoveMember`, `LeaveWorkspace`, and the user-disable/delete flows. |
| Owner leaving | permitted only if another active Owner remains, otherwise `409 LAST_OWNER_REQUIRED`. The product path is transfer-then-leave. |
| Owner account disabled | the Owner membership stays `active` but the user cannot authenticate. **This can strand a workspace** if there is exactly one Owner. Mitigation: `UserDisabled` on a sole Owner raises a `workspace.owner_unavailable` operational alert; recovery is a platform-operator action, audited, out of the tenant API. The precise operator recovery procedure is `B1-D-011` (Class B). |
| Transfer | `TransferOwnership{target_membership_ref, version}`: in one transaction, target → `owner`, and the actor is demoted to a stated role (default `admin`) or retained as co-owner if `retain_ownership=true`. Both membership rows are locked in a **deterministic order (ascending `memberships.id`)** to make deadlock impossible. |
| Concurrent transfer | two simultaneous transfers both lock the same rows; the second sees a bumped `version` and receives `409 STALE_VERSION`. INV-WS-1 is re-checked after locking, so no interleaving can produce zero owners. |
| Audit | `ownership.transferred` records actor, workspace, previous owner membership, new owner membership, and the resulting role of the previous owner. Both affected members are notified. |

**Orphan prevention summary.** A workspace can reach zero active Owners only through the sole-Owner-disabled path, which is detected and alerted rather than silently allowed. Every tenant-API path is blocked by INV-WS-1.

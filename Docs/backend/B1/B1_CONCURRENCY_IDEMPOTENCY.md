# B1 — Concurrency and Idempotency

> **B1 status:** Target design only. Inherits ADR-010 (integer `version`, `409` on stale write) and `BACKEND_IDEMPOTENCY_STANDARD.md` verbatim. **No second idempotency system is introduced.**

## 1. Concurrency primitives

| Primitive | Where used | Inherited from |
|---|---|---|
| Integer `version` + `If-Match` | `workspaces`, `memberships`, `invitations`, `users`, `sessions` | ADR-010 |
| `SELECT … FOR UPDATE` row lock | every identity mutation | B0 "Critical … transitions also use database row locks and unique constraints" |
| Partial unique index | live membership, pending invitation, session key hash, user email | B0 data-model doctrine |
| Deterministic lock ordering | multi-row commands (ownership transfer) | B1 addition to prevent deadlock |
| `transaction.atomic` before distributed locks | all of the above | B0 `BACKEND_DATA_GOVERNANCE.md` |

**Redis is never used for identity truth.** No Redis lock, counter, or cache participates in deciding a membership, role, session, invitation, seat, or ownership outcome.

## 2. Race analysis — authoritative outcomes

| # | Race | Mechanism | Authoritative outcome |
|---|---|---|---|
| R1 | Two admins change the **same membership's role** concurrently | `FOR UPDATE` on the membership row + `If-Match` | Both serialize. The first commits and bumps `version`. The second's `If-Match` no longer matches ⇒ `409 STALE_VERSION`, no write. The role is exactly one of the two requested values, never a merge. |
| R2 | Two admins concurrently **remove** and **change the role of** the same member | same row lock | Serialized. If removal commits first, the role change sees `status='removed'` ⇒ `409 CONFLICT` (`details.reason="membership_removed"`). If the role change commits first, removal proceeds on the bumped version only if the client re-reads; otherwise `409 STALE_VERSION`. |
| R3 | Two concurrent **owner transfers** in the same workspace | both lock the actor's and target's membership rows in **ascending `memberships.id`** (deadlock-free), then re-count active owners under lock | One commits. The second finds a bumped `version` ⇒ `409 STALE_VERSION`. INV-WS-1 is re-evaluated after locking, so no interleaving yields zero owners. |
| R4 | Owner transfer racing **removal of the target member** | overlapping row locks | Serialized. Transfer to a `removed` membership ⇒ `409 CONFLICT`. Removing a member who just became the sole Owner ⇒ `409 LAST_OWNER_REQUIRED`. |
| R5 | **Member removed while their request is executing** | the membership is re-read under the request transaction at pipeline step 6 | The in-flight request completes or fails atomically on its own snapshot; the *next* request is denied. There is no partially-authorized write, because the authorization read and the domain write share one transaction. |
| R6 | **Invitation accepted twice** (double-click / retry) | `FOR UPDATE` on the invitation + partial unique `(workspace_id, user_id) WHERE status<>'removed'` | Exactly one Membership is created. The second attempt gets `409 INVITATION_ALREADY_ACCEPTED`; if it carries the same `Idempotency-Key` header and body, it instead **replays the original `201 Membership`** and is not a second acceptance. |
| R7 | **Invitation accepted while being cancelled** | both take `FOR UPDATE` on the invitation row | Serialized. Cancel-first ⇒ acceptance returns `409 INVITATION_CANCELLED`. Accept-first ⇒ cancel returns `409 INVITATION_ALREADY_ACCEPTED`. The invitation never ends in a state where a membership exists but the invitation reads `cancelled`. |
| R8 | Two invitees **accept the last seat** | `FOR UPDATE` on the workspace's `seats` `usage_counters` row | One commits; the other gets `403 QUOTA_EXHAUSTED` with its invitation still `pending`. |
| R9 | **Workspace suspended during a write** | the workspace row is read (and, for lifecycle commands, locked) inside the request transaction at step 7 | A write that began before the suspension commits on its snapshot; every request after the suspension commit gets `403 WORKSPACE_INACTIVE`. No half-applied domain state. |
| R10 | **Session revoked during an active request** | session validity is read at step 2 in the request transaction | The in-flight request completes; the next is `401 SESSION_REVOKED`. Revocation is not retroactive — making it so would require aborting committed work. |
| R11 | **Role changed during an active request** | no authorization caching; role is read at step 8 in the same transaction | The request is decided against exactly one role — whichever the transaction observed. There is no window where an old role authorizes a write that commits after the change, because both reads and the write share a snapshot. |
| R12 | **Two concurrent workspace switches** on one session | `FOR UPDATE` on the `sessions` row | Serialized; last committed wins. The session ends in one of the two requested workspaces. Both switches are audited. |
| R13 | Two concurrent `CreateWorkspace` with the same `Idempotency-Key` | `IdempotencyRecord` unique constraint written in the same transaction as the workspace | One creates; the other returns the stored terminal response, or `409` while in progress. Never two workspaces. |
| R14 | **Duplicate invitation** to the same email | partial unique `(workspace_id, email_normalized) WHERE status='pending'` | Second ⇒ `409 CONFLICT` (`details.reason="invitation_pending"`). |
| R15 | **Registration with the same email** twice concurrently | unique `email_normalized WHERE status<>'deleted'` | One user is created; the other request returns the same anti-enumeration `202` and creates nothing. |
| R16 | **Password change racing a login** | `FOR UPDATE` on `user_credentials` | The login either sees the old hash (and its session is then revoked by the change's "revoke all other sessions" step) or the new hash. No session survives a committed password change. |
| R17 | **Two admins concurrently suspend the last two eligible memberships of one user** (different workspaces) | each transaction locks its own membership row and then re-counts the target's eligible memberships with `SELECT count(*) … FOR UPDATE OF m` across `memberships ⋈ workspaces` | Serialized on the shared membership rows. The first commits and drops `\|E(U)\|` to 1; the second's count under lock reads 1 and refuses `409 CONFLICT` · `last_active_membership`. **`\|E(U)\|` can never reach 0 through suspension**, however the two requests interleave. |
| R18 | **`LeaveWorkspace` racing an admin's `SuspendMembership` on the user's other eligible membership** | both re-count `E(U)` under lock | Serialized. Whichever commits first leaves `\|E(U)\| = 1`; the second reads 1 under lock and is refused. The user is never stranded by an interleaving. |
| R19 | **`RemoveMember` racing the target's login** | removal commits in its own transaction; login resolves `E(U)` in its own | Both outcomes are valid and defined. Login before the removal commits ⇒ a session on that workspace, killed on its next request by §4.4 re-resolution. Login after ⇒ a no-workspace session (`workspace_ref: null`, §4.6). There is no third outcome and no window in which tenant data is served from a removed membership, because step 6 re-reads membership inside the request transaction. |

## 3. Idempotency requirements

Reuses B0's `IdempotencyRecord` doctrine exactly: the key is scoped by **workspace + authenticated principal + endpoint/command + request-body hash**; the record is written in the same transaction as the durable state; reuse with a different body ⇒ `409 IDEMPOTENCY_CONFLICT`; in-progress reuse ⇒ `409` or a safe in-progress representation; retention ≥24h for normal commands.

| Command | `Idempotency-Key` | Why |
|---|---|---|
| `Register` | **required** (header) | public, retried by clients and by email-link double submits; must never create two users |
| `CreateWorkspace` | **required** | a duplicate would create a second tenant with a second owner membership and a second seat |
| `InviteMember` | **required** (already declared on the frozen B0 operation as a header) | duplicate invitations send duplicate emails with distinct live tokens. A replay returns the stored `201 Invitation` and mints no second token. |
| `AcceptInvitation` | **required** | the highest-risk retry: without it a network retry races itself into `409` instead of replaying success |
| `TransferOwnership` | **required** | a retry after an ambiguous timeout must not attempt a second transfer against a changed owner set |
| `DeleteWorkspace` | **required** | irreversible lifecycle transition |
| `RevokeAllSessions` | **optional** | naturally idempotent (revoking twice is a no-op) but a key gives a stable replayed response |
| `ChangeMemberRole`, `SuspendMembership`, `RemoveMember`, `CancelInvitation`, `ResendInvitation`, `UpdateWorkspace`, `SuspendWorkspace`, `ArchiveWorkspace`, `ResumeWorkspace` | **not required** | each carries `If-Match`; a retry with the consumed version returns `409 STALE_VERSION` rather than re-applying, which is the correct at-most-once semantics |
| `Login`, `Logout`, `SwitchWorkspace`, `RevokeSession`, `ChangePassword`, `VerifyEmail`, `PasswordReset*` | **not applicable** | `Login` has no `Idempotency-Key` parameter in the frozen contract and must not gain one; the rest are naturally idempotent or single-use-token-guarded |

**Transport.** `Idempotency-Key` is an HTTP **header** on every operation above, exactly as `BACKEND_IDEMPOTENCY_STANDARD.md` and the frozen `components.parameters.IdempotencyKey` (`in: header`) define it. **No B1 request DTO carries an idempotency field**, so `additionalProperties: false` never rejects a canonical header-only client.

**Retention for identity commands is 24 hours** (the B0 "normal command" tier). The 7-day tier is reserved by B0 for payment/webhook operations and is not extended to identity.

## 4. Version exposure

Every editable identity DTO exposes `version` (B0: "All editable resources expose `version`"). `Workspace`, `Membership`, and `Invitation` responses carry it; `If-Match` carries it back. `User` and `Session` responses carry `version` only on the self-service endpoints that mutate them.

## 5. What is explicitly not used

- **No Redis lock** for any identity decision.
- **No advisory locks** where a row lock suffices.
- **No optimistic retry loops** inside a service that would silently re-apply a command the client did not re-authorize; a stale write is surfaced as `409 STALE_VERSION` and returned to the client.
- **No `last-write-wins` on domain fields.** The only last-write-wins in B1 is `sessions.active_workspace_id` under R12, where both outcomes are equally valid and explicitly requested by the same principal.

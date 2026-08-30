# B1 — Tenant & Identity Command and Event Catalog

> **B1 status:** Target catalog only. Events are delivered through the B0 transactional outbox (ADR-005) and are never an alternative canonical write store.

Inherited event envelope (B0 `BACKEND_COMMAND_EVENT_CATALOG.md`): every event carries **event ID, workspace, aggregate public ID, occurred timestamp, actor/system source, schema version, and correlation/request ID**. Every command carries **workspace, actor, request ID, idempotency key, and authorization context**.

PII classes reference `BACKEND_PRIVACY_AND_DATA_HANDLING.md`: *none*, *Contact PII* (email/name), *Operational*.

## 1. Commands

| Command | Aggregate | Actor | Permission | Idempotency | Concurrency | Emits |
|---|---|---|---|---|---|---|
| `Register` | User | anonymous | — | key required | unique `email_normalized` | `UserRegistered` |
| `VerifyEmail` | User | anonymous (token) | — | single-use token | token consumption | `UserEmailVerified` |
| `RequestPasswordReset` | User | anonymous | — | — | token supersession | *(none — no event; email side effect only)* |
| `ResetPassword` | User | anonymous (token) | — | single-use token | `FOR UPDATE` credentials | `UserPasswordChanged`, `SessionRevoked`×N |
| `ChangePassword` | User | self | — | — | `FOR UPDATE` credentials | `UserPasswordChanged`, `SessionRevoked`×N |
| `DisableUser` / `EnableUser` / `DeleteUser` | User | platform operator | operator | — | `FOR UPDATE` user + owner guard | `UserDisabled` / `UserEnabled` / `UserDeleted` |
| `Login` | Session | anonymous | — | — | key rotation | `SessionCreated` |
| `Logout` | Session | self | — | — | `FOR UPDATE` session | `SessionRevoked` |
| `RevokeSession` | Session | self | `session.self.manage` | — | `FOR UPDATE` session | `SessionRevoked` |
| `RevokeAllSessions` | Session | self | `session.self.manage` | key optional | `FOR UPDATE` per row | `SessionRevoked`×N |
| `ExpireSessions` | Session | `system:scheduler` | — | — | `FOR UPDATE` per row | `SessionExpired` |
| `SwitchWorkspace` | Session | self | — | — | `FOR UPDATE` session | `ActiveWorkspaceSwitched` |
| `CreateWorkspace` | Workspace | verified user | — | key required | idempotency unique | `WorkspaceCreated`, `MembershipActivated` |
| `UpdateWorkspace` | Workspace | member | `workspace.manage` | — | `If-Match` | `WorkspaceUpdated` |
| `SuspendWorkspace` / `ResumeWorkspace` / `ArchiveWorkspace` | Workspace | Owner | `workspace.suspend` / `.archive` | — | `If-Match` | `WorkspaceSuspended` / `WorkspaceResumed` / `WorkspaceArchived` |
| `DeleteWorkspace` | Workspace | Owner | `workspace.delete` | key required | `If-Match` + INV-USER-1 | `WorkspaceDeletionRequested`, `MembershipRemoved`×N, `SessionRevoked`×N |
| `InviteMember` | Invitation | member | `member.invite` | key required | partial unique | `MemberInvited` |
| `ResendInvitation` | Invitation | member | `invitation.resend` | — | `If-Match` | `InvitationResent` |
| `CancelInvitation` | Invitation | member | `invitation.cancel` | — | `If-Match` | `InvitationCancelled` |
| `ExpireInvitation` | Invitation | `system:scheduler` | — | — | `FOR UPDATE` | `InvitationExpired` |
| `AcceptInvitation` | Invitation + Membership | authenticated invitee | — | key required | `FOR UPDATE` + partial unique + seat lock | `InvitationAccepted`, `MembershipActivated` |
| `ChangeMemberRole` | Membership | member | `member.role.change` | — | `If-Match` + INV-WS-1 | `MemberRoleChanged` |
| `SuspendMembership` / `ReactivateMembership` | Membership | member | `member.suspend` | — | `If-Match` + INV-WS-1 + **INV-USER-1 (suspend)** (+ seat lock on reactivate) | `MembershipSuspended` / `MembershipActivated` |
| `RemoveMember` | Membership | member | `member.remove` | — | `If-Match` + INV-WS-1 + **INV-USER-1 when self** | `MembershipRemoved` |
| `LeaveWorkspace` | Membership | self | — | — | `If-Match` + INV-WS-1 + INV-USER-1 | `MembershipRemoved` |
| `TransferOwnership` | Membership ×2 | Owner | `ownership.transfer` | key required | ordered `FOR UPDATE` + `If-Match` + INV-WS-1 | `OwnershipTransferred`, `MemberRoleChanged`×2 |

**31 commands.** No command duplicates another's effect, and every state transition in `B1_STATE_MACHINES.md` is reachable by exactly one command.

**State-machine mapping: 30 of 31 are mapped; `RequestPasswordReset` is intentionally stateless** and appears in no machine (`B1_STATE_MACHINES.md` §6). `UNMAPPED_STATE_COMMANDS = 1`. This document does **not** claim that every command appears in a state machine.

Three are system/operator commands with no tenant HTTP surface (`ExpireInvitation`, `ExpireSessions`, and the operator `DisableUser`/`EnableUser`/`DeleteUser` family).

**`Idempotency` column transport.** "key required" / "key optional" always means the **`Idempotency-Key` HTTP header** (`BACKEND_IDEMPOTENCY_STANDARD.md`). No command takes an idempotency value in its request body.

## 2. Events

| Event | Owner domain | Payload (beyond the envelope) | PII | Consumers | Outbox | Idempotency expectation |
|---|---|---|---|---|---|---|
| `UserRegistered` | Identity & Access | `user_ref`, `registered_at` | none | Notifications (verification email) | **required** | consumer keyed by `(event_id)`; re-delivery must not send a second email within the dedup window |
| `UserEmailVerified` | Identity & Access | `user_ref`, `verified_at` | none | Entitlements, Notifications | required | idempotent set |
| `UserPasswordChanged` | Identity & Access | `user_ref`, `changed_at`, `reason` (`change`\|`reset`) | none | Notifications, Security monitoring | required | idempotent notify |
| `UserDisabled` / `UserEnabled` / `UserDeleted` | Identity & Access | `user_ref`, `at`, `reason` | none | Workspace (owner-availability alert), Audit | required | idempotent |
| `SessionCreated` | Identity & Access | `session_ref`, `user_ref`, `workspace_ref` (**nullable** — null when `\|E(U)\| = 0`), `ip_hash`, `user_agent_digest` | Operational | Security monitoring | required | idempotent |
| `SessionRevoked` | Identity & Access | `session_ref`, `user_ref`, `reason` | Operational | Security monitoring | required | idempotent |
| `SessionExpired` | Identity & Access | `session_ref`, `user_ref` | Operational | Security monitoring | optional (emitted by the `ExpireSessions` sweep or by inline expiry at validation) | idempotent |
| `ActiveWorkspaceSwitched` | Identity & Access | `session_ref`, `from_workspace_ref` (nullable), `to_workspace_ref` | none | Audit, Analytics | required | idempotent |
| `WorkspaceCreated` | Workspace | `workspace_ref`, `owner_membership_ref`, `created_by_ref`, `name` | none | Entitlements (subscription bootstrap), Billing, Notifications | **required** | consumer must not create two subscriptions for one `workspace_ref` |
| `WorkspaceUpdated` | Workspace | `workspace_ref`, changed field names (values only for non-PII fields) | none | Analytics, Audit | required | idempotent |
| `WorkspaceSuspended` / `WorkspaceResumed` / `WorkspaceArchived` | Workspace | `workspace_ref`, `at`, `reason` | none | Entitlements, Billing, Notifications | required | idempotent |
| `WorkspaceDeletionRequested` | Workspace | `workspace_ref`, `requested_by_ref`, `requested_at` | none | **Purge worker**, Billing, Entitlements, Files | **required** | worker keyed by `(workspace_ref)`; re-delivery must resume, never restart destructively |
| `MemberInvited` | Workspace | `invitation_ref`, `workspace_ref`, `role`, `invited_by_ref`, `email_masked` | **Contact PII (masked)** | Notifications (email delivery) | **required** | the raw token is passed to the notifier **out-of-band by reference**, never in the event payload |
| `InvitationResent` | Workspace | `invitation_ref`, `resend_count`, `expires_at` | Contact PII (masked) | Notifications | required | same token rule |
| `InvitationCancelled` / `InvitationExpired` | Workspace | `invitation_ref`, `at` | none | Notifications, Analytics | required | idempotent |
| `InvitationAccepted` | Workspace | `invitation_ref`, `membership_ref`, `user_ref` | none | Entitlements (seat), Notifications, Analytics | required | idempotent; seat already committed in the same transaction |
| `MembershipActivated` | Workspace | `membership_ref`, `workspace_ref`, `user_ref`, `role` | none | Entitlements (seat), Analytics, Notifications | required | idempotent |
| `MembershipSuspended` / `MembershipRemoved` | Workspace | `membership_ref`, `at`, `actor_ref` | none | Entitlements (seat release), Identity (session re-resolution), Notifications | required | idempotent |
| `MemberRoleChanged` | Workspace | `membership_ref`, `from_role`, `to_role`, `actor_ref` | none | Notifications, Audit, Analytics | required | idempotent |
| `OwnershipTransferred` | Workspace | `workspace_ref`, `from_membership_ref`, `to_membership_ref`, `previous_owner_new_role` | none | Notifications, Billing, Audit | **required** | idempotent; consumers must tolerate re-delivery without re-notifying twice inside the dedup window |

**26 event types.** Every event maps to at least one command in §1, and every command that changes durable state emits at least one event.

## 3. Payload rules

1. **Never in any payload:** password, password hash, session key, `session_key_hash`, CSRF secret, raw invitation token, raw verification/reset token, raw IP address, raw user agent.
2. **`email_masked` only.** Invitation events carry a masked address for operator diagnostics; the full address needed to actually send the email is read by the notifier from the `invitations` row under its own authorization, not carried on the bus.
3. **Token handoff (invitation, email-verification, and password-reset tokens alike).** `MemberInvited` and `InvitationResent` carry the `WINV-*` reference only; `UserRegistered` and `UserPasswordChanged` carry the `USR-*` reference only. In every case the notification worker retrieves the single-use raw token through a **restricted, one-shot internal handoff bound to the issuing transaction's `command_id`**. The raw token never lands in an event payload, the `outbox_events` table, a Celery argument, a log line, an audit row, or an API response. This is the **only** path by which any raw credential token leaves the issuing transaction, and it is the delivery boundary referenced by `B1_API_DTO_CONTRACTS.md` §3.1.
4. **Refs, not embeddings.** Events carry `EntityRef`s, never denormalized aggregates, so a consumer cannot act on a stale copy of authorization-relevant state.
5. **Outbox coupling.** Every "required" event is written to `outbox_events` in the same transaction as its durable state change (ADR-005). A dispatcher publishes to Celery. Consumers are idempotent by `(command_id, effect_type)` per the B0 idempotency standard.
6. **No event grants authority.** No consumer may treat an event as authorization. A consumer that needs to act on a workspace re-reads live state under that workspace's scope.

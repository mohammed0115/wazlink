# B1 — Identity Privacy and Audit Model

> **B1 status:** Target policy only. Inherits `BACKEND_PRIVACY_AND_DATA_HANDLING.md` and the immutable `audit_logs` doctrine.

## 1. Identity data classification

| Datum | B0 class | Storage | Logging | Masking | Returned to client |
|---|---|---|---|---|---|
| `email` (raw) | Contact PII | `users.email` | **never** in application logs | `m•••@example.test` on **every** invitation surface — creation, list, and read alike | only to the account owner (their own `UserProfile`). The `Invitation` DTO returns `email_masked` on all surfaces including creation. |
| `email_normalized` | Contact PII | `users`, `invitations` | never | as above | never |
| `display_name` | Contact PII | `users` | only inside audit `details` where the actor identity is the point | none | yes |
| `title` (job title) | Contact PII (low) | `users` | never | none | yes |
| `password` / `password_hash` | **Credential** | `user_credentials` (hash only) | **never, under any circumstance** | n/a | **never** |
| Session key | **Credential** | cookie only; `sha256` in `sessions` | **never** | n/a | never (the cookie is set, not serialized) |
| Invitation / verification / reset token | **Credential** | `sha256` of a ≥256-bit CSPRNG value | **never** | n/a | **never returned by any API response.** Delivered only through the out-of-band delivery boundary (`B1_COMMAND_EVENT_CATALOG.md` §3.3). |
| CSRF token/secret | **Credential** | framework store | never | n/a | via the CSRF cookie/header only |
| IP address | Operational | `sessions.ip_hash` (keyed hash), never raw | only as `ip_hash` | n/a | **never** — deliberately absent from `SessionSummary` |
| User agent | Operational | `user_agent_digest` (normalized family) | digest only | n/a | coarse `user_agent_label` only |
| Session metadata (`created_at`, `last_seen_at`, `expires_at`, `status`) | Operational | `sessions` | yes | none | to the owning user only |
| Audit `details` before/after | Operational + whatever the field was | `audit_logs` JSONB | yes | credential fields excluded at write time | to `audit.view` holders only |

**Rule P-1.** A credential-class datum has exactly one storage location and one irreversible form. It never appears in a log line, an audit row, an event payload, an outbox row, a Celery argument, an error message, a Sentry breadcrumb, an OpenTelemetry attribute, **or any client response**. Every raw token (invitation, email verification, password reset) is a **≥256-bit CSPRNG** opaque value stored only as `sha256(token)`, and reaches its subject solely through the out-of-band delivery boundary. SHA-256 without stretching is correct precisely because the input is high-entropy; no salt, pepper, or KDF is specified.

**Rule P-2.** The IP address is reduced to a keyed hash at the boundary. B1 deliberately does not surface IP or geolocation in the session list: doing so turns a security feature into a location-history feature and would need a privacy decision that B0 has not made.

**Rule P-3.** Deletion is anonymization, not erasure, wherever a relational or audit reference exists — inherited verbatim from B0 ("anonymize rather than erase relational history when necessary"). `users.public_id` survives deletion so audit rows stay resolvable.

**Rule P-4.** Retention durations for identity data (sessions, audit, invitations, deleted-user tombstones) are **PRODUCT / LEGAL DECISION REQUIRED**, inherited unresolved from B0. B1 does not invent them. Structural requirement: every retention-bearing table has an explicit timestamp column so that a policy, once decided, is implementable without a schema change.

**Rule P-5 (retention ownership).** Session rows are owned by Identity & Access; invitation rows by the Workspace domain; audit rows by the Audit domain. A workspace deletion purge may anonymize CRM PII but **must not delete audit, financial, or tax records**, per B0.

## 2. Audit record shape

Inherited: `audit_logs` is append-only, immutable, workspace-scoped, `AUD-*` public ID, "immutable/no secrets".

| Field | Content |
|---|---|
| `public_id` | `AUD-*` |
| `workspace_id` | resolved active workspace; **nullable only** for pre-tenant auth actions (§3) |
| `actor_type` | `user` \| `system:scheduler` \| `system:webhook` \| `operator` \| `anonymous` |
| `actor_user_ref` | `USR-*`, null for non-user actors |
| `action` | dotted action code from §3 |
| `target_type` / `target_ref` | e.g. `membership` / `MEM-*` |
| `before` / `after` | JSONB, **credential fields excluded at write time**, not filtered at read time |
| `result` | `succeeded` \| `denied` \| `failed` |
| `error_code` | the B0/B1 error code when `result <> 'succeeded'` |
| `request_id` / `correlation_id` | B0 correlation identifiers |
| `source_ip_hash` / `user_agent_digest` | reduced forms only |
| `occurred_at` | UTC |
| `permission_matrix_version` | which version of the role matrix produced the decision — makes an authorization verdict reproducible |

**Never recorded:** password, password hash, session key or its hash, CSRF secret, raw invitation/verification/reset token, or any authentication credential. This is enforced by an allow-list at the audit writer, not by a redaction pass.

## 3. Identity audit actions

| Action | Actor | Workspace | Result values |
|---|---|---|---|
| `auth.registered`, `auth.register_duplicate_suppressed` | anonymous | **null** | succeeded |
| `auth.email_verified` | anonymous(token) | null | succeeded, failed |
| `auth.login_succeeded` | user | resolved workspace, or **null** with `details.no_eligible_workspace = true` when `\|E(U)\| = 0` | succeeded |
| `auth.login_failed` | anonymous | null | denied |
| `auth.logout` | user | active workspace | succeeded |
| `auth.password_changed`, `auth.password_reset_requested`, `auth.password_reset_completed` | user / anonymous | null | succeeded, denied |
| `auth.session_revoked`, `auth.sessions_revoked_all`, `auth.session_expired` | user / system | null | succeeded |
| `auth.invitation_token_rejected` | anonymous | null | denied |
| `session.workspace_switched`, `session.workspace_switch_denied`, `session.workspace_reresolved`, `session.revoked_no_workspace` | user / system | to/from workspace | succeeded, denied |
| `workspace.created`, `.updated`, `.suspended`, `.resumed`, `.archived`, `.deletion_requested` | user | workspace | succeeded, denied |
| `invitation.created`, `.resent`, `.cancelled`, `.expired`, `.accepted`, `.accept_rejected` | user / scheduler | workspace | succeeded, denied |
| `membership.activated`, `.suspended`, `.removed`, `.role_changed` | user | workspace | succeeded, denied |
| `ownership.transferred` | user | workspace | succeeded, denied |
| `user.disabled`, `.enabled`, `.deleted` | operator | null | succeeded, denied |
| `authz.permission_denied`, `.object_not_in_scope`, `.workspace_path_mismatch`, `.relationship_out_of_scope`, `.role_change_denied`, `.invite_role_denied`, `.last_owner_blocked`, `.last_active_membership_blocked` | user | active workspace | denied |
| `security.csrf_rejected`, `.rate_limited`, `.unknown_field_rejected`, `.credential_stuffing_suspected` | any | nullable | denied |
| `operator.*` | operator | nullable | succeeded, denied |

**Pre-tenant actions have `workspace_id = NULL`.** Registration, login failure, password reset, and email verification happen before any tenant is resolved; forcing a workspace onto them would either fabricate an association or block the record entirely. `audit_logs.workspace_id` is therefore nullable **only** for the `auth.*`, `user.*`, and unauthenticated `security.*` action families; every tenant-scoped action family has it NOT NULL by check constraint.

**Denials are audited.** Every `403`/`404`-by-scoping outcome writes a `denied` audit row. This is what makes T1, T2, T15, and T16 detectable rather than merely blocked.

## 4. Notifications

| Event | Recipient | Contains |
|---|---|---|
| Invitation created/resent | invitee | workspace name, inviter display name, role, expiry, **the single-use link** — this is the *only* egress of the raw invitation token, and it goes to the invited address, never to the inviter's API response |
| Invitation accepted | inviter | invitee display name, role |
| Role changed | target member | old and new role, workspace name |
| Membership suspended/removed | target member | workspace name |
| Ownership transferred | both parties + all other Owners | workspace name, new owner |
| Password changed / reset | account owner | timestamp and `ip_hash`-derived coarse location **only if** a location policy is decided (Class C); otherwise timestamp only |
| Sessions revoked (all) | account owner | count and timestamp |
| Workspace suspended/archived/deletion requested | all Owners and Admins | state and reason |
| Register attempt on an existing address | account owner | "an account already exists" + password-reset link, **never** a signal to the requester |

Notification delivery is a provider concern behind the B0 ports/adapters boundary. B1 introduces no provider and no email implementation.

# B1 — API, DTO, and Error Target Contracts

> **B1 status:** Contracts on paper. **No endpoint, serializer, router, or OpenAPI change is authorized under B1.** Operations marked *B1-ADDITIVE* require a controlled additive change to the frozen `BACKEND_OPENAPI_V1.yaml` at the B1 implementation-contract step; B1 itself does not edit it.

All routes are under the B0 base path `/api/v1/` (OpenAPI path keys omit the prefix). All conventions inherited from `BACKEND_API_STANDARD.md`: `snake_case` JSON, prefixed public IDs, UTC ISO-8601 `Z` timestamps, `request_id` on every response, CSRF on unsafe cookie-authenticated requests, `Idempotency-Key` on durable mutation commands, `If-Match` on versioned updates with `409` on stale data.

## 1. Reconciliation with the frozen B0 surface

| Frozen B0 operation | B1 treatment |
|---|---|
| `POST /auth/login` → `200 Session`; `security: []` | **Response set unchanged** (`200/400/401/429/500`), which is why email verification is enforced in the pipeline rather than at login. **One amendment to the `Session` schema** — `workspace_ref` becomes nullable; see §1.1(b). |
| `POST /auth/logout` → `204` | **Unchanged.** B1 adds that it is idempotent. |
| `GET /workspaces` → `200 WorkspaceList` of `Workspace{public_id,name,role,status}` | **Unchanged.** B1 defines it as *the caller's memberships projected as workspaces*: `role` is `membership.role`, `status` is `workspace.status`. Only `active` memberships are listed. |
| `POST /workspaces/{id}/invitations` → `201 Workspace`, `Idempotency-Key` | **Amended.** The B1 normative target is **`201 Invitation`**; see §1.1(a). B1 does **not** edit the frozen contract file. |
| `GET /entitlements`, `GET /usage`, `GET /plans` | **Unchanged.** B1 defines only their position in the authorization pipeline. |
| `sessionAuth` global security, `security: []` on `login`/`getLiveness`/`getReadiness` | **Unchanged.** Every B1-additive operation inherits `sessionAuth`; none declares `security: []`. |

### 1.1 B1 target-contract amendments (two, both narrow)

B1 makes exactly two amendments to the frozen `BACKEND_OPENAPI_V1.yaml`. **Neither is a claim that B0 already said this.** Both are stated here as B1 targets, both are decided (no open option remains), and executing the file edit is a gated pre-implementation step requiring CTO approval. **B1 does not edit `BACKEND_OPENAPI_V1.yaml`.**

**(a) `POST /workspaces/{id}/invitations` response body**

| | |
|---|---|
| **B0 frozen contract** | `201` → `$ref: #/components/schemas/Workspace` |
| **B1 normative target** | `201` → `Invitation` (§3) |
| **Why** | The `Workspace` projection carries no invitation identity, so a client cannot address the invitation it just created in order to cancel or resend it, and the created resource is not returned by the operation that created it. `Invitation` is the resource this operation creates. |
| **New schema** | `Invitation` (§3). B0 defines no `Invitation` schema; this amendment adds one. |
| **Decision** | **CLOSED** — `B1-D-A22`. Execution tracked as `B1-D-001` (Class B). |

**(b) `Session.workspace_ref` nullability**

| | |
|---|---|
| **B0 frozen contract** | `workspace_ref` is `$ref: EntityRef`, in `required`, **not** nullable |
| **B1 normative target** | stays in `required`; becomes `{"nullable": true, "allOf": [{"$ref": "#/components/schemas/EntityRef"}]}` |
| **Required set** | **unchanged** — no field added or removed |
| **Why** | A User with `\|E(U)\| = 0` is a reachable, supported state (`B1_AUTH_SESSION_DESIGN.md` §4.6). A non-nullable `workspace_ref` cannot represent it, and every recovery path needs an authenticated session. |
| **Precedent** | B0 already pairs `required` with `nullable: true`: `PageInfo.next_cursor`. |
| **Decision** | **CLOSED** — `B1-D-A23`. Execution tracked as `B1-D-019` (Class B). |

**No other frozen response shape, required set, or vocabulary changes.**

## 2. B1 target API surface

`P` = permission code, `Idem` = `Idempotency-Key`, `If-M` = `If-Match`.

### Auth (Identity & Access)

| Method | Route | Auth | P | Request | Response | Errors | Idem | If-M | Audit |
|---|---|---|---|---|---|---|---|---|---|
| POST | `/auth/register` *(ADD)* | public | — | `RegisterRequest` | `202 Empty` | 400,409,429,500 | yes | — | `auth.registered` |
| POST | `/auth/verify-email` *(ADD)* | public | — | `EmailTokenRequest` | `204` | 400,429,500 | — | — | `auth.email_verified` |
| POST | `/auth/password-reset` *(ADD)* | public | — | `PasswordResetRequest` | `202 Empty` | 400,429,500 | — | — | `auth.password_reset_requested` |
| POST | `/auth/password-reset/confirm` *(ADD)* | public | — | `PasswordResetConfirmRequest` | `204` | 400,429,500 | — | — | `auth.password_reset_completed` |
| POST | `/auth/login` *(FROZEN)* | public | — | `LoginRequest` | `200 Session` | 400,401,429,500 | — | — | `auth.login_succeeded` / `auth.login_failed` |
| POST | `/auth/logout` *(FROZEN)* | session | — | — | `204` | 401,500 | — | — | `auth.logout` |
| POST | `/auth/password-change` *(ADD)* | session | — | `PasswordChangeRequest` | `204` | 400,401,403,429,500 | — | — | `auth.password_changed` |
| GET | `/auth/session` *(ADD)* | session | — | — | `200 Session` | 401,500 | — | — | — |
| POST | `/auth/session/workspace` *(ADD)* | session | — | `WorkspaceSwitchRequest` | `200 Session` | 400,401,403,404,500 | — | — | `session.workspace_switched` |
| GET | `/auth/sessions` *(ADD)* | session | `session.self.manage` | cursor,limit | `200 SessionList` | 401,500 | — | — | — |
| POST | `/auth/sessions/{id}/revoke` *(ADD)* | session | `session.self.manage` | — | `204` | 401,404,500 | — | — | `auth.session_revoked` |
| POST | `/auth/sessions/revoke-all` *(ADD)* | session | `session.self.manage` | — | `204` | 401,500 | opt | — | `auth.sessions_revoked_all` |

The `/auth/*` operations at `register`, `verify-email`, `password-reset`, `password-reset/confirm` are the only B1-additive operations that would declare `security: []`. `password-change`, `session`, `session/workspace`, and `sessions*` are session-authenticated. **Verification-exempt operations** (permitted to an unverified user): `logout`, `verify-email`, `password-change`, `GET /auth/session`, `GET /auth/sessions`, `sessions/*/revoke`, `sessions/revoke-all`. Everything else returns `403 EMAIL_VERIFICATION_REQUIRED`.

### Workspace

| Method | Route | P | Request | Response | Errors | Idem | If-M | Audit |
|---|---|---|---|---|---|---|---|---|
| GET | `/workspaces` *(FROZEN)* | — | cursor,limit | `200 WorkspaceList` | 401,500 | — | — | — |
| POST | `/workspaces` *(ADD)* | — (any verified user) | `WorkspaceCreateRequest` | `201 WorkspaceDetail` | 400,401,403,409,500 | yes | — | `workspace.created` |
| GET | `/workspaces/{id}` *(ADD)* | `workspace.view` | — | `200 WorkspaceDetail` | 401,403,404,500 | — | — | — |
| PATCH | `/workspaces/{id}` *(ADD)* | `workspace.manage` | `WorkspaceUpdateRequest` | `200 WorkspaceDetail` | 400,401,403,404,409,500 | — | yes | `workspace.updated` |
| POST | `/workspaces/{id}/suspend` *(ADD)* | `workspace.suspend` | `VersionedCommand` | `200 WorkspaceDetail` | 400,401,403,404,409,500 | — | yes | `workspace.suspended` |
| POST | `/workspaces/{id}/resume` *(ADD)* | `workspace.suspend` | `VersionedCommand` | `200 WorkspaceDetail` | 400,401,403,404,409,500 | — | yes | `workspace.resumed` |
| POST | `/workspaces/{id}/archive` *(ADD)* | `workspace.archive` | `VersionedCommand` | `200 WorkspaceDetail` | 400,401,403,404,409,500 | — | yes | `workspace.archived` |
| DELETE | `/workspaces/{id}` *(ADD)* | `workspace.delete` | `VersionedCommand` | `202 Empty` | 400,401,403,404,409,500 | yes | yes | `workspace.deletion_requested` |

### Members

| Method | Route | P | Request | Response | Errors | Idem | If-M | Audit |
|---|---|---|---|---|---|---|---|---|
| GET | `/workspaces/{id}/members` *(ADD)* | `member.view` | cursor,limit | `200 MembershipList` | 401,403,404,500 | — | — | — |
| GET | `/workspaces/{id}/members/{member_id}` *(ADD)* | `member.view` | — | `200 Membership` | 401,403,404,500 | — | — | — |
| PATCH | `/workspaces/{id}/members/{member_id}` *(ADD)* | `member.role.change` and/or `member.suspend` | `MembershipUpdateRequest` | `200 Membership` | 400,401,403,404,409,500 | — | yes | `membership.role_changed` / `membership.suspended` / `membership.activated` |
| DELETE | `/workspaces/{id}/members/{member_id}` *(ADD)* | `member.remove` (or self ⇒ leave) | `VersionedCommand` | `204` | 400,401,403,404,409,500 | — | yes | `membership.removed` |
| POST | `/workspaces/{id}/ownership-transfer` *(ADD)* | `ownership.transfer` | `OwnershipTransferRequest` | `200 OwnershipTransferResult` | 400,401,403,404,409,500 | yes | yes | `ownership.transferred` |

### Invitations

| Method | Route | P | Request | Response | Errors | Idem | If-M | Audit |
|---|---|---|---|---|---|---|---|---|
| POST | `/workspaces/{id}/invitations` *(FROZEN route, AMENDED response §1.1a)* | `member.invite` | `InviteRequest` | `201 Invitation` | 400,401,403,404,409,500 | yes | — | `invitation.created` |
| GET | `/workspaces/{id}/invitations` *(ADD)* | `invitation.view` | cursor,limit,`status` | `200 InvitationList` | 401,403,404,500 | — | — | — |
| POST | `/workspaces/{id}/invitations/{invitation_id}/cancel` *(ADD)* | `invitation.cancel` | `VersionedCommand` | `200 Invitation` | 400,401,403,404,409,500 | — | yes | `invitation.cancelled` |
| POST | `/workspaces/{id}/invitations/{invitation_id}/resend` *(ADD)* | `invitation.resend` | `VersionedCommand` | `200 Invitation` | 400,401,403,404,409,429,500 | — | yes | `invitation.resent` |
| POST | `/invitations/accept` *(ADD)* | session (verified **not** required — acceptance *proves* the email) | `InvitationAcceptRequest` | `201 Membership` | 400,401,403,404,409,500 | yes | — | `invitation.accepted` |

`POST /invitations/accept` is deliberately **not** nested under `/workspaces/{id}`: the acceptor is not yet a member, so no active workspace exists to scope the path against, and requiring the workspace ID in the path would leak which workspace a token belongs to before the token is validated. The token alone identifies the target.

**`Idempotency-Key` transport.** The `Idem` column always means the **`Idempotency-Key` HTTP header** defined by `BACKEND_IDEMPOTENCY_STANDARD.md` and declared in the frozen contract as `components.parameters.IdempotencyKey` (`in: header`). B1 introduces **no** body-level idempotency field on any operation: `Idempotency-Key` is never a request-DTO property, so `additionalProperties: false` never rejects a canonical header-only client. `yes` = required, `opt` = accepted, `—` = not applicable. A required key that is absent is `400 VALIDATION_ERROR`.

**Total B1 target surface:** the tables above list **30 operations — 4 frozen and 26 B1-additive**. Three further frozen operations (`GET /entitlements`, `GET /usage`, `GET /plans`) are reconciled in §1 and are unchanged by B1, so they are not restated here; the full frozen surface B1 touches is therefore 7 operations. No operation is added that is not required by an explicit B1 section or by ADR-009.

## 3. DTOs

Field legend — **T** type · **R** required · **N** nullable · **S** server-generated · **W** client-writable · **I** immutable after creation · **X** sensitive (never returned or logged).

### `Session` *(frozen shape + amendment §1.1b)*

| Field | T | R | N | S | W | I | X | Validation |
|---|---|---|---|---|---|---|---|---|
| `session_id` | string `SES-*` | ✔ | | ✔ | | ✔ | | opaque |
| `user` | `EntityRef` (`USR-*`) | | | ✔ | | ✔ | | |
| `workspace_ref` | `EntityRef` (`WORK-*`) | ✔ | ✔ | ✔ | | | | the resolved active workspace; `null` **only** when `\|E(U)\| = 0` (§1.1b) |
| `expires_at` | date-time | ✔ | | ✔ | | | | `min(idle_expires_at, absolute_expires_at)` |

The Django session key, `session_key_hash`, `ip_hash`, and `user_agent_digest` are **X** and appear in no DTO.

### `SessionSummary` *(item of `SessionList`)*

`public_id` (`SES-*`, R,S,I) · `created_at` (R,S) · `last_seen_at` (R,S) · `expires_at` (R,S) · `status` (R,S; `active|expired|revoked`) · `user_agent_label` (N,S; coarse family such as `Chrome / Windows`, never the raw UA) · `is_current` (R,S,bool). **No IP address is returned**, to avoid turning session listing into a location-history feature without a privacy decision.

### `UserProfile`

`public_id` (`USR-*`, R,S,I) · `email` (R,S; **never client-writable through this DTO** — email change is out of B1 scope, `B1-D-010`) · `email_verified` (R,S,bool) · `display_name` (R,W; 1–120 chars, trimmed, no control characters) · `title` (N,W; ≤120 chars) · `locale` (R,W; enum from the workspace locale catalog) · `timezone` (R,W; IANA zone) · `status` (R,S) · `version` (R,S). `password_hash`, `failed_login_count`, `last_active_workspace_id` are **X**/internal and never serialized.

### `Workspace` *(frozen membership projection — do not change)*

`public_id` (`WORK-*`, R,S,I) · `name` (R,S) · `role` (R,S; the **caller's** `membership.role`) · `status` (R,S; the **workspace's** status).

### `WorkspaceDetail` *(B1-additive)*

`public_id` (R,S,I) · `name` (R,W; 1–120) · `status` (R,S) · `timezone` (R,W; IANA) · `currency` (R,W; `^[A-Z]{3}$`) · `locale` (R,W) · `created_at` (R,S,I) · `member_count` (R,S) · `owner_count` (R,S) · `viewer_role` (R,S; caller's role) · `version` (R,S). `created_by_user_id` is internal.

### `Membership`

| Field | T | R | N | S | W | I | Validation |
|---|---|---|---|---|---|---|---|
| `public_id` | `MEM-*` | ✔ | | ✔ | | ✔ | |
| `workspace_ref` | `EntityRef` | ✔ | | ✔ | | ✔ | always the active workspace |
| `user_ref` | `EntityRef` (`USR-*`) | ✔ | | ✔ | | ✔ | |
| `display_name` | string | ✔ | | ✔ | | | denormalized from `users` for list rendering |
| `role` | enum(6) | ✔ | | | ✔ | | never `owner` via `PATCH` |
| `status` | enum(3) | ✔ | | | ✔ | | `active`\|`suspended` writable; `removed` only via `DELETE` |
| `invited_by` | `EntityRef` | | ✔ | ✔ | | ✔ | |
| `joined_at` | date-time | ✔ | | ✔ | | ✔ | |
| `activated_at` / `suspended_at` / `removed_at` | date-time | | ✔ | ✔ | | | |
| `version` | integer ≥1 | ✔ | | ✔ | | | |

`Membership` never exposes the member's email. Member email is visible only to `member.view` holders through a separate, audited field flag — deferred as `B1-D-012` (Class C).

### `Invitation` *(canonical; new schema added by amendment §1.1a)*

One DTO serves **creation, list item, read, cancel, and resend**. There is no second invitation shape.

| Field | T | R | N | S | W | I | Validation |
|---|---|---|---|---|---|---|---|
| `public_id` | `WINV-*` | ✔ | | ✔ | | ✔ | opaque |
| `workspace_ref` | `EntityRef` (`WORK-*`) | ✔ | | ✔ | | ✔ | always the active workspace |
| `email_masked` | string | ✔ | | ✔ | | ✔ | e.g. `m•••@example.test`; the masking rule is uniform across creation, list, and read |
| `role` | enum(5) | ✔ | | | ✔ | | never `owner` |
| `status` | enum(4) | ✔ | | ✔ | | | `pending`\|`accepted`\|`cancelled`\|`expired` |
| `invited_by` | `EntityRef` (`USR-*`) | ✔ | | ✔ | | ✔ | |
| `expires_at` | date-time | ✔ | | ✔ | | | |
| `accepted_at` / `cancelled_at` | date-time | | ✔ | ✔ | | | |
| `resend_count` | integer ≥0 | ✔ | | ✔ | | | |
| `created_at` | date-time | ✔ | | ✔ | | ✔ | |
| `version` | integer ≥1 | ✔ | | ✔ | | | `If-Match` precondition for cancel/resend |

**The raw invitation token is NOT a field of this DTO and is returned by no API operation** — not by creation, not by resend, not by list, not by read. See §3.1.

**`email_masked` on every surface, including creation.** The inviter typed the address, so echoing it back adds nothing they do not already hold, while a single masking rule removes the possibility that one response shape leaks a full address that another masks. `GET /workspaces/{id}/invitations` therefore cannot become a bulk address-harvesting endpoint for a Manager, and neither can a replayed creation response.

### 3.1 Invitation token handling (security posture)

| Rule | |
|---|---|
| Generation | server-side, **≥256-bit CSPRNG**, opaque, URL-safe; no user-derived, sequential, or timestamp-derived component |
| Storage | `sha256(token)` only. The raw value is never persisted in any column, cache, or file. |
| Lifetime in cleartext | only inside the issuing transaction, and only as far as the delivery boundary |
| API responses | **never** — creation, resend, list, and read all omit it |
| Logs / `audit_logs` / domain events / outbox / Celery arguments | **never** (`B1_COMMAND_EVENT_CATALOG.md` §3, `B1_PRIVACY_AUDIT_MODEL.md` Rule P-1) |
| Delivery | out-of-band only, through the invitation delivery boundary |
| Rotation | `ResendInvitation` mints a new token and invalidates the previous one |
| Termination | `token_hash` is nulled on every terminal transition (`accepted`, `cancelled`, `expired`) |

**Why the token is not returned to the browser.** Earlier B1 drafts returned it once in the `201`. That is the weaker posture: it puts a bearer credential into the SPA, into browser memory and history, into any client-side logging or error reporting, and into the response body of an operation whose result is replayable under its `Idempotency-Key`. Frozen frontend truth does not require it — `createTeamInvitation` (`client/src/domain/data.js:1025`) stores no token and `Settings.tsx` renders no invitation link — so no product requirement is lost. The invitee receives the token only at the address the invitation is bound to, which is precisely the mailbox-control proof acceptance depends on.

**Delivery boundary (contract only; no provider is implemented).** `MemberInvited` / `InvitationResent` carry the `WINV-*` reference and never the token (`B1_COMMAND_EVENT_CATALOG.md` §3.3). The notification worker obtains the single-use raw token through a restricted, one-shot internal handoff bound to the issuing transaction's `command_id`, composes the invitation link, and sends it through the B0 provider port. B1 defines no provider, no template, and no transport. Until a provider adapter exists, the handoff is the documented seam and nothing else consumes the token.

### `OwnershipTransferResult`

Response of `POST /workspaces/{id}/ownership-transfer`. Replaces the previously named-but-undefined `MembershipPair`.

| Field | T | R | N | S | Notes |
|---|---|---|---|---|---|
| `workspace_ref` | `EntityRef` (`WORK-*`) | ✔ | | ✔ | the workspace whose ownership moved |
| `new_owner` | `Membership` (§3) | ✔ | | ✔ | the target membership, now `role='owner'` |
| `previous_owner` | `Membership` (§3) | ✔ | | ✔ | the actor's membership, at its resulting role — `owner` when `retain_ownership=true`, otherwise `demote_to_role` |
| `owner_count` | integer ≥1 | ✔ | | ✔ | active Owners after the transfer; never `0` (INV-WS-1) |

Both members are full `Membership` objects, so the client needs no second read and both `version` values are returned for subsequent `If-Match` use.

### List envelopes — `SessionList`, `MembershipList`, `InvitationList`

All three use the **frozen B0 list convention** verbatim (`WorkspaceList`, `DealList`, `InvoiceList`): an object with `items` and `page_info`, `additionalProperties: false`, both required.

| DTO | `items[]` element | Scope |
|---|---|---|
| `SessionList` | `SessionSummary` | the caller's own sessions only (`user_id` scoped) |
| `MembershipList` | `Membership` | the active workspace only |
| `InvitationList` | `Invitation` | the active workspace only |

`page_info` is the frozen B0 `PageInfo` (`next_cursor`, required and nullable; `has_next`). Cursor pagination follows ADR-011. No list DTO is left implicit.

### Request DTOs (all `additionalProperties: false`)

> **No request DTO carries an idempotency field.** `Idempotency-Key` is an HTTP **header** (`BACKEND_IDEMPOTENCY_STANDARD.md`; frozen `components.parameters.IdempotencyKey`, `in: header`). Earlier B1 drafts listed a required `idempotency_key` body property on four requests; with `additionalProperties: false` that would have made a canonical header-only client fail with `400`, and it duplicated the key inside the very body whose hash scopes it. All four are removed. The B0 scoping rule is unchanged: **workspace + authenticated principal + endpoint/command + request-body hash**.

| DTO | Fields |
|---|---|
| `RegisterRequest` | `email` (R, RFC-shaped, ≤254), `password` (R, ≥12 chars, checked against Django validators and a breached-password list), `display_name` (R), `workspace_name` (R) |
| `EmailTokenRequest` | `token` (R, opaque) |
| `PasswordResetRequest` | `email` (R) |
| `PasswordResetConfirmRequest` | `token` (R), `password` (R) |
| `PasswordChangeRequest` | `current_password` (R), `password` (R) |
| `LoginRequest` *(frozen)* | `email` (R), `password` (R) |
| `WorkspaceSwitchRequest` | `workspace_ref` (R, `EntityRef`) |
| `WorkspaceCreateRequest` | `name` (R), `timezone` (opt), `currency` (opt), `locale` (opt) |
| `WorkspaceUpdateRequest` | `name`, `timezone`, `currency`, `locale`, `version` (R) |
| `VersionedCommand` | `version` (R) |
| `MembershipUpdateRequest` | `role` (opt, enum minus `owner`), `status` (opt, `active`\|`suspended`), `version` (R) |
| `OwnershipTransferRequest` | `target_membership_ref` (R), `retain_ownership` (opt, default `false`), `demote_to_role` (opt, default `admin`, enum minus `owner`), `version` (R) |
| `InviteRequest` *(frozen)* | `email` (R), `role` (R) |
| `InvitationAcceptRequest` | `token` (R, opaque raw invitation token) |

**Never client-writable anywhere:** `id`, `public_id`, `workspace_id`, `user_id`, `status` on Workspace, `created_at`/`updated_at`/`joined_at`/`activated_at`/`removed_at`, `version` as a *value to set* (it is only ever a precondition), `token_hash`, `password_hash`, `email_verified_at`, `last_login_at`, `active_workspace_id`.

**Idempotent operations and their transport.** Every operation below takes the key as the `Idempotency-Key` **header**; none takes it in the body.

| Operation | Key | Retry semantics |
|---|---|---|
| `POST /auth/register` | required | replays the stored `202`; never a second user |
| `POST /workspaces` | required | replays the stored `201`; never a second workspace or seat |
| `POST /workspaces/{id}/invitations` | required (already on the frozen operation) | replays the stored `201 Invitation`; never a second invitation or a second live token |
| `POST /invitations/accept` | required | replays the stored `201 Membership`; never a second membership or seat |
| `POST /workspaces/{id}/ownership-transfer` | required | replays the stored `200`; never a second transfer |
| `DELETE /workspaces/{id}` | required | replays the stored `202` |
| `POST /auth/sessions/revoke-all` | optional | naturally idempotent; a key yields a stable replayed `204` |
| every `If-Match` command (`PATCH`/suspend/resume/archive/cancel/resend/member `PATCH`/`DELETE`) | not applicable | `If-Match` gives at-most-once semantics; a retried consumed version is `409 STALE_VERSION` |
| `login`, `logout`, `verify-email`, `password-reset*`, `password-change`, `session/workspace`, `sessions/{id}/revoke` | not applicable | `Login` has no `Idempotency-Key` parameter in the frozen contract and must not gain one; the rest are naturally idempotent or single-use-token-guarded |

## 4. Error contract

### 4.1 Reused from B0 (12) — no new code minted

All twelve exist verbatim in `BACKEND_ERROR_CATALOG.md`.

| Code | HTTP | B1 use |
|---|---|---|
| `AUTH_REQUIRED` | 401 | no session, expired session, disabled user |
| `SESSION_REVOKED` | 401 | session registry row revoked |
| `PERMISSION_DENIED` | 403 | RBAC deny, including failed `conditional` |
| `ENTITLEMENT_LOCKED` | 403 | plan lacks the capability |
| `QUOTA_EXHAUSTED` | 403 | metric exhausted (including `seats`) |
| `WORKSPACE_NOT_FOUND` | 404 | active workspace unresolvable; path workspace ≠ active workspace; switch target not eligible |
| `ENTITY_NOT_FOUND` | 404 | membership/invitation/session not visible in scope; unknown invitation token |
| `VALIDATION_ERROR` | 400/422 | malformed body, unknown field, weak password, invalid/expired email token |
| `CONFLICT` | 409 | guard failures with a `details.reason` (`invitation_pending`, `membership_removed`, `last_workspace`) |
| `IDEMPOTENCY_CONFLICT` | 409 | same key, different body |
| `STALE_VERSION` | 409 | `If-Match`/`version` mismatch |
| `INTERNAL_ERROR` | 500 | universal |

### 4.2 New B1 codes (10) — each semantically distinct

| Code | HTTP | Meaning | Why it is not a duplicate |
|---|---|---|---|
| `INVALID_CREDENTIALS` | 401 | login email/password rejected | `AUTH_REQUIRED` means *no valid session*; this means *credentials submitted and rejected*. Different client action. |
| `EMAIL_VERIFICATION_REQUIRED` | 403 | authenticated but `email_verified_at` is null | not a role, plan, quota, or membership problem |
| `MEMBERSHIP_INACTIVE` | 403 | membership exists but is `suspended` | `PERMISSION_DENIED` is a role verdict; this is a membership-state verdict and no role change fixes it |
| `WORKSPACE_INACTIVE` | 403 | workspace is `suspended`/`archived`/`deleting` | single code covering all three, so the client cannot enumerate which lifecycle state a workspace is in beyond what `GET /workspaces` already shows |
| `LAST_OWNER_REQUIRED` | 409 | the operation would leave zero active Owners | a specific, actionable invariant that deserves distinguishing from generic `CONFLICT` |
| `ALREADY_MEMBER` | 409 | invite/accept for a user who already has a live membership | distinct remedy (nothing to do) from `CONFLICT` |
| `INVITATION_EXPIRED` | 409 | valid token, `expires_at` passed | remedy: ask for a resend |
| `INVITATION_CANCELLED` | 409 | valid token, invitation cancelled | remedy: ask for a new invitation |
| `INVITATION_ALREADY_ACCEPTED` | 409 | valid token, already consumed | remedy: sign in |
| `RATE_LIMITED` | 429 | WazLink-side rate limit (login, reset, resend, register) | B0's only 429 code is `PROVIDER_RATE_LIMITED`, which means an **upstream provider** limit; using it for our own login throttle would misattribute the cause |

The three `INVITATION_*` codes are only reachable by a caller who already presented a **valid token** — i.e. the legitimate invitee. An unknown or malformed token returns `404 ENTITY_NOT_FOUND`, so token probing yields exactly one indistinguishable answer.

### 4.3 Explicitly rejected as duplicates (9)

| Proposed | Rejected because |
|---|---|
| `AUTHENTICATION_REQUIRED` | identical to B0 `AUTH_REQUIRED` |
| `SESSION_EXPIRED` | expiry is unobservable-by-design to the client beyond "your session ended"; folded into `AUTH_REQUIRED` |
| `INSUFFICIENT_PERMISSION` | identical to B0 `PERMISSION_DENIED` |
| `MEMBERSHIP_REQUIRED` | would confirm that a workspace exists to a non-member; folded into `404 WORKSPACE_NOT_FOUND` |
| `WORKSPACE_SUSPENDED` | folded into `WORKSPACE_INACTIVE` to avoid a lifecycle-state oracle |
| `INVITATION_ALREADY_USED` | same meaning as `INVITATION_ALREADY_ACCEPTED`; the state name is `accepted`, so the code follows the state name |
| `STALE_VERSION` (as new) | already exists in B0 |
| `LAST_WORKSPACE_REQUIRED` | rare guard; expressed as `409 CONFLICT` + `details.reason="last_workspace"` rather than a near-duplicate code |
| `LAST_ACTIVE_MEMBERSHIP_REQUIRED` | same class as the row above; expressed as `409 CONFLICT` + `details.reason="last_active_membership"` (`B1_WORKSPACE_MEMBERSHIP_MODEL.md` §3.1) |

**`CONFLICT` reason vocabulary.** `409 CONFLICT` always carries a `details.reason` from this closed set: `invitation_pending`, `membership_removed`, `last_workspace`, `last_active_membership`. A `409 CONFLICT` without a `reason` is invalid.

### 4.4 Anti-enumeration summary

| Probe | Response | Why it is safe |
|---|---|---|
| Login with an unknown email | `401 INVALID_CREDENTIALS`, constant-time | identical to a wrong password |
| Register an existing email | `202` + account-exists email to the owner | identical to a fresh registration |
| Password reset for an unknown email | `202` | identical to a real one |
| `GET`/mutate an object in another workspace | `404 ENTITY_NOT_FOUND` | identical to non-existent |
| Path workspace ≠ active workspace | `404 WORKSPACE_NOT_FOUND` | identical for member and non-member |
| Switch to a workspace the caller does not belong to | `404 WORKSPACE_NOT_FOUND` | identical to a non-existent workspace |
| Revoke another user's session ID | `404 ENTITY_NOT_FOUND` | identical to a bad ID |
| Guess an invitation token | `404 ENTITY_NOT_FOUND` | identical for malformed, unknown, and purged tokens |
| Read a created/listed invitation | `email_masked` only, no token | one masking rule on every surface, so no response shape leaks a full address or a bearer credential |
| Log in as a user with no eligible workspace | `200` + `workspace_ref: null` | indistinguishable in shape from any other login; the session reaches no tenant data |

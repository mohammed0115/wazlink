# B1 — Acceptance Test Matrix

> **B1 status:** Acceptance criteria for the future implementation. Each row is deterministic: a fixed precondition, a single action, and an assertion with no ambiguity. **No test code is authorized under B1.**

`AT-<CATEGORY>-<n>`. "Assert" statements are the contract.

## Authentication

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-AUTH-1 | verified active user with `\|E(U)\| ≥ 1` | login with correct credentials | `200`; body matches `Session`; `session_id` starts `SES-`; `workspace_ref` is **non-null** and is a member of `E(U)`; `expires_at = min(idle, absolute)` |
| AT-AUTH-2 | same | login with wrong password | `401 INVALID_CREDENTIALS`; no `sessions` row created |
| AT-AUTH-3 | address not registered | login | `401 INVALID_CREDENTIALS`; response bytes identical to AT-AUTH-2 |
| AT-AUTH-4 | `users.status='disabled'`, correct password | login | `401 INVALID_CREDENTIALS`; bytes identical to AT-AUTH-2 |
| AT-AUTH-5 | 1000 logins, 500 known / 500 unknown addresses | measure latency | no separable distribution at p<0.01; dummy-hash path exercised for unknown |
| AT-AUTH-6 | pre-auth cookie captured | login, then replay the pre-auth cookie | `401`; login-response `SES-*` ≠ any pre-auth session |
| AT-AUTH-7 | fresh IP | 11 logins in 60s | 11th ⇒ `429 RATE_LIMITED` with `Retry-After` ≥ 1 |
| AT-AUTH-8 | one account, 6 attempts from 6 distinct IPs in 60s | login | 6th ⇒ `429`; the per-account limiter fires independently of the per-IP limiter |
| AT-AUTH-9 | unverified user | login, then `GET /leads/{id}/360` | login `200`; lead request `403 EMAIL_VERIFICATION_REQUIRED` |
| AT-AUTH-10 | unverified user | `POST /auth/verify-email` with a valid token, then retry the lead request | `204`, then not `403 EMAIL_VERIFICATION_REQUIRED` |
| AT-AUTH-11 | unverified user | `GET /auth/session`, `POST /auth/logout` | both succeed — exempt list honoured |
| AT-AUTH-12 | registered address | `POST /auth/register` with the same address | `202`; no second user row; account-exists email sent to the owner; response identical to a fresh registration |
| AT-AUTH-13 | any address | `POST /auth/password-reset` for an unknown address | `202`; identical to a known address |
| AT-AUTH-14 | valid reset token | confirm twice | first `204`; second `400 VALIDATION_ERROR`; token single-use |
| AT-AUTH-15 | user with 3 sessions | `POST /auth/password-change` from session 1 | `204`; sessions 2 and 3 `revoked(password_change)`; session 1 still works with a rotated key |
| AT-AUTH-16 | password reset completed | any prior session | all sessions revoked, including the requesting one |
| AT-AUTH-17 | breached password from the check list | register / change / reset | `400 VALIDATION_ERROR`; no credential written |
| AT-AUTH-18 | active user whose only membership was removed by an admin (`\|E(U)\| = 0`) | login with correct credentials | `200`; `workspace_ref` is **`null`**; a `sessions` row exists with `active_workspace_id IS NULL`; `users.status` is still `active`; audit `auth.login_succeeded` with `details.no_eligible_workspace=true`; **no `identity.invariant_violation` alert emitted** |
| AT-AUTH-19 | the AT-AUTH-18 session | call every tenant-scoped route | all `404 WORKSPACE_NOT_FOUND` at pipeline step 5; zero tenant rows returned by any route |
| AT-AUTH-20 | the AT-AUTH-18 session | `GET /auth/session`, `GET /workspaces`, `POST /auth/logout` | all succeed; `GET /workspaces` returns `items: []` with a well-formed `page_info` |
| AT-AUTH-21 | the AT-AUTH-18 session | `POST /invitations/accept` with a valid token, then re-issue any tenant request | acceptance `201 Membership`; the **same** session then resolves the new workspace with **no re-login**; `workspace_ref` is non-null on the next `GET /auth/session` |
| AT-AUTH-22 | the AT-AUTH-18 session | `POST /workspaces` | `201 WorkspaceDetail`; caller becomes `owner`; `\|E(U)\| = 1`; the same session resolves it on the next request |
| AT-AUTH-23 | email-verification and password-reset token generators | inspect | each raw token is **≥256-bit CSPRNG**, opaque, with no user-derived, sequential, or timestamp-derived component; storage is `sha256` only; the raw value appears in **no** column |
| AT-AUTH-24 | 500 random password-reset tokens | `POST /auth/password-reset/confirm` | uniform `400 VALIDATION_ERROR` with byte-identical bodies, then `429 RATE_LIMITED`; invalid, expired, consumed, and unknown are indistinguishable |
| AT-AUTH-25 | a consumed reset token, and an expired verification token | confirm / verify | both `400 VALIDATION_ERROR`; `token_hash` is null on both rows; no credential or verification state changes |
| AT-AUTH-26 | full register / verify / reset suite | scan logs, `audit_logs`, `outbox_events`, Celery arguments, error bodies, and every API response body | **zero** occurrences of any raw email-verification or password-reset token |

## Sessions

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-SESS-1 | session at 7h59m idle | request | `200`; `idle_expires_at` slides |
| AT-SESS-2 | session at 8h01m idle | request | `401 AUTH_REQUIRED`; row → `expired` |
| AT-SESS-3 | session continuously active for 24h01m | request | `401 AUTH_REQUIRED`; **absolute expiry was never extended by activity** |
| AT-SESS-4 | 3 sessions | `GET /auth/sessions` | exactly 3 items, all the caller's; exactly one `is_current=true`; **no `ip` field present in any item** |
| AT-SESS-5 | users A and B | A revokes B's `SES-*` | `404 ENTITY_NOT_FOUND`; B's session still works |
| AT-SESS-6 | 3 sessions | `revoke-all` | `204`; all 3 → `revoked(global_logout)`; every cookie ⇒ `401 SESSION_REVOKED` |
| AT-SESS-7 | logged-out session | `POST /auth/logout` again | `204`, not `401` — idempotent |
| AT-SESS-8 | revoked session | any authenticated route | `401 SESSION_REVOKED` (not `AUTH_REQUIRED`) |
| AT-SESS-9 | any session | inspect the cookie | `HttpOnly`, `Secure`, `SameSite=Lax`, no `Domain` attribute |
| AT-SESS-10 | any session | grep application logs, audit rows, outbox rows for the session key | zero occurrences of the raw key; only `session_key_hash` in storage |
| AT-SESS-11 | any session row | inspect `active_workspace_id` | non-null for every session whose user has `\|E(U)\| ≥ 1`; null **only** where `\|E(U)\| = 0` (invariant SESS-1). No other null cause exists. |
| AT-SESS-12 | the session cookie | inspect its name | exactly `sessionid`, matching frozen `securitySchemes.sessionAuth.name`; B1 does not rename it |

## Workspace isolation

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-ISO-1 | object O in W2; caller Owner of W1 only | `GET` O by public ID | `404 ENTITY_NOT_FOUND`; body byte-identical to a random ID |
| AT-ISO-2 | caller is a member of both W1 and W2, switched to W1 | `GET /workspaces/W2/members` | `404 WORKSPACE_NOT_FOUND` (Doctrine R-3) |
| AT-ISO-3 | caller on W1 | create a Deal referencing a Lead in W2 | `404 ENTITY_NOT_FOUND` for the reference; no Deal row created |
| AT-ISO-4 | every relationship in Doctrine R-2 | submit a cross-tenant ref for each | all `404`; zero rows created; `authz.relationship_out_of_scope` audited for each |
| AT-ISO-5 | code review gate | every tenant-owned manager | no domain service reaches a tenant-owned table except through `for_workspace(...)` |
| AT-ISO-6 | caller on W1 | send `workspace_id=W2` in body, query, and header on 10 routes | all ignored; every response is scoped to W1 |
| AT-ISO-7 | `sessions` table | list sessions as a workspace Owner | only the caller's own sessions; `sessions` is never returned by a workspace-scoped queryset |
| AT-ISO-8 | U is active in W-archived (joined first) and W-active (joined later); no `last_active_workspace_id` | login | resolves to **W-active** — `priority` orders `active` (0) ahead of `archived`/`suspended` (1) before `joined_at` is consulted |
| AT-ISO-9 | U as above, `last_active_workspace_id` = W-archived | login | resolves to **W-active**; the hint does not win because the hinted workspace is not `active` |
| AT-ISO-10 | U is active in W-archived and W-suspended only | login | resolves deterministically to one of them by `(priority, joined_at, public_id)`; the archived/suspended workspace remains reachable so recovery is preserved |
| AT-ISO-11 | U explicitly switches to an archived workspace | `POST /auth/session/workspace` | `200`; the switch **succeeds** — archived stays selectable on request; writes then return `403 WORKSPACE_INACTIVE` |

## Membership

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-MEM-1 | invitation accepted | inspect | exactly one `MEM-*`, `status='active'`, `role` = invited role, `joined_at` set, `version=1` |
| AT-MEM-2 | active membership | remove, then re-invite and accept | a **new** `MEM-*`; the old row persists with `status='removed'` and `removed_at` set |
| AT-MEM-3 | membership `suspended` | any tenant request on that workspace | `403 MEMBERSHIP_INACTIVE`; session not revoked; `active_workspace_id` unchanged |
| AT-MEM-4 | member of W1 and W2, active on W1 | removed from W1 | same session continues; next request serves W2; `session.workspace_reresolved` audited; **no re-login** |
| AT-MEM-5 | member of W1 only | removed from W1 | session `revoked(membership_removed)`; `401 SESSION_REVOKED` |
| AT-MEM-6 | user `disabled` | inspect memberships | all rows unchanged; re-enabling restores identical access |
| AT-MEM-7 | 20 concurrent role changes on one membership | fire simultaneously | exactly 1 × `200`, 19 × `409 STALE_VERSION`; `version` incremented by exactly 1 |
| AT-MEM-8 | Admin | change own role | `403 PERMISSION_DENIED` |
| AT-MEM-9 | Admin, target Owner | change target's role | `403 PERMISSION_DENIED` (rank guard) |
| AT-MEM-10 | Admin | set any member's role to `owner` via `PATCH` | `400 VALIDATION_ERROR` or `403`; never succeeds |
| AT-MEM-11 | duplicate membership attempt | insert a second live row for (workspace, user) | rejected by the partial unique index |
| AT-MEM-12 | U active in W1 only; Admin of W1 | suspend `MEM-U` | `409 CONFLICT`, `details.reason="last_active_membership"`; **zero mutation** — `MEM-U.status` still `active`, `version` unchanged, `users.status` untouched; audit `authz.last_active_membership_blocked` |
| AT-MEM-13 | **U active in W1, suspended in W2** | U calls `DELETE .../members/MEM-U` on W1 (leave) | `409 CONFLICT`, `details.reason="last_active_membership"`; no mutation. A `suspended` W2 membership is **not** in `E(U)`, so it does not satisfy INV-USER-1 |
| AT-MEM-14 | **U active in W1, suspended in W2**; Admin of W1 | suspend `MEM-U` in W1 | `409 CONFLICT` · `last_active_membership`; no mutation — this is the exact case the pre-FIX.1 `status <> 'removed'` wording wrongly permitted |
| AT-MEM-15 | U active in W1 **and** active in W2; Admin of W1 | suspend `MEM-U` in W1 | `200`; suspension **succeeds**; `\|E(U)\|` goes 2 → 1, never 0; U's W2 access is entirely unaffected |
| AT-MEM-16 | U active in W1 only; Admin of W1 | `RemoveMember` on `MEM-U` | `204`; removal **succeeds** — it is the one enumerated exception (§3.1). `users.status` remains `active`; U's sessions are revoked `membership_removed`; audit `session.revoked_no_workspace` |
| AT-MEM-17 | U active in W1 and W2, session on W1; Admin of W1 suspends `MEM-U`… | …attempt it | refused only if W1 is U's final eligible membership; here it succeeds, and U's **W2 session and access continue unaffected** — no cross-tenant effect on the global identity |
| AT-MEM-18 | any workspace role, any tenant route | attempt to change `users.status` | impossible: no tenant API mutates `users.status`; `DisableUser`/`EnableUser`/`DeleteUser` are operator-only and unreachable from every role |
| AT-MEM-19 | the eligible-membership guard | 20 concurrent `SuspendMembership` on the last two eligible memberships of one user | at most one commits; the eligible count under `FOR UPDATE` never reaches 0; no Redis key participates in the decision |

## Invitations

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-INV-1 | Admin invites a new email | `POST .../invitations` | `201`; body validates against the **`Invitation`** schema (not `Workspace`); `public_id` starts `WINV-`; `status="pending"`; `role`, `expires_at`, `version` present; `WINV-*` row created `pending` with only `sha256(token)` stored |
| AT-INV-1b | the AT-INV-1 response | inspect the body | contains **no** `token` field and **no** raw token value anywhere; contains `email_masked`, never the full address |
| AT-INV-1c | the AT-INV-1 response | attempt cancel and resend using only the response | both succeed using `public_id` + `version` from the creation body — the response is sufficient to address the invitation it created |
| AT-INV-2 | same email, second invite | `POST` again | `409 CONFLICT`, `details.reason="invitation_pending"` |
| AT-INV-3 | email already a live member | invite | `409 ALREADY_MEMBER` |
| AT-INV-4 | invite with `role="owner"` | `POST` | `400 VALIDATION_ERROR`; no row created |
| AT-INV-5 | expired invitation, sweep not yet run | accept | `409 INVITATION_EXPIRED`; row → `expired`; `token_hash` nulled |
| AT-INV-6 | accepted invitation | replay the raw token | `404 ENTITY_NOT_FOUND`; still exactly one membership |
| AT-INV-7 | cancelled invitation | accept | `409 INVITATION_CANCELLED` |
| AT-INV-8 | pending invitation | 2 concurrent accepts, different keys | one `201`, one `409 INVITATION_ALREADY_ACCEPTED`; exactly one `MEM-*`; exactly one seat |
| AT-INV-9 | pending invitation | 2 concurrent accepts, **same** `Idempotency-Key` and body | both `201` with identical bodies; exactly one `MEM-*` |
| AT-INV-10 | authenticated user whose email ≠ the invitation email | accept | `403 PERMISSION_DENIED`; no membership |
| AT-INV-11 | resend | `POST .../resend` | `200 Invitation`; old token now `404`; the newly delivered token works; `resend_count` +1; `expires_at` extended |
| AT-INV-11b | the resend response | inspect the body | contains **no** `token` field and no raw token value; identical `Invitation` shape as creation and list |
| AT-INV-11c | one invitation | 6 resends within 24h | 6th ⇒ `429 RATE_LIMITED` with `Retry-After` (limit 5/invitation/24h) |
| AT-INV-11d | one workspace | 21 resends within an hour across many invitations | 21st ⇒ `429 RATE_LIMITED` (limit 20/workspace/hour) |
| AT-INV-12 | workspace `suspended` | invite, and accept an existing invitation | both `403 WORKSPACE_INACTIVE` |
| AT-INV-13 | any invitation flow | scan logs, audit rows, outbox rows, Celery args, **and every API response body** | **zero** occurrences of the raw token on every one of those channels |
| AT-INV-13b | invitation delivery | inspect the handoff | the raw token reaches the notifier only through the one-shot handoff bound to the issuing `command_id`; it is never written to `outbox_events`; `MemberInvited` carries `WINV-*` and `email_masked` only |
| AT-INV-14 | `GET .../invitations` | read the list | every item is an `Invitation` with `email_masked`; **no** surface returns a full address, creation included; the envelope is `{items, page_info}` |
| AT-INV-15 | 500 random tokens | `POST /invitations/accept` | uniform `404` then `429`; no timing separation between "unknown" and "other workspace" |

## RBAC

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-RBAC-1 | each of 6 roles × every permission in the matrix | attempt the guarded operation | outcome matches the matrix cell exactly; `A`⇒allowed, `·`⇒`403 PERMISSION_DENIED`, `C`⇒allowed only when the stated condition holds |
| AT-RBAC-2 | unknown permission code | request an operation referencing it | denied — an unknown code is never treated as unrestricted |
| AT-RBAC-3 | any role | inspect the decision path | membership, role, and matrix version are read inside the request transaction; **no cache layer exists** |
| AT-RBAC-4 | Admin demoted to Viewer | issue an admin-only request on the **same** session, immediately | `403 PERMISSION_DENIED` with no re-login and no propagation delay |
| AT-RBAC-5 | caller lacking `member.role.change`, target ID does not exist | `PATCH` that member ID | `403 PERMISSION_DENIED` (step 8), **not** `404` — an unauthorized caller cannot probe membership IDs |
| AT-RBAC-6 | `conditional` cells (Manager invite, Sales assign, Manager cancel) | test both condition-true and condition-false | true ⇒ allowed; false ⇒ `403 PERMISSION_DENIED` indistinguishable from a flat deny |
| AT-RBAC-7 | every B1 route | call as each role | authorization is enforced in the application service, verified by calling the service directly, not only via the HTTP layer |

## Owner protection

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-OWN-1 | sole Owner | remove self | `409 LAST_OWNER_REQUIRED`; no mutation |
| AT-OWN-2 | sole Owner | demote self | `409 LAST_OWNER_REQUIRED` |
| AT-OWN-3 | sole Owner | suspend self | `409 LAST_OWNER_REQUIRED` |
| AT-OWN-4 | sole Owner | leave workspace | `409 LAST_OWNER_REQUIRED` |
| AT-OWN-5 | sole Owner of workspace W | operator `DeleteUser` | `409 LAST_OWNER_REQUIRED` |
| AT-OWN-6 | two Owners, mutual simultaneous removal, 100 iterations | fire | active-Owner count is **never 0** in any iteration; exactly one succeeds each time |
| AT-OWN-7 | two concurrent transfers to different targets | fire | exactly one `200`; the other `409`; `owner_count ≥ 1` throughout |
| AT-OWN-8 | Admin | call ownership-transfer | `403 PERMISSION_DENIED` |
| AT-OWN-9 | transfer with `retain_ownership=false` | execute | `200` validating against **`OwnershipTransferResult`**; `new_owner` and `previous_owner` are both full `Membership` objects carrying `version`; `owner_count ≥ 1`; target `owner`; actor demoted to `demote_to_role` (default `admin`); both audited in one `ownership.transferred` |
| AT-OWN-9b | the transfer response | inspect the schema | every referenced response DTO resolves to a definition in `B1_API_DTO_CONTRACTS.md` §3; no operation references an undefined DTO |
| AT-OWN-10 | ordered locking | 100 concurrent transfers | zero deadlocks (rows locked in ascending `memberships.id`) |

## Entitlements & Quotas

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-ENT-1 | Owner, `PLAN-STARTER` | manage an automation rule | `403 ENTITLEMENT_LOCKED`; `details.capability="automation.rules"`; `target_plan_ref` present |
| AT-ENT-2 | Viewer, `PLAN-SCALE` | same request | `403 PERMISSION_DENIED`; `details` contains **no** capability, usage, or `target_plan_ref` |
| AT-ENT-3 | Owner, plan includes the capability, quota exhausted | act | `403 QUOTA_EXHAUSTED`; `details.metric` and `period` present |
| AT-ENT-4 | capability `not_included` | act | quota is **never consulted**; status reported as `LOCKED` |
| AT-QUO-1 | workspace at its seat limit | accept an invitation | `403 QUOTA_EXHAUSTED`; invitation stays `pending`; no membership |
| AT-QUO-2 | one seat remaining, 2 concurrent acceptances | fire | exactly one `201`, one `403 QUOTA_EXHAUSTED`; seat count increases by exactly 1 |
| AT-QUO-3 | invite 10 members, none accept | inspect `seats` | usage unchanged — invitations reserve no seat |
| AT-QUO-4 | suspend a member | inspect `seats` | usage decreases by 1 |
| AT-QUO-5 | disable a user | inspect `seats` | usage **unchanged** — the membership stays `active` |
| AT-QUO-6 | transaction rolls back after a quota reservation | force a later failure | the reservation rolls back with it; no Redis counter was decremented |

## Concurrency, Idempotency, IDOR, CSRF

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-CON-1 | membership `version=4`, bumped to 5 elsewhere | `PATCH` with `version=4` | `409 STALE_VERSION`; **no** mutation, no merge, no server-side retry |
| AT-CON-2 | workspace suspended mid-write | concurrent write | either commits fully on its snapshot or fails fully; no partial state |
| AT-CON-3 | 2 concurrent workspace switches on one session | fire | session ends on exactly one of the two; both audited |
| AT-CON-4 | 2 concurrent `CreateWorkspace`, same key | fire | one workspace; the second replays the stored response |
| AT-IDEM-1 | `AcceptInvitation` retried with the same key and body | fire | original `201` replayed verbatim; one membership; one seat |
| AT-IDEM-2 | same key, **different** body | fire | `409 IDEMPOTENCY_CONFLICT` |
| AT-IDEM-3 | `TransferOwnership` retried after an ambiguous timeout | fire | replayed result; no second transfer attempted |
| AT-IDEM-4 | idempotency records | inspect retention | ≥24h for identity commands (the 7-day tier stays reserved for payment/webhook) |
| AT-IDEM-5 | every idempotent B1 operation | send the key **only** as the `Idempotency-Key` HTTP header, with no body field | accepted and honoured; a replay returns the stored response. `additionalProperties:false` never rejects a canonical header-only client |
| AT-IDEM-6 | every B1 request DTO | inspect the schema | **no** DTO declares an `idempotency_key` property; sending one is rejected `400 VALIDATION_ERROR` as an unknown field |
| AT-IDEM-7 | an idempotent operation with a required key | omit the header | `400 VALIDATION_ERROR`; no durable state written |
| AT-IDOR-1 | matrix of {`MEM-`, `WINV-`, `SES-`, `WORK-`} × {other tenant, non-existent} | request each | uniform `404`; no status, body, header, or timing distinguishes the two columns |
| AT-CSRF-1 | valid session cookie, **no** CSRF token | every unsafe B1 route | rejected before the pipeline; zero state change |
| AT-CSRF-2 | valid CSRF token, valid session | same routes | proceed normally |

## Audit, Privacy, Frontend compatibility

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-AUD-1 | each audit action in `B1_PRIVACY_AUDIT_MODEL.md` §3 | trigger it | exactly one immutable `audit_logs` row with actor, workspace (or documented NULL), action, target, result, `request_id`, and `permission_matrix_version` |
| AT-AUD-7 | any pipeline denial from step 4 to step 12 | inspect the audit row | action is `authz.permission_denied` with the specific cause in `error_code`; a narrower `authz.*` action is used only where §3 names it for that guard; no denial writes two competing action codes |
| AT-AUD-2 | any audit row | attempt `UPDATE`/`DELETE` | rejected — append-only |
| AT-AUD-3 | every denial path (`403`/`404`-by-scoping) | trigger | a `result='denied'` row exists with the error code |
| AT-AUD-4 | full identity test suite | scan every audit row | zero occurrences of password, hash, session key, CSRF secret, or any raw token |
| AT-AUD-5 | role change | inspect | `before`/`after` contain the old and new role and nothing sensitive |
| AT-AUD-6 | pre-tenant actions (`auth.registered`, `auth.login_failed`, `auth.password_reset_*`) | inspect | `workspace_id IS NULL` is accepted; every tenant-scoped action family rejects NULL by check constraint |
| AT-PRIV-1 | full suite | scan application logs | zero raw emails, IPs, tokens, or credentials |
| AT-PRIV-2 | `SessionSummary` | inspect the schema | no `ip` field exists |
| AT-PRIV-3 | `DeleteUser` | execute | `public_id` retained; name/email/title pseudonymized; audit rows still resolvable; sessions revoked; memberships `removed` |
| AT-PRIV-4 | every API response body across the full suite | scan for credential material | zero raw invitation, verification, reset, session-key, CSRF, or password values in **any** response — the raw-token-in-response path does not exist |
| AT-FE-1 | `GET /workspaces` | compare | shape matches the frozen `WorkspaceList`; `role` is the caller's `membership.role`; `status` is the workspace status |
| AT-FE-2 | `POST /auth/login` | compare | response validates against the `Session` schema with **no added or removed required field** — `required` stays exactly `[session_id, workspace_ref, expires_at]`; the only amendment is that `workspace_ref` is nullable (§1.1b) |
| AT-FE-7 | `POST /workspaces/{id}/invitations` | compare | response is `201 Invitation` per amendment §1.1a; the frozen `Workspace` schema itself is **unchanged** and still serves `GET /workspaces` |
| AT-FE-8 | every frozen schema B1 touches (`Session`, `Workspace`, `WorkspaceList`, `PageInfo`, `EntitlementDecision`, `EntitlementList`, `UsageDTO`, `Plan`, `PlanList`, `LoginRequest`, `InviteRequest`, `Empty`) | diff against `BACKEND_OPENAPI_V1.yaml` | identical, except the single `Session.workspace_ref` nullability amendment; `InviteRequest` is still exactly `{email, role}` both required |
| AT-FE-3 | `GET /entitlements` | compare | `EntitlementDecision.status` ∈ `{AVAILABLE, LIMITED, EXHAUSTED, LOCKED}` — the frozen frontend vocabulary |
| AT-FE-4 | capability list | compare | exactly the frozen six capability IDs; no renames |
| AT-FE-5 | usage metrics | compare | exactly the frozen five metric keys, `seats` included |
| AT-FE-6 | six RBAC roles | compare | exactly `owner, admin, manager, sales, member, viewer`; the frontend job title is carried by `User.title` and is never an authorization input |

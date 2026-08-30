# B1 — End-to-End Failure Scenarios

> **B1 status:** Behavioural specification. Each scenario is a contract the implementation must satisfy exactly.

"Authorization path" gives the pipeline step (`B1_AUTHORIZATION_RBAC.md` §1) at which the request terminates.

---

### F1 — Invalid login

**Precondition** User `sara@example.test` exists, `active`, verified. Attacker knows the address, not the password.
**Request** `POST /api/v1/auth/login` `{email, password:"wrong"}`
**Authorization path** Pre-pipeline: rate limit passes → credential verification fails.
**Expected** `401` · `INVALID_CREDENTIALS`
**State mutation** `users.failed_login_count += 1`. **No session created.** No Django session, no `sessions` row.
**Audit** `auth.login_failed`, actor `anonymous`, `workspace_id = NULL`, `result=denied`.
**Information disclosure** Response body, status, and headers are byte-identical to a login for a non-existent address and to a login for a `disabled` account. Credential comparison runs against a dummy hash when the user is absent, so timing does not separate the cases.

---

### F2 — Expired session

**Precondition** `SES-A` was created 25h ago; `absolute_expires_at` has passed.
**Request** `GET /api/v1/leads/{id}/360`
**Authorization path** Step 2 (session validity).
**Expected** `401` · `AUTH_REQUIRED`
**State mutation** `sessions.status: active → expired`; the Django session record is destroyed. No domain state touched.
**Audit** `auth.session_expired`, actor `system`.
**Information disclosure** None. The response does not reveal whether the lead exists, nor whether it was idle or absolute expiry.

---

### F3 — Revoked session

**Precondition** The user pressed "sign out everywhere" from another device; `SES-A.status='revoked'` with `revoked_reason='global_logout'`. The attacker holds the old cookie.
**Request** any authenticated route
**Authorization path** Step 2.
**Expected** `401` · `SESSION_REVOKED`
**State mutation** None (already revoked).
**Audit** No new row for the replay itself; the original `auth.sessions_revoked_all` stands. Repeated replays feed `security.rate_limited`.
**Information disclosure** `SESSION_REVOKED` vs `AUTH_REQUIRED` distinguishes "signed out elsewhere" from "session ended" for legitimate UX. Neither tells an attacker anything they do not already hold.

---

### F4 — Disabled user

**Precondition** A platform operator set `users.status='disabled'`; all sessions were revoked (`user_disabled`).
**Request** `POST /api/v1/auth/login` with **correct** credentials
**Authorization path** Pre-pipeline credential check succeeds; the account-state check then fails.
**Expected** `401` · `INVALID_CREDENTIALS` — deliberately **not** a distinct "account disabled" code, so an attacker with valid credentials cannot confirm the account state.
**State mutation** None. No session created.
**Audit** `auth.login_failed` with internal `details.reason='user_disabled'` (server-side only, never reflected).
**Information disclosure** Identical to F1. Memberships are untouched, so re-enabling restores exactly the prior access.

---

### F5 — Removed membership

**Precondition** User U is active on session `SES-A` with `active_workspace_id = W1`. U is also an active member of W2. An admin removes U from W1 mid-session.
**Request** `GET /api/v1/deals` (implicitly scoped to W1)
**Authorization path** Step 6 (membership) → the removal branch of §4.4 re-resolution.
**Expected** `200` for **W2's** deals. The session silently re-resolves to W2 (the only remaining eligible workspace) and the response's data belongs to W2.
**State mutation** `sessions.active_workspace_id: W1 → W2`. `users.last_active_workspace_id` updated.
**Audit** `session.workspace_reresolved` with `from=W1, to=W2`.
**Information disclosure** No W1 data is returned. `GET /workspaces` no longer lists W1.
**Variant — U had no other workspace:** the eligible set is empty ⇒ `SES-A` → `revoked(membership_removed)`, response `401 SESSION_REVOKED`, audit `session.revoked_no_workspace`. This is the only case in which removing a member terminates their session (see T22). **U's global account stays `active`**, U may sign in again into a no-workspace session (F19), and `RemoveMember` on another member is the single transition permitted to produce this state (`B1_WORKSPACE_MEMBERSHIP_MODEL.md` §3.1).

---

### F6 — Suspended membership

**Precondition** U's membership in W1 is `suspended`. `SES-A.active_workspace_id = W1`.
**Request** `GET /api/v1/leads/{id}/360`
**Authorization path** Step 6.
**Expected** `403` · `MEMBERSHIP_INACTIVE`
**State mutation** None. The session is **not** revoked and `active_workspace_id` is **not** re-resolved — a suspension is reversible and the user should land back where they were.
**Audit** one `authz.permission_denied` row with `result='denied'` and `error_code='MEMBERSHIP_INACTIVE'`. `authz.permission_denied` is the canonical audit action for **every** pipeline denial from step 4 through step 12; the specific cause is carried by `error_code`, never by a separate action code. The narrower `authz.*` actions (`object_not_in_scope`, `role_change_denied`, `last_owner_blocked`, `last_active_membership_blocked`, …) are used only where `B1_PRIVACY_AUDIT_MODEL.md` §3 names them for that specific guard.
**Information disclosure** No lead data, and no indication whether the lead exists.

---

### F7 — Suspended workspace

**Precondition** W1 is `suspended` (billing hold). U is an active Owner.
**Requests** (a) `GET /api/v1/billing/invoices` (b) `POST /api/v1/deals`
**Authorization path** Step 7 (workspace state).
**Expected** (a) `200` — reads are permitted for a role holding the relevant `*.view` permission, so the Owner can see and resolve the hold. (b) `403` · `WORKSPACE_INACTIVE` — all unsafe operations are blocked.
**State mutation** None on (b).
**Audit** (b) `authz.permission_denied` with `error_code=WORKSPACE_INACTIVE`.
**Information disclosure** `WORKSPACE_INACTIVE` covers `suspended`, `archived`, and `deleting` with one code, so a caller cannot enumerate which lifecycle state the workspace is in beyond what `GET /workspaces` already shows them as a member.

---

### F8 — Cross-workspace IDOR

**Precondition** `LEAD-X` belongs to W2. U is an Owner of W1 and has **no** membership in W2. `SES-A.active_workspace_id = W1`.
**Request** `GET /api/v1/leads/LEAD-X/360`
**Authorization path** Steps 1–8 pass (U is an Owner of W1 and holds `lead.view`). Step 9 resolves through `for_workspace(W1)` and misses.
**Expected** `404` · `ENTITY_NOT_FOUND`
**State mutation** None.
**Audit** `authz.object_not_in_scope` with the attempted public ID and the active workspace.
**Information disclosure** **Zero.** The response is byte-identical to a request for a randomly generated `LEAD-*`. The pipeline reaches object resolution only *after* RBAC, so a caller without `lead.view` gets `403` before any lookup and equally learns nothing.
**Variant — U is also a member of W2:** still `404`. The correct action is `SwitchWorkspace` first (Doctrine R-3). Membership in a workspace never authorizes access to it from a session pointed elsewhere.

---

### F9 — Unauthorized role change

**Precondition** U is `sales` in W1. Target member M is `admin`.
**Request** `PATCH /api/v1/workspaces/W1/members/MEM-M {role:"viewer", version:3}`
**Authorization path** Step 8 — `sales` has no `member.role.change` grant.
**Expected** `403` · `PERMISSION_DENIED`, `details.permission="member.role.change"`
**State mutation** None; `MEM-M.version` remains 3.
**Audit** `authz.role_change_denied`, `result=denied`.
**Information disclosure** The response does not confirm whether `MEM-M` exists — RBAC (step 8) runs before object resolution (step 9), so an unauthorized caller cannot probe membership IDs.
**Variant — U is `admin` and M is `owner`:** `403 PERMISSION_DENIED` by the rank guard (actor rank 50 ≤ target rank 60).
**Variant — U is `admin` targeting themselves:** `403 PERMISSION_DENIED` by the never-self guard.

---

### F10 — Last owner removal

**Precondition** W1 has exactly one `active` Owner, U. U attempts to remove or demote themselves.
**Request** `DELETE /api/v1/workspaces/W1/members/MEM-U {version:5}`
**Authorization path** Steps 1–14 pass. Step 15 (domain invariant) evaluates INV-WS-1 under `SELECT count(*) … FOR UPDATE`.
**Expected** `409` · `LAST_OWNER_REQUIRED`
**State mutation** None. `MEM-U.version` remains 5.
**Audit** `authz.last_owner_blocked`, `result=denied`.
**Information disclosure** None beyond the workspace's own owner count, which an Owner already sees in `WorkspaceDetail.owner_count`.
**Same guard also blocks:** `ChangeMemberRole` demoting the last Owner, `SuspendMembership` on the last Owner, `LeaveWorkspace` by the last Owner, and `DeleteUser`/`DisableUser` for a sole Owner.

---

### F11 — Expired invitation

**Precondition** `WINV-1` was issued 8 days ago; `expires_at` has passed. The sweep may or may not have run yet.
**Request** `POST /api/v1/invitations/accept {token:"<valid raw token>"}`
**Authorization path** Token resolves by `sha256`; expiry is evaluated **inline**, so a lagging sweep changes nothing.
**Expected** `409` · `INVITATION_EXPIRED`
**State mutation** The invitation transitions `pending → expired` and `token_hash` is nulled, so the leaked token is now permanently inert. **No membership created; no seat consumed.**
**Audit** `invitation.accept_rejected`, `details.reason='expired'`.
**Information disclosure** The caller holds a valid token, so learning that *their own* invitation expired is not a leak. An **invalid** token yields `404 ENTITY_NOT_FOUND` instead — the two are not confusable.

---

### F12 — Replayed invitation

**Precondition** `WINV-1` was accepted yesterday; `MEM-1` exists. The attacker replays the same raw token.
**Request** `POST /api/v1/invitations/accept {token:"<same token>"}`
**Authorization path** `token_hash` was nulled at acceptance, so the lookup misses entirely.
**Expected** `404` · `ENTITY_NOT_FOUND`
**State mutation** None. Exactly one membership exists.
**Audit** `auth.invitation_token_rejected`.
**Information disclosure** None — identical to a random token.
**Note** `409 INVITATION_ALREADY_ACCEPTED` is reachable only in the narrow window where the row is `accepted` but the hash has not yet been nulled within the same transaction, and by a legitimate retry carrying the original `Idempotency-Key`, which instead **replays the original `201`** and is not a second acceptance.

---

### F13 — Concurrent invitation acceptance

**Precondition** `WINV-1` is `pending`. The invitee double-submits; two requests arrive simultaneously with **different** `Idempotency-Key`s.
**Requests** two × `POST /api/v1/invitations/accept`
**Authorization path** Both take `SELECT … FOR UPDATE` on the invitation row and serialize.
**Expected** First: `201 Membership`. Second: `409 INVITATION_ALREADY_ACCEPTED`.
**State mutation** Exactly one `MEM-*` row; exactly one seat consumed; `WINV-1.status='accepted'` with a single `accepted_at`.
**Audit** One `invitation.accepted` (succeeded) and one `invitation.accept_rejected` (denied).
**Guarantee** Even if the row lock were bypassed, the partial unique index `(workspace_id, user_id) WHERE status <> 'removed'` makes a second membership impossible at the storage layer.
**Variant — same `Idempotency-Key` on both:** the second replays the stored `201` verbatim. One membership, one seat, and the client sees success on both.

---

### F14 — Concurrent owner transfer

**Precondition** W1 has Owners O1 and O2. Both simultaneously transfer ownership to different targets T1 and T2.
**Requests** two × `POST /api/v1/workspaces/W1/ownership-transfer`
**Authorization path** Both lock the actor and target membership rows in **ascending `memberships.id`** — a total order, so deadlock is impossible — then re-count active Owners under lock.
**Expected** One `200`; the other `409 STALE_VERSION` (its `If-Match` target version was bumped) or `409 CONFLICT` if its target's state changed.
**State mutation** Exactly one transfer applied. `owner_count ≥ 1` at every instant. Never both, never zero owners, never a blend.
**Audit** One `ownership.transferred` (succeeded), one denied row.
**Information disclosure** None.

---

### F15 — Entitlement denied despite RBAC allow

**Precondition** U is Owner of W1. W1 is on `PLAN-STARTER`, whose capability set is `discovery.basic, crm.core, export.csv` — `automation.rules` is **not** included.
**Request** create an automation rule
**Authorization path** Step 8 passes (Owner holds `automation.rule.manage`). Step 11 fails.
**Expected** `403` · `ENTITLEMENT_LOCKED`, `details = {capability:"automation.rules", reason:"capability_locked", target_plan_ref:{public_id:"PLAN-…", entity_type:"plan"}}`
**State mutation** None. No quota consulted — `not_included` is an entitlement fact, so step 12 never runs.
**Audit** `authz.permission_denied` with `error_code=ENTITLEMENT_LOCKED`.
**Information disclosure** Plan capability only, which the same user already reads from `GET /entitlements`.
**Contrast** A Viewer on `PLAN-SCALE` issuing the same request gets `403 PERMISSION_DENIED` at step 8 and never learns the plan's capabilities. RBAC denial always precedes and masks entitlement state.

---

### F16 — Quota exceeded despite RBAC + entitlement allow

**Precondition** U is Owner of W1 on `PLAN-GROWTH`. `automation.rules` is included. `automationRuns` usage has reached its limit for the period.
**Request** trigger an automation run
**Authorization path** Steps 8 and 11 pass; step 12 fails on the locked `usage_counters` row.
**Expected** `403` · `QUOTA_EXHAUSTED`, `details = {metric:"automationRuns", reason:"usage_exhausted", period:"<p>", target_plan_ref:{…}}`
**State mutation** None; the reservation is inside the transaction and rolls back with it. No Redis counter is decremented, because no Redis counter participates in the decision.
**Audit** `authz.permission_denied` with `error_code=QUOTA_EXHAUSTED`.
**Information disclosure** Usage only, which `GET /usage` already exposes to this caller.
**Seat variant** Two invitees accepting the workspace's last seat concurrently: both lock the `seats` counter row; one gets `201`, the other `403 QUOTA_EXHAUSTED` with its invitation left `pending` and re-usable after a seat frees or the plan is upgraded.

---

### F17 — Stale membership version

**Precondition** Admin A1 reads `MEM-M` at `version=4`. Admin A2 changes M's role, bumping it to 5. A1 then submits their change.
**Request** `PATCH /api/v1/workspaces/W1/members/MEM-M {role:"viewer", version:4}`
**Authorization path** Steps 1–12 pass. Step 13 (`If-Match`/version) fails under the row lock.
**Expected** `409` · `STALE_VERSION`
**State mutation** **None.** `MEM-M` keeps A2's role and `version=5`. A1's change is not merged, not queued, and not retried server-side.
**Audit** `membership.role_changed` with `result=denied`, recording the submitted and actual versions.
**Client contract** Re-read, re-decide, re-submit. The server never guesses intent.

---

### F18 — Workspace switch to an inaccessible workspace

**Precondition** W2 exists. U has **no** membership in it (or a `removed` one, or a `suspended` one — a suspended membership is not in `E(U)` per `B1_AUTH_SESSION_DESIGN.md` §4.1 — or W2 is `deleting`).
**Request** `POST /api/v1/auth/session/workspace {workspace_ref:{public_id:"WORK-W2", entity_type:"workspace"}}`
**Authorization path** Steps 1–4 pass; eligibility evaluation fails.
**Expected** `404` · `WORKSPACE_NOT_FOUND` — **never** `403`, which would confirm that W2 exists.
**State mutation** None. `sessions.active_workspace_id` is unchanged; the caller stays on their previous workspace with an entirely valid session.
**Audit** `session.workspace_switch_denied` with the attempted `WORK-*`.
**Information disclosure** **Zero.** Status, body, and timing are identical for: a workspace that does not exist, one that exists but the caller was never in, one they were removed from, one where they are `suspended`, and one in `deleting`. This makes `SwitchWorkspace` unusable as a tenant-existence oracle (T21).

---

### F19 — Login with no eligible workspace

**Precondition** U is a member of W1 only. An authorized W1 admin issues `RemoveMember` on U (the §3.1 exception — the one transition permitted to produce `|E(U)| = 0`). U's account is still `active`. U signs in.
**Request** `POST /api/v1/auth/login` with **correct** credentials
**Authorization path** Pre-pipeline credentials pass. Active-workspace resolution (`B1_AUTH_SESSION_DESIGN.md` §4.2) builds `E(U) = ∅` and returns case 4.
**Expected** `200` · `Session{session_id:"SES-…", user:{…}, workspace_ref: **null**, expires_at}`
**State mutation** A `sessions` row is created with `active_workspace_id = NULL`. `last_login_at` set, `failed_login_count` reset.
**Audit** `auth.login_succeeded`, `workspace_id = NULL`, `details.no_eligible_workspace = true`, `result=succeeded`. **No `identity.invariant_violation` alert is raised** — this is a supported product state, not a defect.
**What the session can do** `GET /auth/session`, `GET /auth/sessions`, `POST /auth/sessions/*`, `POST /auth/logout`, `POST /auth/password-change`, `GET /workspaces` (empty list), `POST /workspaces`, `POST /invitations/accept`. **Every tenant-scoped route returns `404 WORKSPACE_NOT_FOUND` at pipeline step 5.** No tenant data is reachable by any path.
**Recovery** accepting a fresh invitation, or creating a workspace, restores `|E(U)| ≥ 1`; the very next request resolves normally with no re-login required.
**Information disclosure** None. The response shape is identical to any other successful login; `workspace_ref: null` tells the caller only about their own account.

---

### F20 — Suspending a member's final eligible membership

**Precondition** U is an active `member` of W1 and holds no other membership. An Admin of W1 attempts to suspend U.
**Request** `PATCH /api/v1/workspaces/W1/members/MEM-U {status:"suspended", version:3}`
**Authorization path** Steps 1–14 pass (the Admin holds `member.suspend`). Step 15 evaluates INV-USER-1 under the locked eligible-membership count.
**Expected** `409` · `CONFLICT`, `details.reason = "last_active_membership"`
**State mutation** **None.** `MEM-U.version` remains 3; `MEM-U.status` remains `active`; `users.status` for U is untouched.
**Audit** `authz.last_active_membership_blocked`, `result=denied`.
**Administrator's remedy** `RemoveMember`, which is the correct command for eviction and is deliberately unguarded (§3.1 exception). Suspension is a reversible pause and is never the right way to end a relationship.
**Information disclosure** Only that the target holds no other eligible workspace — a fact about a member the caller already administers. The response never names the other workspaces a user does or does not belong to.
**Variant — U also holds an `active` membership in W2:** the suspension **succeeds**. `|E(U)|` falls from 2 to 1, never to 0.
**Variant — U's other membership in W2 is itself `suspended`:** the suspension is **refused**. A suspended membership is not in `E(U)`, so W1 is still U's final *eligible* membership. This is exactly the case the pre-FIX.1 `status <> 'removed'` wording admitted.

---

### F21 — Leaving the last eligible workspace

**Precondition** U holds an `active` membership in W1 and a `suspended` membership in W2. U is not an Owner of W1. `E(U) = {W1}`.
**Request** `DELETE /api/v1/workspaces/W1/members/MEM-U {version:2}` (self ⇒ leave)
**Authorization path** Steps 1–14 pass. Step 15 evaluates INV-USER-1 for the self case.
**Expected** `409` · `CONFLICT`, `details.reason = "last_active_membership"`
**State mutation** **None.** `MEM-U` stays `active` at `version=2`.
**Audit** `authz.last_active_membership_blocked`, `result=denied`.
**Why the W2 membership does not save it** `E(U)` counts only `active` memberships in non-`deleting` workspaces. A `suspended` membership in W2 is not eligible, so leaving W1 would leave U with nowhere to go. Under the pre-FIX.1 wording (`status <> 'removed'`) this leave would have been permitted and U would have been silently stranded.
**U's remedy** obtain another eligible membership first (accept an invitation, or create a workspace), then leave W1. The product path is join-then-leave, mirroring the transfer-then-leave path for Owners.

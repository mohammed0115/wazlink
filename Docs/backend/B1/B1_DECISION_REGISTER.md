# B1 — Decision Register

> **CLASS A** — blocks B1 architecture closure. **CLASS B** — does not block B1 architecture but must be resolved before implementation. **CLASS C** — later product/provider/legal decision.

## 1. Decisions made in B1 (closed)

| ID | Decision | Rationale | Basis |
|---|---|---|---|
| `B1-D-A01` | Membership is the sole authority for workspace access; a User may hold memberships in many workspaces with a different role in each | The frozen `GET /workspaces` returns a *list* of `Workspace{role, status}` — unreachable under a one-workspace-per-user model | B0 `BACKEND_WORKSPACE_AUTH.md`, frozen OpenAPI |
| `B1-D-A02` | `sessions.active_workspace_id` (server-side) is the authoritative tenant selector; client-supplied workspace identifiers are never authorization inputs | B0: "selected from authenticated membership, never from an untrusted client-only identifier" | B0 `BACKEND_WORKSPACE_AUTH.md` |
| `B1-D-A03` **(revised in FIX.1)** | Login-time workspace resolution is total and deterministic: single eligible ⇒ that one; multiple ⇒ `last_active_workspace_id` **if still eligible and `active`**, else lowest `(priority, joined_at, workspace.public_id)` where `priority` puts `active` (0) ahead of `suspended`/`archived` (1); `\|E\| = 0` ⇒ `NULL`. Resolution never fails and never blocks login | `Session.workspace_ref` is a **required** frozen response field, so resolution can never be undefined; and an operationally usable workspace must win over a recovery-only one | frozen OpenAPI |
| `B1-D-A04` **(REPAIRED in FIX.1 — supersedes the original wording)** | **INV-USER-1: every `active` User holds ≥1 `active` Membership in a workspace whose status is `active`/`suspended`/`archived` — i.e. `\|E(U)\| ≥ 1`**, using the canonical eligibility predicate. The superseded form ("≥1 non-`removed` Membership") admitted a User whose every membership was `suspended` and therefore did not guarantee the property it existed to guarantee. Enforced by a transactional locked count on `SuspendMembership`, `LeaveWorkspace`, self-`RemoveMember`, and `DeleteWorkspace`, refusing `409 CONFLICT` · `last_active_membership` / `last_workspace` | closes audit finding MAJOR-1 | `B1_WORKSPACE_MEMBERSHIP_MODEL.md` §1.1, §3.1 |
| `B1-D-A05` | Membership states are `active/suspended/removed`; `invited` is **not** a membership state | pre-join state is owned by the Invitation aggregate. Two aggregates owning one fact would let a non-member appear in `GET /workspaces` and in seat counts | B1 consistency rule "one owner per concept" |
| `B1-D-A06` | Email verification is enforced at authorization-pipeline step 4, **not** at session creation | the frozen login declares only `200/400/401/429/500`; a `403` at login would break it | frozen OpenAPI + ADR-009 |
| `B1-D-A07` | Authorization order: RBAC (8) → tenant-scoped resolution (9) → object condition (10) → entitlement (11) → quota (12) | a caller who may not act must never learn plan, usage, or object existence | B0 disclosure doctrine |
| `B1-D-A08` | Cross-tenant and non-existent are indistinguishable: `404 ENTITY_NOT_FOUND` / `404 WORKSPACE_NOT_FOUND`, including for `SwitchWorkspace` | B0: deny responses "do not disclose whether another workspace object exists" | B0 `BACKEND_AUTHORIZATION_MATRIX.md` |
| `B1-D-A09` | INV-WS-1: every workspace not in `deleting` retains ≥1 `active` Owner, enforced by a locked count inside the mutating transaction | B0 matrix condition "cannot remove last Owner" made enforceable | B0 + ADR-010 |
| `B1-D-A10` | Multiple Owners are permitted; `owner` is grantable only via `TransferOwnership`, never via `PATCH` or an invitation | removes the lateral-escalation path (T4) while avoiding a single point of failure | derived |
| `B1-D-A11` | No authorization decision is cached anywhere in Phase 1 | B0 `BACKEND_DATA_GOVERNANCE.md` prohibits it without formally proven invalidation; also eliminates the stale-permission threat class outright | B0 governance |
| `B1-D-A12` | Seat quota is checked and consumed at **acceptance**, not at invitation | prevents invitation-based seat exhaustion and removes a compensating-release reconciliation surface | derived |
| `B1-D-A13` | Membership removal does not revoke sessions unless the user is left with zero eligible workspaces | otherwise any workspace admin could sign a user out of unrelated tenants (cross-tenant DoS, T22) | derived |
| `B1-D-A14` | Workspace lifecycle states are exactly B0's `active/suspended/archived/deleting`; `archived` remains eligible for active-workspace resolution | prevents locking members out of a workspace they must reach to resolve its state; adds no fifth state | B0 `BACKEND_WORKSPACE_AUTH.md` |
| `B1-D-A15` | `users` is the only identity table without a tenant column; `sessions` is user-bound and *references* a workspace | a session must survive workspace switching, and session listing must be scoped by user, not by tenant | derived |
| `B1-D-A16` **(recounted in FIX.1)** | **12** B0 codes reused, **10** new B1 codes, **9** proposed codes rejected as duplicates of existing B0 semantics. `409 CONFLICT` carries a closed `details.reason` set (`invitation_pending`, `membership_removed`, `last_workspace`, `last_active_membership`) rather than minting near-duplicate codes | B1 instruction "do not duplicate existing error semantics under new names"; counts recomputed directly from `B1_API_DTO_CONTRACTS.md` §4 | B0 `BACKEND_ERROR_CATALOG.md` |
| `B1-D-A17` | `DisableUser`/`EnableUser`/`DeleteUser` are platform-operator actions unreachable from any tenant role | stops one tenant from denying a user access to another | derived |
| `B1-D-A18` | Ownership transfer locks both membership rows in ascending `memberships.id` | a total lock order makes deadlock structurally impossible under concurrent transfers | ADR-010 |
| `B1-D-A19` **(strengthened in FIX.1)** | Raw invitation/verification/reset tokens are **≥256-bit CSPRNG**, stored only as `sha256`, nulled on every terminal transition, delivered solely through the out-of-band delivery boundary, and banned from logs, audit, events, the outbox, Celery arguments, **and every API response body**. They are returned to a client **zero** times, not once | B0 secret-handling doctrine, made specific to identity and hardened by `B1-D-A22` | B0 `BACKEND_SECURITY_ARCHITECTURE.md` |
| `B1-D-A20` | Frontend `user.role` (a job title) is separated from `Membership.role` (RBAC); the job title becomes `User.title`, display-only | conflating them would make a display string an authorization input | frozen frontend `Settings.tsx:185`, `:279` |
| `B1-D-A21` | INV-USER-1 has **exactly one enumerated exception**: an authorized administrator's `RemoveMember` on *another* member may leave that User with `\|E(U)\| = 0`. Every other transition is guarded. The resulting state is supported, not a defect: the global account stays `active`, login succeeds into a **no-workspace session**, and `POST /invitations/accept` / `POST /workspaces` remain reachable for recovery | guarding third-party removal would let one User's global state veto a tenant's control of its own membership list, and — with `SuspendMembership` also guarded — would leave an administrator no way to revoke access at all. Refusing login instead would make a single tenant action a permanent lockout of a global identity, the exact harm `B1-D-A17`/T22 forbid | `B1_WORKSPACE_MEMBERSHIP_MODEL.md` §3.1; `B1_AUTH_SESSION_DESIGN.md` §4.6 |
| `B1-D-A22` | `POST /workspaces/{id}/invitations` returns **`201 Invitation`** — one normative target, no alternative. The raw invitation token is returned by **no** API response; it is delivered only out-of-band. `email_masked` on every surface including creation | the frozen `201 Workspace` carries no invitation identity, so a client cannot address the invitation it just created. Returning the token to the browser is the weaker posture and frozen frontend truth never required it (`data.js:1025` stores no token; `Settings.tsx` renders no link) | closes audit finding MAJOR-2; `B1_API_DTO_CONTRACTS.md` §1.1(a), §3.1 |
| `B1-D-A23` | `Session.workspace_ref` stays in `required` and becomes **nullable**; `sessions.active_workspace_id` is nullable in exactly one documented case (`\|E(U)\| = 0`), and such a session is not usable for any tenant-scoped operation (invariant SESS-1) | the frozen non-nullable field cannot represent a reachable state, and every recovery path needs an authenticated session. The `required` set is unchanged, and B0 already pairs `required` with `nullable` on `PageInfo.next_cursor` | `B1_API_DTO_CONTRACTS.md` §1.1(b); `B1_AUTH_SESSION_DESIGN.md` §4.6.1–4.6.2 |

**23 decisions closed in B1.**

## 2. CLASS A unresolved

**None. `CLASS_A_UNRESOLVED = 0`.**

The independent CTO audit raised two Class A items. Both are now closed as decisions:

| Audit finding | Closure |
|---|---|
| **MAJOR-1** — INV-USER-1 did not guarantee an eligible workspace | **CLOSED** by `B1-D-A04` (repaired invariant), `B1-D-A21` (guard set + enumerated exception + no-workspace session), `B1-D-A23` (nullability). No option is left open to an implementer. |
| **MAJOR-2** — invitation response normatively contradictory | **CLOSED** by `B1-D-A22`. `201 Invitation` is the single normative target; every document now states it and only it. |

Every question whose answer is required to *close the B1 architecture* has been answered from repository truth or a stated, defensible derivation. The four items that remain outstanding at the **contract-amendment** layer — `B1-D-001`, `B1-D-002`, `B1-D-003`, `B1-D-019`, `B1-D-021` — are Class B rather than Class A because each has a **decided, unambiguous target** and no design question remains; only executing the controlled file change is outstanding, and B0's own registry scopes that work to "before implementation".

## 3. CLASS B — must be resolved before implementation

| ID | Decision | Why it is not Class A | Recommendation |
|---|---|---|---|
| `B1-D-001` | **Execute** the OpenAPI amendment `POST /workspaces/{id}/invitations` → `201 Invitation`, adding the `Invitation` schema | The *decision* is closed (`B1-D-A22`) and stated identically in every B1 document; only the controlled edit to `BACKEND_OPENAPI_V1.yaml` is outstanding. An implementer has no choice to make | Apply the amendment with CTO approval before implementation. B1 does not edit the frozen file |
| `B1-D-019` | **Execute** the OpenAPI amendment making `Session.workspace_ref` nullable (kept in `required`) | Same class as `B1-D-001`: decided (`B1-D-A23`), precedented (`PageInfo.next_cursor`), required set unchanged | Apply with CTO approval before implementation |
| `B1-D-021` | **Execute** the `BACKEND_DATA_MODEL.md` refinement narrowing membership uniqueness to a partial unique `(workspace_id, user_id) WHERE status <> 'removed'` | The intent of B0's "membership workspace/user unique" is preserved (one *live* membership per user per workspace); a literal full unique index would forbid re-invitation after removal, which B0's own retention doctrine rules out | Record the narrowing with the same amendment bundle before implementation |
| `B1-D-002` | Register `MEM-` for Membership in `BACKEND_PUBLIC_ID_REGISTRY.md` section A | The registry itself defines the extension mechanism ("requires an ADR, a data-model change, and a newly approved prefix"); the design names the prefix unambiguously | Approve `MEM-` with the ADR and data-model entries at the B1 contract amendment |
| `B1-D-003` | Register `WINV-` for WorkspaceInvitation in section A; do **not** reuse the section-B `INV-` fixture prefix | as above | Approve `WINV-`. Reusing `INV-` would reclassify a closed section-B row and create a lookalike hazard against `INV-BILL-` |
| `B1-D-005` | Step-up re-authentication scope: does `TransferOwnership`, `DeleteWorkspace`, or a billing change require password re-entry or a second factor? | A genuine product/security-policy choice B1 must not invent. Pipeline step 15 is reserved as the insertion point, so adding it later needs no re-architecture. Password change already requires the current password — that is decided | Recommend re-auth for `TransferOwnership` and `DeleteWorkspace`; defer MFA to the ADR-009 "later phases" review |
| `B1-D-007` | Final session window values (idle 8h, absolute 24h are the B1 defaults) | The *mechanism* — dual idle+absolute expiry with a non-extending absolute bound — is architecturally closed. Only the numbers are tunable | Confirm or tune; do not change the mechanism |
| `B1-D-011` | Operator recovery procedure when a workspace's sole Owner is disabled or unreachable | Detected and alerted by design (`workspace.owner_unavailable`); the recovery *policy* is an operations decision | Define an audited, dual-control operator procedure outside the tenant API |
| `B1-D-013` | Password policy specifics: minimum length (B1 default ≥12), which breached-password list, rotation (B1 default: none) | Defaults are stated and safe; the exact list/provider is an operations choice | Confirm the list source before implementation |
| `B1-D-014` | Invitation expiry (B1 default **7 days**) and resend rate limit (B1 default **5 / invitation / 24h** and **20 / workspace / hour**) | Both defaults are stated normatively and are covered by acceptance tests (AT-INV-5, AT-INV-11c, AT-INV-11d), so nothing is left for an implementer to invent; only tuning remains | Confirm or tune the numbers; do not change the mechanism |

## 4. CLASS C — later product / provider / legal

| ID | Decision | Note |
|---|---|---|
| `B1-D-004` | Workspace slug or human-readable code | Needs uniqueness, squatting, rename/redirect, and enumeration policies. Nothing in B0 or the frozen frontend addresses a workspace by anything but its opaque ID |
| `B1-D-006` | Whether authorization decisions may ever be cached | Requires the formally proven invalidation and TTL that B0 governance demands. Phase 1 answer is a firm no |
| `B1-D-008` | Persistent "remember me" sessions | The frozen frontend's own fixture is `session_only_mock`; adding persistence needs a device-trust and revocation policy |
| `B1-D-009` | Custom / workspace-defined roles | Phase 1 has exactly six roles. Custom roles need a permission-authoring UI, a delegation model, and an escalation-safety proof |
| `B1-D-010` | User email change flow | Needs dual-confirmation (old and new address), invitation re-binding rules, and audit. Out of B1 scope |
| `B1-D-012` | Whether `member.view` holders may see other members' full email addresses | Currently masked. Needs a privacy decision |
| `B1-D-015` | Identity retention durations: sessions, audit, invitations, deleted-user tombstones | Inherited **unresolved** from B0's `PRODUCT / LEGAL DECISION REQUIRED`. Every retention-bearing table already carries the timestamp a policy would need |
| `B1-D-016` | Whether password-change notifications include coarse geolocation | Depends on the IP-retention decision; B1 stores only a keyed hash |
| `B1-D-017` | MFA / OAuth / JWT | ADR-009 explicitly defers these to later phases requiring separate security review. B1 does not pre-empt it |
| `B1-D-018` | Saudi data locality for identity data | Inherited unresolved from B0 / ADR-012 |

## 5. Counts and the contract-amendment bundle

**Counts: CLASS_A_UNRESOLVED = 0 · CLASS_B_UNRESOLVED = 10 · CLASS_C_UNRESOLVED = 10.**

Class B rose from 8 to 10: `B1-D-019` and `B1-D-021` are new **execution** items for amendments whose design decisions are closed. Nothing moved *into* Class B from an unresolved state.

**The contract-amendment bundle (4 items, one approval).** `B1-D-001`, `B1-D-002`, `B1-D-003`, `B1-D-019`, and `B1-D-021` are all controlled edits to frozen B0 artefacts with decided targets. They should be applied together, once, before implementation begins:

| Item | Frozen file | Change |
|---|---|---|
| `B1-D-001` | `BACKEND_OPENAPI_V1.yaml` | `201 Invitation` + new `Invitation` schema |
| `B1-D-019` | `BACKEND_OPENAPI_V1.yaml` | `Session.workspace_ref` nullable (required set unchanged) |
| `B1-D-002` | `BACKEND_PUBLIC_ID_REGISTRY.md` | register `MEM-` in section A |
| `B1-D-003` | `BACKEND_PUBLIC_ID_REGISTRY.md` | register `WINV-` in section A |
| `B1-D-021` | `BACKEND_DATA_MODEL.md` | membership partial-unique narrowing |

Until that bundle is applied, **no implementation may mint `MEM-*` or `WINV-*`** and no implementation may rely on the amended response shapes.

No Class B or Class C item prevents the B1 architecture from being closed and handed to an implementation agent: each has a stated B1 default or a reserved insertion point, so implementation can proceed deterministically and the decision can be applied without re-architecture.

# B1 — Implementation Readiness and Consistency Evidence

> **B1 status:** Design complete after **B1-FIX.1**, uncommitted, pending independent CTO countersign. **No implementation was performed.**

**B0 baseline:** `261ec27f84f337be0d9318141de260c8b9058a6b` (verified `HEAD == origin/main`, before and after the repair).
**Frozen frontend:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1` (unmodified).
**Revision:** B1-FIX.1 — repairs the two MAJOR and thirteen MINOR findings of the independent B1 CTO audit. Every metric below is **recomputed from the documents**, not carried forward.

## 0. What B1-FIX.1 changed

| Audit finding | Repair | Where |
|---|---|---|
| **MAJOR-1** — INV-USER-1 admitted `status <> 'removed'`, so it did not guarantee an eligible workspace; login declared the resulting state impossible and alerted on it | Invariant restated over the canonical eligible set `E(U)`; transactional last-active-membership guard added to `SuspendMembership`, `LeaveWorkspace`, and self-`RemoveMember`; the one enumerated exception (third-party `RemoveMember`) named; `\|E(U)\| = 0` given a single deterministic behavior — login succeeds into a no-workspace session, no alert | `B1_WORKSPACE_MEMBERSHIP_MODEL.md` §1.1, §3.1 · `B1_AUTH_SESSION_DESIGN.md` §4.1, §4.2, §4.6 · `B1-D-A04`, `B1-D-A21`, `B1-D-A23` |
| **MAJOR-2** — five documents required a `201` body the frozen contract forbids | One normative target: **`201 Invitation`**, declared as an explicit B1 amendment over frozen B0. Raw token returned by **no** response; delivered out-of-band only | `B1_API_DTO_CONTRACTS.md` §1.1(a), §3, §3.1 · `B1-D-A22` |

All thirteen MINOR findings are repaired; see §6.

## 1. Readiness gates

| Gate | Result | Evidence |
|---|---|---|
| `TENANT_MODEL_READY` | **READY** | Workspace as tenant with 4 B0-verbatim states, 8 lifecycle transitions each carrying guard/side-effect/forbidden-effect/event/audit, an explicit `suspended` vs `archived` comparison (§1.6), tenant-context propagation for request/service/worker/outbox/webhook/audit, and the repaired INV-USER-1 |
| `IDENTITY_MODEL_READY` | **READY** | User global with 3 states; email identity, B0-compliant normalization (lowercase+trim only), uniqueness, verification, credential separation, disable/delete; multi-workspace proven against the frozen `GET /workspaces`; global identity provably unreachable from any tenant role |
| `MEMBERSHIP_MODEL_READY` | **READY** | First-class with a proposed `MEM-` identity, 3 states, 8 transitions, partial-unique live-membership constraint documented as a **B1 refinement** of B0, `version`, provenance, retention, last-owner protection (INV-WS-1) and last-active-membership protection (INV-USER-1) |
| `INVITATION_MODEL_READY` | **READY** | Proposed `WINV-` identity, 4 states, single normative `201 Invitation` response, ≥256-bit hashed single-use token never returned by any response, 7-day expiry, resend rotation with stated rate limits, duplicate/already-member/changed-email/expired/reused/cancelled/concurrent-acceptance all with distinct outcomes |
| `SESSION_MODEL_READY` | **READY** | `SES-` registry table, B0-compatible cookie name, dual idle+absolute expiry, rotation on login, 7 revocation reasons, per-session and global revocation, enumeration protection, and fully specified `active_workspace_id` nullability (invariant SESS-1); window *values* are Class B, the mechanism is closed |
| `RBAC_READY` | **READY** | 50 permission codes, 47-row × 6-role matrix derived cell-for-cell from all 17 rows of `BACKEND_AUTHORIZATION_MATRIX.md`, deny-by-default, `conditional` resolution rule, rank-based mutation guards, no-caching policy |
| `ENTITLEMENT_BOUNDARY_READY` | **READY** | Three authorities separated with ordering, six boundary invariants, distinct error payloads, frozen frontend vocabulary preserved verbatim |
| `QUOTA_BOUNDARY_READY` | **READY** | `seats` write path fully specified and reconciled with the suspension guard; transactional PostgreSQL reservation; Redis excluded from the decision |
| `API_CONTRACT_READY` | **READY** | 30 operations (4 frozen + 26 additive), each with method, route, auth, permission, request/response DTO, error set, idempotency, concurrency and audit; 3 further frozen operations reconciled unchanged; exactly **two** declared amendments, both decided |
| `DTO_CONTRACT_READY` | **READY** | 23 DTO definitions with per-field type/required/nullable/server-generated/client-writable/immutable/sensitive/validation; explicit never-writable list; `additionalProperties: false` on every request DTO; **0 undefined request or response DTOs** |
| `ERROR_CONTRACT_READY` | **READY** | 12 B0 codes reused (all verified present in `BACKEND_ERROR_CATALOG.md`), 10 new codes each with a distinctness justification, 9 proposed codes rejected as duplicates, closed `409 CONFLICT` reason vocabulary, full anti-enumeration mapping |
| `STATE_MACHINES_READY` | **READY** | 5 machines, every (state, command) pair total and unambiguous, explicit and accurate command-mapping section |
| `COMMAND_EVENT_READY` | **READY** | 31 commands, 26 events, zero duplicates, zero orphan events, 30 of 31 commands state-machine mapped with the 1 stateless command documented as such |
| `SECURITY_MODEL_READY` | **READY** | 26 threats × {attack, control, error behavior, audit signal, test case}; no threat mitigated by UI behavior or by Redis |
| `FAILURE_SCENARIOS_READY` | **READY** | F1–F21, each with precondition, request, authorization path, expected status/code, state mutation, audit result and information-disclosure behavior |
| `ACCEPTANCE_TESTS_READY` | **READY** | 150 deterministic acceptance criteria across 16 categories, including full coverage of both repaired MAJOR findings |
| `FRONTEND_TRACEABILITY_READY` | **READY** | 24 traced frontend concepts with target authority, API/DTO and migration note; 5 compatibility guarantees; the one new client state (no-workspace shell) called out |

**All 17 gates READY.**

## 2. Consistency-validation metrics (measured after FIX.1)

Every figure below is recomputed from the package by direct parse. No metric is carried forward from a previous revision.

| Check | Metric | Result |
|---|---|---|
| Documents in package | 18 | — |
| Non-`.md` files in the package | 0 | **PASS** |
| B0 workspace states preserved verbatim | `active/suspended/archived/deleting` | **PASS** |
| B0 six roles preserved verbatim | `owner/admin/manager/sales/member/viewer` | **PASS** |
| `ROLE_COUNT` | 6 | — |
| `PERMISSION_COUNT` (catalog) | **50** | — |
| Role-matrix rows / permission codes they carry | **47 rows → 50 codes** | — |
| `UNMAPPED_PERMISSIONS` (catalog ∖ matrix) | **0** | **PASS** |
| `UNKNOWN_PERMISSIONS` (matrix ∖ catalog) | **0** | **PASS** |
| Matrix rows with malformed grant cells | **0** | **PASS** |
| B0 authorization-matrix rows | **17** (counted from the frozen file) | — |
| `CONTRADICTORY_GRANTS` vs B0, cell for cell | **0** | **PASS** |
| Permission codes colliding with audit action codes | **0** | **PASS** |
| `COMMAND_COUNT` / unique / duplicates | 31 / 31 / **0** | **PASS** |
| `EVENT_COUNT` / unique / duplicates | 26 / 26 / **0** | **PASS** |
| `ORPHAN_EVENTS` (defined but never emitted) | **0** | **PASS** |
| Events emitted but not defined | **0** | **PASS** |
| `STATE_EVENT_DRIFT` | **0** | **PASS** |
| `UNMAPPED_STATE_COMMANDS` | **1** — `RequestPasswordReset`, documented stateless | **accurate, not zero** |
| `API_OPERATION_COUNT` / frozen / additive | 30 / 4 / 26 | **PASS** |
| API operations unique | 30 | **PASS** |
| DTO definitions | 23 | — |
| `UNDEFINED_REQUEST_DTOS` | **0** | **PASS** |
| `UNDEFINED_RESPONSE_DTOS` | **0** | **PASS** |
| `B0_ERROR_REUSE_COUNT` | **12** | — |
| Reused codes absent from `BACKEND_ERROR_CATALOG.md` | **0** | **PASS** |
| `B1_NEW_ERROR_COUNT` | **10** | — |
| `ERROR_COLLISIONS` with B0 | **0** | **PASS** |
| Rejected-as-duplicate proposals | **9** | — |
| New codes also listed as rejected | **0** | **PASS** |
| `THREAT_COUNT` | **26** | — |
| `FAILURE_SCENARIO_COUNT` | **21** (F1–F21, contiguous) | **PASS** |
| `ACCEPTANCE_TEST_COUNT` / unique / categories | **150 / 150 / 16** | **PASS** |
| Baseline gap rows requiring a B1 decision | 15 / 15 | — |
| Decisions closed in B1 | **23** | — |
| `CLASS_A_UNRESOLVED` | **0** | **PASS** |
| `CLASS_B_UNRESOLVED` / `CLASS_C_UNRESOLVED` | **10 / 10** | — |

## 3. B0 invariant preservation

| B0 invariant | Preserved | Where |
|---|---|---|
| Modular Django monolith / DRF / `/api/v1/` | ✔ | Blueprint §1; all routes under `/api/v1/` |
| PostgreSQL authoritative | ✔ | every identity table; every race resolved in PostgreSQL, including the new R17–R19 |
| Redis never canonical | ✔ | Concurrency §1, §5; Entitlement boundary §4; the INV-USER-1 guard is a locked SQL count |
| UUIDv7 + prefixed public IDs (ADR-006) | ✔ | Data model §1–§6; `MEM-`/`WINV-` proposed, never minted |
| Workspace = tenant boundary | ✔ | Workspace/Membership model §1 |
| Session auth + CSRF (ADR-009) | ✔ | Auth/Session §1–§3; cookie name matches frozen `sessionAuth` |
| Integer `version`, `409` on stale write (ADR-010) | ✔ | Concurrency §1, §4; every mutating route carries `If-Match` |
| Deny by default; scope before object lookup | ✔ | RBAC §1 step 9; Doctrines R-1…R-3 |
| Provider ports/adapters, no provider implementation | ✔ | no provider introduced; token delivery left behind the port as a documented seam |
| Outbox/inbox (ADR-005) | ✔ | Command/Event catalog §3.5 |
| Idempotency doctrine (single system, header transport) | ✔ | Concurrency §3; **no request DTO carries an idempotency field** |
| Immutable audit, no secrets | ✔ | Privacy/Audit §2; Rule P-1 extended to API responses |
| Six roles; matrix cells unchanged | ✔ | RBAC §3, verified against all 17 B0 rows |
| Workspace states unchanged | ✔ | State machines §1 |
| Frozen Foundation prefixes `WORK-/USR-/SES-/JOB-` | ✔ | Data model §1 |
| No authorization caching without proven invalidation | ✔ | RBAC §3; `B1-D-A11` |
| Deny responses disclose no cross-workspace existence | ✔ | RBAC §1; API §4.4; F8, F18 |

**`B0_CONTRADICTIONS = 0`**, with **two explicitly declared target-contract amendments** that B1 does not disguise as existing B0 truth (Blueprint §1; `B1_API_DTO_CONTRACTS.md` §1.1):

1. `POST /workspaces/{id}/invitations` → `201 Invitation` (`B1-D-A22` / execution `B1-D-001`)
2. `Session.workspace_ref` nullable, `required` set unchanged (`B1-D-A23` / execution `B1-D-019`)

plus two refinements in the same bundle: the membership partial-unique narrowing (`B1-D-021`) and the `MEM-`/`WINV-` registrations (`B1-D-002`, `B1-D-003`). **B1 edits no frozen file.**

## 4. Implementation-leakage gate

| Gate | Result | Evidence |
|---|---|---|
| `DJANGO_IMPLEMENTATION` | **0** | pattern scan for `from django`, `import django`, `models.Model`, `serializers.` across all 18 documents |
| `DATABASE_MIGRATIONS` | **0** | scan for `migrations.CreateModel/AddField`, `makemigrations`, `CREATE TABLE` |
| `DRF_IMPLEMENTATION` | **0** | scan for `rest_framework import`, `APIView)`, `ViewSet)` |
| `AUTH_IMPLEMENTATION` | **0** | no authentication backend, middleware, or hasher call is written; all auth text is specification |
| `REDIS_IMPLEMENTATION` | **0** | scan for `redis.Redis`, `StrictRedis`, `from redis` |
| `CELERY_IMPLEMENTATION` | **0** | scan for `@shared_task`, `@app.task`, `from celery` |
| `PROVIDER_IMPLEMENTATION` | **0** | no provider client, SDK, or credential appears; the delivery boundary is a contract, not an adapter |
| `DEPENDENCY_CHANGES` / `LOCKFILE_CHANGES` | **0** | `package.json` and `pnpm-lock.yaml` untouched |
| `DEPLOYMENT_CHANGES` | **0** | `.github/` untouched |
| `SECRET_FILES` | **0** | no secret, key, or credential file created |
| Non-`.md` files in the B1 package | **0** | directory listing |
| Frozen B0 files modified | **0** | `BACKEND_OPENAPI_V1.yaml`, `BACKEND_PUBLIC_ID_REGISTRY.md`, `BACKEND_DATA_MODEL.md`, `BACKEND_ERROR_CATALOG.md`, `BACKEND_AUTHORIZATION_MATRIX.md` all unmodified |

The three conceptual fragments in the package — `Resource.objects.for_workspace(...)` (`B1_AUTHORIZATION_RBAC.md` §4), the eligibility predicate (`B1_AUTH_SESSION_DESIGN.md` §4.1) and the eligible-membership count (`B1_WORKSPACE_MEMBERSHIP_MODEL.md` §3.1) — are explicitly labelled as illustrative shape, not code, and are not valid Python or executable SQL.

## 5. Known non-blocking observations

| # | Severity | Observation |
|---|---|---|
| 1 | INFO | `MEM-` and `WINV-` are **proposed/reserved**, not registered. B0's registry scopes prefix registration to "before implementation", so this does not block design closure; no implementation may mint them until `B1-D-002`/`B1-D-003` are applied. |
| 2 | INFO | Two frozen-contract amendments (`B1-D-001`, `B1-D-019`) and two refinements (`B1-D-021`, and the `MEM-`/`WINV-` rows) require one controlled approval before implementation. All four have decided targets; none leaves an implementer a choice. |
| 3 | INFO | Permission codes and audit action codes share a dotted lowercase shape. Disambiguated by an explicit namespace rule; measured collisions **0**. |
| 4 | INFO | Session idle/absolute windows (8h / 24h), invitation expiry (7 days) and resend limits (5/invitation/24h, 20/workspace/hour) are stated B1 defaults under `B1-D-007` and `B1-D-014`, each covered by an acceptance test. The mechanisms are closed; only the numbers are tunable. |
| 5 | INFO | Identity retention durations remain **PRODUCT / LEGAL DECISION REQUIRED**, inherited unresolved from B0. Every retention-bearing table already carries the timestamp column a policy would need. |
| 6 | INFO | `UNMAPPED_STATE_COMMANDS = 1` by design (`RequestPasswordReset`). This is documented rather than driven to zero, because forcing a stateless command into a machine would misrepresent it. |

None invalidates a B1 contract. `CRITICAL_FINDINGS = 0`, `MAJOR_FINDINGS = 0`.

## 6. MINOR findings from the independent audit — disposition

| # | Audit finding | Disposition |
|---|---|---|
| 1 | "11 B0 codes reused"; actual 12 | **Fixed.** §4.1 headed "Reused from B0 (12)"; recounted here and in `B1-D-A16`. |
| 2 | Rejected-duplicate count stated as 7 and 9; actual 8 | **Fixed.** Now 9 rows after adding `LAST_ACTIVE_MEMBERSHIP_REQUIRED`, stated identically in §4.3 and `B1-D-A16`. |
| 3 | "18-row" B0 authorization matrix; actual 17 | **Fixed.** Gap analysis now says 17, counted from the frozen file. |
| 4 | `MembershipPair` referenced but undefined | **Fixed.** Replaced by `OwnershipTransferResult`, fully defined; `UNDEFINED_RESPONSE_DTOS = 0`. |
| 5 | `idempotency_key` as a required body field on 4 DTOs | **Fixed.** All four removed; header-only transport stated in the API surface, the request-DTO preamble, and the concurrency doc; AT-IDEM-5/6/7 assert it. |
| 6 | Cookie name `sid` vs frozen `sessionid` | **Fixed.** Canonical value is `sessionid`; the hardening idea is retained as an explicitly non-normative note. AT-SESS-12 asserts it. |
| 7 | No entropy requirement for email-verification / password-reset tokens | **Fixed.** ≥256-bit CSPRNG specified in the data model, Rule P-1 and the blueprint; threat **T26** added; AT-AUTH-23/24/25/26 added. |
| 8 | `UNMAPPED_STATE_COMMANDS` stated as 2 and contradicted by the catalog | **Fixed.** State machines §6 rewritten and the catalog's blanket claim removed; the accurate value is **1**. |
| 9 | Login-failure status drift for `\|E\| = 0` | **Fixed.** The condition no longer produces a login failure at all: login succeeds with `workspace_ref: null`. The state machine, §4.2, §4.6, F19 and AT-AUTH-18 all agree. |
| 10 | `MEM-`/`WINV-` wording drift ("registers"/"adds") | **Fixed.** Normalized to "proposes/reserves" in the blueprint, gap analysis, data model and index. |
| 11 | Login tie-break could prefer an archived workspace over an active one | **Fixed.** Ordering key is now `(priority, joined_at, public_id)` with `active` = 0; the stored hint only wins when it points at an `active` workspace. AT-ISO-8/9/10/11 added. |
| 12 | F6 audit sentence self-contradictory | **Fixed.** F6 now states one canonical behavior and the general rule that `authz.permission_denied` + `error_code` covers pipeline denials. AT-AUD-7 added. |
| 13 | No default for the invitation resend rate limit | **Fixed.** 5/invitation/24h and 20/workspace/hour, stated in the membership model, the state machine and `B1-D-014`; AT-INV-11c/11d assert both. |

The six INFO observations are also addressed: the membership partial-unique narrowing is now labelled a B1 refinement (§4 of the data model); `suspended` vs `archived` has an explicit comparison (§1.6); the domain-ownership claim reads "preserves and refines" with the `roles` placement explained; `active_workspace_id` nullability is fully specified; the DTO count is recomputed as 23; and the three list envelopes are explicitly defined against B0's `{items, page_info}` convention.

## 7. Handover statement

A future Tenant & Identity implementation agent can build this without making a product or security decision. The tenant boundary, identity model, membership lifecycle and its two invariants, invitation security posture, session policy, active-workspace resolution and its `\|E(U)\| = 0` case, authorization order, role matrix, entitlement/quota boundary, concurrency outcomes, idempotency transport and requirements, error semantics, audit vocabulary and 150 acceptance criteria are all specified. Where a genuine product choice remains it is recorded in `B1_DECISION_REGISTER.md` with a stated B1 default and a reserved insertion point.

**One gate stands before implementation:** the contract-amendment bundle (`B1-D-001`, `B1-D-002`, `B1-D-003`, `B1-D-019`, `B1-D-021`) must be approved and applied. Until then no implementation may mint `MEM-*`/`WINV-*` or rely on the amended response shapes.

**B2 (CRM domain design) readiness:** the tenant-scoping doctrines (R-1…R-4), the authorization pipeline and the resource-authorization rules for Lead → Business, Conversation → Lead, Deal → Lead, Task → Lead, RevenueEvent → source and File → owner are specified, so B2 inherits a complete tenant and authorization foundation. B2 remains gated on B1 being countersigned and checkpointed.

**B1-FIX.1 is not self-closing. Independent CTO countersign is required. No commit, push, deploy, implementation, dependency, lockfile, migration, provider, or frontend change was performed.**

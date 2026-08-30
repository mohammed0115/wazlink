# B1 — Tenant & Identity Target Design Blueprint

> **B1 status:** Target architecture and contracts only. Backend coding is not authorized. This package is normative for the future Tenant & Identity implementation agent.

**B0 baseline (frozen, CLOSED):** `261ec27f84f337be0d9318141de260c8b9058a6b`
**Frozen frontend baseline:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`
**Scope:** Workspace (tenant), User (global identity), Membership, Invitation, Session, Authentication, Authorization/RBAC, and the RBAC↔Entitlement↔Quota boundary.
**Out of scope:** CRM, Discovery, Messaging, Pipeline, Automation, Revenue, Billing internals, Tax, Files. B1 defines only how those domains obtain tenant context and authorization.

## 1. Relationship to B0

B0 is the frozen architectural foundation. B1 inherits, and never re-opens, the following:

| B0 invariant | B1 treatment |
|---|---|
| Modular Django monolith, DRF, `/api/v1/` | Inherited unchanged |
| PostgreSQL authoritative durable state | Inherited; all identity truth is PostgreSQL |
| Celery + Redis; Redis never canonical | Inherited; no identity/authorization truth in Redis |
| UUIDv7 internal IDs + prefixed opaque public IDs (ADR-006) | Inherited. B1 **proposes/reserves** two target prefixes (`MEM-`, `WINV-`) through the registry's own extension mechanism; it registers nothing and mints nothing. |
| Workspace is the tenant boundary | Inherited and made concrete |
| Session authentication (ADR-009), CSRF on unsafe cookie requests | Inherited and fully specified |
| Integer `version` optimistic concurrency (ADR-010), `409` on stale write | Inherited and extended to Membership/Workspace/Invitation |
| Deny-by-default authorization; querysets scoped before object lookup | Inherited and made an enforceable doctrine |
| Provider ports/adapters; no provider implementation | Inherited; B1 introduces no provider |
| Transactional outbox / webhook inbox (ADR-005) | Inherited; identity events publish through the outbox |
| Idempotency doctrine (`IdempotencyRecord`, workspace + principal + command + body hash) | Inherited; B1 introduces no second idempotency system |
| Auditability, immutable `audit_logs` | Inherited and extended with identity audit actions |
| Six roles: Owner, Admin, Manager, Sales, Member, Viewer | Inherited verbatim; B1 does not invent roles |
| Workspace states `active`, `suspended`, `archived`, `deleting` | Inherited verbatim; B1 does not invent alternative names |
| `WORK-`, `USR-`, `SES-`, `JOB-` frozen Foundation prefixes | Inherited; never substituted |

**B0 contradictions found: 0.** Every B1 construct is either a direct materialization of an existing B0 statement, an additive extension using a mechanism B0 itself defines, or one of the **two explicitly declared B1 target-contract amendments** below.

**Declared amendments to frozen B0 (2).** B1 does not pretend B0 already says these, and B1 does not edit any frozen file. Both are decided; executing them is a gated pre-implementation step.

| # | Frozen B0 | B1 target | Where |
|---|---|---|---|
| 1 | `POST /workspaces/{id}/invitations` → `201 Workspace` | → `201 Invitation` (new schema) | `B1_API_DTO_CONTRACTS.md` §1.1(a) · `B1-D-A22` / `B1-D-001` |
| 2 | `Session.workspace_ref` required, non-nullable | required **and** nullable (required set unchanged) | `B1_API_DTO_CONTRACTS.md` §1.1(b) · `B1-D-A23` / `B1-D-019` |

Two further B1 refinements are carried in the same amendment bundle: the `memberships` partial-unique narrowing (`B1_IDENTITY_DATA_MODEL.md` §4, `B1-D-021`) and the `MEM-`/`WINV-` prefix registrations (`B1-D-002`, `B1-D-003`).

## 2. Design principles

1. **User ≠ Workspace.** A User is a global identity. A Workspace is a tenant. `Membership` is the only authoritative link, and it is first-class (own public ID, status, role, version, audit).
2. **The client never names its own tenant.** The active workspace is resolved from server-side session state joined to an active Membership. A `workspace_id`, public ID, header, or query parameter supplied by the client is a *presentation input*, never an authorization input.
3. **Scope before existence.** Every tenant-owned lookup filters by the resolved active workspace *before* object resolution. A cross-workspace object is indistinguishable from a non-existent one.
4. **Three separate authorities.** RBAC answers *may this user act*; Entitlement answers *does this workspace's plan include the capability*; Quota answers *is there allowance left*. None implies another.
5. **No authorization caching in Phase 1.** B0 `BACKEND_DATA_GOVERNANCE.md` prohibits caching authorization decisions without formally proven invalidation. B1 therefore recomputes membership, role, entitlement, and quota per request inside the request transaction. This structurally eliminates stale-permission attacks.
6. **PostgreSQL decides races.** Identity races are resolved by row locks, unique constraints, and integer `version`, never by Redis locks.
7. **Secrets never leave their store.** Raw passwords, session keys, invitation tokens, verification tokens, and reset tokens are never logged, never audited, never placed in an event or outbox row or Celery argument, **never returned by any API response**, and never stored in reversible form. Every raw token is ≥256-bit CSPRNG, stored only as `sha256`, and reaches its subject solely through the out-of-band delivery boundary.
8. **One owner per concept.** Exactly one aggregate owns each state; no state name is reused with a different meaning across aggregates.

## 3. Aggregate ownership

| Aggregate | Owning domain (B0 `BACKEND_DOMAIN_OWNERSHIP.md`) | Authoritative tables |
|---|---|---|
| User | Identity & Access (`accounts`) | `users`, `user_credentials`, `user_email_tokens` |
| Session | Identity & Access (`accounts`) | `sessions` |
| Workspace | Workspace (`workspaces`) | `workspaces` |
| Membership | Workspace (`workspaces`) | `memberships` |
| Invitation | Workspace (`workspaces`) | `invitations` |
| Role/permission catalog | Workspace (`workspaces`) | `roles` (+ code-constant permission matrix) |
| Entitlement decision | Entitlements (`entitlements`) | `plans`, `capabilities`, `quota_definitions`, `usage_counters` |
| Audit record | Audit (`audit`) | `audit_logs` |

This **preserves and refines** the B0 ownership model; it does not restate it verbatim. `BACKEND_DOMAIN_OWNERSHIP.md` assigns `users, sessions` to Identity & Access and `workspaces, memberships, invitations` to the Workspace domain — `roles` is not listed there. `roles` appears in `BACKEND_DATA_MODEL.md` under the **Tenant** table group alongside `workspaces/memberships/invitations`, so B1 places it with the Workspace domain as the nearest owning context and as a global (non-tenant-owned) catalog. That placement is a B1 refinement of an unassigned B0 table, not an existing B0 statement. **B1 adds no new top-level domain.**

## 4. Package map

| Document | Covers |
|---|---|
| `B1_TENANT_IDENTITY_BLUEPRINT.md` | This document: scope, B0 inheritance, principles, ownership |
| `B1_BASELINE_GAP_ANALYSIS.md` | Reconstructed B0 + frozen-frontend truth, gap matrix |
| `B1_IDENTITY_DATA_MODEL.md` | Logical schema for `users`, `workspaces`, `memberships`, `invitations`, `sessions`, `roles` |
| `B1_WORKSPACE_MEMBERSHIP_MODEL.md` | Workspace, User, Membership, Invitation, Owner semantics |
| `B1_AUTH_SESSION_DESIGN.md` | Authentication, sessions, active-workspace resolution, switching |
| `B1_AUTHORIZATION_RBAC.md` | Authorization pipeline, role/permission matrix, resource authorization, privileged actions |
| `B1_ENTITLEMENT_QUOTA_BOUNDARY.md` | RBAC vs Entitlement vs Quota separation and ordering |
| `B1_CONCURRENCY_IDEMPOTENCY.md` | Race analysis and idempotency requirements |
| `B1_API_DTO_CONTRACTS.md` | API target surface, DTOs, error contract |
| `B1_STATE_MACHINES.md` | Workspace, Membership, Invitation, Session state machines |
| `B1_COMMAND_EVENT_CATALOG.md` | Commands, events, payloads, outbox and PII classification |
| `B1_SECURITY_THREAT_MODEL.md` | Threat/control/error/audit/test matrix |
| `B1_PRIVACY_AUDIT_MODEL.md` | Identity data classification, logging/masking, audit records |
| `B1_FAILURE_SCENARIOS.md` | F1–F18 end-to-end failure walkthroughs |
| `B1_ACCEPTANCE_TEST_MATRIX.md` | Deterministic acceptance criteria |
| `B1_FRONTEND_TRACEABILITY.md` | Frozen frontend → B1 target authority |
| `B1_DECISION_REGISTER.md` | Class A/B/C decision register |
| `B1_IMPLEMENTATION_READINESS.md` | Readiness gates and consistency-validation evidence |

## 5. Implementation prohibition

No file in this package is executable backend implementation. Under B1 no agent may create Django projects/apps, models, serializers, views, URLs, middleware, authentication backends, migrations, SQL, Celery tasks, Redis usage, provider clients, secrets, dependency/lockfile changes, deployment configuration, or frontend changes. B1 produces documentation only and is left uncommitted for CTO review.

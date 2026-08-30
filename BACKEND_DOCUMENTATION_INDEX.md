# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Normative document index

| Document | Purpose |
|---|---|
| `B0_BACKEND_BLUEPRINT.md` | executive architecture and implementation gate |
| `BACKEND_ARCHITECTURE_DECISIONS.md` | ADR decisions and unresolved choices |
| `BACKEND_DOMAIN_OWNERSHIP.md` | bounded contexts and write ownership |
| `BACKEND_AUTHORIZATION_MATRIX.md` | role/action authorization |
| `BACKEND_RETRY_POLICY.md` | retry classes and dead letters |
| `BACKEND_TIMEOUT_POLICY.md` | finite provider/job deadlines |
| `BACKEND_IDEMPOTENCY_STANDARD.md` | platform idempotency contract |
| `BACKEND_API_STANDARD.md` | REST transport conventions |
| `BACKEND_API_CATALOG.md` | conceptual endpoint catalog |
| `BACKEND_DTO_CONTRACTS.md` | stable request/response DTOs |
| `BACKEND_ERROR_CATALOG.md` | machine-readable errors |
| `BACKEND_DATA_MODEL.md` | logical PostgreSQL schema |
| `BACKEND_ERD.md` | domain relationship diagram |
| `BACKEND_SECURITY_ARCHITECTURE.md` | security and tenant isolation |
| `BACKEND_PRIVACY_AND_DATA_HANDLING.md` | classification and retention principles |
| `BACKEND_RATE_LIMIT_POLICY.md` | API/provider cost controls |
| `BACKEND_COMMAND_EVENT_CATALOG.md` | command/event vocabulary |
| `BACKEND_FAILURE_MATRIX.md` | failure behavior |
| `BACKEND_RECONCILIATION.md` | operational reconciliation |
| `BACKEND_STATE_MACHINES.md` | lifecycle states |
| `BACKEND_SEQUENCE_DIAGRAMS.md` | core flow diagrams |
| `FRONTEND_BACKEND_CONTRACT_MAP.md` | service replacement compatibility |
| `BACKEND_TEST_STRATEGY.md` | future test pyramid |
| `BACKEND_DATA_GOVERNANCE.md` | data, ORM, cache, money, time policies |
| `BACKEND_OPENAPI_V1.yaml` | architecture-level OpenAPI contract |
| `BACKEND_PUBLIC_ID_REGISTRY.md` | canonical public-ID prefix registry |
| `BACKEND_INTEGRATION_BOUNDARIES.md` | provider and anti-corruption boundaries |
| `BACKEND_BILLING_TAX_ARCHITECTURE.md` | Platform Billing, Payment, Tax, and ZATCA separation |
| `BACKEND_ANALYTICS_SEMANTICS.md` | metric formulas and recognized-revenue semantics |
| `BACKEND_WORKSPACE_AUTH.md` | workspace, authentication, authorization, and tenancy |
| `BACKEND_OPERATIONS_OBSERVABILITY.md` | operations, observability, backup, and disaster recovery |
| `BACKEND_ROLLOUT_MIGRATION.md` | frontend freeze, rollout, and migration plan |
| `B0_BACKEND_TRACEABILITY.md` | B0 requirement traceability and implementation gate |
| `B0_IMPLEMENTATION_REPORT.md` | factual B0/B0-FIX delivery evidence |

## B1 — Tenant & Identity target design (additive; B0 unchanged)

`Docs/backend/B1/` holds the B1 Tenant & Identity target-design package (revision **B1-FIX.1**). It is **additive**: it modifies no frozen B0 file, and B0 remains closed at `261ec27f84f337be0d9318141de260c8b9058a6b`.

B1 declares **two target-contract amendments** to frozen B0, both decided and both requiring controlled CTO approval **before implementation**; B1 itself applies neither. See `Docs/backend/B1/B1_API_DTO_CONTRACTS.md` §1.1.

| Frozen B0 | B1 target | Decision / execution |
|---|---|---|
| `POST /workspaces/{id}/invitations` → `201 Workspace` | → `201 Invitation` (new schema; no raw token in any response) | `B1-D-A22` / `B1-D-001` |
| `Session.workspace_ref` required, non-nullable | required **and** nullable; `required` set unchanged | `B1-D-A23` / `B1-D-019` |

| Document | Purpose |
|---|---|
| `Docs/backend/B1/B1_TENANT_IDENTITY_BLUEPRINT.md` | B1 scope, B0 inheritance, design principles, package map |
| `Docs/backend/B1/B1_BASELINE_GAP_ANALYSIS.md` | reconstructed B0 + frozen-frontend truth and the 15-row gap matrix |
| `Docs/backend/B1/B1_IDENTITY_DATA_MODEL.md` | logical schema for users, workspaces, memberships, invitations, sessions, roles |
| `Docs/backend/B1/B1_WORKSPACE_MEMBERSHIP_MODEL.md` | Workspace, User, Membership, Invitation, and Owner semantics |
| `Docs/backend/B1/B1_AUTH_SESSION_DESIGN.md` | authentication, sessions, active-workspace resolution and switching |
| `Docs/backend/B1/B1_AUTHORIZATION_RBAC.md` | authorization pipeline, permission catalog and role matrix, resource-authorization doctrine |
| `Docs/backend/B1/B1_ENTITLEMENT_QUOTA_BOUNDARY.md` | RBAC vs entitlement vs quota separation |
| `Docs/backend/B1/B1_CONCURRENCY_IDEMPOTENCY.md` | identity race analysis and idempotency requirements |
| `Docs/backend/B1/B1_API_DTO_CONTRACTS.md` | B1 API surface, DTOs, and error contract |
| `Docs/backend/B1/B1_STATE_MACHINES.md` | Workspace, Membership, Invitation, Session, User state machines |
| `Docs/backend/B1/B1_COMMAND_EVENT_CATALOG.md` | identity commands, events, payload and outbox rules |
| `Docs/backend/B1/B1_SECURITY_THREAT_MODEL.md` | 26-threat identity threat model |
| `Docs/backend/B1/B1_PRIVACY_AUDIT_MODEL.md` | identity data classification and audit record model |
| `Docs/backend/B1/B1_FAILURE_SCENARIOS.md` | F1–F21 end-to-end failure scenarios |
| `Docs/backend/B1/B1_ACCEPTANCE_TEST_MATRIX.md` | 150 deterministic acceptance criteria |
| `Docs/backend/B1/B1_FRONTEND_TRACEABILITY.md` | frozen frontend to B1 target authority |
| `Docs/backend/B1/B1_DECISION_REGISTER.md` | Class A/B/C decision register |
| `Docs/backend/B1/B1_IMPLEMENTATION_READINESS.md` | readiness gates and consistency-validation evidence |

Two public-ID prefixes (`MEM-`, `WINV-`) are **proposed/reserved** by B1. They are **not** registered canonical B0 prefixes: `BACKEND_PUBLIC_ID_REGISTRY.md` is unmodified and contains neither. Registration (`B1-D-002`, `B1-D-003`) is part of the same controlled pre-implementation amendment bundle, together with the membership partial-unique refinement to `BACKEND_DATA_MODEL.md` (`B1-D-021`). **No implementation may mint `MEM-*` or `WINV-*` until that bundle is applied.**

B1 is design-only and grants no implementation authorization.

## Required next-phase gate

Before implementation, resolve all items marked `PRODUCT DECISION REQUIRED`, `REQUIRES OFFICIAL ZATCA VALIDATION`, or `REQUIRES PROVIDER CONTRACT VALIDATION`; approve the API/DTO/ERD/OpenAPI/identity documents as frozen; then authorize Backend Architecture-to-Coding transition explicitly. This package contains no implementation. B0-FIX.3 repairs are documentation/contract-only and do not self-close B0.

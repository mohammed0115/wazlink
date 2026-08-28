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

## Required next-phase gate

Before implementation, resolve all items marked `PRODUCT DECISION REQUIRED`, `REQUIRES OFFICIAL ZATCA VALIDATION`, or `REQUIRES PROVIDER CONTRACT VALIDATION`; approve the API/DTO/ERD documents as frozen; then authorize Backend Architecture-to-Coding transition explicitly. This package contains no implementation.

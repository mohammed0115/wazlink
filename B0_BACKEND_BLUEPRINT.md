# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Executive decision

WazLink will use a modular Django monolith with Django REST Framework, PostgreSQL as the canonical operational database, Redis as broker/cache/short-lived lock only, Celery as the Python-native asynchronous execution framework, Hostinger platform storage for blobs only, and an internal webhook gateway for external callbacks. The first production backend should remain one deployable application with explicit domain modules and application services; distributed services and Kafka are deferred until measured scale requires them.

The architecture preserves the frontend commercial contract **Won Deal ≠ Recognized Revenue**. A Deal can become `won` without creating a RevenueEvent. Revenue recognition is a separately commanded and authorized business action with an explicit source, idempotency key, currency, recognition date, and audit trail. Platform Billing is a separate bounded context from customer CRM Revenue.

## Non-negotiable rules

1. Every tenant-owned row is workspace-scoped and every query is authorized by workspace and object permission.
2. Internal UUID/UUIDv7 primary keys are never exposed as the only public identifier; immutable prefixed `public_id` values preserve the frontend vocabulary such as `BUS-*`, `LEAD-*`, `CONV-*`, and `DEAL-*`.
3. Core business transitions live in explicit application services, not views, serializers, signals, or worker functions.
4. External providers are reached only through adapters behind anti-corruption boundaries.
5. Long-running work is submitted as a Job resource and processed asynchronously. Provider retries, webhook retries, and worker retries are idempotent.
6. No frontend query parameter, redirect, or client usage counter grants a plan, payment, entitlement, or recognized revenue.
7. Raw provider payloads, prompts, payment data, and messages are minimized, classified, masked, and retained only under documented policy.

## Target package structure

```text
backend/
  config/                 # Django settings, URL root, ASGI/WSGI, health
  apps/
    accounts/             # users, sessions, authentication
    workspaces/           # workspace, membership, invitations, RBAC
    entitlements/         # plans, capabilities, quotas, subscriptions
    discovery/            # jobs, queries, results, business identity
    crm/                  # leads, contacts, tasks, appointments
    intelligence/         # analyses, prompts, AI usage references
    messaging/            # conversations, messages, delivery state
    pipeline/             # pipelines, stages, deals
    automation/           # rules, runs, approvals, actions
    analytics/            # read-only metric queries and projections
    revenue/              # revenue events and reversals
    attribution/          # touchpoints and attribution reports
    billing/              # subscriptions, invoices, payments, refunds
    tax/                  # tax invoices and ZATCA state
    integrations/         # provider connection metadata and adapters
    webhooks/             # receipt, signature, deduplication, dispatch
    files/                # FileAsset and signed storage access
    audit/                # immutable AuditLog
    observability/        # correlation, health, diagnostics
  common/
    ids.py, money.py, time.py, errors.py, idempotency.py
    application/, domain/, repositories/, integrations/
```

## Phase 1 API strategy

Use `/api/v1/` with stable resource DTOs. Dashboard and Lead 360 should use dedicated read aggregation endpoints (`/dashboard/overview` and `/leads/{id}/360`) backed by canonical domain queries; this reduces frontend round trips while preventing duplicated business formulas. Mutations remain domain-specific commands. Analytics endpoints return metric metadata describing period, timezone, currency, scope, and snapshot/event semantics.

## Phase 1 integration choices

| Boundary | Decision | Reason |
|---|---|---|
| Google Places (New) | Adapter with normalized request/result DTOs | Vendor schema must not leak into Business |
| Scraping | Replaceable `ScrapingProvider` interface | Provider fields are not CRM truth |
| WhatsApp | Meta Cloud adapter + webhook ingress | Delivery/order/retry require provider isolation |
| AI | Internal AI Gateway + provider adapter | Central safety, usage, cost, prompt versioning |
| Payments | Tap adapter with webhook-first truth | Redirects are not payment truth |
| Tax | Dedicated Tax/ZATCA adapter | Tap is not a ZATCA-compliant invoice |
| Files | Hostinger `FileStorageProvider` | Blob storage only, signed access |
| Queue | Celery + Redis | Django-native maturity, retries, scheduling, routing |
| Events | Transactional outbox + Celery dispatcher | Durable side effects without Kafka |
| Observability | Sentry + OpenTelemetry | Errors plus trace correlation |

## Explicitly deferred

Email, Gmail, Google Calendar, FCM, Elasticsearch, microservices, Kafka, public Django Admin as CRM, live provider calls in CI, legal certification, data-locality commitments, and any backend coding are deferred. Product/legal/provider validation is required before final implementation decisions where marked in companion documents.

## Decision register

| ID | Decision | Status |
|---|---|---|
| ADR-001 | Modular Django monolith | Accepted for Phase 1 |
| ADR-002 | DRF typed REST `/api/v1/` | Accepted |
| ADR-003 | PostgreSQL canonical store | Accepted |
| ADR-004 | Celery + Redis | Accepted |
| ADR-005 | Transactional outbox and webhook inbox | Accepted |
| ADR-006 | UUIDv7 internal IDs + prefixed public IDs | Accepted |
| ADR-007 | RevenueEvent separate from Deal and Billing | Accepted |
| ADR-008 | First-touch attribution with explicit multi-touch read model later | Accepted for Phase 1 |
| ADR-009 | Session-backed authentication for Phase 1 | Accepted, security validation required |
| ADR-010 | Version integer for editable resources | Accepted |
| ADR-011 | Cursor pagination for high-volume resources; offset only for bounded catalogs | Accepted |
| ADR-012 | Data locality and exact ZATCA legal fields | Product/legal/provider decision required |

## Implementation gate

No coding agent may create Django files, migrations, schema, endpoints, provider clients, secrets, deployment configuration, or frontend modifications until the Product Owner explicitly authorizes the next backend implementation phase and unresolved `PRODUCT DECISION REQUIRED` / `REQUIRES OFFICIAL VALIDATION` items are resolved or formally accepted.

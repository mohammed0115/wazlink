# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## ADR-001 — Modular Django monolith

Use one Django deployment with domain apps and explicit application services. This minimizes operational overhead and keeps PostgreSQL transactions local while preserving seams for future extraction.

## ADR-002 — Django REST Framework

Use DRF with typed serializers treated as API DTO boundaries. Serializers validate transport shape; application services enforce authorization, invariants, idempotency, and state transitions. Raw ORM models are never serialized directly.

## ADR-003 — Celery + Redis

Celery is selected over Dramatiq and RQ because WazLink needs multiple routed queues, durable retry policies, scheduled reconciliation, provider workflows, task metadata, and mature Django integration. Redis is a broker/result-support component, not canonical storage. Kafka is not justified for Phase 1.

## ADR-004 — PostgreSQL + outbox/inbox

Transactional domain changes and an `OutboxEvent` commit in one transaction. A dispatcher publishes internal work to Celery. External callbacks first enter `WebhookReceipt` and are deduplicated before async processing. This gives reliable side effects without coupling request latency to providers.

## ADR-005 — Identity

Use UUIDv7 internal primary keys, immutable prefixed `public_id` values for external API references, and workspace-scoped uniqueness. Public IDs are opaque enough for API use and preserve migration compatibility with frontend references.

## ADR-006 — Read aggregation

Provide dedicated Dashboard and Lead 360 read endpoints because these surfaces require multiple canonical domains and consistent metadata. Aggregation is read-only; it cannot mutate Leads, Deals, Revenue, Billing, or entitlements.

## ADR-007 — Revenue recognition

`DealWon` is not `RevenueRecognized`. Only `RecordRevenueEvent` or an explicitly approved payment/invoice recognition rule can create RevenueEvent. The actor, source, amount, currency, recognition date, and idempotency key are mandatory.

## ADR-008 — Attribution

Phase 1 stores touchpoints and exposes deterministic first-touch attribution. Last-touch and multi-touch reports may be added as separate read models after product acceptance. Attribution never changes RevenueEvent amount.

## ADR-009 — Authentication

Use secure Django session authentication for the first backend phase, with email verification and password reset. JWT/mobile OAuth/MFA are later options and require separate security review. CSRF is mandatory for cookie-authenticated unsafe requests.

## ADR-010 — Concurrency

Editable Lead, Deal, Task, and AutomationRule DTOs carry an integer `version`. Update commands require the client version; mismatches return `409 CONFLICT`. Critical quota/payment/webhook transitions also use database row locks and unique constraints.

## ADR-011 — Money and time

Persist money as PostgreSQL `NUMERIC(19,4)` plus ISO-4217 currency; never float. Persist UTC timezone-aware timestamps. Workspace timezone controls period display and reporting boundaries.

## ADR-012 — Unresolved decisions

Exact ZATCA invoice/legal fields, hosting/data locality, provider sandbox credentials, retention durations, RPO/RTO, and contractual provider limits are marked for validation rather than invented.

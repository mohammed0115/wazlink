# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## ADR-001 — Modular Django monolith

Use one Django deployment with domain apps and explicit application services. This minimizes operational overhead and keeps PostgreSQL transactions local while preserving seams for future extraction.

## ADR-002 — DRF typed REST `/api/v1/`

Use DRF with typed serializers treated as API DTO boundaries. Serializers validate transport shape; application services enforce authorization, invariants, idempotency, and state transitions. Raw ORM models are never serialized directly.

## ADR-003 — PostgreSQL canonical store

PostgreSQL is the canonical operational database and source of truth for workspace, CRM, pipeline, revenue, billing, audit, and authorization data. Redis is limited to broker/cache/short-lived lock duties and is never canonical storage.

## ADR-004 — Celery + Redis

Celery is selected for routed asynchronous queues, durable retry policies, scheduled reconciliation, provider workflows, task metadata, and mature Django integration. Kafka and alternative worker frameworks are not justified for Phase 1.

## ADR-005 — Transactional outbox and webhook inbox

Transactional domain changes and an `OutboxEvent` commit in one transaction. A dispatcher publishes internal work to Celery. External callbacks first enter `WebhookReceipt` and are deduplicated before async processing. This gives reliable side effects without coupling request latency to providers.

## ADR-006 — UUIDv7 internal IDs + prefixed public IDs

Use UUIDv7 internal primary keys and immutable prefixed `public_id` values for external API references. Public IDs are opaque API identifiers with registry-controlled prefixes and workspace-scoped uniqueness where the entity semantics require it; they never replace internal UUID identity.

## ADR-007 — RevenueEvent separate from Deal and Billing

`DealWon` is not `RevenueRecognized`. Only `RecordRevenueEvent` or an explicitly approved recognition rule can create RevenueEvent. Platform Billing remains a separate bounded context from customer CRM Revenue. The actor, source, amount, currency, recognition date, and idempotency key are mandatory for explicit recognition.

## ADR-008 — First-touch attribution with explicit multi-touch read model later

Phase 1 stores touchpoints and exposes deterministic first-touch attribution. Last-touch and multi-touch reports may be added as separate read models after product acceptance. Attribution never changes RevenueEvent amount.

## ADR-009 — Session-backed authentication for Phase 1

Use secure Django session authentication for the first backend phase, with email verification and password reset. JWT/mobile OAuth/MFA are later options and require separate security review. CSRF is mandatory for cookie-authenticated unsafe requests.

## ADR-010 — Version integer for editable resources

Editable Lead, Deal, Task, and AutomationRule DTOs carry an integer `version`. Update commands require the client version; mismatches return `409 CONFLICT`. Critical quota/payment/webhook transitions also use database row locks and unique constraints.

## ADR-011 — Cursor pagination for high-volume resources; offset only for bounded catalogs

High-volume collection resources use cursor pagination; bounded catalogs may use offset semantics only when explicitly documented. Persist money as PostgreSQL `NUMERIC(19,4)` plus ISO-4217 currency; never float. Persist UTC timezone-aware timestamps, and use workspace timezone for period display and reporting boundaries.

## ADR-012 — Data locality and exact ZATCA legal fields

Data locality, exact ZATCA invoice/legal fields, provider sandbox credentials, retention durations, RPO/RTO, and contractual provider limits remain decisions requiring product, legal, or provider validation rather than invented values.

## Architecture notes retained from earlier B0 drafts

### Read aggregation

Dedicated Dashboard and Lead 360 read endpoints remain read-only projections because these surfaces require multiple canonical domains and consistent metadata. Aggregation cannot mutate Leads, Deals, Revenue, Billing, or entitlements. This is a documented architecture note, not a second ADR identifier.

### ADR identifier registry

The canonical ADR sequence is `ADR-001` through `ADR-012`, matching the decision register in `B0_BACKEND_BLUEPRINT.md`. Each identifier maps to exactly one decision in this document; there are no duplicate or conflicting ADR identifiers across the B0 package. Future decisions must append the next unused identifier and update the Blueprint, this document, the documentation index, and traceability evidence. Identifiers must never be reused.

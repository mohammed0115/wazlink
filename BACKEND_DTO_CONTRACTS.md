# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Common DTOs

`MoneyDTO = { amount: string, currency: string }`; `MoneyDTO.amount` matches `^-?\\d+(\\.\\d{1,4})?$` after parsing; `MoneyDTO.currency` is the authoritative ISO-4217 currency for that amount. Any legacy or transport-level currency mirror must equal `MoneyDTO.currency` and never override it. `PageInfo = { next_cursor: string|null, has_next: boolean }`; `EntityRef = { public_id: string, entity_type: string }`; `ErrorEnvelope` follows the API standard; every entity DTO includes `public_id`, `workspace_id` only where permitted, `created_at`, `updated_at`, and `version` where editable.

## Core resource DTOs

| Resource | Required fields | Notes |
|---|---|---|
| DiscoveryJob | public_id, query, provider_source, status, counts, started_at, completed_at, error_code | async; results separate |
| Business | public_id, provider_source, provider_external_id, name, category, address, phone, website, coordinates, provenance | provider raw data isolated |
| Lead | public_id, business_ref, owner_ref, status, priority, source_job_ref, version | conversion provenance required |
| Lead360 | lead, business, contacts, intelligence, conversations, tasks, appointments, deals, activities, revenue_refs | read aggregate only |
| Conversation | public_id, lead_ref, channel, status, assigned_user, last_message_at | channel adapter independent |
| Message | public_id, conversation_ref, direction, sender_type, body_safe, status, provider_message_ref, timestamps | content policy applies |
| Deal | public_id, lead_ref, business_ref, pipeline_ref, stage_ref, value, currency, probability, status, expected_close, closed_at, lost_reason, version | Won=100; Lost=0 |
| RevenueEvent | public_id, source_type, source_ref, business_ref, lead_ref, deal_ref, gross, net, currency, recognized_at, status, external_payment_ref, invoice_ref | never implicit from DealWon |
| AttributionTouchpoint | public_id, source_type, source_ref, business_ref, lead_ref, conversation_ref, deal_ref, revenue_event_ref, occurred_at, position | report model separate |
| EntitlementDecision | capability, status, allowed, usage, remaining, target_plan_ref, evaluated_at | backend authoritative |
| AnalyticsOverview | period, timezone, currency, metrics[], quality, generated_at | each metric has semantics |
| Payment | public_id, subscription_ref, invoice_ref, provider, provider_payment_ref, status, amount, currency, idempotency_ref | no raw card data |
| TaxInvoice | public_id, invoice_ref, seller/buyer refs, VAT fields, totals, UUID, QR payload, ZATCA status | legal fields require official validation |

Request DTOs are command-specific and reject mass assignment. Response DTOs are versioned contracts, never raw model serialization. Sensitive fields are omitted by default and only exposed to authorized operational contexts.

## B0-FIX.1 transport DTO index

The following transport names are normative aliases or concrete DTOs used by `BACKEND_API_CATALOG.md` and `BACKEND_OPENAPI_V1.yaml`. They are not ORM models:

| Transport name | Contract |
|---|---|
| LoginRequest / Session | Login credentials and authenticated Django session projection |
| Workspace / WorkspaceList / InviteRequest | Workspace membership and invitation contracts |
| Plan / PlanList / EntitlementDecision / EntitlementList / UsageDTO | Backend-authoritative plan and usage projections |
| DiscoveryJobCreate / DiscoveryJobDTO / DiscoveryResult / ResultList | Async discovery submission, status, and cursor results |
| Business / ConvertBusinessRequest | Canonical Business and explicit conversion request |
| Lead / LeadUpdate / Lead360DTO | Versioned CRM Lead and read-only Lead 360 aggregate |
| Conversation / SendMessage / Message | Conversation and async idempotent message contracts |
| Deal / DealList / DealCreate / StageMove / CloseDeal | Pipeline resources with versioned transitions |
| Approval / AutomationRun | Explicit automation approval and run state |
| AnalyticsOverview / DashboardOverview | Derived read-only analytics and dashboard aggregates |
| RevenueEventCreate / RevenueEvent / AttributionTouchpoint / AttributionReport | Explicit revenue recognition and read/reporting attribution |
| QuoteRequest / UpgradeQuote / PaymentCreate / Payment / InvoiceList | Platform Billing contracts, separate from CRM Revenue |
| UploadRequest / FileAsset / FileDownload / Health | File and health transport contracts |
| PageInfo / Money / EntityRef / ErrorEnvelope | Reusable pagination, money, identity, and safe error contracts |

All editable resources expose `version`; all unsafe session-authenticated requests require CSRF; all list contracts use cursor pagination where applicable; and no provider raw payload is exposed.

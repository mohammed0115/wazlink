# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Common DTOs

`MoneyDTO = { amount: string, currency: string }`; `PageInfo = { next_cursor: string|null, has_next: boolean }`; `EntityRef = { public_id: string, entity_type: string }`; `ErrorEnvelope` follows the API standard; every entity DTO includes `public_id`, `workspace_id` only where permitted, `created_at`, `updated_at`, and `version` where editable.

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

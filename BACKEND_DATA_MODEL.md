# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## PostgreSQL logical model

All tables use UUIDv7 `id` internally, immutable prefixed `public_id`, UTC `created_at/updated_at`, optional `archived_at`, and `workspace_id` for tenant-owned records. Financial, tax, audit, and webhook receipt records are append-oriented and are not casually deleted.

| Table group | Core tables | Key constraints/indexes |
|---|---|---|
| Tenant | users, sessions, workspaces, memberships, invitations, roles | workspace/public_id unique; membership workspace/user unique |
| Entitlements | plans, capabilities, plan_capabilities, quota_definitions, subscriptions, usage_counters, usage_ledger | plan/capability unique; workspace/metric/period unique |
| Discovery | discovery_jobs, discovery_queries, discovery_results, businesses, business_identities | workspace/provider_external_id unique; job/status/created index |
| CRM | leads, contacts, lead_contacts, tasks, appointments | workspace/public_id; business/workspace conversion unique; lead/status/owner indexes |
| Intelligence | lead_intelligence_analyses, intelligence_signals, ai_usage_records | lead/input_fingerprint unique where reusable |
| Messaging | conversations, participants, messages, message_deliveries | workspace/public_id; provider_message_id unique; conversation/status/time index |
| Pipeline | pipelines, pipeline_stages, deals | workspace/public_id; deal/stage/status indexes; version column |
| Automation | automation_rules, triggers, conditions, actions, runs, step_runs, approvals | event/rule/action idempotency unique |
| Revenue/Attribution | revenue_events, revenue_reversals, attribution_touchpoints | source/idempotency unique; event/date and relation indexes |
| Billing | billing_customers, subscriptions, invoices, invoice_lines, payments, payment_attempts, refunds | provider IDs unique; subscription status/time indexes |
| Tax | tax_invoices, tax_invoice_lines, tax_submissions | invoice relation unique; provider reference unique |
| Files | file_assets | workspace/storage_key unique; checksum index |
| Webhooks | webhook_receipts | provider/dedup key unique; payload hash index |
| Operations | outbox_events, worker_executions, audit_logs | dispatch/status/time; immutable audit indexes |

Money uses `NUMERIC(19,4)` and currency ISO code. Foreign keys use restrictive behavior for financial/audit records and explicit archive semantics for operational entities. JSONB is allowed only for provider metadata, raw snapshots, structured flexible metadata, and before/after audit details—not for core relationships, state, or ownership.

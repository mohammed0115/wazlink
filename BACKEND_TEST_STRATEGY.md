# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Test pyramid

Pure domain tests cover state machines, money, IDs, attribution formulas, entitlement decisions, idempotency fingerprints, and permission policies. Django DB tests cover transactions, unique constraints, workspace isolation, row locks, quota reservation, conversion, Deal close, RevenueEvent, webhook receipts, and audit logs. Provider adapter tests use mocked contract fixtures; sandbox tests are opt-in and never run in default CI. API contract tests validate OpenAPI DTOs, statuses, error codes, pagination, and permissions. Queue tests cover retry, dead-letter, heartbeat, and idempotent side effects. E2E tests cover Discovery→Lead→Conversation→Deal, explicit RevenueEvent, Billing upgrade, webhook-first payments, and failure/reconciliation paths.

Mandatory security tests include IDOR, cross-workspace reads/writes, privilege escalation, mass assignment, quota bypass, SQL injection, SSRF, upload policy, webhook signature/replay, and idempotency conflict. Payment tests cover success, failure, pending, duplicate webhook, webhook-before-redirect, redirect-before-webhook, timeout, refund, and reconciliation. WhatsApp tests cover duplicate/out-of-order callbacks, failed send, template/session rules, and conversation linking.

AI tests assert schema, status, usage, prompt version, cost, timeout/failure handling, and non-sending behavior; they must not assert exact natural language. Discovery tests cover duplicate run, partial results, pagination, rate limits, deduplication, retry, and cancellation. Load tests set targets for simple reads, lists, Dashboard, Lead360, and async submission; targets are not guarantees.

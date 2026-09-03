# B12 — Scope & Ownership

> Design only. No Django app, Celery task, Redis key, migration, or provider SDK call is created. This document realizes the two frozen platform rows `BACKEND_DOMAIN_OWNERSHIP.md` already names and never defined — `Webhooks` (line 28: aggregate `WebhookReceipt`, table `receipts`, writer "gateway only", commands `ReceiveWebhook`/`RetryWebhook`, event `WebhookProcessed`, forbidden coupling "no direct domain mutation") and `Jobs` (line 29: aggregate `WorkerExecution`, table `worker executions`, writer "worker coordinator", commands `SubmitJob`/`RetryJob`, events `JobSucceeded`/`JobFailed`, integration `Redis/Celery`, forbidden coupling **"no domain ownership"**).

## 1. Scope statement

B12 is the **execution and integration substrate**. It answers exactly one question:

> **"Did this committed intent actually reach the outside world, exactly once in effect, and do we know it?"**

It never answers what the intent *means*. A dispatched outbox row does not make B12 an authority on the event it carries; a verified Tap webhook does not make B12 an authority on whether a payment succeeded; a successful provider call does not make B12 an authority on whether a Message was delivered. The frozen `Jobs` row states this in three words — **"no domain ownership"** — and B12 treats that cell as its charter rather than a footnote.

Two properties follow, and every document in this pack depends on them:

1. **PostgreSQL holds intent; the broker only carries a pointer to it.** A lost Redis message loses a *notification*, never a *fact*. Recovery is a scan of committed rows, not a replay of a queue.
2. **Effectively-once is achieved at the destination, not in transit.** B12 does not claim exactly-once delivery (`B12_ASYNC_EXECUTION_MODEL.md` §4). It claims that a duplicated delivery produces no duplicated business effect, because every consumer is guarded by a durable uniqueness constraint that survives a broker restart.

## 2. Sub-module split

| Sub-module | Aggregate root | Authoritative tables | Allowed writers |
|---|---|---|---|
| Event publication | `OutboxEvent` | `outbox_events` (frozen name) | the producing domain's own transaction (insert); the dispatcher (state only) |
| External ingress | `WebhookReceipt` (frozen) | `webhook_receipts` (frozen name) | webhook gateway only |
| Execution accounting | `WorkerExecution` (frozen) | `worker_executions` (frozen name) | worker coordinator only |
| Provider interaction | (none — child of `WorkerExecution`) | `provider_request_attempts` | provider adapter layer only |
| Integration configuration | `IntegrationConnection` | `integration_connections`, `integration_health_snapshots` | integration service only |
| Operational recovery | `DeadLetterRecord`, `PlatformReconciliationCase` | `platform_dead_letters`, `platform_reconciliation_cases` | platform operations service / operator, through the four operator API operations of `B12_API_DTO_CONTRACTS.md` §1 (9, 10, 13, 14) |

`OWNED_ENTITY_COUNT = 8` — `outbox_events`, `webhook_receipts`, `worker_executions`, `provider_request_attempts`, `integration_connections`, `integration_health_snapshots`, `platform_dead_letters`, `platform_reconciliation_cases`. Three of the eight are frozen table names reused verbatim; five are additive under `B12-AM-002`.

## 3. What B12 does NOT own

`leads`, `contacts`, `businesses`, `discovery_jobs`, `lead_intelligence_analyses`, `conversations`, `messages`, `message_deliveries`, `deals`, `pipelines`, `automation_rules`, `automation_runs`, `automation_inbox_records`, `subscriptions`, `payments`, `invoices`, `upgrade_quotes`, `usage_counters`, `revenue_events`, `attribution_touchpoints`, `tax_invoices`, `file_assets`, `file_attachments`, `workspaces`, `memberships` — none of these is ever written by a B12 module, worker, dispatcher, gateway, reconciliation scan, or operator replay.

**The one asymmetry worth naming.** B12 *transports* every domain's events, so it touches more of the system than any other phase. That breadth is exactly why the write boundary is absolute: a substrate that could write its passengers' tables would be a second authority for all of them at once. Every domain effect B12 causes is caused by **invoking that domain's own guarded application command**, never by writing its rows. This is `B12-D-A002`, and it is proved per-domain in `B12_DOMAIN_FIREWALLS.md`.

## 4. The inbox asymmetry — deliberate, and not an oversight

B12 owns the **external** inbox (`webhook_receipts`, frozen) and does **not** own the **internal** consumer-side inbox. Frozen `B7_DATA_MODEL.md` §6 already settled this: `automation_inbox_records` is *"B7's own inbox-side dedup boundary, distinct from `BACKEND_PUBLIC_ID_REGISTRY.md`'s `WHR-*` `WebhookReceipt` (that table dedups *external provider* callbacks; this one dedups *internal cross-domain* events per frozen ADR-005's outbox/dispatcher split)."*

B12 therefore specifies the **pattern and the obligation** — every internal event consumer must hold a durable `(workspace_id, source_event_id)` uniqueness constraint of its own — and owns **none** of those tables (`B12_INBOX_MODEL.md` §3). Centralizing them would put B12 between a domain and its own dedup guarantee, which is precisely the coupling the frozen `Jobs` row forbids.

## 5. Referenced Entity Registry

**Definition** (reused verbatim from `B11_SCOPE_AND_OWNERSHIP.md` §4, itself inherited from `B8_DOMAIN_OWNERSHIP.md` §8): a *referenced entity* is a non-B12-owned, non-B12-writable domain entity that B12's contracts, storage FKs, API surface, event payloads, or permission/boundary semantics directly name or depend on as a read-only reference.

| Entity | Table(s) | Owning domain | How B12 references it (read-only) |
|---|---|---|---|
| Workspace | `workspaces` | B1 | Direct FK: `outbox_events.workspace_id`, `webhook_receipts.workspace_id` (nullable until resolved), `worker_executions.workspace_id`, `integration_connections.workspace_id`, `platform_dead_letters.workspace_id` |
| Membership | `memberships` | B1 | Direct FK: `integration_connections.configured_by_membership_id`, `platform_dead_letters.resolved_by_membership_id` |
| AuditLog | `audit_logs` | B0 Audit | B12 appends operator actions through the frozen audit contract; never reads or mutates a row |
| IdempotencyRecord | (frozen `BACKEND_IDEMPOTENCY_STANDARD.md` concept) | B0 platform | B12's outbound provider keys are *derived from* the internal idempotency record the command layer already created; B12 mints no competing store |

`REFERENCED_ENTITY_COUNT = 4`, mechanically counted as the rows above.

**Deliberately absent:** every domain aggregate B12 dispatches work for. `Lead`, `Message`, `Payment`, `FileAsset` and their peers are named in `outbox_events.source_type`/`source_ref` and `worker_executions.source_ref` as **opaque strings**, never as FKs and never resolved by B12 code — the same polymorphic-reference discipline `RevenueEvent.source_ref`, `tax_invoices.source_ref`, and `file_attachments.subject_id` already use. Listing them as referenced entities would claim a dependency B12 deliberately does not have.

## 6. What B12 does not become

- **Not a second automation engine.** Celery Beat may *trigger* a reconciliation sweep; it never decides that a business thing should happen. B7 owns trigger semantics (`B12_DOMAIN_FIREWALLS.md` §4).
- **Not a workflow orchestrator.** There is no saga engine, no compensating-transaction framework, no step-function DSL. Each domain's own state machine sequences its own work.
- **Not a message bus product.** No Kafka, no RabbitMQ, no event-sourcing store. Frozen ADR-004 selected Celery + Redis and states Kafka is *"not justified for Phase 1"*; B12 preserves that.
- **Not a secrets manager.** Credentials are *referenced*, never stored as values (`B12_SECURITY_PRIVACY.md` §2).
- **Not B13.** Logging backends, metrics stores, tracing collectors, alert routing, SLOs, DR, and secret rotation operations are explicitly deferred (`B12_B13_BOUNDARY.md`).

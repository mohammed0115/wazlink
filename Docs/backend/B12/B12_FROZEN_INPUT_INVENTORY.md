# B12 — Frozen Input Inventory

> Design only. Built by mechanical search of every frozen artifact — the 34 B0 root documents plus `Docs/backend/B1`…`B11` — for `async`, `celery`, `redis`, `queue`, `worker`, `outbox`, `inbox`, `webhook`, `provider`, `retry`, `backoff`, `timeout`, `idempot`, `reconcil`, `dead letter`, `rate limit`, `budget`, `attempt`, `schedule`, `integration`, `credential`, `secret`. Not from memory.

## 1. Frozen B0 platform anchors

| # | Artifact | Location | What it fixes | B12's treatment |
|---:|---|---|---|---|
| 1 | `BACKEND_ARCHITECTURE_DECISIONS.md` | line 18 | *"Redis is limited to broker/cache/short-lived lock duties and is never canonical storage."* | **verbatim charter** of `B12_REDIS_BOUNDARY.md` |
| 2 | `BACKEND_ARCHITECTURE_DECISIONS.md` | ADR-004 | Celery selected; *"Kafka and alternative worker frameworks are not justified for Phase 1."* | preserved; no second broker (`B12_QUEUE_TOPOLOGY.md` §5) |
| 3 | `BACKEND_ARCHITECTURE_DECISIONS.md` | ADR-005 | *"Transactional domain changes and an `OutboxEvent` commit in one transaction. A dispatcher publishes internal work to Celery. External callbacks first enter `WebhookReceipt` and are deduplicated before async processing."* | **the pack's spine** — `B12_OUTBOX_MODEL.md`, `B12_INBOX_MODEL.md` |
| 4 | `BACKEND_DOMAIN_OWNERSHIP.md` | line 28 | Webhooks row: `WebhookReceipt`, `receipts`, gateway only, `ReceiveWebhook`/`RetryWebhook`, `WebhookProcessed`, **"no direct domain mutation"** | all names reused verbatim; forbidden coupling realized in `B12_DOMAIN_FIREWALLS.md` |
| 5 | `BACKEND_DOMAIN_OWNERSHIP.md` | line 29 | Jobs row: `WorkerExecution`, `worker executions`, worker coordinator, `SubmitJob`/`RetryJob`, `JobSucceeded`/`JobFailed`, Redis/Celery, **"no domain ownership"** | all names reused verbatim; the forbidden-coupling cell is `B12-D-A002` |
| 6 | `BACKEND_DATA_MODEL.md` | line 26 | *"Webhooks \| webhook_receipts \| provider/dedup key unique; payload hash index"* | **honored verbatim** as two constraints (`B12_DATA_MODEL.md` §2) |
| 7 | `BACKEND_DATA_MODEL.md` | line 27 | *"Operations \| outbox_events, worker_executions, audit_logs \| dispatch/status/time; immutable audit indexes"* | honored; three indexes satisfy "dispatch/status/time" literally |
| 8 | `BACKEND_DATA_MODEL.md` | line 10 | webhook receipts are *"append-oriented and are not casually deleted"* | receipts are never pruned by a B12 sweep |
| 9 | `BACKEND_STATE_MACHINES.md` | WebhookReceipt sentence | *"WebhookReceipt is `received→verified→queued→processed/failed/duplicate`."* | **six states adopted unchanged**, no seventh (`B12_STATE_MACHINES.md` §2) |
| 10 | `BACKEND_INTEGRATION_BOUNDARIES.md` | lines 8-19 | eleven ports, each with direction and boundary note | **every port name reused verbatim**; none renamed (`B12_PROVIDER_PORT_ARCHITECTURE.md` §1) |
| 11 | `BACKEND_INTEGRATION_BOUNDARIES.md` | "Provider lifecycle" | eight adapter obligations; *"Raw payload retention is restricted and time-bounded"*; *"Provider callbacks never directly mutate business aggregates outside an application service"* | each clause bound to an artifact (`B12_PROVIDER_PORT_ARCHITECTURE.md` §5) |
| 12 | `BACKEND_INTEGRATION_BOUNDARIES.md` | closing paragraph | email/Gmail/Calendar/FCM *"optional/deferred and are not Phase 1 dependencies"* | no backend connection registered for them (`B12-D-B010`) |
| 13 | `BACKEND_RETRY_POLICY.md` | whole table | 9 classes, backoff formula, caps, *"Workers must use timeouts, heartbeats, and dead-letter records"* | **reused verbatim**; no row added, no figure changed |
| 14 | `BACKEND_TIMEOUT_POLICY.md` | whole table | 8 rows of connect/request/job | **reused verbatim**; no different number proposed |
| 15 | `BACKEND_IDEMPOTENCY_STANDARD.md` | whole document | key scoping, 24h/7d retention, `IdempotencyRecord` in the command transaction, *"Worker execution is idempotent by `(command_id, effect_type)`"*, *"protected by PostgreSQL, not by a Redis lock"* | class 1 reused unchanged; classes 2-9 built on it |
| 16 | `BACKEND_RATE_LIMIT_POLICY.md` | table + closing | 8 rows; *"Quota enforcement remains transactional and authoritative in PostgreSQL; Redis counters are acceleration/abuse controls, not the source of truth"* | one additive row; the closing sentence is `B12-D-A015` |
| 17 | `BACKEND_RECONCILIATION.md` | table + doctrine | 8 domain processes; *"Repairs are explicit, permissioned, idempotent, and audited… must not guess or overwrite a newer authoritative provider state without a documented precedence rule"* | one additive **platform** row; the eight stay with their domains |
| 18 | `BACKEND_ERROR_CATALOG.md` | code table | includes `PROVIDER_UNAVAILABLE`, `PROVIDER_RATE_LIMITED`, `WEBHOOK_INVALID_SIGNATURE`, `WEBHOOK_DUPLICATE` | 14 reused; **1** added |
| 19 | `BACKEND_PUBLIC_ID_REGISTRY.md` | section A | `WHR-` → WebhookReceipt, Webhooks, *"Global by provider/event identity"* | reused verbatim; `INT-` added (`B12-AM-010`) |
| 20 | `BACKEND_API_CATALOG.md` | lines 43, 47 | *"Provider webhooks are internal gateway routes and are not user-facing resource mutations"*; *"internal provider webhook routes remain outside this user-facing catalog"* | **honored** — 3 routes exist, none counted in the API operation count |
| 21 | `BACKEND_API_STANDARD.md` | filtering + status doctrine | `filters`/`sort` only on two collections; `502` only on provider-dependent operations | honored; no filter marker added; `502` on 2 of 10 operations |
| 22 | `BACKEND_SECURITY_ARCHITECTURE.md` | line 12 | *"Provider URL fetches use strict allowlists and SSRF defenses; redirects are not trusted for payment truth"* | B12 exposes **no** URL-fetching feature at all |
| 23 | `BACKEND_SECURITY_ARCHITECTURE.md` | line 14 | *"Webhook signatures are verified before persistence/dispatch, with replay protection and provider-specific deduplication"* | realized in `B12_WEBHOOK_SECURITY.md`; **"provider-specific"** is the frozen word that vindicates `B12-D-A030` |
| 24 | `BACKEND_DATA_GOVERNANCE.md` | — | *"Database constraints and `transaction.atomic` are preferred before distributed locks"*; Redis is never domain truth | `B12_CONCURRENCY_MODEL.md` §1 |
| 25 | `BACKEND_TEST_STRATEGY.md` | line 12 | mandatory security tests include IDOR, cross-workspace, SSRF, **webhook signature/replay**, **idempotency conflict** | B12 adds no category; it supplies instances |
| 26 | `BACKEND_OPERATIONS_OBSERVABILITY.md` | alerting | "storage failures", "cross-workspace authorization errors", "quota ledger divergence", "dead letters" named page-worthy | bound to concrete signals (`B12_OBSERVABILITY_HANDOFF.md` §4) |
| 27 | `BACKEND_PRIVACY_AND_DATA_HANDLING.md` | classification | private communications, Contact PII classes | most restrictive class applied uniformly |
| 28 | `B0_BACKEND_BLUEPRINT.md` | app layout | `webhooks/`, `jobs/common` app paths reserved | confirmed; no new app path invented |

## 2. Frozen B1–B11 delegations

| # | Artifact | Location | Delegation | B12 artifact |
|---:|---|---|---|---|
| 29 | `B1_AUTHORIZATION_RBAC.md` | §2 line 76, §3 line 131 | `integration.manage` exists with a full role row, condition *"secret access never returned to client"* | **reused verbatim**; `B12_RBAC_TENANCY.md` §1-2 |
| 30 | `B1_API_DTO_CONTRACTS.md` | line 308 | the **closed** `CONFLICT` `details.reason` vocabulary | 3 values added under `B12-AM-005` |
| 31 | `B3_DECISION_REGISTER.md` | `B3-D-A031` | `MAX_JOB_ATTEMPTS = 3`; *"an architectural safety bound, not configuration"* | never touched by transport retry (`B12_RETRY_BACKOFF_MODEL.md` §1) |
| 32 | `B3_DECISION_REGISTER.md` | `B3-D-A032` | `MAX_ACTOR_RETRY_REQUESTS_PER_WORKSPACE_PER_HOUR = 10`, durable admission | must be PostgreSQL-durable (`B12-D-A015`) |
| 33 | **`B3_DECISION_REGISTER.md`** (`B3-D-A031`) | verbatim source | *"Automatic transient retry (frozen B0's per-call backoff/attempt mechanics) is a distinct, unrelated counter: it never increments `attempt_no` and never creates a new Job attempt"*. `B3_RETRY_FAILURE_MODEL.md` §1 is the document that sentence cross-references and supports it in its own words — it is **not** the verbatim source (corrected in B12-FIX.1) | **ratified**, not reinterpreted |
| 34 | `B3_DISCOVERY_BLUEPRINT.md` | `B3-INV-11` | every provider path bounded; 50×5=250 calls per attempt | B12 never widens the fan-out |
| 35 | `B4_COST_RATE_LIMIT_MODEL.md` | §logical calls | logical + provider call budgets | transport retry may not exceed them (`AT-B12FW-3`) |
| 36 | `B5_WEBHOOK_SECURITY_MODEL.md` | §1-§10 (whole) | layered ownership, `GET` handshake, raw-byte HMAC, workspace-from-binding, two-layer dedup, malformed/unsupported `200`, fast ack, audit, replay posture | **generalized, not overridden** — `B12_WEBHOOK_GATEWAY.md`, `B12_WEBHOOK_SECURITY.md` |
| 37 | `B5_MESSAGE_STATE_MACHINE.md` | §4 | status monotonicity key `(message_id, status_value, provider_timestamp)` | B5 keeps ordering authority (`B12-D-A033`) |
| 38 | `B5_ADMIN_PROVIDER_RUNBOOK.md` | §config, §disable, §rotation | configure→check→connected→enable; disable pauses outbound only; rotation invalidates the prior reference | **generalized** to every provider (`B12_PROVIDER_CONFIGURATION_MODEL.md`) |
| 39 | `B5_PROVIDER_CONFIGURATION_MODEL.md` | §4 | safe health check = token validity, phone/WABA match, scope | the template for `B12-D-A035` |
| 40 | `B7_DATA_MODEL.md` | §6 | `automation_inbox_records` `UNIQUE (workspace_id, source_event_id)`, *"distinct from … `WHR-*`"* | **the internal/external inbox split** (`B12-D-A008`) |
| 41 | `B7_B12_ASYNC_BOUNDARY.md` | whole | event delivery + liveness reconciliation only; **no** wakeup sweep, *"removed, not deferred"* | honored literally; B12 builds no wakeup sweep |
| 42 | `B7_DECISION_REGISTER.md` | `B7-D-A040` | event-run dedup `(workspace_id, rule_id, source_event_id)` | B12 does not centralize it |
| 43 | `B8_CHECKOUT_PAYMENT_MODEL.md` | §webhook flow, §redirect | webhook-first truth; redirect never mutates; `PaymentSucceeded` only from `ProcessPaymentWebhook`/`ReconcilePayment` | `B12_DOMAIN_FIREWALLS.md` §5 |
| 44 | `B8_B12_ASYNC_BOUNDARY.md` | whole | B8 uses the same outbox/Celery mechanics; B12 owns *"the generic scheduler/queue mechanics"*, B8 owns the business semantics | exactly the split `B12_SCHEDULING_MODEL.md` §1 implements |
| 45 | `B8_CHECKOUT_PAYMENT_MODEL.md` | `billing_customers` | webhook workspace resolution by `provider_customer_ref`, *"never by trusting a `workspace_id` embedded in the provider payload"* | `B12-D-A031` |
| 46 | `B9_B12_ASYNC_BOUNDARY.md` | §1, §21 | *"financial write paths are entirely synchronous"*; no timer-driven financial action | B12 adds **no** async write path to B9 |
| 47 | `B10_DECISION_REGISTER.md` | `B10-D-B001` | ZATCA artifact format gated; B10 dormant | port compatibility only (`B12-D-B006`) |
| 48 | `B11_STORAGE_PROVIDER_BOUNDARY.md` | §3, §4 | four error classes; *"the next step is `stat_object`, not a blind repeat"*; invariant P-1 | **generalized to every provider** (`B12-D-A023`, `B12-D-A020`) |
| 49 | `B11_B12_ASYNC_BOUNDARY.md` | §1-§5 | nine semantic requirements; synchronous write paths; five negative controls | satisfied; B12 writes no B11 field |

`CLASS_A_REFERENCE_COUNT = 49`, counted as the rows in §1 and §2. Each is expanded with its exact quoted dependency in `B12_CLASS_A_REFERENCE_REGISTRY.md`.

## 3. Searches that returned nothing

Recorded so their absence is a finding rather than an omission.

| Search | Result |
|---|---|
| Kafka, RabbitMQ, SQS, NATS, event-sourcing | none outside ADR-004's explicit rejection |
| saga, orchestrator, workflow engine, compensating transaction | **no frozen artifact requires one** — B12 designs none |
| circuit breaker | named nowhere in the frozen corpus; deferred with reasoning (`B12-D-B008`) |
| outbound customer webhooks (WazLink → customer endpoint) | only the frontend's `disabled` developer fixture (`FB-B12-010`); no backend artifact |
| secrets manager, vault, KMS, key rotation service | none; frozen text says only *"secret access never returned to client"* |
| a frozen queue name or topology | none — `B12_QUEUE_TOPOLOGY.md` derives it and says so |
| a frozen dead-letter **table** | none — only the *requirement* (`BACKEND_RETRY_POLICY.md`); B12 supplies the table |
| a frozen `integration_connections`-equivalent table | none — B5 has `ChannelBinding` for messaging only; B12 generalizes without touching it |

## 4. Domains with no B12 write path at all

B1 (identity), B2 (CRM), B6 (Pipeline). Each was searched; none names a provider call, webhook, or async write in any frozen artifact. B12 dispatches their events and designs no boundary document for them, rather than manufacturing one.

# B12 — Implementation Handoff

> **B12 is design-only and grants no implementation authorization.** This document states what an implementation agent would need and what must be approved first.

## 1. Pre-implementation gate

| # | Gate | Owner | Status |
|---:|---|---|---|
| 1 | Approve the **10 controlled amendments** (`B12_CONTROLLED_AMENDMENTS.md`) — 10 additive, 0 compatible clarifications, 0 non-additive, each **re-classified from scratch in B12-FIX.1** rather than re-affirmed | CTO | **required, not granted** |
| 2 | **Re-verify the four load-bearing provider facts**: `B12-X-001` (Meta signature), `B12-X-005` (Tap `hashstring` field concatenation), `B12-X-006` (Tap's three-attempt retry bound), `B12-X-014` (Meta raw-byte basis). A change to a signature scheme or a retry bound invalidates a control, not a comment | Backend + Platform | **required** |
| 3 | Resolve `B12-D-B003`/`B12-D-B004` (`B12_DECISION_REGISTER.md` Class B) — outbox and raw-payload retention | Product / Legal / Operations | **open — blocks nothing** (raw payload defaults to off) |
| 4 | Select the scraping provider and establish its webhook scheme (`B12-D-B005`) | Product / Backend | **open — blocks only the scraping route** |
| 5 | Confirm B5, B8, B9, B11 owners accept that B12 satisfies their `B*_B12_ASYNC_BOUNDARY.md` requirements without adding obligations back | domain owners / CTO | **required** |
| 6 | Independent CTO countersign of this pack | CTO | **not granted** |

## 2. What to build — the concrete answer list

| Question | Answer |
|---|---|
| **Tables** | 8: `outbox_events`, `webhook_receipts`, `worker_executions` (frozen names) + `provider_request_attempts`, `integration_connections`, `integration_health_snapshots`, `platform_dead_letters`, `platform_reconciliation_cases` (`B12_DATA_MODEL.md`) |
| **App paths** | `webhooks/` and `jobs/common`, both already reserved by `B0_BACKEND_BLUEPRINT.md`. No new app path is invented |
| **Services** | outbox dispatcher · webhook gateway · worker coordinator · provider adapter layer · integration service · platform operations service |
| **Ports** | the six frozen provider ports reused verbatim; no universal interface (`B12-D-A022`) |
| **Queues** | 5: `default`, `providers.slow`, `providers.fast`, `webhooks`, `maintenance` (`B12_QUEUE_TOPOLOGY.md`) |
| **Tasks** | outbox dispatch · webhook processing · per-port provider execution · 8 reconciliation sweeps · health check · retention cleanup. All carry references only |
| **Events** | 10 produced, 0 consumed (`B12_COMMAND_EVENT_CATALOG.md`) |
| **Commands** | 15, of which 4 are frozen names; **every one surface-classified** (`B12_COMMAND_EVENT_CATALOG.md` §1a) — `UNOWNED_COMMANDS = 0`. `RetryJob` and `RetryWebhook` are **system-only**: no API, no CLI, no operator path anywhere (`B12-D-A053`) |
| **APIs** | **14** additive operations; **no** outbox/inbox/receipt/execution mutation surface, and no endpoint that reopens a terminal `WebhookReceipt` |
| **Webhook routes** | 3, outside the user-facing catalog per the frozen rule |
| **Retry classes** | 6 counters with 6 owners; only 3 are B12's (`B12_RETRY_BACKOFF_MODEL.md` §1) |
| **Idempotency stores** | 9 classes, each with a named non-Redis store (`B12_IDEMPOTENCY_MODEL.md` §1) |
| **Locks** | PostgreSQL row locks, `SKIP LOCKED`, leases **plus a per-claim `lease_token` fence** (`B12-D-A055`), `expected_version`, partial-unique indexes. Redis locks are shaping only, with a fixed global lock order |
| **Reconciliation jobs** | 8 platform classes; 5 report-only or operator-gated. Case identity is `(fingerprint, mismatch_class) WHERE state='open'`, both columns `NOT NULL` |
| **Permissions** | 1 reused (`integration.manage`, frozen) + 2 additive |
| **Errors** | 14 frozen reused + 1 new + 3 new `CONFLICT` reasons |
| **Configuration** | `B12_CONFIGURATION_INVENTORY.md`; every credential a `*_REF`, resolved at call time |
| **Secrets** | referenced, never stored; B12 is not a secrets manager |
| **Provider capabilities** | tri-valued; **2 `supported` cells** platform-wide (Tap `retrieve_charge`, storage `stat_object`), both primary-sourced |
| **Tests** | **191** across **42** categories, **93** negative controls |
| **Observability fields** | `B12_OBSERVABILITY_HANDOFF.md` §3, with an explicit cardinality rule |
| **B13's remainder** | `B12_B13_BOUNDARY.md` §1 |

## 3. Readiness by concern

| Concern | State | Evidence |
|---|---|---|
| `ASYNC_MODEL_READY` | **READY** | 6 layers, ownership table, 4 crash windows each with a durable answer |
| `OUTBOX_READY` | **READY** | claim semantics, lease reaping **plus the `lease_token` fence**, 5 states, 5 crash windows, dead-letter path |
| `INBOX_READY` | **READY** | external owned, internal specified with an explicit obligation; frozen split ratified |
| `CELERY_READY` | **READY** | payload rule, late-ack semantics, timeout pairs, 3 duplicate guards |
| `QUEUE_READY` | **READY** | 5 queues derived from 4 isolation properties, 4 rejected splits documented |
| `REDIS_BOUNDARY_READY` | **READY** | one test, permitted list, forbidden list, recovery table, worked example |
| `IDEMPOTENCY_READY` | **READY** | 9 classes × 7 attributes; composition argument |
| `RETRY_READY` | **READY** | 6 counters with owners; frozen table reused; `MIN()` rule |
| `UNKNOWN_OUTCOME_READY` | **READY** | 3 outcomes, 5 named scenarios, write-before-call, no-override rule |
| `PROVIDER_PORT_READY` | **READY** | frozen names, 4-class taxonomy, anti-abstraction rule |
| `WEBHOOK_READY` | **READY** | pipeline, 5 security rules, per-provider verification proven necessary by research |
| `DEDUP_ORDERING_READY` | **READY** | 3-tier hierarchy; ordering left with the owning domain |
| `RECONCILIATION_READY` | **READY** | 8 classes with precedence and auto/manual split |
| `DEAD_LETTER_READY` | **READY** | durable record, 4 states, computed replay eligibility |
| `RATE_LIMIT_READY` | **READY** | 6 layers; durable-vs-Redis split; budgets enumerated |
| `CONFIGURATION_READY` | **READY** | 4-step flow, orthogonal status/enabled, safe-check rule, scope split |
| `HEALTH_READY` | **READY** | 6 facts; evidence-not-authority |
| `SECURITY_READY` | **READY** | 14 threats each with a control and a test; exhaustive redaction list |
| `FIREWALLS_READY` | **READY** | 8 domain sections + 3 no-contact domains, each with negative controls |
| `B13_HANDOFF_READY` | **READY** | signals, cardinality rule, and the one deployment rule that is a correctness property |
| `SCRAPING_ROUTE_READY` | **CONDITIONAL** | provider not selected; `B12-D-B005`. The route and pipeline shape are fixed; only the verification scheme is open — and it blocks **only** that one route |

## 4. Why the one `CONDITIONAL` does not block Phase 1

The scraping provider's webhook verification scheme cannot be designed before the provider exists. Everything around it is decided: the route, the pipeline order, the receipt shape, the dedup hierarchy, the tenant-binding rule, and the four-class error taxonomy. When a provider is chosen, an adapter implements `verify()` and nothing else changes — which is exactly the property `B12-D-A030` was built to give. Meta and Tap, the two providers Phase 1 actually depends on, are both fully specified from primary sources.

## 5. Implementation sequence (informative)

1. `outbox_events` + the dispatcher, against a **no-op consumer**. Every outbox test passes here.
2. `worker_executions` + one queue + the payload/re-read discipline.
3. `provider_request_attempts` + the four-class adapter contract + write-before-call. **Every unknown-outcome test passes here**, before any real provider exists.
4. The webhook gateway with the Meta verifier; then the Tap verifier — deliberately second, because it proves the per-provider design rather than a generic one.
5. `integration_connections` + the 4-step configuration flow + safe checks.
6. The five queues, then reconciliation classes `P-1`…`P-8`.
7. `platform_dead_letters` + replay eligibility + the operator API.
8. Wire B3/B4/B5/B8/B11's existing provider work onto the substrate. **Nothing above changes.**

## 6. What an implementation agent must NOT do

Write a domain table from any B12 path; make a frozen synchronous path asynchronous; store a credential value in PostgreSQL; return a masked secret fragment; verify a webhook after enqueueing it; trust a `workspace_id` from a payload; invent a provider event ID; treat a Celery task ID as an identity or its retry counter as a budget; retry a non-idempotent operation whose outcome is unknown; exceed a frozen domain budget by any means; build an automation wakeup sweep; add a queue for a domain rather than a workload class; introduce a second broker; store a signature beside its body; auto-replay a dead letter; centralize the internal inbox; create a `B13`/`B14` file.

**Added by B12-FIX.1:** move a terminal `WebhookReceipt` out of `processed`/`failed`/`duplicate` by any means; write an outbox completion without the `(status, lease_owner, lease_token)` fence, or retry a fenced write that matched zero rows; build an unscoped webhook `dedup_key` that omits the verifying binding; put `workspace_id` inside the reconciliation-case uniqueness key; add a status value meaning "administratively off" instead of using `enabled`; report `connected` after a material configuration change without a fresh check; or give `RetryJob`/`RetryWebhook` **any** human-reachable surface — no endpoint, no CLI, no operator path inside another command; they are system-only.

## 7. Scope statement

Zero B0–B11 file is modified. Zero frontend file is created, modified, or deleted. Zero Django app, model, migration, serializer, view, URL, Celery task, queue declaration, beat entry, Redis key, or provider SDK call is written. Zero `Docs/backend/B13` or `B14` file exists — independently confirmed by directory listing during this pass.

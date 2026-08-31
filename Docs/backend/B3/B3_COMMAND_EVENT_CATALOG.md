# B3 — Command and Event Catalog

> **B3 status:** Target catalog only. Events are delivered through the B0 transactional outbox (ADR-005) and are never an alternative canonical write store. **No provider call occurs inside a B3 transaction.**

## 0. The event envelope is B0's, unchanged

Frozen `BACKEND_COMMAND_EVENT_CATALOG.md` states it, and B3 restates it verbatim:

> *"All events carry event ID, workspace, aggregate public ID, occurred timestamp, actor/system source, schema version, and correlation/request ID."*

**B3 adds no envelope field.** No B3 contract depends on an aggregate version, a causation identifier, a delivery position, or an arrival order. B2-FIX.2 and B2-FIX.4 both had to repair exactly that drift; B3 avoids it by declaring here that its consumers are order-independent and version-free, and by verifying the quoted sentence against the frozen file mechanically (`B3_IMPLEMENTATION_READINESS.md` §3).

## 1. Commands — 7

| Command | Aggregate | Actor | Permission | Idempotency | Concurrency | Emits |
|---|---|---|---|---|---|---|
| `CreateDiscoveryJob` **(frozen)** | DiscoveryJob | member | `discovery.run` | `Idempotency-Key` + `request_fingerprint` | none — creation | `DiscoveryJobQueued` |
| `RetryDiscoveryJob` **(frozen)** | DiscoveryJob | member | `discovery.run` | `Idempotency-Key` | `version` (ADR-010) | `DiscoveryJobQueued` |
| `CancelDiscoveryJob` *(additive)* | DiscoveryJob | member (object-scoped) | `discovery.run` | `Idempotency-Key` | `version` + row lock | `DiscoveryJobCancelled` |
| `ExecuteDiscoveryQuery` | DiscoveryJob | **system** | — | `(query_id, attempt_no)` | `FOR UPDATE SKIP LOCKED` | none |
| `IngestProviderPage` | DiscoveryJob | **system** | — | `(execution_id, page_index)` | unique index | `BusinessDiscovered`, `BusinessRediscovered` |
| `UpsertBusiness` **(frozen)** | Business | **system** | — | `(workspace_id, provider, provider_external_id)` | unique index + row lock on refresh | none directly — `IngestProviderPage` emits |
| `MergeBusiness` **(frozen)** | Business | operator/system | operator | merge idempotent on `(losing, surviving)` | two row locks, ordered | `BusinessMerged` |

`COMMAND_COUNT = 7`. Four are frozen B0 commands; `CancelDiscoveryJob` is the one additive command (`B3-D-B004`); `ExecuteDiscoveryQuery` and `IngestProviderPage` are **internal** application commands, not API surface.

> **Frozen naming note.** `BACKEND_COMMAND_EVENT_CATALOG.md` says `RetryDiscoveryJob`; `BACKEND_DOMAIN_OWNERSHIP.md` says `RetryDiscovery` for the same command. B3 uses **`RetryDiscoveryJob`**, the form in the explicit command list. This is a pre-existing internal B0 inconsistency; B3 records it as an observation and **does not amend B0** for a naming variant.

### 1.1 The two system commands

They are commands rather than "worker steps" because each has a transactional boundary, an idempotency identity, and a defined failure classification — the properties that distinguish a command from a code path.

**`ExecuteDiscoveryQuery(execution_id)`** — claims an execution, loops pages per `B3_PAGINATION_MODEL.md` §2, and terminates it with one of the seven outcomes. It never writes `businesses` or `discovery_results` directly; each page delegates to `IngestProviderPage`.

**`IngestProviderPage(execution_id, page_index, normalized_results[])`** — one transaction: insert the page-ingestion row (unique), resolve identity and upsert each Business, append provenance, advance the counters, persist the continuation, and write the outbox rows. Either all of it commits or none does, so a partially ingested page cannot exist.

## 2. Events — 7

| # | Event | Aggregate | Trigger | Payload beyond the envelope | Consumers |
|---:|---|---|---|---|---|
| 1 | `DiscoveryJobQueued` **(frozen)** | `JOB-*` | job admitted, or retried | `provider_source`, `combination_count`, `attempt_no` | Analytics, Attribution |
| 2 | `DiscoveryJobCompleted` **(frozen)** | `JOB-*` | → `completed` | `completion_kind`, `counts{found,duplicate,deduplicated}`, `failed_query_count`, `duration_ms` | Analytics, Attribution, notifications |
| 3 | `DiscoveryJobFailed` **(frozen)** | `JOB-*` | → `failed` | `failure_code` (closed set) | Analytics, operations |
| 4 | `DiscoveryJobCancelled` *(additive)* | `JOB-*` | → `cancelled` | `cancelled_from` (`pending`\|`processing`), `quota_released` | Analytics, operations |
| 5 | `BusinessDiscovered` **(frozen)** | `BUS-*` | a Business is created for the **first** time in the workspace | `business_public_id`, `job_public_id`, `provider`, `discovered_at` | **B4**, Analytics |
| 6 | `BusinessRediscovered` *(additive)* | `BUS-*` | an **existing** Business is observed by a job that did not first discover it | `workspace_id`, `business_public_id`, `discovery_job_public_id`, `discovered_at` — **exactly B2's four fields, and nothing more** | **CRM (B2 consumed contract 9)** |
| 7 | `BusinessMerged` **(frozen)** | `BUS-*` | `MergeBusiness` commits | `surviving_business_public_id`, `losing_business_public_id`, `reason` | **CRM (B2 consumed contract 7)**, Analytics |

`EVENT_COUNT = 7`. Five are frozen B0 events; `DiscoveryJobCancelled` and `BusinessRediscovered` are additive (`B3-D-B005`).

### 2.1 Why there is no `DiscoveryQueryCompleted`

An execution finishing is **queue mechanics, not a durable business fact**. Nothing outside the Discovery domain can act on "combination 7 of 20 finished", and emitting it would put 50 events on the outbox per job for no consumer. The information is not lost: it is persisted on `discovery_query_executions` and exposed through `DiscoveryQueryStatus`, and its aggregate reaches consumers on `DiscoveryJobCompleted` as `completion_kind` and `failed_query_count`.

### 2.2 `BusinessDiscovered` vs `BusinessRediscovered`

They are disjoint by construction, and the partition is what keeps B2 correct:

| | `BusinessDiscovered` | `BusinessRediscovered` |
|---|---|---|
| Fires when | the `businesses` row is **created** | an existing Business is observed by a **later** job |
| Per Business | once, ever, per workspace | once per subsequent job |
| B2 consumes | **no** | **yes** — contract 9 |
| B4 consumes | **yes** — the acquisition handoff | not required |

A single ingestion emits **at most one** of the two, never both. The rule is stated once, in `B3_ACQUISITION_PROVENANCE.md` §6, and both events derive from it.

### 2.3 Payload discipline

Every payload above contains only public IDs, closed-set enums, counts, and timestamps. **No payload contains** a provider payload or fragment, a provider error string, a continuation token, a provider job ID, a contact PII field, an internal UUID, a queue identifier, or a Lead reference. `BusinessRediscovered` in particular carries **exactly** B2's four fields — B2 §2.1 says "and nothing more", and B3 sends nothing more.

## 3. Idempotency of emission

Outbox rows are written **in the same transaction** as the state change that justifies them (ADR-005), so an event cannot describe a state that did not commit, and a commit cannot fail to produce its event.

Delivery is at-least-once. Every B3 event is safe to redeliver:

| Event | Redelivery is safe because |
|---|---|
| `DiscoveryJobQueued` / `Completed` / `Failed` / `Cancelled` | consumers are projections keyed by `(job_public_id, attempt_no)` |
| `BusinessDiscovered` | B4's handoff is keyed by `business_public_id` |
| `BusinessRediscovered` | B2's `(lead_id, discovery_job_public_id)` unique constraint absorbs it — B2 §2.3 states this explicitly and requires no event ID from B3 |
| `BusinessMerged` | B2's re-point is idempotent; a second delivery finds the Lead already pointing at the survivor |

## 4. Consumed events — 0

**B3 consumes no domain event from any other domain.** `CONSUMED_EVENT_COUNT = 0`.

This is a designed property, not an omission (`B3_DOMAIN_OWNERSHIP.md` §5). Discovery sits at the head of the product journey: an inbound domain dependency would create a cycle with the domains that consume it, and consuming CRM or Intelligence events would mean acting on state B3 must not own.

Two things that resemble consumption are not:

- **Entitlement decisions** are synchronous service calls inside the admission transaction, not events.
- **Provider callbacks** are external transport, not domain events. They enter the B0 WebhookGateway as `WebhookReceipt` and are verified and deduplicated before any B3 code runs (`B3_PROVIDER_ABSTRACTION.md` §6.1).

## 5. The async boundary

B3 defines **semantics**; ADR-004 and B12 own **mechanism**.

| B3 defines | B3 does not define |
|---|---|
| which work is asynchronous — query execution, page ingestion, callback processing | the broker, queue names, routing keys, or worker topology |
| the seven execution outcomes and the five job states | the retry scheduler |
| retryability, by classification into frozen B0 classes | backoff formulas, attempt counts, jitter |
| idempotency identities for every layer | the dead-letter store or its schema |
| completion conditions | the replay tooling |
| that dead-lettering is terminal, alerted, and replayable | the alerting product |

> **No new queue technology.** ADR-004 selected Celery + Redis and explicitly rejected alternatives for Phase 1. **No B3 document names Kafka, BullMQ, SQS, RabbitMQ, or any other broker**, and no B3 correctness argument depends on which one is used — only on the properties above.

The concrete scheduler, dead-letter persistence, and operator replay are a recorded **forward dependency on B12 — Async & Integration Platform**, exactly as B2 §5.5.6 recorded it. B3 depends; B12 builds.

## 6. Command → event → consumer traceability

| Actor action | Command | Events | Reaches |
|---|---|---|---|
| submit a search | `CreateDiscoveryJob` | `DiscoveryJobQueued` | Analytics, Attribution |
| — (system) | `ExecuteDiscoveryQuery` | none | — |
| — (system) | `IngestProviderPage` | `BusinessDiscovered` \| `BusinessRediscovered` | **B4** \| **B2 contract 9** |
| — (system) | job completion evaluator | `DiscoveryJobCompleted` \| `DiscoveryJobFailed` | Analytics |
| press retry | `RetryDiscoveryJob` | `DiscoveryJobQueued` | Analytics |
| confirm cancel | `CancelDiscoveryJob` | `DiscoveryJobCancelled` | Analytics, operations |
| resolve a duplicate | `MergeBusiness` | `BusinessMerged` | **B2 contract 7**, Analytics |
| **convert to Lead** | — | — | **B2 owns this hop entirely. B3 issues no command and emits no event for it.** |

The last row is the boundary that matters most: a human decides, CRM acts, and Discovery is not involved (`B3-INV-2`).

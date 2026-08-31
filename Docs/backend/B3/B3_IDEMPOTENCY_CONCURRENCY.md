# B3 — Idempotency and Concurrency

> **B3 status:** Target design only. Inherits ADR-010 and frozen `BACKEND_IDEMPOTENCY_STANDARD.md` verbatim. **No second idempotency system is introduced, and Redis participates in no correctness decision** (`B3-INV-15`).

Frozen B0 already names *"Discovery retry"* as following the platform idempotency standard. B3 binds to that and adds only the B3-specific identities.

## 1. Nine idempotency layers

A network retry, a worker restart, a redelivery, or a replay must not duplicate a job, an execution, a provider call, a Business, a result, or a quota unit. Each layer has its own stable identity and its own PostgreSQL constraint.

| # | Layer | Identity | Constraint | Duplicate behaviour |
|---:|---|---|---|---|
| 1 | **Create job** | `Idempotency-Key` scoped by workspace + principal + endpoint + body hash (frozen B0) | `IdempotencyRecord` unique, written in the job transaction | same key + same body → stored `202` replayed, **no second job, no second quota unit**. Same key + different body → `409 IDEMPOTENCY_CONFLICT` |
| 2 | **Duplicate intent** | `request_fingerprint` (`B3_DISCOVERY_REQUEST_MODEL.md` §4) | partial unique on `(workspace_id, request_fingerprint)` for non-terminal jobs | `409 CONFLICT`, `details.reason = "duplicate_discovery_request"`, `details.existing_job_ref` |
| 3 | **Query plan** | `(job_id, keyword_norm, location_norm)` | unique | a re-plan is absorbed; the plan is materialized once |
| 4 | **Execution** | `(query_id, attempt_no)` | unique | two workers claiming the same execution — one wins, the loser skips |
| 5 | **Provider call** | provider key derived from `(execution_id, attempt_no, page_index)` | provider-side, per frozen B0 ("provider requests use provider-specific keys derived from the internal idempotency record") | the provider deduplicates where it supports it; WazLink deduplicates at layer 6 regardless |
| 6 | **Page ingestion** | `(execution_id, page_index)` | unique | a re-fetched or redelivered page is a **no-op**; already-ingested results are not re-counted |
| 7 | **Business upsert** | `(workspace_id, provider, provider_external_id)` | unique on `business_identities` | `ON CONFLICT` → resolve to the existing Business, refresh fields (`B3_NORMALIZATION_DATA_QUALITY.md` §5). **No duplicate Business** |
| 8 | **Result attach** | `(query_execution_id, business_id)` | unique on `discovery_results` | `ON CONFLICT DO NOTHING`. **No duplicate provenance row** |
| 9 | **Provider callback** | provider + event identity + payload hash (frozen B0 webhook standard) | `WebhookReceipt` (`WHR-*`) unique | `200 WEBHOOK_DUPLICATE`, no second ingestion |

**Quota is bound to layer 1, not to any later layer** (`B3-INV-10`). A retry at layers 4–8 never touches `usage_counters`.

The **CRM conversion boundary** is a tenth layer in the product journey, but it is **B2's**, governed by frozen `POST /businesses/{id}/convert-to-lead` and the partial unique index `(workspace_id, business_id) WHERE archived_at IS NULL`. B3 states it only to record that B3 adds nothing there.

## 2. Pre-checks are optimizations; constraints are correctness

Every layer above is written as *pre-check, then constrained write*. The pre-check exists to avoid a pointless round trip. **The constraint is what makes it correct.**

An implementation that passes a pre-check and then loses the race still commits correctly, because the unique index absorbs it. This is why no B3 path needs an advisory lock, a Redis lock, or serializable isolation — **Read Committed is sufficient throughout**, since no B3 guard reads a value it later writes without a lock or a unique index protecting the write.

## 3. The concurrency race matrix — 18 races

| ID | Race | Mechanism | Winner | Loser | Result |
|---|---|---|---|---|---|
| R-01 | two identical `POST /discovery/jobs` with the same `Idempotency-Key` | `IdempotencyRecord` unique | first commit | second replays the stored response | **one** job, one quota unit |
| R-02 | two `POST`s, different keys, same fingerprint | partial unique on `(workspace_id, request_fingerprint)` | first | `409 duplicate_discovery_request` | one job |
| R-03 | two workers claim the same query execution | `(query_id, attempt_no)` unique + `SELECT … FOR UPDATE SKIP LOCKED` | first | skips | one execution |
| R-04 | the same provider page ingested twice | `(execution_id, page_index)` unique | first | absorbed | counters advance once |
| R-05 | duplicate scraping callback | `WebhookReceipt` unique | first | `200 WEBHOOK_DUPLICATE` | one ingestion |
| R-06 | callback **and** poll both deliver the same page | R-04's constraint | whichever commits first | absorbed | one ingestion |
| R-07 | two providers concurrently upsert the same **new** identity | `business_identities` unique | first | re-resolves to the winner's Business | **one** Business |
| R-08 | two executions of one job discover the same Business | layer 7 unique | first creates | second resolves | one Business, **two** `discovery_results` rows |
| R-09 | two jobs concurrently discover the same Business | same | first | second resolves | one Business, two rows |
| R-10 | two concurrent normalizations of one identity | row lock on `businesses` during field refresh | first | applies §5 refresh over the winner's state | deterministic final value |
| R-11 | retry racing an in-flight original execution | job `version` (ADR-010) + execution unique | the transition that commits first | `409 STALE_VERSION` | no double execution |
| R-12 | cancel racing completion | `discovery_jobs` row lock | first transition | `409 CONFLICT`, `job_already_terminal` | exactly one terminal state |
| R-13 | cancel racing a page ingestion | ingestion commits; cancel observed at the next checkpoint | ingestion | — | page kept, execution then `CANCELLED` |
| R-14 | two concurrent `MergeBusiness` on the same pair | both rows locked in `business_id` order | first | sees `L` already merged, `409 CONFLICT` | one merge, no deadlock |
| R-15 | merge racing an ingestion that resolves to the losing Business | row lock on both Businesses | merge | ingestion re-resolves through the tombstone to the survivor | provenance lands on the survivor |
| R-16 | CRM conversion racing a rediscovery of the same Business | **none needed** — B2 takes no lock on the Lead and B3 writes no CRM table | both commit | — | Lead created; provenance appended; B2 guard 5 absorbs any duplicate |
| R-17 | two concurrent `discoveryRuns` reservations at the quota edge | locked `usage_counters` row (frozen B0) | first | `403 QUOTA_EXHAUSTED` | quota never oversold |
| R-18 | worker crash after provider response, before persistence | no page row was committed | — | — | retry re-fetches; R-04 absorbs any partial |

Every outcome above is decided by PostgreSQL — a row lock, a unique index, or an integer `version`. **No Redis key participates in any row of this table** (`B3-INV-15`).

## 4. Locking strategy

| Object | Lock | When | Why |
|---|---|---|---|
| `discovery_jobs` row | `FOR UPDATE` | state transitions, retry, cancel | terminal-state exclusivity (R-11, R-12) |
| `discovery_query_executions` | `FOR UPDATE SKIP LOCKED` | worker claim | many workers, no contention, no double-claim (R-03) |
| `businesses` row | `FOR UPDATE` | field refresh, merge | deterministic refresh and merge (R-10, R-14, R-15) |
| `usage_counters` row | `FOR UPDATE` | quota reservation/release | frozen B0; quota is never oversold (R-17) |
| `business_identities` | **none** | insert | the unique index is the mechanism (R-07) |
| `discovery_results` | **none** | insert | the unique index is the mechanism (R-08, R-09) |
| `provider_page_ingestions` | **none** | insert | the unique index is the mechanism (R-04) |

Ingestion — the highest-volume path — takes **no lock at all** on its own tables. It is protected entirely by unique indexes, so ingestion never blocks ingestion and a slow page cannot stall a parallel execution.

## 5. Optimistic concurrency

ADR-010's integer `version` applies to `discovery_jobs`, the only B3 resource a client mutates by reference. `RetryDiscoveryJob` and `CancelDiscoveryJob` require the client's observed version (via `If-Match` or an explicit field) and return `409 STALE_VERSION` on mismatch.

`businesses` also carries `version`, but for internal refresh/merge ordering only — Phase 1 exposes no client mutation of a Business (`B3_NORMALIZATION_DATA_QUALITY.md` §2), so no `If-Match` is required on any business route.

`discovery_results` carries **no** version. It is append-only and immutable; a version on an immutable row would be meaningless.

## 6. Monotonic transitions

| Object | Monotonic in | Broken only by |
|---|---|---|
| job state within an attempt | `pending → processing → terminal` | `RetryDiscoveryJob`, which opens a **new attempt** rather than reversing the old one (`B3_JOB_STATE_MACHINE.md` §3.1) |
| `progress` within an attempt | non-decreasing | attempt reset |
| the three counters within an attempt | non-decreasing | attempt reset |
| `discovery_results` | append-only | never |
| `business_identities` | append-only, except merge re-point | never deleted |
| `business_merges` | append-only | never |
| `first_discovered_at` | write-once | never |
| `last_observed_at` | `GREATEST(current, new)` — non-decreasing | never |

`last_observed_at` uses `GREATEST()` for the same reason B2 uses it for `last_activity_at`: it is order-independent, so an out-of-order ingestion cannot move the value backwards, and no arrival-order comparison is needed anywhere.

## 7. Worker crash safety

| Crash point | Recovery |
|---|---|
| after admission commit, before dispatch | the outbox row is undispatched; the ADR-005 dispatcher republishes it |
| after claiming an execution, before the provider call | the execution lease expires and it is re-claimed; no page was ingested |
| after the provider response, before persistence | retry re-fetches the page; R-04 absorbs it (cost is paid twice — bounded by the page limit) |
| **after persistence, before acknowledgement** | redelivery re-ingests; layers 6, 7, and 8 make it a **no-op**; counters advance once |
| after ingesting page N, before requesting N+1 | the persisted `provider_continuation` resumes exactly there |
| after the last page, before the job transition | the completion evaluator is idempotent: it recomputes the terminal state from execution rows and takes the job row lock |

The fourth row is the classic at-least-once hazard, and it is closed by construction: **every ingestion effect is idempotent under its own unique constraint**, so acknowledgement is never load-bearing for correctness.

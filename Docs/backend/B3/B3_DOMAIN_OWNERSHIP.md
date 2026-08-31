# B3 — Discovery Domain Ownership

> **B3 status:** Ownership design only. Exactly one domain may write each business fact. Nothing below duplicates or overrides an authority B0, B1, or B2 already assigned.

## 1. The two aggregates B3 owns

Frozen `BACKEND_DOMAIN_OWNERSHIP.md` assigns Discovery **two** rows, not one, and B3 keeps that split because the two have genuinely different lifecycles:

| Aggregate root | Module | Authoritative tables | Written by | Lifecycle |
|---|---|---|---|---|
| **`DiscoveryJob`** (`JOB-*`) | `discovery` | `discovery_jobs`, `discovery_queries`, `discovery_query_executions`, `provider_page_ingestions`, `discovery_results` | discovery services and workers | **bounded** — a job is created, executes, terminates, and is thereafter immutable except by explicit retry |
| **`Business`** (`BUS-*`) | `discovery/business` | `businesses`, `business_identities`, `business_match_candidates`, `business_merges` | the **normalization service** only | **open-ended** — a Business outlives every job that observed it and accumulates provenance for as long as the workspace exists |

That a job is bounded and a Business is not is the reason `discovery_results` exists as a separate table rather than as a column on either one. It is the many-to-many join that lets a finite job reference an infinite-lived Business without either owning the other.

`discovery_results` (`RES-*`) is written by the Job aggregate's workers but **read** as Business provenance. Its authoritative owner is the Job aggregate; its uniqueness constraint protects the Business relationship. This dual role is stated explicitly so no implementer places it under `businesses`.

## 2. Business fact ownership

| Business fact | Durable owner | Authoritative storage | Written by | Read by | Never written by |
|---|---|---|---|---|---|
| Discovery job identity, request, and lifecycle state | **Discovery** | `discovery_jobs` | `CreateDiscoveryJob`, `RetryDiscoveryJob`, `CancelDiscoveryJob`, job workers | job list/detail, CRM provenance panel, analytics | CRM, AI, Automation, Billing |
| The normalized keyword/location request | **Discovery** | `discovery_jobs.request_*`, `discovery_queries` | `CreateDiscoveryJob` only; **immutable thereafter** | job detail | anything — a request is never edited |
| Per-combination execution state and progress | **Discovery** | `discovery_query_executions` | job workers | job detail, observability | any external domain |
| Provider continuation state | **Discovery** | `discovery_query_executions.provider_continuation` | provider adapters via the execution service | nothing outside the worker | **any API surface** (`B3-INV-12`) |
| That a job observed a business at an instant | **Discovery** | `discovery_results` | ingestion workers; **append-only** | Business provenance, CRM `lead_provenance_additional_jobs` feed, analytics | anything — never updated, never deleted |
| Business name, category, address, phone, website, coordinates, rating, reviews | **Discovery/Business** | `businesses` | `UpsertBusiness`, `MergeBusiness` — the normalization service only | Lead 360, CRM list read model, B4, exports | **CRM**, AI, Messaging, Pipeline |
| Which provider identities denote one Business | **Discovery/Business** | `business_identities` | `UpsertBusiness`, `MergeBusiness` | identity resolution, provenance | anything else |
| A proposed but unconfirmed cross-provider match | **Discovery/Business** | `business_match_candidates` | the match evaluator | operator review surface | automatic merge logic — a candidate never auto-applies (`B3-INV-6`) |
| That two Businesses were merged, and which survived | **Discovery/Business** | `business_merges` (append-only) + `businesses.merged_into_business_id` | `MergeBusiness` | audit, provenance resolution | anything — merges are never rewritten |
| Raw provider payload evidence | **Discovery** | `provider_page_ingestions` (hash always; bounded snapshot only when enabled) | provider adapters | operator diagnostics under a restricted permission | **any API response, event payload, or log line** |
| Provider cost and quota telemetry | **Discovery** (emits) / **Observability** (aggregates) | metrics + `provider_page_ingestions.cost_units` | provider adapters | cost dashboards | Billing (B3 emits telemetry; it prices nothing) |

## 3. What B3 must never own

Stated as prohibitions because each one has a plausible-looking wrong implementation:

| B3 must not own | Real owner | The wrong implementation this forbids |
|---|---|---|
| **Lead existence, identity, status, priority, owner, tags** | **CRM (B2)** | a `businesses.converted` or `businesses.lead_id` column, or a "convert on discovery" flag. Discovery has no CRM write path and stores no Lead reference in either direction. |
| **Whether a Business is already a Lead** | **CRM (B2)** | Discovery calling CRM to filter rediscovery events. B3 emits the signal unconditionally and lets B2's own guards discard it (`B3_CRM_B2_BOUNDARY.md` §4). Reading CRM to decide would invert the dependency. |
| **CRM activity / timeline entries** | **CRM (B2)** | writing a `crm_activities` row on discovery. B2 `B2_CRM_ACTIVITY_VOCABULARY.md` §6 and `B2_REDISCOVERY_PROVENANCE_PROCESS.md` §2.2.2 both say **NO TIMELINE ACTIVITY ROW**, and Discovery is not in B2's `{messaging, pipeline}` source-domain set (`B3-INV-14`). |
| **AI score, confidence, tier, signals, gaps, recommendations, sales approach** | **AI Intelligence (B4)** | a `businesses.score` column or an `intelligence_status` field. B3 supplies inputs only (`B3_B4_HANDOFF_CONTRACT.md`). |
| **Deal, stage, probability, close state** | **Pipeline** | any pipeline reference on a Business. |
| **Conversation, message, delivery state** | **Messaging** | inferring a "contactable" state from a discovered phone number. B3 records the phone as a normalized field; it never asserts reachability. |
| **RevenueEvent, recognized revenue** | **Revenue** | attributing revenue to a discovery job. |
| **Attribution truth** | **Attribution** | writing an `AttributionTouchpoint`. Frozen B0 lists `discovery/campaign` as an Attribution *integration*, meaning Attribution reads Discovery — not the reverse. |
| **Plan, capability, quota definition, price, invoice** | **Entitlements / Billing (B8)** | computing a discovery price or deciding a limit locally. B3 *consumes* `EvaluateEntitlement` / `ReserveQuota` decisions (`B3_QUOTA_COST_CONTROL.md` §2). |
| **Provider credentials, API keys, secrets, webhook signing keys** | **platform configuration / secret store** | a `discovery_sources.api_key` column. The source catalog holds display and capability metadata only (`B3_SECURITY_PRIVACY_LEGAL.md` §4). |
| **Workspace, membership, role, session, actor identity** | **Tenant identity (B1)** | resolving an actor locally. B3 receives an authorization context. |
| **Queue, broker, scheduler, dead-letter store, replay tooling** | **B0 generic mechanics + B12 platform** | selecting a broker or defining a retry table. ADR-004 already chose Celery + Redis; B3 adds no second system (`B3_COMMAND_EVENT_CATALOG.md` §5). |

## 4. Boundaries against nine domains

| Counterparty | What crosses the boundary | Direction | Mechanism |
|---|---|---|---|
| **Entitlements** | capability decision, quota reservation and release | B3 → Entitlements (synchronous) | `EvaluateEntitlement`, `ReserveQuota` at admission, inside the job-creation transaction |
| **CRM (B2)** | `BusinessMerged`, `BusinessRediscovered`; and at conversion time, a resolvable `BUS-*` plus a deciding `JOB-*` | B3 → CRM (asynchronous events, plus synchronous read of Business by CRM) | B0 transactional outbox (ADR-005); B2 consumed contracts 7 and 9 |
| **AI Intelligence (B4)** | `BusinessDiscovered` and a stable normalized Business read contract | B3 → B4 | `B3_B4_HANDOFF_CONTRACT.md`; B4 is not designed, so the contract is stated as an obligation on B3 only |
| **Analytics** | job counts, result counts, dedup rates, provider telemetry | B3 → Analytics (read-only projection) | frozen B0 rule: projections own no truth |
| **Attribution** | discovery source and job identity as a touchpoint source | B3 → Attribution | Attribution reads; B3 writes nothing there |
| **Files / Export** | the result set an export renders | B3 → Files | `discovery.export` permission (B1); export is a separate concern from acquisition |
| **Webhooks** | scraping-provider callbacks | inbound, via the **WebhookGateway** | B0 `WebhookReceipt` (`WHR-*`) first; a callback never mutates a Business directly (`B3_PROVIDER_ABSTRACTION.md` §6) |
| **Jobs / async platform** | asynchronous execution of query units | internal | ADR-004 Celery; semantic states are B3's, mechanics are B0's/B12's |
| **Audit** | who created, retried, cancelled, or merged | B3 → Audit | `AUD-*` audit rows for actor-initiated commands only; machine ingestion is traced, not audited |

## 5. The one-way rule

**Every arrow above points outward from Discovery, except two synchronous reads.**

Discovery calls Entitlements (to be told yes or no) and is *read by* CRM, B4, Analytics, Attribution, and Export. Discovery consumes **zero** domain events (`B3_COMMAND_EVENT_CATALOG.md` §4) and calls no downstream domain. This is deliberate: Discovery sits at the head of the product journey, so any inbound dependency would create a cycle, and any downstream call would let Discovery act on CRM or AI state it must not know.

The single edge case that looks like an exception is `BusinessMerged`: CRM *reacts* to it by re-pointing `leads.business_id`. That is CRM consuming a Discovery event under B2's own frozen contract 7 — still an outward arrow. Discovery is not told the outcome and does not wait for it.

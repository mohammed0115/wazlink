# B3 — Discovery & Acquisition Blueprint

> **B3 status:** Target design only. **No Django code, no migrations, no PostgreSQL objects, no Celery tasks, no provider integration, no frontend change is authorized by this package.** Every table, column, route, and command below is a *target* for a later implementation phase.

**Frozen baseline:** B0 `261ec27f84f337be0d9318141de260c8b9058a6b` · B1 `062975e3e6aa6ee314097a9a457f6383ebd56557` · B2 `24643397254caac4117320df756d8bc164882635`
**Frontend reference:** the working tree at the B2 checkpoint; every behavior claim in `B3_FRONTEND_TRACEABILITY.md` carries a file:line citation.

## 1. Scope

B3 designs the **Discovery & Acquisition** domain: how a user's search intent becomes provider work, how provider output becomes a normalized WazLink `Business`, and how the provenance of that acquisition is preserved permanently.

B3 covers the first two hops of the canonical product journey and **stops at the third**:

```
Discovery request → Discovery Job → Business Result  │  → AI Lead Intelligence → CRM conversion
└──────────────── B3 owns this ───────────────────┘  │  └── B4 ──┘   └──── B2 (frozen) ────┘
```

The canonical frozen fixture chain is `JOB-1028 → BUS-1042 → LEAD-1042` (`client/src/domain/data.js:80`, `:44`, and the `LEAD-1042` row). B3 owns the first arrow. B2 owns the second and is **frozen**; B3 changes nothing in it.

## 2. What B0 already froze, and what B3 therefore does not invent

B3 is unusually constrained because B0 already named the Discovery skeleton. B3 **derives** from these rather than proposing alternatives:

| Frozen artifact | What it already fixes | B3 obligation |
|---|---|---|
| `BACKEND_DATA_MODEL.md` | Discovery tables are `discovery_jobs, discovery_queries, discovery_results, businesses, business_identities`; `workspace/provider_external_id unique`; `job/status/created` index | use these exact table names; make the uniqueness constraint precise (`B3-D-B002`) |
| `BACKEND_DOMAIN_OWNERSHIP.md` | Discovery aggregate root = `DiscoveryJob`; Business aggregate root = `Business`, written by the **normalization service**; forbidden coupling **"no Lead auto-create"** and **"no provider schema leakage"** | adopt verbatim; both prohibitions become B3 invariants |
| `BACKEND_COMMAND_EVENT_CATALOG.md` | commands `CreateDiscoveryJob`, `RetryDiscoveryJob`; events `DiscoveryJobQueued`, `DiscoveryJobCompleted`, `DiscoveryJobFailed`, `BusinessDiscovered`, `BusinessMerged`; the event envelope | reuse; add only what the frontend proves is missing |
| `BACKEND_INTEGRATION_BOUNDARIES.md` | ports are named **`PlacesProvider`** and **`ScrapingProvider`**; adapters attach request ID, provider request ID, cost metadata, retry classification; raw payload retention is "restricted and time-bounded"; "provider callbacks never directly mutate business aggregates outside an application service" | use these port names — B3 invents no `DiscoveryPort` |
| `BACKEND_PUBLIC_ID_REGISTRY.md` §A | `JOB-` DiscoveryJob, `RES-` DiscoveryResult, `BUS-` Business are **already registered** | B3 mints **no new public prefix** |
| `BACKEND_API_CATALOG.md` / `BACKEND_OPENAPI_V1.yaml` | `POST /discovery/jobs` (202), `GET /discovery/jobs/{id}`, `GET /discovery/jobs/{id}/results` | extend additively; never redefine |
| `BACKEND_RETRY_POLICY.md` | transient-retry mechanics, backoff, five-attempt default, dead-letter + alert | classify B3 failures into it; **no competing retry policy** |
| `BACKEND_IDEMPOTENCY_STANDARD.md` | names **"Discovery retry"** explicitly as following the platform standard | bind to it |
| `BACKEND_RATE_LIMIT_POLICY.md` | **"Discovery submit — 10/hour/workspace plus entitlement"** | adopt as the admission rate limit |
| `BACKEND_PRIVACY_AND_DATA_HANDLING.md` | provider payloads = "restricted JSONB, short retention, hash/reference"; proposed 30-day raw retention; scraping must respect provider contracts and law | adopt; escalate the legal items rather than resolving them |
| ADR-001…ADR-012 | Django monolith, DRF, PostgreSQL canonical, **Celery + Redis (ADR-004)**, transactional outbox (ADR-005), UUIDv7 + prefixed public IDs (ADR-006), version integer (ADR-010), cursor pagination (ADR-011) | inherit unchanged; **no new broker, no Kafka, no BullMQ** |

## 3. Design principles

1. **Provider output is evidence, never truth.** A provider result is normalized into a WazLink `Business` before any domain code sees it. No provider field name, status vocabulary, page token, or payload shape crosses the domain boundary. This is B0's "no provider schema leakage" made operational.
2. **Discovery observes; it never decides.** Discovering a Business creates no Lead, no score, no deal, no revenue, and no CRM activity. B0's "no Lead auto-create" is absolute and is enforced structurally: B3 has no write path into any CRM table.
3. **Identity before deduplication.** A Business is identified by *verifiable provider identity*, and only then considered for cross-provider linking. Name similarity never merges anything.
4. **Provenance is append-only.** Every observation of a Business by a query gets its own immutable `discovery_results` row. Re-discovery adds; it never overwrites. A merge re-points provenance; it never deletes it.
5. **Cost is a first-class invariant.** Every path that can call a provider is bounded — combinations, pages, results, concurrency, retries, and rate limit. There is no unbounded fan-out anywhere in this design.
6. **Visibility is a contract, not an accident.** The frozen frontend reveals results only for a `completed` job (`client/src/domain/data.js:436`). B3 states that as a rule and defends it, rather than letting it fall out of an implementation detail.
7. **The clock that stamps an observation is ours.** `discovered_at` is WazLink's trusted server clock at ingestion, never a provider timestamp — which is what makes B2's future-skew machinery structurally unreachable on the rediscovery path (`B3_CRM_B2_BOUNDARY.md` §4).

## 4. The 16 B3 invariants

| ID | Invariant | Enforced by |
|---|---|---|
| **B3-INV-1** | Every tenant-owned B3 row carries a non-null `workspace_id`, and every read is workspace-scoped. A cross-workspace public ID resolves to `ENTITY_NOT_FOUND`, never to a disclosure. | `B3_AUTHORIZATION_TENANCY.md` §2 |
| **B3-INV-2** | Discovery never creates, mutates, reads-for-decision, or deletes a CRM `Lead`. B3 owns no CRM table and issues no CRM command. | B0 "no Lead auto-create"; `B3_CRM_B2_BOUNDARY.md` §1 |
| **B3-INV-3** | No provider field name, status string, error code, page token, or raw payload appears in any B3 API response, event payload, or domain signature. | `B3_PROVIDER_ABSTRACTION.md` §2 |
| **B3-INV-4** | One real-world business observed N times in one workspace is **one** `businesses` row with **N** `discovery_results` rows. Provenance count and Business count are independent. | `B3_BUSINESS_IDENTITY_MODEL.md` §3 |
| **B3-INV-5** | `(workspace_id, provider, provider_external_id)` is unique across `business_identities`. Two providers reusing one opaque external ID can never collide. | `B3_DATA_MODEL.md` §4 |
| **B3-INV-6** | No automatic merge is ever performed on name similarity, with or without a shared city. Auto-link requires **two independent strong identity signals**. | `B3_BUSINESS_IDENTITY_MODEL.md` §5 |
| **B3-INV-7** | A merge preserves every `discovery_results` row, every `business_identities` row, and the losing `BUS-*` as a resolvable tombstone. Provenance is never deleted. | `B3_BUSINESS_IDENTITY_MODEL.md` §6 |
| **B3-INV-8** | Discovery results are **visible** only while `job.status = completed`. Persistence during execution is not visibility. | `B3_JOB_STATE_MACHINE.md` §5 |
| **B3-INV-9** | A `DiscoveryJob` has exactly five lifecycle states. Partial success is a property of a `completed` job, not a sixth state. | `B3_JOB_STATE_MACHINE.md` §2 |
| **B3-INV-10** | One job admission consumes exactly one `discoveryRuns` unit. Retry, redelivery, worker restart, and replay never consume a second. | `B3_QUOTA_COST_CONTROL.md` §3 |
| **B3-INV-11** | Every provider-facing path is bounded by an explicit maximum: combinations, pages per query, results per job, concurrent executions, retries. No unbounded fan-out exists. | `B3_QUOTA_COST_CONTROL.md` §5; the per-Job actor-retry term is `MAX_JOB_ATTEMPTS = 3` (`B3-D-A031`, `B3_JOB_STATE_MACHINE.md` §3.2); the workspace-wide actor-retry admission-rate term is `MAX_ACTOR_RETRY_REQUESTS_PER_WORKSPACE_PER_HOUR = 10` (`B3-D-A032`, `B3_JOB_STATE_MACHINE.md` §3.2.1) |
| **B3-INV-12** | A provider continuation token is server-side execution state. It never appears in a WazLink API request or response. | `B3_PAGINATION_MODEL.md` §2 |
| **B3-INV-13** | `discovered_at` is WazLink's trusted server clock sampled at ingestion. No provider- or client-supplied timestamp is ever stored in it. | `B3_ACQUISITION_PROVENANCE.md` §3 |
| **B3-INV-14** | Discovery emits no CRM timeline entry and is not a timeline `source_domain`. B2's closed set is `{messaging, pipeline}` and B3 does not join it. | `B3_CRM_B2_BOUNDARY.md` §6 |
| **B3-INV-15** | Every durable state transition is decided by PostgreSQL — a row lock, a unique index, or an integer `version`. Redis participates in no B3 correctness decision. | ADR-003; `B3_IDEMPOTENCY_CONCURRENCY.md` §4 |
| **B3-INV-16** | B3 owns no AI score, confidence, signal, tier, or recommendation, and no field that B4 will own. | `B3_B4_HANDOFF_CONTRACT.md` §2 |

## 5. Document map

| Document | Purpose |
|---|---|
| `B3_DISCOVERY_BLUEPRINT.md` | this document — scope, inheritance, principles, the 16 invariants |
| `B3_FRONTEND_TRACEABILITY.md` | the frozen frontend Discovery behavior inventory with A/B/C/D classification |
| `B3_DOMAIN_OWNERSHIP.md` | what Discovery owns, what it must never own, boundaries against nine domains |
| `B3_DISCOVERY_REQUEST_MODEL.md` | request model, normalization, query expansion, execution plan, safety bounds |
| `B3_JOB_STATE_MACHINE.md` | the five states, transitions, progress, result visibility, partial success, cancellation |
| `B3_BUSINESS_IDENTITY_MODEL.md` | provider result vs Business vs Discovery result vs Lead; identity, dedup, merge |
| `B3_PROVIDER_ABSTRACTION.md` | `PlacesProvider` / `ScrapingProvider` ports, Google and scraping boundaries, raw payload policy |
| `B3_NORMALIZATION_DATA_QUALITY.md` | normalized Business fields, value classification, minimum viable result, quality rules |
| `B3_ACQUISITION_PROVENANCE.md` | the immutable provenance model and its coordination with B2 rediscovery |
| `B3_IDEMPOTENCY_CONCURRENCY.md` | nine idempotency layers and the 18-race concurrency matrix |
| `B3_PAGINATION_MODEL.md` | provider continuation vs WazLink cursor; stability, replay, expiry |
| `B3_RETRY_FAILURE_MODEL.md` | failure classification bound to frozen B0 retry policy |
| `B3_QUOTA_COST_CONTROL.md` | entitlement boundary with B8 and the cost-control bounds |
| `B3_AUTHORIZATION_TENANCY.md` | B1 reuse, per-operation authorization, cross-workspace defence |
| `B3_API_DTO_CONTRACTS.md` | the 8 operations and their request/response DTOs |
| `B3_COMMAND_EVENT_CATALOG.md` | 7 commands, 7 events, 0 consumed events, async boundary |
| `B3_DATA_MODEL.md` | implementation-grade logical PostgreSQL design |
| `B3_OBSERVABILITY.md` | metrics, logs, traces, correlation chain |
| `B3_SECURITY_PRIVACY_LEGAL.md` | isolation, SSRF, webhook authenticity, PII, retention, legal escalations |
| `B3_CRM_B2_BOUNDARY.md` | exact alignment with frozen B2, including the `BusinessRediscovered` producer contract |
| `B3_B4_HANDOFF_CONTRACT.md` | the stable acquisition contract B4 will consume |
| `B3_FAILURE_SCENARIOS.md` | DF1–DF40 end-to-end failure scenarios |
| `B3_ACCEPTANCE_TEST_MATRIX.md` | deterministic, implementation-independent acceptance criteria |
| `B3_DECISION_REGISTER.md` | Class A/B/C decision register |
| `B3_CONTROLLED_AMENDMENTS.md` | every change B3 requires to a frozen B0/B1/B2 artifact |
| `B3_IMPLEMENTATION_READINESS.md` | readiness gates and mechanically recomputed evidence |

## 6. What B3 does not authorize

No file in this package is executable backend implementation. Under B3 no agent may create Django projects or apps, models, serializers, views, URLs, middleware, settings, migrations, Celery tasks or queues, provider adapters, API clients, credentials, or infrastructure; may not call Google Places or any scraping provider; may not modify `client/`; and may not install a dependency. SQL appearing anywhere in this package is **illustrative notation for a constraint or a conflict rule**, never a migration and never DDL.

B3 declares controlled amendments to frozen artifacts in `B3_CONTROLLED_AMENDMENTS.md`. **B3 applies none of them.** No implementation may act against an amendment target until the bundle is approved.

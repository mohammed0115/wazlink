# WazLink Backend Architecture & Documentation

> **B0 status:** Architecture and contracts only. Backend coding is not authorized. This document is normative for future backend implementation agents.

**Frontend reference:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`  
**Scope:** Django + PostgreSQL backend design; no production implementation, migrations, endpoints, provider calls, secrets, infrastructure, or frontend changes are included in B0.

## Normative document index

| Document | Purpose |
|---|---|
| `B0_BACKEND_BLUEPRINT.md` | executive architecture and implementation gate |
| `BACKEND_ARCHITECTURE_DECISIONS.md` | ADR decisions and unresolved choices |
| `BACKEND_DOMAIN_OWNERSHIP.md` | bounded contexts and write ownership |
| `BACKEND_AUTHORIZATION_MATRIX.md` | role/action authorization |
| `BACKEND_RETRY_POLICY.md` | retry classes and dead letters |
| `BACKEND_TIMEOUT_POLICY.md` | finite provider/job deadlines |
| `BACKEND_IDEMPOTENCY_STANDARD.md` | platform idempotency contract |
| `BACKEND_API_STANDARD.md` | REST transport conventions |
| `BACKEND_API_CATALOG.md` | conceptual endpoint catalog |
| `BACKEND_DTO_CONTRACTS.md` | stable request/response DTOs |
| `BACKEND_ERROR_CATALOG.md` | machine-readable errors |
| `BACKEND_DATA_MODEL.md` | logical PostgreSQL schema |
| `BACKEND_ERD.md` | domain relationship diagram |
| `BACKEND_SECURITY_ARCHITECTURE.md` | security and tenant isolation |
| `BACKEND_PRIVACY_AND_DATA_HANDLING.md` | classification and retention principles |
| `BACKEND_RATE_LIMIT_POLICY.md` | API/provider cost controls |
| `BACKEND_COMMAND_EVENT_CATALOG.md` | command/event vocabulary |
| `BACKEND_FAILURE_MATRIX.md` | failure behavior |
| `BACKEND_RECONCILIATION.md` | operational reconciliation |
| `BACKEND_STATE_MACHINES.md` | lifecycle states |
| `BACKEND_SEQUENCE_DIAGRAMS.md` | core flow diagrams |
| `FRONTEND_BACKEND_CONTRACT_MAP.md` | service replacement compatibility |
| `BACKEND_TEST_STRATEGY.md` | future test pyramid |
| `BACKEND_DATA_GOVERNANCE.md` | data, ORM, cache, money, time policies |
| `BACKEND_OPENAPI_V1.yaml` | architecture-level OpenAPI contract |
| `BACKEND_PUBLIC_ID_REGISTRY.md` | canonical public-ID prefix registry |
| `BACKEND_INTEGRATION_BOUNDARIES.md` | provider and anti-corruption boundaries |
| `BACKEND_BILLING_TAX_ARCHITECTURE.md` | Platform Billing, Payment, Tax, and ZATCA separation |
| `BACKEND_ANALYTICS_SEMANTICS.md` | metric formulas and recognized-revenue semantics |
| `BACKEND_WORKSPACE_AUTH.md` | workspace, authentication, authorization, and tenancy |
| `BACKEND_OPERATIONS_OBSERVABILITY.md` | operations, observability, backup, and disaster recovery |
| `BACKEND_ROLLOUT_MIGRATION.md` | frontend freeze, rollout, and migration plan |
| `B0_BACKEND_TRACEABILITY.md` | B0 requirement traceability and implementation gate |
| `B0_IMPLEMENTATION_REPORT.md` | factual B0/B0-FIX delivery evidence |

## B1 — Tenant & Identity target design (additive; B0 unchanged)

`Docs/backend/B1/` holds the B1 Tenant & Identity target-design package (revision **B1-FIX.1**). It is **additive**: it modifies no frozen B0 file, and B0 remains closed at `261ec27f84f337be0d9318141de260c8b9058a6b`.

B1 declares **two target-contract amendments** to frozen B0, both decided and both requiring controlled CTO approval **before implementation**; B1 itself applies neither. See `Docs/backend/B1/B1_API_DTO_CONTRACTS.md` §1.1.

| Frozen B0 | B1 target | Decision / execution |
|---|---|---|
| `POST /workspaces/{id}/invitations` → `201 Workspace` | → `201 Invitation` (new schema; no raw token in any response) | `B1-D-A22` / `B1-D-001` |
| `Session.workspace_ref` required, non-nullable | required **and** nullable; `required` set unchanged | `B1-D-A23` / `B1-D-019` |

| Document | Purpose |
|---|---|
| `Docs/backend/B1/B1_TENANT_IDENTITY_BLUEPRINT.md` | B1 scope, B0 inheritance, design principles, package map |
| `Docs/backend/B1/B1_BASELINE_GAP_ANALYSIS.md` | reconstructed B0 + frozen-frontend truth and the 15-row gap matrix |
| `Docs/backend/B1/B1_IDENTITY_DATA_MODEL.md` | logical schema for users, workspaces, memberships, invitations, sessions, roles |
| `Docs/backend/B1/B1_WORKSPACE_MEMBERSHIP_MODEL.md` | Workspace, User, Membership, Invitation, and Owner semantics |
| `Docs/backend/B1/B1_AUTH_SESSION_DESIGN.md` | authentication, sessions, active-workspace resolution and switching |
| `Docs/backend/B1/B1_AUTHORIZATION_RBAC.md` | authorization pipeline, permission catalog and role matrix, resource-authorization doctrine |
| `Docs/backend/B1/B1_ENTITLEMENT_QUOTA_BOUNDARY.md` | RBAC vs entitlement vs quota separation |
| `Docs/backend/B1/B1_CONCURRENCY_IDEMPOTENCY.md` | identity race analysis and idempotency requirements |
| `Docs/backend/B1/B1_API_DTO_CONTRACTS.md` | B1 API surface, DTOs, and error contract |
| `Docs/backend/B1/B1_STATE_MACHINES.md` | Workspace, Membership, Invitation, Session, User state machines |
| `Docs/backend/B1/B1_COMMAND_EVENT_CATALOG.md` | identity commands, events, payload and outbox rules |
| `Docs/backend/B1/B1_SECURITY_THREAT_MODEL.md` | 26-threat identity threat model |
| `Docs/backend/B1/B1_PRIVACY_AUDIT_MODEL.md` | identity data classification and audit record model |
| `Docs/backend/B1/B1_FAILURE_SCENARIOS.md` | F1–F21 end-to-end failure scenarios |
| `Docs/backend/B1/B1_ACCEPTANCE_TEST_MATRIX.md` | 150 deterministic acceptance criteria |
| `Docs/backend/B1/B1_FRONTEND_TRACEABILITY.md` | frozen frontend to B1 target authority |
| `Docs/backend/B1/B1_DECISION_REGISTER.md` | Class A/B/C decision register |
| `Docs/backend/B1/B1_IMPLEMENTATION_READINESS.md` | readiness gates and consistency-validation evidence |

Two public-ID prefixes (`MEM-`, `WINV-`) are **proposed/reserved** by B1. They are **not** registered canonical B0 prefixes: `BACKEND_PUBLIC_ID_REGISTRY.md` is unmodified and contains neither. Registration (`B1-D-002`, `B1-D-003`) is part of the same controlled pre-implementation amendment bundle, together with the membership partial-unique refinement to `BACKEND_DATA_MODEL.md` (`B1-D-021`). **No implementation may mint `MEM-*` or `WINV-*` until that bundle is applied.**

B1 is design-only and grants no implementation authorization.

## B2 — CRM domain target design (additive; B0 and B1 unchanged)

`Docs/backend/B2/` holds the B2 CRM domain target-design package. It is **additive**: it modifies no frozen B0 or B1 file. B0 remains closed at `261ec27f84f337be0d9318141de260c8b9058a6b` and B1 at `062975e3e6aa6ee314097a9a457f6383ebd56557`.

B2 declares **11 controlled amendments** to frozen B0/B1 artifacts, all decided and all requiring CTO approval **before implementation**; B2 applies none. See `Docs/backend/B2/B2_CONTROLLED_AMENDMENTS.md`. B2's bundle depends on B1's `B1-D-002` (registering `MEM-`) and must be applied after or together with it.

| Frozen artifact | B2 target | Decision |
|---|---|---|
| `BACKEND_PUBLIC_ID_REGISTRY.md` | register `NOTE-` (Note) in section A | `B2-D-B001` |
| `BACKEND_DATA_MODEL.md` | add `notes`, `lead_tags`, `lead_provenance`, `lead_provenance_additional_jobs`, `crm_activities`; make the conversion constraint a partial unique index | `B2-D-B002` |
| `BACKEND_OPENAPI_V1.yaml` + `BACKEND_API_CATALOG.md` | add 25 additive CRM operations and the named filter/sort allow-list for `GET /leads` and `GET /tasks` | `B2-D-B003`, `B2-D-B009` |
| B1 `B1_AUTHORIZATION_RBAC.md` | add the `lead.archive` permission and one matrix row; no existing cell changes | `B2-D-B004` |
| `BACKEND_OPENAPI_V1.yaml` | `X-Lead-Conversion-Outcome` response header; additive `Lead360.notes` | `B2-D-B005`, `B2-D-B008` |
| `BACKEND_COMMAND_EVENT_CATALOG.md` | record `LeadUpdated` as superseded by three field-specific events | `B2-D-B010` |
| B1 `B1_API_DTO_CONTRACTS.md` | extend the closed `409 CONFLICT` reason vocabulary with 8 CRM reasons; **no new error code** | `B2-D-B011` |

| Document | Purpose |
|---|---|
| `Docs/backend/B2/B2_CRM_DOMAIN_BLUEPRINT.md` | scope, B0/B1 inheritance, design principles, the 18 CRM invariants |
| `Docs/backend/B2/B2_BASELINE_GAP_ANALYSIS.md` | the 78-behavior frontend CRM truth inventory and the 28-row gap matrix |
| `Docs/backend/B2/B2_DOMAIN_OWNERSHIP.md` | one durable owner per CRM fact; boundaries against seven domains |
| `Docs/backend/B2/B2_LEAD_AGGREGATE.md` | Lead schema, field classification, tags, activity dates, contacted semantics |
| `Docs/backend/B2/B2_LEAD_PROVENANCE_DUPLICATION.md` | origin model, provenance snapshot, duplicate policy, conversion workflow |
| `Docs/backend/B2/B2_CONTACT_MODEL.md` | Contact identity, Lead/Business relationships, PII posture, duplicates |
| `Docs/backend/B2/B2_TASK_APPOINTMENT_MODEL.md` | Task and Appointment aggregates, derived overdue, non-blocking overlap |
| `Docs/backend/B2/B2_NOTE_ACTIVITY_TIMELINE.md` | Note aggregate, timeline authority, safe summaries |
| `Docs/backend/B2/B2_CRM_ACTIVITY_VOCABULARY.md` | **[B2-FIX.1]** Canonical 21-type activity vocabulary; every command mapped to one type or to **NO TIMELINE ACTIVITY ROW** with a reason |
| `Docs/backend/B2/B2_REDISCOVERY_PROVENANCE_PROCESS.md` | **[B2-FIX.4.1]** `RecordLeadRediscoveryProvenance` — the deterministic writer for `lead_provenance_additional_jobs`: ordered guards, transaction boundary, idempotency, concurrency, replay, B3 producer contract, and the **future-skew admission rule delegated to the canonical `processing_reference_time`** of `B2_TIMELINE_IDENTITY_MODEL.md` §5.2.1 |
| `Docs/backend/B2/B2_TIMELINE_IDENTITY_MODEL.md` | **[B2-FIX.4]** Entry identity, immutable `occurred_at`, total ordering, cursor contract, read-time deduplication, the bounded clock-skew eligibility policy, the **`last_activity_at` recovery contract** (§5.5 — processing states, acknowledgement semantics, bounded retry, dead-letter and replay), the cross-domain source contract, and the ten-step retrieval algorithm |
| `Docs/backend/B2/B2_CRM_LIST_QUERY_MODEL.md` | `GET /leads`: filters, search, sorting, stable cursor pagination |
| `Docs/backend/B2/B2_LEAD360_READ_MODEL.md` | `GET /leads/{id}/360` section-by-section authority |
| `Docs/backend/B2/B2_STATE_MACHINES.md` | Lead, Task, Appointment, Contact, Note state machines |
| `Docs/backend/B2/B2_CONCURRENCY_IDEMPOTENCY.md` | 20-race matrix and idempotency classification |
| `Docs/backend/B2/B2_API_DTO_CONTRACTS.md` | 28 operations, request/response DTOs, validation, query allow-lists |
| `Docs/backend/B2/B2_COMMAND_EVENT_CATALOG.md` | 22 commands, 22 emitted events, 9 consumed contracts, 1 inbound process, payload and outbox rules |
| `Docs/backend/B2/B2_AUTHORIZATION_ENTITLEMENT.md` | CRM permissions, entitlement and `leads` quota boundary |
| `Docs/backend/B2/B2_ERROR_CONTRACT.md` | 16 reused codes, zero new codes, the `CONFLICT` reason vocabulary |
| `Docs/backend/B2/B2_PRIVACY_AUDIT_MODEL.md` | CRM data classification, PII rules, 24 audit actions |
| `Docs/backend/B2/B2_FAILURE_SCENARIOS.md` | CF1–CF24 end-to-end failure scenarios |
| `Docs/backend/B2/B2_ACCEPTANCE_TEST_MATRIX.md` | 281 deterministic acceptance criteria across 41 categories |
| `Docs/backend/B2/B2_FRONTEND_TRACEABILITY.md` | frozen frontend behavior to B2 target authority |
| `Docs/backend/B2/B2_DECISION_REGISTER.md` | Class A/B/C decision register — 27 Class A closed, 11 Class B, 19 Class C |
| `Docs/backend/B2/B2_CONTROLLED_AMENDMENTS.md` | every frozen-artifact change B2 requires |
| `Docs/backend/B2/B2_IMPLEMENTATION_READINESS.md` | readiness gates and recomputed consistency evidence |

B2-FIX.1 repaired three architectural defects found by independent audit — contradictory activity vocabulary, an unwritten provenance table, and an under-specified timeline identity — adding three documents and four Class A decisions (`B2-D-A023`…`B2-D-A026`). It added **no** new frozen-artifact amendment: the bundle remains 11 items.

B2-FIX.2 repaired five MAJOR defects found by a second independent audit, all in the cross-domain timeline contract. It locks `CROSS_DOMAIN_TIMELINE_MODEL = READ_TIME_MERGE`: CRM persists `crm_activities` for its own actions and persists **nothing** for cross-domain entries, which are constructed from the owning domain's records during retrieval. Identity, deduplication, and clock-skew eligibility are therefore read-path properties evaluated by one ten-step algorithm. It **added no document and no frozen-artifact amendment** — the bundle remains 11 items — and it reverted B2's accidental widening of the frozen B0 event envelope rather than registering a 12th item.

B2-FIX.3 repaired the single MAJOR defect left by a third independent audit: recovery of the persisted `last_activity_at` column after a future-clock-skew rejection was asserted rather than guaranteed. At-least-once delivery does not redeliver a message the consumer has already acknowledged, so a rejected-then-acked event could leave the column permanently stale. `B2-D-A027` makes a future-skew rejection a **retryable processing failure that is never acknowledged as successful**, with exactly three processing states (`ELIGIBLE`, `RETRY_PENDING`, `DEAD_LETTERED`), a bounded retry that binds to frozen B0 `BACKEND_RETRY_POLICY.md` without re-freezing any number, and an alerted, identity-preserving, idempotent replay path. It **added no document and no frozen-artifact amendment** — the bundle remains 11 items — reopened none of the locked read-time-merge architecture, and introduced **no CRM quarantine aggregate**. The retry scheduler, dead-letter store, and replay tooling are a recorded forward dependency on **B12 — Async & Integration Platform** and are not designed in B2.

B2-FIX.4 repaired the two MAJOR defects a post-FIX.3 adversarial audit found, both in persisted `last_activity_at` correctness. **First**, the consumer's eligibility clock was described as an at-receipt `ingested_at` evaluated "once, at ingestion" — under which skew never shrinks and the automatic-retry recovery path was unreachable; `B2_TIMELINE_IDENTITY_MODEL.md` §5.2.1 now defines one canonical `processing_reference_time` sampled afresh at the start of every processing attempt, distinct from immutable ingestion metadata. **Second**, FIX.2's revert of the `aggregate version` envelope widening was incomplete: `B2_COMMAND_EVENT_CATALOG.md` §3 rule 7 still required it and told consumers to discard out-of-order deliveries — which on the recovery path would drop the recovered event itself. Rule 7 is replaced by the `GREATEST()`-only order model, so `EVENT_ENVELOPE_DRIFT_FROM_B0` is genuinely 0. It added no document and no amendment; the bundle remains 11 items.

B2-FIX.4.1 closed the one MAJOR defect the independent post-FIX.4 countersign found: FIX.4's eligibility-clock repair had not reached `B2_REDISCOVERY_PROVENANCE_PROCESS.md`, whose §2.5 still compared a future-dated `discovered_at` against "the ingestion instant" — a first-receipt stamp `B2_TIMELINE_IDENTITY_MODEL.md` §5.2.1 forbids — so B2 carried two reference times for one admission rule and a future-skewed rediscovery event could lose its provenance row permanently. §2.5 now delegates to the canonical `processing_reference_time` sampled afresh per processing attempt and defines no clock of its own, so exactly one clock model exists in B2. `AT-DUP-5J` is the regression guard (acceptance criteria 280 → 281, categories unchanged at 41). It added no document, no decision, and no amendment; the bundle remains 11 items.

One public-ID prefix (`NOTE-`) is **proposed/reserved** by B2. It is **not** a registered canonical B0 prefix: `BACKEND_PUBLIC_ID_REGISTRY.md` is unmodified and classifies `NOTE-` in section B. **No implementation may mint `NOTE-*`, enforce `lead.archive`, or ship any B2-additive operation until the amendment bundle is applied.**

B2 is design-only and grants no implementation authorization.

## B3 — Discovery & Acquisition target design — **DESIGN IN PROGRESS**

> **B3 is NOT closed.** It is uncommitted and awaits an independent CTO audit. Nothing below is approved, and no implementation may act on it.

`Docs/backend/B3/` holds the B3 Discovery & Acquisition target-design package — 26 documents. It is **additive**: it modifies no frozen B0, B1, or B2 file. B0 remains closed at `261ec27f84f337be0d9318141de260c8b9058a6b`, B1 at `062975e3e6aa6ee314097a9a457f6383ebd56557`, and B2 at `24643397254caac4117320df756d8bc164882635`.

B3 covers the first two hops of the product journey — Discovery request → Discovery Job → Business Result — and stops there. `BUS-* → LEAD-*` remains **B2's frozen hop**, and B0's "no Lead auto-create" prohibition is enforced structurally: B3 has no write path into any CRM table.

B3 declares a **7-operation, 4-decision amendment bundle** across **4 frozen artifacts** (corrected in B3-FIX.1 from a prior "6 items across 3 artifacts" undercount), all decided and all requiring CTO approval **before implementation**; B3 applies none. See `Docs/backend/B3/B3_CONTROLLED_AMENDMENTS.md`. B3's bundle is independent of B1's, and independent of B2's **except for `BACKEND_API_CATALOG.md`**, which B2's item 3 and B3's item 5 both extend — B3's amendment there must be applied against the POST-B2 effective text, never the pre-B2 frozen bytes, or it silently reverts B2's `GET /leads`/`GET /tasks` addition (`B3_CONTROLLED_AMENDMENTS.md` §6).

| Frozen artifact | B3 target | Decision |
|---|---|---|
| `BACKEND_OPENAPI_V1.yaml` | `DiscoveryJobCreate` gains `keywords[]`/`locations[]`/`filters`/`result_limit`, **required** unless `query` is supplied alone; `query` retained as a deprecated single-combination alias with a fully deterministic compatibility rule; `provider_source` remains **optional**, unchanged from frozen; `DiscoveryJob` and `DiscoveryResult` gain additive fields; 5 additive operations | `B3-D-B001` |
| `BACKEND_API_CATALOG.md` | extend the `filters`/`sort` allow-list with `GET /api/v1/discovery/jobs`, applied against the POST-B2 effective sentence so `GET /leads`/`GET /tasks` (B2) are preserved | `B3-D-B003` |
| `BACKEND_DATA_MODEL.md` | add `discovery_query_executions, provider_page_ingestions, business_match_candidates, business_merges, discovery_sources`; make the identity uniqueness precise as `(workspace_id, provider, provider_external_id)` | `B3-D-B002` |
| `BACKEND_COMMAND_EVENT_CATALOG.md` | add the command `CancelDiscoveryJob` and the events `DiscoveryJobCancelled` and `BusinessRediscovered`; **the event envelope is unchanged** | `B3-D-B005` |

Key B3 decisions: **one Business per real-world business per workspace**, identified by `(workspace_id, provider, provider_external_id)` with many identities allowed per Business, and an append-only `discovery_results` provenance row per observation — replacing the prototype's single `discoveryJobId` scalar, which cannot express rediscovery and would make B2's frozen `lead_provenance_additional_jobs` contract unimplementable. **Five job states**, not six: partial success is a `completion_kind` on a `completed` job, because a sixth state would be unreachable behind the frozen frontend's `status === "completed"` results gate. **Results are visible only while a job is `completed`** — persistence during execution is not visibility. **Cross-provider auto-linking requires two independent strong signals**; name similarity never merges anything, at any threshold. **`discovered_at` is WazLink's trusted server clock**, never a provider timestamp, which makes B2's future-skew rejection branch structurally unreachable at the source while B2's own defence still runs. **One `discoveryRuns` unit per admitted job**, never re-charged by retry — but retry is architecturally bounded regardless, by two independent counters: **`MAX_JOB_ATTEMPTS = 3`** per Job (one initial execution plus at most two actor-triggered retries, `B3-D-A031`) and **`MAX_ACTOR_RETRY_REQUESTS_PER_WORKSPACE_PER_HOUR = 10`** workspace-wide (`B3-D-A032`, B3-FIX.2), so neither a single-job cancel/retry loop nor a burst of retries across many accumulated jobs can become an unbounded provider-cost loop. Every provider path is bounded: **≤ 250 provider calls per job attempt**, **≤ 750 per Job** across every actor attempt, **≤ 4,500 absolute call attempts per Job** once frozen B0's automatic transient retry is included, and **≤ 30,000 absolute call attempts/hour/workspace** as an explicitly **admission-based** (not wall-clock) bound derived from at most 20 actor-admitted Job attempts per workspace per rolling hour (10 creates + 10 retries).

B3 satisfies B2's frozen consumed contract 9 with a dedicated **`BusinessRediscovered`** event carrying exactly B2's four fields and nothing more, emitted without reading CRM state so the dependency direction is never inverted; B2's own guards discard what does not apply.

B3 mints **no new public-ID prefix** (`JOB-`, `RES-`, `BUS-` are already registered in section A), **no new permission code** (`discovery.run/view/export` already exist in B1), and **no new error code** (`ERROR_NEW_COUNT = 0`). Nine external-validation items (`B3-X-001`…`B3-X-009`) record provider and legal facts B3 must not invent — Google Places identifiers, field masks, pricing, rate-limit signalling and terms; the scraping provider contract; raw-payload retention; Saudi personal-data obligations; and the lawful basis for outbound use of acquired contacts. **No document in this package makes a legal compliance claim.**

B3 is design-only and grants no implementation authorization.

## B4 — AI Lead Intelligence target design — **DESIGN IN PROGRESS**

> **B4 is NOT closed.** It is uncommitted and awaits an independent CTO audit. Nothing below is approved, and no implementation may act on it.

`Docs/backend/B4/` holds the B4 AI Lead Intelligence target-design package — 30 documents. It is **additive**: it modifies no frozen B0, B1, B2, or B3 file. B0 remains closed at `261ec27f84f337be0d9318141de260c8b9058a6b`, B1 at `062975e3e6aa6ee314097a9a457f6383ebd56557`, B2 at `24643397254caac4117320df756d8bc164882635`, and B3 at `9a99019576943dffd5d52e6d747fefd7f7d538ec`.

B4 sits between B3 (Discovery & Acquisition) and B2 (CRM/Lead 360): it converts a normalized Business into a five-component score, an independent confidence measure, evidence-backed signals, and a structured recommendation — never a copy of Business or Lead truth, never an executed action. It resolves the one open cross-domain question both B2 (`B2-D-B006`) and B3 (`B3-D-C011`) explicitly deferred to this phase: **intelligence attaches to Business, not Lead** — Lead 360 reads it live, keyed on `lead.business_id`, and never caches it, matching the frozen frontend's own explicit UI copy (`Lead360.tsx`).

B4 declares a **5-operation, 5-decision amendment bundle** across **3 frozen packages**, all decided and all requiring CTO approval **before implementation**; B4 applies none. See `Docs/backend/B4/B4_CONTROLLED_AMENDMENTS.md`. Two items are non-additive, stated plainly rather than buried: frozen `lead_intelligence_analyses` is renamed and re-keyed to `intelligence_runs` (Business-keyed), and frozen event `LeadIntelligenceCompleted` is not emitted, superseded by additive `BusinessIntelligenceCompleted` — `AnalyzeLead` is retained as a thin, redefined Lead-context alias. B4's bundle was checked against B2's and B3's own amendment bundles for artifact overlap and found to collide with neither.

| Frozen artifact | B4 target | Decision |
|---|---|---|
| `BACKEND_DATA_MODEL.md` | rename `lead_intelligence_analyses` → `intelligence_runs`, re-key `lead/input_fingerprint` → `business_id/input_hash` | `B4-D-A001` |
| `BACKEND_DOMAIN_OWNERSHIP.md` | rename the Intelligence aggregate `LeadIntelligenceAnalysis` → `IntelligenceRun`, `BUS-*`-owned; port name `AI Gateway` kept unchanged | `B4-D-A002` |
| `BACKEND_COMMAND_EVENT_CATALOG.md` | `AnalyzeLead` retained as a redefined Lead-context alias; `LeadIntelligenceCompleted` superseded by additive `BusinessIntelligenceCompleted`; additive `RequestBusinessIntelligence`, `ReanalyzeBusinessIntelligence`, `CancelIntelligenceRun`, `IntelligenceRunFailed`, `IntelligenceRunCancelled` | `B4-D-A027` |
| `B1_AUTHORIZATION_RBAC.md` | add `intelligence.view`, `intelligence.run` — no existing B1 code covers this domain | `B4-D-A029` |
| `BACKEND_PUBLIC_ID_REGISTRY.md` | reclassify `ANL-*` from §B (embedded-only) to §A (independently addressable) — not a new prefix | (data-model consequence of `B4-D-A001`) |

Key B4 decisions: the **deterministic-first hard rule** — a fact the local data already proves reliably is never sent to a provider merely to restate it; the provider is called only for genuine judgement (e.g. website-quality) or presentation prose, and every response is validated against a strict, closed JSON schema before it can touch domain truth — no free-form provider output ever mutates a `Signal`, `Score`, or `Recommendation`. **Insufficient evidence is a first-class outcome**, not a forced low tier: `score=null`, no recommendation, an explicit reason code. **Confidence is independent of score** — a high score with low confidence, and the reverse, are both representable. **`IntelligenceRun` is immutable history**; the "current" pointer only ever advances to a strictly newer input snapshot, so a stale completion can never silently overwrite newer truth. B4 adopts frozen B0's own **"AI analysis — 60/hour/workspace"** verbatim (`B4-D-A017`) and closes, in this same pass rather than a later fix cycle, the exact class of gap an independent audit found in B3's retry model: a hard **20-item cap per batch-analyze request** (`B4-D-A019`) and a **3-attempt automatic transient-retry bound per run** (`B4-D-A018`), kept structurally distinct from the workspace admission counter. There is **no automatic/eager analysis trigger** in Phase 1 — every run is actor-initiated, closing the automatic-trigger-storm attack by construction.

B4 needs **zero consumed events** — freshness and admissibility are computed from a direct, synchronous read of B3's own tables, not from event delivery, the strongest form of "no circular dependency" this corpus has stated. B4 never writes a B3 or B2 table. It never sends a message, creates a Deal, or triggers automation — it recommends, and every downstream domain (B5, B6, B7) decides independently whether to act; a future automation consumer may key only on versioned structured codes, never on prose. **No B4 field, event, or write path ever implies recognized or attributed revenue.**

B4 mints **no new public-ID prefix** (`ANL-*` is reclassified, not invented), proposes **two new permission codes** (`intelligence.view`, `intelligence.run` — the first domain in this corpus with no reusable permission family), and **no new error code** (`NEW_ERROR_CODES = 0`). Eleven external-validation items (`B4-X-001`…`B4-X-011`) record provider and legal facts B4 must not invent — the chosen provider's structured-output mechanism, supported models, token limits, retention/data-usage terms, and Saudi data-residency implications inherited from B3's own unresolved `B3-X-008`. **No document in this package makes a legal compliance claim.**

The frozen frontend's separate "S8 Sales Copilot / governed Agent" subsystem (`sales-ai.js`) was traced and found real, but is explicitly **out of B4's scope** — it needs Lead, Conversation, Deal, and Task simultaneously, none of which except Lead exist as designed backend domains yet, and is recorded as a forward dependency (`B4-D-C002`) rather than designed here.

B4 is design-only and grants no implementation authorization.

## B5 — Messaging & WhatsApp target design — **DESIGN IN PROGRESS**

> **B5 is NOT closed.** It is uncommitted and awaits a fresh independent CTO audit. Nothing below is approved, and no implementation may act on it.
>
> **`B5-FIX.1` applied.** A first independent CTO audit found `B5_VERIFICATION = FAIL` (1 MAJOR — an RBAC/permission-catalog misstatement about frozen `B1_AUTHORIZATION_RBAC.md`; 3 MINOR — count-arithmetic errors, failure-scenario coverage gaps, acceptance-test negative-control tagging gaps; 2 INFO). This section reflects the state **after** remediation. See `Docs/backend/B5/B5_IMPLEMENTATION_READINESS.md` §4.2 for the itemized repair record.

`Docs/backend/B5/` holds the B5 Messaging & WhatsApp target-design package — 36 documents. It is **additive**: it modifies no frozen B0, B1, B2, B3, or B4 file. B0 remains closed at `261ec27f84f337be0d9318141de260c8b9058a6b`, B1 at `062975e3e6aa6ee314097a9a457f6383ebd56557`, B2 at `24643397254caac4117320df756d8bc164882635`, B3 at `9a99019576943dffd5d52e6d747fefd7f7d538ec`, and B4 at `0bd6f2095ac14f1c62ff9dc98f497bba4acf3a5a`.

B5 sits between B2 (CRM/Lead 360) and the future B6 (Pipeline/Deals) and B7 (Automation): it converts a governed send decision into a durable, auditable WhatsApp message exchange, and exposes it to CRM as a live, non-authoritative read — never a copy of Lead/Contact truth, never an executed action outside its own transport. Conversation identity is **Lead-keyed**, not Business-keyed and not phone-keyed — the frozen frontend already keys every Conversation on `leadId`, and B2's own frozen cross-domain timeline contract (`B2_TIMELINE_IDENTITY_MODEL.md`) independently requires it. Exactly one reusable Conversation exists per `(workspace, channel, lead, phone)`; a closed fixture inconsistency (two simultaneously-open conversations for one Lead+contact+channel) is resolved explicitly rather than copied forward, using `reopenConversation`'s own existence as the deciding evidence.

B5 declares a **6-operation, 5-decision amendment bundle** across **5 frozen packages**, all decided and all requiring CTO approval **before implementation**; B5 applies none. See `Docs/backend/B5/B5_CONTROLLED_AMENDMENTS.md`. Every item is additive or a compatible refinement — unlike B4, B5 has no non-additive rename/re-key to make, because frozen B0's Messaging row (`Conversation`; `conversations, participants, messages, deliveries`; `SendMessage`/`ReceiveMessage`/`MessageSent`/`MessageReceived`) already matches B5's target shape.

| Frozen artifact | B5 target | Decision |
|---|---|---|
| `BACKEND_DATA_MODEL.md` | extend the Messaging table-group list with `message_media`, `template_definitions`, `communication_consents`, `channel_bindings`, `messaging_usage_records`; sharpen `provider_message_id` uniqueness to per-`channel_binding` | (consequence of `B5-D-A001`/`B5-D-A032`) |
| `BACKEND_COMMAND_EVENT_CATALOG.md` | `SendMessage`/`ReceiveMessage` retained and fully specified; `MessageSent`/`MessageReceived`/`MessageDelivered`/`MessageFailed` retained and specified; 10 additive commands, 4 additive events | (consequence of `B5_COMMAND_EVENT_CATALOG.md`) |
| `BACKEND_RATE_LIMIT_POLICY.md` | add `Messaging send — 300/hour/workspace plus quota`, key `workspace` — no messaging row exists in the frozen policy today | `B5-D-A028` |
| `B1_AUTHORIZATION_RBAC.md` | **REUSE** `conversation.view` and `message.send` verbatim, unchanged — both already exist in this frozen file (`message.send` traces further to frozen B0's `BACKEND_AUTHORIZATION_MATRIX.md` row 23); **add only** `messaging.manage`, `messaging.provider.manage`. (`B5-FIX.1` correction — the original pass incorrectly claimed this file had no `conversation.*`/`messaging.*` row and proposed adding all four as new) | `B5-D-A034` |
| `BACKEND_PUBLIC_ID_REGISTRY.md` | register `TPL-` (`TemplateDefinition`) — genuinely new, collision-checked against all 56 classified prefixes | (consequence of `B5-D-A019`) |

Key B5 decisions: **business truth and provider transport state are separated** — `Message` holds what was authored; `MessageDelivery` holds what the network did with it, because the frozen fixture's own inbound `status:"received"` value already disproves a single shared status enum across directions. **Webhook authenticity is unconditional** — every inbound POST is signature-verified before any processing, sync or async, and workspace resolution comes only from *which binding's secret verified*, never from any field inside the payload. **Opt-out is absolute** — no override path exists at any privilege level, including provider-credential administration. An ambiguous provider timeout never triggers a blind resend; it holds in an explicit `submitted` state until bounded reconciliation resolves it. Cancellation never refunds the workspace admission counter — deliberately stricter than B4's own release-on-cancel pattern, because B5's ceiling is request-volume-shaped, not purely provider-cost-shaped, and copying B4's rule verbatim would reopen the exact spend-loop attack it exists to close.

B5 needs **zero consumed events** — every cross-domain dependency (Lead/Contact resolution, Business/Intelligence context) is a synchronous, on-demand read of another domain's own contract, mirroring B4's identical "no circular dependency" precedent one phase forward. B5 never writes a B2, B3, or B4 table, and never writes `crm_activities` directly — it exposes a stable `source_event_id` satisfying `B2_TIMELINE_IDENTITY_MODEL.md`'s frozen cross-domain contract exactly, and B2 projects it at read time. It never creates a Deal, changes a PipelineStage, or triggers automation — a future B7 automation send must reuse the identical governed `SendMessage` command every human actor uses, with no second transport path. **No B5 field, event, or write path ever implies recognized or attributed revenue.**

B5 mints **one new public-ID prefix** (`TPL-` — genuinely new, not a reclassification), **reuses two frozen permissions verbatim** (`conversation.view`, `message.send` — both already exist in `B1_AUTHORIZATION_RBAC.md`) and proposes **two new permission codes** (`messaging.manage`, `messaging.provider.manage` — the first domain in this corpus needing a three-tier permission shape, because credential handling is materially higher-trust than ordinary sending), and **no new error code** (`NEW_ERROR_CODES = 0`). Eighteen external-validation items (`B5-X-001`…`B5-X-018`) record provider and legal facts B5 must not invent — Meta's Cloud API schemas, webhook signature scheme, template taxonomy, media flow, customer-service-window duration, throughput/quality-rating limits, and Saudi data-residency implications inherited from B3's and B4's own unresolved `B3-X-008`/`B4-X-008`. **No document in this package makes a legal compliance claim.**

The frozen frontend's S8 Sales Copilot messaging touchpoints (`CopilotPanel.tsx`) were traced and found to already demonstrate the exact governance boundary B5 depends on: a Copilot-drafted reply is staged into the composer only, and explicitly does not create a message — *"أُدرج الرد المقترح في Composer فقط؛ لم تُنشأ أي رسالة"*. Which future domain owns generating that draft text is recorded as a forward dependency (`B5-D-C009`) rather than designed here, because B5's send-governance boundary does not depend on the answer.

B5 is design-only and grants no implementation authorization.

## B6 — Pipeline & Deals target design — **DESIGN IN PROGRESS**

> **B6 is NOT closed.** It is uncommitted and awaits an independent CTO audit. Nothing below is approved, and no implementation may act on it.

`Docs/backend/B6/` holds the B6 Pipeline & Deals target-design package — 35 documents. It is **additive**: it modifies no frozen B0, B1, B2, B3, B4, or B5 file. B0 remains closed at `261ec27f84f337be0d9318141de260c8b9058a6b`, B1 at `062975e3e6aa6ee314097a9a457f6383ebd56557`, B2 at `24643397254caac4117320df756d8bc164882635`, B3 at `9a99019576943dffd5d52e6d747fefd7f7d538ec`, B4 at `0bd6f2095ac14f1c62ff9dc98f497bba4acf3a5a`, and B5 at `c18cf7947ee320ea4b7b766e3cf7bdda4d6c44c0`.

B6 sits between B2 (CRM/Lead 360) and the future B7 (Automation) and B9 (Finance/Revenue): it converts a governed sales decision into a durable, auditable commercial-opportunity record — `Lead → Deal → Pipeline → Stage progression → Won/Lost` — and exposes it to CRM as a live, non-authoritative read. Unlike B3/B4/B5, frozen B0 already named the Pipeline domain, its table group, four commands, four events, a coarse state machine, a Deal DTO sketch, three public-ID prefixes (`DEAL-`, `PIPE-`, `STG-`), Deal RBAC permissions with their full role matrix, and the revenue-separation ADR before B6 existed — B6's task was predominantly specifying and hardening an already-frozen skeleton, not inventing one.

B6 declares a **2-operation, 2-decision amendment bundle** across **2 frozen packages** — the smallest of any phase in this corpus so far — all decided and all requiring CTO approval **before implementation**; B6 applies none. See `Docs/backend/B6/B6_CONTROLLED_AMENDMENTS.md`.

| Frozen artifact | B6 target | Decision |
|---|---|---|
| `BACKEND_STATE_MACHINES.md` | add two edges, `DealWon → DealOpen` and `DealLost → DealOpen`, via a new `ReopenDeal` command — the existing `DealOpen → DealWon`/`DealOpen → DealLost` edges and their "probability 100/0" prose are untouched | `B6-D-A014` |
| `B2_LEAD_AGGREGATE.md` | add `DealReopened` to the frozen `last_activity_at` qualifying-event list for the Pipeline source row (`DealAssigned`/`DealUpdated` deliberately excluded) | (consequence of `B6-D-A014`) |

Key B6 decisions: **`DEAL-`/`PIPE-`/`STG-` are already-registered frozen prefixes**, reused verbatim — B6 mints no new public-ID prefix. **The frozen Deal DTO field is `value`, not `amount`** — B6 does not invent a second name for the identical concept. **`deal.view`/`deal.create`/`deal.update`/`deal.close` are reused verbatim** from frozen `B1_AUTHORIZATION_RBAC.md`, checked against the frozen text first; three permissions are genuinely new (`deal.assign`, `deal.reopen`, `pipeline.manage`). **Won/Lost are Deal-level terminal outcomes (`Deal.status`), never configurable `PipelineStage` rows** — resolving an ambiguity the frozen sketch and the frontend mock both left open. **`Deal.business_id` is a derived snapshot of `Lead.business_id`**, never an independent relationship, reconciling the frozen Deal DTO against frozen Doctrine R-2's `Deal → Lead, Pipeline, Stage` relationship list without contradicting either.

> **WON DEAL ≠ RECOGNIZED REVENUE.** B6 has zero write path to `revenue_events`/`revenue_reversals`/`attribution_touchpoints`; `CloseDealWon` cannot and does not emit `RevenueRecognized` — restated verbatim from frozen `BACKEND_ARCHITECTURE_DECISIONS.md` ADR-007 and `BACKEND_COMMAND_EVENT_CATALOG.md`, both of which predate B6. See `Docs/backend/B6/B6_REVENUE_FIREWALL.md` for the structural proof and five required negative-control tests.

B6 needs **zero consumed events** — every cross-domain dependency (Lead resolution) is a synchronous, on-demand read of B2's own contract, mirroring B4's and B5's identical "no circular dependency" precedent, now three phases running. B6 never writes a B1, B2, B4, or B5 table, and never writes `crm_activities` directly — it exposes a stable `source_event_id` satisfying `B2_TIMELINE_IDENTITY_MODEL.md`'s frozen cross-domain contract, which already names `pipeline` as an eligible source domain gated by `deal.view` before B6 existed to fulfill it. It never creates a Message or mutates Conversation state — sending from Deal context reuses B5's unmodified `SendMessage`. A future B7 automation Deal mutation must reuse the identical governed commands every human actor uses, with no second transport path.

B6 mints **zero new public-ID prefixes** (`DEAL-`, `PIPE-`, `STG-` already registered), **reuses four frozen permissions verbatim** (`deal.view`, `deal.create`, `deal.update`, `deal.close`) and proposes **three new permission codes** (`deal.assign`, `deal.reopen`, `pipeline.manage`), and **no new error code taxonomy** — only new `code` values within the existing envelope. B6 requires **no external validation register** — Pipeline/Deals is internal domain architecture with no provider dependency, the first phase since B1 not to need one. **No document in this package creates or authorizes recognized-revenue, payment, invoice, or billing truth.**

The frozen frontend's Deal/Pipeline surface (`features/sales/*.tsx`, 44 traced behaviors) was found to already state the revenue boundary explicitly, in four independent places including a dedicated "Revenue Boundary" sidebar card, and to already block deal-value/probability/close mutation from every AI (S8) and Automation (S9) code path in every mode. A stale, unreferenced legacy code path was found to use recognition-adjacent labeling and is explicitly flagged as non-evidence rather than cited. No reopen affordance exists in the frontend; B6 adds `ReopenDeal` anyway on this brief's own requirement, recorded honestly as a B6-authored addition rather than a misreading of frontend evidence.

B6 is design-only and grants no implementation authorization.

## B7 — Automation target design — **DESIGN IN PROGRESS**

> **B7 is NOT closed.** It is uncommitted and awaits an independent CTO audit. Nothing below is approved, and no implementation may act on it.

`Docs/backend/B7/` holds the B7 Automation target-design package — 50 documents. It is **additive**: it modifies no frozen B0, B1, B2, B3, B4, B5, or B6 file. B0 remains closed at `261ec27f84f337be0d9318141de260c8b9058a6b`, B1 at `062975e3e6aa6ee314097a9a457f6383ebd56557`, B2 at `24643397254caac4117320df756d8bc164882635`, B3 at `9a99019576943dffd5d52e6d747fefd7f7d538ec`, B4 at `0bd6f2095ac14f1c62ff9dc98f497bba4acf3a5a`, B5 at `c18cf7947ee320ea4b7b766e3cf7bdda4d6c44c0`, and B6 at `33354c4b072a8e78370856c25b7afdeec5939169`.

B7 converts `trigger matched → conditions satisfied → actions planned` into governed invocations of other domains' own commands, with a durable, auditable, idempotent, loop-safe execution record — an orchestration domain, never an alternative authority for CRM, Discovery, AI, Messaging, Pipeline, Billing, Revenue, Tax, or Files. Unlike B3/B4/B5, frozen B0-B6 already anticipated B7 extensively: `RUN-*` was already a registered public-ID prefix, `AutomationRule` was already named as a versioned optimistic-concurrency DTO, `BACKEND_DATA_MODEL.md` already sketched the exact table group, B1 already froze three automation RBAC permissions with a full role matrix, B2 already named the exact five automation-invocable commands and the `system:automation` actor convention, and both B5 and B6 had already reserved schema-level actor-identity hooks anticipating B7 as a future caller of `SendMessage` and `MoveDealStage`. B7's task was predominantly specifying and hardening an already-anticipated skeleton, not inventing one.

B7 proposes a **5-item controlled amendment set — 4 additive, 1 compatible clarification, 0 non-additive** — across **4 frozen artifacts**: promoting the already-registered `AUTO-` prefix from registry §B to §A (minting no new namespace), extending two B2 event consumer-list cells (`AppointmentCompleted`/`AppointmentNoShowRecorded` gain "Automation"), adding three `AutomationRun` states alongside the frozen seven, reconciling the ownership matrix's abbreviated `AutomationCompleted` against the catalog's authoritative `AutomationRunCompleted`, and adding two tables (`automation_rule_revisions`, `automation_inbox_records`) to the frozen Automation table group. All five require CTO approval **before implementation**; B7 applies none. See `Docs/backend/B7/B7_CONTROLLED_AMENDMENTS.md`.

Key B7 decisions: **authority is delegated from a single named membership** — `automation_rule_revisions.activated_by_membership_id`, the member who activated the revision, re-resolved live at every invocation; no workspace-level permission exists or is invented, and `system:automation` is a caller identity for audit only. **`system:automation` is not superuser** — five independent structural guarantees (no second command path, and the invoked command's own RBAC/entitlement/validation/concurrency/idempotency guards all still run). **Automation may invoke exactly eight governed commands** through ten catalog actions (nine governed, one internal control) across B2 (five commands, already frozen as automation-invocable), B6 (`MoveDealStage` only), and B5 (`SendMessage`/`SendTemplateMessage`, one canonical send action under mandatory non-configurable human approval) — every other candidate action (closing/valuing a Deal, deleting a Lead, recognizing revenue) is explicitly excluded, not silently omitted. **Every `AutomationRun` binds to an immutable `AutomationRuleRevision`** — a later rule edit can never rewrite a historical execution's recorded definition. **Loop prevention combines lineage, same-rule suppression, a depth bound, and an execution budget** — deliberately more nuanced than the frozen frontend mock's own blunt "any automation-caused run is skipped" rule, because that rule would silently have blocked the legitimate downstream-causation case the brief itself requires to keep working.

> **AUTOMATION MUST NOT DIRECTLY MUTATE ANOTHER DOMAIN'S AUTHORITATIVE TABLES, AND MUST NEVER RECOGNIZE REVENUE.** B7 holds zero repository/write access to any table it does not itself own; every action maps to exactly one governed target-domain command, invoked through that domain's unmodified admission sequence. Zero B7-reachable code path writes `revenue_events`/`revenue_reversals`/`attribution_touchpoints`, even when the triggering event is `DealWon`. See `Docs/backend/B7/B7_DIRECT_WRITE_FIREWALL.md` and `Docs/backend/B7/B7_REVENUE_FIREWALL.md` for the structural proof and required negative-control tests.

B7 consumes **13 cross-domain events** (9 from B2 — two of them via its own proposed amendment — and 4 from B6) and produces **13 of its own, two of which are frozen names reused verbatim** — no B8/B9/B12 consumer is declared for any of them yet, matching the posture every earlier domain had before its own downstream phases existed. B7 mints **zero new public-ID prefixes** — it reuses the frozen `RUN-*` and proposes promoting the already-registered `AUTO-` — **reuses four frozen command/event names verbatim** (`CreateAutomationRule`, `ApproveAutomationRun`, `AutomationRunCreated`, `AutomationRunCompleted`), keeps the frozen `AutomationRun` state machine's seven state names and edges intact, **reuses three frozen permissions verbatim** (`automation.rule.view`, `automation.rule.manage`, `automation.run.approve`) with zero new permission codes, and **no new error-envelope shape** — only new `code` values within the existing taxonomy. **No document in this package creates or authorizes recognized-revenue, billing, or payment truth.**

The frozen frontend's Automation (S9) surface was found to explicitly self-describe as "a deterministic in-session simulation... not a Scheduler, Worker, or Queue" — this was taken as an explicit instruction to discard the mock's synchronous execution *mechanism* while treating its business signals (closed condition/action catalogs, mandatory approval for sensitive actions, dry-run testing, an explicit rule-version snapshot on every run, an explicit idempotency-key formula, and a named forbidden-action list) as strong evidence. The mock's own forbidden-action list names `send_message` and Deal-closing/valuing actions; B7 resolves `send_message` and `move_deal_stage` as included anyway, gated to mandatory human approval with no rule-level override, on the strength of reserved schema-level hooks B5 and B6 had independently pre-built for exactly this — recorded as a deliberate, explicitly-justified departure from the mock's own conservative default, not a misreading of it.

This package has been corrected three times, and each time a self-verification reported clean numbers that were not. A first pass repaired six frozen-B0 drifts its own matrix had scored as `B0_DRIFT = 0`, and removed a `scheduled` trigger and a `wait` action carrying zero frontend evidence. A **fresh independent CTO verification** then returned nine further MAJOR findings that pass had left — among them a Class-A contradiction between two storage models for rule definitions, the authorization principal stated three incompatible ways, the frozen `automationRuns` quota enforced nowhere against an invented `automation.rules.max_active`, two frozen error codes renamed, and a Phase-2 scope reduction declared but applied to only part of the pack. **`B7-FIX.1` remediated all nine plus eleven MINOR findings.** A **second fresh independent CTO verification** of that state then returned two further MAJOR findings and six MINOR: the event-run dedup identity was stated two incompatible ways across four documents while the constraint three of them relied on was never declared in the schema, and the Phase-2 scope reduction still left three live Phase-1 scheduling/wait references — including a B12 requirement for a wakeup sweep that one of B7's own negative controls simultaneously forbade. That verification also confirmed independently that the other eight earlier findings were genuinely closed, that B0-B6 drift was zero, and it adjudicated `B7-AM-003` **ADDITIVE** from the frozen state-machine document's own internal evidence. **`B7-FIX.2` remediates all eight**, adding three Class-A decisions (`B7-D-A040` dedup identity, `B7-D-A041` `skipped` terminal-event semantics, `B7-D-A042` run timestamp model) and one additive B7-owned event, `AutomationRunSkipped`. The before/after tables are in `Docs/backend/B7/B7_VERIFICATION_MATRIX.md` §7, §7a and §7b rather than silently overwritten. The remediated pack awaits a fresh independent countersign and remains **NOT CLOSED**.

B7 is design-only and grants no implementation authorization.

## Required next-phase gate

Before implementation, resolve all items marked `PRODUCT DECISION REQUIRED`, `REQUIRES OFFICIAL ZATCA VALIDATION`, or `REQUIRES PROVIDER CONTRACT VALIDATION`; approve the API/DTO/ERD/OpenAPI/identity documents as frozen; then authorize Backend Architecture-to-Coding transition explicitly. This package contains no implementation. B0-FIX.3 repairs are documentation/contract-only and do not self-close B0.

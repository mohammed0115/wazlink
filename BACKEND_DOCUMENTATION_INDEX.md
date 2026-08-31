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

B3 declares **6 controlled amendments** across **3 frozen artifacts**, all decided and all requiring CTO approval **before implementation**; B3 applies none. See `Docs/backend/B3/B3_CONTROLLED_AMENDMENTS.md`. B3's bundle is independent of B1's and B2's and may be approved in any order relative to them.

| Frozen artifact | B3 target | Decision |
|---|---|---|
| `BACKEND_OPENAPI_V1.yaml` | `DiscoveryJobCreate` gains `keywords[]`/`locations[]`/`filters`/`result_limit` with `query` retained as a deprecated single-combination alias; `DiscoveryJob` and `DiscoveryResult` gain additive fields; 5 additive operations | `B3-D-B001` |
| `BACKEND_API_CATALOG.md` | extend the `filters`/`sort` allow-list with `GET /api/v1/discovery/jobs` | `B3-D-B003` |
| `BACKEND_DATA_MODEL.md` | add `discovery_query_executions, provider_page_ingestions, business_match_candidates, business_merges, discovery_sources`; make the identity uniqueness precise as `(workspace_id, provider, provider_external_id)` | `B3-D-B002` |
| `BACKEND_COMMAND_EVENT_CATALOG.md` | add the command `CancelDiscoveryJob` and the events `DiscoveryJobCancelled` and `BusinessRediscovered`; **the event envelope is unchanged** | `B3-D-B004`, `B3-D-B005` |

Key B3 decisions: **one Business per real-world business per workspace**, identified by `(workspace_id, provider, provider_external_id)` with many identities allowed per Business, and an append-only `discovery_results` provenance row per observation — replacing the prototype's single `discoveryJobId` scalar, which cannot express rediscovery and would make B2's frozen `lead_provenance_additional_jobs` contract unimplementable. **Five job states**, not six: partial success is a `completion_kind` on a `completed` job, because a sixth state would be unreachable behind the frozen frontend's `status === "completed"` results gate. **Results are visible only while a job is `completed`** — persistence during execution is not visibility. **Cross-provider auto-linking requires two independent strong signals**; name similarity never merges anything, at any threshold. **`discovered_at` is WazLink's trusted server clock**, never a provider timestamp, which makes B2's future-skew rejection branch structurally unreachable at the source while B2's own defence still runs. **One `discoveryRuns` unit per admitted job**, never re-charged by retry. Every provider path is bounded, giving a computed worst case of **≤ 250 provider calls per job attempt**.

B3 satisfies B2's frozen consumed contract 9 with a dedicated **`BusinessRediscovered`** event carrying exactly B2's four fields and nothing more, emitted without reading CRM state so the dependency direction is never inverted; B2's own guards discard what does not apply.

B3 mints **no new public-ID prefix** (`JOB-`, `RES-`, `BUS-` are already registered in section A), **no new permission code** (`discovery.run/view/export` already exist in B1), and **no new error code** (`ERROR_NEW_COUNT = 0`). Nine external-validation items (`B3-X-001`…`B3-X-009`) record provider and legal facts B3 must not invent — Google Places identifiers, field masks, pricing, rate-limit signalling and terms; the scraping provider contract; raw-payload retention; Saudi personal-data obligations; and the lawful basis for outbound use of acquired contacts. **No document in this package makes a legal compliance claim.**

B3 is design-only and grants no implementation authorization.

## Required next-phase gate

Before implementation, resolve all items marked `PRODUCT DECISION REQUIRED`, `REQUIRES OFFICIAL ZATCA VALIDATION`, or `REQUIRES PROVIDER CONTRACT VALIDATION`; approve the API/DTO/ERD/OpenAPI/identity documents as frozen; then authorize Backend Architecture-to-Coding transition explicitly. This package contains no implementation. B0-FIX.3 repairs are documentation/contract-only and do not self-close B0.

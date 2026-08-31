# B2 — CRM Domain Design Blueprint

> **B2 status:** Target architecture and contracts only. Backend coding is not authorized. This package is normative for the future CRM implementation agent.

**B1 published baseline (frozen, CLOSED):** `062975e3e6aa6ee314097a9a457f6383ebd56557`
**B0 baseline (frozen, CLOSED):** `261ec27f84f337be0d9318141de260c8b9058a6b`
**Frozen frontend baseline:** `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`

**Scope.** Lead, Contact, Task, Appointment, Note, the CRM activity timeline, Business→Lead conversion, the CRM list read model, and the Lead 360 read model.

**Out of scope.** Discovery job execution, Business normalization, AI Intelligence scoring, Messaging, Pipeline/Deal, Revenue recognition, Attribution, Automation execution, Billing, Tax, Files. B2 defines only how CRM *references* those domains and how they reach the Lead timeline.

## 1. Relationship to B0 and B1

B2 inherits and never re-opens:

| Inherited invariant | Source | B2 treatment |
|---|---|---|
| Modular Django monolith, DRF, `/api/v1/` | B0 | inherited unchanged |
| PostgreSQL authoritative; Redis never canonical | B0 | every CRM race is decided by a row lock, a unique index, or an integer `version` |
| UUIDv7 internal id + immutable prefixed `public_id` (ADR-006) | B0 | `LEAD-`, `CON-`, `TSK-`, `APT-`, `ACT-` are already registered; `NOTE-` is **proposed/reserved** (§B2-D-B001) |
| Workspace is the tenant boundary | B0/B1 | every CRM table carries `workspace_id`; CRM-INV-1 |
| Authorization pipeline, 16 ordered steps | B1 §1 | reused verbatim; B2 adds no step and reorders none |
| Doctrines R-1 … R-4 (scope before existence, relationship injection, path/active agreement, mass assignment) | B1 §4 | reused verbatim; every CRM relationship is listed under R-2 |
| Deny-by-default RBAC, six roles, no authorization caching | B1 | reused; B2 proposes exactly **one** new permission (`lead.archive`) |
| Integer `version` + `If-Match`, `409 STALE_VERSION` (ADR-010) | B0/B1 | every mutable CRM resource carries `version` |
| `Idempotency-Key` HTTP **header**, single idempotency system | B0/B1 | no B2 request DTO carries a body-level idempotency field |
| Transactional outbox (ADR-005); no provider call inside a domain transaction | B0 | every CRM event is written to `outbox_events` in the mutating transaction |
| Immutable `audit_logs`, no secrets | B0/B1 | extended with CRM audit actions |
| Won Deal ≠ Recognized Revenue; Billing ≠ customer revenue | B0 | restated as CRM-INV-7 / CRM-INV-8 and enforced by ownership, not by convention |

**B0/B1 contradictions found: 0.** Every B2 construct is a materialization of an existing B0/B1 statement, an additive extension using a mechanism B0/B1 itself defines, or one of the controlled amendments enumerated in `B2_CONTROLLED_AMENDMENTS.md`. **B2 edits no frozen B0 or B1 file.**

## 2. Design principles

1. **The Lead is a decision record, not a copy.** A Lead records *that a human decided to pursue a Business*. It never copies the Business's attributes, the AI's score, the conversation's content, or the Deal's value. Every one of those is read by reference at render time. This is the single most load-bearing rule in the package and the frozen frontend states it in its own source comments (`Crm.tsx`, `Lead360.tsx`).
2. **One owner per business fact.** Exactly one domain may write each fact. Cross-domain facts reach the Lead timeline as *merged reads*, never as rows written into CRM tables.
3. **Read models own nothing.** `GET /leads`, `GET /leads/{id}/360`, and `GET /leads/{id}/timeline` are projections. They carry no independent truth, and no command mutates them directly.
4. **AI recommends; humans decide; CRM records.** No AI output ever becomes authoritative CRM state without an explicit human command (CRM-INV-12).
5. **Provenance survives its sources.** A Lead must still explain *where it came from* after the Business is re-crawled, the analysis is regenerated, or the Discovery Job is archived.
6. **Archive, never destroy.** CRM rows anchor Conversation, Deal, Revenue, Attribution, and Audit history. Deletion is archival.
7. **PostgreSQL decides duplicates.** One live Lead per Business per Workspace is a partial unique index, not an application check.
8. **No generic CRM.** Every state, field, filter, and command in this package traces to a behavior that exists in the frozen frontend or to an explicit B0/B1 contract obligation. Nothing is added because "a CRM usually has it"; what is absent is recorded as `NOT_SUPPORTED` with a reason.

## 3. CRM aggregates

| Aggregate | Root | Public ID | Authoritative table(s) | Registered in B0 registry? |
|---|---|---|---|---|
| **Lead** | Lead | `LEAD-` | `leads`, `lead_tags`, `lead_provenance` | ✔ section A |
| **Contact** | Contact | `CON-` | `contacts`, `lead_contacts` | ✔ section A |
| **Task** | Task | `TSK-` | `tasks` | ✔ section A |
| **Appointment** | Appointment | `APT-` | `appointments` | ✔ section A |
| **Note** | Note | `NOTE-` | `notes` | ✖ **section B — proposed/reserved by B2** (`B2-D-B001`) |

`CRM_AGGREGATE_COUNT = 5`. `crm_activities` (`ACT-*`) is an append-only subordinate record of the Lead aggregate, not an aggregate root: nothing addresses it by ID and nothing mutates it after write.

**`CMP-` (Company) is deliberately not modelled.** The frozen frontend creates a `CMP-*` row on conversion (`data.js` `convertBusinessToLead`), but `BACKEND_PUBLIC_ID_REGISTRY.md` classifies `CMP-` as a **section B fixture** and B0's CRM table group is `leads, contacts, lead_contacts, tasks, appointments` — no `companies`. A Company row that only mirrors `Business.name` adds a second name authority and a third hop between Lead and Business for no product behavior. Lead references Business directly (`B2-D-A004`).

## 4. The canonical journey

```
SRC-1004 ──▶ JOB-1028 ──▶ BUS-1042 ──▶ [ANL-1042/OPP-1042] ──▶ LEAD-1042 ──▶ CONV-3042 ──▶ DEAL-4042 ──▶ (REV-* only by explicit command)
 Discovery    Discovery     Business      Intelligence            CRM            Messaging      Pipeline        Revenue
  source        job          record        (read-only)                                                        
```

Ownership of each hop is proved in `B2_DOMAIN_OWNERSHIP.md` §2. Two hops carry the load-bearing prohibitions:

- **`DEAL-4042` ⇏ `REV-*`.** B0 `BACKEND_COMMAND_EVENT_CATALOG.md`: "`DealWon` MUST NOT emit `RevenueRecognized` by default." CRM never infers revenue from a Deal (CRM-INV-7).
- **Billing ⇏ customer revenue.** B0 `BACKEND_ANALYTICS_SEMANTICS.md`: "Billing invoices and WazLink subscription payments are excluded from customer RevenueEvent." (CRM-INV-8).

## 5. Non-negotiable CRM invariants

| ID | Invariant | Enforcement |
|---|---|---|
| **CRM-INV-1** | Every persistent CRM entity is Workspace-scoped. | `workspace_id NOT NULL` on `leads`, `contacts`, `lead_contacts`, `tasks`, `appointments`, `notes`, `crm_activities`, `lead_tags`, `lead_provenance`. No CRM table is global. |
| **CRM-INV-2** | A cross-workspace reference is invalid even when the referenced public ID exists. | Doctrine R-1/R-2: every reference is resolved through the active-workspace queryset; a miss is `404 ENTITY_NOT_FOUND`, never `400`. |
| **CRM-INV-3** | Lead ≠ Business. | Lead stores `business_id` and copies no Business attribute. `city`, `category`, `name`, `phone`, `website` are read from Business. |
| **CRM-INV-4** | Lead ≠ AI Intelligence record. | Lead stores no `score`, `tier`, `confidence`, or `sales_approach`. `Lead360.intelligence` is an opaque object supplied by the Intelligence domain. |
| **CRM-INV-5** | Lead ≠ Conversation. | Conversation stores `lead_id`; the Lead stores no conversation state, unread count, or message. |
| **CRM-INV-6** | Lead ≠ Deal. | Deal stores `lead_id`; the Lead stores no `value`, `stage`, `probability`, or `expected_close_at`. One Lead may carry many Deals. |
| **CRM-INV-7** | No Lead or Deal state creates recognized revenue. | Only `RecordRevenueEvent` (Revenue domain) writes `revenue_events`. No CRM command emits `RevenueRecognized`. |
| **CRM-INV-8** | No Billing state creates recognized customer revenue. | Billing and Revenue are separate domains, tables, permissions, and events (B0). |
| **CRM-INV-9** | Discovery→Lead conversion preserves provenance durably. | `lead_provenance` snapshots source/job/business/analysis identities at conversion time and is immutable thereafter. |
| **CRM-INV-10** | Duplicate Lead prevention is PostgreSQL-authoritative. | Partial unique index `(workspace_id, business_id) WHERE archived_at IS NULL`. |
| **CRM-INV-11** | Redis is never required for durable CRM correctness. | Every race in `B2_CONCURRENCY_IDEMPOTENCY.md` §2 is resolved by a row lock, a unique index, or `version`. |
| **CRM-INV-12** | AI recommendations never silently mutate authoritative CRM state. | No AI output is persisted on `leads`. Adoption requires an explicit human command; none exists in Phase 1. |
| **CRM-INV-13** | Timeline and read models never become competing mutable sources of truth. | `crm_activities` is append-only and CRM-owned; cross-domain entries are merged at read time and are never written into CRM tables. |
| **CRM-INV-14** | Every CRM mutation records actor and authoritative transition semantics. | Every command writes an `audit_logs` row with actor, workspace, target, before/after, and `permission_matrix_version`. |
| **CRM-INV-15** | Tenant membership and authorization follow B1 exactly. | B2 reuses B1's 16-step pipeline, six roles, and matrix cells without modification. |
| **CRM-INV-16** | A Lead's `owner` is a Membership in the Lead's own Workspace. | `leads.owner_membership_id` FK → `memberships.id`, with a workspace-equality check constraint. A global User is never a CRM owner. |
| **CRM-INV-17** | `last_activity_at` is monotonic. | `last_activity_at = GREATEST(last_activity_at, event.occurred_at)`; out-of-order cross-domain events can never move it backwards. |
| **CRM-INV-18** | Contact PII is never an identity key. | No unique index on `contacts.phone` or `contacts.email`, at any scope. Identity is `CON-*`. |

CRM-INV-16 … CRM-INV-18 are added by B2 because repository evidence required them: B1's Membership model makes CRM-INV-16 expressible; the cross-domain timeline makes CRM-INV-17 necessary; and `B2_CONTACT_MODEL.md` §4 shows what CRM-INV-18 prevents.

## 6. Package map

| Document | Covers |
|---|---|
| `B2_CRM_DOMAIN_BLUEPRINT.md` | this document: scope, inheritance, principles, invariants |
| `B2_BASELINE_GAP_ANALYSIS.md` | frontend CRM truth inventory and the gap matrix |
| `B2_DOMAIN_OWNERSHIP.md` | one durable owner per CRM fact; boundaries against seven domains |
| `B2_LEAD_AGGREGATE.md` | Lead fields, field classification, tags, activity dates, contacted |
| `B2_LEAD_PROVENANCE_DUPLICATION.md` | origin model, provenance snapshot, duplicate policy, conversion workflow |
| `B2_CONTACT_MODEL.md` | Contact identity, Lead/Business relationship, PII, duplicates |
| `B2_TASK_APPOINTMENT_MODEL.md` | Task and Appointment aggregates, overdue, overlap |
| `B2_NOTE_ACTIVITY_TIMELINE.md` | Note aggregate, timeline authority, last/next activity |
| `B2_CRM_LIST_QUERY_MODEL.md` | `GET /leads`: filters, search, sort, cursor stability |
| `B2_LEAD360_READ_MODEL.md` | `GET /leads/{id}/360` section-by-section authority |
| `B2_STATE_MACHINES.md` | Lead, Task, Appointment, Note, Contact state machines |
| `B2_CONCURRENCY_IDEMPOTENCY.md` | race matrix and idempotency classification |
| `B2_API_DTO_CONTRACTS.md` | API surface, request/response DTOs, validation |
| `B2_COMMAND_EVENT_CATALOG.md` | commands, events, payloads, outbox rules |
| `B2_AUTHORIZATION_ENTITLEMENT.md` | permissions per operation, entitlement/quota boundary |
| `B2_ERROR_CONTRACT.md` | error reuse, `CONFLICT` reason vocabulary, anti-enumeration |
| `B2_PRIVACY_AUDIT_MODEL.md` | CRM data classification and audit actions |
| `B2_FAILURE_SCENARIOS.md` | CF1–CF24 end-to-end failure walkthroughs |
| `B2_ACCEPTANCE_TEST_MATRIX.md` | deterministic acceptance criteria |
| `B2_FRONTEND_TRACEABILITY.md` | frozen frontend → target authority → operation → test |
| `B2_DECISION_REGISTER.md` | Class A/B/C decision register |
| `B2_CONTROLLED_AMENDMENTS.md` | every frozen-artifact change B2 requires |
| `B2_IMPLEMENTATION_READINESS.md` | readiness gates and recomputed consistency evidence |

## 7. Implementation prohibition

No file in this package is executable backend implementation. Under B2 no agent may create Django projects or apps, models, serializers, views, URLs, middleware, migrations, SQL DDL, Celery tasks, Redis usage, WhatsApp/Meta clients, scrapers, Google Places clients, AI provider clients, Tap or ZATCA integrations, secrets, dependency or lockfile changes, deployment configuration, or frontend changes. B2 produces documentation only and is left **uncommitted** for independent CTO audit.

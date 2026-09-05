# 03 — Master Gap Matrix

> **Status: FINALIZED** against the approved Owner/CTO decisions. The authoritative gap population — every other document references these `GAP-*` IDs and adds none of its own. **27 gaps.**

## 1. Index

Amendment class is the frozen B13 governance vocabulary (`ADDITIVE` · `COMPATIBLE_CLARIFICATION` · `NON_ADDITIVE`); `NONE` means the gap changes no frozen artifact. Full register in `19_CONTROLLED_AMENDMENT_PLAN.md`.

| GAP_ID | Capability | Status today | Owner phase | Amendment class | Priority | Wave | Release |
|---|---|---|---|---|---|---|---|
| `GAP-001` | Customer commercial party (`organization` \| `person`) | `MISSING` | **new `customers` app** | `ADDITIVE` (`CA-03`,`CA-07`,`CA-09`) | **P0** | **APPROVE_NOW** | G0 |
| `GAP-002` | Contact UI + standalone address book | `BACKEND_DESIGNED_ONLY` | B2 extend | `ADDITIVE` (`CA-05`,`CA-06`) | **P0** | **APPROVE_NOW** | G0 |
| `GAP-003` | Business-less / manual Lead origin | `DEFERRED_BY_DESIGN` `B2-D-C001` | B2 extend | **`NON_ADDITIVE`** (`CA-01`, **`CA-15`**) + `COMPATIBLE_CLARIFICATION` (`CA-14`) | **P0** | **APPROVE_NOW** | G0 |
| `GAP-004` | Lead → Customer conversion | `MISSING` | B2 + customers | `ADDITIVE` (`CA-09`) | **P0** | **APPROVE_NOW** | G1 |
| `GAP-005` | CRM independence from Discovery (proof) | `CONFLICTING` | B2 | **`NON_ADDITIVE`** (`CA-01`, **`CA-15`**) | **P0** | **APPROVE_NOW** | G0 |
| `GAP-006` | Identity resolution service | `MISSING` | **new `identity` app** | `NONE` | **P0** | **APPROVE_NOW** | G2 |
| `GAP-007` | Governed merge execution | `DEFERRED_BY_DESIGN` `B2-D-C003` | identity + B2 | `ADDITIVE` (`CA-04`) | **P1** | APPROVE_AFTER_P0 | post-G2 |
| `GAP-008` | CSV customer/lead import pipeline | `DEFERRED_BY_DESIGN` `B2-D-C002` | **new `imports` app** | `ADDITIVE` (`CA-10`) | **P0** | **APPROVE_NOW** | G2 |
| `GAP-009` | Public web-form intake | `MISSING` | imports + B12 | `NONE` | P1 | **DEFER** (`PD-010`) | deferred |
| `GAP-010` | Custom field definitions | `MISSING` | **new `customfields` app** | `ADDITIVE` (`CA-07`,`CA-09`) | **P0** | **APPROVE_NOW** | G1 |
| `GAP-011` | Custom field values + search/filter | `MISSING` | customfields | `NONE` | P1 | APPROVE_AFTER_P0 | G1 |
| `GAP-012` | Conversation AI/human mode + takeover | `MISSING` | B5 extend | `ADDITIVE` (`CA-02`) | **P0** | **APPROVE_NOW** | G3 |
| `GAP-013` | Team inbox, routing, ownership UI | `EXISTS_PARTIAL` | B5 extend + FE | `NONE` | **P0** | **APPROVE_NOW** | G3 |
| `GAP-014` | AI Agent domain (OpenAI behind a port) | `UI_ONLY` | **new `aiagent` app** | `ADDITIVE` (`CA-09`,`CA-11`) | **P0** | **APPROVE_NOW** | G3 |
| `GAP-015` | Knowledge base + AI retrieval | `MISSING` | **new `knowledge` app** | `ADDITIVE` (`CA-03`,`CA-10`) | P1 | APPROVE_AFTER_P0 | G3 |
| `GAP-016` | Ticket entity + lifecycle | `MISSING` | **new `support` app** | `ADDITIVE` (`CA-03`,`CA-10`,`CA-12`) | P1 | APPROVE_AFTER_P0 | G4 |
| `GAP-017` | SLA policy + clocks | `MISSING` | support | `ADDITIVE` (`CA-12`) | P1 | APPROVE_AFTER_P0 | G4 |
| `GAP-018` | Product / Service catalog | `MISSING` | **new `catalog` app** | `ADDITIVE` (`CA-03`) | P1 | **DEFER** | deferred |
| `GAP-019` | Quote + QuoteLine | `MISSING` | **new `quotes` app** | `ADDITIVE` (`CA-03`) | P1 | **DEFER** | deferred |
| `GAP-020` | Quote acceptance → Deal linkage | `MISSING` | quotes | `NONE` | P1 | **DEFER** | deferred |
| `GAP-021` | Calendar view over Tasks/Appointments | `EXISTS_PARTIAL` | B2 read-model + FE | `NONE` | P1 | APPROVE_AFTER_P0 | G6 |
| `GAP-022` | Assignment rules / round robin | `EXISTS_PARTIAL` | **new `assignment` app** | `ADDITIVE` (`CA-09`) | P1 | APPROVE_AFTER_P0 | G6 |
| `GAP-023` | Track B/C reporting expansion | `EXISTS_PARTIAL` | analytics extend | `NONE` | P1 | APPROVE_AFTER_P0 | G7 |
| `GAP-024` | Operating-mode onboarding | `EXISTS_PARTIAL` | B1 + FE | `ADDITIVE` (`CA-13`) | P1 | **DEFER** | deferred |
| `GAP-025` | Navigation IA restructure | `EXISTS_PARTIAL` | FE only | `NONE` | **P0** | **APPROVE_NOW** | G0 |
| `GAP-026` | Email channel | `MISSING` | B5 extend | would be `NON_ADDITIVE` | P2 | **DEFER** | deferred |
| `GAP-027` | Customer portal | `MISSING` | — | `CONFLICT` — no frozen external-identity authority | P2 | **CONFLICT_BLOCKED** | deferred |

**Priority counts:** P0 **12** · P1 **13** · P2 **2** · P3 **0**.
**Wave counts:** `APPROVE_NOW` **12** · `APPROVE_AFTER_P0` **8** · `DEFER` **6** · `CONFLICT_BLOCKED` **1**.
**Amendment participation:** gaps requiring at least one amendment **15** · requiring none **11** · conflict **1**.

`GAP-007` moved P0 → P1 under `PD-006`: advisory duplicate **detection** (`GAP-006`) is required early; irreversible merge **execution** is not, and it is the single highest-risk data operation in the plan.

## 2. Gap detail

Each block carries the columns required by brief §8. `—` means *no impact*, stated deliberately rather than omitted.

---
### `GAP-001` — Customer commercial party (`organization` | `person`)
**Business purpose.** Track B needs a durable commercial counterparty that is not a Discovery artefact. Today the only counterparty is `Business`, which is *"WazLink's normalized record of a real-world organization"* produced by Discovery (`B3_BUSINESS_IDENTITY_MODEL.md`). A company that already has customers cannot represent them.
**Current evidence.** No `customers`/`accounts` table in `BACKEND_DATA_MODEL.md`; `B9_DUAL_TRACK_COMPATIBILITY.md` §6 confirms *"No Customer entity, no Account entity"*.
**FE status** `MISSING` · **BE status** `MISSING` · **Existing owner** none.
**Competitor evidence** E-08.
**Missing FE** Customers list, Customer 360, create/edit forms. **Missing BE** new `customers` Django app; `customers`, `customer_contacts` tables.
**Data model** new; `party_kind ∈ {organization, person}`, NOT NULL, immutable (`PD-001` APPROVED — invariants CUS-1…CUS-6 in `05_CUSTOMER_ACCOUNT_CONTACT_MODEL.md` §3). A person-Customer holds **no PII**; its phone/email/WhatsApp identity lives on its single linked Contact, so frozen B5 and CRM-INV-18 are untouched. **API** new `/customers*`. **Events** `CustomerCreated`, `CustomerUpdated`, `CustomerArchived`. **Permissions** new `customer.*` family. **Integration** —.
**Security** workspace-scoped, Contact-PII class inherits B2/B13 redaction. **Billing** new independent capability key (`PD-004` APPROVED — per-module keys; pricing not frozen). **Finance** — (firewall: no revenue coupling). **Tax** —. **Storage** B11 `file_attachments` subject enum += `customer`. **Async** —. **Migration** purely additive; no existing row changes.
**Dependency** none — this is the root. **Priority P0 · Release G0 · B14: APPROVED_FOR_B14.**

---
### `GAP-002` — Contact UI and standalone address book
**Business purpose.** Contacts are fully designed and completely unreachable. `#/contacts` renders `Placeholder`.
**Current evidence.** `B2_CONTACT_MODEL.md` §2–§6 (table, `lead_contacts`, `AddContact`/`UpdateContact`/`RemoveContact`); `App.tsx:56`.
**FE status** `MISSING` (placeholder) · **BE status** `EXISTS_COMPLETE` · **Owner** B2.
**Competitor evidence** E-08.
**Missing FE** Contacts list, Contact detail, link/unlink to Lead **and Customer**. **Missing BE** a standalone list selector; Contact↔Customer link.
**Data model** `contacts.customer_id` nullable FK (additive); reuse `lead_contacts` shape for `customer_contacts`. **API** `GET /contacts` (new list surface). **Events** reuse `ContactAdded`/`ContactUpdated`/`ContactRemoved`. **Permissions** **`contact.*` family — this is exactly the trigger `B2-D-C007` names** (*"only if a standalone address book is built"*). **Integration** —.
**Security** PII list surface is a new bulk-egress path — must inherit `B2-D-C008` masking decision and B13 redaction. **Billing** — . **Finance/Tax/Async** —. **Storage** —. **Migration** additive nullable column.
**Dependency** `GAP-001`. **Priority P0 · Release G0 · B14: APPROVED_FOR_B14** (with `PD-002` open).

---
### `GAP-003` — Business-less / manual Lead origin
**Business purpose.** The single structural blocker on Track B.
**Current evidence.** `B2_LEAD_AGGREGATE.md` §1 — `business_id` NOT NULL, CHECK `origin_type IN ('discovery')`. `B2-D-C001` names the deferral and its conditions verbatim.
**FE status** `MISSING` · **BE status** `DEFERRED_BY_DESIGN` · **Owner** B2.
**Competitor evidence** E-08, E-09.
**Missing FE** "New Lead" form without Discovery. **Missing BE** widen `origin_type` to `('discovery','manual','import','api','form')`; make `business_id` **and `converted_at`** nullable under conditional invariants; seed `last_activity_at` from creation time for non-discovery origins; scope CRM-INV-10's index to rows that have a `business_id`. **`whatsapp` is deliberately not an origin value** — an inbound message never creates a Lead; a human creating one while working a conversation records `manual`.
**Data model** `CONTROLLED_AMENDMENT_REQUIRED` — see `19_CONTROLLED_AMENDMENT_PLAN.md` `CA-01`. **API** `POST /leads`. **Events** `LeadCreated` (additive; today Leads arise only via `ConvertBusinessToLead`). **Permissions** reuse `lead.create`. **Integration** —.
**Provenance — corrected.** A non-Discovery Lead has **no `lead_provenance` row at all**; that table is by definition a Discovery→Lead conversion snapshot with three NOT NULL Discovery columns, and CRM-INV-9 is already scoped to conversion (`CA-14`). **No fake Business, no fake Job, no fabricated `business_public_id`/`business_name_snapshot`/`intelligence_status`.** Origin truth lives in `leads.origin_type` plus a nullable typed origin reference. **Billing** counts against existing CRM quota. **Finance** — B9 already supports it (`AT-TRACK-3`). **Tax/Storage/Async** —.
**Identity — added by `B14-FIX.1` (`CA-15`).** `CA-01` makes a Business-less Lead *insertable*; it does not make it *usable*. Frozen B2 forbids `name`/`company_name`/`city`/`category`/`phone`/`email`/`website` on `leads` (normative "Explicitly absent" list, CRM-INV-3) and frozen `B2_LEAD360_READ_MODEL.md` §1 declares `required: [lead, business]`. A Business-less Lead therefore has **no identity source at all** unless one is supplied. `CA-15` supplies it: **the primary Contact**, through the already-frozen `lead_contacts.is_primary` link. **No attribute is copied onto `leads`; no Business is fabricated.** Display, sort and search resolve from Business when one exists and from the primary Contact when one does not; `city`/`category` filters simply do not match a Business-less Lead rather than substituting a Contact field. See `19_CONTROLLED_AMENDMENT_PLAN.md` `CA-15`.
**Migration** existing rows all satisfy `origin_type='discovery'`; the widened CHECK admits them unchanged. **No backfill.**
**Dependency** `GAP-006` must ship **with or before** this (duplicate protection replacement — risk `R-18`). `CA-15` must ship **in the same slice** as `CA-01`. **Priority P0 · Release G0 · B14: APPROVED_FOR_B14 under corrected `CA-01` + `CA-15`.**

---
### `GAP-004` — Lead → Customer conversion
**Business purpose.** A qualified Lead that closes must become a managed Customer without losing provenance.
**Current evidence.** No such transition exists. `B2_STATE_MACHINES.md` Lead statuses end at `qualified`/`unqualified`/`nurturing`.
**FE** `MISSING` · **BE** `MISSING` · **Owner** B2 + customers.
**Missing FE** "Convert to Customer" action on Lead 360. **Missing BE** `ConvertLeadToCustomer` command.
**Data model** `customers.origin_lead_id` nullable FK. **API** `POST /leads/{id}/convert-customer`. **Events** `LeadConvertedToCustomer`. **Permissions** new `customer.create`. **Security** workspace equality check. **Finance** — **must not** emit any revenue event (firewall). **Migration** additive.
**Dependency** `GAP-001`, `GAP-003`. **Priority P0 · Release G1 · APPROVED_FOR_B14.**

---
### `GAP-005` — CRM independence from Discovery
**Business purpose.** The non-negotiable product principle.
**Current evidence.** `CONFLICTING`: `B9_DUAL_TRACK_COMPATIBILITY.md` §3 and `AT-TRACK-3`/`AT-TRACK-4` assume *"a manually-created Lead"* and *"an imported Lead"* already recognize revenue correctly, while `B2_LEAD_AGGREGATE.md` forbids both from existing. B9 is **forward-compatible**; B2 has not opened the door.
**Impact** `CONTROLLED_AMENDMENT_REQUIRED` (`CA-01`, shared with `GAP-003`). This gap is the *acceptance proof*, not separate schema.
**Missing BE** an acceptance suite proving every Track-B path works with zero `discovery_jobs` rows.
**Dependency** `GAP-001`, `GAP-003`, `GAP-008`. **Priority P0 · Release G0 · APPROVED_FOR_B14.**

---
### `GAP-006` — Identity resolution service
**Business purpose.** Inbound WhatsApp must resolve to the right existing party, or to nothing, and never to another tenant's party.
**Current evidence.** `B2_CONTACT_MODEL.md` §1 explicitly refuses a person-identity system; `B5_CONTACT_PHONE_RESOLUTION.md` resolves phone→Contact within Messaging only. **Precedent exists**: `business_identities` (`B3_BUSINESS_IDENTITY_MODEL.md` §4) already does workspace-scoped provider-identity resolution.
**FE** `MISSING` · **BE** `MISSING` · **Owner** new `identity` app.
**Competitor evidence** E-10.
**Missing BE** `party_identifiers` index + a read-only resolver; **no merge authority**.
**Data model** new `party_identifiers(workspace_id, identifier_kind, identifier_normalized, party_type, party_id, confidence)`. **API** internal selector only (`INTERNAL_API`). **Events** none produced. **Permissions** none new — resolution is a system read. **Security** **`workspace_id` is part of every lookup key; cross-workspace resolution is structurally impossible.** **Async** resolution runs inside the existing B5 inbound pipeline, no new queue. **Migration** additive; backfillable from `contacts`, but backfill is optional and non-blocking.
**Dependency** `GAP-001`, `GAP-002`. **Priority P0 · Release G2 · APPROVED_FOR_B14.**

---
### `GAP-007` — Duplicate detection & governed merge
**Business purpose.** Import and WhatsApp capture both create duplicates; today duplicates are advisory-only and never resolvable.
**Current evidence.** `B2-D-C003` — *"duplicates are advisory today; merging needs a survivorship policy and a conversation-reference migration"*. `Contact.duplicate_candidates[]` capped at 5.
**Impact** `CONTROLLED_AMENDMENT_REQUIRED` — merge rewrites references B5/B6/B9 hold. **Never automatic; never cross-workspace.**
**Missing FE** merge-candidate review + side-by-side survivorship. **Missing BE** `MergeCandidates`, `MergeParties` commands; `merge_records` lineage table.
**Events** `PartiesMerged`. **Permissions** new `customer.merge` (high-trust). **Finance** — merged parties **must not** alter any immutable `RevenueEvent` or attribution snapshot; lineage is additive.
**Dependency** `GAP-006`. **Priority P1 (moved from P0 under `PD-006`) · post-G2 · APPROVED_AFTER_P0.** Advisory detection ships in G2 with `GAP-006`; irreversible merge execution is deliberately not in the P0 wave and **does not block** manual CRM, CSV import, identity detection or Customer 360.

---
### `GAP-008` — CSV import pipeline
**Business purpose.** No company with existing customers will retype them.
**Current evidence.** `B2-D-C002` names the deferral and its three conditions.
**Missing FE** upload → mapping → validation preview → dry-run → results/error export (4 screens). **Missing BE** new `imports` app; `import_batches`, `import_rows`.
**API** `POST /imports`, `/imports/{id}/mapping`, `/dry-run`, `/commit`, `GET /imports/{id}/errors.csv`.
**Events** `ImportBatchCreated`, `ImportBatchCompleted`. **Permissions** new `import.manage`.
**Storage** **reuses B11** — the uploaded CSV is a `file_asset`, subject enum += `import_batch`. **Async** **reuses B12** — batch processing on the existing `default` queue with outbox-driven progress; per-row idempotency key `(batch_id, row_number)`. **No new queue, no new provider.**
**Migration** additive. **Rollback policy** `PRODUCT DECISION REQUIRED` (`PD-007`) — no arbitrary limit invented; batch size and error-file retention likewise `PD-008`.
**Dependency** `GAP-001`, `GAP-003`, `GAP-006`. **Priority P0 · Release G2 · APPROVED_FOR_B14 with `PD-007`/`PD-008` open.**

---
### `GAP-009` — Web form / API intake
**Business purpose.** Inbound capture without a human typing.
**Current evidence.** B12 owns provider→WazLink webhooks; no *public unauthenticated inbound* surface exists anywhere in B0–B13.
**Security** this is the **highest-risk new surface in the plan**: it is public, unauthenticated, and writes CRM. Requires workspace binding by opaque form token, B13 rate limiting, abuse controls, and consent capture (`B5_CONSENT_COMMUNICATION_POLICY.md`).
**Missing BE** `forms`, `form_submissions`; reuse B12 inbox dedup shape. **Permissions** `form.manage`.
**Dependency** `GAP-006`, `GAP-008`. **Priority P1 · DEFERRED.** `PD-010` **APPROVED: API-first** — authenticated/protected intake first; `PUBLIC_UNAUTH` form intake is **not** part of the initial implementation wave and returns only after its abuse/security surface is deliberately designed and approved.

---
### `GAP-010` / `GAP-011` — Custom fields (definitions / values)
**Business purpose.** Every CRM buyer expects to add their own fields; refusing produces per-tenant forks.
**Current evidence.** No frozen phase names a field-definition table. `BACKEND_DATA_GOVERNANCE.md` restricts JSONB to *"structured flexible metadata"* and forbids it for *"relationships, state, or ownership"*.
**Design constraint** — the governing risk is *"arbitrary JSON becoming uncontrolled business truth"*. Recommended shape: **definitions in typed rows; values in a typed side table** (`custom_field_values` with one typed column per supported type + a `definition_id` FK), **not** free JSONB, so values remain indexable and validatable. `PD-005` records the alternative.
**Subjects** Lead, Contact, Customer, Deal, Ticket. **Permissions** `customfield.manage` (admin-only).
**Impact** `ADDITIVE_EXTENSION` — new tables only; no frozen table gains a JSONB column.
**Dependency** `GAP-001`. **`PD-005` APPROVED: typed side table.** **Priority P0 (010) / P1 (011) · Release G1 · APPROVED_FOR_B14.**

---
### `GAP-012` — Conversation AI/human mode + takeover
**Business purpose.** The core Track C behavior; verified competitor baseline (E-11).
**Current evidence.** `B5_CONVERSATION_MODEL.md:23` — `status` is `enum(2)`: `open | closed`. There is no mode concept. `B5-D-A021`: *"Does a B4 recommendation authorize a send? **Never.**"*
**Impact** `CONTROLLED_AMENDMENT_REQUIRED` (`CA-02`) — adds an **orthogonal** `handling_mode` column, deliberately **not** widening the frozen `status` enum(2), so the frozen state machine's fan-out is untouched.
**Proposed modes** `ai_assisted` (AI may draft/propose) · `human` (AI silent) · `ai_paused` (explicit suppression). Names are candidates; `PD-011`.
**Race handling** takeover is a row-locked compare-and-set on `(conversation_id, handling_mode, version)`; queued AI work checks mode **at execution time**, not at enqueue time — which is exactly `FI-B12-05`'s frozen "payloads carry references re-read at execution time" rule, reused rather than reinvented.
**Events** `ConversationHandlingModeChanged`, `HumanTakeoverStarted`, `HumanTakeoverEnded`. **Permissions** reuse `messaging.manage`.
**Dependency** `GAP-014`. **Priority P0 · Release G3 · APPROVED_FOR_B14 pending `CA-02`.**

---
### `GAP-013` — Team inbox, routing, ownership UI
**Current evidence.** `AssignConversation`/`ConversationAssigned` and `conversations.assigned_to` exist (`B5_COMMAND_EVENT_CATALOG.md`); `ConversationParticipant` carries `assignee_history`/`visibility` roles. **No UI.**
**Impact** `ADDITIVE_EXTENSION` — mostly frontend plus list selectors.
**Dependency** `GAP-012`, `GAP-022`. **Priority P0 · Release G3 · APPROVED_FOR_B14.**

---
### `GAP-014` — AI Customer Agent backend domain
**Business purpose.** Closes the most serious orphan in the product: `#/copilot` and `#/agent` are shipped UI, and `inbox.copilot` is a **billed capability in PLAN-GROWTH** (`B8_PLAN_CATALOG.md:40`), with no backend domain implementing either.
**Current evidence.** `B4-D-C002` defers *"S8 Sales Copilot / governed Agent integration — a later, cross-cutting phase needing B2+B5+B6+B7 simultaneously"*; `B5-D-C009` leaves draft-generation ownership open.
**Authority ladder (non-negotiable).** `MAY RECOMMEND` (rendered only) · `MAY PROPOSE` (typed, human-confirmable) · `MAY EXECUTE` — **restricted to a closed allow-list of read-only retrieval and draft creation.** No AI path may send a message, mutate a Lead/Deal, recognize revenue, change permissions, or merge identities. This preserves `B5-D-A021`, `B4-D-A012`, `B7_ACTION_CATALOG.md` §3 and `B7_REVENUE_FIREWALL.md` unchanged.
**Missing BE** new `aiagent` app; `agent_sessions`, `agent_proposals`. **Permissions** reuse `ai.use`; new `agent.manage` for configuration.
**Provider.** `PD-003` **APPROVED: OpenAI is the initial provider, behind an internal AI Provider Port; OpenAI must not become the domain boundary.** The `aiagent` domain owns business semantics; an OpenAI Adapter owns provider translation. No model name, prompt, token count or provider error code may appear in any business domain. Full architecture in `29_AI_PROVIDER_ARCHITECTURE.md`. **Async** reuses B12 `providers.slow`, `provider_request_attempts` and `B12-D-A020` unchanged — no new queue, no new webhook, no second retry mechanism. **Billing** reuses `inbox.copilot` (`PD-003`).
**Dependency** `GAP-015`. **Priority P0 · Release G3 · APPROVED_FOR_B14.**

---
### `GAP-015` — Knowledge base + retrieval
**Current evidence.** None in B0–B13. B11 supplies storage; `file_attachments` subject enum is the additive hook (`B11_DOMAIN_ATTACHMENT_MODEL.md` §1).
**Missing BE** new `knowledge` app; `kb_articles` with `draft|published|archived`, versioning, and **citation provenance** so every AI answer names its source article.
**Storage** **reuses B11 entirely — no second file truth.** **Permissions** `knowledge.manage` / reuse `file.download` for source files.
**Dependency** `GAP-001`. **Priority P1 · Release G3 · APPROVED_FOR_B14.**

---
### `GAP-016` / `GAP-017` — Tickets / SLA
**Current evidence.** None. Verified competitor baseline E-02.
**Missing BE** new `support` app; `tickets` (`TKT-*`), `sla_policies`, `ticket_sla_clocks`.
**Creation paths** manual · from Conversation · API · automation (new B7 action `create_ticket`, tier `auto_safe` — it creates internal work, contacts nobody).
**Finance** — **a Ticket is never a financial object.** **Async** SLA breach detection is a scheduled sweep on B12's existing `maintenance` queue (deliberately starvable). **Storage** subject enum += `ticket`.
**Email support in first release?** **No** — `GAP-026` is P2; tickets ship WhatsApp+manual first.
**Dependency** `GAP-001`, `GAP-012`. **Priority P1 · Release G4 · APPROVED_FOR_B14.**

---
### `GAP-018` / `GAP-019` / `GAP-020` — Products / Quotes / Quote→Deal
**Current evidence.** None. E-03 verified.
**Scope discipline** minimal catalog (`products`: name, sku, unit price, currency, active) — **no inventory, no stock, no vendors, no price books** (`PD-009` recommends rejecting price books).
**Quote lifecycle** `draft → sent → accepted | rejected | expired`.
**Revenue firewall — the load-bearing rule.** An accepted Quote emits `QuoteAccepted` and **may link to a Deal. It must never write `revenue_events`, and must never be an input to `RecordRevenueEvent`.** This mirrors B6's own `AT-REV-5` **NC** for `weighted_value` and is enforced the same way: by ownership, not convention.
**Tax** Quotes may **display** a tax estimate but are **not** tax documents; `tax_invoices` remain WazLink→workspace (`B10_SCOPE_AND_OWNERSHIP.md`). Customer-facing invoicing stays `B9-D-C004` DEFERRED.
**Dependency** `GAP-001`, `GAP-004`. **`PD-009` APPROVED: Price Books REJECTED from this programme.** **Priority P1 · DEFERRED** — valuable but not differentiating for a WhatsApp-first CRM, and G5 competes with G3/G4 for the same capacity.

---
### `GAP-021` — Calendar view
**Impact** `NO_CHANGE` — a read model over existing `tasks` and `appointments`. No new entity, no new permission (reuse `task.view`, `appointment.view`).
**Dependency** none. **Priority P1 · Release G6 · APPROVED_FOR_B14.**

---
### `GAP-022` — Assignment rules / round robin
**Current evidence.** Manual assignment exists for Lead and Conversation; no rule engine.
**Scope discipline** rule = (subject_type, ordered eligible membership list, strategy ∈ {round_robin, load_balanced}, fallback). **No availability calendars, no shift management, no workforce planning.**
**Race handling** assignment counter is a **PostgreSQL row**, never Redis (`FI-B0-16` / CRM-INV-11).
**Permissions** `assignment.manage`.
**Dependency** `GAP-001`, `GAP-016`. **Priority P1 · Release G6 · APPROVED_FOR_B14.**

---
### `GAP-023` — Reporting expansion
**Impact** `ADDITIVE_EXTENSION` — new selectors only. **Never derives recognized revenue** from Won Deals, Accepted Quotes, pipeline value or customer counts; all revenue figures continue to come from `revenue_events` (`BACKEND_ANALYTICS_SEMANTICS.md`).
**Dependency** all of G0–G6. **Priority P1 · Release G7 · APPROVED_FOR_B14.**

---
### `GAP-024` — Operating-mode onboarding
**Business purpose.** Ask *ما الذي تريد تحقيقه؟* and configure navigation, dashboard and setup checklist — **never the data model**.
**Constraint** mode is a reversible **workspace preference**, not a schema switch; a workspace may change it at any time with no migration. All three tracks share one model.
**Impact** `ADDITIVE_EXTENSION` — one nullable `workspaces.operating_mode` preference.
**Dependency** `GAP-025`. **Priority P1 · DEFERRED** (`CA-13` registered but not scheduled) — cosmetic until two tracks actually exist in a workspace.

---
### `GAP-025` — Navigation IA restructure
**Impact** `NO_CHANGE` (frontend-only). Resolves the `companies`/`calls` orphan nav entries.
**Dependency** none. **Priority P0 · Release G0 · APPROVED_FOR_B14.**

---
### `GAP-026` — Email channel · **DEFERRED P2**
`CONTROLLED_AMENDMENT_REQUIRED` if adopted (B5's provider abstraction and `channel` semantics are WhatsApp-shaped). Deferred so email complexity does not block WhatsApp-first value, exactly as brief §24 permits. **B14: DEFERRED.**

---
### `GAP-027` — Customer portal · **DEFERRED P2 / CONFLICT**
Requires authenticating a **non-member external person**. B1's frozen identity model has users, memberships and workspaces — no external-contact principal — and B13's session/authorization contract assumes every principal is a membership. This is a genuine `CONFLICT` requiring Owner/CTO direction before any design. **B14: CONFLICT_BLOCKED.**

## 3. Dependency graph (P0 spine)

```
GAP-025 (IA) ─┐
GAP-001 (Customer) ──┬─ GAP-002 (Contacts UI)
                     ├─ GAP-004 (Lead→Customer)
                     ├─ GAP-010/011 (Custom fields)
                     └─ GAP-006 (Identity) ─┬─ GAP-007 (Merge)
GAP-003 (Manual Lead) ─┬─ GAP-005 (Track B proof)
                       └─ GAP-008 (Import) ──┘
GAP-015 (KB) ── GAP-014 (AI Agent) ── GAP-012 (AI/Human) ── GAP-013 (Team inbox)
```

## 4. Rejected outright (not gaps)

Inventory · Warehouse · Vendors · Purchase Orders · Payroll · full accounting/ERP · Projects app · Native mobile app · Telephony/SMS/`#/calls` · Live chat/chatflows · Deal Room · Sales Orders · Price Books.

Each is a brief §7 non-goal, a `NOT_VERIFIED`/`PROMPT_SUPPLIED_REQUIREMENT` with no WazLink evidence, or both. **No `GAP-*` ID is assigned to any of them**, which is why the P3 count is 0: P3 candidates were resolved as rejections rather than parked.

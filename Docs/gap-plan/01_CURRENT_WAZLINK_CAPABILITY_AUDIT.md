# 01 — Current WazLink Capability Audit

> **Planning artifact. Not architecture.** Nothing here modifies or reopens frozen B0–B13. Baseline: B13 = `5c759cea72baaec9ee0096039475162efd4eeec0`.

## 1. Method

Every row below was established by reading the actual repository — the frozen frontend under `client/src`, the root B0 contracts, and `Docs/backend/B1`…`B13`. **Absence was never inferred from a feature not being obvious.** Where a capability appeared missing, the frozen decision registers were searched for a named deferral before it was recorded as a gap. That search changed the verdict in 11 cases, which are recorded in §6 as *false gaps* and in `03_MASTER_GAP_MATRIX.md` as `DEFERRED_BY_DESIGN` rather than `MISSING`.

Status vocabulary, applied literally:

| Status | Means |
|---|---|
| `EXISTS_COMPLETE` | designed in a frozen backend phase **and** surfaced in the frozen frontend |
| `EXISTS_PARTIAL` | designed or built, but materially incomplete against the stated product vision |
| `UI_ONLY` | a frontend surface exists with **no** owning backend domain |
| `BACKEND_DESIGNED_ONLY` | a frozen backend design exists with **no** frontend surface |
| `MISSING` | neither side, and no frozen decision names it |
| `DEFERRED_BY_DESIGN` | absent, but a frozen decision register explicitly names and defers it |
| `CONFLICTING` | two frozen artifacts make incompatible assumptions |

## 2. Frontend route inventory (complete, from `client/src/App.tsx:56-108`)

| Route | Component | Status |
|---|---|---|
| `#/dashboard` | `Dashboard` | implemented |
| `#/discovery`, `#/discovery/jobs`, `#/discovery/jobs/:id`, `#/discovery/results` | Discovery suite | implemented |
| `#/intelligence` | `Intelligence` | implemented |
| `#/crm`, `#/leads` | `Crm` | implemented |
| `#/crm/leads/:id` | `Lead360` | implemented |
| `#/pipeline`, `#/deals`, `#/deals/:id` | Pipeline suite | implemented |
| `#/inbox`, `#/whatsapp`, `#/inbox/:id` | `Inbox` | implemented |
| `#/copilot` | `Copilot` | implemented — **no backend owner** |
| `#/agent` | `Agent` | implemented — **no backend owner** |
| `#/automation`, `#/automation/rules/:id` | `Automation` | implemented |
| `#/tasks`, `#/appointments` | `Tasks`, `Appointments` | implemented |
| `#/analytics`, `#/analytics/:section` | `Analytics` | implemented |
| `#/integrations`, `#/settings*`, `#/settings/billing/checkout` | Settings suite | implemented |
| `#/contacts`, `#/companies`, `#/calls` | `Placeholder` | **declared in nav, deliberately unimplemented** (`App.tsx:56` `productPlaceholders`) |

`client/src/domain/data.js:96` `navItems` declares `contacts` (جهات الاتصال), `companies` (الشركات) and `calls` (المكالمات) as navigation entries whose routes render `Placeholder`. `V2-S7_ROUTE_MATRIX.md` records them as *"intentionally unimplemented product areas"*.

## 3. Frontend domain model (`client/src/domain/types.ts`)

Entities typed: `Business`, `Lead`, `Deal`, `Conversation`, `Message`, `Task`, `Appointment`, `RevenueEvent`, `AttributionTouchpoint`, `AutomationRule`, `AutomationRun`, `User`, `Workspace`, `Integration`, `Subscription`.

**Not present in any form:** `Customer`, `Account`, `Organization`, `Contact`, `Ticket`, `Quote`, `Product`, `PriceBook`, `KnowledgeArticle`, `CustomField`, `ImportBatch`, `AssignmentRule`, `Form`.

Two dangling references exist and are load-bearing evidence:
- `Lead.businessId: BusinessId` is **required** — every frontend Lead is anchored to a Business.
- `Lead.companyId?: string` and `Appointment.contactId?: string` reference entities the frontend never defines.

A fixture-level scan of `data.js` (185 KB) returns **zero** ticket, quote, product, account, customer-entity or knowledge-base structures. The 12 `invoice` hits are S11 SaaS-billing invoices, not customer-facing sales documents.

## 4. Backend capability audit against frozen B0–B13

| # | Capability | Status | Evidence |
|---:|---|---|---|
| 1 | Workspace/tenancy/RBAC | `EXISTS_COMPLETE` | B1; 60 permission codes in `B1_AUTHORIZATION_RBAC.md`; six roles; 16-step pipeline |
| 2 | Discovery → Business | `EXISTS_COMPLETE` | B3; `businesses`, `business_identities`, `discovery_jobs` |
| 3 | AI Lead Intelligence | `EXISTS_COMPLETE` | B4; `intelligence_runs`, `Recommendation`; `B4-D-A012` — B4 executes nothing |
| 4 | Lead aggregate | `EXISTS_PARTIAL` | `B2_LEAD_AGGREGATE.md` §1 — **`origin_type` CHECK `IN ('discovery')`**, `business_id` NOT NULL |
| 5 | **Contact** | `BACKEND_DESIGNED_ONLY` | `B2_CONTACT_MODEL.md` — full table, `lead_contacts` join, 3 commands, PII posture. **UI is `Placeholder`** |
| 6 | Tasks / Appointments / Notes / Activities | `EXISTS_COMPLETE` | `B2_TASK_APPOINTMENT_MODEL.md`, `B2_NOTE_ACTIVITY_TIMELINE.md`; `#/tasks`, `#/appointments` |
| 7 | Messaging / WhatsApp | `EXISTS_COMPLETE` | B5; 12 commands, 8 events, Meta Cloud API, consent, service window |
| 8 | Conversation assignment | `BACKEND_DESIGNED_ONLY` | `AssignConversation` + `ConversationAssigned` (`B5_COMMAND_EVENT_CATALOG.md` §2–3); `conversations.assigned_to`; no dedicated UI surface |
| 9 | Pipeline / Deals | `EXISTS_COMPLETE` | B6; `pipelines`, `pipeline_stages`, `deals`, `weighted_value` |
| 10 | Automation | `EXISTS_COMPLETE` | B7; 10-action catalog, safety tiers, approval queue |
| 11 | Billing / Entitlements | `EXISTS_COMPLETE` | B8; 6 capability keys, 3 plans |
| 12 | Revenue / Attribution | `EXISTS_COMPLETE` | B9; `revenue_events`, `attribution_touchpoints`, 7 `origin_kind` values |
| 13 | Tax / ZATCA | `EXISTS_COMPLETE` (platform direction only) | B10; `tax_invoices.workspace_id` is the **buyer** side — WazLink→workspace |
| 14 | Files / Storage | `EXISTS_COMPLETE` | B11; `file_assets`, `file_attachments` `(subject_type, subject_id)` |
| 15 | Async / Integration | `EXISTS_COMPLETE` | B12; outbox, inbox, 5 queues, reconciliation |
| 16 | Security / Operations | `EXISTS_COMPLETE` | B13 |
| 17 | **Copilot** | `UI_ONLY` | `#/copilot` + `CopilotPanel.tsx`; capability `inbox.copilot` **sold in PLAN-GROWTH** (`B8_PLAN_CATALOG.md:40`); **no backend domain owns it** |
| 18 | **AI Sales Agent** | `UI_ONLY` | `#/agent`, `features/ai/Agent.tsx`; `B4-D-C002` defers "S8 Sales Copilot / governed Agent integration" |
| 19 | Customer / Account | `MISSING` | No entity in any frozen phase. `B9_DUAL_TRACK_COMPATIBILITY.md` §6: *"No Customer entity, no Account entity, no Opportunity entity"* |
| 20 | Manual Lead origin | `DEFERRED_BY_DESIGN` | `B2-D-C001` — *"needs a Business-less Lead schema amendment … must not fabricate a Business or a Job"* |
| 21 | Imported Lead origin | `DEFERRED_BY_DESIGN` | `B2-D-C002` — *"needs a column-mapping contract, batch idempotency, and a bulk quota decision"* |
| 22 | Identity resolution | `DEFERRED_BY_DESIGN` (partly prohibited) | `B2_CONTACT_MODEL.md` §1: *"B2 does not build a global Person identity system"*; `B2-D-C003` merge flow deferred; **B3 `business_identities` is the in-corpus precedent** |
| 23 | Custom fields | `MISSING` | No frozen phase names a field-definition table |
| 24 | Products / Services / Quotes | `MISSING` | B6 owns Deals only; no `products`, `quotes`, `price_books` anywhere |
| 25 | Tickets / SLA / Help desk | `MISSING` | No frozen phase |
| 26 | Knowledge base | `MISSING` | No frozen phase; B11 `file_attachments` enum is the additive hook |
| 27 | Calendar view | `EXISTS_PARTIAL` | `appointments` modelled + `#/appointments` list; **no calendar surface**; `B2-D-C011` defers external sync |
| 28 | Assignment / round robin | `EXISTS_PARTIAL` | Manual `AssignLeadOwner` (B2) + `AssignConversation` (B5); **no rule engine** |
| 29 | Web forms / web-to-lead | `MISSING` | B12 owns provider→WazLink webhooks; no public inbound form surface |
| 30 | Email channel | `MISSING` | B5 is WhatsApp-only; `channel` column exists |
| 31 | Customer-facing invoicing | `DEFERRED_BY_DESIGN` | `B9-D-C004` *"Customer invoicing … DEFERRED_SAFE"*; `B9_SCOPE.md:60` |
| 32 | CRM export | `DEFERRED_BY_DESIGN` | `B2-D-C017`; capability `export.csv` already sold in all three plans |
| 33 | Bulk CRM mutations | `DEFERRED_BY_DESIGN` | `B2-D-C016` |
| 34 | Contact merge / dedup | `DEFERRED_BY_DESIGN` | `B2-D-C003`; duplicates advisory-only today (`Contact.duplicate_candidates[]`) |
| 35 | Customer portal | `MISSING` | No frozen phase |

## 5. The single structural blocker

`B2_LEAD_AGGREGATE.md` §1 constrains the Lead aggregate:

- `business_id` — `UUID FK → businesses.id ON DELETE RESTRICT`, **not nullable**
- CHECK `origin_type IN ('discovery')`
- CHECK `origin_type='discovery' ⇒ business_id IS NOT NULL`
- Partial unique `(workspace_id, business_id) WHERE archived_at IS NULL` (CRM-INV-10)

**Consequence:** in the frozen architecture, *nothing can enter CRM except through Discovery.* The stated non-negotiable product principle — *"Discovery MUST NOT be a prerequisite for CRM participation"* — is not satisfiable without a controlled amendment to this contract. This is `GAP-003`/`GAP-005` and is the root dependency of the entire Track B programme.

The third CHECK is written as an **implication**, not an equality. The frozen design therefore already anticipated non-discovery origins and reserved the shape for them; only the enumeration is closed. That materially lowers the amendment's risk and is the reason `19_CONTROLLED_AMENDMENT_PLAN.md` classifies it as an enumeration widening rather than a schema redesign.

## 6. False gaps — believed missing, actually present

| Believed missing | Reality | Evidence |
|---|---|---|
| Contacts entirely absent | **Fully designed backend-side.** Only the UI is missing | `B2_CONTACT_MODEL.md` §2–§6 |
| Track-B revenue impossible | **Already fully supported.** B9 requires no Discovery anywhere | `B9_DUAL_TRACK_COMPATIBILITY.md` §3; `AT-TRACK-1/2` are negative controls |
| Attribution breaks for manual/imported customers | **Designed.** 5 of 7 `origin_kind` values are Track-B native; unattributed revenue is still fully recognized | `B9_ATTRIBUTION_MODEL.md` §4, §7 |
| Conversation assignment missing | Command + event exist | `B5_COMMAND_EVENT_CATALOG.md` §2–§3 |
| Multi-contact-per-Lead impossible | `lead_contacts` many-to-many is frozen in B0 | `B2_CONTACT_MODEL.md` §3 |
| Contact-less Lead invalid | Explicitly valid | `B2_CONTACT_MODEL.md` §5 |
| File attachment needs new tables per domain | Generic `(subject_type, subject_id)`; new subjects are an enum registration | `B11_DOMAIN_ATTACHMENT_MODEL.md` §1 |
| Notes/activity timeline missing | Designed | `B2_NOTE_ACTIVITY_TIMELINE.md` |
| Automation cannot reach messaging | It can, at `approval_required` — mandatory, non-configurable | `B7_ACTION_CATALOG.md` §3 |
| Deal forecasting missing | `weighted_value` exists and is firewalled from revenue | `B6_FORECAST_PROBABILITY.md`; `AT-REV-5` **NC** |
| Business identity resolution unprecedented | `business_identities` already does provider-identity resolution | `B3_BUSINESS_IDENTITY_MODEL.md` §4 |

**Eleven capabilities were reclassified out of `MISSING` by reading frozen source.** Treating any of them as new work would have produced duplicate entities and a second source of truth.

## 7. Orphan analysis

| Orphan | Direction | Severity |
|---|---|---|
| `#/copilot` + capability `inbox.copilot` | UI + **billed entitlement** with no backend domain | **High** — a plan capability is sold in PLAN-GROWTH that no frozen phase implements |
| `#/agent` | UI with no backend domain | High |
| `#/contacts`, `#/companies`, `#/calls` | nav entries → `Placeholder` | Medium (`companies`/`calls` should be resolved as *reject* or *defer*, not silently kept) |
| `contacts` table + 3 commands | Backend design with no UI | Medium |
| `AssignConversation` | Backend command with no UI | Medium |
| `Lead.companyId` / `Appointment.contactId` | Frontend fields referencing undefined entities | Low — `B2-D-A004` already rules `CMP-` out of the model |

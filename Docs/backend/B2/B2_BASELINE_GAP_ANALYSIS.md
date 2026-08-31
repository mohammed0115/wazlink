# B2 — Frontend CRM Truth Inventory and Baseline Gap Analysis

> **B2 status:** Reconstruction of current truth before any redesign. Every "current behavior" cell was read directly from the frozen tree at `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`; no prior report was trusted.

## 1. Sources inspected

**Frontend (CRM surface):** `client/src/features/crm/Crm.tsx`, `Lead360.tsx`, `CrmModal.tsx`, `LeadControlPanels.tsx`, `shared.tsx`; `client/src/features/sales/LeadDealControls.tsx`; `client/src/features/automation/AppointmentModal.tsx`; `client/src/services/index.ts` (`crmService`, `taskService`, `appointmentService`), `journey.ts`, `dashboardProjection.ts`, `entitlementService.ts`, `contracts/entitlements.ts`, `contracts/services.ts`, `mock/legacyDataBridge.ts`; `client/src/domain/data.js` (CRM block ll. 500–660, fixtures ll. 211–256, appointments ll. 780–782, 955–970), `intelligence.js`, `sales-ai.js`; `client/src/shared/shell/shellNavigation.ts`, `routeMeta.ts`.

**B0:** `BACKEND_DATA_MODEL.md`, `BACKEND_DOMAIN_OWNERSHIP.md`, `BACKEND_API_CATALOG.md`, `BACKEND_OPENAPI_V1.yaml`, `BACKEND_DTO_CONTRACTS.md`, `BACKEND_STATE_MACHINES.md`, `BACKEND_ERROR_CATALOG.md`, `BACKEND_PUBLIC_ID_REGISTRY.md`, `BACKEND_COMMAND_EVENT_CATALOG.md`, `BACKEND_ANALYTICS_SEMANTICS.md`, `BACKEND_PRIVACY_AND_DATA_HANDLING.md`, `BACKEND_IDEMPOTENCY_STANDARD.md`, `BACKEND_AUTHORIZATION_MATRIX.md`, `BACKEND_WORKSPACE_AUTH.md`.

**B1:** the full published package at `062975e`.

## 2. Frontend CRM truth inventory

Classification: **RUNTIME_CANONICAL** — the frozen app actually performs it and the behavior is product truth. **FIXTURE_ONLY** — the value exists only in seed data and no code produces it. **DERIVED_UI** — computed for display, never stored. **HISTORICAL** — vestigial; superseded elsewhere in the same tree. **MISSING_TARGET_CONTRACT** — real product behavior with no B0/B1 contract to carry it.

### 2.1 Lead

| # | Behavior | Evidence | Class |
|---|---|---|---|
| 1 | Lead created **only** by explicit Business→Lead conversion | `CrmModal.tsx` confirm button → `crmService.convertBusinessToLead` | RUNTIME_CANONICAL |
| 2 | Conversion is refused a second time for the same Business; user is routed to the existing Lead | `data.js:582` `getLeadByBusinessId` → `{kind:"duplicate"}`; `CrmModal.tsx` existing-Lead panel | RUNTIME_CANONICAL |
| 3 | Conversion blocked when analysis status is `analysis_error` or `not_analyzed` | `CrmModal.tsx` `canConvert` | RUNTIME_CANONICAL |
| 4 | Lead fields: `id, businessId, companyId, ownerId, status, priority, tags[], sourceJobId, createdAt, updatedAt, lastActivityAt, nextActivityAt, convertedAt` | `data.js:212` | RUNTIME_CANONICAL |
| 5 | Lead statuses: `new, contacted, qualified, unqualified, nurturing` | `data.js:500` `leadStatusLabels` | RUNTIME_CANONICAL |
| 6 | Lead priorities: `high, medium, low` | `data.js:501` `leadPriorityLabels` | RUNTIME_CANONICAL |
| 7 | Status/priority/owner mutated from Lead 360 selects | `Lead360.tsx` `lead-quick-controls` | RUNTIME_CANONICAL |
| 8 | Every mutation validates the new value against the label map and returns `null` on an unknown value | `data.js:608, 616` `Object.hasOwn(...)` | RUNTIME_CANONICAL |
| 9 | Every mutation writes an activity carrying `from`/`to` in `metadata` | `data.js:600, 610, 618` | RUNTIME_CANONICAL |
| 10 | `actorId` defaults to `CRM_ACTOR_ID = "USR-1001"` and is overridable per call | `data.js:503`, `options.actorId` | RUNTIME_CANONICAL (client-trusted actor — must not survive) |
| 11 | Default owner on conversion is `USR-1001`; default status `new`; default priority `medium` | `data.js:585`; `CrmModal.tsx` passes `{status:"new", priority:"medium"}` | RUNTIME_CANONICAL |
| 12 | `tags` is a free string array; conversion seeds it from `options.tags` (always empty in the UI) | `data.js:585` | RUNTIME_CANONICAL (read) / MISSING_TARGET_CONTRACT (write) |
| 13 | No Lead archive, delete, or reopen surface exists | absence across `features/crm/**` | — |
| 14 | No manual Lead creation surface exists | absence; the only creator is conversion | — |
| 15 | `companyId` → `CMP-*` row created at conversion, mirroring `Business.name` | `data.js:584` | HISTORICAL (registry section B; no B0 table) |
| 16 | `convertedAt` and `createdAt` are always written to the same constant | `data.js:585` | DERIVED_UI (fixture artifact of a frozen clock) |

### 2.2 Contact

| # | Behavior | Evidence | Class |
|---|---|---|---|
| 17 | Conversion creates **at most one** Contact, only when the Business has a phone or email | `data.js:587` | RUNTIME_CANONICAL |
| 18 | Contact fields: `id, leadId, companyId, businessId, name, title, phone, email, status, createdAt` | `data.js:218` | RUNTIME_CANONICAL |
| 19 | Contact name is seeded from `business.name`, title from a constant Arabic string | `data.js:587` | RUNTIME_CANONICAL |
| 20 | Lead 360 renders contacts read-only (`name`, `title`, `phone` or `email`) | `Lead360.tsx` contact card | RUNTIME_CANONICAL |
| 21 | No add/edit/remove Contact surface exists | absence | MISSING_TARGET_CONTRACT |
| 22 | Messaging resolves a Conversation's contact by `conversation.contactId` | `data.js` `getConversationContact` | RUNTIME_CANONICAL |
| 23 | `contacts` carries `status:"active"` but nothing ever changes it | fixtures + absence of a writer | FIXTURE_ONLY |

### 2.3 Task

| # | Behavior | Evidence | Class |
|---|---|---|---|
| 24 | Tasks are created from Lead 360 with `title, type, ownerId, priority, dueAt` | `Lead360.tsx` `submitTask` → `crmService.addLeadTask` | RUNTIME_CANONICAL |
| 25 | Task fields: `id, leadId, status, ownerId, priority, type, title, when, dueAt, createdAt, completedAt, scheduleStatus, route` | `data.js:235` | RUNTIME_CANONICAL |
| 26 | `completeLeadTask` sets `status="completed"`, `completedAt`, and is a no-op when already completed | `data.js:635` | RUNTIME_CANONICAL |
| 27 | Task `status` values ever **written** by code: `pending` (create), `completed` (complete) | `data.js:629, 637` | RUNTIME_CANONICAL |
| 28 | Task status `overdue` appears only in seed data and is fully implied by `dueAt < now` | `data.js:235` `TSK-1042`; no writer | FIXTURE_ONLY |
| 29 | `when`, `scheduleStatus`, `route` are display strings derived from `dueAt` and `leadId` | `data.js:629` | DERIVED_UI |
| 30 | Task `type` is a free Arabic string chosen from a 3-option `<select>` (`متابعة/اتصال/اجتماع`) plus fixture values (`عرض`, `متابعة واتساب`) | `Lead360.tsx` task form; `data.js:235` | RUNTIME_CANONICAL (free text) |
| 31 | Task priority defaults to the Lead's priority; owner defaults to the Lead's owner | `data.js:629` | RUNTIME_CANONICAL |
| 32 | Automation creates Tasks through the same CRM function | `data.js:966` `create_task` → `addLeadTask` | RUNTIME_CANONICAL |
| 33 | No task edit, reassign, reopen, or cancel surface exists | absence | MISSING_TARGET_CONTRACT (cancel) / — (reopen) |
| 34 | Dashboard surfaces the earliest `overdue` task workspace-wide | `dashboardProjection.ts:88` | RUNTIME_CANONICAL |

### 2.4 Appointment

| # | Behavior | Evidence | Class |
|---|---|---|---|
| 35 | Appointments are created from a modal with `title, leadId, ownerId, startsAt, endsAt, type, locationType, location` | `features/automation/AppointmentModal.tsx` | RUNTIME_CANONICAL |
| 36 | Statuses: `scheduled, completed, cancelled, no_show` | `data.js:780` | RUNTIME_CANONICAL (vocabulary) |
| 37 | Types: `call, meeting, demo, follow_up`; locations: `phone, online, office, other` | `data.js:781–782` | RUNTIME_CANONICAL |
| 38 | Creation validates: Lead exists, owner exists, ISO instants, `endsAt > startsAt`, known type, known location | `data.js:960` | RUNTIME_CANONICAL |
| 39 | An owner time overlap sets a **non-blocking** `overlapWarning`; creation still succeeds | `data.js:961` | RUNTIME_CANONICAL |
| 40 | Optional `dealId`, validated to belong to the same Lead | `data.js:960` | RUNTIME_CANONICAL |
| 41 | Only `scheduled` is ever written; `completed/cancelled/no_show` have no writer | `data.js:961`; absence | FIXTURE_ONLY (the three terminal states) |
| 42 | Appointments are read-only inside Lead 360 (count + first appointment) | `LeadControlPanels.tsx` `LeadAutomationControls` | RUNTIME_CANONICAL |
| 43 | Automation can create an Appointment | `data.js:967` | RUNTIME_CANONICAL |

### 2.5 Note

| # | Behavior | Evidence | Class |
|---|---|---|---|
| 44 | Notes are added from Lead 360 with a body only | `Lead360.tsx` `submitNote` | RUNTIME_CANONICAL |
| 45 | Note fields: `id, leadId, authorId, body, createdAt` | `data.js:240` | RUNTIME_CANONICAL |
| 46 | Empty/whitespace bodies are rejected | `data.js:623` | RUNTIME_CANONICAL |
| 47 | Notes are listed newest-first | `data.js:511` | RUNTIME_CANONICAL |
| 48 | No note edit or delete surface exists | absence | MISSING_TARGET_CONTRACT |
| 49 | `NOTE-` has **no** B0 backend prefix and there is **no** `notes` table in B0 | `BACKEND_PUBLIC_ID_REGISTRY.md` §B; `BACKEND_DATA_MODEL.md` CRM row | MISSING_TARGET_CONTRACT |

### 2.6 Activity timeline, last/next activity, contacted

| # | Behavior | Evidence | Class |
|---|---|---|---|
| 50 | `crm_activities` equivalent (`mockModel.activities`) is append-only; no code updates or deletes an entry | `data.js` `logLeadActivity`; absence of any writer | RUNTIME_CANONICAL |
| 51 | Activity fields: `id, leadId, type, actorId, title, detail, metadata, createdAt` | `data.js:241` | RUNTIME_CANONICAL |
| 52 | CRM-owned activity types: `conversion, owner_changed, status_changed, priority_changed, note_added, task_created, task_completed, appointment_created, intelligence_reviewed` | `data.js` call sites; `Lead360.tsx` `timelineIcons` | RUNTIME_CANONICAL |
| 53 | **Messaging writes into the CRM activity store**: `sendMockMessage` and `retryMockMessage` call `logLeadActivity` | `data.js` `sendMockMessage`, `retryMockMessage` | RUNTIME_CANONICAL behavior, **cross-domain ownership violation** |
| 54 | The Lead 360 timeline merges five sources: CRM activities, tasks, appointments, conversation messages, deal activities | `services/journey.ts` `getLeadActivity` | RUNTIME_CANONICAL |
| 55 | Timeline ordering: `timestamp DESC`, tie-broken by `id DESC` | `journey.ts` final `sort` | RUNTIME_CANONICAL |
| 56 | Timeline entries carry a `route` back to the owning surface | `journey.ts` | RUNTIME_CANONICAL |
| 57 | `lastActivityAt` = newest CRM activity `createdAt`, else `convertedAt` | `data.js` `refreshLeadActivityDates` | RUNTIME_CANONICAL |
| 58 | `nextActivityAt` = earliest `dueAt` among non-completed **Tasks** only; Appointments are **excluded** | `data.js:514` `getLeadActivitySummary` | RUNTIME_CANONICAL |
| 59 | `lead.updatedAt` is overwritten with `lastActivityAt` on every activity | `data.js` `refreshLeadActivityDates` | RUNTIME_CANONICAL |
| 60 | An integrity check asserts `lead.lastActivityAt`/`nextActivityAt` equal the derived values | `data.js:655` check `L` | RUNTIME_CANONICAL |
| 61 | There is **no** `contacted` boolean, **no** `lastContactAt`, and **no** contact-status field anywhere | exhaustive search of `data.js` and `features/crm/**` | — |
| 62 | "Contacted" is a **Lead status value**; the CRM summary counts `status === "contacted"` | `data.js:565` `getCrmSummary` | RUNTIME_CANONICAL |

### 2.7 CRM list, filters, Lead 360 panels

| # | Behavior | Evidence | Class |
|---|---|---|---|
| 63 | List filters: `search, ownerId, status, priority, sourceJobId, city, tier, tag, minScore` | `Crm.tsx` `leadRows`; `data.js:9` `crmFilters` | RUNTIME_CANONICAL |
| 64 | Search text is `business.name + business.category + business.city + lead.id`, matched with `String.includes` (case- and locale-sensitive, unanchored) | `Crm.tsx` | RUNTIME_CANONICAL |
| 65 | Sorts: `updated` (default), `score`, `created`, `name`, `priority`, `lastActivity` | `Crm.tsx` | RUNTIME_CANONICAL |
| 66 | Every sort is **unstable** — no tie-break key | `Crm.tsx` `sort` | RUNTIME_CANONICAL, defect |
| 67 | `city` is joined from Business; `tier` and `minScore` from AI Intelligence; `sourceJobId` from the Lead | `Crm.tsx` `leadRows` | RUNTIME_CANONICAL |
| 68 | Filter option lists are computed from the loaded page, not from a catalog | `Crm.tsx` `cities`, `tags`, `jobsList` | DERIVED_UI |
| 69 | Row selection exists but exposes **no** bulk mutation | `Crm.tsx` selection bar renders only a count | — |
| 70 | Summary tiles: `total, new, contacted, qualified, highPriority, todayTasks` (+ unused `overdueTasks`) | `data.js:565` | RUNTIME_CANONICAL |
| 71 | Lead 360 Intelligence strip renders score, tier, confidence, reasons, services and **`salesApproach`**, all read-only from `getBusinessIntelligence(businessId)` | `Lead360.tsx`; `intelligence.js:84` | RUNTIME_CANONICAL |
| 72 | `salesApproach` is a property of the **Opportunity** (AI), never of the Lead | `intelligence.js:84, 117` | RUNTIME_CANONICAL |
| 73 | Provenance panel renders `Source → Job → Business → Analysis → Opportunity` | `Lead360.tsx` `lead-provenance` | RUNTIME_CANONICAL |
| 74 | Conversations and Deals panels are counts plus navigation; neither mutates | `Lead360.tsx`, `LeadControlPanels.tsx` | RUNTIME_CANONICAL |
| 75 | The AI panel is explicitly read-only ("لا توجد mutation تلقائية") | `LeadControlPanels.tsx` `LeadAiControls` | RUNTIME_CANONICAL |
| 76 | Multiple open Deals per Lead are permitted | `LeadDealControls.tsx` | RUNTIME_CANONICAL |
| 77 | Lead 360 shows **no** revenue or attribution figure | absence in `Lead360.tsx` | RUNTIME_CANONICAL |
| 78 | `crm.core` capability maps to the `leads` usage metric; all three plans include `crm.core` | `entitlementService.ts:26, 31–33` | RUNTIME_CANONICAL |

**`FRONTEND_CRM_BEHAVIORS_FOUND = 78`.**

## 3. Gap matrix — frontend vs B0 vs B1 vs B2 target

Every previously-observed area named in the B2 brief is proved or rejected here.

| # | Area | Frontend truth | B0/B1 truth | Gap real? | B2 target | Class |
|---|---|---|---|---|---|---|
| G1 | **contacted summary** | `status === 'contacted'` count; no boolean field | B0 has no contacted concept | **REJECTED as a gap** — there is nothing to reconcile; `contacted` is a status value | keep as a status value; `has_been_contacted`/`last_contact_at` `NOT_SUPPORTED` | B (C for auto-detection) |
| G2 | **next activity** | earliest open **Task** `dueAt`; appointments excluded | absent from B0 | **REAL** — no contract carries it | single authority: earliest `due_at` among `pending` Tasks; maintained column | A → closed `B2-D-A012` |
| G3 | **last activity** | newest CRM activity, else `convertedAt` | absent from B0 | **REAL** — and cross-domain events make it ambiguous | monotonic `GREATEST()` over a closed qualifying-event set | A → closed `B2-D-A011` |
| G4 | **city filter** | joined from `Business.city` | `Business` is Discovery-owned; no CRM column | **REAL** — no contract for a cross-domain filter | `DISCOVERY_JOIN` via the CRM list read model; never a Lead column | A → closed `B2-D-A014` |
| G5 | **Tier filter** | derived from AI score | Intelligence-owned | **REAL** | `AI_JOIN` via the read model | A → closed `B2-D-A014` |
| G6 | **Tags filter** | `lead.tags[]` on the Lead | no B0 tag contract | **REAL** — read exists, write surface does not | `lead_tags` CRM relation + explicit Add/Remove commands | A → closed `B2-D-A008` |
| G7 | **owner mutation** | `assignLeadOwner(leadId, USR-*)` | frozen `LeadUpdate.owner_ref`; B1 owns Membership | **REAL** — `USR-*` vs Membership | owner is a **Membership** (`MEM-*`), CRM-INV-16 | A → closed `B2-D-A007` |
| G8 | **status mutation** | validated against the label map | frozen `LeadUpdate.status` is an unconstrained string | **REAL** — no enum, no transition rules | 5-value enum + explicit transition table | A → closed `B2-D-A005` |
| G9 | **priority mutation** | validated against the label map | frozen `LeadUpdate.priority` unconstrained | **REAL** | 3-value enum, default `medium`, freely mutable | A → closed `B2-D-A006` |
| G10 | **actorId** | client-supplied, defaulting to a constant | B1: actor comes from the session | **REAL and security-relevant** | actor is derived from the session Membership; `actor` is never client-writable | A → closed `B2-D-A020` |
| G11 | **from/to mutation history** | in activity `metadata` | B0 audit has before/after | **PARTIALLY REJECTED** — B0 audit already carries it | `from`/`to` in both the event payload and the audit row | B |
| G12 | **lastActivityAt** persisted vs derived | persisted **and** recomputed; integrity check asserts equality | absent | **REAL** | maintained column, transactional for CRM events, idempotent for cross-domain events | A → closed `B2-D-A011` |
| G13 | **Sales Approach** | rendered from `Opportunity.salesApproach` | Intelligence-owned | **REJECTED as a CRM gap** — CRM never owned it | AI-owned; CRM references read-only; no CRM field | A → closed `B2-D-A013` |
| G14 | **notes / tasks / timeline event model** | three separate stores + a merge projection | B0 has `tasks` but **no** `notes` table and **no** `crm_activities` table | **REAL** | Note aggregate (amendment) + append-only `crm_activities` + read-time merge | A → closed `B2-D-A009`, `B2-D-A010`; amendments `B2-D-B001`, `B2-D-B002` |
| G15 | **session consistency** | single implicit workspace; `mutate()` re-renders from one store | B1 resolves the active workspace per request | **REJECTED** — B1 already closed this | reuse B1 §4 verbatim | — |
| G16 | **contacts/business relationship** | `contact.leadId` (1:1) + `contact.businessId` | B0 has `contacts` **and** `lead_contacts` (M:N) | **REAL** — the shapes disagree | honor B0: Contact is workspace-scoped and linked M:N through `lead_contacts` | A → closed `B2-D-A015` |
| G17 | **double-click conversion** | second call returns `{kind:"duplicate"}` in a single-threaded store | frozen `201` description: "Lead created or existing Lead returned" | **REAL** — single-threaded JS proves nothing about concurrency | partial unique index + lock + loser re-reads and returns the winner | A → closed `B2-D-A003` |
| G18 | **conversion concurrency** | not expressible in the frozen tree | B0 idempotency standard names Business→Lead conversion | **REAL** | `Idempotency-Key` required + unique index; never two Leads | A → closed `B2-D-A003` |
| G19 | **`GET /leads` list** | fully implemented client-side with 9 filters and 6 sorts | **no `/leads` collection exists in frozen B0**, and B0 restricts filtering/sorting to `/deals` and `/billing/invoices` | **REAL and structural** | new operation + explicit allow-lists; controlled amendment | A → closed `B2-D-A016`; amendment `B2-D-B003` |
| G20 | **`CMP-` Company** | created at conversion | registry section B; no `companies` table | **REAL** | not modelled; Lead → Business directly | A → closed `B2-D-A004` |
| G21 | **Task `overdue`** | a stored status in fixtures only | absent | **REAL** | `overdue` is **derived**, never stored | A → closed `B2-D-A017` |
| G22 | **Appointment overlap** | non-blocking warning | absent | **REAL** | non-blocking `overlap_warning` response field, never a `409` | A → closed `B2-D-A018` |
| G23 | **Messaging writes CRM activities** | `sendMockMessage` → `logLeadActivity` | B0: Messaging must not mutate other domains | **REAL and an ownership violation** | Messaging events reach the timeline by read-time merge; CRM tables are never written by Messaging | A → closed `B2-D-A010` |
| G24 | **Intelligence keyed by Business vs Lead** | `getOpportunityAnalysis(businessId)` | B0: `lead_intelligence_analyses`, unique on `lead/input_fingerprint` | **REAL, but not CRM's to decide** | `Lead360.intelligence` stays the frozen opaque object; the keying decision belongs to the Intelligence domain design | B → `B2-D-B006` |
| G25 | **Lead archive/delete** | no surface | B0 gives every table an `archived_at` | **REAL** | archive-only lifecycle + `lead.archive` permission | A → closed `B2-D-A019`; amendment `B2-D-B004` |
| G26 | **`leads` quota** | `crm.core` → `leads` metric | B0 has `usage_counters` and `ReserveQuota` | **REAL** — nothing says when a Lead consumes the metric | consumed at conversion, released at archive, transactional | A → closed `B2-D-A021` |
| G27 | **Bulk mutations** | selection UI exists; no bulk action | absent | **REJECTED as a gap** — there is no behavior to carry | `NOT_SUPPORTED` in Phase 1 | C |
| G28 | **Manual / imported Lead origin** | no surface; frozen `Lead.business_ref` is **required** | frozen schema forbids a Business-less Lead | **REJECTED for Phase 1** | only `DISCOVERY` origin is enabled | C |

**`BASELINE_GAPS_FOUND = 28`** (22 proved real, 6 explicitly rejected).

## 4. Frontend vocabulary that must NOT be promoted

| Frozen token | Why it is not backend truth | B2 target |
|---|---|---|
| `CMP-1042` / `companies[]` | registry section B; no B0 table; mirrors `Business.name` | dropped — Lead references Business |
| `task.status = "overdue"` | fixture-only; fully implied by `due_at` | derived, never stored |
| `task.when` / `scheduleStatus` / `route` | Arabic display strings computed from `dueAt` | not persisted; client-rendered |
| `contact.status = "active"` | never written by any code path | replaced by `archived_at` semantics |
| `actorId` default `"USR-1001"` | a client-trusted actor | actor is the session Membership; never client-writable |
| `CRM_REFERENCE_TIME` / `nextCrmTimestamp()` | a frozen mock clock | server UTC `now()` |
| `AIR-1042` recommendation | registry section B projection | AI-owned; not a CRM record |
| `CVA-*` conversation activities | registry section B; canonical timeline identity is `ACT-*` | Messaging-owned, merged at read time |
| Arabic task `type` free text | a 3-option `<select>` plus fixture values | free-text `type` preserved (≤60 chars); no enum invented |

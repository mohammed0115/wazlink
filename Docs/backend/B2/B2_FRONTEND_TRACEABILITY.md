# B2 — Frozen Frontend → B2 Target Traceability

> **B2 status:** Traceability only. **No frontend file is modified under B2.** Frozen frontend reference: `30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`.

| # | Frontend behavior | Source | Domain owner | Target operation / read model | DTO | Permission | Acceptance |
|---|---|---|---|---|---|---|---|
| 1 | **Business→Lead conversion** confirmed in a modal | `CrmModal.tsx` confirm → `crmService.convertBusinessToLead` | **CRM** | `POST /businesses/{id}/convert-to-lead` *(frozen)* | `ConvertBusinessRequest` → `Lead` | `business.convert` | AT-CONV-1…10, AT-LEAD-1…4 |
| 2 | **Conversion blocked** for `analysis_error`/`not_analyzed` | `CrmModal.tsx` `canConvert` | CRM (guard) / AI (status) | conversion step 3 | — | `business.convert` | AT-CONV-1, AT-CONV-2, AT-CONV-3 |
| 3 | **Duplicate protection** — existing Lead panel, user routed to it | `CrmModal.tsx` existing branch; `data.js:582` | **CRM** | same operation returns `201` + `X-Lead-Conversion-Outcome: existing` | `Lead` | `business.convert` | AT-DUP-1…5, CF2 |
| 4 | **CRM list** with 9 filters, 6 sorts, search | `Crm.tsx` `leadRows` | **CRM** (read model) | `GET /leads` *(ADD)* | `LeadList`/`LeadListItem` | `lead.view` | AT-LIST-*, AT-FILT-*, AT-SRCH-*, AT-SORT-*, AT-PAGE-* |
| 5 | **Summary tiles** (total/new/contacted/qualified/highPriority/todayTasks) | `data.js:565` `getCrmSummary` | CRM counters, **Dashboard** projection | `GET /dashboard/overview` *(frozen)* | `DashboardOverview` | `analytics.view` | AT-CTD-2 |
| 6 | **Lead 360** aggregate page | `Lead360.tsx` | **CRM** (read model) | `GET /leads/{id}/360` *(frozen, +`notes`)* | `Lead360` | `lead.view` | AT-L360-1…6 |
| 7 | **Status** `<select>` (5 values) | `Lead360.tsx` → `updateLeadStatus` | **CRM** | `PATCH /leads/{id}` *(frozen)* | `LeadUpdate` | `lead.update` | AT-LIFE-1…5 |
| 8 | **Priority** `<select>` (3 values) | `Lead360.tsx` → `updateLeadPriority` | **CRM** | `PATCH /leads/{id}` | `LeadUpdate` | `lead.update` | AT-PRIO-1…4 |
| 9 | **Owner** `<select>` over users | `Lead360.tsx` → `assignLeadOwner` | **CRM** (choice) / **Workspace** (Membership) | `PATCH /leads/{id}` | `LeadUpdate.owner_ref` = `MEM-*` | `lead.assign` | AT-OWN-1…8, CF7, CF8 |
| 10 | **Contacts** rendered read-only | `Lead360.tsx` contact card | **CRM** | `GET /leads/{id}/contacts` *(ADD)* | `ContactList` | `lead.view` | AT-CONT-1…7 |
| 11 | **Contact created at conversion** when phone/email exists | `data.js:587` | **CRM** | inside `ConvertBusinessToLead` | `Contact` | `business.convert` | AT-CONV-8, AT-CONV-9 |
| 12 | **Tasks** list + create form + complete button | `Lead360.tsx` `submitTask`, `taskService.completeLeadTask` | **CRM** | `GET/POST /leads/{id}/tasks`, `POST /tasks/{id}/complete` *(ADD)* | `TaskCreateRequest`/`Task` | `task.view` / `task.manage` | AT-TASK-1…10 |
| 13 | **Overdue task** surfaced on the dashboard | `dashboardProjection.ts:88` | **CRM** | `GET /tasks?overdue=true` *(ADD)* | `TaskList` | `task.view` | AT-TASK-5, AT-TASK-10 |
| 14 | **Appointments** count + first appointment | `LeadControlPanels.tsx` `LeadAutomationControls` | **CRM** | `GET /leads/{id}/appointments` *(ADD)* | `AppointmentList` | `appointment.view` | AT-APPT-1…8 |
| 15 | **Appointment creation** with overlap warning | `features/automation/AppointmentModal.tsx`; `data.js:960` | **CRM** | `POST /leads/{id}/appointments` *(ADD)* | `AppointmentCreateRequest`/`Appointment` | `appointment.manage` | AT-APPT-2, AT-APPT-3 |
| 16 | **Notes** list + add form | `Lead360.tsx` `submitNote` | **CRM** | `GET/POST /leads/{id}/notes` *(ADD)* | `NoteCreateRequest`/`Note` | `lead.view` / `lead.update` | AT-NOTE-1…8 |
| 17 | **Activity timeline** merging 5 sources | `services/journey.ts` `getLeadActivity` | **CRM read model** | `Lead360.activities[]` + `GET /leads/{id}/timeline` *(ADD)* | `TimelineList`/`TimelineEntry` | `lead.view` (+ source permissions) | AT-TL-1…10, AT-TL-MERGE-1…3 |
| 18 | **Messaging writes CRM activities** | `data.js` `sendMockMessage` → `logLeadActivity` | **Messaging** (behavior kept, mechanism moved) | read-time merge; CRM tables never written by Messaging | `TimelineEntry` | `conversation.view` | AT-MSGB-1…4, AT-TL-4 |
| 19 | **last activity** column | `data.js` `refreshLeadActivityDates` | **CRM** | `leads.last_activity_at`, monotonic | `LeadListItem` | `lead.view` | AT-LACT-1…9 |
| 20 | **next follow-up** column | `data.js:514` `getLeadActivitySummary` | **CRM** | `leads.next_activity_at` (tasks-only) | `LeadListItem.next_task_*` | `lead.view` | AT-NACT-1…7 |
| 21 | **contacted** summary counter | `data.js:565` | **CRM** | `status = 'contacted'`; **no boolean field** | `LeadDetail.status` | `lead.view` | AT-CTD-1…6 |
| 22 | **Tags** filter | `Crm.tsx` `filters.tag`; `lead.tags` | **CRM** | `lead_tags` + `POST/DELETE /leads/{id}/tags` *(ADD)* | `LeadTagRequest` | `lead.update` | AT-FILT-3 |
| 23 | **Source / Job / Business / Analysis / Opportunity** provenance panel | `Lead360.tsx` `lead-provenance` | **CRM** (snapshot) / Discovery + AI (originals) | `Lead360` provenance from `lead_provenance` | `Lead360` | `lead.view` | AT-PROV-1…6 |
| 24 | **Intelligence strip** — score, tier, confidence, reasons, services, **salesApproach** | `Lead360.tsx`; `intelligence.js:84` | **AI Intelligence** | `Lead360.intelligence` (opaque, live) | `Lead360` | `lead.view` | AT-AIB-1…5 |
| 25 | **City / Tier / min-score** filters | `Crm.tsx` `leadRows` | Business / AI | list read model joins | `LeadListItem` | `lead.view` | AT-FILT-6, AT-LIST-6 |
| 26 | **Conversations** panel (count + link) | `LeadControlPanels.tsx` `LeadConversationControls` | **Messaging** | `Lead360.conversations[]` (`EntityRef[]`) | `Lead360` | `lead.view` + `conversation.view` | AT-MSGB-2, AT-TL-5 |
| 27 | **Deals** panel; multiple open Deals allowed | `LeadDealControls.tsx` | **Pipeline** | `Lead360.deals[]` (`EntityRef[]`) | `Lead360` | `lead.view` + `deal.view` | AT-PIPEB-1…4 |
| 28 | **Recognized revenue** | *absent from Lead 360* | **Revenue** | `Lead360.revenue_refs[]` — identities only | `Lead360` | `lead.view` | AT-REVB-1…5 |
| 29 | **Attribution** | *absent from CRM* | **Attribution** | not exposed by any CRM operation | — | — | AT-ATTB-1…3 |
| 30 | **AI panel** explicitly read-only | `LeadControlPanels.tsx` `LeadAiControls` | **AI** | no CRM mutation path exists | — | `ai.use` (AI domain) | AT-AIB-3 |
| 31 | **Row selection** with no bulk action | `Crm.tsx` selection bar | — | `NOT_SUPPORTED` (`B2-D-C016`) | — | — | — |
| 32 | **`actorId` client-supplied** | `data.js` `options.actorId` | **B1 Identity** | actor derives from the session Membership; never client-writable | — | — | AT-AUD-6, `B2_API_DTO_CONTRACTS.md` §4.1 |
| 33 | **`CMP-` Company created at conversion** | `data.js:584` | — | **dropped**; Lead references Business directly | — | — | AT-LEAD-3 |
| 34 | **Automation creates tasks / changes lead fields** | `data.js:966–970` | **Automation** invoking CRM commands | the same CRM commands with a system actor | `TaskCreateRequest`, `LeadUpdate` | `task.manage`, `lead.update`, `lead.assign` | AT-TASK-9, AT-PRIO-4, AT-AUD-6 |

## Compatibility guarantees

1. **No frozen required set changes, and three narrow amendments.** `Lead`, `LeadUpdate`, `ConvertBusinessRequest`, `Business`, `EntityRef`, `PageInfo`, and `ErrorEnvelope` are untouched. The three B2 amendments are: one additive `notes` array on `Lead360`, one additive response header on the conversion operation, and 25 new operations. No existing field, type, status code, or required set changes.
2. **No frozen vocabulary changes.** Five lead statuses, three priorities, four appointment statuses, four appointment types, four location types, six capability IDs, five usage metrics, and six RBAC roles are all preserved verbatim.
3. **Adapter-only frontend migration.** Every change lands behind `crmService`, `taskService`, `appointmentService`, and `journeyProjection`. No route change, no hash-router change, no domain rewrite — the migration path B0 promised.
4. **Three genuinely new UI surfaces:** contact add/edit, note removal, and appointment lifecycle actions (complete/cancel/no-show). Each is an additive control on an existing screen, not a new screen.
5. **Four semantic corrections the frontend must make**, each a correctness or security issue rather than a cosmetic one:
   - `ownerId` (`USR-*`) becomes `owner_ref` (`MEM-*`) — a global user identity is not a workspace ownership token.
   - `actorId` disappears from every call — a client-supplied actor is an impersonation surface.
   - `task.status === "overdue"` becomes the computed `is_overdue` — a stored flag is wrong between ticks.
   - `companyId`/`CMP-*` disappears — it duplicates `Business.name` with no backend table.
6. **One behavior the frontend keeps but the backend implements differently:** messaging entries still appear on the Lead timeline (#18), but they arrive by read-time merge rather than by Messaging writing a CRM row. The rendered timeline is unchanged; the ownership violation is gone.

# B2 — CRM Domain Ownership

> **B2 status:** Ownership design only. Exactly one domain may write each business fact. Nothing below duplicates an authority that B0 already assigned.

## 1. One owner per CRM fact

| Business fact | Durable owner | Authoritative storage | Written by | Read by | Never written by |
|---|---|---|---|---|---|
| Lead existence and identity | **CRM** | `leads.public_id` | `ConvertBusinessToLead` | everything | Discovery, AI, Automation directly |
| Lead status | **CRM** | `leads.status` | `ChangeLeadStatus` | list, 360, analytics | AI, Messaging, Pipeline |
| Lead priority | **CRM** | `leads.priority` | `ChangeLeadPriority` | list, 360 | AI (may only recommend) |
| Lead owner | **CRM** | `leads.owner_membership_id` | `AssignLeadOwner` | list, 360 | Workspace domain (membership lifecycle never reassigns Leads) |
| Lead tags | **CRM** | `lead_tags` | `AddLeadTag`, `RemoveLeadTag` | list filter, 360 | AI, Automation |
| Lead provenance | **CRM** (snapshot of others' identities) | `lead_provenance` | `ConvertBusinessToLead` only; immutable thereafter | 360 provenance panel | anything (append-only, never updated) |
| Lead archive state | **CRM** | `leads.archived_at` | `ArchiveLead` | list, 360 | cascade from any other domain |
| `last_activity_at` | **CRM** | `leads.last_activity_at` | CRM commands transactionally; cross-domain events through the idempotent updater | list, 360 | direct writes from other domains |
| `next_activity_at` | **CRM** | `leads.next_activity_at` | recomputed inside every Task mutation transaction | list, 360 | anything else |
| Contact identity and fields | **CRM** | `contacts` | `AddContact`, `UpdateContact` | 360, Messaging | Messaging (may only read) |
| Lead↔Contact link | **CRM** | `lead_contacts` | `AddContact`, `RemoveContact` | 360, Messaging | — |
| Task | **CRM** | `tasks` | the five Task commands | 360, dashboard, list `next_activity` | Automation writes only *through* `CreateTask` |
| Appointment | **CRM** | `appointments` | the five Appointment commands | 360, dashboard | external calendars (no sync in Phase 1) |
| Note | **CRM** | `notes` | `AddNote`, `RemoveNote` | 360 | anything else |
| CRM activity entry | **CRM** | `crm_activities` | CRM commands only, append-only | timeline projection | **Messaging, Pipeline, AI, Automation — all forbidden** |
| Merged Lead timeline | **CRM read model** | none (computed) | nothing | 360, `GET /leads/{id}/timeline` | — |
| Manual CRM activity | **CRM** | `crm_activities` with `source_domain='crm'` | CRM commands | timeline | — |
| Sales Approach | **AI Intelligence** | `opportunities.sales_approach` | `AnalyzeLead` | Lead 360 (read-only) | **CRM** |
| Opportunity score / tier / confidence | **AI Intelligence** | analyses + signals | `AnalyzeLead` | Lead 360, list read model | **CRM** |
| Business name / category / city / phone / website | **Discovery/Business** | `businesses` | `UpsertBusiness`, `MergeBusiness` | Lead 360, list read model | **CRM** |
| Discovery Job identity | **Discovery** | `discovery_jobs` | Discovery commands | provenance panel | **CRM** |
| Conversation, message, unread count | **Messaging** | `conversations`, `messages` | Messaging commands | Lead 360 panel, timeline merge | **CRM** |
| Deal value, stage, probability, close state | **Pipeline** | `deals` | Pipeline commands | Lead 360 panel, timeline merge | **CRM** |
| Recognized revenue | **Revenue** | `revenue_events` | `RecordRevenueEvent` only | Analytics | **CRM, Pipeline, Billing** |
| Attribution allocation | **Attribution** | `attribution_touchpoints` | `RecordTouchpoint` | Analytics | **CRM** |
| Automation run and approval | **Automation** | `automation_runs` | Automation commands | Lead 360 panel | **CRM** |
| File attachment | **Files** | `file_assets` | `CreateUpload` | 360 (Phase 2) | **CRM** |
| Membership, role, workspace | **Workspace / Identity (B1)** | `memberships`, `users` | B1 commands | CRM owner resolution | **CRM** |

## 2. The canonical journey — who owns each transition

| Hop | Transition | Owning domain | Command | Event | CRM's role |
|---|---|---|---|---|---|
| `SRC-1004 → JOB-1028` | a source produces a job | Discovery | `CreateDiscoveryJob` | `DiscoveryJobQueued` | none — CRM only snapshots the identity |
| `JOB-1028 → BUS-1042` | a job discovers a business | Discovery/Business | `UpsertBusiness` | `BusinessDiscovered` | none. **B0 forbids Lead auto-create** ("no Lead auto-create") |
| `BUS-1042 → ANL/OPP` | a business is analyzed | AI Intelligence | `AnalyzeLead` | `LeadIntelligenceCompleted` | none — read-only reference |
| **`BUS-1042 → LEAD-1042`** | **a human decides to pursue** | **CRM** | **`ConvertBusinessToLead`** | **`LeadCreated`** | **owner of this hop and only this hop** |
| `LEAD-1042 → CONV-3042` | a conversation is opened against a Lead | Messaging | `SendMessage` / `ReceiveMessage` | `MessageSent` / `MessageReceived` | CRM stores nothing; Messaging stores `lead_id` |
| `LEAD-1042 → DEAL-4042` | a deal is opened against a Lead | Pipeline | `CreateDeal` | `DealCreated` | CRM stores nothing; Pipeline stores `lead_id` |
| `DEAL-4042 → REV-*` | **no such transition exists** | Revenue | `RecordRevenueEvent` (independent) | `RevenueRecognized` | **CRM must never infer it** |

**Reference direction is uniform: the downstream domain stores the upstream key.** `conversations.lead_id`, `deals.lead_id`, `revenue_events.source_ref`, `attribution_touchpoints.source_ref` all point *at* the Lead. The Lead points only at `business_id` and `source_job_id`. A Lead therefore never has to be updated when a Conversation, Deal, RevenueEvent, or Touchpoint is created — which is what makes the Lead row stable under downstream activity.

## 3. Boundaries

### 3.1 CRM ↔ Discovery / Business
CRM reads Business by `business_id` under the active-workspace scope. CRM never writes a Business field and never creates a Business. Business re-crawling changes `name`, `city`, `category`, `phone` — the Lead is unaffected because it copied none of them, and `lead_provenance` preserves what was true at conversion time.

### 3.2 CRM ↔ AI Intelligence
`Lead360.intelligence` is the frozen opaque object (`{"type":"object","nullable":true}`) supplied by the Intelligence domain. CRM stores no score, tier, confidence, reason, service, or sales approach. Regenerating an analysis changes what Lead 360 renders and changes nothing the Lead owns (CRM-INV-4, CRM-INV-12).

### 3.3 CRM ↔ Messaging
Messaging owns conversations and messages and stores `lead_id`. In the frozen frontend, Messaging writes rows into the CRM activity store (`sendMockMessage` → `logLeadActivity`) — behavior that is product-true but architecturally wrong. **B2 keeps the behavior and moves the mechanism:** messaging entries appear on the Lead timeline by read-time merge from `messages`, and Messaging never writes `crm_activities`. `MessageSent`/`MessageReceived` additionally feed the `last_activity_at` updater (§4).

### 3.4 CRM ↔ Pipeline
Pipeline owns Deals and stores `lead_id`. Many open Deals per Lead are permitted (frozen `LeadDealControls.tsx`). Lead 360 renders Deal counts and links from Pipeline reads. Archiving a Lead never closes, deletes, or mutates a Deal.

### 3.5 CRM ↔ Revenue and Attribution
CRM emits no revenue event and reads no revenue amount into any authoritative field. `Lead360.revenue_refs` (frozen) carries `EntityRef`s only — identities, never amounts. Any monetary figure rendered near a Lead is fetched from Analytics/Revenue at render time and labelled with its own semantics per `BACKEND_ANALYTICS_SEMANTICS.md`.

### 3.6 CRM ↔ Automation
Automation may create Tasks, create Appointments, and change Lead status/priority/owner — but **only by invoking the CRM commands**, through the application-service boundary, with `actor = system:automation_run:<RUN-*>` recorded in audit and in `crm_activities.actor_ref`. Automation never writes a CRM table. Sensitive actions still require approval per B0. This is exactly how the frozen tree already behaves (`data.js` automation actions call `addLeadTask`, `updateLeadPriority`, `updateLeadStatus`, `assignLeadOwner`).

### 3.7 CRM ↔ Files
Out of Phase-1 CRM scope. No CRM DTO carries an attachment.

## 4. Cross-domain events CRM consumes

CRM subscribes to a **closed set of 9** contracts. B2-FIX.1 corrects the earlier claim that the set exists "purely to maintain `last_activity_at`": three of the nine do something else, so each effect is now stated individually. The authoritative table is `B2_COMMAND_EVENT_CATALOG.md` §4 and this table is identical to it.

| # | Consumed contract | Owning domain | Effect on CRM | Forbidden effect |
|---|---|---|---|---|
| 1 | `MessageSent` | Messaging | `last_activity_at = GREATEST(last_activity_at, occurred_at)` | changing `status` to `contacted` |
| 2 | `MessageReceived` | Messaging | same | any status/priority change |
| 3–6 | `DealCreated`, `DealStageChanged`, `DealWon`, `DealLost` | Pipeline | same | writing any Deal value into the Lead |
| 7 | `BusinessMerged` | Discovery/Business | re-point `leads.business_id` to the surviving Business inside the merge transaction; `lead_provenance` is untouched. Where the partial unique index would be violated, archive the losing Lead, emit `LeadArchived` with `reason='business_merged'`, and write one `lead_business_merged` activity | creating a Lead; archiving any Lead other than the one the merge collides with; rewriting `lead_provenance` |
| 8 | `LeadIntelligenceCompleted` | AI | **none** — analysis is not activity | touching any Lead column |
| 9 | `BusinessRediscoveredSignal` *(CRM-side semantic name; producer contract pending B3)* | Discovery | append one `lead_provenance_additional_jobs` row via `RecordLeadRediscoveryProvenance` | creating a Lead; touching `lead_provenance`; moving `last_activity_at`; writing `crm_activities` |

**The single exception.** Contract 7 is the **only** consumed event permitted to archive a Lead or write `crm_activities`, and only to preserve the partial unique `(workspace_id, business_id) WHERE archived_at IS NULL` invariant its own merge would otherwise break. No other consumed event may create, archive, or re-own a Lead, change `status` or `priority`, or write `crm_activities`. Stated identically in `B2_COMMAND_EVENT_CATALOG.md` §4 and `B2_CRM_ACTIVITY_VOCABULARY.md` §2.1.

Consumers are idempotent by `event_id`. Because the activity-date update is `GREATEST()` — and **only** because of that, never through an aggregate-version or arrival-order comparison, which B0's envelope could not supply and which would discard recovered events — replay and out-of-order delivery are both safe (CRM-INV-17); contracts 7 and 9 are made replay-safe by unique constraints instead, not by `GREATEST()`. Every consumed `occurred_at` first passes the clock-skew admission rule in `B2_TIMELINE_IDENTITY_MODEL.md` §5. Failing that check is a **retryable processing failure**, never a processed event: the delivery is not acknowledged as successful, and it recovers by bounded retry or alerted dead-letter replay (§5.5). The concrete retry scheduler, dead-letter store, and replay tooling are owned by **B12 — Async & Integration Platform**; B2 depends on that capability and designs none of it.

## 5. What CRM deliberately does not own

`Company`, `Person`/global contact identity, campaign, product/catalog, quote, contract, forecast, territory, lead-scoring model, email-sequence, and calendar synchronization are **not** CRM concepts in Phase 1. Each is absent from the frozen frontend, from B0's data model, and from B0's public-ID registry. Introducing any of them would create a second authority for a fact another domain already owns, or invent a domain with no product requirement.

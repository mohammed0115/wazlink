# B2 — CRM Command and Event Catalog

> **B2 status:** Target catalog only. Events are delivered through the B0 transactional outbox (ADR-005) and are never an alternative canonical write store. **No provider call occurs inside a CRM transaction.**

Every command carries **workspace, actor, request ID, idempotency key (where applicable), and authorization context**.

**The event envelope is B0's, unchanged.** `BACKEND_COMMAND_EVENT_CATALOG.md` states it and B2 restates it without addition: *"All events carry event ID, workspace, aggregate public ID, occurred timestamp, actor/system source, schema version, and correlation/request ID."*

**B2 adds no envelope field.** An earlier B2 draft rendered this sentence with `aggregate version` inserted and `correlation/request ID` replaced by `correlation/causation ID`, and described the result as B0 restated verbatim. It was neither: B0 defines no `aggregate version` and no causation identifier in the envelope, and widening it would have been an unregistered amendment to a frozen artifact. B2-FIX.2 aligns B2 back to B0 rather than registering an amendment for accidental drift (`B2_CONTROLLED_AMENDMENTS.md` §7). **No B2 contract depends on `aggregate_version` or on a causation identifier** — in particular, timeline identity depends on `source_event_id` read from a source record (`B2_TIMELINE_IDENTITY_MODEL.md` §2.2.1) and never on an aggregate version.

## 1. Commands (22)

| Command | Aggregate | Actor | Permission | Idempotency | Concurrency | Emits |
|---|---|---|---|---|---|---|
| `ConvertBusinessToLead` | Lead | member | `business.convert` | key **required** | Business `FOR UPDATE` + partial unique | `LeadCreated` **always**; one `ContactAdded` per Contact created in the same transaction (zero or one in Phase 1) |
| `ChangeLeadStatus` | Lead | member | `lead.update` | — | `FOR UPDATE` + `If-Match` | `LeadStatusChanged` |
| `ChangeLeadPriority` | Lead | member | `lead.update` | — | `FOR UPDATE` + `If-Match` | `LeadPriorityChanged` |
| `AssignLeadOwner` | Lead | member | `lead.assign` | — | `FOR UPDATE` + `If-Match` | `LeadOwnerChanged` |
| `AddLeadTag` | Lead | member | `lead.update` | — | unique `(lead_id, tag)` | `LeadTagAdded` |
| `RemoveLeadTag` | Lead | member | `lead.update` | — | `FOR UPDATE` + `If-Match` | `LeadTagRemoved` |
| `ArchiveLead` | Lead | member | `lead.archive` | — | `FOR UPDATE` + `If-Match` | `LeadArchived` |
| `AddContact` | Contact | member | `lead.update` | key optional | partial unique primary link | `ContactAdded` |
| `UpdateContact` | Contact | member | `lead.update` | — | `FOR UPDATE` + `If-Match` | `ContactUpdated` |
| `RemoveContact` | Contact | member | `lead.update` | — | `FOR UPDATE` + `If-Match` | `ContactRemoved` |
| `CreateTask` | Task | member / `system:automation` | `task.manage` | key optional | insert + Lead lock for `next_activity_at` | `TaskCreated` |
| `UpdateTask` | Task | member | `task.manage` | — | `FOR UPDATE` + `If-Match` | `TaskUpdated` |
| `AssignTask` | Task | member | `task.manage` | — | `FOR UPDATE` + `If-Match` | `TaskAssigned` |
| `CompleteTask` | Task | member | `task.manage` | — | `FOR UPDATE` + `If-Match` | `TaskCompleted` |
| `CancelTask` | Task | member | `task.manage` | — | `FOR UPDATE` + `If-Match` | `TaskCancelled` |
| `ScheduleAppointment` | Appointment | member / `system:automation` | `appointment.manage` | key optional | insert + overlap read | `AppointmentCreated` |
| `RescheduleAppointment` | Appointment | member | `appointment.manage` | — | `FOR UPDATE` + `If-Match` | `AppointmentRescheduled` |
| `CancelAppointment` | Appointment | member | `appointment.manage` | — | `FOR UPDATE` + `If-Match` | `AppointmentCancelled` |
| `CompleteAppointment` | Appointment | member | `appointment.manage` | — | `FOR UPDATE` + `If-Match` | `AppointmentCompleted` |
| `MarkAppointmentNoShow` | Appointment | member | `appointment.manage` | — | `FOR UPDATE` + `If-Match` | `AppointmentNoShowRecorded` |
| `AddNote` | Note | member | `lead.update` | key optional | insert | `NoteAdded` |
| `RemoveNote` | Note | member (author or rank ≥ manager) | `lead.update` + object condition | — | `FOR UPDATE` + `If-Match` | `NoteRemoved` |

**22 commands.** No command duplicates another's effect, and every state transition in `B2_STATE_MACHINES.md` is reachable by exactly one command.

**State-machine mapping: 22 of 22 are mapped.** `UNMAPPED_STATE_COMMANDS = 0`.

**Commands deliberately absent**, each with its reason: `CreateLead` (manual origin `NOT_SUPPORTED`, `B2-D-C001`) · `UpdateLead` (decomposed into the three field commands so each carries its own permission, guard, event, and audit) · `DeleteLead` (archive-only, `B2_LEAD_AGGREGATE.md` §7) · `UnarchiveLead` (`B2-D-C006`) · `ReopenTask` (`B2-D-C009`) · `UpdateNote` (`B2-D-C012`) · every bulk command (`B2-D-C016`) · `AcceptSalesApproach` (`B2-D-A013`; AI output is never adopted silently, and no adoption surface exists) · `MarkContacted` (contacted is a `status` value, `B2_LEAD_AGGREGATE.md` §6).

**`Idempotency` column transport.** "key required"/"key optional" always means the **`Idempotency-Key` HTTP header**. No command takes an idempotency value in its request body.

**Automation as actor.** `CreateTask`, `ScheduleAppointment`, `ChangeLeadStatus`, `ChangeLeadPriority`, and `AssignLeadOwner` may be invoked by the Automation domain through the application-service boundary, with `actor_type = 'system:automation'` and `actor_label = 'automation_run:RUN-*'`. Automation never writes a CRM table directly and never bypasses a guard. Sensitive automation actions still require approval per B0.

## 2. Events (22)

| Event | Payload beyond the envelope | PII | Consumers | Outbox | Idempotency expectation |
|---|---|---|---|---|---|
| `LeadCreated` | `lead_ref`, `business_ref`, `source_job_ref`, `owner_ref`, `origin_type`, `converted_at` | none | Analytics (Leads created, conversion cohort), Entitlements (`leads` usage), Attribution, Automation | **required** | consumer keyed by `event_id`; must not double-count the `leads` metric |
| `LeadStatusChanged` | `lead_ref`, `from`, `to` | none | Analytics, Automation, Audit | required | idempotent |
| `LeadPriorityChanged` | `lead_ref`, `from`, `to` | none | Automation, Audit | required | idempotent |
| `LeadOwnerChanged` | `lead_ref`, `from_owner_ref`, `to_owner_ref` | none | Notifications, Automation, Audit | required | idempotent notify within the dedup window |
| `LeadTagAdded` / `LeadTagRemoved` | `lead_ref`, `tag` | none | Analytics | required | idempotent |
| `LeadArchived` | `lead_ref`, `archived_at`, `reason` (`user` \| `business_merged`) | none | Entitlements (release `leads`), Analytics | **required** | consumer keyed by `lead_ref`; must not release the metric twice |
| `ContactAdded` | `contact_ref`, `lead_ref`, `source`, `is_primary` | none — **no name, phone, or email** | Messaging (contact availability), Analytics | required | idempotent |
| `ContactUpdated` | `contact_ref`, `changed_field_names[]` | none — **field names only, never values** | Messaging | required | idempotent |
| `ContactRemoved` | `contact_ref`, `lead_ref` | none | Messaging | required | idempotent |
| `TaskCreated` | `task_ref`, `lead_ref`, `assignee_ref`, `due_at`, `priority`, `origin` | none — **no title** | Notifications, Analytics, Automation | required | idempotent notify |
| `TaskUpdated` | `task_ref`, `changed_field_names[]` | none | Analytics | required | idempotent |
| `TaskAssigned` | `task_ref`, `from_assignee_ref`, `to_assignee_ref` | none | Notifications | required | idempotent |
| `TaskCompleted` | `task_ref`, `lead_ref`, `completed_at` | none | Analytics, Automation | required | idempotent; a completion count must never double |
| `TaskCancelled` | `task_ref`, `lead_ref`, `cancelled_at` | none | Analytics | required | idempotent |
| `AppointmentCreated` | `appointment_ref`, `lead_ref`, `deal_ref`, `organizer_ref`, `start_at`, `end_at`, `type` | none — **no location string** | Notifications, Analytics, Automation | required | idempotent notify |
| `AppointmentRescheduled` | `appointment_ref`, `from_start_at`, `to_start_at`, `from_end_at`, `to_end_at` | none | Notifications | required | idempotent |
| `AppointmentCancelled` | `appointment_ref`, `cancelled_at` | none | Notifications, Analytics | required | idempotent |
| `AppointmentCompleted` | `appointment_ref`, `completed_at` | none | Analytics | required | idempotent |
| `AppointmentNoShowRecorded` | `appointment_ref`, `completed_at` | none | Analytics | required | idempotent |
| `NoteAdded` | `note_ref`, `lead_ref`, `author_ref` | none — **no body** | Analytics | required | idempotent |
| `NoteRemoved` | `note_ref`, `lead_ref` | none | Analytics | required | idempotent |

**22 event types.** Every event maps to at least one owning command, and every command emits at least one event.

`ContactAdded` has **two** owning commands, `ConvertBusinessToLead` and `AddContact`; every other event has exactly one. `STATE_EVENT_DRIFT = 0`.

**Events deliberately not emitted:** `LeadUpdated` (B0's generic event is **superseded** by the three field-specific events so a consumer can react to an owner change without parsing a diff — recorded as `B2-D-B010`, a controlled refinement of B0's event catalog, not silent drift) · `BusinessConvertedToLead` (`LeadCreated` already carries `origin_type` and the full provenance; a second event for one transition would let two consumers double-count conversions) · `LeadContactedDetected` (contacted is a human decision, `B2_LEAD_AGGREGATE.md` §6) · any AI, revenue, or attribution event (other domains own them).

## 3. Payload rules

1. **Never in any CRM payload:** contact name, phone, email; note body; task or appointment title; appointment `location`; message content; any raw provider payload; any credential; any recognized-revenue or attribution amount.
2. **Refs, not embeddings.** Events carry `EntityRef`s and enum values only. A consumer that needs an attribute re-reads it live under that workspace's scope, so it can never act on a stale copy of authorization-relevant state.
3. **Field names, not values.** `ContactUpdated` and `TaskUpdated` carry `changed_field_names[]`. This lets a consumer react to *what* changed without the bus carrying PII.
4. **Outbox coupling.** Every "required" event is written to `outbox_events` in the same transaction as its durable state change (ADR-005). A dispatcher publishes to Celery. Consumers are idempotent by `(command_id, effect_type)` per the B0 idempotency standard.
5. **No event grants authority.** No consumer may treat an event as authorization. **`LeadCreated` in particular never authorizes creating a Deal, a Conversation, a RevenueEvent, or an AttributionTouchpoint** — each of those is its own domain's command, with its own permission.
6. **No provider call inside the transaction.** Notification, AI, messaging, and calendar side effects are triggered by outbox consumers after commit, never inline. This is what keeps a CRM write independent of provider availability.
7. **Out-of-order safety comes from `GREATEST()`, and from nothing else.** `last_activity_at := GREATEST(current, eligible_event.occurred_at)` is order-independent by construction: the maximum of a set does not depend on the order its members arrive in. A consumer therefore **evaluates every eligible qualifying event through `GREATEST()`**, whatever order it arrives in.

   **A consumer must NOT discard a delivery on the basis of an aggregate version, a delivery position, or an arrival order.** Frozen B0 defines no `aggregate version` in the event envelope (see this document's opening envelope statement), so no B2 contract may require one; and version-based discarding would be actively wrong here, because the recovery path of `B2_TIMELINE_IDENTITY_MODEL.md` §5.5 re-processes an event **after** later events from the same aggregate have already been applied. That recovered event carries the *newest* `occurred_at` precisely because it was future-dated — discarding it as "stale" would drop the very event recovery exists to preserve, reinstating the permanent under-count §5.5 closes. See `B2_LEAD_AGGREGATE.md` §4 and CRM-INV-17.

## 4. Events CRM consumes (9)

A **closed set of 9**. Consumption is idempotent by `event_id`. The set is no longer describable as "all → `last_activity_at`": three of the nine do something else, and B2-FIX.1 states each effect individually rather than by a blanket rule that three members contradict.

| # | Consumed contract | Owning domain | Effect on CRM | Writes `crm_activities`? | Moves `last_activity_at`? |
|---|---|---|---|---|---|
| 1 | `MessageSent` | Messaging | activity date only | no | **yes** |
| 2 | `MessageReceived` | Messaging | activity date only | no | **yes** |
| 3 | `DealCreated` | Pipeline | activity date only | no | **yes** |
| 4 | `DealStageChanged` | Pipeline | activity date only | no | **yes** |
| 5 | `DealWon` | Pipeline | activity date only | no | **yes** |
| 6 | `DealLost` | Pipeline | activity date only | no | **yes** |
| 7 | `BusinessMerged` | Discovery | re-point `leads.business_id` to the surviving Business; where the partial unique index would be violated, archive the losing Lead, emit `LeadArchived` with `reason='business_merged'`, and write one `lead_business_merged` activity | **yes — the sole exception** | no |
| 8 | `LeadIntelligenceCompleted` | AI | **none.** A machine re-scoring a Business is not activity on the Lead (CRM-INV-12) | no | no |
| 9 | `BusinessRediscoveredSignal` *(CRM-side semantic name; producer contract pending B3)* | Discovery | append one `lead_provenance_additional_jobs` row through `RecordLeadRediscoveryProvenance` (§5) | no | no |

**The one exception, stated once.** Contract 7 is the **only** consumed event authorized to archive a Lead or write `crm_activities`, and it may do so **only** to preserve the partial unique `(workspace_id, business_id) WHERE archived_at IS NULL` invariant that Discovery's own merge would otherwise break. It is stated in identical terms in `B2_DOMAIN_OWNERSHIP.md` §4 and `B2_CRM_ACTIVITY_VOCABULARY.md` §2.1.

**Otherwise unchanged:** no consumed event may create or re-own a Lead, change its `status` or `priority`, bump the Lead's `version`, consume quota, or write any CRM table other than the one its row above names.

**Timestamp admission — and what it does not govern.** Every consumed event's `occurred_at` passes the clock-skew check in `B2_TIMELINE_IDENTITY_MODEL.md` §5.2 before it may move `last_activity_at`. A rejected timestamp does not advance the column and never silently poisons the activity date. **A rejection is a retryable processing failure, not a processed event:** the delivery is classified `RETRYABLE_CLOCK_SKEW` and is **not** acknowledged as successfully completed, so it is re-delivered under a bounded retry policy and, if that budget is exhausted while still invalid, becomes `DEAD_LETTERED` with `reason = CLOCK_SKEW`, an operational alert, and a replay path. Recovery is therefore *caused* by the consumer contract in §5.5, not assumed from source redelivery — at-least-once delivery guarantees nothing once a message has been acknowledged.

**No consumed event puts anything on the timeline.** Under `CROSS_DOMAIN_TIMELINE_MODEL = READ_TIME_MERGE`, cross-domain timeline entries are constructed from the owning domain's own records during retrieval and are **never persisted by CRM** (`B2_TIMELINE_IDENTITY_MODEL.md` §7). The `Effect on CRM` column above is therefore exhaustive: for contracts 1–6 the *only* durable effect is `last_activity_at`. Whether the corresponding record appears in a Lead's timeline is decided entirely by the read algorithm in §7.2, including its own clock-skew eligibility step, and not by anything this consumer does.

## 5. Inbound application processes (1)

A **process** is CRM application-level behavior triggered by a consumed event rather than by an authenticated command. It has no permission, no `Idempotency-Key`, no actor Membership, and no `If-Match`, so it is not a command and is deliberately **not** counted in `COMMAND_COUNT`.

| Process | Trigger | Writes | Emits | Full specification |
|---|---|---|---|---|
| `RecordLeadRediscoveryProvenance` | consumed contract 9, `BusinessRediscoveredSignal` | one `lead_provenance_additional_jobs` row, idempotent on `(lead_id, discovery_job_public_id)` | **nothing** | `B2_REDISCOVERY_PROVENANCE_PROCESS.md` |

**`PROCESS_COUNT = 1`.** It emits no event, writes no `crm_activities` row, and moves no `last_activity_at`, so `COMMAND_COUNT` and `EVENT_COUNT` both remain **22** and `STATE_EVENT_DRIFT` remains **0**. B2-FIX.1 records the process honestly as a third category rather than inventing a paired command and event to preserve `COMMAND_COUNT == EVENT_COUNT` symmetry.

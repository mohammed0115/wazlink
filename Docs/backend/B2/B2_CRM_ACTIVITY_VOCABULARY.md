# B2 — Canonical CRM Activity Vocabulary

> **B2 status:** Canonical activity vocabulary repair (B2-FIX.1). This document resolves MAJOR-1: contradictory vocabulary across `crm_activities`, state machines, and command/event catalog.

## 1. Vocabulary authority and scope

**Single source of truth:** Every CRM-owned activity is defined here. A `crm_activities.type` value must appear in this document's closed vocabulary.

**Scope:** CRM-**owned** activities only. Cross-domain entries (Messaging, Pipeline, etc.) are merged at read time and do not appear as `crm_activities` rows.

**Closed vocabulary:** Exactly 21 types, listed below. No per-tier variants, no synonyms, no spelling drift. A value outside this set is a contract violation, not a new feature.

## 2. Canonical CRM Activity Vocabulary (21 types)

| Type | Source Command | Source Aggregate | Source Event | Occurred_at Source | Timeline Entry Identity | Summary Template | PII Class | Updates last_activity_at |
|---|---|---|---|---|---|---|---|---|
| `lead_converted` | `ConvertBusinessToLead` | Lead | `LeadCreated` | conversion instant | `ACT-{activity.public_id}` | `"lead created"` | NONE | **YES** |
| `lead_status_changed` | `ChangeLeadStatus` | Lead | `LeadStatusChanged` | command instant | `ACT-{activity.public_id}` | `"status:{from}→{to}"` | NONE | **YES** |
| `lead_priority_changed` | `ChangeLeadPriority` | Lead | `LeadPriorityChanged` | command instant | `ACT-{activity.public_id}` | `"priority:{from}→{to}"` | NONE | **YES** |
| `lead_owner_changed` | `AssignLeadOwner` | Lead | `LeadOwnerChanged` | command instant | `ACT-{activity.public_id}` | `"owner:{from_ref}→{to_ref}"` | NONE | **YES** |
| `lead_tag_added` | `AddLeadTag` | Lead | `LeadTagAdded` | command instant | `ACT-{activity.public_id}` | `"tag_added:{tag}"` | NONE | **YES** |
| `lead_tag_removed` | `RemoveLeadTag` | Lead | `LeadTagRemoved` | command instant | `ACT-{activity.public_id}` | `"tag_removed:{tag}"` | NONE | **YES** |
| `lead_archived` | `ArchiveLead` | Lead | `LeadArchived` | archive instant | `ACT-{activity.public_id}` | `"lead archived"` | NONE | **NO** (archiving is not activity) |
| `contact_added` | `AddContact` or `ConvertBusinessToLead` | Contact | `ContactAdded` | command instant | `ACT-{activity.public_id}` | `"contact_added:{contact_ref}"` | NONE (ref only) | **YES** |
| `contact_updated` | `UpdateContact` | Contact | `ContactUpdated` | command instant | `ACT-{activity.public_id}` | `"contact_updated:{contact_ref}"` | NONE (ref + field names only) | **YES** |
| `contact_removed` | `RemoveContact` | Contact | `ContactRemoved` | command instant | `ACT-{activity.public_id}` | `"contact_removed:{contact_ref}"` | NONE (ref only) | **YES** |
| `task_created` | `CreateTask` | Task | `TaskCreated` | command instant | `ACT-{activity.public_id}` | `"task_created:{task_ref}"` | NONE (ref only, never title) | **YES** |
| `task_completed` | `CompleteTask` | Task | `TaskCompleted` | completion instant | `ACT-{activity.public_id}` | `"task_completed:{task_ref}"` | NONE | **YES** |
| `task_cancelled` | `CancelTask` | Task | `TaskCancelled` | cancellation instant | `ACT-{activity.public_id}` | `"task_cancelled:{task_ref}"` | NONE | **YES** |
| `appointment_created` | `ScheduleAppointment` | Appointment | `AppointmentCreated` | command instant | `ACT-{activity.public_id}` | `"appointment_created:{appointment_ref}"` | NONE (ref only, never location) | **YES** |
| `appointment_rescheduled` | `RescheduleAppointment` | Appointment | `AppointmentRescheduled` | reschedule instant | `ACT-{activity.public_id}` | `"appointment_rescheduled:{appointment_ref}"` | NONE (times only, never location) | **YES** |
| `appointment_cancelled` | `CancelAppointment` | Appointment | `AppointmentCancelled` | cancellation instant | `ACT-{activity.public_id}` | `"appointment_cancelled:{appointment_ref}"` | NONE | **YES** |
| `appointment_completed` | `CompleteAppointment` | Appointment | `AppointmentCompleted` | completion instant | `ACT-{activity.public_id}` | `"appointment_completed:{appointment_ref}"` | NONE | **YES** |
| `appointment_no_show` | `MarkAppointmentNoShow` | Appointment | `AppointmentNoShowRecorded` | no-show instant | `ACT-{activity.public_id}` | `"appointment_no_show:{appointment_ref}"` | NONE | **YES** |
| `note_added` | `AddNote` | Note | `NoteAdded` | note creation instant | `ACT-{activity.public_id}` | `"note_added:{note_ref}"` | NONE (ref only, never body) | **YES** |
| `note_removed` | `RemoveNote` | Note | `NoteRemoved` | removal instant | `ACT-{activity.public_id}` | `"note_removed:{note_ref}"` | NONE (ref only) | **YES** |
| `lead_business_merged` | *(none — CRM consumes Discovery `BusinessMerged`; see §2.1)* | Lead (the losing Lead, archived) | `LeadArchived` with `reason='business_merged'` | the `BusinessMerged` event instant | `ACT-{activity.public_id}` | `"lead_business_merged:{surviving_lead_ref}"` | NONE | **NO** (archival, not activity) |

**Closed set.** No activity of type `conversion` (the canonical form is `lead_converted`). No activity of type `task_updated` or `task_assigned` (they do not create activities — §6). No activity of type `intelligence_reviewed` (no code path creates it; AI scoring is not CRM activity). No activity of type `message_sent` or `message_received` (Messaging owns them; CRM merges them at read time).

### 2.1 The one activity written from a consumed event

`lead_business_merged` is the **single** exception to "no consumed event writes `crm_activities`". Discovery's `BusinessMerged` is authoritative over Business identity, and when it forces CRM to archive a losing Lead to preserve the partial unique `(workspace_id, business_id) WHERE archived_at IS NULL` invariant (`B2_LEAD_PROVENANCE_DUPLICATION.md` §7), that archival is a real CRM state change: CRM emits `LeadArchived` with `reason='business_merged'` and writes exactly one `lead_business_merged` row for the archived Lead.

**Discriminator.** `LeadArchived` carries a closed `reason` enum, and the activity type is a total function of it:

| Emitted event | `reason` | Activity type |
|---|---|---|
| `LeadArchived` | `user` | `lead_archived` |
| `LeadArchived` | `business_merged` | `lead_business_merged` |

There is no third `reason` and no other consumed event may write `crm_activities`. This exception is stated in `B2_COMMAND_EVENT_CATALOG.md` §4 and `B2_DOMAIN_OWNERSHIP.md` §4 in identical terms.

## 3. Entry identity and summary rules

### 3.1 Entry identity

Every `crm_activities` row receives a `public_id` in the `ACT-<opaque>` format. This is the timeline entry identity.

**NOT the source aggregate's ID.** A Task `TSK-9999` that is created, then edited, then completed produces **two** `crm_activities` rows — `task_created` and `task_completed` — because `UpdateTask` writes no activity row (§6). Those two rows carry two distinct `ACT-*` identities and appear as two distinct timeline entries. The principle holds in both directions: *different activity-bearing events from the same Task → different `entry_id`*, and *`TSK-9999` is never itself an `entry_id`*.

**Same resource, many entries.** `TaskCreated` and `TaskCompleted` both reference `TSK-9999` in `target_public_id`, and both are distinct logical events with distinct `ACT-*` identities. The timeline entry identity is always the `crm_activities.public_id`; the source aggregate's `public_id` is carried separately as `source_resource_ref` (`B2_TIMELINE_IDENTITY_MODEL.md` §2.3) and may repeat across any number of entries.

### 3.2 Summary rules

Every summary follows a **fixed template** using only **non-PII arguments**, never free text:

- **No note bodies.** "note_added:{NOTE-123}" only.
- **No task titles.** "task_created:{TSK-456}" only.
- **No appointment locations.** "appointment_rescheduled:{APT-789}" only (times are acceptable in change logs).
- **No contact names, phones, or emails.** "contact_added:{CON-abc}" only.
- **No message bodies.** Messages are merged at read time and their summary comes from Messaging's own template.

Clients resolve the EntityRef against the owning surface where authorization applies.

## 4. PII handling by activity type

Every `crm_activities.summary` contains **zero PII**. Sensitive fields are expressed by reference only.

| Activity Type | PII-Free? | Reason |
|---|---|---|
| All CRM-owned | ✓ | Enums and EntityRefs only. Free text (note, task title, appointment location) **never** appears |
| Contact_* | ✓ | Ref only; phone/email/name in the Contact row, authorized separately |
| Note_* | ✓ | Ref only; body in the Note row |
| Task_* | ✓ | Ref only; title in the Task row |
| Appointment_* | ✓ | Ref only; location may have address in the Appointment row |
| Message (cross-domain) | ✓ | Merged at read time; Messaging supplies the summary |

## 5. Transition from frozen baseline

| Frozen Type | Canonical B2 Type | Reason |
|---|---|---|
| `conversion` | `lead_converted` | Consistency with other `lead_*` types; matches `LeadCreated` event |
| `status_changed` | `lead_status_changed` | Aggregate prefix for clarity |
| `owner_changed` | `lead_owner_changed` | Aggregate prefix |
| `priority_changed` | `lead_priority_changed` | Aggregate prefix |
| `note_added` | `note_added` | Preserved; now canonical |
| `task_created` | `task_created` | Preserved |
| `task_completed` | `task_completed` | Preserved |
| `appointment_created` | `appointment_created` | Added; was frozen FIXTURE_ONLY |
| `intelligence_reviewed` | **(removed)** | No code path creates it; scoring is not CRM activity |
| `message_sent` | **(removed)** | Messaging owns it; merged at read time; never copied to `crm_activities` |
| `message_retry` | **(removed)** | Messaging owns it |

Frozen implementations that wrote `type='conversion'` must migrate to `type='lead_converted'`. Frozen implementations that wrote `intelligence_reviewed` must stop (it was a fixture only).

## 6. CRM commands that write **NO TIMELINE ACTIVITY ROW**

Every CRM command that does not append to `crm_activities` is listed here with its reason. The list is closed: a command absent from both §2 and this section is a specification defect.

| Command | Transition | Verdict | Reason |
|---|---|---|---|
| `UpdateTask` | `pending → pending` | **NO TIMELINE ACTIVITY ROW** | A field edit is not a lifecycle event. Emitting one entry per field change would make the timeline a change log of every keystroke-level correction rather than a record of what happened to the Lead. The change is still auditable: `TaskUpdated` carries `changed_field_names[]` and `audit_logs` records the command. |
| `AssignTask` | `pending → pending` | **NO TIMELINE ACTIVITY ROW** | Assignment is a Task property, not a Lead-level business event. `TaskAssigned` still fires for Notifications. |

**These two commands still move `last_activity_at`** — see §8. Writing no activity row and moving no activity date are independent decisions, and B2 makes them independently.

`RescheduleAppointment` is **not** in this list: it **does** write `appointment_rescheduled` (§2), because moving a committed meeting is a business event that the timeline must preserve as its own historical entry.

`RecordLeadRediscoveryProvenance` is an inbound process rather than a CRM command, and it likewise writes **NO TIMELINE ACTIVITY ROW** — see `B2_REDISCOVERY_PROVENANCE_PROCESS.md` §2.2.2.

**Rule.** A CRM command that writes no timeline entry must be **explicitly stated** here, with its reason. Silence is not a specification.

## 7. Verification and completeness

### 7.1 Command-to-activity mapping

Every CRM command either (A) creates exactly one activity type, or (B) is listed as "no activity".

| Command | Activity Type(s) | Status |
|---|---|---|
| `ConvertBusinessToLead` | `lead_converted` **always**, plus one `contact_added` per Contact created in the same transaction (zero or one in Phase 1) | ✓ Mapped |
| `ChangeLeadStatus` | `lead_status_changed` | ✓ Mapped |
| `ChangeLeadPriority` | `lead_priority_changed` | ✓ Mapped |
| `AssignLeadOwner` | `lead_owner_changed` | ✓ Mapped |
| `AddLeadTag` | `lead_tag_added` | ✓ Mapped |
| `RemoveLeadTag` | `lead_tag_removed` | ✓ Mapped |
| `ArchiveLead` | `lead_archived` | ✓ Mapped |
| `AddContact` | `contact_added` | ✓ Mapped |
| `UpdateContact` | `contact_updated` | ✓ Mapped |
| `RemoveContact` | `contact_removed` | ✓ Mapped |
| `CreateTask` | `task_created` | ✓ Mapped |
| `UpdateTask` | **NO TIMELINE ACTIVITY ROW** (§6) | ✓ Explicit |
| `AssignTask` | **NO TIMELINE ACTIVITY ROW** (§6) | ✓ Explicit |
| `CompleteTask` | `task_completed` | ✓ Mapped |
| `CancelTask` | `task_cancelled` | ✓ Mapped |
| `ScheduleAppointment` | `appointment_created` | ✓ Mapped |
| `RescheduleAppointment` | `appointment_rescheduled` | ✓ Mapped |
| `CancelAppointment` | `appointment_cancelled` | ✓ Mapped |
| `CompleteAppointment` | `appointment_completed` | ✓ Mapped |
| `MarkAppointmentNoShow` | `appointment_no_show` | ✓ Mapped |
| `AddNote` | `note_added` | ✓ Mapped |
| `RemoveNote` | `note_removed` | ✓ Mapped |

**COMMAND_ACTIVITY_DRIFT = 0.** Every one of 22 commands is accounted for.

### 7.2 Event-to-activity mapping

Every CRM event either (A) records an activity, or (B) is cross-domain.

| Event | Activity Type | Status |
|---|---|---|
| `LeadCreated` | `lead_converted` | ✓ Mapped |
| `LeadStatusChanged` | `lead_status_changed` | ✓ Mapped |
| `LeadPriorityChanged` | `lead_priority_changed` | ✓ Mapped |
| `LeadOwnerChanged` | `lead_owner_changed` | ✓ Mapped |
| `LeadTagAdded` | `lead_tag_added` | ✓ Mapped |
| `LeadTagRemoved` | `lead_tag_removed` | ✓ Mapped |
| `LeadArchived` | `lead_archived` | ✓ Mapped |
| `ContactAdded` | `contact_added` | ✓ Mapped |
| `ContactUpdated` | `contact_updated` | ✓ Mapped |
| `ContactRemoved` | `contact_removed` | ✓ Mapped |
| `TaskCreated` | `task_created` | ✓ Mapped |
| `TaskUpdated` | **NO TIMELINE ACTIVITY ROW** (§6) | ✓ Explicit |
| `TaskAssigned` | **NO TIMELINE ACTIVITY ROW** (§6) | ✓ Explicit |
| `TaskCompleted` | `task_completed` | ✓ Mapped |
| `TaskCancelled` | `task_cancelled` | ✓ Mapped |
| `AppointmentCreated` | `appointment_created` | ✓ Mapped |
| `AppointmentRescheduled` | `appointment_rescheduled` | ✓ Mapped |
| `AppointmentCancelled` | `appointment_cancelled` | ✓ Mapped |
| `AppointmentCompleted` | `appointment_completed` | ✓ Mapped |
| `AppointmentNoShowRecorded` | `appointment_no_show` | ✓ Mapped |
| `NoteAdded` | `note_added` | ✓ Mapped |
| `NoteRemoved` | `note_removed` | ✓ Mapped |
| `MessageSent` | **(cross-domain, not copied)** | ✓ Explicit |
| `MessageReceived` | **(cross-domain, not copied)** | ✓ Explicit |
| `DealCreated` | **(cross-domain, not copied)** | ✓ Explicit |
| `DealStageChanged` | **(cross-domain, not copied)** | ✓ Explicit |
| `DealWon` | **(cross-domain, not copied)** | ✓ Explicit |
| `DealLost` | **(cross-domain, not copied)** | ✓ Explicit |
| `BusinessMerged` *(consumed)* | `lead_business_merged` — the sole consumed event that writes `crm_activities` (§2.1); written only for the Lead the merge archives | ✓ Mapped |

**EVENT_ACTIVITY_DRIFT = 0.** The table enumerates **29** event contracts — the **22** CRM-emitted events of `B2_COMMAND_EVENT_CATALOG.md` §2 plus the **7** cross-domain events CRM consumes for timeline or activity-date purposes. Every one is either mapped to a canonical activity type or explicitly declared out of scope. (The full consumed set is 9; `LeadIntelligenceCompleted` and the Discovery rediscovery event appear in `B2_COMMAND_EVENT_CATALOG.md` §4 and write neither an activity nor an activity date, so they are not activity-bearing and are excluded here.)

## 8. last_activity_at update rule

**CRM-owned events:** `last_activity_at := GREATEST(last_activity_at, occurred_at)` is applied **inside the mutating transaction**.

Every activity type in §2's "Updates last_activity_at" column set to **YES** triggers the update. Only `lead_archived` and `lead_business_merged` set it to **NO**, because they are archival events, not business activity.

**Writing an activity row and moving the activity date are independent.** The two decisions do not imply one another, and the closed qualifying-event set in `B2_LEAD_AGGREGATE.md` §4 — not this table — is the authority for `last_activity_at`. Two events fall in the gap in each direction:

| Event | Writes `crm_activities`? | Moves `last_activity_at`? | Why |
|---|---|---|---|
| `TaskUpdated` | **NO TIMELINE ACTIVITY ROW** (§6) | **YES** | Someone worked the Lead; that is activity. It is simply not a lifecycle entry worth a timeline row. |
| `TaskAssigned` | **NO TIMELINE ACTIVITY ROW** (§6) | **YES** | Same reasoning. |
| `LeadArchived` (`reason='user'`) | **YES** (`lead_archived`) | **NO** | Archiving ends engagement; it is not engagement. |
| `LeadArchived` (`reason='business_merged'`) | **YES** (`lead_business_merged`) | **NO** | Same, and the actor is Discovery, not a human working the Lead. |

**Cross-domain events:** Consumer processes apply the same rule **after** commit, keyed by `event_id` for idempotency, and only for the events the `B2_LEAD_AGGREGATE.md` §4 qualifying set names. `LeadIntelligenceCompleted` and the Discovery rediscovery event move nothing (`B2_COMMAND_EVENT_CATALOG.md` §4). Every cross-domain timestamp is first subject to the clock-skew admission rule in `B2_TIMELINE_IDENTITY_MODEL.md` §5; a delivery that fails it is retried or dead-lettered rather than acknowledged, and recovers under §5.5.

## 9. Closure statement

**ACTIVITY_VOCABULARY_DRIFT = 0.** Every CRM command, every CRM event, and every state transition is mapped to exactly one canonical activity type or explicitly declared **NO TIMELINE ACTIVITY ROW** with a reason. Each activity has exactly one canonical name: `lead_converted` (never `conversion`), `lead_status_changed` (never `status_changed`), `lead_owner_changed` (never `owner_changed`), `lead_priority_changed` (never `priority_changed`), and `lead_business_merged` (never a second `lead_archived` spelling).

**Documents that must agree with this list**, and do: `B2_NOTE_ACTIVITY_TIMELINE.md` §2.1, `B2_STATE_MACHINES.md` §6, `B2_COMMAND_EVENT_CATALOG.md` §1–§2 and §4, `B2_LEAD_PROVENANCE_DUPLICATION.md` §4 and §7, `B2_TIMELINE_IDENTITY_MODEL.md` §2, `B2_ACCEPTANCE_TEST_MATRIX.md` (AT-ACTV-*, AT-TL-*), and `B2_IMPLEMENTATION_READINESS.md` §2.

The frozen frontend's `timelineIcons` map is updated to use canonical names. Migrations of frozen data map old names to new canonical names in a data-layer repair (out of B2 scope, before implementation).

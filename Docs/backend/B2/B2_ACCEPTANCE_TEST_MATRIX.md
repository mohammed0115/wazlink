# B2 — CRM Acceptance Test Matrix

> **B2 status:** Acceptance criteria for the future implementation. Each row is deterministic: a fixed precondition, a single action, and an assertion with no ambiguity. **No test code is authorized under B2.**

`AT-<CATEGORY>-<n>`. "Assert" statements are the contract. Every Class A decision in `B2_DECISION_REGISTER.md` is covered.

## Tenant isolation (ISO)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-ISO-1 | `LEAD-X` in W2; caller Owner of W1 only | `GET /leads/LEAD-X` | `404 ENTITY_NOT_FOUND`; body byte-identical to a random `LEAD-*` |
| AT-ISO-2 | matrix of {`LEAD-`,`CON-`,`TSK-`,`APT-`,`NOTE-`} × {other tenant, non-existent} | request each | uniform `404`; no status, body, header, or timing distinguishes the two columns |
| AT-ISO-3 | caller member of both W1 and W2, switched to W1 | `GET /leads?owner_ref=<W2 membership>` | `404 ENTITY_NOT_FOUND` for the reference; zero W2 rows in any response |
| AT-ISO-4 | caller on W1 | send `workspace_id=W2` in body, query, and header on 10 CRM routes | all ignored; every response scoped to W1 |
| AT-ISO-5 | every CRM manager entry point | code-review gate | no CRM service reaches a tenant-owned table except through `for_workspace(...)` |
| AT-ISO-6 | W1 and W2 each hold a Lead for the *same* `provider_external_id` | `GET /leads` in each | each workspace sees exactly its own Lead; the duplicate index is per-workspace |

## Lead creation (LEAD)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-LEAD-1 | `BUS-2000` analyzed, no Lead | convert | `201`; `X-Lead-Conversion-Outcome: created`; `public_id` starts `LEAD-`; `status="new"`; `priority="medium"`; `version=1`; `origin_type="discovery"` |
| AT-LEAD-2 | the AT-LEAD-1 Lead | inspect the row | `converted_at = created_at = last_activity_at`; `next_activity_at IS NULL`; `archived_at IS NULL` |
| AT-LEAD-3 | any created Lead | inspect the schema | it carries **no** `city`, `category`, `score`, `tier`, `sales_approach`, `company_id`, `deal_id`, `conversation_id`, `revenue`, or `contacted` column |
| AT-LEAD-4 | no request body | convert | `201`; owner defaults to the acting Membership; status `new`; priority `medium` |
| AT-LEAD-5 | direct Lead creation | `POST /leads` | `404`/`405` — the route does not exist; manual origin is `NOT_SUPPORTED` in Phase 1 |

## Business conversion (CONV)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-CONV-1 | Business with `intelligence_status="not_analyzed"` | convert | `409 CONFLICT`·`business_not_convertible`; no Lead created |
| AT-CONV-2 | Business with `intelligence_status="analysis_error"` | convert | `409 CONFLICT`·`business_not_convertible` |
| AT-CONV-3 | Business with `intelligence_status="insufficient_data"` | convert | `201` — **convertible**; matches the frozen `canConvert`, which excludes only the two error states |
| AT-CONV-4 | Business in another workspace | convert | `404 ENTITY_NOT_FOUND` |
| AT-CONV-5 | archived Business | convert | `409 CONFLICT`·`business_not_convertible` |
| AT-CONV-6 | Business merged away | convert | `409 CONFLICT`·`business_not_convertible` |
| AT-CONV-7 | `source_job_ref` naming a Job that did not discover this Business | convert | `404 ENTITY_NOT_FOUND` |
| AT-CONV-8 | Business with phone and email | convert | exactly one Contact created, linked `is_primary=true`, `source="discovery_business"`, `title IS NULL` |
| AT-CONV-9 | Business with neither phone nor email | convert | `201`; **zero** contacts; the Lead is valid |
| AT-CONV-10 | conversion succeeds | inspect events | exactly one `LeadCreated`; **no** `RevenueRecognized`, `DealCreated`, or `MessageSent` |

## Duplicate prevention (DUP)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-DUP-1 | `BUS-1042` already has live `LEAD-1042` | convert again, fresh key | `201` + `X-Lead-Conversion-Outcome: existing`; body is `LEAD-1042`; **zero** new rows; **zero** events; quota unchanged |
| AT-DUP-2 | 20 concurrent conversions of one Business, 20 distinct keys | fire simultaneously | exactly **one** `leads` row; one `LeadCreated`; one quota unit; all 20 responses are `201` |
| AT-DUP-3 | direct insert attempt | insert a second live Lead for one Business | rejected by the partial unique index at the storage layer |
| AT-DUP-4 | `LEAD-1042` archived | convert `BUS-1042` again | `201` + `created`; a **new** `LEAD-*`; the archived row persists; a new quota unit is consumed |
| AT-DUP-5 | same Business found by `JOB-A` and `JOB-B` | convert via `JOB-A`; then CRM receives a Discovery rediscovery event for the same Business via `JOB-B` | one Lead; `leads.source_job_id = JOB-A`; `JOB-B` appended to `lead_provenance_additional_jobs` with `observed_at` timestamp; no second Lead; no event; `last_activity_at` unchanged |
| AT-DUP-5A | same Business re-discovered by the same Job twice | receive the same Discovery event twice | one additional-jobs row; second receipt is idempotent `ON CONFLICT DO NOTHING` |
| AT-DUP-5B | archived Lead; same Business re-discovered | receive rediscovery event for a Business whose Lead is archived | guard 3 finds no live Lead; the event is **discarded** silently; no row appended; no error raised; no retry scheduled |
| AT-DUP-5C | Lead converted via `JOB-A` | receive a rediscovery event naming `JOB-A` — the deciding job | guard 4 rejects it; `lead_provenance_additional_jobs` stays empty; the deciding job appears in `lead_provenance.discovery_job_public_id` **only**, never as an additional job |
| AT-DUP-5D | one Lead; the same rediscovery event delivered concurrently by N workers | fire N simultaneous deliveries | exactly **one** row; the losers are absorbed by the unique `(lead_id, discovery_job_public_id)` constraint; no deadlock, no error surfaced, no Lead lock taken, no `If-Match` failure for a concurrent human editor |
| AT-DUP-5E | rediscovery already committed for `JOB-B` | replay the same event after a successful commit | no second row; no error; the process is a pure no-op — replay after commit is indistinguishable from first-delivery-already-applied |
| AT-DUP-5F | `BUS-B` merged into `BUS-A`; a live Lead exists for `BUS-A` | receive a rediscovery event naming the surviving `BUS-A`, then one naming the merged-away `BUS-B` | the `BUS-A` event appends to the surviving Lead; the `BUS-B` event resolves through guard 2 — appended to the surviving Lead if Discovery still aliases `BUS-B`, discarded if Discovery retired the row. In neither case is `lead_provenance` rewritten or a Lead created |
| AT-DUP-5G | workspace W1 holds a Lead; a rediscovery event arrives carrying W2's `workspace_id`, or W1's `workspace_id` with a `BUS-*` belonging to W2 | consume each | both discarded — guard 1 on workspace, guard 2 on workspace-scoped Business resolution. **Zero** rows written in either workspace; no response confirms the foreign Business exists |
| AT-DUP-5H | rediscovery event with a malformed or missing `discovered_at` | consume it | it is **not** retried indefinitely: bounded attempts, then dead-letter plus operator alert. It is never acknowledged as processed and never partially applied |
| AT-DUP-5I | any successful rediscovery | inspect the Lead and the timeline | **NO TIMELINE ACTIVITY ROW**; no CRM event emitted; `last_activity_at` unchanged; Lead `version` unchanged; no quota consumed |
| AT-DUP-5J | a well-formed rediscovery event `E` whose `discovered_at` exceeds `processing_reference_time_1 + CLOCK_SKEW_TOLERANCE` at its first processing attempt; a live Lead and a non-deciding `JOB-*` that would otherwise pass all four guards | record the `processing_reference_time` sampled at the start of **every** attempt; let the bounded retry policy run until an attempt's freshly sampled clock brings `E` inside tolerance (or exhaust the budget and replay after the clock advances); inspect `lead_provenance_additional_jobs` after each attempt | **attempt 1:** **no** `lead_provenance_additional_jobs` row is written, the delivery is classified `RETRYABLE_CLOCK_SKEW`, and it is **not** acknowledged as successfully processed — not acked-and-dropped, not silently ignored, not partially applied; `discovered_at` is not clamped or rewritten. **Across attempts:** `processing_reference_time_N > processing_reference_time_1` for every later attempt N — no attempt reuses an earlier attempt's value, and none uses the ingestion instant, a first-receipt stamp, an immutable `ingested_at`/`recorded_at` column, `discovered_at` itself, a source clock, or a client clock. `E` is **bit-for-bit immutable across attempts** — same logical event identity, `discovered_at`, `workspace_id`, `business_public_id`, `discovery_job_public_id`. **On recovery** (automatic retry or replay from `DEAD_LETTERED`): `E` is re-evaluated by the *same* `B2_TIMELINE_IDENTITY_MODEL.md` §5.2 rule against a **freshly sampled, later `processing_reference_time`**, is now eligible, and the ordinary §2.2 guards run to completion — **exactly one** row is written. **No new source event, no new logical event identity, no operator action, and no mutation of `discovered_at`** was required. Replaying or re-retrying afterwards writes **no second row** (absorbed by unique `(lead_id, discovery_job_public_id)`) and `last_activity_at`, the Lead `version`, the timeline and the quota are all unchanged throughout. **End state:** no permanent provenance under-count remains. **Negative control:** if the implementation compares `discovered_at` against the ingestion instant or reuses `processing_reference_time_1`, `E` can never become eligible and this test fails — that is the defect it exists to detect |
| AT-DUP-6 | two contacts sharing a phone number | inspect the schema | **no** unique index on `contacts.phone`, `phone_normalized`, or `email` at any scope |

## Lead lifecycle (LIFE)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-LIFE-1 | each of the 5 statuses × each of the other 4 | `PATCH` status | all 20 transitions succeed; `LeadStatusChanged` carries `from`/`to`; one `crm_activities` row each |
| AT-LIFE-2 | `status="qualified"` | `PATCH {status:"qualified"}` | `400 VALIDATION_ERROR`; **no event**; `version` unchanged |
| AT-LIFE-3 | any Lead | `PATCH {status:"won"}` | `400 VALIDATION_ERROR`; the 5-value enum is closed |
| AT-LIFE-4 | `status="unqualified"` | `PATCH {status:"qualified"}` | `200` — `unqualified` is **not terminal** |
| AT-LIFE-5 | the target status list | compare to `data.js` `leadStatusLabels` | exactly `new, contacted, qualified, unqualified, nurturing`; no sixth state |

## Owner (OWN)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-OWN-1 | active Membership `MEM-2` in W1 | assign | `200`; `LeadOwnerChanged{from,to}`; `owner_ref.entity_type = "membership"` |
| AT-OWN-2 | `MEM-9` suspended | assign | `409 CONFLICT`·`owner_membership_inactive`; no mutation |
| AT-OWN-3 | `MEM-W2` in another workspace | assign | `404 ENTITY_NOT_FOUND` — **never `409`**, which would confirm the Membership exists |
| AT-OWN-4 | owner Membership removed by B1 `RemoveMember` | `GET /leads` | Lead retains `owner_ref`; `owner_display_name` still resolves; `owner_inactive=true`; **no** `LeadOwnerChanged` emitted |
| AT-OWN-5 | owner Membership suspended then reactivated | observe | the Lead is never reassigned in either direction; zero events |
| AT-OWN-6 | caller holds `lead.update` but not `lead.assign` | `PATCH {owner_ref}` | `403 PERMISSION_DENIED`·`lead.assign` |
| AT-OWN-7 | caller holds `lead.update` but not `lead.assign` | `PATCH {status, owner_ref}` | `403 PERMISSION_DENIED`; **the status change is not applied either** |
| AT-OWN-8 | 20 concurrent owner assignments | fire | exactly 1 × `200`, 19 × `409 STALE_VERSION`; `version` +1 exactly |

## Priority (PRIO)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-PRIO-1 | each of high/medium/low × the other two | `PATCH` priority | all 6 succeed; `LeadPriorityChanged{from,to}` |
| AT-PRIO-2 | any Lead | `PATCH {priority:"urgent"}` | `400 VALIDATION_ERROR`; the 3-value enum is closed |
| AT-PRIO-3 | AI recommends a priority | inspect | **no** CRM row changes; no `LeadPriorityChanged`; AI output is never adopted silently |
| AT-PRIO-4 | Automation runs `update_lead_priority` | observe | the change lands through `ChangeLeadPriority`; audit actor is `system:automation` with the `RUN-*` label |

## Contacts (CONT)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-CONT-1 | Lead with no contact | `POST /leads/{id}/contacts` | `201 Contact`; `public_id` starts `CON-`; `source="manual"` |
| AT-CONT-2 | Lead already has a primary | add with `is_primary=true` | `409 CONFLICT`·`primary_contact_exists`; exactly one primary remains |
| AT-CONT-3 | one Contact, two Leads for the same Business | link to both | both links exist in `lead_contacts`; **one** `contacts` row; the PII is not duplicated |
| AT-CONT-4 | primary contact linked | `DELETE /leads/{id}/contacts/{cid}` | `204`; the link is unlinked; the `contacts` row **persists**; the Lead has **no** primary; **no** auto-promotion |
| AT-CONT-5 | Contact used by a Messaging conversation | remove from the Lead | the conversation still resolves its contact; no dangling reference |
| AT-CONT-6 | `ContactAdded`/`ContactUpdated` events | inspect payloads | contain `CON-*` and field **names** only; **zero** occurrences of name, phone, or email |
| AT-CONT-7 | duplicate phone in the workspace | add | `201` with `duplicate_candidates[]` populated; creation is **not** blocked |

## Tasks (TASK)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-TASK-1 | Lead exists | create with title, type, due_at | `201`; `public_id` starts `TSK-`; `status="pending"`; assignee defaults to the Lead's owner; priority defaults to the Lead's |
| AT-TASK-2 | `pending` task | complete | `200`; `status="completed"`; `completed_at` set; exactly one `TaskCompleted` |
| AT-TASK-3 | completed task | complete again with the current version | `409 CONFLICT`·`task_already_terminal`; **zero** additional events |
| AT-TASK-4 | completed task | reopen | route does not exist — `ReopenTask` is `NOT_SUPPORTED` |
| AT-TASK-5 | `pending` task, `due_at` in the past | `GET` it | `is_overdue=true`; **no** `overdue` value is stored in `tasks.status` |
| AT-TASK-6 | the `tasks` schema | inspect | `status` check constraint permits exactly `pending, completed, cancelled`; `overdue` is not a value |
| AT-TASK-7 | `pending` task | cancel with a reason | `200`; `status="cancelled"`; `cancelled_at` set; `TaskCancelled` |
| AT-TASK-8 | assignee Membership suspended | assign to it | `409 CONFLICT`·`assignee_membership_inactive` |
| AT-TASK-9 | Automation `create_task` action | run | the Task lands via `CreateTask` with `origin="automation"` and `automation_run_ref` set; no direct table write |
| AT-TASK-10 | `GET /tasks?overdue=true` | call | returns exactly the `pending` tasks with `due_at < now()`, ordered `(due_at ASC, public_id ASC)` |

## Appointments (APPT)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-APPT-1 | Lead exists | schedule with valid times | `201`; `public_id` starts `APT-`; `status="scheduled"` |
| AT-APPT-2 | `end_at <= start_at` | schedule | `400 VALIDATION_ERROR`; no row |
| AT-APPT-3 | organizer already has an overlapping scheduled appointment | schedule | **`201`** with `overlap_warning=true` and `overlapping_appointment_refs[]`; **never `409`** |
| AT-APPT-4 | scheduled appointment | complete / cancel / no-show | each returns `200` with the matching terminal status and its event |
| AT-APPT-5 | terminal appointment | reschedule | `409 CONFLICT`·`appointment_already_terminal` |
| AT-APPT-6 | `deal_ref` belonging to a different Lead | schedule | `404 ENTITY_NOT_FOUND` |
| AT-APPT-7 | the status vocabulary | compare to `data.js` `appointmentStatusLabels` | exactly `scheduled, completed, cancelled, no_show`; types exactly `call, meeting, demo, follow_up`; locations exactly `phone, online, office, other` |
| AT-APPT-8 | any appointment flow | inspect events | no `location` string appears in any payload |

## Notes (NOTE)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-NOTE-1 | Lead exists | add a note | `201`; `public_id` starts `NOTE-`; `author_ref` is the acting Membership |
| AT-NOTE-2 | whitespace-only body | add | `400 VALIDATION_ERROR`; no row |
| AT-NOTE-3 | existing note | edit | route does not exist — `UpdateNote` is `NOT_SUPPORTED` |
| AT-NOTE-4 | note authored by another Sales user | remove as `sales` | `403 PERMISSION_DENIED` |
| AT-NOTE-5 | note added at T1, removed as `manager` at T2 | `GET /leads/{id}/timeline` after removal | `204` on removal; the note row **persists** with `archived_at` set. The timeline retains **both** entries: the original `note_added` at `occurred_at = T1`, unmoved and unmodified, and a new `note_removed` at `occurred_at = T2`. Removing a note does not un-happen it; `crm_activities` is append-only, so neither entry can be deleted or edited |
| AT-NOTE-9 | the note from AT-NOTE-5 | inspect `last_activity_at` | it advanced on both the add and the remove, and **never moved backwards** — removal is activity, not un-activity |
| AT-NOTE-6 | own note | remove as its author | `204` |
| AT-NOTE-7 | `NoteAdded` event and the `crm_activities` row | inspect | **zero** occurrences of the note body in either |
| AT-NOTE-8 | the amendment bundle is not yet applied | attempt to mint a `NOTE-*` | blocked — `NOTE-` is proposed/reserved, not registered |

## Timeline (TL)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-TL-1 | one Lead exercised across all six preconditions: a CRM status change, a Task action, an Appointment action, a Note action, a Messaging event, a Pipeline event | `GET /leads/{id}/timeline` | **all three reachable source classes appear** — `source_domain` takes exactly the values `crm`, `messaging`, `pipeline`, and no other. All six preconditions are represented: the status change, Task, Appointment, and Note actions each appear as a `crm` entry carrying the matching `source_event_type` (`lead_status_changed`, `task_created`, `appointment_created`, `note_added`) with an `ACT-*` `entry_id`; the Messaging event appears **exactly once** as one `messaging:<source_event_id>` entry; the Pipeline event appears **exactly once** as one `pipeline:<source_event_id>` entry. **No `task`, `appointment`, or `note` source class exists**, and no second projection of the Task, Appointment, or Note appears. Ordering is `(occurred_at DESC, entry_id DESC)`. This fixture must pass in the same execution as AT-TL-ID-10 |
| AT-TL-2 | different events from the same source resource | inspect the serialized `TimelineEntry` objects | each has a **unique `entry_id`**; a Deal that creates, stages, and wins generates **three** separate entries with three separate IDs (not three copies of `DEAL-4042`). Asserted on the wire DTO, so `entry_id`, `source_event_id`, and `source_resource_ref` must all be present as distinct fields |
| AT-TL-3 | `crm_activities` | attempt `UPDATE`/`DELETE` | rejected — append-only |
| AT-TL-4 | Messaging sends a message | inspect `crm_activities` | **zero** new rows; the message reaches the timeline by read-time merge only |
| AT-TL-10 | any cross-domain entry visible in a timeline response | search every CRM-owned table for its `entry_id`, `source_event_id`, or any copy of its payload | **zero** rows anywhere. CRM persists no cross-domain timeline entry, in `crm_activities` or any other table |
| AT-TL-5 | caller lacks `conversation.view` | `GET /leads/{id}/timeline` | message entries are absent; **no** placeholder and no error |
| AT-TL-6 | caller lacks `deal.view` | same | deal-activity entries are absent |
| AT-TL-7 | every timeline entry across a full suite | scan `summary` | zero note bodies, task titles, appointment locations, contact names, phones, emails, or message bodies |
| AT-TL-8 | a late cross-domain entry with `occurred_at` older than the current page | page through with a cursor from the middle | no entry is skipped or duplicated; newer pages remain valid; the late entry lands on a later page; cursor ordering is `(occurred_at DESC, entry_id DESC)`, immutable and deterministic |
| AT-TL-9 | `Lead360.activities[]` | inspect | the first page only, ≤20 entries, same ordering as `/timeline` |

## Timeline identity and deduplication (TL-ID)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-TL-ID-1 | one Task `TSK-9999`: created, edited, completed | `GET /timeline` | exactly **two** entries, both `source_domain="crm"`, with `source_event_type` `task_created` and `task_completed`, two different `ACT-*` `entry_id` values, and `source_event_id = null` on both. The edit writes **NO TIMELINE ACTIVITY ROW**, so no `task_updated` entry exists and no activity type outside the canonical 21 appears. `TSK-9999` appears on both entries as `source_resource_ref` and **never** as an `entry_id` |
| AT-TL-ID-2 | one Deal `DEAL-4042`: created, stage changed, won | `GET /timeline` (read-time merge) | three separate `source_domain="pipeline"` entries; three different `source_event_id` values; three `entry_id` values of the form `pipeline:<source_event_id>`; and `source_resource_ref = DEAL-4042` on **all three**. Not three copies of `DEAL-4042` in `entry_id` |
| AT-TL-ID-3 | one Appointment `APT-123`: scheduled, rescheduled, completed | `GET /timeline` | three separate `source_domain="crm"` entries; three different `ACT-*` `entry_id` values; `source_resource_ref = APT-123` on all three and not three copies of `APT-123` in `entry_id`; and **no fourth entry projected from the `appointments` row itself** |
| AT-TL-ID-4 | same CRM command with same `Idempotency-Key` | send twice | one `crm_activities` row created; one timeline entry; second request replays the stored response |
| AT-TL-ID-5 | a cross-domain source record read twice, and the same logical source event redelivered or replayed at its source | `GET /timeline` before and after; then inspect every CRM table | **one** entry both times, with a byte-identical `entry_id` `<source_domain>:<source_event_id>` and identical field values, because `source_event_id` is stable across replay. If the source read model exposes two representations of the one logical event, the read-time merge collapses them on `(source_domain, source_event_id)` to exactly one entry. **No CRM cross-domain dedup store is consulted or written** — the assertion is that no CRM table changes between the two reads |
| AT-TL-ID-6 | two CRM entries with identical `occurred_at` | inspect ordering | lexicographic `entry_id DESC` deterministically orders them; repeated queries are identical |

## Timeline total order (TL-ORDER)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-TL-ORDER-1 | Lead with 10 events spanning days | `GET /timeline` | ordered `(occurred_at DESC, entry_id DESC)` with no ties; total order is deterministic |
| AT-TL-ID-7 | a CRM entry and a cross-domain entry on one Lead | compare their `entry_id` values across a full suite | zero collisions. Every CRM `entry_id` begins with an **uppercase prefix registered in `BACKEND_PUBLIC_ID_REGISTRY.md` section A** followed by `-`; every cross-domain `entry_id` begins with a **lowercase** `source_domain` token from the closed set `{messaging, pipeline}` followed by `:`. Because the registry declares prefixes **case-sensitive** and registers no lowercase prefix, no CRM `entry_id` can begin with a domain token and the two shapes are disjoint. **The test asserts the case-sensitive registered-prefix rule, not a `":"`-exclusion grammar** — the registry constrains no character set, so no such grammar is claimed or relied on |
| AT-TL-ID-8 | appointment `APT-789` scheduled for 2pm, rescheduled to 3pm at 14:59 | `GET /timeline` before and after the reschedule | a **new** `appointment_rescheduled` entry with `occurred_at = 14:59` is appended; the original `appointment_created` entry keeps its original `entry_id` **and** its original `occurred_at`, and holds its exact position in the total order; neither entry's `occurred_at` equals `appointment.start_at` |
| AT-TL-ID-9 | task with `due_at` tomorrow, present in the timeline | change `due_at`, then let the task become overdue | no entry's `occurred_at` changes; no entry moves position; no new entry is created by either the edit or the passage of the due date |
| AT-TL-ID-10 | `CompleteTask`, `RescheduleAppointment`, and `AddNote` each issued as a CRM command | `GET /timeline` | exactly **one** entry per command — the `ACT-*` activity, `source_domain="crm"`. **No second projection appears from the `tasks`, `appointments`, or `notes` row**, so no `TSK-*`, `APT-*`, or `NOTE-*` value occurs in any `entry_id`; each appears only as `source_resource_ref`. One logical CRM action yields one entry. Must pass in the same execution as AT-TL-1 |
| AT-TL-ID-11 | any resource emitting several events (Task via `ACT-*`, Deal via Pipeline) | inspect `entry_id`, `source_event_id`, `source_resource_ref` across its entries | the three are **distinct fields**. `source_resource_ref` is identical across every entry of that resource and is therefore **not unique**; `entry_id` is unique across every entry in the response; `source_event_id` is unique among cross-domain entries and `null` on every `crm` entry. No test may treat `source_resource_ref` as an identity |
| AT-TL-ORDER-2 | new event inserted with `occurred_at` between two existing entries | refresh the timeline | event appears in its correct position; earlier and later entries are not skipped or reordered |
| AT-TL-ORDER-3 | any timeline entry | attempt to mutate `occurred_at` or `entry_id` by any command, consumer, or replay | impossible — both are immutable; every previously issued cursor still resolves to the same position |

## Timeline clock skew (TL-SKEW)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-TL-SKEW-1 | a cross-domain source record whose `occurred_at` exceeds CRM's clock by more than `CLOCK_SKEW_TOLERANCE` | `GET /leads/{id}/timeline` while it is future-dated, and inspect CRM state | the record is **not eligible** at step 5 of the read algorithm, so **no `TimelineEntry` is constructed for it**: it is absent from the response, occupies no cursor position, leaves no placeholder and raises no error. `last_activity_at` is unchanged and no provenance row is written. The record **remains owned by its source domain** — CRM writes nothing, and in particular **no CRM quarantine row is created or required**. An operator alert may be raised under the existing operations policy, and no timeline behavior is conditioned on it |
| AT-TL-SKEW-2 | the Lead from AT-TL-SKEW-1 | inspect `last_activity_at` before and after | byte-identical; a future-dated event can never pin the activity date forward, and no later legitimate event is masked by it |
| AT-TL-SKEW-3 | a cross-domain source record whose `occurred_at` is hours **older** than CRM's clock | `GET /timeline`, and consume the matching event | **eligible** with `occurred_at` unmodified; it lands in its correct historical position in the total order; `GREATEST()` leaves `last_activity_at` unchanged if a newer event already advanced it. Past-dated records are never suppressed |
| AT-TL-SKEW-4 | the record from AT-TL-SKEW-1, once it becomes valid — either CRM's clock advances past `occurred_at + tolerance`, or the owning domain corrects the record under its own semantics | `GET /leads/{id}/timeline` again, with **no CRM intervention of any kind** between the two reads | it now appears **exactly once**, at its correct position in the total order, with the **same `entry_id`** it would always have had, because `entry_id` derives from the stable `source_event_id` and never from the moment of admission. Recovery required no replay command, no quarantine store, and no CRM write; suppression did not fork identity. No cursor issued during the suppressed window is invalidated, because the record never held a position |
| AT-TL-SKEW-5 | any CRM command | inspect its skew check | `occurred_at` is CRM's own `now()`, so skew is structurally zero; the admission rule can never reject a CRM-owned command |
| AT-TL-SKEW-6 | a qualifying cross-domain event `E` with a stable `event_id`, whose `occurred_at` exceeds `processing_reference_time_1 + CLOCK_SKEW_TOLERANCE` at its first processing attempt | drive `E` through its full lifecycle: attempt 1; then either a later attempt inside the retry budget **or** budget exhaustion followed by operational replay after the clock advances; inspect CRM state, the delivery's disposition, and the timeline at every step | **attempt 1:** `last_activity_at` is unchanged, and the delivery is classified `RETRYABLE_CLOCK_SKEW` and is **not** acknowledged as successfully processed — it is neither acked-and-dropped, nor silently ignored, nor partially applied, and `occurred_at` is not clamped or rewritten. **On recovery** (either path): `E` is re-evaluated by the *same* §5.2 rule against a **freshly sampled, later `processing_reference_time`**, is now eligible, and `last_activity_at` advances by `GREATEST()` — advancing only if `E.occurred_at` is newer than the current value. The `event_id` and `source_event_id` are byte-identical to attempt 1; **no new business event is synthesized**; **no timeline entry and no `crm_activities` row is created**; processing then completes and is acknowledged. **End state:** no permanent under-count remains, and no execution of this test ends with `E` both unapplied and no longer retryable-or-replayable |
| AT-TL-SKEW-7 | `E` from AT-TL-SKEW-6, with a skew small enough that CRM's trusted clock reaches eligibility inside the bounded retry envelope | record the `processing_reference_time` sampled at the start of **every** attempt; let the bounded retry policy run; count attempts, measure inter-attempt delays, and diff `last_activity_at` after each attempt | **the reference clock advances across attempts:** `processing_reference_time_1` is the trusted server clock at attempt 1 and `processing_reference_time_N > processing_reference_time_1` for every later attempt N — no attempt reuses an earlier attempt's value, and none uses the event's `occurred_at`, a source timestamp, a first-receipt stamp, an immutable `ingested_at`/`recorded_at` column, or a client clock. The **event is bit-for-bit immutable across attempts** — same `event_id`, `occurred_at`, `workspace_id`, source/aggregate references. Because only the clock moves, `E` transitions **`RETRY_PENDING` → `ELIGIBLE`** at the first attempt satisfying `occurred_at ≤ processing_reference_time_N + tolerance`, and applies `GREATEST()` **with no operator action**. Attempts are **finite** (bounded by attempt count, retry age, or both) and delays **increase** — no immediate or fixed-interval hot loop. Across all N attempts `last_activity_at` changes **at most once**, to exactly `GREATEST(prior, E.occurred_at)`: no attempt counter, no partial application, no double count. **Negative control:** if the implementation reuses `processing_reference_time_1` on every attempt, `E` can never become eligible and this test fails — that is the defect it exists to detect |
| AT-TL-SKEW-8 | `E` from AT-TL-SKEW-6, with a skew large enough to exhaust the retry budget while still invalid | exhaust the budget; inspect the terminal state and the alerting surface; then correct the producer clock / let time advance and trigger an operational replay; inspect CRM state again | on exhaustion the delivery becomes **`DEAD_LETTERED`**, which is **not** success and **not** deletion: it retains the **original `event_id`**, `reason = CLOCK_SKEW`, the `workspace_id`, the source domain/event type and the target aggregate reference, and an unclamped `occurred_at`; an operational alert is raised and the state is operator-visible. **Replay** re-enters the same §5.2 evaluation against its **own freshly sampled `processing_reference_time`** (it is not an override — a replay whose sampled clock still leaves the event out of tolerance does **not** apply `GREATEST()`, and returns the delivery to a retryable-or-dead-lettered state rather than acknowledging it), preserves the same logical event identity, synthesizes no new business event, writes no timeline entry, and on success applies `GREATEST()` exactly once. Replaying an already-applied event leaves `last_activity_at` **byte-identical** |
| AT-TL-SKEW-9 | the `last_activity_at` consumer and every future-skew code path | enumerate every reachable disposition for a future-skewed qualifying delivery | exactly **three** states exist — `ELIGIBLE`, `RETRY_PENDING`, `DEAD_LETTERED` — and every delivery resolves to exactly one. **Zero** paths acknowledge a future-skewed delivery as processed without applying it (**no ack-and-drop, no silent ignore**); **zero** paths retry without a finite bound (**no infinite NACK loop**); **zero** paths evaluate eligibility against a cached, frozen, or first-receipt clock rather than a freshly sampled `processing_reference_time` (§5.2.1); **zero** paths discard an eligible qualifying delivery on the basis of an aggregate version, a delivery position, or arrival order; **zero** paths mutate, clamp, or substitute `occurred_at` to force eligibility. `DEAD_LETTERED` is durable, alerted, and replayable rather than terminal loss. No CRM domain table, aggregate, column, DTO, or API response exposes any of the three states — they are async-platform processing state, and no CRM quarantine store exists |
| AT-TL-SKEW-10 | one Lead; two qualifying events from the **same source aggregate**: `E1` with `occurred_at = 12:10`, rejected on its first attempt for future skew, and `E2` with `occurred_at = 12:05`, delivered later and processed successfully while `E1` is still `RETRY_PENDING` or `DEAD_LETTERED` | apply `E2` first; then let `E1` reach an attempt whose `processing_reference_time` makes it eligible (automatic retry or replay); inspect `last_activity_at` after each | after `E2`: `last_activity_at = 12:05`. After `E1` recovers: `last_activity_at = GREATEST(12:05, 12:10) = ` **`12:10`**. `E1` is **NOT discarded** — not because a later-versioned event from the same aggregate was already applied, not because its aggregate version is lower, not because it arrived out of delivery order, and not because it was seen before. No aggregate-version, delivery-position, or arrival-order comparison participates in the decision at any point; the only gates are §5.2 eligibility and the `B2_LEAD_AGGREGATE.md` §4 qualifying set. Replaying either event afterwards leaves `last_activity_at` byte-identical at `12:10`. **This is the regression guard for the recovered-event-discarded defect:** any implementation that drops `E1` here produces `12:05` and fails |

## Timeline merge architecture (TL-MERGE)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-TL-MERGE-1 | a Lead with Messaging and Pipeline entries visible in its timeline | enumerate every CRM-owned table before and after `GET /leads/{id}/timeline` | **byte-identical**. Reading a timeline writes nothing. No CRM cross-domain projection table, dedup store, or quarantine store exists to be written, and none is required for any guarantee in `B2_TIMELINE_IDENTITY_MODEL.md` |
| AT-TL-MERGE-2 | a source domain whose records expose no stable `source_event_id` | `GET /leads/{id}/timeline` | that domain is excluded wholesale at step 4: none of its records becomes an entry, and **no substitute identity is synthesized** from an aggregate public ID, an aggregate version, a row position, or a CRM-side counter. Exclusion is total and deterministic, not per-record guesswork |
| AT-TL-MERGE-3 | one Lead, one caller | trace a single `GET /leads/{id}/timeline` | scope, authorization, relationship, source eligibility, skew eligibility, entry construction, deduplication, merge, ordering, cursor, and page-size limiting occur **only** at the ten steps of `B2_TIMELINE_IDENTITY_MODEL.md` §7.2, in that order. No admission, filtering, or dedup step exists anywhere outside that algorithm |

## Canonical activity vocabulary (ACTV)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-ACTV-1 | a full exercise of all 22 CRM commands | collect every distinct `crm_activities.type` written | every value is one of the canonical 21 in `B2_CRM_ACTIVITY_VOCABULARY.md` §2; the set difference in both directions against that list is empty |
| AT-ACTV-2 | `ConvertBusinessToLead` | inspect the activity written | `type = 'lead_converted'`; **no** row of type `conversion` is written by any code path |
| AT-ACTV-3 | `ChangeLeadStatus`, `AssignLeadOwner`, `ChangeLeadPriority` | inspect | `lead_status_changed`, `lead_owner_changed`, `lead_priority_changed`; the bare forms `status_changed`, `owner_changed`, `priority_changed` never appear |
| AT-ACTV-4 | `UpdateTask` and `AssignTask` | inspect `crm_activities` | **zero** new rows for either — **NO TIMELINE ACTIVITY ROW**; no `task_updated` or `task_assigned` type exists in the vocabulary |
| AT-ACTV-5 | `UpdateTask` and `AssignTask` | inspect `last_activity_at` | it **does** advance for both; writing no activity row and moving no activity date are independent decisions |
| AT-ACTV-6 | `ArchiveLead` by a user | inspect | one `lead_archived` activity; `LeadArchived` carries `reason='user'`; `last_activity_at` is **unchanged** |
| AT-ACTV-7 | `BusinessMerged` that collides two live Leads | inspect the archived Lead | exactly one `lead_business_merged` activity; `LeadArchived` carries `reason='business_merged'`; `last_activity_at` unchanged. This is the only consumed event that writes `crm_activities` |
| AT-ACTV-8 | `MessageSent`, `MessageReceived`, and all four Deal events | inspect `crm_activities` | **zero** rows written by any of them; no `message_sent`, `message_received`, or `deal_*` type exists in the vocabulary |
| AT-ACTV-9 | AI completes an analysis (`LeadIntelligenceCompleted`) | inspect | no activity row, no `last_activity_at` change; no `intelligence_reviewed` type exists |
| AT-ACTV-10 | every activity type in the canonical 21 | check it against `B2_STATE_MACHINES.md` §6, `B2_NOTE_ACTIVITY_TIMELINE.md` §2.1, and `B2_COMMAND_EVENT_CATALOG.md` | one canonical spelling per activity, identical in all four documents; `ACTIVITY_VOCABULARY_DRIFT = 0` |

## last_activity (LACT)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-LACT-1 | new Lead | inspect | `last_activity_at = converted_at` |
| AT-LACT-2 | each qualifying CRM event | trigger | `last_activity_at` advances in the **same transaction** as the mutation |
| AT-LACT-3 | `MessageReceived` with `occurred_at` **older** than the current value | deliver | `last_activity_at` is **unchanged** — `GREATEST()` is monotonic |
| AT-LACT-4 | the same event delivered 5 times | deliver | `last_activity_at` identical after each; consumer idempotent by `event_id` |
| AT-LACT-5 | newest Note removed | remove | `last_activity_at` does **not** move backwards |
| AT-LACT-6 | `LeadIntelligenceCompleted` delivered | observe | `last_activity_at` **unchanged** — machine re-scoring is not activity |
| AT-LACT-7 | `MessageDelivered` delivered | observe | `last_activity_at` **unchanged** — a carrier receipt is not human activity |
| AT-LACT-8 | `ArchiveLead` | archive | `last_activity_at` **unchanged** |
| AT-LACT-9 | a Task is created | observe | `updated_at` and `last_activity_at` both move; they are **separate columns** and are never conflated |

## next_activity (NACT)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-NACT-1 | Lead with 3 pending tasks | inspect | `next_activity_at` = the **earliest** `due_at`; `next_task_ref` names that task |
| AT-NACT-2 | that task is completed | complete | `next_activity_at` recomputes to the next earliest, **in the same transaction** |
| AT-NACT-3 | all tasks completed | complete the last | `next_activity_at IS NULL` |
| AT-NACT-4 | a scheduled Appointment earlier than every task | inspect | `next_activity_at` is **unchanged** — appointments are deliberately excluded |
| AT-NACT-5 | the same Lead | compare `GET /leads` and `GET /leads/{id}` | `next_activity_at` is **identical** in both |
| AT-NACT-6 | a pending task passes its due date | wait | `next_activity_at` is **unchanged** — it is not time-dependent |
| AT-NACT-7 | two tasks with the same `due_at` | inspect | `next_task_ref` is the lower `public_id`; deterministic across repeated reads |

## contacted (CTD)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-CTD-1 | the `leads` schema | inspect | there is **no** `contacted`, `has_been_contacted`, `last_contact_at`, or `contact_status` column |
| AT-CTD-2 | a Lead moved to `status="contacted"` | count | the summary "contacted" counter equals `COUNT(status='contacted')` |
| AT-CTD-3 | a Task is created on a `new` Lead | observe | `status` stays `new` — **creating a task is not contact** |
| AT-CTD-4 | a Note is added | observe | `status` unchanged |
| AT-CTD-5 | an Appointment is scheduled | observe | `status` unchanged |
| AT-CTD-6 | `MessageSent` is delivered to CRM | observe | `status` **unchanged**; only `last_activity_at` moves. Messaging never mutates CRM status |

## CRM list (LIST)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-LIST-1 | 5 Leads | `GET /leads` | `200 LeadList`; envelope is exactly `{items, page_info}`; `page_info` matches the frozen `PageInfo` |
| AT-LIST-2 | any list row | inspect | it carries `business_name`, `business_city`, `owner_display_name`, `intelligence_score`, `intelligence_tier`, `next_task_title`, `owner_inactive` |
| AT-LIST-3 | archived Lead exists | `GET /leads` | it is absent by default; present with `include_archived=true` |
| AT-LIST-4 | the frozen `Lead` schema | diff against `BACKEND_OPENAPI_V1.yaml` | **identical** — B2 amends no field and no required set |
| AT-LIST-5 | unknown query parameter | `GET /leads?foo=1` | `400 VALIDATION_ERROR` naming `foo`; never silently ignored |
| AT-LIST-6 | the list read model | force a stale Business city | `GET /leads/{id}` and `/360` return the **live** city; only the list may lag |

## Filters (FILT)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-FILT-1 | each of the 9 filters | apply individually | each returns exactly the matching set; matches `Crm.tsx` semantics |
| AT-FILT-2 | `status` and `priority` repeated | `?status=new&status=contacted` | OR within a parameter, AND across parameters |
| AT-FILT-3 | `tag` repeated | `?tag=a&tag=b` | **AND** across values — a Lead must carry both |
| AT-FILT-4 | Leads with a NULL AI score | `?min_score=40` | NULL-score Leads are **excluded**, matching `score !== null && score >= n` |
| AT-FILT-5 | `?status=won` | apply | `400 VALIDATION_ERROR` — never an empty `200` |
| AT-FILT-6 | `?city=…` | apply | filters on the Business city; **no** `city` column exists on `leads` |

## Search (SRCH)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-SRCH-1 | Business named "عيادات الحياة" | `?q=الحياة` | matched; substring, unanchored |
| AT-SRCH-2 | same with different diacritics/case | `?q=` a variant | matched — normalization is applied |
| AT-SRCH-3 | `?q=lead-1042` | search | matches `LEAD-1042` — case-insensitive |
| AT-SRCH-4 | a contact phone number | `?q=+966114568201` | **no match** — contact details are excluded from search |
| AT-SRCH-5 | a note body fragment | search | **no match** — note bodies are not searchable |
| AT-SRCH-6 | `q` of 200 chars | search | `400 VALIDATION_ERROR` |

## Sorting (SORT)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-SORT-1 | each of the 6 sorts | apply | ordering matches the declared key exactly |
| AT-SORT-2 | two Leads with identical sort values | repeat the request 50× | the order is **identical every time** — the key is total via `public_id` |
| AT-SORT-3 | `?sort=score` with NULL scores | apply | NULLs sort **last** |
| AT-SORT-4 | `?sort=created` | apply | **ascending** by `converted_at`, matching the frozen "الأقدم إنشاءً" |
| AT-SORT-5 | `?sort=unknown` | apply | `400 VALIDATION_ERROR` |

## Pagination (PAGE)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-PAGE-1 | 60 Leads, `limit=25` | page through | 25 + 25 + 10; no Lead skipped or repeated |
| AT-PAGE-2 | mid-pagination Lead updates by another user | page through | still no skip or repeat under the stable key |
| AT-PAGE-3 | a cursor from `sort=priority` | present with `sort=score` | `400 VALIDATION_ERROR`; never silently reinterpreted |
| AT-PAGE-4 | a cursor with a changed filter set | present | `400 VALIDATION_ERROR` |
| AT-PAGE-5 | last page | inspect | `page_info.next_cursor IS NULL`, `has_next=false` |
| AT-PAGE-6 | `limit=101` | request | `400 VALIDATION_ERROR`; the frozen bound is 1–100 |

## Lead 360 (L360)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-L360-1 | full Lead | `GET /leads/{id}/360` | validates against the frozen `Lead360`; `required` is still `[lead, business]`; the only added field is `notes` |
| AT-L360-2 | any 360 response | inspect | `contacts`, `conversations`, `tasks`, `appointments`, `deals`, `notes`, `revenue_refs` are all `EntityRef[]` |
| AT-L360-3 | Leads with revenue | inspect `revenue_refs` | **identities only**; **zero** monetary amounts anywhere in the response |
| AT-L360-4 | Intelligence read model unavailable | `GET .../360` | `200` with `intelligence: null`; the rest of the response is served |
| AT-L360-5 | archived Lead | `GET .../360` | `200` with `lead.archived_at` populated |
| AT-L360-6 | any 360 route | `POST`/`PATCH`/`DELETE` it | `404`/`405` — the read model is unreachable by any command |

## Provenance (PROV)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-PROV-1 | conversion | inspect `lead_provenance` | exactly one row with source, job, business, analysis, opportunity, score, tier, scoring version, business-name snapshot, actor, timestamp |
| AT-PROV-2 | Business renamed after conversion | `GET .../360` | `business.name` is **new**; `business_name_snapshot` is **old** |
| AT-PROV-3 | analysis regenerated with a different score | `GET .../360` | live `intelligence` shows the new score; provenance shows the conversion-time score; **no CRM row changed** |
| AT-PROV-4 | Discovery Job archived | `GET .../360` | the `JOB-*` renders as a historical identity with `resolvable=false`; not an error |
| AT-PROV-5 | any command | attempt to update `lead_provenance` | impossible — the row is written once and never updated |
| AT-PROV-6 | Business merged | observe | `lead_provenance` still names the **original** `BUS-*` |

## AI boundary (AIB)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-AIB-1 | the `leads` schema | inspect | no `score`, `tier`, `confidence`, `sales_approach`, `reasons`, or `services` column |
| AT-AIB-2 | AI regenerates an analysis | observe CRM | **zero** CRM rows change; zero CRM events |
| AT-AIB-3 | AI proposes a priority or a next action | observe | no CRM mutation occurs without an explicit human command |
| AT-AIB-4 | `salesApproach` | trace its authority | it is the Opportunity's field (AI domain); CRM stores none and offers no accept command in Phase 1 |
| AT-AIB-5 | `Lead360.intelligence` | inspect | it is the opaque object supplied live by the Intelligence domain |

## Messaging boundary (MSGB)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-MSGB-1 | a message is sent | inspect `crm_activities` | **zero** new rows |
| AT-MSGB-2 | same | `GET /leads/{id}/timeline` | the message **appears**, `source_domain="messaging"` |
| AT-MSGB-3 | same | inspect `leads` | only `last_activity_at` changed; `status` and `priority` untouched |
| AT-MSGB-4 | the `leads` schema | inspect | no `conversation_id`, `unread_count`, or `last_message_at` column |

## Pipeline boundary (PIPEB)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-PIPEB-1 | the `leads` schema | inspect | no `deal_id`, `value`, `currency`, `stage`, or `probability` column |
| AT-PIPEB-2 | Lead with 3 open Deals | `GET .../360` | all three appear as `EntityRef`s; multiple open Deals per Lead are permitted |
| AT-PIPEB-3 | `DealWon` occurs | observe CRM | `last_activity_at` moves; `status` is **unchanged** — a won Deal does not qualify a Lead |
| AT-PIPEB-4 | archive a Lead with an open Deal | archive | `200`; the Deal is **not** closed, deleted, or mutated |

## Revenue boundary (REVB)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-REVB-1 | every CRM command | run the full suite | **zero** `RevenueRecognized` events emitted by CRM |
| AT-REVB-2 | `DealWon` | observe | no `revenue_events` row is created by any CRM path |
| AT-REVB-3 | every CRM response body | scan | **zero** monetary amounts; `revenue_refs` carries identities only |
| AT-REVB-4 | a Billing invoice is paid | observe | no CRM row changes and no customer RevenueEvent is created |
| AT-REVB-5 | the `leads` schema | inspect | no `revenue` or `attributed_revenue` column |

## Attribution boundary (ATTB)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-ATTB-1 | `LeadCreated` | observe | Attribution may consume it; **CRM writes no touchpoint** |
| AT-ATTB-2 | every CRM response | scan | no attribution allocation appears |
| AT-ATTB-3 | attribution recalculated | observe CRM | zero CRM rows change |

## Concurrency (CONC)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-CONC-1 | one Lead, 20 concurrent status changes | fire | exactly 1 × `200`, 19 × `409 STALE_VERSION`; `version` +1 exactly; the final status is one of the submitted values |
| AT-CONC-2 | status change × owner assignment on one Lead | fire | one succeeds, one `409 STALE_VERSION`; field-level versioning does **not** exist |
| AT-CONC-3 | 20 concurrent `CompleteTask` on one task | fire | exactly one `TaskCompleted`; a completion count can never double |
| AT-CONC-4 | 2 concurrent appointment reschedules | fire | one `200`, one `409`; the appointment lands on exactly one of the two times |
| AT-CONC-5 | `ArchiveLead` × `CreateDeal` | fire | **both succeed**; no cross-domain gate exists |
| AT-CONC-6 | `ArchiveLead` × `ConvertBusinessToLead` for the same Business | fire | never two live Leads, in either commit order |
| AT-CONC-7 | `BusinessMerged` × conversion of the merged-away Business | fire | never an orphan Lead; the merge-first path returns `409 CONFLICT`·`business_not_convertible` |
| AT-CONC-8 | `CreateTask` × `CompleteTask` on one Lead | fire | `next_activity_at` equals the true minimum over the committed task set |
| AT-CONC-9 | 2 concurrent identical `AddLeadTag` | fire | both `200`; exactly one `lead_tags` row |
| AT-CONC-10 | every race in `B2_CONCURRENCY_IDEMPOTENCY.md` §2 | inspect the decision path | **no Redis key participates in any of them** |

## Idempotency (IDEM)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-IDEM-1 | conversion retried, same key and body | fire | the original `201` replayed verbatim; one Lead; one quota unit |
| AT-IDEM-2 | same key, different body | fire | `409 IDEMPOTENCY_CONFLICT`; no mutation |
| AT-IDEM-3 | conversion without the header | fire | `400 VALIDATION_ERROR`; **no durable state written** |
| AT-IDEM-4 | every B2 request DTO | inspect the schema | **no** DTO declares `idempotency_key`; sending one is `400 VALIDATION_ERROR` |
| AT-IDEM-5 | every idempotent B2 operation | send the key **only** as the header | accepted and honoured; a replay returns the stored response |
| AT-IDEM-6 | idempotency records | inspect retention | ≥24h (the B0 normal-command tier); the 7-day tier stays reserved for payment/webhook |
| AT-IDEM-7 | `If-Match` commands | retry with a consumed version | `409 STALE_VERSION` — the at-most-once semantics a key would otherwise provide |

## RBAC (RBAC)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-RBAC-1 | each of the 6 roles × each of the 9 CRM permissions | attempt the guarded operation | the outcome matches the B1 matrix cell exactly |
| AT-RBAC-2 | `viewer` | any CRM mutation | `403 PERMISSION_DENIED` |
| AT-RBAC-3 | caller lacking `lead.view`, `LEAD-9999` nonexistent | `GET /leads/LEAD-9999` | `403 PERMISSION_DENIED` (step 8), **not** `404` — IDs cannot be probed |
| AT-RBAC-4 | role demoted mid-session | issue a previously allowed request | `403` immediately; **no cache layer exists** |
| AT-RBAC-5 | `lead.archive` before the amendment is applied | archive | the operation is not shippable; the permission is unregistered |
| AT-RBAC-6 | the CRM permission set | enumerate | exactly the 9 codes in `B2_AUTHORIZATION_ENTITLEMENT.md` §2; every one already exists in B1 except `lead.archive` |
| AT-RBAC-7 | every CRM route | call as each role | authorization is enforced in the application service, verified by calling the service directly, not only via HTTP |

## Entitlements (ENT)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-ENT-1 | plan without `crm.core` | any CRM operation | `403 ENTITLEMENT_LOCKED`; `details.capability="crm.core"`; `target_plan_ref` present |
| AT-ENT-2 | `viewer` on a plan **with** `crm.core` | `PATCH /leads/{id}` | `403 PERMISSION_DENIED`; `details` contains **no** capability, usage, or `target_plan_ref` |
| AT-ENT-3 | capability `not_included` | act | quota is **never consulted**; reported as `LOCKED` |
| AT-ENT-4 | all three frozen plans | evaluate `crm.core` | included in every one — matching `entitlementService.ts` |

## Quotas (QUO)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-QUO-1 | workspace at its `leads` limit | convert | `403 QUOTA_EXHAUSTED`; **no Lead, no Contact, no provenance, no event** |
| AT-QUO-2 | one unit remaining, 2 concurrent conversions of **different** Businesses | fire | exactly one `201`, one `403 QUOTA_EXHAUSTED`; usage +1 exactly |
| AT-QUO-3 | archive a Lead | archive | `leads` usage decreases by exactly 1 |
| AT-QUO-4 | convert an already-converted Business | convert | usage **unchanged** |
| AT-QUO-5 | create tasks, notes, contacts, appointments, tags | create many | `leads` usage **unchanged** — only Leads are metered |
| AT-QUO-6 | a conversion rolls back after reservation | force a later failure | the reservation rolls back with it; **no Redis counter was decremented** |

## Privacy (PRIV)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-PRIV-1 | full CRM suite | scan application logs | zero contact names, phones, emails, note bodies, task titles, or appointment locations |
| AT-PRIV-2 | full suite | scan `outbox_events` and Celery arguments | zero occurrences of the same six data classes |
| AT-PRIV-3 | full suite | scan `audit_logs` | before/after carry enums, refs, and **field names** only — never PII values |
| AT-PRIV-4 | full suite | scan `crm_activities.summary` and every timeline `summary` | zero free text originating from a user |
| AT-PRIV-5 | `RemoveNote` | execute | `archived_at` set; the body is retained under the note's own retention policy; the `note_added` activity survives |
| AT-PRIV-6 | the CRM PII inventory | enumerate | exactly the five locations in `B2_PRIVACY_AUDIT_MODEL.md` Rule CP-7 |
| AT-PRIV-7 | CRM export | attempt | not implemented in Phase 1; no bulk PII egress path exists |

## Audit (AUD)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-AUD-1 | each of the 22 CRM audit actions | trigger it | exactly one immutable `audit_logs` row with actor, workspace, action, target, result, `request_id`, and `permission_matrix_version` |
| AT-AUD-2 | any CRM audit row | attempt `UPDATE`/`DELETE` | rejected — append-only |
| AT-AUD-3 | every CRM denial path | trigger | a `result='denied'` row exists carrying the specific `error_code` |
| AT-AUD-4 | a status change | inspect | `before`/`after` contain the old and new status and nothing sensitive |
| AT-AUD-5 | a contact update | inspect | `after` contains `changed_fields` **names only** — never the old or new phone |
| AT-AUD-6 | an Automation-driven change | inspect | actor is `system:automation` with the `RUN-*` label; distinguishable from a human actor |
| AT-AUD-7 | the 9 CRM permissions × the 22 CRM audit actions | compare the namespaces | **zero** string collisions |
| AT-AUD-8 | every CRM audit row | inspect `workspace_id` | **never NULL** — there is no pre-tenant CRM action |

## Archive and delete (ARCH)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-ARCH-1 | active Lead | archive | `200`; `archived_at` set; it leaves the default list and the duplicate index |
| AT-ARCH-2 | archived Lead | any CRM mutation on it or its children | `409 CONFLICT`·`lead_archived` |
| AT-ARCH-3 | archived Lead | `GET /leads/{id}`, `/360`, `/timeline` | all `200`; history stays legible |
| AT-ARCH-4 | archived Lead | inspect its children | contacts, tasks, appointments, notes, and activities are all **retained** |
| AT-ARCH-5 | archived Lead | inspect other domains | Deals, Conversations, RevenueEvents, and Touchpoints are **untouched** |
| AT-ARCH-6 | any Lead | `DELETE /leads/{id}` | the route does not exist; Leads are never hard-deleted |
| AT-ARCH-7 | archived Lead | un-archive | not supported; re-converting the Business creates a **new** `LEAD-*` |
| AT-ARCH-8 | archive | inspect the quota | `leads` usage released by exactly 1 |

## Cross-workspace injection (XWS)

| ID | Precondition | Action | Assert |
|---|---|---|---|
| AT-XWS-1 | every relationship in Doctrine R-2 reachable from CRM (`owner_ref`, `assignee_ref`, `organizer_ref`, `source_job_ref`, `deal_ref`, `contact_ref`, `business` path ID) | submit a cross-tenant ref for each | all `404 ENTITY_NOT_FOUND`; **zero rows created**; `authz.relationship_out_of_scope` audited for each |
| AT-XWS-2 | same | inspect the responses | none returns `400` — a validation error would confirm existence |
| AT-XWS-3 | a `LEAD-*` from W2 in a `PATCH` path | submit | `404`, byte-identical to a random ID |
| AT-XWS-4 | a top-level `TSK-*`/`APT-*`/`CON-*`/`NOTE-*` from W2 | submit | `404` for each; the top-level routes are scoped, not forgeable |
| AT-XWS-5 | timing over 1000 cross-tenant vs nonexistent requests | measure | no separable distribution at p<0.01 |

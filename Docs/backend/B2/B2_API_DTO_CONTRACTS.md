# B2 — CRM API, DTO, and Validation Contracts

> **B2 status:** Contracts on paper. **No endpoint, serializer, router, or OpenAPI change is authorized under B2.** Operations marked *(ADD)* require a controlled additive change to the frozen `BACKEND_OPENAPI_V1.yaml` at the B2 implementation-contract step; B2 itself does not edit it.

All routes are under the B0 base path `/api/v1/` (OpenAPI path keys omit the prefix). Conventions inherited from `BACKEND_API_STANDARD.md`: `snake_case` JSON, prefixed public IDs, UTC ISO-8601 `Z` timestamps, `request_id` on every response, CSRF on unsafe cookie-authenticated requests, `Idempotency-Key` header on durable mutation commands, `If-Match` on versioned updates with `409` on stale data.

## 1. Reconciliation with the frozen B0 surface

| Frozen B0 operation | B2 treatment |
|---|---|
| `POST /businesses/{id}/convert-to-lead` → `201 Lead` | **Body unchanged.** One additive **response header** `X-Lead-Conversion-Outcome` distinguishes `created` from `existing`, which the frozen `201` description ("Lead created or existing Lead returned") already contemplates but does not expose (`B2-D-B005`) |
| `PATCH /leads/{id}` → `200 Lead`, request `LeadUpdate` | **Unchanged.** B2 defines the enums, the transition rules, and the per-field permissions the frozen unconstrained strings leave open |
| `GET /leads/{id}/360` → `200 Lead360` | **One additive field**: `notes: EntityRef[]` (`B2-D-B008`). No existing field, type, or required set changes |
| `Lead`, `LeadUpdate`, `ConvertBusinessRequest`, `Business`, `EntityRef`, `PageInfo`, `ErrorEnvelope` | **Unchanged.** B2 amends none of them |
| `GET /deals`, `POST /deals`, `/deals/{id}/stage`, `/deals/{id}/close` | **Unchanged.** Pipeline-owned; CRM reads Deal `EntityRef`s only |
| `POST /conversations/{id}/messages` | **Unchanged.** Messaging-owned |
| `POST /revenue-events`, `GET /attribution` | **Unchanged.** No CRM operation creates or reads a revenue amount |
| `GET /dashboard/overview` | **Unchanged operation.** B2 supplies the six CRM summary counters as inputs to its projection (`B2-D-B007`) |

**The frozen `Lead` schema is not amended.** The CRM list and detail views need business name, city, score, tier, owner name, and activity dates; rather than widen a frozen `additionalProperties: false` schema, B2 introduces `LeadListItem` and `LeadDetail` as new DTOs. This is the same technique B1 used to avoid touching the frozen `Workspace` projection.

## 2. B2 target API surface

`P` = permission · `Idem` = `Idempotency-Key` header (`req` required, `rec` recommended, `—` not applicable) · `If-M` = `If-Match`.

### Leads

| Method | Route | P | Request | Response | Errors | Idem | If-M | Audit |
|---|---|---|---|---|---|---|---|---|
| GET | `/leads` *(ADD)* | `lead.view` | query allow-list §5 | `200 LeadList` | 400,401,403,404,500 | — | — | — |
| GET | `/leads/{id}` *(ADD)* | `lead.view` | — | `200 LeadDetail` | 401,403,404,500 | — | — | — |
| PATCH | `/leads/{id}` *(FROZEN)* | `lead.update` and/or `lead.assign` | `LeadUpdate` | `200 Lead` | 400,401,403,404,409,500 | rec | yes | `lead.status_changed` / `lead.priority_changed` / `lead.owner_changed` |
| POST | `/businesses/{id}/convert-to-lead` *(FROZEN)* | `business.convert` | `ConvertBusinessRequest` | `201 Lead` | 400,401,403,404,409,500 | req | — | `lead.converted` |
| GET | `/leads/{id}/360` *(FROZEN, amended §1)* | `lead.view` | — | `200 Lead360` | 401,403,404,500 | — | — | — |
| GET | `/leads/{id}/timeline` *(ADD)* | `lead.view` | cursor,limit | `200 TimelineList` | 400,401,403,404,500 | — | — | — |
| POST | `/leads/{id}/archive` *(ADD)* | `lead.archive` | `VersionedCommand` | `200 LeadDetail` | 400,401,403,404,409,500 | — | yes | `lead.archived` |
| POST | `/leads/{id}/tags` *(ADD)* | `lead.update` | `LeadTagRequest` | `200 LeadDetail` | 400,401,403,404,409,500 | — | yes | `lead.tag_added` |
| DELETE | `/leads/{id}/tags/{tag}` *(ADD)* | `lead.update` | `VersionedCommand` | `200 LeadDetail` | 400,401,403,404,409,500 | — | yes | `lead.tag_removed` |

### Contacts

| Method | Route | P | Request | Response | Errors | Idem | If-M | Audit |
|---|---|---|---|---|---|---|---|---|
| GET | `/leads/{id}/contacts` *(ADD)* | `lead.view` | cursor,limit | `200 ContactList` | 401,403,404,500 | — | — | — |
| POST | `/leads/{id}/contacts` *(ADD)* | `lead.update` | `ContactCreateRequest` | `201 Contact` | 400,401,403,404,409,500 | rec | — | `contact.added` |
| PATCH | `/contacts/{id}` *(ADD)* | `lead.update` | `ContactUpdateRequest` | `200 Contact` | 400,401,403,404,409,500 | — | yes | `contact.updated` |
| DELETE | `/leads/{id}/contacts/{contact_id}` *(ADD)* | `lead.update` | `VersionedCommand` | `204` | 400,401,403,404,409,500 | — | yes | `contact.removed` |

### Tasks

| Method | Route | P | Request | Response | Errors | Idem | If-M | Audit |
|---|---|---|---|---|---|---|---|---|
| GET | `/tasks` *(ADD)* | `task.view` | query allow-list §5.2 | `200 TaskList` | 400,401,403,404,500 | — | — | — |
| GET | `/leads/{id}/tasks` *(ADD)* | `task.view` | cursor,limit,`status` | `200 TaskList` | 400,401,403,404,500 | — | — | — |
| POST | `/leads/{id}/tasks` *(ADD)* | `task.manage` | `TaskCreateRequest` | `201 Task` | 400,401,403,404,409,500 | rec | — | `task.created` |
| PATCH | `/tasks/{id}` *(ADD)* | `task.manage` | `TaskUpdateRequest` | `200 Task` | 400,401,403,404,409,500 | — | yes | `task.updated` / `task.assigned` |
| POST | `/tasks/{id}/complete` *(ADD)* | `task.manage` | `VersionedCommand` | `200 Task` | 400,401,403,404,409,500 | — | yes | `task.completed` |
| POST | `/tasks/{id}/cancel` *(ADD)* | `task.manage` | `TaskCancelRequest` | `200 Task` | 400,401,403,404,409,500 | — | yes | `task.cancelled` |

### Appointments

| Method | Route | P | Request | Response | Errors | Idem | If-M | Audit |
|---|---|---|---|---|---|---|---|---|
| GET | `/leads/{id}/appointments` *(ADD)* | `appointment.view` | cursor,limit,`status` | `200 AppointmentList` | 400,401,403,404,500 | — | — | — |
| POST | `/leads/{id}/appointments` *(ADD)* | `appointment.manage` | `AppointmentCreateRequest` | `201 Appointment` | 400,401,403,404,409,500 | rec | — | `appointment.created` |
| POST | `/appointments/{id}/reschedule` *(ADD)* | `appointment.manage` | `AppointmentRescheduleRequest` | `200 Appointment` | 400,401,403,404,409,500 | — | yes | `appointment.rescheduled` |
| POST | `/appointments/{id}/cancel` *(ADD)* | `appointment.manage` | `AppointmentTransitionRequest` | `200 Appointment` | 400,401,403,404,409,500 | — | yes | `appointment.cancelled` |
| POST | `/appointments/{id}/complete` *(ADD)* | `appointment.manage` | `VersionedCommand` | `200 Appointment` | 400,401,403,404,409,500 | — | yes | `appointment.completed` |
| POST | `/appointments/{id}/no-show` *(ADD)* | `appointment.manage` | `VersionedCommand` | `200 Appointment` | 400,401,403,404,409,500 | — | yes | `appointment.no_show` |

### Notes

| Method | Route | P | Request | Response | Errors | Idem | If-M | Audit |
|---|---|---|---|---|---|---|---|---|
| GET | `/leads/{id}/notes` *(ADD)* | `lead.view` | cursor,limit | `200 NoteList` | 401,403,404,500 | — | — | — |
| POST | `/leads/{id}/notes` *(ADD)* | `lead.update` | `NoteCreateRequest` | `201 Note` | 400,401,403,404,409,500 | rec | — | `note.added` |
| DELETE | `/notes/{id}` *(ADD)* | `lead.update` + author-or-manager condition | `VersionedCommand` | `204` | 400,401,403,404,409,500 | — | yes | `note.removed` |

**Total B2 target surface: 28 operations — 3 frozen and 25 B2-additive.**

**Route shape rationale.** Sub-resources that only ever exist inside one Lead (`contacts`, `tasks`, `appointments`, `notes`, `tags`, `timeline`) are created and listed under `/leads/{id}/…`, so the parent is always proven before the child. Mutations of an already-identified child use a **top-level** route (`/tasks/{id}`, `/appointments/{id}`, `/contacts/{id}`, `/notes/{id}`), because the child's public ID already determines its Lead and repeating the parent in the path would create a second, forgeable way to name it. State transitions use `POST /{resource}/{id}/{action}`, following B0's own `/deals/{id}/stage` and `/deals/{id}/close` precedent, rather than overloading `PATCH` with a status field.

**Doctrine R-3 applies to `{workspace_id}`-free routes too.** No CRM route carries a workspace path segment; the active workspace comes only from `sessions.active_workspace_id` (B1 §4). A `workspace_id` in any body, header, or query parameter is a presentation input and is never read by the pipeline.

## 3. Response DTOs

Legend — **T** type · **R** required · **N** nullable · **S** server-generated · **W** client-writable · **I** immutable · **X** sensitive.

### `Lead` *(frozen B0 — unchanged, restated for reference)*
`public_id` (R,S,I) · `business_ref` (R,S,I) · `owner_ref` (S) · `status` (R,S) · `priority` (S) · `source_job_ref` (N,S) · `version` (R,S). Required: `[public_id, business_ref, status, version]`.

### `LeadDetail` *(B2)*
| Field | T | R | N | S | Notes |
|---|---|---|---|---|---|
| `public_id` | `LEAD-*` | ✔ | | ✔ | immutable |
| `business_ref` | `EntityRef` | ✔ | | ✔ | `BUS-*` |
| `origin_type` | enum(1) | ✔ | | ✔ | `discovery` |
| `source_job_ref` | `EntityRef` | | ✔ | ✔ | `JOB-*` |
| `owner_ref` | `EntityRef` | ✔ | | ✔ | `MEM-*` |
| `owner_display_name` | string | ✔ | | ✔ | denormalized for rendering, as B1's `Membership.display_name` |
| `owner_inactive` | boolean | ✔ | | ✔ | owner Membership is no longer `active` |
| `status` | enum(5) | ✔ | | | |
| `priority` | enum(3) | ✔ | | | |
| `tags` | string[] | ✔ | | ✔ | sorted, deduplicated |
| `last_activity_at` | date-time | ✔ | | ✔ | monotonic |
| `next_activity_at` | date-time | | ✔ | ✔ | tasks-only authority |
| `next_task_ref` | `EntityRef` | | ✔ | ✔ | `TSK-*` |
| `converted_at` | date-time | ✔ | | ✔ | immutable |
| `archived_at` | date-time | | ✔ | ✔ | |
| `created_at` / `updated_at` | date-time | ✔ | | ✔ | |
| `version` | integer ≥1 | ✔ | | ✔ | `If-Match` precondition |

### `LeadListItem` *(B2)*
`B2_CRM_LIST_QUERY_MODEL.md` §7 defines the field set. It adds `business_name`, `business_category`, `business_city`, `source_job_name`, `intelligence_score` (N), `intelligence_tier` (N), and `next_task_title` (N) to the `LeadDetail` core, and omits `created_at`. Every added field is `S` and `N`-safe; none is client-writable and none is authoritative.

### `Contact` *(B2)*
`public_id` (`CON-*`, R,S,I) · `business_ref` (N,S) · `name` (R,W) · `title` (N,W) · `phone` (N,W) · `email` (N,W) · `source` (R,S; `discovery_business`\|`manual`) · `is_primary` (R,S; the link flag for the Lead in context) · `linked_lead_refs` (R,S; `EntityRef[]` of live links **visible to the caller**) · `duplicate_candidates` (S; `EntityRef[]`, ≤5, advisory only) · `archived_at` (N,S) · `version` (R,S) · `created_at`/`updated_at` (R,S).

### `Task` *(B2)*
`public_id` (`TSK-*`, R,S,I) · `lead_ref` (R,S,I) · `title` (R,W) · `description` (N,W) · `type` (R,W; free text ≤60) · `status` (R,S; enum(3)) · `priority` (R,W; enum(3)) · `due_at` (R,W) · `is_overdue` (R,S,bool; **derived**) · `assignee_ref` (R,W; `MEM-*`) · `assignee_display_name` (R,S) · `created_by_ref` (R,S,I) · `completed_at` (N,S) · `cancelled_at` (N,S) · `cancel_reason` (N,S) · `origin` (R,S; `manual`\|`automation`) · `automation_run_ref` (N,S) · `version` (R,S) · `created_at`/`updated_at` (R,S).

### `Appointment` *(B2)*
`public_id` (`APT-*`, R,S,I) · `lead_ref` (R,S,I) · `deal_ref` (N,S) · `title` (R,W) · `type` (R,W; enum(4)) · `status` (R,S; enum(4)) · `start_at` (R,W) · `end_at` (R,W) · `timezone` (R,W; IANA) · `location_type` (R,W; enum(4)) · `location` (N,W) · `organizer_ref` (R,W; `MEM-*`) · `organizer_display_name` (R,S) · `overlap_warning` (R,S,bool) · `overlapping_appointment_refs` (S; `EntityRef[]`, ≤5) · `cancelled_at`/`cancel_reason`/`completed_at` (N,S) · `origin` (R,S) · `automation_run_ref` (N,S) · `version` (R,S) · `created_at`/`updated_at` (R,S).

### `Note` *(B2)*
`public_id` (`NOTE-*`, R,S,I) · `lead_ref` (R,S,I) · `body` (R,W,I after creation) · `author_ref` (R,S,I; `MEM-*`) · `author_display_name` (R,S) · `archived_at` (N,S) · `version` (R,S) · `created_at`/`updated_at` (R,S).

### `TimelineEntry` *(B2)*
`entry_id` (R,S,I) · `source_domain` (R,S; `crm`\|`messaging`\|`pipeline`) · `source_event_id` (N,S) · `source_resource_ref` (R,S; `EntityRef`) · `source_event_type` (R,S) · `occurred_at` (R,S) · `recorded_at` (R,S) · `actor_ref` (N,S; `MEM-*`) · `actor_label` (N,S) · `summary` (R,S; **PII-free template output**) · `change` (N,S; `{field, from, to}`) · `target_ref` (N,S) · `route_hint` (N,S).

**`entry_id` is never a source record's public ID.** `B2_TIMELINE_IDENTITY_MODEL.md` §2.2 is normative for its two shapes, and this DTO carries them verbatim:

| | `entry_id` | `source_domain` | `source_event_id` | `source_resource_ref` |
|---|---|---|---|---|
| **CRM-owned** | the `crm_activities.public_id` (`ACT-*`) | `crm` | **null** — the `ACT-*` identity is itself the canonical event identity | the affected resource, e.g. `TSK-1043` |
| **Cross-domain** | `<source_domain>:<source_event_id>` | `messaging` \| `pipeline` | the source's stable immutable logical-event identity (§2.2.1) | the source aggregate, e.g. `DEAL-4042`, `MSG-5000` |

Three consequences the serializer must honor:

- **`source_resource_ref` is never used as a cross-domain `entry_id`.** `DEAL-4042` emitting four events yields four distinct `entry_id` values that all carry `source_resource_ref = DEAL-4042`; `source_resource_ref` therefore repeats across entries and is not unique.
- **`source_event_id` is a distinct field from `entry_id`**, and is the deduplication identity `(source_domain, source_event_id)` applied during the read-time merge. It is the only field that is null for one shape and required for the other.
- **`source_event_type` is the canonical name** for the source's own event type (`task_created`, `message_inbound`, `deal_stage_changed`). It replaces the `kind` and `source_type` names earlier drafts used for the same value; there is no separate source-class field, because `source_domain` already carries the class and has exactly three reachable values.

`TimelineEntry` is read-only in full: no property is client-writable, and the whole DTO is `S` (safe for every caller who passed the per-source authorization of `B2_NOTE_ACTIVITY_TIMELINE.md` §3.2).

### List envelopes — `LeadList`, `ContactList`, `TaskList`, `AppointmentList`, `NoteList`, `TimelineList`
All six use the **frozen B0 list convention** verbatim (`WorkspaceList`, `DealList`, `InvoiceList`): an object with `items` and `page_info`, both required, `additionalProperties: false`. `page_info` is the frozen `PageInfo` (`next_cursor` required and nullable, `has_next`). Cursor pagination follows ADR-011.

| DTO | `items[]` element |
|---|---|
| `LeadList` | `LeadListItem` |
| `ContactList` | `Contact` |
| `TaskList` | `Task` |
| `AppointmentList` | `Appointment` |
| `NoteList` | `Note` |
| `TimelineList` | `TimelineEntry` |

**`RESPONSE_DTO_COUNT` = 15** — 13 defined by B2 (`LeadDetail`, `LeadListItem`, `Contact`, `Task`, `Appointment`, `Note`, `TimelineEntry`, `LeadList`, `ContactList`, `TaskList`, `AppointmentList`, `NoteList`, `TimelineList`) plus the 2 frozen response DTOs B2 operations return (`Lead`, `Lead360`).

## 4. Request DTOs (all `additionalProperties: false`)

> **No request DTO carries an idempotency field.** `Idempotency-Key` is an HTTP header. Sending `idempotency_key` in a body is rejected `400 VALIDATION_ERROR` as an unknown field.

| DTO | Fields and validation |
|---|---|
| `ConvertBusinessRequest` *(frozen)* | `owner_ref` (opt, `MEM-*`), `source_job_ref` (opt, `JOB-*`) |
| `LeadUpdate` *(frozen)* | `status` (opt, enum(5)), `priority` (opt, enum(3)), `owner_ref` (opt, `MEM-*`), `version` (R, ≥1). At least one of the three fields must be present, else `400` |
| `VersionedCommand` *(reused from B1)* | `version` (R, ≥1) |
| `LeadTagRequest` | `tag` (R, 1–40 chars, trimmed, NFC), `version` (R) |
| `ContactCreateRequest` | `name` (R, 1–160), `title` (opt, ≤120), `phone` (opt, ≤40), `email` (opt, RFC-shaped, ≤254), `is_primary` (opt, default `false`). Cross-field: at least one of `phone`/`email` unless the caller sets neither and accepts a name-only contact |
| `ContactUpdateRequest` | `name`, `title`, `phone`, `email`, `is_primary` (all opt), `version` (R) |
| `TaskCreateRequest` | `title` (R, 1–200), `type` (R, ≤60), `description` (opt, ≤4000), `priority` (opt, enum(3), default = the Lead's), `due_at` (R, ISO-8601 UTC), `assignee_ref` (opt, `MEM-*`, default = the Lead's owner) |
| `TaskUpdateRequest` | `title`, `type`, `description`, `priority`, `due_at`, `assignee_ref` (all opt), `version` (R) |
| `TaskCancelRequest` | `cancel_reason` (opt, ≤500), `version` (R) |
| `AppointmentCreateRequest` | `title` (R, 1–200), `type` (R, enum(4)), `start_at` (R), `end_at` (R), `timezone` (opt, IANA, default = workspace), `location_type` (R, enum(4)), `location` (opt, ≤500), `organizer_ref` (opt, default = the Lead's owner), `deal_ref` (opt, `DEAL-*`). Cross-field: `end_at > start_at` |
| `AppointmentRescheduleRequest` | `start_at` (R), `end_at` (R), `timezone` (opt), `version` (R). Cross-field: `end_at > start_at` |
| `AppointmentTransitionRequest` | `cancel_reason` (opt, ≤500), `version` (R) |
| `NoteCreateRequest` | `body` (R, 1–8000 after trim) |

**`REQUEST_DTO_COUNT` = 13** — 10 defined by B2 plus 3 reused (`ConvertBusinessRequest`, `LeadUpdate` frozen; `VersionedCommand` from B1).

### 4.1 Never client-writable (Doctrine R-4)

`id`, `public_id`, `workspace_id`, `lead_id`, `business_id`, `origin_type`, `converted_at`, `created_at`, `updated_at`, `archived_at`, `completed_at`, `cancelled_at`, `last_activity_at`, `next_activity_at`, `is_overdue`, `overlap_warning`, `duplicate_candidates`, `owner_inactive`, `created_by_membership_id`, `author_membership_id`, `actor`, `version` *as a value to set* (it is only ever a precondition), any AI score/tier/confidence/sales-approach, any Business field, any Deal value, and **any recognized-revenue or attribution figure**.

An unknown field is `400 VALIDATION_ERROR` naming the field — never silently ignored.

## 5. Query parameter allow-lists

### 5.1 `GET /leads`
`q`, `owner_ref`, `status`(repeatable), `priority`(repeatable), `source_job_ref`, `tag`(repeatable), `city`, `tier`, `min_score`, `include_archived`, `sort`, `cursor`, `limit`. Full semantics in `B2_CRM_LIST_QUERY_MODEL.md` §3–§5. Any other parameter is `400 VALIDATION_ERROR`.

### 5.2 `GET /tasks`
`status`(repeatable, enum(3)), `assignee_ref`, `overdue`(boolean; evaluated as `status='pending' AND due_at < now()`), `due_before`, `due_after`, `sort` (`due_at` ascending default, `created_at`), `cursor`, `limit`. Ordering is always tie-broken by `public_id`. This serves the dashboard's workspace-wide overdue feed (`dashboardProjection.ts:88`).

### 5.3 Sub-resource lists
`cursor`, `limit`, plus `status` on `/leads/{id}/tasks` and `/leads/{id}/appointments`. Every list is ordered by a total key: tasks `(due_at ASC, public_id ASC)`, appointments `(start_at DESC, public_id DESC)`, notes and contacts `(created_at DESC, public_id DESC)`, timeline `(occurred_at DESC, entry_id DESC)`.

## 6. Status-code doctrine

Inherited from B1 §1 unchanged: `401` the caller is not established · `403` established but forbidden by role, plan, quota, membership, or verification state · `404` not visible within the active workspace · `409` state, version, or invariant conflict for an authorized caller · `429` rate limit. `404` stays deliberately overloaded so a cross-workspace `LEAD-*`, `TSK-*`, `CON-*`, `APT-*`, or `NOTE-*` is indistinguishable from a random one.

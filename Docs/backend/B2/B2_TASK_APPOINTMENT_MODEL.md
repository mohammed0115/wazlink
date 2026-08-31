# B2 — Task and Appointment Models

> **B2 status:** Target design only. Task and Appointment are separate aggregates; the reasons are stated in §4.

## 1. `tasks`

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 PK | |
| `public_id` | text | `TSK-<opaque>`, immutable, unique. **Registered in B0 registry section A.** `TASK-` is its UI alias and is never minted |
| `workspace_id` | UUID FK → `workspaces.id` | tenant column |
| `lead_id` | UUID FK → `leads.id` `ON DELETE RESTRICT` | every Task belongs to exactly one Lead |
| `created_by_membership_id` | UUID FK → `memberships.id` | actor provenance, immutable |
| `assignee_membership_id` | UUID FK → `memberships.id` | defaults to the Lead's owner |
| `type` | text NOT NULL | **free text, ≤60 chars.** The frozen `<select>` offers `متابعة / اتصال / اجتماع` and fixtures add `عرض` and `متابعة واتساب`, so no closed enum exists to freeze |
| `title` | text NOT NULL | 1–200 chars, trimmed |
| `description` | text null | ≤4000 chars |
| `status` | text NOT NULL | `pending` \| `completed` \| `cancelled` |
| `priority` | text NOT NULL | `high` \| `medium` \| `low` — the same vocabulary as Lead priority; defaults to the Lead's priority |
| `due_at` | timestamptz NOT NULL | required. The frozen form marks the field `required` and the service defaults it |
| `completed_at` | timestamptz null | set only on `pending → completed` |
| `cancelled_at` / `cancel_reason` | timestamptz null / text null | set only on `pending → cancelled` |
| `origin` | text NOT NULL | `manual` \| `automation` |
| `automation_run_public_id` | text null | `RUN-*` when `origin = 'automation'` — a historical string, not a FK |
| `version` | integer ≥ 1 | ADR-010 |
| `created_at` / `updated_at` | timestamptz | |

**Constraints and indexes**
- Unique `public_id`; check `status IN ('pending','completed','cancelled')`; check `priority IN ('high','medium','low')`.
- Check `status = 'completed' ⇒ completed_at IS NOT NULL`; `status = 'cancelled' ⇒ cancelled_at IS NOT NULL`; `status = 'pending' ⇒ completed_at IS NULL AND cancelled_at IS NULL`.
- Check `origin = 'automation' ⇒ automation_run_public_id IS NOT NULL`.
- Indexes: `(workspace_id, lead_id, status)`, **`(lead_id, due_at) WHERE status = 'pending'`** — the index that makes `next_activity_at` recomputation cheap — `(workspace_id, assignee_membership_id, status, due_at)` for "my tasks", and `(workspace_id, status, due_at)` for the workspace overdue feed.
- Immutable: `id`, `public_id`, `workspace_id`, `lead_id`, `created_by_membership_id`, `created_at`.

## 2. `overdue` is derived, never stored

**Classification: `DERIVED_PROJECTION`.**

```
is_overdue(t) ≡ t.status = 'pending' AND t.due_at < now()
```

`status`, `due_at`, and the current time fully determine it, so storing it would create a value that is wrong between the moment it becomes true and the moment a job notices. The frozen tree confirms the diagnosis: `overdue` appears **only** in seed data (`TSK-1042`), no code path ever writes it, and `completeLeadTask` sets only `completed`. The dashboard's overdue feed (`dashboardProjection.ts:88`) filters on it and is therefore a live query, not a stored flag.

`Task.is_overdue` is a computed boolean on the response DTO. `scheduleStatus` (`متأخر`/`اليوم`/`قادم`) and `when` (`"13:00"`) are **display strings** rendered by the client from `due_at`; neither is persisted and neither appears in any DTO.

## 3. Task commands

| Command | Permission | From → To | Guard | Idempotency | Event |
|---|---|---|---|---|---|
| `CreateTask` | `task.manage` | — → `pending` | Lead exists, not archived; `due_at` present; assignee Membership `active` in this workspace | RECOMMENDED | `TaskCreated` |
| `UpdateTask` | `task.manage` | `pending` → `pending` | `If-Match`; only `title`, `description`, `type`, `priority`, `due_at` are writable | NOT_REQUIRED | `TaskUpdated` |
| `AssignTask` | `task.manage` | `pending` → `pending` | `If-Match`; target Membership `active` in this workspace | NOT_REQUIRED | `TaskAssigned` |
| `CompleteTask` | `task.manage` | `pending` → `completed` | `If-Match`; sets `completed_at = now()` | NOT_REQUIRED | `TaskCompleted` |
| `CancelTask` | `task.manage` | `pending` → `cancelled` | `If-Match`; optional `cancel_reason` | NOT_REQUIRED | `TaskCancelled` |

Every one of these recomputes `leads.next_activity_at` and applies `leads.last_activity_at = GREATEST(...)` **in the same transaction**.

**Completing an already-completed Task.** The frozen `completeLeadTask` returns the task unchanged when it is already `completed`. B2 makes that a version conflict instead: a second `CompleteTask` carries a stale `If-Match` and receives `409 STALE_VERSION`. If the client somehow presents the current version against a terminal task, the answer is `409 CONFLICT` with `details.reason = "task_already_terminal"`. Silent success would hide a lost update and would make "did my completion land?" unanswerable.

**`ReopenTask` is `NOT_SUPPORTED`** (`B2-D-C009`). There is no reopen surface in the frozen tree, and completion is a factual record of something a person did. The product path for "it needs doing again" is a **new** Task, which keeps the history of what was actually completed and when. `completed` and `cancelled` are terminal.

**`origin = 'automation'`.** Automation creates Tasks by invoking `CreateTask` through the application-service boundary with the run's identity as actor — exactly what the frozen tree does (`data.js` `create_task` → `addLeadTask` with `metadata.createdByAutomationRunId`). Automation never inserts a `tasks` row directly.

## 4. Appointment is a separate aggregate

| | Task | Appointment |
|---|---|---|
| Answers | *what must someone do* | *when are two parties meeting* |
| Time model | a single `due_at` deadline | an `[start_at, end_at)` interval |
| Terminal states | 2 (`completed`, `cancelled`) | 3 (`completed`, `cancelled`, `no_show`) |
| Failure mode | overdue | **no-show** — a distinct outcome with no Task analogue |
| Conflict model | none | owner time overlap |
| Second party | none | a counterparty who was expected to attend |
| Drives `next_activity_at` | **yes** | no (`B2_LEAD_AGGREGATE.md` §5) |

Folding Appointment into Task would require nullable `end_at`, a `no_show` status that is meaningless for tasks, and an overlap rule that must not fire for tasks. They are separate because their state machines genuinely differ — and the frozen tree already models them as two stores with two distinct label sets.

## 5. `appointments`

| Column | Type | Notes |
|---|---|---|
| `id` / `public_id` | | `APT-<opaque>`, **registered in B0 registry section A** |
| `workspace_id` | UUID FK | tenant column |
| `lead_id` | UUID FK → `leads.id` `ON DELETE RESTRICT` | |
| `deal_public_id` | text null | optional Pipeline reference, validated at write time to belong to the same Lead. Stored as a historical string so Pipeline retains sole ownership |
| `organizer_membership_id` | UUID FK → `memberships.id` | the frozen `ownerId` |
| `title` | text NOT NULL | 1–200 chars |
| `type` | text NOT NULL | `call` \| `meeting` \| `demo` \| `follow_up` |
| `status` | text NOT NULL | `scheduled` \| `completed` \| `cancelled` \| `no_show` |
| `start_at` / `end_at` | timestamptz NOT NULL | UTC instants |
| `timezone` | text NOT NULL | IANA zone the appointment was **agreed in**; defaults to the workspace timezone. Stored because a meeting rescheduled across a DST boundary must keep its local meaning |
| `location_type` | text NOT NULL | `phone` \| `online` \| `office` \| `other` |
| `location` | text null | ≤500 chars: a phone number, a URL, or an address. **May contain Contact PII** |
| `cancelled_at` / `cancel_reason` | timestamptz null / text null | |
| `completed_at` | timestamptz null | set on `completed` **and** on `no_show` (both are outcomes of the meeting time passing) |
| `origin` / `automation_run_public_id` | text | as for Task |
| `version` | integer ≥ 1 | |
| `created_at` / `updated_at` | timestamptz | |

**Constraints and indexes**
- Check `end_at > start_at` — the frozen validator enforces exactly this.
- Check `status IN ('scheduled','completed','cancelled','no_show')`; `type IN (...4...)`; `location_type IN (...4...)`.
- Check `status IN ('completed','no_show') ⇒ completed_at IS NOT NULL`; `status = 'cancelled' ⇒ cancelled_at IS NOT NULL`.
- Indexes `(workspace_id, lead_id, start_at)`, `(workspace_id, organizer_membership_id, start_at) WHERE status = 'scheduled'` — the index that answers the overlap query — and `(workspace_id, status, start_at)`.
- Participants beyond the organizer are **not modelled** in Phase 1 (`B2-D-C010`). The frozen modal collects one owner and no attendee list, and a participants table with no product surface would be speculative.

## 6. Overlap is a warning, never an error

The frozen `createAppointment` computes an overlap against the same owner's `scheduled` appointments and sets a **non-blocking** `overlapWarning`; the appointment is created either way and the modal shows a warning toast.

B2 preserves this exactly:

```
overlap(a) ≡ ∃ b : b.organizer_membership_id = a.organizer_membership_id
                 AND b.status = 'scheduled' AND b.id <> a.id
                 AND b.start_at < a.end_at AND b.end_at > a.start_at
```

- Evaluated inside the write transaction against the index above.
- Returned as `Appointment.overlap_warning` (boolean) and `overlapping_appointment_refs[]` (`EntityRef[]`, capped at 5).
- **It never produces a `409`.** Double-booking a salesperson is a scheduling reality — a customer offering the only slot they have does not become unbookable because an internal meeting sits there. Making it an error would force users to cancel a real commitment before recording another, which is the opposite of a record of truth.
- No exclusion constraint is placed on the table, precisely so overlaps remain representable.

## 7. Appointment commands

| Command | Permission | From → To | Guard | Idempotency | Event |
|---|---|---|---|---|---|
| `ScheduleAppointment` | `appointment.manage` | — → `scheduled` | Lead not archived; `end_at > start_at`; organizer Membership `active`; known `type`/`location_type`; `deal_public_id` (if given) belongs to this Lead | RECOMMENDED | `AppointmentCreated` |
| `RescheduleAppointment` | `appointment.manage` | `scheduled` → `scheduled` | `If-Match`; new `end_at > start_at`; re-evaluates overlap | NOT_REQUIRED | `AppointmentRescheduled` |
| `CancelAppointment` | `appointment.manage` | `scheduled` → `cancelled` | `If-Match` | NOT_REQUIRED | `AppointmentCancelled` |
| `CompleteAppointment` | `appointment.manage` | `scheduled` → `completed` | `If-Match` | NOT_REQUIRED | `AppointmentCompleted` |
| `MarkAppointmentNoShow` | `appointment.manage` | `scheduled` → `no_show` | `If-Match` | NOT_REQUIRED | `AppointmentNoShowRecorded` |

`completed`, `cancelled`, and `no_show` are terminal. Rescheduling a terminal appointment is `409 CONFLICT`, `details.reason = "appointment_already_terminal"`; the path forward is a new appointment.

**The three terminal states are `FIXTURE_ONLY` in the frozen tree** (no code writes them) but their vocabulary is `RUNTIME_CANONICAL` — `appointmentStatusLabels` defines all four and the UI renders whichever is present. B2 supplies the missing commands rather than deleting the states, because an appointment store with no way to record an outcome would force implementers to invent one.

## 8. No calendar integration

Google Calendar, Outlook, CalDAV, iCal export, availability lookup, and invitation email are all **out of B2 scope**. The frozen modal says so in its own header comment ("موعد محلي فقط؛ لا تقويم خارجي"). External calendar synchronization is a later provider **adapter behind the B0 ports/adapters boundary**; when it arrives it will need `external_calendar_ref` and a sync-conflict policy, recorded as `B2-D-C011`. B2 introduces no provider, no client, and no credential.

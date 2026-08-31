# B2 — CRM Privacy and Audit Model

> **B2 status:** Target policy only. Inherits `BACKEND_PRIVACY_AND_DATA_HANDLING.md` and the immutable `audit_logs` doctrine. CRM is the domain where most Contact PII lives.

## 1. CRM data classification

| Datum | B0 class | Storage | Logging | In events | In audit | Returned |
|---|---|---|---|---|---|---|
| Contact `name` | **Contact PII** | `contacts.name`, plaintext | **never** | **never** — `CON-*` only | **never** — field names only | to `lead.view` holders |
| Contact `phone` / `phone_normalized` | **Contact PII** | plaintext | **never** | **never** | **never** | to `lead.view` holders |
| Contact `email` | **Contact PII** | citext, plaintext | **never** | **never** | **never** | to `lead.view` holders |
| Contact `title` | Contact PII (low) | plaintext | never | never | field name only | yes |
| Note `body` | **Contact PII (unbounded)** — arbitrary human free text | `notes.body`, plaintext | **never** | **never** — `NOTE-*` only | **never** — not even a length | to `lead.view` holders via `GET /leads/{id}/notes` |
| Task `title` / `description` | Contact PII (possible) | plaintext | **never** | **never** | field names only | to `task.view` holders |
| Appointment `title` / `location` | Contact PII (possible — a location may be a home address or a phone number) | plaintext | **never** | **never** | field names only | to `appointment.view` holders |
| Lead `status`, `priority`, `tags` | Operational | plaintext | yes | yes (values) | yes (before/after) | yes |
| `crm_activities.summary` | Operational | template output, PII-free by construction | yes | yes | yes | yes |
| `crm_activities.change` | Operational | `{field, from, to}` over enums and refs only | yes | yes | yes | yes |
| Provenance identities and snapshot score/tier | Operational | plaintext | yes | no | yes | to `lead.view` holders |
| `business_name_snapshot` | Public business | plaintext | yes | no | yes | yes |
| AI score, tier, sales approach | **AI content** (B0) | **not stored by CRM** | — | — | — | via the opaque `Lead360.intelligence` |
| Message content | **Private communications** | **not stored by CRM** | — | — | — | via Messaging, under `conversation.view` |

**Rule CP-1 — free text never leaves its table.** Note bodies, task titles and descriptions, and appointment titles and locations are stored in exactly one column each. They appear in **no** event payload, **no** outbox row, **no** Celery argument, **no** log line, **no** audit `details` blob, **no** `crm_activities` row, and **no** timeline `summary`. The frozen `logLeadActivity` writes the note body and the task title straight into `activity.detail`; B2 does not carry that across, because it would copy arbitrary user-entered PII into a table read by every timeline consumer, replicated onto the event bus, and retained under a different policy than the note itself.

**Rule CP-2 — events carry refs and field names.** `ContactUpdated` and `TaskUpdated` carry `changed_field_names[]`, never values. A consumer that needs a value re-reads it live under that workspace's authorization.

**Rule CP-3 — the timeline is not a PII channel.** A `TimelineEntry` carries an identity, a template summary, and a structured `change` over enums. Rendering a rich label requires resolving `target_ref` against the owning surface, where that surface's authorization and masking apply. This is what stops a role that may read the timeline but not the conversation from reading message content through the timeline.

**Rule CP-4 — no CRM export in Phase 1.** `crm.export` and `export.csv` exist in B1 and the frozen entitlement vocabulary, but no B2 operation implements export. A bulk PII egress path needs a masking policy, an audit format, and a rate limit, none of which product truth supplies (`B2-D-C017`).

**Rule CP-5 — deletion is anonymization where history requires it.** Inherited verbatim from B0 ("anonymize rather than erase relational history when necessary"). `RemoveNote` archives; `RemoveContact` unlinks and retains the Contact row because Messaging conversations reference `contact_id`; Leads are never deleted. A workspace deletion purge (B1 §1.5) anonymizes CRM Contact PII and note bodies while preserving audit rows.

**Rule CP-6 — retention is unresolved and must stay so.** Retention durations for Leads, Contacts, Tasks, Appointments, Notes, and `crm_activities` are a **PRODUCT / LEGAL DECISION REQUIRED**, inherited unresolved from B0 and B1 (`B1-D-015`). B2 invents none, and specifically invents **no** Saudi retention period. Structural requirement met: every CRM table carries the timestamp column a policy would need (`created_at`, `archived_at`, `converted_at`, `occurred_at`). Recorded as `B2-D-C018`.

**Rule CP-7 — export and deletion hooks exist as seams, not implementations.** A future subject-access or erasure request must reach: `contacts` (name/phone/email), `notes.body`, `tasks.title`/`description`, `appointments.title`/`location`, and `lead_provenance.business_name_snapshot`. These five are the complete CRM PII inventory and are listed here so a future erasure implementation cannot miss one.

## 2. Audit records

CRM reuses B0's immutable `audit_logs` shape and B1's field set verbatim: `public_id` (`AUD-*`), `workspace_id`, `actor_type`, `actor_user_ref`, `action`, `target_type`/`target_ref`, `before`/`after`, `result`, `error_code`, `request_id`/`correlation_id`, `source_ip_hash`/`user_agent_digest`, `occurred_at`, `permission_matrix_version`.

**Audit ≠ domain state.** `crm_activities` is a product feature a user reads; `audit_logs` is a compliance record `audit.view` holders read. They are written from the same transaction and are never substituted for one another. Reconstructing a Lead's status history from `audit_logs` would make the audit trail a product read model, which B0 forbids.

**`before`/`after` carry structured change metadata, never full payloads.** For a status change: `{"status":"new"}` → `{"status":"contacted"}`. For a contact update: `{"changed_fields":["phone","title"]}` — **not** the old and new phone numbers. For a note: the `NOTE-*` and the author, **never** the body. Storing the full row would put every PII value into an append-only table with the longest retention in the system.

## 3. CRM audit actions (22)

| Action | Actor | Result values |
|---|---|---|
| `lead.converted` | membership | succeeded, denied |
| `lead.convert_deduplicated` | membership | succeeded |
| `lead.status_changed` | membership \| system:automation | succeeded, denied |
| `lead.priority_changed` | membership \| system:automation | succeeded, denied |
| `lead.owner_changed` | membership \| system:automation | succeeded, denied |
| `lead.tag_added`, `lead.tag_removed` | membership | succeeded, denied |
| `lead.archived` | membership \| system | succeeded, denied |
| `lead.business_merged` | system | succeeded |
| `contact.added`, `contact.updated`, `contact.removed` | membership | succeeded, denied |
| `task.created`, `task.updated`, `task.assigned`, `task.completed`, `task.cancelled` | membership \| system:automation | succeeded, denied |
| `appointment.created`, `appointment.rescheduled`, `appointment.cancelled`, `appointment.completed`, `appointment.no_show` | membership \| system:automation | succeeded, denied |
| `note.added`, `note.removed` | membership | succeeded, denied |

Every CRM action family has `workspace_id NOT NULL` by check constraint — there is no pre-tenant CRM action, unlike B1's `auth.*` family.

**Namespace rule (inherited from B1).** Permission codes are `<resource>.<imperative verb>` (`lead.update`, `task.manage`); audit actions are `<resource>.<past participle>` (`lead.status_changed`, `task.completed`). No string is valid in both namespaces. Measured collisions between the 9 CRM permissions and the 22 CRM audit actions: **0**.

## 4. Denials are audited

Every `403` and every `404`-by-scoping writes a `result='denied'` row with the specific `error_code`, using B1's canonical action `authz.permission_denied` for pipeline denials (steps 4–12) and the narrower CRM action above where the guard is a domain invariant (step 15). This is what makes cross-workspace probing detectable rather than merely blocked, and it is the mechanism the acceptance tests for CRM-INV-2 assert against.

## 5. Notifications

| Trigger | Recipient | Contains |
|---|---|---|
| `LeadOwnerChanged` | the new owner | Lead ref, Business name, previous owner |
| `TaskCreated` / `TaskAssigned` | the assignee | Task ref, due date, priority — **not the title** in the transport summary |
| `AppointmentCreated` / `AppointmentRescheduled` / `AppointmentCancelled` | the organizer | Appointment ref, times |

Notification delivery is a provider concern behind the B0 ports/adapters boundary, triggered by outbox consumers **after commit**. B2 introduces no provider, no template, and no transport, and no notification is sent inside a CRM transaction.

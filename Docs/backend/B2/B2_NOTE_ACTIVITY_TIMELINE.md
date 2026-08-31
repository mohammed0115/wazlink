# B2 — Note, CRM Activity, and the Lead Timeline

> **B2 status:** Target design only. §3 resolves the single most dangerous modelling question in the CRM domain: whether the timeline is allowed to become a second write store. It is not.

## 1. `notes`

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 PK | |
| `public_id` | text | `NOTE-<opaque>`, immutable, unique. **PROPOSED / RESERVED — not a registered B0 prefix** (`B2-D-B001`) |
| `workspace_id` | UUID FK → `workspaces.id` | tenant column |
| `lead_id` | UUID FK → `leads.id` `ON DELETE RESTRICT` | |
| `author_membership_id` | UUID FK → `memberships.id` | immutable |
| `body` | text NOT NULL | 1–8000 chars, trimmed, non-empty after trim. **May contain arbitrary Contact PII typed by a human** |
| `archived_at` | timestamptz null | soft removal |
| `archived_by_membership_id` | UUID null FK → `memberships.id` | |
| `version` | integer ≥ 1 | |
| `created_at` / `updated_at` | timestamptz | |

Unique `public_id`; check `btrim(body) <> ''` (the frozen `addLeadNote` rejects blank bodies); index `(workspace_id, lead_id, created_at DESC)` — the frozen list is newest-first. Immutable: `id`, `public_id`, `workspace_id`, `lead_id`, `author_membership_id`, `created_at`.

### 1.1 `NOTE-` is proposed, not registered

`BACKEND_PUBLIC_ID_REGISTRY.md` places `NOTE-` in **section B** and states plainly: *"Phase-1 B0 models no standalone Note table or aggregate; frontend fixture identity does not freeze a Backend Note public ID. A future Note resource requires an ADR, data-model change, and a newly approved prefix."* B0's CRM table group likewise has no `notes` table.

**B2 does not register, add, or mint `NOTE-`.** It proposes the prefix through the extension mechanism the registry itself defines, as a gated pre-implementation contract step (`B2-D-B001`, Class B). Until the amendment bundle is applied, **no implementation may mint `NOTE-*`**. Because the registry scopes registration to "before implementation" rather than before design, this does not block B2 design closure (`PUBLIC_ID_REGISTRY_BLOCKS_B2 = NO`). This is the same posture and the same mechanism B1 used for `MEM-` and `WINV-`.

### 1.2 Why Note is an aggregate and not an activity row

The tempting alternative is to store notes as `crm_activities` entries with `type = 'note_added'`, reusing the already-registered `ACT-` prefix and needing no amendment. It is rejected:

- **It would make the timeline writable.** A note must be removable (it is free text a human typed, and it can contain PII entered by mistake). Removing an activity row makes `crm_activities` mutable, which destroys CRM-INV-13 and, with it, every guarantee that the timeline is a faithful record.
- **It would give one row two lifecycles.** An activity says *this happened*; a note says *this text is currently attached to this Lead*. `note_added` remains true forever even after the note is removed — and a store cannot represent both without a second status column that only applies to one `type`.
- **It would inflate the timeline contract.** Every timeline consumer would need to filter out removed notes, which is exactly the kind of read-side special case that read models are supposed to eliminate.

Notes are therefore an aggregate, and `crm_activities` records `note_added`/`note_removed` **about** them — the same relationship every other CRM aggregate has with the timeline.

### 1.3 Chosen semantics: append-only, soft-removable

| Choice | Decision | Reason |
|---|---|---|
| Immutable body | **yes in Phase 1** | there is no edit surface in the frozen tree (inventory item 48) |
| `UpdateNote` | **`NOT_SUPPORTED`** (`B2-D-C012`) | editable notes need a revision policy, a "who saw the old text" answer, and an audit format for free text. None is required by any product behavior today |
| Revisioned | **no** | overengineering for a feature that does not exist |
| Soft delete | **yes** — `RemoveNote` sets `archived_at` | B0 privacy doctrine requires a path to remove mistakenly entered PII while preserving relational history ("anonymize rather than erase") |
| Hard delete | **never** | `crm_activities` references the `NOTE-*`; a hard delete would leave a dangling timeline entry |

`RemoveNote` is authorized by `lead.update` **and** an object-level condition (B1 pipeline step 10): the actor must be the note's author **or** hold a role of rank ≥ `manager` (40). A Sales user cannot erase a colleague's note; a Manager can remove content that should not be there.

## 2. `crm_activities`

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 PK | |
| `public_id` | text | `ACT-<opaque>`, immutable, unique. **Registered in B0 registry section A** |
| `workspace_id` | UUID FK | tenant column |
| `lead_id` | UUID FK → `leads.id` `ON DELETE RESTRICT` | every entry belongs to one Lead |
| `type` | text NOT NULL | closed vocabulary, §2.1 |
| `actor_type` | text NOT NULL | `membership` \| `system:automation` \| `system:scheduler` |
| `actor_membership_id` | UUID null FK → `memberships.id` | NULL for system actors |
| `actor_label` | text null | e.g. `automation_run:RUN-1004` for a system actor |
| `target_type` / `target_public_id` | text null | e.g. `task` / `TSK-1043` |
| `summary` | text NOT NULL | a **safe**, PII-free summary (§5) |
| `change` | JSONB null | `{"field":"status","from":"new","to":"contacted"}` — structured before/after, never free text |
| `occurred_at` | timestamptz NOT NULL | the business instant |
| `recorded_at` | timestamptz NOT NULL | the commit instant |
| `correlation_id` / `request_id` | text | the B0 envelope's **correlation/request ID**, carried through from the command that wrote the row. These are the only two correlation identifiers B0 defines; B2 adds none. No `causation_id` is required, because the frozen B0 envelope defines no causation field for it to be populated from (`B2_CONTROLLED_AMENDMENTS.md` §7). Should a later frozen contract define causation, adding it here is additive and no B2 behavior depends on it. |

**Append-only.** No `UPDATE` and no `DELETE` is authorized on this table, by any command, ever. Enforced the same way B0 enforces immutable `audit_logs`. Indexes `(workspace_id, lead_id, occurred_at DESC, public_id DESC)` — the exact ordering key the timeline uses — and `(workspace_id, occurred_at DESC)`.

### 2.1 Closed CRM activity vocabulary (21)

The canonical closed vocabulary is defined in **`B2_CRM_ACTIVITY_VOCABULARY.md`** and contains exactly 21 types:

`lead_converted`, `lead_status_changed`, `lead_priority_changed`, `lead_owner_changed`, `lead_tag_added`, `lead_tag_removed`, `lead_archived`, `contact_added`, `contact_updated`, `contact_removed`, `task_created`, `task_completed`, `task_cancelled`, `appointment_created`, `appointment_rescheduled`, `appointment_cancelled`, `appointment_completed`, `appointment_no_show`, `note_added`, `note_removed`, `lead_business_merged`.

See `B2_CRM_ACTIVITY_VOCABULARY.md` for the authoritative source, including:
- The source command and event for each type.
- Whether it updates `last_activity_at`.
- The summary template and PII handling.
- All transitions that do NOT create activities (e.g., `UpdateTask`, `AssignTask`, `UpdateNote`).

The canonical list, its per-type detail, and the closed **NO TIMELINE ACTIVITY ROW** list are in `B2_CRM_ACTIVITY_VOCABULARY.md`; this section restates it and must never diverge from it.

**`message_sent` and `message_retry` are deliberately absent**, even though the frozen `sendMockMessage` and `retryMockMessage` write exactly those types into the activity store. That is inventory item 53 — real product behavior implemented through a cross-domain write. §3 keeps the behavior and moves the mechanism.

**`intelligence_reviewed` is also absent.** It exists in the frozen fixtures (`ACT-1042-2`) but no code path creates it, and "a human looked at a score" is not a CRM state change. If the product later wants to record review, it needs an explicit CRM command, not a fixture type.

## 3. Timeline authority — HYBRID, and what that means precisely

**The Lead timeline is a read-time merge of two kinds of source, and it owns nothing.**

| Kind | Source | Persisted by CRM? | Written by | Mutable? |
|---|---|---|---|---|
| **CRM-owned entries** | `crm_activities` | **yes** — the `ACT-*` row is CRM's own durable record | CRM commands only, in the mutating transaction | never (append-only) |
| **Cross-domain entries** | the **Messaging** timeline/event read model and the **Pipeline** timeline/event read model | **no** — constructed at read time, never stored | their own owning domain | by their owner only |

**`tasks`, `appointments`, and `notes` are not timeline sources.** They are CRM-owned aggregates, and every timeline-visible thing that happens to them is already recorded by the CRM command that did it, as an `ACT-*` row in `crm_activities` (`task_created`, `appointment_rescheduled`, `note_added`, …). Projecting them a second time from their own rows would give one logical action two entries with two identities, which no deduplication key could collapse. One logical CRM action yields **one** `ACT-*` entry and **never** an additional `TSK-*`/`APT-*`/`NOTE-*` projection.

**There are therefore exactly three source classes** — `crm`, `messaging`, `pipeline` — matching the three `source_domain` values, one persisted and two read-time.

**The rule that makes this safe: a domain writes only its own tables, and the timeline reads across them.** Messaging writes `messages`; the timeline reads `messages` and renders them as entries. Messaging never writes `crm_activities`. This preserves the frozen user-visible behavior — the frozen `journeyProjection.getLeadActivity` already merges five sources at read time (inventory item 54) — while removing the one place the frozen tree cheats.

Why not a pure projection (CRM writes nothing, everything is derived)? Because three CRM facts have no other home: a status change, a priority change, and an owner change produce no row anywhere except the Lead itself, and the Lead stores only the *current* value. Without `crm_activities` there would be no record that a Lead went `new → contacted → qualified`, only that it is now `qualified`. Reconstructing it from `audit_logs` would make the audit trail a product read model, which B0 forbids ("Audit ≠ domain state").

Why not a full write-store (everything is copied into `crm_activities`)? Because that is the second mutable truth store CRM-INV-13 exists to prevent, and it would make a message's content exist in two tables with two retention policies.

### 3.1 Timeline entry contract

**Full specification is in `B2_TIMELINE_IDENTITY_MODEL.md`.** Key points:

| Field | Notes |
|---|---|
| `entry_id` | **CRM-owned entries:** the `crm_activities.public_id` verbatim (`ACT-*`). **Cross-domain entries:** `<source_domain>:<source_event_id>` — e.g. `pipeline:01J8G4M…`. There is no third shape and no fallback, and the timeline **never mints a separate `TLE-*` namespace**. A source aggregate's public ID is **never** an `entry_id`: a Deal generating `DealCreated`, `DealStageChanged`, and `DealWon` produces three distinct entry IDs, not three copies of `DEAL-4042`. |
| `source_domain` | `crm` \| `messaging` \| `pipeline` — the source class, one value per source in §3 |
| `source_event_id` | the source domain's stable immutable logical-event identity. **Required** for every cross-domain entry, **null** for CRM-owned entries where `entry_id` is already the identity. See `B2_TIMELINE_IDENTITY_MODEL.md` §2.2.1 |
| `source_resource_ref` | the aggregate or resource the entry is about — `TSK-1043`, `DEAL-4042`, `MSG-5000`. **Repeats** across the several entries of one resource, and is never used as an `entry_id` |
| `source_event_type` | the source's own event type (`lead_status_changed`, `task_created`, `message_inbound`, `deal_stage_changed`, …). This is the single canonical name for the field earlier drafts called `kind` or `source_type` |
| `occurred_at` | **the immutable business event instant** — not a mutable field like `task.due_at` or `appointment.start_at`. For Appointments rescheduled from 2pm→3pm, `occurred_at` is the reschedule-decision time, not 3pm, and the original entry does not move. See `B2_TIMELINE_IDENTITY_MODEL.md` §2.4–§2.5. |
| `recorded_at` | the ingestion instant, returned so a client can detect late-arriving history |
| `actor` | `EntityRef` (`MEM-*`) or a system label; never a raw user identity |
| `summary` | safe, PII-free (§5) |
| `change` | structured before/after where the source has one |
| `target_ref` | `EntityRef` to the record the entry is about |
| `route_hint` | e.g. `crm/leads/{id}`, `inbox/{conversation}`, `deals/{deal}` — the frozen projection returns exactly this |

**Ordering:** `(occurred_at DESC, entry_id DESC)` — a **total order with no ties**. See `B2_TIMELINE_IDENTITY_MODEL.md` §3 for deterministic tie-breaking and cursor encoding.

**Cursor:** an **opaque encoding of `(occurred_at, entry_id)`** for stable pagination across insertions and late-arriving history. Offset pagination is forbidden here for the same reason it is forbidden on `GET /leads`.

**Retrieval:** the ten-step algorithm in `B2_TIMELINE_IDENTITY_MODEL.md` §7.2 is the **only** place scope, authorization, source eligibility, skew eligibility, entry construction, deduplication, ordering, cursor, and page size are applied. No admission step exists outside it.

**Deduplication:** Same logical event → same `entry_id`, so no duplicate entry can arise. **One logical event yields one entry, from one side only:** a CRM-owned command appears once as its `ACT-*` activity and is never additionally projected from the underlying Task, Appointment, or Note row; a cross-domain event appears once, constructed from its source record, and is never copied into `crm_activities`. For cross-domain entries the dedup identity `(source_domain, source_event_id)` is applied **during the read-time merge**, not by a CRM consumer — **CRM maintains no cross-domain deduplication store**. Replay and redelivery at the source create no second logical event, because `source_event_id` is stable across them. See `B2_TIMELINE_IDENTITY_MODEL.md` §4.

**Timestamp eligibility:** a cross-domain record whose `occurred_at` runs further ahead of CRM's clock than the configured tolerance is **not eligible** to become a `TimelineEntry`. Because the timeline is a read-time merge, this is a **read-path filter re-evaluated on every request** — not a persisted quarantine — so the record is simply absent while it is invalid and appears exactly once, with the same `entry_id`, on the first read where it is valid. The same tolerance is applied at the `last_activity_at` consumer. There the *applied* `GREATEST()` write is irreversible, so admission is what protects the column — but the **rejection** is not terminal: it is a retryable processing failure that is never acknowledged as successfully processed, and it recovers by bounded automatic retry or by alerted dead-letter replay. See `B2_TIMELINE_IDENTITY_MODEL.md` §5, and §5.5 for the recovery contract.

**PII rule:** a timeline entry never carries message body text, note body text, contact phone, or contact email. It carries the identity and a safe summary; the client fetches the body from the owning surface, where that surface's own authorization applies. This is what stops the timeline becoming a PII-exfiltration endpoint for a role that may read the timeline but not the underlying conversation.

### 3.2 Authorization of merged entries

A merged entry is included **only if the caller could read its source**. `source_domain="messaging"` entries require `conversation.view`; `source_domain="pipeline"` entries require `deal.view`. A caller with `lead.view` but not `conversation.view` sees a timeline with no message entries — not an error, and not a redacted placeholder, because a placeholder would itself disclose that a conversation exists.

## 4. `last_activity_at` and `next_activity_at`

Both are specified in `B2_LEAD_AGGREGATE.md` §4–§5 and are restated here only to fix the invariants a timeline reader depends on:

- `last_activity_at` is **monotonic** (`GREATEST`) and driven by the closed qualifying-event set. Removing a Note or cancelling a Task never moves it backwards.
- `next_activity_at` is **tasks-only**, recomputed inside every Task mutation transaction, and therefore identical in `GET /leads` and `GET /leads/{id}/360`.
- Neither is computed from the timeline projection. The timeline is a reader, never a writer — including of these two columns.

## 5. Safe summaries

`crm_activities.summary` and every timeline `summary` are generated from a **fixed template plus non-PII arguments**, never from user text.

| Type | Template | Arguments |
|---|---|---|
| `lead_status_changed` | `status:{from}→{to}` | enum values only |
| `lead_owner_changed` | `owner:{from_mem}→{to_mem}` | `MEM-*` public IDs |
| `contact_added` | `contact_added:{contact_ref}` | `CON-*` only — **never the name, phone, or email** |
| `task_created` | `task_created:{task_ref}` | `TSK-*` only — **never the title** |
| `note_added` | `note_added:{note_ref}` | `NOTE-*` only — **never the body** |
| Messaging (merged) | `message:{direction}` | direction only — **never the body** |

The frozen `logLeadActivity` writes the note body straight into `activity.detail` and the task title into it too. B2 does not carry that across: it would put user free text — and therefore arbitrary PII — into a table that is read by every timeline consumer, replicated into events, and retained under the activity retention policy rather than the note's. Clients render a rich label by resolving `target_ref` against the owning surface, where authorization and masking already apply.

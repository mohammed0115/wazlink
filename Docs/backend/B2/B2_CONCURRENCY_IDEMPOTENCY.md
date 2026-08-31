# B2 — CRM Concurrency and Idempotency

> **B2 status:** Target design only. Inherits ADR-010 and `BACKEND_IDEMPOTENCY_STANDARD.md` verbatim. **No second idempotency system is introduced, and no Redis key participates in any CRM decision (CRM-INV-11).**

## 1. Primitives

| Primitive | Where used | Inherited from |
|---|---|---|
| Integer `version` + `If-Match` | `leads`, `contacts`, `tasks`, `appointments`, `notes` | ADR-010 |
| `SELECT … FOR UPDATE` | every CRM mutation, on the aggregate row | B0 |
| Partial unique index | one live Lead per Business; one primary contact per Lead; one live link per (lead, contact) | B0 data-model doctrine |
| `IdempotencyRecord` unique constraint | conversion and the two creation commands that take a key | `BACKEND_IDEMPOTENCY_STANDARD.md` |
| Deterministic lock ordering | none required — no CRM command locks two aggregates of the same type | B2 (stated so it stays true) |
| Monotonic `GREATEST()` update | `last_activity_at` | B2 (CRM-INV-17) |

**No CRM command takes a lock on a row another domain owns.** Conversion locks the `businesses` row it is converting — the one exception, and it is a read-lock on the row being acted upon, not on Discovery's write path.

## 2. Race matrix — authoritative outcomes

| # | Race | Mechanism | Authoritative outcome |
|---|---|---|---|
| **C1** | `ConvertBusinessToLead` × `ConvertBusinessToLead`, same Business, **different** keys | `FOR UPDATE` on the Business row + partial unique `(workspace_id, business_id) WHERE archived_at IS NULL` | Serialized. First commits and returns `201` + `X-Lead-Conversion-Outcome: created`. Second finds the live Lead at step 5 (or catches the unique violation at step 9), re-reads, and returns `201` + `existing`. **Exactly one Lead, one `LeadCreated`, one quota unit.** Both callers see success. |
| **C2** | Same, **same** key and body | `IdempotencyRecord` unique constraint written in the conversion transaction | One executes; the other replays the stored `201` verbatim. Never two Leads, never two quota units. In-progress reuse returns `409` or a safe in-progress representation per B0. |
| **C3** | Same key, **different** body | key/body-hash mismatch | `409 IDEMPOTENCY_CONFLICT`. No mutation. |
| **C4** | `ChangeLeadStatus` A × `ChangeLeadStatus` B on one Lead | `FOR UPDATE` on `leads` + `If-Match` | Serialized. First commits and bumps `version`. Second's `If-Match` no longer matches ⇒ `409 STALE_VERSION`, **no write, no merge, no server retry**. The final status is exactly one of the two submitted values, never a blend. |
| **C5** | `AssignLeadOwner` × `AssignLeadOwner` | same | One commits; the other `409 STALE_VERSION`. The Lead ends owned by exactly one of the two targets. Both attempts are audited. |
| **C6** | `ChangeLeadPriority` × `ChangeLeadPriority` | same | As C4. |
| **C7** | `ChangeLeadStatus` × `AssignLeadOwner` (different fields, one Lead) | same row lock and one `version` | Serialized; the loser gets `409 STALE_VERSION` even though the fields are disjoint. Field-level versioning is deliberately **not** introduced: it would make `If-Match` mean something different per field and make "did my read see a consistent Lead?" unanswerable. |
| **C8** | `CompleteTask` × `CompleteTask` | `FOR UPDATE` on `tasks` + `If-Match` | One commits (`completed`, `completed_at` set, `version+1`). The other holds the stale version ⇒ `409 STALE_VERSION`. **Exactly one `TaskCompleted` event**, so a completion-count metric can never double. |
| **C9** | `UpdateTask` × `CompleteTask` | same | Serialized. Update-first: complete proceeds on the bumped version only if the client re-read, else `409 STALE_VERSION`. Complete-first: the update sees a terminal task ⇒ `409 CONFLICT` (`task_already_terminal`). |
| **C10** | `RescheduleAppointment` × `RescheduleAppointment` | `FOR UPDATE` on `appointments` + `If-Match` | One commits; the other `409 STALE_VERSION`. Overlap is re-evaluated by the winner only, so `overlap_warning` reflects the committed times. |
| **C11** | `RemoveNote` × `RemoveNote` | `FOR UPDATE` + `If-Match` | One archives; the other `409 STALE_VERSION`. (`UpdateNote` does not exist, so no note edit race is possible — a deliberate consequence of `B2-D-C012`.) |
| **C12** | `ArchiveLead` × `CreateDeal` (Pipeline) | disjoint tables; no shared lock | **Both succeed.** The Deal is created against a Lead that is archived a moment later. CRM does not gate on Pipeline state and Pipeline does not gate on CRM archive; a cross-domain gate would put one domain's availability in the other's write path. The Deal remains valid and readable; `Lead360` shows an archived Lead with an open Deal, which is an accurate description of what happened. |
| **C13** | `ArchiveLead` × `SendMessage` (Messaging) | disjoint tables | **Both succeed**, same reasoning as C12. The message is delivered; the timeline shows it after the archive entry. |
| **C14** | `ChangeLeadStatus` × owner Membership removal (B1 `RemoveMember`) | disjoint tables | Both succeed. The Lead keeps the now-removed owner reference (`ON DELETE RESTRICT`, and B1 never deletes membership rows). `LeadListItem.owner_inactive` becomes `true` on the next read so a manager can find and reassign. **CRM never auto-reassigns** — picking a new owner is a human decision. |
| **C15** | Cross-domain activity event × `ArchiveLead` | `GREATEST()` update × row update | Both commit in either order. `last_activity_at` may move forward after the archive; that is correct — the activity happened. `ArchiveLead` itself does not advance `last_activity_at`. |
| **C16** | Two `AddContact` calls creating the same primary contact | partial unique `(lead_id) WHERE is_primary AND unlinked_at IS NULL` | One commits; the other violates the index, is caught, and retries as non-primary — or returns `409 CONFLICT` (`primary_contact_exists`) when the caller explicitly demanded primary. Never two primaries. |
| **C17** | `CreateTask` × `CompleteTask` on the same Lead (different tasks) | both recompute `next_activity_at` under the `leads` row lock | Serialized on the Lead row. `next_activity_at` ends equal to the true minimum over the committed task set — never a stale value from whichever transaction read first. |
| **C18** | `BusinessMerged` × `ConvertBusinessToLead` on the merged-away Business | conversion step 2 re-checks `merged_into_id` **under the Business row lock** | Merge-first: the conversion sees the merge and returns `409 CONFLICT` (`business_not_convertible`). Convert-first: the merge re-points the new Lead's `business_id`, applying the older-Lead-survives rule if that creates a collision. No orphan Lead in either order. |
| **C19** | `ArchiveLead` × `ConvertBusinessToLead` for the same Business | Business row lock + the partial index | Archive-first: the Business leaves the index and a **new** Lead is created (new quota unit). Convert-first: the archive applies to the pre-existing Lead and the new one is unaffected. Never two live Leads. |
| **C20** | Concurrent `AddLeadTag` with the same tag | unique `(lead_id, tag)` | One commits; the other is caught and treated as a no-op success with the current `version` returned, because "the tag is present" is the caller's entire intent. This is the one place a unique violation resolves to success rather than a conflict, and it is safe because the operation is genuinely idempotent. |

Every outcome above is decided by PostgreSQL. **No Redis lock, counter, or cache participates in any row of this table** (CRM-INV-11).

## 3. Idempotency classification

`Idempotency-Key` is always the **HTTP header** defined by `BACKEND_IDEMPOTENCY_STANDARD.md` and declared in the frozen contract as `components.parameters.IdempotencyKey` (`in: header`). **No B2 request DTO carries an `idempotency_key` property**, so `additionalProperties: false` never rejects a canonical header-only client. This is B1's `B1-D-A16` doctrine applied unchanged.

| Command | Class | Why |
|---|---|---|
| `ConvertBusinessToLead` | **REQUIRED** | already declared on the frozen operation. A retry after a lost response must not create a second Lead or consume a second `leads` quota unit. This is the single highest-risk retry in the domain |
| `CreateTask` | **RECOMMENDED** | a duplicate task is annoying but harmless and user-deletable; requiring a key would break the frozen form, which sends none |
| `ScheduleAppointment` | **RECOMMENDED** | same reasoning; a duplicate appointment is visible and cancellable |
| `AddContact` | **RECOMMENDED** | a duplicate contact is surfaced by the advisory duplicate scan and is removable |
| `AddNote` | **RECOMMENDED** | a duplicate note is visible and removable |
| `AddLeadTag` | **NOT_REQUIRED** | naturally idempotent by the unique index (C20) |
| `ChangeLeadStatus`, `ChangeLeadPriority`, `AssignLeadOwner`, `ArchiveLead`, `RemoveLeadTag`, `UpdateContact`, `RemoveContact`, `UpdateTask`, `AssignTask`, `CompleteTask`, `CancelTask`, `RescheduleAppointment`, `CancelAppointment`, `CompleteAppointment`, `MarkAppointmentNoShow`, `RemoveNote` | **NOT_REQUIRED** | each carries `If-Match`. A retry with the consumed version returns `409 STALE_VERSION` rather than re-applying — which is exactly the at-most-once semantics a key would provide |
| bulk mutations | — | `NOT_SUPPORTED` in Phase 1 (`B2-D-C016`) |

**Scoping** is B0's, unchanged: workspace + authenticated principal + endpoint/command + request-body hash. The `IdempotencyRecord` is written in the same transaction as the durable state. Retention is **24 hours** — the B0 "normal command" tier; the 7-day tier stays reserved for payment and webhook operations and is not extended to CRM.

## 4. Version exposure

Every editable CRM resource exposes `version` (B0: "All editable resources expose `version`") and accepts it back as `If-Match` or as a body `version` field. `Lead`, `LeadDetail`, `LeadListItem`, `Contact`, `Task`, `Appointment`, and `Note` all carry it. Read models (`Lead360`, timeline entries) carry the version of each embedded aggregate, never a version of their own — a projection has no version because there is nothing to write back.

## 5. What is explicitly not used

- **No Redis lock, counter, or cache** for any CRM decision, including the `leads` quota, which is a locked `usage_counters` row per B0.
- **No advisory locks** where a row lock suffices.
- **No optimistic retry loop** inside a service that would silently re-apply a command the client did not re-authorize. A stale write surfaces as `409 STALE_VERSION` and returns to the client.
- **No last-write-wins on domain fields.** Every conflicting write is refused, not merged.
- **No field-level versioning** (C7).
- **No cross-domain distributed transaction.** CRM commits its own transaction and publishes events; other domains react idempotently.

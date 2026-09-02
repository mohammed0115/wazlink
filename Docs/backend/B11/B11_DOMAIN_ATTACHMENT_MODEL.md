# B11 — Domain Attachment Model

> Design only. Answers §17: how a `FileAsset` connects to domain objects without becoming a second authority for any of them.

## 1. The three candidate models

| | Generic typed attachment (B11-owned link table) | Domain-owned explicit link tables | Nullable FKs on `file_assets` |
|---|---|---|---|
| Shape | one `file_attachments` table with `(subject_type, subject_id)` | one table per owning domain (`message_media`, `lead_attachments`, …) | `file_assets.message_id`, `.lead_id`, `.deal_id`, … |
| Referential integrity to the subject | application-enforced + swept | database FK | database FK |
| B11 can count references without querying other domains | **yes** | no — B11 would have to read foreign tables | yes |
| Adding a domain later | register an enum value | new table, new migration, new B11 code | **new nullable column on a frozen table, forever** |
| Risk of B11 becoming a second authority | low — the row records linkage only | low | **high** — a growing set of domain FKs invites domain logic |
| Rejected by the brief | — | — | **explicitly** ("do NOT create dozens of nullable FKs") |

## 2. The choice

> **`B11-D-A014`. Hybrid, split on a single clear criterion:**
>
> - **A domain-owned explicit reference** is used where the file is a *constitutive part* of the subject, the subject is immutable once created, and a frozen contract already established the field. Today that is exactly one case: B5's `MessageMedia.file_asset_ref` (`B5_MEDIA_B11_HANDOFF.md` §2, frozen).
> - **A B11-owned `file_attachments` row** is used in *every* case, including the one above, as B11's own reference count.

The two coexist deliberately, and neither is the other's authority:

| | `MessageMedia.file_asset_ref` (B5) | `file_attachments` (B11) |
|---|---|---|
| Owner | B5 | B11 |
| Answers | "what media does this Message carry?" | "is this file still referenced by anything?" |
| Read by | B5's own read models, Lead 360 timeline | B11's deletion guard and orphan sweeper |
| Consequence of it being wrong | a message renders without its media | a file could be purged while still cited, or kept forever |

**Why both, rather than B11 reading B5's column.** Frozen `BACKEND_DOMAIN_OWNERSHIP.md` forbids cross-context ORM access ("ORM imports across bounded contexts are not permitted in domain code"), so B11 *cannot* query `messages` to learn whether a file is still in use. Without its own reference record, B11's only options would be to violate that rule or to treat every file as permanently referenced. `file_attachments` is what makes the orphan sweeper safe without a cross-domain read. B5 populates it by calling `AttachFile`, in the same transaction in which it sets its own field — one call, two records, one commit.

## 3. Domain-by-domain analysis

| Domain | Candidate subject | Phase-1 verdict | Evidence |
|---|---|---|---|
| **Messaging (B5)** | Message media | **REGISTERED — `subject_type='message_media'`, active** | `B5_MEDIA_B11_HANDOFF.md` §3 specifies both inbound and outbound flows in frozen text; `FB-B11-001`/`002`/`003` are the frontend evidence |
| **Tax (B10)** | TaxInvoice XML/PDF artifact | **DECLARED — `subject_type='tax_document_artifact'`, no Phase-1 producer** | B10's Phase-1 posture is dormant (`zatca_applicability` never reaches `enabled`), and `B10-D-B001` gates the artifact format entirely. Declared now so that the boundary and retention class are settled before the producer exists (`B11_TAX_DOCUMENT_BOUNDARY.md`) |
| **CRM (B2)** — Lead, Contact, Note, Task, Appointment | **NOT REGISTERED** | frozen `B2_LEAD360_READ_MODEL.md` line 71: *"File attachments \| out of Phase-1 CRM scope"*; `B2_DOMAIN_OWNERSHIP.md` line 73: *"Out of Phase-1 CRM scope. No CRM DTO carries an attachment."* B2's own frozen row already anticipates this as "360 (Phase 2)". Registering it would contradict a closed phase (`B11-D-B008`) |
| **Pipeline (B6)** — Deal | **NOT REGISTERED** | no frozen B6 contract references a file; no frontend affordance exists |
| **Billing (B8)** — payment/billing evidence | **NOT REGISTERED** | B8's flow is Tap-hosted and tokenized; it stores no evidence document. The Billing invoice-history row's download button is a disabled placeholder (`FB-B11-006`) |
| **Finance (B9)** — revenue evidence | **NOT REGISTERED** | `B9_REVENUE_EVENT_MODEL.md`'s `source_type`/`source_ref` is a polymorphic pointer at a domain object, never at a document. B9 requires no artifact |
| **Discovery/Analytics** — CSV exports | **NOT REGISTERED** | exports are generated entirely client-side today (`FB-B11-009`) and never reach a server. Registering a subject type for a thing that produces no server artifact would be inventing behavior |

`ATTACHMENT_SUBJECT_TYPES` is therefore a **closed enum of 2** — `message_media` (active) and `tax_document_artifact` (declared) — not a table, so that a new value requires a code change and a review rather than a row someone can insert. Adding a value is an additive registration with three obligations: name the owning domain, name the frozen contract or evidence that requires it, and state the retention class.

**A `subject_type` outside the enum is `422 VALIDATION_ERROR`.** There is no "other" or free-text subject type; the whole point of the closed enum is that a file cannot be attached to something nobody has reviewed.

## 4. Referential integrity strategy

`subject_id` is deliberately **not** a database foreign key, because a polymorphic column cannot be one. This is the same trade frozen B0 already made twice — `RevenueEvent.source_type`/`source_ref` and `tax_invoices.source_ref` — so it is the house pattern, not a new compromise. Integrity is obtained by four layers instead:

1. **Resolution before insert.** `AttachFile` resolves the subject through the owning domain's own read contract, under the active workspace (Doctrine R-2). An unresolvable subject is `404 ENTITY_NOT_FOUND` — never a validation error, which would confirm existence.
2. **Workspace equality re-asserted after resolution.** `file.workspace_id == subject.workspace_id == active_workspace`, checked as a third comparison rather than assumed from two. `file_attachments.workspace_id` is stored denormalized and constrained equal to `file_assets.workspace_id`, so a cross-tenant link is not merely rejected at write time but unrepresentable afterwards.
3. **`file_id` is a real FK with `ON DELETE RESTRICT`.** A `file_assets` row with any attachment — `active` or `detached` — cannot be hard-deleted. Since Phase 1 never hard-deletes a `file_assets` row at all (`B11_DELETION_RETENTION_MODEL.md` §2), this is a belt-and-braces guarantee that a future cleanup script cannot orphan an attachment.
4. **A dangling-subject sweep.** Reconciliation class `R-6` asks each registered domain, through its own contract, whether the subjects of `active` attachments still exist. A dangling attachment is **reported, never auto-detached** — auto-detaching would let a transient read failure in another domain silently make a file purge-eligible.

Uniqueness: partial unique index on `(file_id, subject_type, subject_id) WHERE state = 'active'`. Attaching the same file to the same subject twice is therefore not a duplicate row and not an error — it is an idempotent replay returning the existing attachment (`B11-D-A013`).

## 5. The firewall: an attachment is never an authority

> **Invariant A-1.** No field of `file_attachments`, and no state of any `FileAsset`, is ever read to decide anything about the subject.

Concretely, and each is a negative control:

| A `FileAsset` never determines | Owner of that fact |
|---|---|
| whether a Message was sent, delivered, read, or failed | B5 (`AT-B11MSG-1`) |
| whether a Conversation is open, assigned, or within its service window | B5 (`AT-B11MSG-2`) |
| whether a tax document is issued, reported, cleared, accepted, or rejected | B10 (`AT-B11TAX-1`, `AT-B11TAX-2`) |
| whether a payment succeeded or a subscription is active | B8 (`AT-B11B8-1`) |
| whether revenue is recognized or reversed | B9 (`AT-B11B9-1`) |
| whether a Lead, Deal, or Business is valid, qualified, or complete | B2/B6 (`AT-B11CRM-1`) |

The converse also holds and matters as much: **a subject's state never changes a file's lifecycle.** A cancelled tax invoice does not archive its artifact; a failed message does not delete its media. Deletion is always an explicit command against the file, subject to the file's own retention class.

`FILE_BUSINESS_AUTHORITY_LEAKS = 0`, `MESSAGE_AUTHORITY_LEAKS = 0`, `B8_AUTHORITY_LEAKS = 0`, `B9_AUTHORITY_LEAKS = 0`, and `B10_AUTHORITY_LEAKS = 0` rest on this section.

## 6. Attach-time guards

| Guard | Failure |
|---|---|
| file resolves in the active workspace | `404 ENTITY_NOT_FOUND` |
| subject resolves in the active workspace | `404 ENTITY_NOT_FOUND` |
| `file.lifecycle_state == 'available'` | `409 CONFLICT` · `details.reason="file_not_ready"` — covers `pending` (not yet verified), `quarantined`, `failed`, and `archived` with one rule and one message, so the response never distinguishes "not ready yet" from "deleted" |
| `subject_type` is in the closed enum | `422 VALIDATION_ERROR` |
| composed permission (`B11_RBAC_TENANCY.md` §4) | `403 PERMISSION_DENIED` |
| `(file, subject)` not already `active` | idempotent replay, `200` |

Note what is deliberately absent: there is **no** guard on the file's uploader, age, or attachment count. A file uploaded an hour ago by one member and attached by another is a normal, supported case — §22 explicitly requires that uploading before attaching stay legitimate.

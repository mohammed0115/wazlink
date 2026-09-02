# B11 — Scope & Ownership

> Design only. No Django app, model, migration, or storage SDK call is created. This document realizes the frozen `Files` domain row (`BACKEND_DOMAIN_OWNERSHIP.md` line 27: aggregate `FileAsset`, table `file_assets`, writer "file service", primary readers "exports, attachments", commands `CreateUpload`/`DeleteAsset`, event `FileUploaded`, integration Hostinger, forbidden coupling "no arbitrary paths") — a domain B0 named in nine separate frozen artifacts and never defined.

## 1. Scope statement

B11 is one bounded context, "Files & Storage," realized as the Django app `apps/files/` that frozen `B0_BACKEND_BLUEPRINT.md` line 46 already reserved ("`files/  # FileAsset and signed storage access`").

B11 answers exactly one question: **"what durable bytes does this workspace own, are they intact, and may this actor read them right now."** It never answers what those bytes *mean*. A `FileAsset` attached to a Message does not make B11 an authority on that Message; a `FileAsset` holding a tax document does not make B11 an authority on whether that document was cleared. This is stated as an invariant, not an aspiration, and is enforced structurally in `B11_DOMAIN_ATTACHMENT_MODEL.md` §5 and proved in `B11_MESSAGING_MEDIA_BOUNDARY.md` and `B11_TAX_DOCUMENT_BOUNDARY.md`.

## 2. Sub-module split

| Sub-module | Aggregate root | Authoritative tables | Allowed writers |
|---|---|---|---|
| File Asset & Upload Lifecycle | `FileAsset` | `file_assets` | File service only (`CreateUpload`, `UploadFileContent`, `FinalizeUpload`, `ImportFileFromUrl`, `ExpireUpload`, `DeleteAsset`, `QuarantineFile`, `ReleaseQuarantinedFile`, `PurgeFileObject`) |
| Domain Attachment | (none — child of `FileAsset`) | `file_attachments` | File service only (`AttachFile`, `DetachFile`), always invoked by the subject-owning domain, never by B11 on its own initiative |
| Storage Usage Measurement | (none — derived accumulator) | `workspace_storage_usage` | File service only, always inside the transaction that changes a `file_assets` row |
| Storage Reconciliation | `FileReconciliationCase` | `file_reconciliation_cases` | File service / operator (`ReconcileFile`) |

`files` never writes `messages`/`conversations`/`message_deliveries` (B5-owned), `tax_invoices`/`tax_submissions`/`tax_profiles` (B10-owned), `leads`/`contacts`/`deals` (B2/B6-owned), `subscriptions`/`payments`/`invoices` (B8-owned), `revenue_events`/`revenue_reversals`/`attribution_touchpoints` (B9-owned), `plans`/`plan_versions`/`quota_definitions`/`plan_version_quotas`/`usage_counters`/`usage_ledger` (B8-owned), or any other table it does not own. This is `B11-D-A002`/`A014`/`A020`/`A025` (§`B11_DECISION_REGISTER.md`).

## 3. Forbidden coupling, restated

B11 never: infers, sets, or contradicts a Message's delivery status or a Conversation's state; determines whether a tax document is issued, reported, cleared, accepted, or rejected; determines whether a payment succeeded or a subscription is active; creates, mutates, or reverses a `RevenueEvent`; defines, publishes, or overrides a plan capability or quota limit; converts a Business into a Lead or moves a Deal stage; triggers an automation rule outside a governed command it itself exposes; or treats the presence, absence, size, checksum, or lifecycle state of a `FileAsset` as evidence about any of the above.

Frozen `BACKEND_DOMAIN_OWNERSHIP.md`'s "no arbitrary paths" forbidden-coupling cell for the Files row is realized literally in `B11_STORAGE_KEY_MODEL.md` §2: no user-supplied string ever reaches a storage key, in any position, in any encoding.

## 4. Referenced Entity Registry

**Definition** (reused verbatim from `B10_SCOPE_AND_OWNERSHIP.md` §4, itself inherited from `B8_DOMAIN_OWNERSHIP.md` §8): a *referenced entity* is a non-B11-owned, non-B11-writable domain entity that B11's contracts, storage FKs, API surface, event payloads, or permission/boundary semantics directly name or depend on as a read-only reference.

| Entity | Table(s) | Owning domain | How B11 references it (read-only) |
|---|---|---|---|
| Workspace | `workspaces` | B1 | Direct FK: `file_assets.workspace_id`, `file_attachments.workspace_id`, `workspace_storage_usage.workspace_id` |
| Membership | `memberships` | B1 | Direct FK: `file_assets.uploaded_by_membership_id`, `file_assets.deleted_by_membership_id`, `file_assets.quarantined_by_membership_id`, `file_attachments.attached_by_membership_id` |
| Message | `messages` | B5 | Not a database FK — `file_attachments.subject_id` under `subject_type='message_media'`, resolved through B5's own contract, never by cross-domain ORM import (`B11_DOMAIN_ATTACHMENT_MODEL.md` §4) |
| MessageMedia | embedded on `messages` | B5 | B11 supplies the values B5 stores in `MessageMedia.file_asset_ref`/`checksum`/`size_bytes`; B11 never reads or writes the field itself (`B11_MESSAGING_MEDIA_BOUNDARY.md` §3) |
| TaxInvoice | `tax_invoices` | B10 | Not a database FK — declared `subject_type='tax_document_artifact'` with **no Phase-1 producer** while B10 is dormant (`B11_TAX_DOCUMENT_BOUNDARY.md` §2) |
| QuotaDefinition | `quota_definitions` | B8 | Named as the sole place a storage *entitlement* limit could ever live; B11 reads no row today because no storage metric exists (`B11_BILLING_QUOTA_BOUNDARY.md` §2) |

`REFERENCED_ENTITY_COUNT = 6`, mechanically counted as the number of distinct rows above, each independently verified to appear as a named reference elsewhere in this pack.

`Lead`, `Contact`, `Note`, `Task`, `Appointment`, and `Deal` are **deliberately absent** from this table. They were analysed as attachment candidates (`B11_DOMAIN_ATTACHMENT_MODEL.md` §3) and rejected for Phase 1 because frozen `B2_LEAD360_READ_MODEL.md` line 71 and `B2_DOMAIN_OWNERSHIP.md` line 73 already declare CRM file attachments "out of Phase-1 CRM scope … No CRM DTO carries an attachment." B11 does not depend on them, so listing them would inflate this count against its own definition.

## 5. Owned entities (summary; full DDL in `B11_STORAGE_MODEL.md`)

`file_assets` (frozen table name, reused verbatim), `file_attachments`, `workspace_storage_usage`, `file_reconciliation_cases` — four tables. `OWNED_ENTITY_COUNT = 4`.

Only `file_assets` is frozen by B0; the other three are additive new tables registered under `B11-AM-012`.

## 6. What B11 does not become

Mirroring `B10_SCOPE_AND_OWNERSHIP.md` §6's "not a Phase-1 self-service surface" discipline: B11 designs **no client-facing file browser, no workspace file list endpoint, and no file-management UI contract** (`B11-D-B005`). The frozen frontend contains no such surface (`B11_FRONTEND_BEHAVIOR_INVENTORY.md`), and inventing one would be exactly the "relational fixture shape alone does not justify a persistent resource" error `BACKEND_PUBLIC_ID_REGISTRY.md` §B warns against, one layer up. Phase-1 files are reached through the subject that references them, or by their `FILE-*` public ID directly.

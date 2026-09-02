# B11 — Implementation Readiness

> **B11 is design-only and grants no implementation authorization.** This document states what an implementation agent would need, and what must be approved first.

## 1. Pre-implementation gate

| # | Gate | Owner | Status |
|---:|---|---|---|
| 1 | Approve the **12 controlled amendments** (`B11_CONTROLLED_AMENDMENTS.md`) — 10 additive, 2 compatible clarifications, 0 non-additive | CTO | **required, not granted** |
| 2 | Resolve the six `PRODUCT DECISION REQUIRED` constants (`B11-D-B007`) | Product | **open** |
| 3 | Verify the deployed storage target's capabilities (`B11-X-007`) — pre-signed upload/download, checksum headers, object lock, lifecycle rules, at-rest encryption | Operations/Platform | **open — and blocks nothing in Phase 1** (§3) |
| 4 | Decide whether storage becomes a B8 entitlement (`B11-D-B001`) | Product / B8 | **open — blocks nothing** (the safety ceiling stands either way) |
| 5 | Confirm B5 accepts the two compatible clarifications in `B11-AM-007` | B5 owner / CTO | **required** |
| 6 | Independent CTO countersign of this pack | CTO | **not granted** |

## 2. Readiness by concern

| Concern | State | Evidence |
|---|---|---|
| `DOMAIN_MODEL_READY` | **READY** | 4 owned tables with column-level DDL, 6 referenced entities, both frozen `file_assets` constraints honored verbatim |
| `LIFECYCLE_READY` | **READY** | 4 machines, 15 states, all transitions enumerated, terminal state fixed, 6 rejected candidate states documented |
| `UPLOAD_MODEL_READY` | **READY** | flow chosen with a comparison table, commands vs. provider actions separated, finalize justified in four ways |
| `TENANCY_READY` | **READY** | all six cross-workspace attacks mapped to a control; no decision reads a storage key |
| `RBAC_READY` | **READY** | 2 permissions reused, 2 added, 5 candidate operations absorbed rather than granted codes |
| `INTEGRITY_READY` | **READY** | algorithm chosen, computation point fixed, write-once invariant stated, ETag disqualified from primary evidence |
| `VALIDATION_READY` | **READY** | 10 ordered gates; declared/detected/canonical separation; allow-list seeded from frontend evidence |
| `ATTACHMENT_READY` | **READY** | model chosen against two alternatives; closed 2-value enum; 4-layer integrity strategy; authority firewall with 6 negative controls |
| `DELETION_READY` | **READY** | 3 models compared; purge orthogonality proved; provider-failure resurrection structurally impossible |
| `ORPHAN_READY` | **READY** | 6 classes; 4-condition eligibility; 3 classes deliberately never auto-cleaned |
| `RECONCILIATION_READY` | **READY** | 8 classes with an explicit precedence rule, satisfying the frozen doctrine's own demand |
| `QUOTA_READY` | **READY** | authority left with B8; safety ceiling defined; race closed with in-flight reservations under a row lock |
| `SECURITY_READY` | **READY** | 15 threats, each with a control and a test; logging/redaction lists explicit |
| `MESSAGING_BOUNDARY_READY` | **READY** | all five of B5's stated requirements answered; the one that needed honesty is amended rather than glossed |
| `TAX_BOUNDARY_READY` | **READY** | firewall stated; retention deferred structurally rather than numerically |
| `PROVIDER_BOUNDARY_READY` | **CONDITIONAL** | the domain requirement is decided; the **provider capability** is `B11-X-007`-unresolved. Phase 1 needs only `put`/`stat`/`open`/`delete`/`list`, so this is a gate on the deferred adapter, not on Phase 1 |
| `B12_HANDOFF_READY` | **READY** | 9 semantic requirements named; execution deliberately not designed; 5 negative controls |

## 3. Why the one `CONDITIONAL` does not block Phase 1

`PROVIDER_BOUNDARY_READY` is conditional because this pass could not verify pre-signed URL support, checksum headers, object lock, lifecycle rules, or at-rest encryption for the deployed target (`B11-X-001`, `B11-X-007`). **Phase 1 depends on none of them.** Flow A uses five operations any S3-compatible store — or a plain filesystem — provides, and the two capability predicates on the port default to false. An implementation could ship on a local filesystem adapter and be architecturally correct.

This is the deliberate payoff of `B11-D-A007`, and it is the reason `CLASS_A_UNRESOLVED = 0` is an honest figure rather than an optimistic one: every provider-dependent question was pushed into Class B by choosing an upload flow that does not need the answer.

## 4. Implementation sequence (informative)

1. `apps/files/` with `file_assets` alone; `CreateUpload` + `UploadFileContent` + `FinalizeUpload` through a **local-filesystem** `FileStorageProvider` adapter, both capability predicates false. Every integrity, validation, and tenancy test in `B11_ACCEPTANCE_TESTS.md` is passable at this step.
2. `GET /files/{id}`, `/download`, `/content` with the ticket, headers, and re-authorization chain.
3. `workspace_storage_usage` + the two-point quota protocol.
4. `file_attachments` + `AttachFile`/`DetachFile`, with `message_media` as the only active subject type; B5 integration.
5. `DeleteAsset` + `PurgeFileObject` + the expiry sweep.
6. `file_reconciliation_cases` + the eight detection classes.
7. Swap the adapter for the verified provider one. **Nothing above changes.**

## 5. What an implementation agent must NOT do

Hard-delete a `file_assets` row; add a sixth lifecycle state; add any transition out of `archived`; derive a content type from a filename, extension, or client claim; put any client-supplied string into a storage key; treat a `provider_etag` as a checksum; rewrite a stored `checksum`; deduplicate by checksum; expose `storage_key` below `file.manage`; emit a provider URL; make `ImportFileFromUrl` client-reachable; delete a `legal`-class file; mutate `retention_class`; define a per-plan storage allowance; use a Redis lock for a quota or lifecycle decision; auto-delete an `O-4` or `O-6` orphan; auto-detach a dangling attachment; retry a mutating provider call before a `stat`; or create any file under `Docs/backend/B12/`, `B13/`, or `B14/`.

## 6. Scope statement

Zero B0–B10 file is modified. Zero frontend file is created, modified, or deleted. Zero Django app, model, migration, serializer, view, URL, Celery task, or storage SDK call is written. Zero `Docs/backend/B12`, `B13`, or `B14` file exists — independently confirmed by directory listing during this pass.

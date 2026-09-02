# B11 — Cross-Domain Contract Matrix

> Design only. Built by mechanical search of every frozen artifact — the 34 B0 root documents plus `Docs/backend/B1`…`B10` — for `file`, `attachment`, `media`, `upload`, `download`, `storage`, `blob`, `object`, `document`, `invoice PDF/XML`, `message media`, `evidence`, `receipt`, `logo`, `avatar`, `image`. Not from memory.

## 1. Frozen B0 references to the Files domain

| # | Frozen artifact | Location | What it fixes | B11's treatment |
|---:|---|---|---|---|
| 1 | `BACKEND_DOMAIN_OWNERSHIP.md` | line 27 | domain `Files`, module `files`, aggregate `FileAsset`, table `file_assets`, writer "file service", readers "exports, attachments", commands `CreateUpload`/`DeleteAsset`, event `FileUploaded`, integration Hostinger, forbidden coupling "no arbitrary paths" | **all reused verbatim.** Ten additive commands and seven additive events registered as `B11-AM-011`; the table list extended as `B11-AM-011`. Forbidden coupling realized literally in `B11_STORAGE_KEY_MODEL.md` §2 |
| 2 | `BACKEND_DATA_MODEL.md` | line 25 | *"Files \| file_assets \| workspace/storage_key unique; checksum index"* | **honored verbatim** as two constraints in `B11_STORAGE_MODEL.md` §1; three tables added under `B11-AM-012` |
| 3 | `BACKEND_STATE_MACHINES.md` | line 55 | *"FileAsset is `pending→available/quarantined/failed→archived`."* | **five state names adopted unchanged**, no sixth added. Two edges added (`available↔quarantined`) under `B11-AM-010`; a second, orthogonal machine added for byte disposition |
| 4 | `BACKEND_PUBLIC_ID_REGISTRY.md` | section A | `FILE-` → FileAsset, Files, workspace-scoped | **reused; zero new prefix** (`B11_PUBLIC_ID_REGISTRY.md`) |
| 5 | `BACKEND_INTEGRATION_BOUNDARIES.md` | line 17 | *"Hostinger storage \| `FileStorageProvider` \| outbound \| Files \| blob only, signed/proxied access, checksum, MIME/size/quarantine"* | **port name reused verbatim**; "outbound" honored (no callback surface exists); all five qualities realized. No amendment |
| 6 | `BACKEND_DTO_CONTRACTS.md` | line 51 | transport names `UploadRequest / FileAsset / FileDownload / Health` | **all three file DTOs reused by name**; `UploadRequest` and `FileAsset` extended additively under `B11-AM-001`; `FileDownload` unchanged |
| 7 | `BACKEND_OPENAPI_V1.yaml` | 1721-1860, 3435-3505 | `POST /files/uploads` → 201 `FileAsset` with `Idempotency-Key`; `GET /files/{id}/download` → 200 `FileDownload{download_url, expires_at}`; schema shapes with `additionalProperties: false` | **both operations reused**; nine added and both schemas extended under `B11-AM-001`/`B11-AM-002` |
| 8 | `BACKEND_API_CATALOG.md` | lines 38-39 | `POST /api/v1/files/uploads` "signed upload", "file permission"; `GET /api/v1/files/{id}/download` "signed/proxied download", "object permission", DTO "redirect/stream" | the catalog/OpenAPI inconsistency is **resolved, not inherited**, by `B11-AM-003` (`B11_API_DTO_CONTRACTS.md` §2) |
| 9 | `BACKEND_ERROR_CATALOG.md` | code table | `FILE_TYPE_NOT_ALLOWED` (422) — minted for Files before Files was designed | **reused unchanged.** Three codes added under `B11-AM-004`; eight candidates absorbed into existing codes |
| 10 | `BACKEND_SECURITY_ARCHITECTURE.md` | uploads paragraph | *"MIME sniffing, extension allowlists, size limits, checksum, malware scanning where available, quarantine status, and signed/proxied access. Hostinger paths are never exposed directly."* | every clause realized (`B11_FILE_VALIDATION.md`, `B11_SECURITY_PRIVACY.md`). **"where available" is what makes deferring the scanner contract-compliant rather than a gap** |
| 11 | `BACKEND_FAILURE_MATRIX.md` | line 22 | *"Storage upload failure \| upload failed \| asset quarantined/failed \| retry key \| operations"* | realized by `B11-F-023`…`B11-F-028`; not contradicted. No amendment |
| 12 | `BACKEND_RETRY_POLICY.md` | line 22 | *"Storage failure \| upload unavailable \| yes \| 5 \| failed asset + retry action"* | **reused verbatim** for the purge worker and reconciliation scans. No amendment |
| 13 | `BACKEND_TIMEOUT_POLICY.md` | line 20 | *"Hostinger storage \| 5s \| 60s \| 10m"* | **reused verbatim**; B11 proposes no different number. No amendment |
| 14 | `BACKEND_COMMAND_EVENT_CATALOG.md` | line 14 | `FileUploaded` is in the platform event list | **reused verbatim**, bound to "a file became `available`." Seven events added under `B11-AM-011` |
| 15 | `BACKEND_OPERATIONS_OBSERVABILITY.md` | alerting | "storage failures" named as page-worthy | bound to concrete signals in `B11_OBSERVABILITY.md` §5. No amendment |
| 16 | `BACKEND_PRIVACY_AND_DATA_HANDLING.md` | classification | "Private communications — messages, **media references**"; "30 days for temporary exports"; "Default retention must be a product/legal decision" | the most restrictive class applied uniformly; `PURGE_GRACE` aligned to the frozen 30-day figure rather than invented; every timer marked `PRODUCT DECISION REQUIRED` |
| 17 | `BACKEND_TEST_STRATEGY.md` | line 12 | "upload policy" is a mandatory security-test category | B11 adds no new category; it supplies the instances |
| 18 | `BACKEND_RATE_LIMIT_POLICY.md` | table | no upload/download row exists | two rows added under `B11-AM-006` |
| 19 | `BACKEND_RECONCILIATION.md` | table | no Files row exists | one row added under `B11-AM-008`; the doctrine paragraph reused verbatim |
| 20 | `B0_BACKEND_BLUEPRINT.md` | lines 46, 68 | `files/  # FileAsset and signed storage access`; *"Files \| Hostinger `FileStorageProvider` \| Blob storage only, signed access"* | app path and port confirmed. No amendment |
| 21 | `B0_BACKEND_TRACEABILITY.md` | line 19 | Files/storage marked "Covered" by the security and integration documents | B11 supplies the domain design those two documents assumed |

## 2. Frozen B1–B10 references

| # | Frozen artifact | Location | What it fixes | B11's treatment |
|---:|---|---|---|---|
| 22 | `B1_AUTHORIZATION_RBAC.md` | §2, §3 (lines 74, 129-130) | permission family `Files`: `file.upload`, `file.download`, with full role rows | **both reused verbatim**, rows unaltered; two added under `B11-AM-005` |
| 23 | `B1_AUTHORIZATION_RBAC.md` | §4, line 169 | *"FileAsset → owning resource \| owner in-scope; signed download URLs are single-use, short-lived, and bound to the resolved workspace"* | realized literally by the single-use, 5-minute, workspace-and-actor-bound application ticket (`B11_RBAC_TENANCY.md` §5). **No amendment needed** — this is the frozen requirement B11's download design was built to satisfy |
| 24 | `B1_API_DTO_CONTRACTS.md` | line 308 | the **closed** `CONFLICT` `details.reason` vocabulary | three values added under `B11-AM-009`, following `B2-D-B011`'s and `B10-AM-008`'s precedent |
| 25 | `B1_WORKSPACE_MEMBERSHIP_MODEL.md` | line 9 | a Workspace owns `FileAssets` | `file_assets.workspace_id` NOT NULL. No amendment |
| 26 | `B2_DOMAIN_OWNERSHIP.md` | line 35 | *"File attachment \| **Files** \| `file_assets` \| `CreateUpload` \| 360 (Phase 2) \| **CRM**"* | ownership confirmed; the "Phase 2" marker is **honored**, not overridden |
| 27 | `B2_DOMAIN_OWNERSHIP.md` | line 73 | *"Out of Phase-1 CRM scope. No CRM DTO carries an attachment."* | CRM subject types **not registered** (`B11-D-B008`) |
| 28 | `B2_LEAD360_READ_MODEL.md` | line 71 | *"File attachments \| out of Phase-1 CRM scope"* | same |
| 29 | `B5_MEDIA_B11_HANDOFF.md` | §1-§6 (whole document) | `B5-D-A020`; `MessageMedia` field table; inbound/outbound flows; the five requirements of B11; the "B5 designs no MIME allow-list, size ceiling, scanning policy, or retention" declaration | **answered point by point** in `B11_MESSAGING_MEDIA_BOUNDARY.md` §1. One compatible clarification (`B11-AM-007`) for the scanning half and the checksum algorithm |
| 30 | `B5_DOMAIN_OWNERSHIP.md` | line 43 | *"`MessageMedia` … the durable file itself is `FILE-*`, B11-owned"* | confirmed; B11 writes no B5 field |
| 31 | `B5_DATA_MODEL.md` | line 12 | *"B11 (`file_assets`) \| **read + create**, via B11's own contract … B5 never has direct DDL/write credential"* | symmetric: B11 never has one to B5's tables |
| 32 | `B5_ENTITLEMENT_RBAC_TENANCY.md` | line 101 | cross-workspace media access "delegated to B11's own access-controlled references" | realized in `B11_RBAC_TENANCY.md` §3 |
| 33 | `B5_SECURITY_PRIVACY_THREAT_MODEL.md` | lines 20, 21, 27 | threats 8 (media authorization bypass), 9 (open redirect through a media URL), 15 (malicious attachment) all delegated to B11 | threats 8 and 9 fully closed (no provider URL is ever emitted; every access is re-authorized). Threat 15 is closed by validation, allow-list, `attachment`+`nosniff`, and operator quarantine — **not by a scanner**, which `B11-AM-007` states plainly |
| 34 | `B5_INBOUND_PIPELINE.md` | line 44, §5 | inbound media never blocks ingestion; unrecognized types get no fetch | B11 never receives an import for unrecognized media; its own allow-list is a second, independent gate |
| 35 | `B5_ACCEPTANCE_TESTS.md` | `AT-MEDIA-2`, `AT-MEDIA-4` | B5-side assertions that a B11 fetch populates `file_asset_ref` and that outbound uploads delegate to `CreateUpload` | B11's side is `AT-B11MSG-*`; B5's tests are **not duplicated** |
| 36 | `B5_FAILURE_SCENARIOS.md` | `B5-DF-016` | oversize/unsupported media rejected at the provider, or earlier by B11's validation | consistent; `B11-F-004`/`B11-F-005` are the earlier rejection |
| 37 | `B5_WHATSAPP_EXTERNAL_VALIDATION_REGISTER.md` | `B5-X-009` | media flow, temporary-URL expiry, supported MIME types and size limits per media kind — **unresolved** | **not re-litigated.** B11 defers to B5's register and enforces its own limits independently (`B11_FILE_VALIDATION.md` §6) |
| 38 | `B8_PLAN_CATALOG.md` | §1, §6, §8 | exactly five metric codes; *"adding a 6th metric requires a controlled amendment"* | **no sixth metric filed** (`B11-D-B001`); B8 keeps entitlement authority |
| 39 | `B8_USAGE_QUOTA_MODEL.md` | §1, §4 | the owning domain reserves against B8's row under `SELECT … FOR UPDATE`; no Redis participates | reservation mechanics **mirrored step for step** for the platform safety ceiling |
| 40 | `B10_DECISION_REGISTER.md` | `B10-D-B001`, `B10-D-B004` | the ZATCA artifact format and tax retention durations are both deferred/unresolved | B11 declares the subject type and the `legal` retention class **without** inventing either |

`CLASS_A_REFERENCE_COUNT = 40`, counted as the rows in §1 and §2. `CLASS_A_UNRESOLVED = 0` — every row above is either reused verbatim, realized, honored as a deferral, or covered by a listed controlled amendment; none is left as an open question blocking a Class A decision.

## 3. Searches that returned nothing

Recorded so their absence is a finding rather than an omission:

| Search | Result |
|---|---|
| `blob` outside B0's own "blob storage" phrasing | no domain contract |
| `receipt` | only `WebhookReceipt`/`webhook_receipts` (B0 Webhooks) and `WHR-*` — unrelated to files |
| `evidence` in B8/B9 | B8 stores no payment evidence document (Tap-hosted/tokenized); B9's `source_ref` points at domain objects, never documents |
| `invoice PDF`, `invoice XML`, `UBL`, `QR payload` as *stored artifacts* | B10 defines the concepts but produces no artifact in Phase 1, and gates the format under `B10-D-B001` |
| `logo`, `avatar`, `profile image` as an uploadable | none in any frozen backend artifact; frontend evidence is initials and one static build asset (`FB-B11-007`, `FB-B11-008`) |
| storage entitlement, storage quota, storage limit | none in B8 or in the frozen frontend (`FB-B11-011`) |
| a storage **webhook** or provider callback | none — `BACKEND_INTEGRATION_BOUNDARIES.md` marks Hostinger `outbound` only |

## 4. Domains with no B11 contact at all

B3 (Discovery), B4 (Intelligence), B6 (Pipeline), B7 (Automation), B9 (Finance). Each was searched; none names a file, attachment, media, or storage concept in any frozen artifact. B11 therefore designs no boundary document for them, rather than manufacturing one — the honest alternative to a five-page matrix of "no interaction."

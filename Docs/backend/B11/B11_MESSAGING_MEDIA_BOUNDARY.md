# B11 — Messaging Media Boundary (B5)

> Design only. B5 is **closed and frozen**. This document is the symmetric counterpart to `B5_MEDIA_B11_HANDOFF.md`, answered from B11's side. It changes nothing in B5.

## 1. What B5 already committed to, and what B11 owes back

B5 pre-committed five requirements (`B5_MEDIA_B11_HANDOFF.md` §4). Each is answered here, with the answering artifact named.

| B5's stated requirement | B11's answer | Where |
|---|---|---|
| Accept an upload-from-URL request with a bounded timeout | `ImportFileFromUrl` — system-actor-only, host-allow-listed, SSRF-defended, bounded by the frozen "Hostinger storage · 10m job" deadline and by `MAX_FILE_BYTES` | `B11_UPLOAD_MODEL.md` §6 |
| Return a stable `FILE-*` reference and a checksum on success | `FILE-*` is the frozen public ID, minted at `CreateUpload` and immutable; the checksum is lowercase-hex SHA-256, written once at finalize and never updated | `B11_CHECKSUM_INTEGRITY.md` §1, §3 |
| Enforce MIME/type/size validation and quarantine/**scanning** per its own policy | validation, closed allow-list, mismatch rejection, and a working operator quarantine — **but no automated scanner in Phase 1.** Registered as a compatible clarification, not left implied | `B11_FILE_VALIDATION.md` §6–§8; `B11-AM-007` |
| Issue access-controlled download references (signed/proxied, never a raw public URL) | application-proxied streaming behind a re-authorized session plus a single-use, short-TTL, workspace- and actor-bound ticket. No provider URL is ever emitted in Phase 1 | `B11_RBAC_TENANCY.md` §5, `B11_SECURITY_PRIVACY.md` §5 |
| Honor workspace scoping on every operation | Doctrine R-1 on every operation; `404` for a cross-workspace `FILE-*` | `B11_RBAC_TENANCY.md` §3 |

The third row is the one that required an amendment rather than a simple "yes." B5's sentence — "B5 does not re-implement content safety scanning — it inherits B11's" — remains **literally true**: B5 inherits whatever B11's policy is. `B11-AM-007` records what that policy actually is today so that the inherited promise is not read as more than B11 delivers.

## 2. The three identities, kept apart

> **`B11-D-A025`.** Three distinct identifiers exist for one piece of media, and none is substitutable for another.

| Identity | Owner | Lifetime | Meaning |
|---|---|---|---|
| `provider_media_id` (Meta's) | B5 | provider-defined, temporary | Meta's handle for the media on Meta's infrastructure |
| `media_id` (`med_…`) | B5 | life of the Message | B5's message-scoped child identifier; no top-level public-ID prefix, reached only through its Message |
| `FILE-*` | **B11** | life of the `FileAsset` | WazLink's durable identity for the stored bytes |

**A provider media ID is never a WazLink file identity.** It is never written to `file_assets.public_id`, never used to look a file up, never returned in a B11 DTO, and never a component of a storage key. `FILE_ID_PROVIDER_ID_CONFLATIONS = 0` rests on this paragraph. Negative control `AT-B11MSG-4`.

Symmetrically, `FILE-*` is never sent to Meta as an identifier. The outbound adapter re-uploads or references the bytes through Meta's own outbound-media mechanism, exactly as `B5_MEDIA_B11_HANDOFF.md` §3 already specifies.

## 3. Who writes what

| Field | Written by | B11's relationship to it |
|---|---|---|
| `Message.*`, `Conversation.*`, `message_deliveries.*` | B5 | **never touched.** B11 has no write credential, no ORM path, and no command that names them |
| `MessageMedia.file_asset_ref` | **B5** | B11 *returns* the `FILE-*`; B5 stores it. B11 never writes or reads the column |
| `MessageMedia.checksum`, `.size_bytes`, `.mime_type` | **B5** | same — B11 supplies values through a command result; B5 decides what to persist |
| `MessageMedia.fetch_status` | **B5** | B11 has no opinion. A failed import is a failed command; B5 maps that to `expired`/`failed` under its own frozen rules |
| `file_assets.*`, `file_attachments.*` | **B11** | B5 has no write credential; it calls `CreateUpload`/`ImportFileFromUrl`/`AttachFile` and reads the results, exactly as `B5_DATA_MODEL.md` line 12 already declares |

`MESSAGE_AUTHORITY_LEAKS = 0` is the direct consequence: there is no field in B11's schema that describes a Message, and no command in B11's catalog that takes a Message as anything other than an opaque attachment subject.

## 4. The two flows, from B11's side

**Inbound (Meta → WazLink).** B5's webhook worker calls `ImportFileFromUrl(url, workspace, actor=system:messaging, expected_family)`. B11 creates a `pending` `FileAsset`, streams from the source URL to the provider while hashing and detecting, finalizes, and returns `FILE-*` + checksum + size. B5 then calls `AttachFile(file, subject_type='message_media', subject_id=<message>)` in the same transaction in which it sets its own `file_asset_ref` and `fetch_status='stored'`.

If the import fails — the temporary URL expired, the host was not allow-listed, the content type was rejected, the size exceeded the ceiling, the provider was unavailable — B11 leaves the `FileAsset` in `failed` with a `failure_reason`, returns the failure, and does nothing else. **B11 never marks a Message as anything.** The Message was already admitted by B5 without waiting for the fetch, per `B5_INBOUND_PIPELINE.md` §5, and that remains B5's decision alone.

**Outbound (WazLink → Meta).** The actor uploads through the ordinary client path (`CreateUpload` → `UploadFileContent` → `available`). B5's send request references the `FILE-*`. `AttachFile` is called by B5 when the Message row is created, not by B11 and not at upload time — which is precisely why a file may legitimately sit `available` and unattached for a while, and why the orphan sweeper must not treat that as garbage (`B11_ORPHAN_CLEANUP_MODEL.md` §2).

## 5. Unsupported media

B5's frozen rule (`B5_INBOUND_PIPELINE.md` §5, restated in its handoff §5) is that a content type its closed enum does not recognize is admitted as `content_type=unsupported` with **no `file_asset_ref` fetch attempted**. B11 therefore never receives an import request for unrecognized media, and never stores arbitrary binary content on a provider's unverified type claim. B11's own §6 allow-list is a second, independent gate for the cases that do arrive — the two filters are deliberately not the same list, so a widening of one does not silently widen the other.

## 6. Deletion asymmetry

A Message is immutable in B5 and is never user-deleted. A file whose only `active` attachment is a `message_media` subject is therefore **not user-deletable**: `DeleteAsset` returns `409 CONFLICT` · `details.reason="file_attachment_present"`. There is no detach path for message media either, because detaching would silently rewrite the history of a sent conversation.

This is stated as a B11 rule about B11's own guard, not as a claim about B5's retention policy. If B5 ever gains a message-deletion or retention-expiry workflow, it will call `DetachFile` under its own authority, and only then does the file become deletable or sweepable. B11 does not anticipate that workflow and does not design it.

## 7. Negative controls

`AT-B11MSG-1` **(NC)**: a B11 command, worker, or reconciliation repair writing `messages`, `conversations`, or `message_deliveries` — fails.
`AT-B11MSG-2` **(NC)**: any B11 read of `MessageMedia.fetch_status`, or any B11 logic branching on a Message's delivery state — fails.
`AT-B11MSG-3` **(NC)**: `ImportFileFromUrl` exposed as an `/api/v1/` operation, or reachable by a non-system actor — fails.
`AT-B11MSG-4` **(NC)**: `provider_media_id` written to `file_assets.public_id`, used as a lookup key, or embedded in a storage key — fails.
`AT-B11MSG-5` **(NC)**: `DeleteAsset` succeeding on a file with an `active` `message_media` attachment — fails.

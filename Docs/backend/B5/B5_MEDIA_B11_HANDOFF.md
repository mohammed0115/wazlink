# B5 — Media and the B11 (Files & Storage) Handoff

> **B5 status:** Target design only. B5 owns media *metadata and reference*; durable bytes are B11's concern. B11 is not designed here — this document states only the contract B5 needs from it, mirroring how `B3_B4_HANDOFF_CONTRACT.md` states guarantees without designing the consuming domain.

## 1. Why B5 does not own storage

> **`B5-D-A020`: B5 never implements its own blob storage, signed-URL issuance, or retention engine. `MessageMedia` is a reference row; the durable asset is a B11 `FILE-*`.**

Frozen `BACKEND_DOMAIN_OWNERSHIP.md` already names a Files domain (`FileAsset`, `file_assets`, `FILE-*`, commands `CreateUpload`/`DeleteAsset`, event `FileUploaded`) with exactly this responsibility. Duplicating it inside B5 would be the same "gratuitous drift" B3/B4 both refused when declining to invent a redundant concept for something the corpus already owns.

## 2. `MessageMedia` fields (B5-owned, embedded on `Message`)

| Field | Type | Notes |
|---|---|---|
| `media_id` | text | run-scoped/message-scoped internal id (e.g. `med_01J...`) — no top-level public-ID prefix, reached only through the owning Message |
| `direction` | enum(2) | `inbound` \| `outbound` — governs which fetch/upload flow applies (§3) |
| `content_type` | enum | `image` \| `document` \| `audio` \| `video` (`B5_MESSAGE_CONTENT_MODEL.md` §1) |
| `mime_type` | text | |
| `size_bytes` | integer, nullable | known once fetched/uploaded |
| `file_asset_ref` | `FILE-*`, nullable | populated once B11 durably stores the bytes; null while `fetch_status='pending'`/`'fetching'` |
| `provider_media_id` | text, nullable | Meta's own temporary media identifier (outbound: WazLink's own upload reference; inbound: Meta's reference to fetch from) |
| `fetch_status` | enum | `pending` \| `fetching` \| `stored` \| `expired` \| `failed` (inbound only) |
| `checksum` | text, nullable | populated once stored, from B11 |
| `caption` | text, nullable | the human-authored caption, if any — this is `Message.body` for a media message, not a separate field |

## 3. Inbound vs. outbound media flow

| Flow | Steps |
|---|---|
| **Inbound** | webhook references `provider_media_id` and a **temporary** Meta-hosted URL/token → B5 admits the Message immediately with `fetch_status=pending` (never blocks ingestion on the fetch, `B5_INBOUND_PIPELINE.md` §5) → an async worker calls B11's upload-from-URL capability before the temporary URL expires (`B5-X-009`) → on success, `file_asset_ref` populated, `fetch_status=stored`; on expiry/failure, `fetch_status=expired`/`failed`, surfaced in the thread as "media unavailable," never silently hidden |
| **Outbound** | actor attaches a file through the composer → B5 delegates the actual upload to B11 (`CreateUpload`) → B11 returns `FILE-*` → B5's send request references it, and the adapter re-uploads/references it to Meta per the provider's own outbound-media mechanism (`B5-X-009`) as part of the provider call |

## 4. What B5 requires from B11 (the contract, not the design)

| Requirement | Why |
|---|---|
| Accept an upload-from-URL request with a bounded timeout, for the inbound-fetch case | Meta's temporary URLs expire; B5 cannot wait indefinitely |
| Return a stable `FILE-*` reference and a checksum on success | `MessageMedia.file_asset_ref`/`checksum` |
| Enforce MIME/type/size validation and quarantine/scanning per its own policy | B5 does not re-implement content safety scanning — it inherits B11's |
| Issue access-controlled download references (signed/proxied, never a raw public URL) | prevents the "open redirect / unauthorized media access" attack (`B5_SECURITY_PRIVACY_THREAT_MODEL.md` §2) |
| Honor workspace scoping on every operation | a `FILE-*` created for one workspace's Message must never be resolvable by another |

## 5. Unsupported media

A content type or MIME the closed `content_type` enum does not recognize is admitted as `content_type=unsupported` (`B5_INBOUND_PIPELINE.md` §5) with no `file_asset_ref` fetch attempted — WazLink does not download and store arbitrary unrecognized binary content on the strength of a provider claiming a type it does not itself validate.

## 6. What B5 does not prematurely absorb

B5 designs no MIME allow-list, no size ceiling, no scanning policy, no retention schedule of its own for the underlying bytes — all of those are B11's, referenced here, not restated or duplicated. `B5_DATA_MODEL.md` §4 records only the retention class for the **metadata** row (`MessageMedia`), not the asset itself.

# B13 — File Security (Operational Contract)

> Design only. Preserves verbatim the frozen B11 clauses anchored as `FI-B11-01`…`FI-B11-06` — `B11_SECURITY_PRIVACY.md`, `B11_RBAC_TENANCY.md`, `B11_FILE_VALIDATION.md`, `B11_STORAGE_KEY_MODEL.md`, `B11_TAX_DOCUMENT_BOUNDARY.md` and `B11_BILLING_QUOTA_BOUNDARY.md`. `B11_CHECKSUM_INTEGRITY.md`, `B11_DELETION_RETENTION_MODEL.md` and `B11_STORAGE_PROVIDER_BOUNDARY.md` are consulted as frozen background; the first two carry no dedicated anchor because nothing in this document depends on a clause of theirs that an existing anchor does not already carry, and the third is anchored as `FI-B11-07` because §8's unknown-outcome rule does depend on it directly. **Corrected under `B13-FIX.1`:** the previous preamble claimed six documents were preserved "verbatim (`FI-B11-01`…`FI-B11-05`)" when two of them were not represented by those anchors at all. B13 adds no new file-security control; it states the production enforcement, monitoring, and incident-response layer.

## 1. Upload authorization

`file.upload` gated by workspace membership and, for attachment, composed with the subject domain's own write permission (`B11-D-A014`, `FI-B11-02`). Every upload passes through `CreateUpload` → `UploadFileContent` → `FinalizeUpload`, each re-checking workspace scope.

## 2. Size limits and quota

| Ceiling | Value | Class |
|---|---|---|
| `MAX_FILE_BYTES` | 25 MiB (proposed) | `B13-D-B010`, Class B — deployment config, not plan-catalog data. **The value is not B13's to settle:** frozen `B11-D-B007` holds it, with `WORKSPACE_STORAGE_SAFETY_CEILING_BYTES` and the four TTLs below, as **`PRODUCT DECISION REQUIRED`**. B13 carries the frozen proposal forward unchanged and adds no approval it does not have |
| `WORKSPACE_STORAGE_SAFETY_CEILING_BYTES` | 5 GiB (proposed), uniform across every plan | `B13-D-B011`, Class B — a platform safety floor, never an entitlement; the **value** remains frozen `B11-D-B007`'s open **`PRODUCT DECISION REQUIRED`**, not settled here (the billing-boundary distinction in frozen `B11_BILLING_QUOTA_BOUNDARY.md` §3, anchored as `FI-B11-06`: "an entitlement is something a customer can change by buying something; neither ceiling is") |

Both breaches return the frozen `403 QUOTA_EXHAUSTED` — no new code is minted. If a storage entitlement metric is introduced later, the safety ceiling remains a floor: `min(entitlement, safety_ceiling)`.

## 3. Extension vs. detected MIME — production enforcement

Ten ordered gates (`FI-B11-03`), summarized for operational reference:

| Phase | Gates | What they check |
|---|---|---|
| Pre-bandwidth (`CreateUpload`) | G1–G4 | filename shape, declared type on allow-list, declared size, provisional quota — cheap rejection, **not** security controls |
| Post-measurement (`UploadFileContent`/`FinalizeUpload`) | G5–G10 | streamed size, non-empty, detected type on allow-list, declared-vs-detected compatibility, checksum + size verification, authoritative quota reservation under row lock |

**Mismatch rule**: declared and detected agree → accept; differ but same equivalence group → accept, record substitution; differ across groups or unrecognized → **reject** (a `.pdf` that is really `.html` is a stored-XSS vector, `FI-B11-03`). The canonical `content_type` is always the verified **detected** value, never the client's claim.

## 4. Quarantine and malicious/suspicious file handling

**Phase 1 performs no malware/antivirus scanning** (`B11-D-A024`, `FI-B11-03`). Six compensating controls, all structural, all already frozen:

1. Closed content-type allow-list; active-content types (HTML, XHTML, SVG, XML, executables/scripts) excluded as a class, not enumerated as a blocklist.
2. Server-side detection with declared-vs-detected mismatch rejection.
3. Downloads never render in a browsing context — `Content-Disposition: attachment` + `X-Content-Type-Options: nosniff`.
4. Bytes are never executed, expanded, parsed, transcoded, thumbnailed, or previewed server-side.
5. Every download is re-authorized against the current session/workspace, bounding blast radius to actors already in the uploading workspace.
6. `quarantine` exists as a working Phase-1 state with an operator producer (`QuarantineFile`).

**Future integration point** (Class B, `B13-D-B012`): a malware scanner as a `FinalizeUpload` step, mapping clean/infected/inconclusive to available/quarantined/quarantined — no schema change required when adopted (`B11-D-B002`).

## 5. Storage path/key isolation

Deterministic key `<env>/w/<workspace_uuid>/<yyyy>/<mm>/<file_uuid>` — every variable segment is a UUID or zero-padded integer; **no client-supplied string appears in any position**, so there is no sanitizer to get wrong (`FI-B11-04`). Tenant isolation is enforced by **application authorization**, never by the key prefix — the prefix is operational containment only. `CROSS_TENANT_FILE_ACCESS_GAPS = 0` rests on `B13_AUTHORIZATION_TENANCY.md` §8, not on key structure.

## 6. Private access and download authorization

`file_assets.access_class` has exactly one Phase-1 value, `private` — no public value, no anonymous read path, no provider-signed download URL issued in Phase 1 (`FI-B11-01`). Every byte response re-runs the full chain: session → active workspace → Doctrine R-1 → `file.download` → `lifecycle_state == 'available'` → ticket validation (`B11-D-A022`). **Possession of any URL WazLink has ever emitted grants nothing on its own** — the ticket is the weakest gate, not the strongest: single-use, short-lived (proposed 5 minutes — frozen `B11-D-B007`, still **`PRODUCT DECISION REQUIRED`**; `B13-D-B013` carries the proposal, it does not approve it), never a bearer credential.

## 7. Safe content disposition

| Header | Value | Why |
|---|---|---|
| `Content-Disposition` | `attachment; filename="<safe>"; filename*=UTF-8''<pct-encoded>` | primary control against active-content execution — OWASP's HTTP Headers Cheat Sheet: *"Use `Content-Disposition: attachment` to force download instead of inline rendering"* (`B13-X-006`, VERIFIED) |
| `X-Content-Type-Options` | `nosniff` | secondary control, per the same OWASP guidance (`B13-X-006`) — insufficient alone against e.g. SVG navigated to directly, which is why SVG is excluded at ingest rather than relied on to be safe at egress |
| `Content-Type` | canonical (verified detected) value | never the client's declared value |
| `Cache-Control` | `private, no-store` | a private file stream must never enter a shared cache |
| `Content-Length` | verified `size_bytes` | |

## 8. Deletion lifecycle and orphan cleanup

Soft-delete metadata, asynchronous physical purge; the `file_assets` row is the permanent tombstone — **no row is ever hard-deleted in Phase 1**, by any command, sweeper, or operator (`FI-B11-05`, `B11-D-A015`). `archived` has no exit transition — a provider-delete failure cannot resurrect access (`B11-D-A006`/`A016`). Retention timers (`UPLOAD_INTENT_TTL` ≈1h, `DOWNLOAD_TICKET_TTL` ≈5min, `ORPHAN_GRACE` ≈7 days, `PURGE_GRACE` ≈30 days) are all frozen `B11-D-B007` proposals still marked **`PRODUCT DECISION REQUIRED`**, carried forward unchanged as `B13-D-B014` rather than settled by B13, and never applied to `legal`-class files, which are undeletable by any command/worker/timer/operator regardless of age (`FI-B11-05`).

## 9. Provider failure handling

A `put_object`/`delete_object` timeout does not default to failure or success — `stat_object` (a read-only lookup) resolves it first; only if `stat` itself fails does the operation enter the frozen "Storage failure" retry row (`FI-B0-21`). No retry in this design can create a storage object the domain does not already have a row for (`FI-B11-01`, `B11_STORAGE_PROVIDER_BOUNDARY.md` §4).

## 10. Logging and redaction

**Never logged, at any level**: file contents, the checksum at INFO or below (a hash is an oracle for content), signed URLs/tickets complete or truncated, storage credentials, the storage key outside operator-authenticated views, provider host/bucket/endpoint, raw `original_filename` at INFO or below (`FI-B11-01`). Always logged: `FILE-*` public ID, `workspace_id`, actor, `request_id`, lifecycle transition (from→to + reason code), size class (bucketed), content-type family, provider error class. Full redaction discipline cross-referenced in `B13_LOGGING_REDACTION.md` §2.

## 11. Cross-workspace attack table

| Attack | Stopped by |
|---|---|
| Metadata lookup across tenants | Doctrine R-1 → `404` |
| Download across tenants | Doctrine R-1 on both `/download` and `/content`; ticket binds workspace+actor+file |
| Finalize a foreign upload | Doctrine R-1 + workspace-bound upload ticket |
| Attach a foreign file to a local subject (or vice versa) | Doctrine R-2 three-way equality re-assertion |
| Delete a foreign file | Doctrine R-1 → `404` |
| Reuse a signed URL/ticket after workspace access changed | per-request re-authorization (§6) |

## 12. Acceptance controls

| ID | Assertion |
|---|---|
| `AT-B13FILE-1` | An upload whose declared and detected content types are on the allow-list but in different equivalence groups is rejected at finalize |
| `AT-B13FILE-2` | A file whose streamed bytes exceed `MAX_FILE_BYTES` mid-stream aborts the provider write immediately |
| `AT-B13FILE-3` | A checksum mismatch at finalize rejects the file and never updates `checksum` after initial write |
| `AT-B13FILE-4` | Every download response carries `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff` |
| `AT-B13FILE-5` | A previously issued download ticket fails once the file transitions to `quarantined` or `archived`, regardless of ticket TTL remaining |
| `AT-B13FILE-6` | A `legal`-class file rejects `DeleteAsset` with `403 PERMISSION_DENIED` regardless of caller role |
| `AT-B13FILE-7` | Cross-workspace file lookup, download, finalize, attach, and delete all return `404`, never `403` |
| `AT-B13FILE-8` | A storage-provider delete timeout does not advance `storage_object_state` to `purged` without a confirming `stat_object` |

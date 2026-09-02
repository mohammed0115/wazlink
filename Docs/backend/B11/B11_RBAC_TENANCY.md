# B11 — RBAC & Tenancy

> Design only. Built on the frozen B1 methodology (`B1_AUTHORIZATION_RBAC.md`) without altering one `allow`/`conditional`/`deny` cell of `BACKEND_AUTHORIZATION_MATRIX.md`.

## 1. Permissions — reuse first

Frozen `B1_AUTHORIZATION_RBAC.md` §2 already registers a `Files` permission family: `file.upload`, `file.download`. B11 reuses both verbatim and adds two.

| Code | Status | Governs |
|---|---|---|
| `file.upload` | **frozen, reused** | `CreateUpload`, `UploadFileContent`, `FinalizeUpload` |
| `file.download` | **frozen, reused** | `GET /files/{id}` (metadata), `GET /files/{id}/download` (ticket), `GET /files/{id}/content` (bytes) |
| `file.delete` | **new, additive** (`B11-AM-005`) | `DeleteAsset` |
| `file.manage` | **new, additive** (`B11-AM-005`) | `QuarantineFile`, `ReleaseQuarantinedFile`, `ReconcileFile`, operator storage views |

`REUSED_PERMISSION_COUNT = 2`. `ADDITIVE_PERMISSION_COUNT = 2`.

**Why exactly two new codes, and not more.** The brief (§14) lists seven candidate operations and warns against permission explosion. Five of the seven are absorbed rather than granted their own code:

| Candidate operation | Resolution |
|---|---|
| view metadata | `file.download`. Metadata is strictly less than the bytes it describes, so gating it at the byte permission is conservative by construction. A third, weaker code would be a permission whose only effect is to let someone see a filename they cannot open |
| download | `file.download` (frozen) |
| upload | `file.upload` (frozen) |
| **attach** | **`file.upload` AND the subject's own write permission**, composed — never a code of its own (§4) |
| **detach** | same composition |
| delete | `file.delete` — **new.** `file.upload` cannot serve: a Member holds `file.upload` conditionally and must not thereby be able to destroy an Owner's file. Upload and destroy are different powers |
| admin/manage storage | `file.manage` — **new.** Quarantine, release, and reconciliation are operator actions over other people's files; folding them into `file.delete` would grant every deleter a moderation power |

## 2. Role matrix

Rows are **added**, never altered, following `B10_RBAC_TENANCY.md`'s precedent. Legend matches B1: **A** allow, **C** conditional, **·** deny.

| Permission | owner | admin | manager | sales | member | viewer | Condition for `C` |
|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| `file.upload` | A | A | A | A | C | · | *(frozen B1 row, unchanged)* member: owning resource in workspace |
| `file.download` | A | A | A | A | A | C | *(frozen B1 row, unchanged)* viewer: owning resource in workspace |
| `file.delete` | A | A | A | C | C | · | sales/member: only a file they themselves uploaded (`uploaded_by_membership_id == actor`) and which has no `active` attachment |
| `file.manage` | A | A | · | · | · | · | — |

`file.delete`'s conditional cells deliberately mirror `deal.close`'s shape from the frozen matrix: a destructive action narrows as rank falls, and the narrowing is an object-scope test, not a softer role check. `file.manage` is Owner/Admin-only for the same reason `B10-D-A016` kept `tax.applicability.manage` high — a moderation power that can suppress another user's evidence should not be routine.

The operator-only fields `declared_content_type`, `detected_content_type`, `provider_etag`, `storage_key`, `purge_state`, and `failure_detail` are visible **only** under `file.manage`. `storage_key` in particular never appears in any non-`file.manage` response, honoring the frozen "Hostinger paths are never exposed directly."

## 3. Tenancy

Every B11 operation follows frozen Doctrine R-1 without exception:

```
file = FileAsset.objects.for_workspace(active_workspace).get(public_id=...)   # required
file = FileAsset.objects.get(public_id=...)                                    # FORBIDDEN
```

`file_assets.workspace_id` is `NOT NULL`. A `FILE-*` that resolves outside the active workspace produces `404 ENTITY_NOT_FOUND`, never `403` and never a validation error — indistinguishable from a file that does not exist, per B1's anti-enumeration rule.

**The six cross-workspace attacks §7 names, and where each is stopped:**

| Attack | Stopped by |
|---|---|
| cross-workspace **metadata lookup** | Doctrine R-1 on `GET /files/{id}` → `404` |
| cross-workspace **download** | Doctrine R-1 on `/download` **and independently** on `/content`; the ticket additionally binds workspace, actor, and file (§5) |
| cross-workspace **finalize** | Doctrine R-1 on `POST /files/{id}/finalize`; the upload ticket is additionally workspace-bound |
| cross-workspace **attachment** | Doctrine R-2: **both** the file and the subject are resolved in the active workspace, and `file.workspace_id == subject.workspace_id` is re-asserted after resolution (`B11_DOMAIN_ATTACHMENT_MODEL.md` §4) |
| cross-workspace **delete** | Doctrine R-1 on `DELETE /files/{id}` → `404` |
| cross-workspace **signed-URL generation** | the ticket is minted only after R-1 succeeds, and carries the resolved `workspace_id`; `/content` re-resolves under the *session's* active workspace and additionally requires the ticket's workspace to match |

`CROSS_TENANT_FILE_ACCESS_GAPS = 0` and `CROSS_TENANT_ATTACHMENT_GAPS = 0` rest on this table. Negative controls `AT-B11TEN-1` … `AT-B11TEN-6`.

**No tenancy decision reads a storage key** (`B11_STORAGE_KEY_MODEL.md` §4). The key prefix is containment, not control.

## 4. Attach and detach are composed, not granted

> **`B11-D-A014` (authorization half).** `AttachFile(file, subject)` requires **all** of:
> 1. `file.upload` in the active workspace;
> 2. the write permission the *subject's own domain* defines for mutating that subject — for `subject_type='message_media'`, that is `message.send` (frozen B1 code, B5-owned semantics);
> 3. `file.workspace_id == subject.workspace_id == active_workspace`;
> 4. `file.lifecycle_state == 'available'`.

This composition is the anti-explosion mechanism and it is also the correct rule. A Viewer holds `file.download` but not `file.upload`, so a Viewer can read an attached file and can never attach one. A Member with `file.upload` but without `message.send` in a given context cannot smuggle content onto a conversation. And no new permission code was minted to say any of it.

`DetachFile` requires the same composition. Detaching is a mutation of the subject's meaning just as much as attaching.

## 5. Download authorization is re-evaluated every time

> **`B11-D-A022`.** Possession of any URL WazLink has ever emitted grants nothing on its own. Every byte response re-runs, in order: session authentication → active-workspace resolution → Doctrine R-1 resolution of the file → `file.download` → `lifecycle_state == 'available'` → ticket validation.

The ticket is the **weakest** of those gates, not the strongest: it exists to make the URL single-use and short-lived, as frozen `B1_AUTHORIZATION_RBAC.md` §4 requires of a `FileAsset` download URL ("signed download URLs are single-use, short-lived, and bound to the resolved workspace"). It is not a bearer credential — an unauthenticated request carrying a perfectly valid ticket is `401 AUTH_REQUIRED`, and a request from a member whose role was downgraded a second ago is `403 PERMISSION_DENIED` even though the ticket is still within its TTL.

A file that has since become `quarantined` or `archived` is refused on the state gate regardless of ticket validity. `PERMANENT_SIGNED_URL_LEAKS = 0` and `DELETE_ATTACHMENT_RACE_GAPS = 0` (download half) rest on this ordering. Negative controls `AT-B11DL-2` … `AT-B11DL-5`.

## 6. System actor

`ExpireUpload`, `PurgeFileObject`, `ReconcileFile` (scheduled path), and `ImportFileFromUrl` run under the frozen `system:*` actor convention B2 established and B7 formalized. A system actor:

- is recorded in the audit trail as the actor, never as a human membership;
- is bound to exactly one workspace per invocation, resolved from the row it is acting on, so a system command is as workspace-scoped as a user command;
- is **not** exempt from state guards. `PurgeFileObject` under a system actor still refuses a non-`archived`, ever-attached file. There is no privileged path that skips a guard because the caller is internal.

`ImportFileFromUrl` additionally carries the `system:messaging` actor supplied by B5's worker, and the resulting `file_assets.uploaded_by_membership_id` is the membership B5 attributes the outbound/inbound message to — so provenance survives even when no human pressed a button.

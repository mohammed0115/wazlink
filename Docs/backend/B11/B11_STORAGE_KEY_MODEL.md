# B11 — Storage Key Model

> Design only. Realizes the frozen Files-row forbidden coupling "**no arbitrary paths**" (`BACKEND_DOMAIN_OWNERSHIP.md` line 27) and the frozen security rule "Hostinger paths are never exposed directly" (`BACKEND_SECURITY_ARCHITECTURE.md`).

## 1. Shape

```
<env>/w/<workspace_uuid>/<yyyy>/<mm>/<file_uuid>
```

| Segment | Source | Notes |
|---|---|---|
| `<env>` | deployment configuration (`prod`, `staging`, …) | honors the frozen "Environments have isolated … storage" rule with a second, in-bucket separation even when isolation is already bucket-level |
| `w` | literal | a fixed namespace segment, so a future non-workspace namespace (e.g. platform artifacts) cannot collide |
| `<workspace_uuid>` | `workspaces.id` (internal UUIDv7) | **not** the `WORK-*` public ID — a leaked key then reveals nothing that appears in any API response |
| `<yyyy>/<mm>` | `file_assets.created_at`, UTC | bounds per-prefix object counts so `list_objects` reconciliation stays paginable |
| `<file_uuid>` | `file_assets.id` (internal UUIDv7) | the whole key is a pure function of two server-generated UUIDs and one timestamp |

**No file extension.** Appending `.pdf` would reintroduce extension-derived content typing at the storage layer, which `B11_FILE_VALIDATION.md` §4 spends its length removing at the application layer.

## 2. The five properties, and how each is obtained

| Requirement (§16) | How it holds |
|---|---|
| **Avoid raw user filename authority** | No segment derives from any client-supplied value. `original_filename` is stored in PostgreSQL as display data and never reaches a key, in any encoding, at any position. |
| **Avoid path traversal** | Structurally impossible: the only variable segments are UUIDs (hex + hyphens) and zero-padded integers. There is no user string to sanitize, so there is no sanitizer to get wrong. Nothing is "escaped"; nothing is escapable. |
| **Avoid predictable sensitive identifiers** | The key contains no email, phone, lead name, business name, invoice number, or public ID. UUIDv7's leading timestamp makes creation *time* inferable from a key that has already leaked — accepted, because the key alone grants no access (§4) and the creation time is already in the file's own DTO. |
| **Avoid collisions** | A UUIDv7 primary key is unique by construction; the frozen `(workspace_id, storage_key)` unique index on `file_assets` is the durable backstop, and a violation is a transactionally retried failure, never a silent overwrite. |
| **Support workspace isolation** | The `w/<workspace_uuid>/` prefix gives per-workspace enumeration, per-workspace lifecycle rules, and a cheap operational blast-radius bound. |
| **Support lifecycle/reconciliation** | The date segments make `list_objects` sweeps bounded and resumable (`B11_RECONCILIATION_MODEL.md` §3, class `R-5`), and the `<file_uuid>` segment lets any discovered object be resolved back to its row — or proved to have none — with one indexed lookup. |

**No secret is embedded.** The key carries no token, signature, HMAC, or credential. It is not a capability; it is an address.

## 3. Allocation and immutability

> **`B11-D-A018`.** `storage_key` is computed and written **once**, inside the `CreateUpload` transaction that inserts the `file_assets` row, and is immutable thereafter — including across every retry, every failure, every reconciliation repair, and every purge attempt.

This is the single property that makes §24's unknown-outcome handling safe. Because the key is fixed before the first byte is written, a retried write always addresses the same object; a retried delete always addresses the same object; and a `stat` after a timeout always asks about the same object. There is no code path anywhere in this pack that allocates a second key for an existing `FileAsset`. Negative controls `AT-B11UNK-1`, `AT-B11UNK-2`.

## 4. The prefix is defence in depth, never the tenancy control

> **`B11-D-A005`.** Tenant isolation is enforced by application authorization — frozen `B1_AUTHORIZATION_RBAC.md` Doctrine R-1 (every tenant-owned resource resolved through a workspace-scoped queryset) and Doctrine R-2 (every referenced object re-resolved in the same scope). **The `w/<workspace_uuid>/` prefix is never consulted to decide access, and no code path parses a storage key to determine tenancy.**

Relying on path naming for tenancy fails in three ways this design refuses to inherit: it moves an authorization decision into a string-parsing routine; it breaks silently the first time a key format changes; and it produces no answer at all for an object whose row is missing. Application authorization has none of those properties. The prefix exists so that an operational mistake is *contained*, not so that a correct decision is *made*.

`CROSS_TENANT_FILE_ACCESS_GAPS = 0` therefore rests on `B11_RBAC_TENANCY.md` §3, not on this document.

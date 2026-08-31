# B2 — CRM List Query Model (`GET /leads`)

> **B2 status:** Read-contract design only. This operation does not exist in frozen B0 and is a controlled additive amendment (`B2-D-B003`).

## 1. What B0 actually says

- `BACKEND_OPENAPI_V1.yaml` exposes `/leads/{id}` (PATCH) and `/leads/{id}/360` (GET). **There is no `/leads` collection.**
- `BACKEND_API_CATALOG.md`: *"Filtering and sorting are supported only for `GET /api/v1/deals` and `GET /api/v1/billing/invoices`."*

The frozen frontend nonetheless ships a complete CRM list with nine filters and six sorts (`Crm.tsx`). This is inventory item 63 and gap **G19**: real, load-bearing product behavior with no contract to carry it. B2 adds the operation and the filtering/sorting allow-list as an explicit amendment; it does not pretend B0 already permitted it.

## 2. Operation

`GET /api/v1/leads` → `200 LeadList` · `operationId: listLeads` · permission `lead.view` · entitlement `crm.core` · errors `401, 403, 404, 500`.

Every parameter below is an **allow-listed named query parameter**. There is no filter-expression language, no `filters=` blob, no client-supplied SQL fragment, and no arbitrary field name — the `filters`/`sort` expression parameters B0 defines for `/deals` are deliberately **not** reused here, because an expression grammar over a cross-domain projection is an injection and performance surface with no product requirement.

## 3. Supported filters (9)

Each traces to a control in `Crm.tsx`.

| Parameter | Type | Authority | Classification | Semantics |
|---|---|---|---|---|
| `owner_ref` | `MEM-*` | CRM column | `CRM_COLUMN` | exact match on `owner_membership_id` |
| `status` | enum(5) | CRM column | `CRM_COLUMN` | exact match; repeatable (OR within the parameter) |
| `priority` | enum(3) | CRM column | `CRM_COLUMN` | exact match; repeatable |
| `source_job_ref` | `JOB-*` | CRM column | `CRM_COLUMN` | exact match on `source_job_id` |
| `tag` | text | CRM relation | `CRM_RELATION` | `EXISTS` on `lead_tags`; repeatable (**AND** across values — narrowing is the useful semantic) |
| `city` | text | Business | `DISCOVERY_JOIN` | exact match on the projected `business_city` |
| `tier` | enum(4) | AI Intelligence | `AI_JOIN` | exact match on the projected `intelligence_tier` |
| `min_score` | integer 0–100 | AI Intelligence | `AI_JOIN` | `intelligence_score >= n`; rows with a NULL score are **excluded**, matching `score !== null && score >= n` |
| `include_archived` | boolean, default `false` | CRM column | `CRM_COLUMN` | when `false`, `archived_at IS NULL` |

Filters combine with **AND** across parameters. An unknown parameter is `400 VALIDATION_ERROR` (Doctrine R-4: unknown fields are rejected, never ignored). An unknown *value* for an enum filter is also `400`, never an empty result — a silent empty page is indistinguishable from "no data" and hides client bugs.

**Not supported as filters, deliberately:** `contacted` (it is a `status` value — use `status=contacted`), `has_open_tasks`, `overdue`, `created_between`, `last_activity_between`, free-text business category. None has a control in the frozen UI; each is recorded in `B2-D-C013` rather than invented.

## 4. Search (`q`)

| Aspect | Specification |
|---|---|
| Fields | Business `name`, Business `category`, Business `city`, and the Lead `public_id` |
| Match | case-insensitive, accent- and diacritic-insensitive **substring** match; Arabic text is NFC-normalized before comparison |
| Length | 1–120 chars; longer is `400 VALIDATION_ERROR` |
| Combination | ANDed with every active filter |
| Not searched | Contact name, phone, or email; Note bodies; message content |

The frozen implementation is `text.includes(filters.search)` over `${business.name} ${business.category} ${business.city} ${lead.id}` — a raw, case- and diacritic-**sensitive** substring test. B2 keeps the field set exactly and fixes the matching, because Arabic diacritic-sensitivity makes the frozen search miss correct results, and case-sensitivity makes `LEAD-1042` unfindable as `lead-1042`.

**Contact details are excluded from search on purpose.** Searching by phone or email would make `GET /leads` a reverse-lookup oracle: a caller could confirm whether a given phone number exists in the workspace without ever being able to read the contact. That is a privacy decision, recorded as `B2-D-C014`, not an omission.

## 5. Sorting (6) and cursor stability

| `sort` | Ordering key |
|---|---|
| `updated` *(default)* | `updated_at DESC, public_id DESC` |
| `created` | `converted_at ASC, public_id ASC` — ascending, matching the frozen `"الأقدم إنشاءً"` |
| `score` | `intelligence_score DESC NULLS LAST, public_id DESC` |
| `name` | `business_name ASC` (Arabic collation), `public_id ASC` |
| `priority` | `priority_rank DESC, public_id DESC` where `high=3, medium=2, low=1` |
| `last_activity` | `last_activity_at DESC, public_id DESC` |

**Every sort key is made total by appending `public_id`.** This is not cosmetic. All six frozen sorts are unstable (inventory item 66): `LEAD-1042` and `LEAD-1137` share `priority = 'high'`, so a `priority` sort may order them differently between two requests, and a cursor built on such an order can skip or repeat rows. A total key makes the order reproducible and the cursor safe.

**Pagination** is B0 cursor pagination with the frozen `PageInfo` (`next_cursor` required and nullable, `has_next`). The cursor is an opaque base64 encoding of the full ordering tuple plus the sort identifier. Changing `sort` or any filter **invalidates** the cursor: a cursor presented against a different sort or filter set is `400 VALIDATION_ERROR`, never silently reinterpreted. `limit` follows the frozen `Limit` parameter (1–100, default 25).

**Offset pagination is not offered.** With rows arriving and `last_activity_at` moving under the reader, offsets skip and duplicate.

## 6. The cross-domain problem, and the read model

Four of the nine filters and two of the six sorts read data CRM does not own: `city` and `name` from Business, `tier` and `min_score` from AI Intelligence. B0 forbids ORM imports across bounded contexts in **domain** code, and `B2_LEAD_AGGREGATE.md` forbids denormalizing them onto `leads` (they would become a second authority and go stale on every re-crawl and re-score).

**Resolution: a CRM-owned read model, `crm_lead_list_projection`.**

| Column | Source | Refreshed by |
|---|---|---|
| `lead_id`, `workspace_id` | `leads` | the CRM command that changed the Lead, in-transaction |
| `business_name`, `business_category`, `business_city` | `businesses` | `BusinessDiscovered`, `BusinessUpserted`, `BusinessMerged` |
| `intelligence_score`, `intelligence_tier` | Intelligence | `LeadIntelligenceCompleted` |
| `owner_membership_id`, `status`, `priority`, `source_job_id`, `last_activity_at`, `next_activity_at`, `updated_at`, `converted_at`, `archived_at` | `leads` | in-transaction with the owning command |

**Refresh semantics — stated, because §24 of the brief requires it.**
- CRM-owned columns are updated **synchronously, in the same transaction** as the command. The list is never stale about a status, priority, owner, tag, or activity date.
- Cross-domain columns are updated by **idempotent outbox consumers** keyed by `(event_id)`. They are eventually consistent, with a target lag under one second.
- The projection is **never authoritative**. It is rebuildable from scratch at any time from `leads`, `businesses`, and the Intelligence read model, and a nightly reconciliation job asserts equality and repairs drift.
- `GET /leads/{id}` and `GET /leads/{id}/360` read **live** from the owning domains, never from this projection. A user who opens a Lead always sees current truth; only the list may briefly show a stale city or score.
- The projection **never** carries Contact PII, note bodies, or message content.

**Phase-1 implementation latitude.** All domains share one PostgreSQL instance, so an implementation may satisfy the projection with a view or a same-database join instead of materializing rows — provided the join is expressed at the read-model boundary and never as a cross-context ORM import in domain code. The contract above is what must hold; the storage is the implementer's call.

**A future full-text/search index** (`B2-D-C015`) would replace §4's substring match. It is out of Phase-1 scope: the frozen product searches a few hundred rows client-side, and introducing a search engine would add an infrastructure dependency, a reindex-consistency problem, and a second place where CRM data lives.

## 7. `LeadListItem`

The frozen `Lead` schema carries none of the display fields the list renders, and it is `additionalProperties: false`. Rather than amend it, `GET /leads` returns a **new** `LeadListItem` DTO. The frozen `Lead` schema is therefore untouched.

`public_id` · `business_ref` · `business_name` · `business_category` · `business_city` · `owner_ref` (`MEM-*`, nullable-safe) · `owner_display_name` · `status` · `priority` · `tags[]` · `source_job_ref` · `source_job_name` · `intelligence_score` (nullable) · `intelligence_tier` (nullable) · `last_activity_at` · `next_activity_at` (nullable) · `next_task_ref` (nullable) · `next_task_title` (nullable) · `converted_at` · `updated_at` · `archived_at` (nullable) · `owner_inactive` (boolean) · `version`.

`next_task_ref`/`next_task_title` exist because the frozen list renders `"{title} · {dueAt}"` in its "المتابعة التالية" column, and resolving one task per row client-side would be N+1. `owner_inactive` surfaces a Lead whose owner Membership is no longer `active` (`B2_AUTHORIZATION_ENTITLEMENT.md` §3) so a manager can find and reassign them — the list is the only place that need is visible.

## 8. Summary counters

The frozen summary tiles (`total, new, contacted, qualified, highPriority, todayTasks`) are **not** part of `LeadList`. They are workspace-wide aggregates independent of the current filter and page, and folding them into a paginated response would make them look filter-scoped. They belong to `GET /api/v1/dashboard/overview`, which is a **frozen B0 operation** already typed as a read-only aggregate. B2 records the six counters as an input to that operation's projection (`B2-D-B007`) rather than inventing a seventh CRM endpoint.

# B3 — Controlled Amendment Register

> **B3 edits no frozen B0, B1, or B2 artifact.** Every change B3 requires to a frozen file is recorded here, with the current frozen behavior stated verbatim and the target stated as a target. **No hidden contract drift.**

B1 demonstrated why this register is necessary — an earlier revision described a target response as though the frozen contract already carried it, and an independent audit classified that as a Major finding. B3 therefore states, for every item, *what the frozen file says now*, *what B3 targets*, and *that B3 has applied nothing*.

## 1. The bundle — 6 items across 3 frozen artifacts

| # | ID | Frozen artifact | Current frozen behavior | B3 target | Timing |
|---:|---|---|---|---|---|
| 1 | `B3-D-B001` | `BACKEND_OPENAPI_V1.yaml` — `DiscoveryJobCreate` | `{ query: string (required), provider_source: string }`, `additionalProperties: false`, `required: [query]` | add `keywords: [string]` (1..10, **required**), `locations: [string]` (1..10, **required**), `filters: DiscoveryFilters`, `result_limit: integer` ∈ {500,1000,2000}. **`query` is retained as a deprecated single-combination alias**: a request carrying only `query` is read as `keywords=[query]` | before implementation |
| 2 | `B3-D-B001` | `BACKEND_OPENAPI_V1.yaml` — `DiscoveryJob` | properties `public_id, status, query, provider_source, counts, started_at, completed_at, error_code`; `required: [public_id, status, query]` | **purely additive**: `keywords`, `locations`, `filters`, `result_limit`, `combination_count`, `progress`, `completion_kind`, `failed_query_count`, `query_executions`, `created_at`, `version`, `name`; and give the existing `counts` object the shape `{found, duplicate, deduplicated}`. **No existing property is removed or retyped; `required` is unchanged** | before implementation |
| 3 | `B3-D-B001` | `BACKEND_OPENAPI_V1.yaml` — `DiscoveryResult` | properties `public_id, job_ref, business_ref, name, source`; `required: [public_id, job_ref, name]` | **purely additive**: `discovered_at`, `keyword`, `location`, `category`, `city`, `phone`, `website`, `email`, `instagram`, `rating`, `review_count`, `whatsapp_available`, `data_quality_level`. `required` unchanged | before implementation |
| 4 | `B3-D-B001` | `BACKEND_OPENAPI_V1.yaml` + `BACKEND_API_CATALOG.md` | three Discovery operations: `POST /discovery/jobs` (202), `GET /discovery/jobs/{id}`, `GET /discovery/jobs/{id}/results` | add **five** additive operations — `GET /discovery/jobs`, `POST /discovery/jobs/{id}/retry`, `POST /discovery/jobs/{id}/cancel`, `GET /discovery/sources`, `GET /businesses/{id}` — and add `422` to `createDiscoveryJob` and `409` to `listDiscoveryResults`. **No existing path, method, request DTO, response body, or status is removed** | before implementation |
| 5 | `B3-D-B003` | `BACKEND_API_CATALOG.md` | *"Filtering and sorting are supported only for `GET /api/v1/deals` and `GET /api/v1/billing/invoices`."* | extend the allow-list with `GET /api/v1/discovery/jobs`, using the exact optional `filters` and `sort` parameters and the closed key/value sets of `B3_PAGINATION_MODEL.md` §5. **This is the same technique B2 used** for `GET /leads` and `GET /tasks` (`B2-D-B009`) | before implementation |
| 6 | `B3-D-B002` | `BACKEND_DATA_MODEL.md` | Discovery row: `discovery_jobs, discovery_queries, discovery_results, businesses, business_identities` with `workspace/provider_external_id unique; job/status/created index` | add `discovery_query_executions, provider_page_ingestions, business_match_candidates, business_merges, discovery_sources`; and **make the uniqueness constraint precise** as `(workspace_id, provider, provider_external_id)` on `business_identities`. The `job/status/created` index is unchanged | before implementation |
| 7 | `B3-D-B004`, `B3-D-B005` | `BACKEND_COMMAND_EVENT_CATALOG.md` | commands include `CreateDiscoveryJob`, `RetryDiscoveryJob`; events include `DiscoveryJobQueued, DiscoveryJobCompleted, DiscoveryJobFailed, BusinessDiscovered, BusinessMerged` | add the command **`CancelDiscoveryJob`** and the events **`DiscoveryJobCancelled`** and **`BusinessRediscovered`**. **The event envelope sentence is unchanged and B3 adds no envelope field** | before implementation |

Items 1–4 share the ID `B3-D-B001` because they are one OpenAPI change set; the register lists them separately because each touches a distinct schema or surface. Counting by **frozen artifact and change set**, the bundle is **6 items across 3 artifacts**: `BACKEND_OPENAPI_V1.yaml` (items 1–4), `BACKEND_API_CATALOG.md` (items 4–5), `BACKEND_DATA_MODEL.md` (item 6), `BACKEND_COMMAND_EVENT_CATALOG.md` (item 7).

## 2. The one item that is not purely additive, stated plainly

**Item 1 replaces `DiscoveryJobCreate.query` as the primary input.**

Frozen `query: string` is a **single** search string. The frozen frontend's central capability is K keywords × L locations in one job — the form builds two chip arrays, previews their cross product, and states it in help text (`Discovery.tsx:264-294`, `:269`; `data.js:449`). **A single string cannot express it.** No additive field could preserve `query` as the primary input while also carrying two arrays whose product defines the job.

The change is nevertheless made **additive in effect**:

- `query` is **retained**, not removed, so an existing client continues to parse the schema;
- a request carrying only `query` is interpreted as `keywords = [query]`, requiring `locations` — the single-combination case still works;
- `DiscoveryJob.query` is **kept and populated** with the derived display name (`data.js:465`), so the frozen response property never becomes null or meaningless;
- the frozen `required: [query]` on the response is therefore still satisfiable.

This is the one item an approver should scrutinize, and it is stated here rather than buried in a schema diff.

## 3. What B3 does **not** amend

Stated explicitly, because the absence of a change is as load-bearing as its presence.

- **`BACKEND_PUBLIC_ID_REGISTRY.md`** — no new prefix, no reclassification. `JOB-`, `RES-`, `BUS-` are already section A; `SRC-` stays a section B contract string. `PUBLIC_ID_COLLISIONS = 0`.
- **`BACKEND_ERROR_CATALOG.md`** — no new code. `ERROR_NEW_COUNT = 0`.
- **`BACKEND_RETRY_POLICY.md`** — no row, no number, no class. B3 classifies into it (`B3_RETRY_FAILURE_MODEL.md` §1).
- **`BACKEND_IDEMPOTENCY_STANDARD.md`** — unchanged; it already names "Discovery retry".
- **`BACKEND_RATE_LIMIT_POLICY.md`** — unchanged; it already sets "Discovery submit — 10/hour/workspace".
- **`BACKEND_API_STANDARD.md`** — no transport rule changes. The `filters`/`sort` extension is a **catalog** allow-list change (item 5), not a standard change.
- **`BACKEND_ARCHITECTURE_DECISIONS.md`** — no new ADR, no ADR modified. B3 introduces no decision at ADR scope.
- **`BACKEND_DOMAIN_OWNERSHIP.md`** — unchanged. B3 *implements* the Discovery and Business rows exactly as written, including both forbidden couplings.
- **`BACKEND_PRIVACY_AND_DATA_HANDLING.md`** — unchanged. B3 adopts its classification and its proposed 30-day raw retention.
- **The frozen `Business` schema** — **unchanged**. Multi-identity provenance is carried inside the already-unconstrained `provenance` object (`B3_NORMALIZATION_DATA_QUALITY.md` §3), so no amendment is needed.
- **`ConvertBusinessRequest`, `EntityRef`, `PageInfo`, `ErrorEnvelope`, `DiscoveryResultList`** — unchanged.
- **`POST /businesses/{id}/convert-to-lead`** — unchanged. B2 owns it.
- **Every B1 artifact** — no permission code, no matrix cell, no role, no pipeline step. `B1_DRIFT = 0`.
- **Every B2 artifact** — no table, no contract, no decision, no amendment, no acceptance test. `B2_DRIFT = 0`.
- **Any Intelligence, Messaging, Pipeline, Revenue, Attribution, Automation, Billing, or Tax contract.**

## 4. Amendment properties

Every item satisfies all four:

1. **The decision is already made.** No item leaves an implementation agent a choice; §1 states the exact target shape.
2. **It is additive**, with the single stated exception of item 1's primary-input change — which retains `query`, defines its interpretation, and removes nothing.
3. **It is traceable.** Each maps to a Class B decision, to the frozen frontend behavior that requires it, and to acceptance tests.
4. **It is gated.** Nothing may be implemented against these targets until the bundle is approved and applied.

## 5. Blocking rules until the bundle is applied

- **No implementation may serve `POST /discovery/jobs` with a `keywords`/`locations` body**, add a Discovery route, add `filters`/`sort` to a Discovery collection, create any of the five additive tables, alter the `business_identities` key, or emit `DiscoveryJobCancelled` or `BusinessRediscovered`.
- **No frozen file may be edited** to match a target in §1.
- The bundle is approved **as a whole**. Partial application would leave, for example, the additive tables without the API that reads them.

## 6. Dependency ordering

B3's bundle **depends on no other bundle** and is depended on by none.

- It touches no artifact B2's 11 items touch, so the two may be approved in either order or together.
- It touches no B1 artifact, so B1's bundle is irrelevant to it.
- Item 6 refines the Discovery row of `BACKEND_DATA_MODEL.md`; B2's item 2 refines the CRM row of the same file. **Different rows of the same table** — they can be applied independently, and neither reads the other's target.

## 7. Contradiction check

No item in §1 contradicts a frozen statement:

| Potential contradiction | Resolution |
|---|---|
| item 6 changes `workspace/provider_external_id unique` | **precision, not reversal.** The frozen intent — one identity maps to one Business — is preserved; the key is corrected to express it across providers. The same technique as B2's item 2 |
| item 5 extends a "supported only for" list | an extension of an allow-list, not a removal of a restriction. B2 set the precedent with `B2-D-B009` |
| item 1 changes a required request field | §2 states it plainly, retains `query`, and defines its interpretation |
| item 7 adds a command and two events | frozen B0's lists are enumerations of what exists, not closed sets — B2 added consumed contracts the same way |

**No contradictory amendment exists**, so no item is a closure blocker on that ground.

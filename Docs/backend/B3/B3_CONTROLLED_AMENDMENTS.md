# B3 — Controlled Amendment Register

> **B3 edits no frozen B0, B1, or B2 artifact.** Every change B3 requires to a frozen file is recorded here, with the current frozen behavior stated verbatim and the target stated as a target. **No hidden contract drift.**

B1 demonstrated why this register is necessary — an earlier revision described a target response as though the frozen contract already carried it, and an independent audit classified that as a Major finding. B3 therefore states, for every item, *what the frozen file says now*, *what B3 targets*, and *that B3 has applied nothing*.

## 1. The bundle — **7 operations, 4 decisions, across 4 frozen artifacts**

Three counting units, stated explicitly because a single word ("items") previously conflated them:

- **`AMENDMENT_OPERATION_COUNT = 7`** — the discrete edits below, one per row, each touching one distinct schema, surface, or file-region.
- **`AMENDMENT_DECISION_COUNT = 4`** — the distinct Class B decision IDs governing those operations: `B3-D-B001` (rows 1–4, the OpenAPI change set), `B3-D-B003` (row 5, the API catalog allow-list), `B3-D-B002` (row 6, the data model), `B3-D-B005` (row 7, the command and both additive events — corrected in B3-FIX.1 from a `B3-D-B004`/`B3-D-B005` dual citation that collided with `B3-D-B004`'s Class B meaning elsewhere in `B3_DECISION_REGISTER.md`; see that document's §3).
- **`AMENDMENT_TARGET_ARTIFACT_COUNT = 4`** — the distinct frozen files touched: `BACKEND_OPENAPI_V1.yaml`, `BACKEND_API_CATALOG.md`, `BACKEND_DATA_MODEL.md`, `BACKEND_COMMAND_EVENT_CATALOG.md`. **This corrects a prior miscount of 3**, which treated row 4 (which touches both `BACKEND_OPENAPI_V1.yaml` *and* `BACKEND_API_CATALOG.md`) as if it touched only the former, silently dropping `BACKEND_API_CATALOG.md` from the artifact tally even though rows 4 and 5 both name it explicitly.

| # | ID | Frozen artifact | Current frozen behavior | B3 target | Timing |
|---:|---|---|---|---|---|
| 1 | `B3-D-B001` | `BACKEND_OPENAPI_V1.yaml` — `DiscoveryJobCreate` | `{ query: string (required), provider_source: string }`, `additionalProperties: false`, `required: [query]` | add `keywords: [string]` (1..10, **required unless `query` is supplied alone**), `locations: [string]` (1..10, **required unless `query` is supplied alone**), `filters: DiscoveryFilters`, `result_limit: integer` ∈ {500,1000,2000}. Target `required: [keywords, locations]` — `query` moves out of `required` and is retained as a deprecated single-combination compatibility alias with the deterministic resolution rules of `B3_API_DTO_CONTRACTS.md` §3.1.2. **`provider_source` requiredness is unchanged from frozen** — it was never in `required: [query]`, and B3 does not add it; omission is resolved per `B3_API_DTO_CONTRACTS.md` §3.1.3 | before implementation |
| 2 | `B3-D-B001` | `BACKEND_OPENAPI_V1.yaml` — `DiscoveryJob` | properties `public_id, status, query, provider_source, counts, started_at, completed_at, error_code`; `required: [public_id, status, query]` | **purely additive**: `keywords`, `locations`, `filters`, `result_limit`, `combination_count`, `progress`, `completion_kind`, `failed_query_count`, `query_executions`, `created_at`, `version`, `name`; and give the existing `counts` object the shape `{found, duplicate, deduplicated}`. **No existing property is removed or retyped; `required` is unchanged** | before implementation |
| 3 | `B3-D-B001` | `BACKEND_OPENAPI_V1.yaml` — `DiscoveryResult` | properties `public_id, job_ref, business_ref, name, source`; `required: [public_id, job_ref, name]` | **purely additive**: `discovered_at`, `keyword`, `location`, `category`, `city`, `phone`, `website`, `email`, `instagram`, `rating`, `review_count`, `whatsapp_available`, `data_quality_level`. `required` unchanged | before implementation |
| 4 | `B3-D-B001` | `BACKEND_OPENAPI_V1.yaml` + `BACKEND_API_CATALOG.md` | three Discovery operations: `POST /discovery/jobs` (202), `GET /discovery/jobs/{id}`, `GET /discovery/jobs/{id}/results` | add **five** additive operations — `GET /discovery/jobs`, `POST /discovery/jobs/{id}/retry`, `POST /discovery/jobs/{id}/cancel`, `GET /discovery/sources`, `GET /businesses/{id}` — and add `422` to `createDiscoveryJob` and `409` to `listDiscoveryResults`. **No existing path, method, request DTO, response body, or status is removed** | before implementation |
| 5 | `B3-D-B003` | `BACKEND_API_CATALOG.md` | *"Filtering and sorting are supported only for `GET /api/v1/deals` and `GET /api/v1/billing/invoices`."* — **applied against the POST-B2 effective text** (§6), which already reads *"…, `GET /api/v1/leads`, and `GET /api/v1/tasks`"* once B2's `B2-D-B003` is applied | extend the allow-list **further**, to also include `GET /api/v1/discovery/jobs`, using the exact optional `filters` and `sort` parameters and the closed key/value sets of `B3_PAGINATION_MODEL.md` §5, **preserving every name B2 added**. **This is the same technique B2 used** for `GET /leads` and `GET /tasks` (`B2-D-B003` — corrected in B3-FIX.1; a prior revision mis-cited `B2-D-B009`, which is B2's unrelated timeline-route item) | before implementation, **and only after, or together with, B2's item 3** (§6) |
| 6 | `B3-D-B002` | `BACKEND_DATA_MODEL.md` | Discovery row: `discovery_jobs, discovery_queries, discovery_results, businesses, business_identities` with `workspace/provider_external_id unique; job/status/created index` | add `discovery_query_executions, provider_page_ingestions, business_match_candidates, business_merges, discovery_sources`; and **make the uniqueness constraint precise** as `(workspace_id, provider, provider_external_id)` on `business_identities`. The `job/status/created` index is unchanged | before implementation |
| 7 | `B3-D-B005` | `BACKEND_COMMAND_EVENT_CATALOG.md` | commands include `CreateDiscoveryJob`, `RetryDiscoveryJob`; events include `DiscoveryJobQueued, DiscoveryJobCompleted, DiscoveryJobFailed, BusinessDiscovered, BusinessMerged` | add the command **`CancelDiscoveryJob`** and the events **`DiscoveryJobCancelled`** and **`BusinessRediscovered`**. **The event envelope sentence is unchanged and B3 adds no envelope field** | before implementation |

Items 1–4 share the ID `B3-D-B001` because they are one OpenAPI change set; the register lists them separately because each touches a distinct schema or surface. §1's header states the mechanically derived counts; **item 4 and item 5 both name `BACKEND_API_CATALOG.md`**, and item 4 additionally names `BACKEND_OPENAPI_V1.yaml` — the artifact tally counts each frozen file once regardless of how many rows touch it, which is why the artifact count (4) is lower than the operation count (7) but higher than the prior, incorrect claim of 3.

## 2. The one item that is not purely additive, stated plainly

**Item 1 replaces `DiscoveryJobCreate.query` as the primary input, and changes the request schema's `required` set.**

Frozen `query: string` is a **single** search string, and frozen `DiscoveryJobCreate.required = [query]`. The frozen frontend's central capability is K keywords × L locations in one job — the form builds two chip arrays, previews their cross product, and states it in help text (`Discovery.tsx:264-294`, `:269`; `data.js:449`). **A single string cannot express it.** No additive field could preserve `query` as the primary input while also carrying two arrays whose product defines the job.

**Stated plainly, not softened: this is a non-additive, compatibility-breaking-at-schema-requiredness change.** Target `required = [keywords, locations]`. A request conformant to the frozen schema (`{query: "..."}`) is no longer the *only* accepted shape once this amendment applies — `query`-only is now the **legacy** path, not the canonical one. The change is nevertheless made **additive in effect**, by deterministic construction rather than by assertion:

- `query` is **retained** in the schema, not removed, so an existing client continues to parse the response and may still submit `query`-only requests;
- a request carrying only `query` is interpreted as `keywords = [query]`, requiring `locations` — the single-combination case still works, with the full resolution table in `B3_API_DTO_CONTRACTS.md` §3.1.2 covering every input combination (canonical arrays only, legacy `query` only, both present — rejected as a conflict rather than silently prioritized, and every empty/partial case);
- `DiscoveryJob.query` is **kept and populated**, with the response-side compatibility role clarified in `B3_API_DTO_CONTRACTS.md` §4.1 (it is a display-only compatibility projection, never a second execution-input source), so the frozen response property never becomes null or meaningless;
- the frozen `required: [public_id, status, query]` on the response is therefore still satisfiable;
- `provider_source` is **not** made required by this or any other item — it was never in frozen `required: [query]`, B3 does not add it, and its omission is resolved deterministically, never guessed (`B3_API_DTO_CONTRACTS.md` §3.1.3).

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
2. **Each is classified honestly** — additive, a compatible refinement, or non-additive — per §9. No item is labeled additive if it removes a required field, changes requiredness, changes semantic ownership, or could revert an already-approved amendment from another bundle.
3. **It is traceable.** Each maps to a Class B decision, to the frozen frontend behavior that requires it, and to acceptance tests.
4. **It is gated.** Nothing may be implemented against these targets until the bundle is approved and applied, **in the composition order of §6**.

## 5. Blocking rules until the bundle is applied

- **No implementation may serve `POST /discovery/jobs` with a `keywords`/`locations` body**, add a Discovery route, add `filters`/`sort` to a Discovery collection, create any of the five additive tables, alter the `business_identities` key, or emit `DiscoveryJobCancelled` or `BusinessRediscovered`.
- **No frozen file may be edited** to match a target in §1.
- The bundle is approved **as a whole**. Partial application would leave, for example, the additive tables without the API that reads them.

## 6. Amendment composition — B3 is **not** independent of B2 on every artifact

**A prior revision of this document claimed B3's bundle "touches no artifact B2's 11 items touch" and "may be approved in either order or together" with B2's bundle, without qualification. That claim is withdrawn — it was false for `BACKEND_API_CATALOG.md`.** B2's item 3 (`B2-D-B003`) and B3's item 5 (`B3-D-B003`) amend the **same frozen sentence** in `BACKEND_API_CATALOG.md` — the "Filtering and sorting are supported only for…" allow-list. Two amendments to the same sentence are not independent by construction: applying one, then the other, is order-sensitive unless the second is explicitly written against the *result* of the first.

**Canonical amendment composition order, binding on every controlled-amendment bundle in this repository, not only B3's:**

```
1. frozen B0 baseline
2. approved/frozen B1 effects where relevant
3. approved/frozen B2 controlled amendments, applied to their B0 targets
4. B3 controlled amendments, applied to the POST-B2 effective contract
```

**B3 must never apply a replacement against stale pre-B2 text once B2 has amended the same target.** Item 5 above is written to this rule explicitly: its "current frozen behavior" cell states the POST-B2 effective sentence (with `GET /leads` and `GET /tasks` already present), and its target is phrased as "extend the allow-list **further**" — an operation defined relative to B2's result, not relative to the pre-B2 frozen byte content of `BACKEND_API_CATALOG.md`.

### 6.1 Overlapping-artifact composition matrix

Every frozen artifact either bundle touches:

| Artifact | Frozen B0 state | Applicable B2 amendment | Post-B2 effective state | B3 amendment | Final effective state | Conflict risk | Deterministic application rule |
|---|---|---|---|---|---|---|---|
| `BACKEND_OPENAPI_V1.yaml` | `DiscoveryJobCreate`/`Job`/`Result`/3 Discovery operations exactly as frozen | none — B2's 11 items touch CRM schemas (`Lead`, `Deal`, `Task`, …), not Discovery schemas | unchanged from frozen for every Discovery schema | item 1–4 (`B3-D-B001`) | B3's target shapes, §1 rows 1–4 | **none** — disjoint schema regions within one file | apply B3's item 1–4 directly; no ordering dependency on B2 |
| `BACKEND_API_CATALOG.md` | *"Filtering and sorting are supported only for `GET /api/v1/deals` and `GET /api/v1/billing/invoices`."* + the 3 frozen Discovery operations | **B2 item 3** (`B2-D-B003`): extends the allow-list sentence to add `GET /leads`, `GET /tasks`; adds 25 CRM operations | *"…supported only for `GET /api/v1/deals`, `GET /api/v1/billing/invoices`, `GET /api/v1/leads`, and `GET /api/v1/tasks`."* + CRM's 25 additive operations present | item 4 (5 additive Discovery operations, `422`/`409` additions) + item 5 (extend the allow-list with `GET /api/v1/discovery/jobs`) | *"…supported only for `GET /api/v1/deals`, `GET /api/v1/billing/invoices`, `GET /api/v1/leads`, `GET /api/v1/tasks`, and `GET /api/v1/discovery/jobs`."* + CRM's 25 + Discovery's 5 additive operations, **all present** | **real** — a B3 amendment written against pre-B2 text would produce a sentence naming only `deals`, `billing/invoices`, and `discovery/jobs`, **silently reverting B2's `leads`/`tasks` addition** | apply B2's item 3 first (or confirm it is already the effective baseline), **then** apply B3's items 4–5 as an extension of that result, never as a replacement of the pre-B2 sentence |
| `BACKEND_DATA_MODEL.md` | Discovery row and CRM row, each independent | B2's item 2: refines the **CRM row**'s columns/constraints | CRM row refined; Discovery row unchanged | item 6 (`B3-D-B002`): refines the **Discovery row** — additive tables, precise `business_identities` key | both rows refined, **each independently correct** | **none** — disjoint rows of the same table-inventory list; neither amendment's target text overlaps the other's | either order, or together; no shared sentence exists to collide on |
| `BACKEND_COMMAND_EVENT_CATALOG.md` | commands/events enumerated, including the frozen sentence quoted verbatim by both packages | none — B2's 11 items do not touch this file | unchanged from frozen | item 7 (`B3-D-B005`): adds `CancelDiscoveryJob`, `DiscoveryJobCancelled`, `BusinessRediscovered` | B2's frozen quote remains correct (B2 quotes but does not amend); B3's three additions present | **none** | apply B3's item 7 directly |

**Only `BACKEND_API_CATALOG.md` carries real conflict risk**, and only because it is the one frozen file both packages amend with a **textual extension of the same sentence** rather than disjoint rows or disjoint schema fields. Every other shared or adjacent artifact is either untouched by one side or refines a disjoint region, which is why the prior "no artifact overlap, any order" claim was wrong specifically for the catalog and not for the data model — §1's old contradiction-check row for item 6 (below, §7) was correct all along; only the sweeping independence claim in this section was false.

### 6.2 What this changes about approval and ordering

- B3's bundle is **not** unconditionally order-free relative to B2's. For every artifact except `BACKEND_API_CATALOG.md`, either order or simultaneous approval remains correct (§6.1).
- For `BACKEND_API_CATALOG.md` specifically: **B2's item 3 must be the baseline B3's items 4–5 are written against.** Since B2 is already closed, frozen, and published, this is satisfied by construction as long as no future B3 revision re-derives its target text from the raw pre-B2 frozen file instead of from `B2_CONTROLLED_AMENDMENTS.md`'s stated target — which is exactly the error §1 item 5 and §6.1 now guard against explicitly.
- Item 6 (data model) remains genuinely order-independent of B2's item 2, as originally stated — different rows, no shared sentence.
- B3's bundle still touches no B1 artifact.

## 7. Contradiction check

No item in §1 contradicts a frozen statement:

| Potential contradiction | Resolution |
|---|---|
| item 6 changes `workspace/provider_external_id unique` | **precision, not reversal.** The frozen intent — one identity maps to one Business — is preserved; the key is corrected to express it across providers. The same technique as B2's item 2 |
| item 5 extends a "supported only for" list | an extension of an allow-list, not a removal of a restriction, **applied against the POST-B2 effective text so B2's own extension is preserved rather than reverted** (§6.1). B2 set the allow-list-extension precedent with `B2-D-B003` |
| item 1 changes a required request field | §2 states it plainly as non-additive at schema-requiredness, retains `query`, and defines its interpretation deterministically (`B3_API_DTO_CONTRACTS.md` §3.1.2) |
| item 7 adds a command and two events | frozen B0's lists are enumerations of what exists, not closed sets — B2 added consumed contracts the same way |

**No contradictory amendment exists**, so no item is a closure blocker on that ground.

## 8. Amendment classification — every item, honestly labeled

| # | Item | Classification | Why not a stronger label |
|---:|---|---|---|
| 1 | `DiscoveryJobCreate` — `keywords`/`locations`/`filters`/`result_limit` added, `query` demoted, `required` changed | **NON_ADDITIVE_CONTROLLED_CHANGE** | changes schema `required` from `[query]` to `[keywords, locations]` — a requiredness change, not an additive one, even though behavior is additive-in-effect (§2) |
| 2 | `DiscoveryJob` — 12 additive response fields, `counts` shaped | **ADDITIVE** | no existing property removed or retyped; `required` unchanged |
| 3 | `DiscoveryResult` — 13 additive response fields | **ADDITIVE** | same |
| 4 | 5 additive operations + `422`/`409` additions | **ADDITIVE** | no existing path, method, request DTO, response body, or status removed |
| 5 | `BACKEND_API_CATALOG.md` allow-list extension | **COMPATIBLE_REFINEMENT** | an allow-list grows, which is additive in shape, but is classified one notch more carefully than plain ADDITIVE because it is order-sensitive against B2's overlapping amendment (§6) — the *operation* is additive, the *application* is not order-free |
| 6 | `business_identities` uniqueness precision + 5 additive tables | **COMPATIBLE_REFINEMENT** for the key (precision, not reversal — §7); **ADDITIVE** for the 5 new tables |
| 7 | `CancelDiscoveryJob` command + 2 additive events | **ADDITIVE** | frozen B0's command/event lists are enumerations, not closed sets |

`UNDECLARED_NON_ADDITIVE_AMENDMENTS = 0` — item 1 is the one non-additive change in the bundle, and it was already stated as such in §2 before this classification pass; this section makes the label mechanical rather than prose-only. `AMENDMENT_CLASSIFICATION_DRIFT = 0` — no item's classification here disagrees with its treatment in §1, §2, or §7.

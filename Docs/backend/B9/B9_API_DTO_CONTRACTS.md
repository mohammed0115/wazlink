# B9 — API / DTO Contracts

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.

## 0. Inherited conventions

Frozen B0 governs the envelope, error shape, pagination and idempotency header. B9 introduces **no new envelope, no new error shape, and no new pagination model** — only new `code` values inside the frozen taxonomy (`B9_FAILURE_CATALOG.md`).

- Error envelope: `{"error":{"code","message","details","request_id"}}`
- Pagination: cursor-based, frozen `PageInfo` (`next_cursor`, `has_next`)
- Idempotency: `Idempotency-Key` header on unsafe commands; same key + different body ⇒ `409 IDEMPOTENCY_CONFLICT`
- Auth: session + CSRF (ADR-009); workspace scope from the session, **never** from a request field
- Every operation declares the reusable `500 InternalError`

Frozen `BACKEND_API_CATALOG.md` already registers `POST /api/v1/revenue-events` → `createRevenueEvent`, and frozen `BACKEND_OPENAPI_V1.yaml` already registers `GET /attribution` → `getAttribution`. **Both are reused at their frozen paths, operationIds, request bodies and success shapes.** Two changes are made to them and neither is silent:

| Frozen operation | What B9 changes | Registered as |
|---|---|---|
| `createRevenueEvent` | response set gains `404` and `422` | `B9-AM-011` (ADDITIVE) |
| `getAttribution` | response set gains `422`; **four *optional* query parameters** are added to a frozen `"parameters": []` | `B9-AM-011` (ADDITIVE), `B9-AM-012` (ADDITIVE) |

Neither operation's request **body**, path, `operationId` or `200` shape changes, and **no request that was valid against the frozen contract becomes invalid** — the parameterless `GET /attribution` remains valid and is the default case (§3a).

## 1. Operations

| # | Method | Path | operationId | Permission | Request | Response | Idem | Origin |
|---|---|---|---|---|---|---|---|---|
| 1 | POST | `/revenue-events` | `createRevenueEvent` | `revenue.recognize` **+** `revenue.view` | `RevenueEventCreate` | `201 RevenueEvent` | **required** | **FROZEN** |
| 2 | GET | `/revenue-events` | `listRevenueEvents` | `revenue.view` | query filters | `200 RevenueEventList` | — | additive |
| 3 | GET | `/revenue-events/{public_id}` | `getRevenueEvent` | `revenue.view` | — | `200 RevenueEvent` | — | additive |
| 4 | POST | `/revenue-events/{public_id}/reversals` | `createRevenueReversal` | `revenue.reverse` **+** `revenue.view` | `RevenueReversalCreate` | `201 RevenueReversal` | **required** | additive |
| 5 | GET | `/revenue-events/{public_id}/reversals` | `listRevenueReversals` | `revenue.view` | — | `200 RevenueReversalList` | — | additive |
| 6 | GET | `/revenue-events/{public_id}/attribution` | `getRevenueEventAttribution` | `revenue.view` | — | `200 RevenueEventAttribution` | — | additive |
| 7 | GET | `/revenue/summary` | `getRevenueSummary` | `revenue.view` | period, currency filters | `200 RevenueSummary` | — | additive |
| 8 | GET | `/attribution` | `getAttribution` | `analytics.view` **+** `revenue.view` | period filters, **`currency` optional** (§3a) | `200 AttributionReport` | — | **FROZEN** |
| 9 | GET | `/attribution/sources` | `listAttributionSources` | `analytics.view` **+** `revenue.view` | period filters, **`currency` optional** (§3a) | `200 AttributionSourceList` | — | additive |
| 10 | POST | `/attribution/touchpoints` | `createAttributionTouchpoint` | `attribution.manage` | `AttributionTouchpointCreate` | `201 AttributionTouchpoint` | **required** | additive |
| 11 | GET | `/attribution/touchpoints` | `listAttributionTouchpoints` | `analytics.view` | subject filters | `200 AttributionTouchpointList` | — | additive |
| 12 | GET | `/finance/reconciliation-cases` | `listFinancialReconciliationCases` | `finance.reconciliation.view` **+** `revenue.view` | status/severity/type filters | `200 FinancialReconciliationCaseList` | — | additive |
| 13 | GET | `/finance/reconciliation-cases/{public_id}` | `getFinancialReconciliationCase` | `finance.reconciliation.view` **+** `revenue.view` | — | `200 FinancialReconciliationCase` | — | additive |
| 14 | POST | `/finance/reconciliation-cases/{public_id}/resolve` | `resolveFinancialReconciliationCase` | `finance.reconciliation.resolve` **+** `revenue.view` | `ReconciliationResolveRequest` | `200 FinancialReconciliationCase` | **required** | additive |

```
PUBLIC_API_OPERATION_COUNT = 14   (2 frozen, 12 additive)
```

Operation 6 is added by `B9-FIX.1` (`M-7`) and **completed by `B9-FIX.2`**. The frozen frontend renders a **per-revenue-event** attribution surface in three places — the Revenue tab table (`FB-B9-051`), the trace drill-down modal (`FB-B9-052`) and the CSV export (`FB-B9-053`) — and no other B9 operation returns per-event attributed/unattributed figures: op 3 deliberately carries no attribution data, op 7 is per-period and op 9 is per-source. `B9-FIX.1`'s version of op 6 still omitted the `owner` and `touchpoint count` all three surfaces render, so `B9_SECURITY_PRIVACY.md` §4's rule that an export reveals *"exactly the API's own DTO fields"* remained unsatisfiable for two CSV columns. §2a defines those fields from the frontend source and closes it.

### 1a. Candidates adjudicated and **not** built

| Candidate from the brief | Verdict |
|---|---|
| `GET /revenue/events`, `GET /revenue/events/{id}` | **renamed to the frozen path.** Frozen `BACKEND_API_CATALOG.md` registers `/revenue-events`; using `/revenue/events` would fork a frozen path. Ops 2/3 sit under the frozen prefix |
| `POST /revenue/recognitions` | **rejected.** Same reason — the frozen recognition path is `POST /revenue-events` |
| `GET /revenue/attribution` | **rejected.** Frozen path is `GET /attribution` (op 8) |
| `GET /revenue/unattributed` | **rejected as a separate operation.** `unattributed_amount` is a frozen field of `AttributionReport` (op 8) and a field of `RevenueSummary` (op 7). A third endpoint returning the same number is a third place for it to disagree |
| `GET /revenue/sources/{id}` | **folded into op 9** with a `source_ref` filter — one rollup shape, not two |
| A second per-event trace endpoint beside op 6 | **rejected.** Op 6 returns the event's amounts, its attribution snapshot and its resolved chain in one response; the Revenue tab, the modal and the export are three renderings of that one shape, not three contracts |
| `DELETE` / `PATCH` on any revenue resource | **rejected.** `B9-D-A010`; `REVENUE_EVENT_DELETE_PATHS = 0` |
| `POST /finance/reconciliation-cases` | **rejected.** Cases are opened by the scanner, never by an API caller — a human-openable case would be an un-evidenced financial assertion |

## 2. DTOs

### Reused frozen, unchanged

`RevenueEventCreate`, `RevenueEvent`, `AttributionTouchpoint`, `AttributionReport`, `Money`, `EntityRef`, `PageInfo`, `Error`, `ErrorDetail`. All are `additionalProperties: false`; **B9 adds no field to any of them**.

Frozen `RevenueEventCreate` requires exactly: `source_type`, `source_ref`, `gross`, `net`, `currency`, `recognized_at`, `idempotency_key`. Frozen `RevenueEvent` returns exactly: `public_id`, `source_type`, `source_ref`, `gross`, `net`, `currency`, `recognized_at`, `status`.

> **The `idempotency_key` is a frozen body field**, not only a header. B9 honours the frozen contract: the body field is authoritative for the recognition command. When the `Idempotency-Key` header is also present it MUST equal the body field; disagreement is `422 VALIDATION_ERROR` (`B9-AF-023`). This mirrors the frozen `currency`-vs-`Money.currency` mirror rule rather than inventing a new convention.

### New DTOs

| DTO | Fields | Notes |
|---|---|---|
| `RevenueEventList` | `items: RevenueEvent[]`, `page_info: PageInfo` | frozen list shape |
| `RevenueReversalCreate` | `gross: Money`, `currency`, `reason`, `evidence_ref?`, `note?`, `reversed_at?`, `idempotency_key` | **no `net` field.** `additionalProperties: false`, so supplying one is rejected `B9-AF-035`. The reversal's net is derived by `B9_REVERSAL_MODEL.md` §4.1 and returned on the response (`B9-D-A033`) |
| `RevenueReversal` | `public_id`, `revenue_event_ref: EntityRef`, `gross: Money`, `net: Money`, `currency`, `reason`, `reversed_at` | `net` is **output only** — the derived value, echoed so the caller sees exactly what was booked |
| `RevenueReversalList` | `items`, `page_info` | |
| `RevenueSummary` | `period`, `timezone`, `as_of`, `currencies: RevenueCurrencyTotals[]` | **no scalar total** — see §3 |
| `RevenueCurrencyTotals` | `currency`, `gross_recognized: Money`, `gross_reversed: Money`, `net_recognized: Money`, `net_of_net: Money`, `gross_attributed: Money`, `gross_unattributed: Money`, `event_count`, `reversal_count` | one row per currency |
| `AttributionSourceList` | `items: AttributionSourceTotals[]`, `page_info` | |
| `AttributionSourceTotals` | `source_type`, `source_ref: EntityRef`, `origin_kind`, `source_code?`, `display_name`, `retired: boolean`, `currency`, `gross_attributed: Money`, `net_attributed: Money`, `event_count` | `display_name` resolved live from `source_code`/entity; `retired` when the source no longer resolves. `origin_kind` and `source_code` are B9-owned additive fields (`B9_ATTRIBUTION_MODEL.md` §4) |
| `AttributionTouchpointCreate` | `subject_type`, `subject_ref: EntityRef`, `source_type`, `source_ref: EntityRef`, `origin_kind`, `source_code?`, `occurred_at`, `position`, `channel?`, `campaign?`, `idempotency_key` | `source_ref` always names a registered §A entity; `source_code` is a contract string and never an `EntityRef` (`B9-D-A037`) |
| `RevenueEventAttribution` | `revenue_event_ref: EntityRef`, `recognized_at`, `status`, `currency`, `gross_recognized: Money`, `net_recognized: Money`, `gross_attributed: Money`, `gross_unattributed: Money`, `touchpoint_count: integer`, `trace_status`, `owner_ref: EntityRef \| null`, `attribution: AttributionSnapshot \| null`, `chain: ProvenanceChain` | op 6. One event, its amounts net of reversals, who owns it, and how it was attributed. `touchpoint_count`, `trace_status` and `owner_ref` were added by `B9-FIX.2` (§2a) — the frozen frontend renders all three on all three per-event surfaces |
| `AttributionSnapshot` | `candidate_kind`, `touchpoint_ref?: EntityRef`, `derived_result_ref?: EntityRef`, `model`, `allocation_bps`, `source_type`, `source_ref: EntityRef`, `origin_kind`, `source_code?`, `display_name`, `retired: boolean`, `acquired_at`, `resolved_at` | `null` on the parent when the event is unattributed |
| `ProvenanceChain` | `deal_ref?`, `lead_ref?`, `business_ref?`, `discovery_job_ref?: EntityRef`, `source_code?` | the resolved chain the trace modal renders; identifiers only, names resolved live. Its five members are exactly the five the frontend's completeness test inspects (§2a) |
| `AttributionTouchpointList` | `items: AttributionTouchpoint[]`, `page_info` | frozen item type |
| `FinancialReconciliationCase` | `public_id`, `case_type`, `severity`, `status`, `subject_type`, `subject_ref?`, `evidence`, `detected_at`, `next_review_at?`, `resolution_action?`, `resolution_reason?`, `resolved_at?` | |
| `FinancialReconciliationCaseList` | `items`, `page_info` | |
| `ReconciliationResolveRequest` | `status` (`resolved`\|`dismissed`), `resolution_action`, `resolution_reason`, `resolution_command_ref?`, `next_review_at?`, `idempotency_key` | |

Every monetary field is a frozen `Money`; every entity pointer is a frozen `EntityRef`; every list carries the frozen `PageInfo`.

### 2a. `touchpoint_count`, `trace_status` and `owner_ref` — read from the frontend, not invented (Class A, `B9-D-A042`)

`B9-FIX.1` added op 6 for the three per-event surfaces but returned only amounts, the snapshot and the chain. Independent verification found that all three surfaces also render an **owner** and a **touchpoint count**, and that the CSV export therefore still could not be built from B9's own DTO fields — the exact contradiction op 6 was introduced to remove. Each field below is defined from the frozen frontend's actual behaviour at `0c424c8a`, not from a plausible reading of it.

| Field | Frontend source | Semantics B9 adopts |
|---|---|---|
| `touchpoint_count` | `analytics-engine.js:172` — `trace.touchpoints.filter(item => item.touchpoint).length` | **the number of attribution allocations this event received.** Phase 1 first-touch allocates 100% to one winner, so it is `1` when an attribution snapshot exists and `0` when the event is unattributed |
| `trace_status` | `analytics-engine.js:172` — `trace.touchpoints.every(item => item.complete)`, where `complete` means none of Deal / Lead / Business / DiscoveryJob / DiscoverySource is missing | `complete` when an attribution snapshot exists **and** every `ProvenanceChain` member it captured resolves in-workspace; `incomplete` otherwise |
| `owner_ref` | `analytics-engine.js` — `owner: ownerForDeal(deal)`, i.e. `byId(users, deal.ownerId)`; rendered as `trace.owner?.name`, exported as `trace.owner?.id` | **the current owner of the Deal on the event's provenance chain**, resolved live from B6's `Deal.owner_ref`. `null` when the chain reaches no Deal — the frontend renders `—` in exactly that case |

**`touchpoint_count` counts allocations, not candidates.** A count of *candidates considered* was examined and **rejected**: the frontend counts the touchpoints that received an allocation — the same rows the trace modal renders — so a candidate count would display a number that matches nothing on the screen. A Track-A event with three `discovery_results` and one recorded touchpoint would read `4` where the frozen UI reads `1`. It is derived from the snapshot's existence and needs no stored column, which also makes it automatically immune to touchpoints recorded later: the snapshot is immutable, so the count cannot move (`B9_ATTRIBUTION_MODEL.md` §8). When `B9-D-B002` adds multi-touch, "number of allocations" generalises correctly to >1 without redefinition.

**`owner_ref` is display-only and deliberately not snapshotted.** Deal ownership is B6's, it is mutable (`AssignDeal`), and no frozen document or frontend behaviour requires *historical* owner attribution — the frontend itself recomputes it on every render from current Deal state. Copying a mutable CRM field into an immutable financial row would manufacture a second, staler copy of B6's truth and would imply a historical-ownership guarantee B9 has no evidence for. B9 therefore resolves it live at read time, exactly as it resolves display names (`B9_ATTRIBUTION_MODEL.md` §9). A reassigned Deal changes who op 6 reports as owner and changes **no** amount, no attribution and no total. `AT-API-13`, `AT-ATTR-21` **(NC)**.

This adds one field to B9's declared B6 read surface — `Deal.owner_ref`, an identifier already exposed by B6's own `Deal` DTO (`B9_B6_PIPELINE_BOUNDARY.md` §3). It is not monetary, is never copied into any B9 column, and never participates in a grouping that affects a total, so no firewall counter moves.

**Composition, stated so it is not rediscovered.** Op 6 returns identifiers; the client resolves display strings — the owner's name from B1/B6, source and job names from B3 — exactly as every other B9 read model does. The three surfaces then compose as:

| Surface | Built from |
|---|---|
| Revenue tab row (`FB-B9-051`) | `revenue_event_ref`, `recognized_at`, `owner_ref`, `gross_recognized`, `touchpoint_count`, `gross_attributed`, `gross_unattributed`, `trace_status` — the eight rendered columns, one op-6 field each |
| Trace modal (`FB-B9-052`) | the above plus `attribution` (one allocation row, or the unattributed placeholder when `null`) and `chain` |
| CSV export (`FB-B9-053`) | all fourteen columns: `chain.deal_ref`/`lead_ref`/`business_ref` supply `dealId`/`leadId`/`businessId`, `chain.discovery_job_ref` supplies `jobIds`, `attribution.source_code`/`source_ref` supply `sourceIds`, `attribution.model` supplies `attributionModel` |

`B9_SECURITY_PRIVACY.md` §4's rule that an export reveals *"exactly the API's own DTO fields"* is satisfied for every column. `AT-API-9`, `AT-API-11`, `AT-API-12`.

## 3. `RevenueSummary` has no scalar total — and why

`RevenueSummary` returns a **list of per-currency rows**, never one `total`. A scalar total across currencies cannot exist without FX authority B9 does not have (`B9_CURRENCY_MONEY_MODEL.md` §2). A single-currency workspace receives a one-element list and the frontend renders exactly what it renders today.

`net_of_net` is `Σ net − Σ reversal net`; `net_recognized` is the gross-contract net (`Σ gross − Σ reversal gross`). Both are returned because frozen `BACKEND_ANALYTICS_SEMANTICS.md` defines Recognized Revenue as *"sum gross/net per selected contract"* — the caller selects the contract by reading the field it wants, rather than passing a mode flag that could be forgotten.

### 3a. `currency` on single-`Money` surfaces — optional, defaulting to the workspace currency (Class A, `B9-D-A039`)

Three response shapes carry a **single-currency scalar** rather than a per-currency list: the frozen `AttributionReport.unattributed_amount`, `AttributionSourceTotals`, and op 6's amounts. The frozen `AttributionReport` is `additionalProperties: false`, so B9 cannot add per-currency rows to it, and summing across currencies is forbidden absolutely (`B9-D-A017`).

Three drafts of this rule existed. The history matters because the middle one was wrong in a way that is easy to repeat:

| Draft | Rule | Verdict |
|---|---|---|
| original | `currency` an optional filter, multi-currency behaviour unstated | **Rejected** — left three defensible implementations (sum them, pick one, or error) and no specified answer |
| `B9-FIX.1` | `currency` **required** on ops 8 and 9 | **Rejected by `B9-FIX.2`.** Unambiguous, but *breaking*: frozen `getAttribution` declares `"parameters": []`, so `GET /attribution` — the only request form the frozen contract defines — would have started returning `422`. That is a non-additive change to a frozen operation, and it was registered nowhere |
| **`B9-FIX.2` (selected)** | `currency` **optional**; absent ⇒ the workspace's own presentation currency | **SELECTED** — deterministic, non-breaking, and grounded in frozen evidence rather than invented |

> **`currency` is an optional query parameter on operations 8 and 9. When it is absent, the operation reports in the workspace's own presentation currency.** Op 6 addresses exactly one event, so its currency is the event's own and no filter is meaningful or accepted.

**The default is a frozen fact, not a B9 policy.** Three independent frozen sources fix it:

| Frozen source | Statement |
|---|---|
| `B1_IDENTITY_DATA_MODEL.md` §workspaces | `currency` — *"text, ISO-4217, **default `SAR`**"* — a NOT NULL workspace column |
| `B1_API_DTO_CONTRACTS.md` `WorkspaceDetail` | `currency` (R,W; `^[A-Z]{3}$`) — always present in the response, workspace-writable |
| `BACKEND_ANALYTICS_SEMANTICS.md` | *"**Currency is the requested workspace/report currency**; Phase 1 defaults to SAR while every monetary row still stores ISO currency."* |

The third is decisive: the frozen analytics contract already designates the workspace currency as the report currency when none is requested. B9 is not choosing a default — it is reading the one the frozen contract already named. `B9-R-020`.

**This is not the "silently pick one" failure the no-FX rule forbids.** Nothing is summed and nothing is converted; the report is *filtered* to one currency, and the response says which — `Money.currency` is a required field of the frozen `Money` schema, so `unattributed_amount.currency` names it on the wire. A caller can never be unsure which currency it received.

**Request validity never depends on how much data exists.** The default is a workspace *attribute*, not a count of rows behind the request. A workspace that books its first foreign-currency recognition sees no change in which requests are valid — only a second currency it can now ask for explicitly. A single-currency SAR workspace passes nothing and sees exactly what it sees today (`FB-B9-047`).

#### 3a.1 The workspace currency is **mutable**, and the default is resolved at request time (`B9-D-A043`)

The attribute is stable in the sense that matters for *request validity* — it does not depend on the data behind the request — but it is **not immutable**, and B9 must not be read as claiming it is. Frozen B1 makes it workspace-writable: `B1_API_DTO_CONTRACTS.md` types `WorkspaceDetail.currency` as **`(R,W; ^[A-Z]{3}$)`**, `WorkspaceUpdateRequest` accepts `currency`, and `B1_WORKSPACE_MEMBERSHIP_MODEL.md` §58 names `UpdateWorkspace` (permission `workspace.manage`, `If-Match` version) as the command that changes it.

> **The workspace presentation currency is resolved at REQUEST TIME, from the workspace's current `currency` column.** There is no as-of resolution, no stored history, and no conversion.

The consequences are stated rather than left to be discovered:

| | Behaviour |
|---|---|
| Resolution instant | the current value of `workspaces.currency`, read when the request is served |
| What the default does | **selects** rows already denominated in that currency. It is a filter, never a conversion |
| Historical amounts | **never converted, never restated.** Every stored amount keeps the currency it was recognized in, permanently (`B9_REVENUE_EVENT_MODEL.md` §3) |
| After `UpdateWorkspace` changes SAR → USD | the *same* parameterless request over the *same* closed period now selects the USD rows instead of the SAR rows. No amount moved, nothing was converted, and `Money.currency` names USD on the wire |
| Caller needing a period-stable currency | **pass `currency` explicitly.** That is what the optional parameter is for, and it is the only construct that is immune to a later workspace setting change |

**Why not an as-of resolution.** "Report in whatever the workspace currency was during the period" is the reading an implementer might reach for, and it is **not buildable**: neither B9 nor frozen B1 stores any temporal record of `workspaces.currency` — B1 carries `version` and `updated_at` on the workspace row but no history table and no per-period currency. An as-of rule would therefore have to invent a history that does not exist, or fall back on an FX conversion B9 categorically forbids (`B9-D-A017`). Request-time resolution is the only rule the frozen contracts can actually support, so it is named here rather than assumed. `AT-CUR-8`, `AT-CUR-9` **(NC)**, `AT-CUR-10` **(NC)**.

If the workspace currency cannot be resolved or fails the ISO-4217 shape, the response is `422 WORKSPACE_CURRENCY_UNRESOLVED` (`B9-AF-036`) — unreachable under frozen B1's NOT NULL default, and named so the outcome is deterministic rather than a 500.

Op 8 is a **frozen** operation. Adding *optional* parameters to its frozen `"parameters": []` is registered as `B9-AM-012`, and the `422` its response set gains is registered as `B9-AM-011`. Neither is assumed.

## 4. Validation and errors per operation

| Op | Notable validation | Errors beyond the universal set |
|---|---|---|
| 1 | §`B9_REVENUE_RECOGNITION_POLICY.md` §8, §4, §5, §6 | `B9-AF-002`, `004`-`012`, `016`, `023`, `028` (the in-workspace source-validation read is transiently unavailable — the only operation that performs it) |
| 4 | §`B9_REVERSAL_MODEL.md` §4.3; `net` is **not** an accepted input; a zero derived net is admitted **only** as the terminal gross-cleanup of §4.1a | `B9-AF-013`, `014`, `015`, `017`, `018`, `019`, `029`, `035` |
| 8, 9 | period well-formed; `currency`, when supplied, syntactically valid; otherwise defaulted from the workspace (§3a) | `B9-AF-031`, `B9-AF-012`, `B9-AF-036` |
| 10 | subject resolves; `source_ref` names a registered entity; `origin_kind` in the closed set; `position` free **and ≥ 1**; `occurred_at` not future | `B9-AF-016`, `020`, `022`, `033`, `034` |
| 6 | event resolves in-workspace; no `currency` filter is accepted (§3a) | `B9-AF-005` |
| 14 | status transition legal; reason present; `idempotency_key` present | `B9-AF-003`, `024`, `025` |
| all | workspace scope from session | `ENTITY_NOT_FOUND` for out-of-workspace, never `PERMISSION_DENIED` |

Universal set, with the catalog id each frozen code carries in `B9_FAILURE_CATALOG.md`: `401 AUTH_REQUIRED` (`B9-AF-027`), `403 PERMISSION_DENIED`, `404 ENTITY_NOT_FOUND`, `422 VALIDATION_ERROR`, `409 IDEMPOTENCY_CONFLICT` (`B9-AF-003`), `429` with `Retry-After`, `500 INTERNAL_ERROR` (`B9-AF-030`).

**Every one of the 36 catalog codes is reachable from a named operation.** The four that are not listed in an *operation-specific* row above are reachable through the universal set (`B9-AF-027`, `B9-AF-030`) or through the reconciliation-read operations 12/13 (`B9-AF-032`) and the reporting operations 8/9 (`B9-AF-031`) already named. `UNMAPPED_OPERATION_FAILURE_CODES = 0`; `AT-API-19`.

## 5. Pagination, filtering, sorting

`GET /revenue-events/{public_id}/attribution` takes no filters — it addresses one event.

`GET /revenue-events`: filters `period_start`, `period_end` (over `recognized_at`), `currency`, `status`, `source_type`, `source_ref`; sort `recognized_at_desc` (default) or `recognized_at_asc`; cursor-paginated. Because `recognized_at` is not unique, the cursor is `(recognized_at, public_id)` — a total order, so pagination cannot skip or repeat a row.

`GET /attribution` and `/attribution/sources`: `period_start`, `period_end`, `currency`, `source_type` — **all optional**. On op 8 these four are added to a frozen `"parameters": []` and are registered as `B9-AM-012`; the parameterless frozen request form stays valid (§3a).
`GET /finance/reconciliation-cases`: `status`, `severity`, `case_type`, `detected_after`.

## 6. What no endpoint does

- No endpoint accepts a `workspace_id` — scope comes from the session (`B9_RBAC_TENANCY.md` §3).
- No endpoint mutates a `RevenueEvent`'s financial fields.
- No endpoint deletes anything.
- No endpoint returns a cross-currency scalar. Where a response carries a single-currency scalar, `currency` is an optional request parameter and its absence means the workspace's own presentation currency — never a sum and never an undeclared choice (§3a).
- No endpoint accepts a reversal `net`; it is derived (`B9-D-A033`).
- No endpoint returning a monetary amount is reachable without `revenue.view` — including reconciliation cases, whose `evidence` may carry amounts (`B9_RBAC_TENANCY.md` §2a).
- No endpoint accepts an actor override.
- No endpoint is reachable by `system:automation` (`B9_B7_AUTOMATION_BOUNDARY.md`).

## 7. Negative controls

`AT-API-1` **(NC)**: any route accepting `workspace_id` in body or query — fails.
`AT-API-2` **(NC)**: a `DELETE` or `PATCH` route on a revenue resource — fails.
`AT-API-3` **(NC)**: `POST /revenue-events` succeeding without `idempotency_key` — fails; frozen `required[]`.
`AT-API-4` **(NC)**: a `RevenueSummary` response carrying a single cross-currency total — fails.
`AT-API-5` **(NC)**: a new field added to a frozen DTO — fails; all are `additionalProperties: false`.
`AT-API-6` **(NC)**: `POST /revenue-events/{id}/reversals` accepting a `net` field — fails `B9-AF-035`.
`AT-API-7`: `GET /attribution` with **no parameters** — the frozen request form — succeeds `200`, reporting in the workspace's presentation currency, with `unattributed_amount.currency` naming it (§3a).
`AT-API-11`: op 6 returns `touchpoint_count`, `trace_status` and `owner_ref`, so the Revenue tab's eight rendered columns each map to one op-6 field (§2a).
`AT-API-12`: every one of the CSV export's fourteen columns is composable from op 6's own DTO fields (`FB-B9-053`, `B9_SECURITY_PRIVACY.md` §4).
`AT-API-13`: reassigning a Deal changes op 6's `owner_ref` and changes no amount, attribution or total.
`AT-API-14` **(NC)**: an implementation making `currency` a **required** parameter on op 8 — fails; it breaks the frozen parameterless request form (§3a, `B9-D-A039`).
`AT-API-15` **(NC)**: an implementation summing across currencies when `currency` is absent, instead of defaulting to the workspace currency — fails `MULTI_CURRENCY_SUMMATION_LEAKS = 0`.
`AT-API-16` **(NC)**: an implementation snapshotting `owner_ref` into `revenue_attributions` — fails; owner is display-only and resolved live (`B9-D-A042`).
`AT-API-17` **(NC)**: `touchpoint_count` computed as the number of *candidates considered* rather than allocations made — fails; it would not match the rows the trace modal renders (§2a).
`AT-API-8` **(NC)**: an operation returning a `Money` field while requiring only `analytics.view` — fails (§1, `B9-D-A038`).
`AT-API-9`: op 6 returns, for one event, the amounts and attribution the Revenue tab, trace modal and CSV export each need (`FB-B9-051`…`FB-B9-053`).

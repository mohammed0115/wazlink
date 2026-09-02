# B9 — Controlled Amendments

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.
> **B9 applies none of these.** Each requires explicit CTO approval **before implementation**.

## 1. Method

Every B9 document that cites a frozen B0-B8 source was checked — mechanically, then by reading — for whether it merely **reads** that source (no amendment), **extends** it (ADDITIVE), **restates it more precisely without changing its meaning** (COMPATIBLE_CLARIFICATION), or **changes what it says** (NON_ADDITIVE, a blocking MAJOR finding).

```
CONTROLLED_AMENDMENT_COUNT    = 13
ADDITIVE_AMENDMENTS           = 10
COMPATIBLE_CLARIFICATIONS     =  3
NON_ADDITIVE_AMENDMENTS       =  0
MISSING_CONTROLLED_AMENDMENTS =  0
```

### 1a. `FROZEN_ARTIFACTS_AFFECTED` — the metric, stated before the number

Two earlier passes got this counter wrong in the same way: each named a count and then enumerated a different number of files beside it. The cause was that no metric had been defined, so "affected" silently drifted between *contract targeted* and *anything that must be touched afterwards*. `B9-FIX.2a` defines it first.

> **`FROZEN_ARTIFACTS_AFFECTED` counts the distinct frozen artifacts whose own frozen content this amendment set targets or interprets** — the documents a CTO must read and change to accept the bundle.
>
> It **excludes** artifacts that carry no B9 statement and are updated only as downstream bookkeeping once an amendment is accepted. Those are listed separately below rather than dropped, because they still have to be done.

**Counted — 11 contract-bearing artifacts**, each traced to the amendments that target it:

| # | Frozen artifact | Targeted by |
|---:|---|---|
| 1 | `B1_AUTHORIZATION_RBAC.md` | `B9-AM-001` |
| 2 | `BACKEND_AUTHORIZATION_MATRIX.md` | `B9-AM-001` |
| 3 | `BACKEND_PUBLIC_ID_REGISTRY.md` | `B9-AM-002`, `B9-AM-005` |
| 4 | `BACKEND_DATA_MODEL.md` | `B9-AM-004`, `B9-AM-006` |
| 5 | `BACKEND_ERD.md` | `B9-AM-004` |
| 6 | `BACKEND_RECONCILIATION.md` | `B9-AM-003` |
| 7 | `BACKEND_API_CATALOG.md` | `B9-AM-007`, `B9-AM-011`, `B9-AM-012` |
| 8 | `BACKEND_OPENAPI_V1.yaml` | `B9-AM-007`, `B9-AM-011`, `B9-AM-012` |
| 9 | `B8_B9_FINANCE_BOUNDARY.md` | `B9-AM-009` |
| 10 | `BACKEND_ANALYTICS_SEMANTICS.md` | `B9-AM-010`, `B9-AM-013` |
| 11 | `BACKEND_DOMAIN_OWNERSHIP.md` | `B9-AM-008` |

```
FROZEN_ARTIFACTS_AFFECTED = 11
```

**Not counted — 3 downstream synchronization artifacts.** None carries a frozen statement B9 contradicts, interprets, or asks a CTO to decide on; each is updated *after* an amendment is accepted, as the registry's own procedure requires:

| Artifact | Why it is excluded | Still required by |
|---|---|---|
| `BACKEND_ARCHITECTURE_DECISIONS.md` | the ADR note recording an accepted new prefix. Bookkeeping about a decision made elsewhere, not a contract B9 reinterprets — B9 quotes ADR-005/006/007/008/010/011 and contradicts none | registry §143, for `B9-AM-002`/`B9-AM-005` |
| `B0_BACKEND_TRACEABILITY.md` | the traceability entry for the same two prefixes | registry §143 |
| `BACKEND_DOCUMENTATION_INDEX.md` | the publication index. Updated because B9 is published, not because any amendment changes a contract in it | registry §143 ("index update") |

Excluding these three is a **choice about the metric, not a claim that they need no update.** All three must be synchronized before implementation; they are simply not artifacts whose frozen contract this bundle amends. `AT-DOM-4`.

(History, so the drift is visible rather than quietly overwritten: the original pass said *"9"* above a list of ten; `B9-FIX.2` recounted and said *"10"* above a list of eleven — the same defect, because neither defined the metric. `B9-FIX.2a` defines it, enumerates both sets, and makes the count and the enumeration agree.)

**Three amendments were added by `B9-FIX.1`** (`B9-AM-009`…`B9-AM-011`) and **two more by `B9-FIX.2`** (`B9-AM-012`, `B9-AM-013`). Each covers a frozen document B9 was already effectively changing without saying so; registering them is the correction.

`B9-FIX.2`'s two are of different kinds and both were found by independent verification rather than volunteered:

- **`B9-AM-012`** replaces a change that *was* genuinely non-additive. `B9-FIX.1` made `currency` a required parameter on the frozen `getAttribution`, which declares `"parameters": []` — so the only request form the frozen contract defines would have begun failing. Rather than register a breaking change, the design was corrected to an optional parameter with a frozen-sourced default (`B9-D-A039`); what remains is additive.
- **`B9-AM-013`** registers an assessment `B9-FIX.1` never made: whether letting B3 `discovery_results` compete in first-touch changes the frozen analytics semantics. It is classified `COMPATIBLE_CLARIFICATION`, and the exact population where the two readings differ is stated so a CTO can disagree on the evidence.

Three candidates were examined and rejected as designs because each would have been non-additive — `SRC-*` reclassification, unregistered opaque tokens, and (in `B9-FIX.2`) the required `currency` parameter. All three were removed by redesign rather than registered (§2).

---

### `B9-AM-001` — six finance permissions · **ADDITIVE**

| | |
|---|---|
| **Frozen source** | `B1_AUTHORIZATION_RBAC.md` §2 permission registry; `BACKEND_AUTHORIZATION_MATRIX.md` role matrix |
| **Frozen statement** | The registry lists **23** permission groups (Workspace, Members, Ownership, Invitations, Sessions, Discovery, Businesses, Leads, Tasks, Appointments, Conversations, Messages, Deals, Automation, Analytics, Billing, Subscription, Payments, Tax, Files, Audit, Settings, AI). **No revenue, finance, or attribution permission exists.** |
| **B9 requirement** | Add a *Revenue/Finance* group with `revenue.view`, `revenue.recognize`, `revenue.reverse`, `attribution.manage`, `finance.reconciliation.view`, `finance.reconciliation.resolve`, and their role-matrix rows (`B9_RBAC_TENANCY.md` §3) |
| **Classification** | **ADDITIVE** — six new codes in a new group. No existing permission is renamed, removed, or has a single `allow`/`conditional`/`deny` cell changed. `analytics.view` is reused verbatim and keeps its frozen role cells exactly; B9 requires it *conjunctively with* `revenue.view` on monetary responses (`B9_RBAC_TENANCY.md` §2a), which narrows what B9 exposes rather than widening what the frozen permission grants |
| **Blast radius** | The permission registry and the role matrix. No existing role loses anything; every new cell is on a new row |
| **Compatibility** | Fully backward compatible. A deployment that has not applied it simply has no finance surface |
| **Required synchronization** | `B1_AUTHORIZATION_RBAC.md` §2 and §3, `BACKEND_AUTHORIZATION_MATRIX.md` |

---

### `B9-AM-002` — register the `REVR-` public-ID prefix · **ADDITIVE**

| | |
|---|---|
| **Frozen source** | `BACKEND_PUBLIC_ID_REGISTRY.md` §A |
| **Frozen statement** | §A registers `REV-` (RevenueEvent) and `ATT-` (AttributionTouchpoint). **`REVR-` is unregistered.** §143: *"Any new canonical prefix requires an ADR update, API/DTO update, index update, and traceability entry before implementation."* |
| **B9 requirement** | Register `REVR-` → RevenueReversal, domain Revenue, workspace-scoped |
| **Classification** | **ADDITIVE** — mints a new namespace; alters no existing prefix. `REV-` and `ATT-` keep their exact frozen meanings |
| **Blast radius** | Registry §A; the four synchronization artifacts the registry itself demands |
| **Compatibility** | No collision: `REVR-` is a distinct literal from `REV-`, and prefix matching is exact-token, not `startswith` (see §3 below) |
| **Required synchronization** | **Counted (contract-bearing):** `BACKEND_PUBLIC_ID_REGISTRY.md` §A row. **Not counted (downstream, §1a):** an ADR note in `BACKEND_ARCHITECTURE_DECISIONS.md`; a traceability entry in `B0_BACKEND_TRACEABILITY.md`; `BACKEND_DOCUMENTATION_INDEX.md`. `B9_API_DTO_CONTRACTS.md` already carries the DTO and is B9's own, not a frozen artifact |

---

### `B9-AM-003` — add a Revenue row to the reconciliation process table · **ADDITIVE**

| | |
|---|---|
| **Frozen source** | `BACKEND_RECONCILIATION.md` "Reconciliation jobs" table |
| **Frozen statement** | Eight process rows: Payments, Subscriptions, Provider delivery, Discovery, Scraping, Webhooks, ZATCA, Usage. **No Revenue row.** The document nonetheless mandates that *"every mismatch receives a status, evidence, attempted repair record, operator, request ID, and next review time."* |
| **B9 requirement** | Add: *Revenue · compare B9 register vs internal invariants and B8 payment state · hourly/daily · repair authority: finance operator via governed B9 command* |
| **Classification** | **ADDITIVE** — a ninth row. No existing row's comparison, frequency, or repair authority changes |
| **Blast radius** | One table row |
| **Compatibility** | Full. B9 already satisfies the seven mandated fields (`B9_RECONCILIATION_MODEL.md` §5) and the "admin cannot edit financial truth with SQL" rule |
| **Required synchronization** | `BACKEND_RECONCILIATION.md` |

---

### `B9-AM-004` — add `revenue_attributions` to the frozen table group · **ADDITIVE**

| | |
|---|---|
| **Frozen source** | `BACKEND_DATA_MODEL.md` table-group table |
| **Frozen statement** | *"Revenue/Attribution — `revenue_events, revenue_reversals, attribution_touchpoints` — source/idempotency unique; event/date and relation indexes"* |
| **B9 requirement** | Add `revenue_attributions` — the immutable first-touch snapshot binding one RevenueEvent to one winning touchpoint at 100% (`B9_STORAGE_MODEL.md` §4) |
| **Classification** | **ADDITIVE** — a fourth table in an existing group. The three frozen tables keep their names, purposes and constraint descriptions unchanged |
| **Why it is necessary** | ADR-008 requires *deterministic* first-touch attribution. Determinism requires a snapshot (`B9-D-A014`); the frozen `RevenueEvent` DTO is `additionalProperties: false` so the snapshot cannot live on the event's contract, and attribution is a separate frozen domain with its own lifecycle |
| **Blast radius** | One table group row |
| **Compatibility** | Full; the table is new and nothing reads it yet |
| **Required synchronization** | `BACKEND_DATA_MODEL.md`; `BACKEND_ERD.md` (a `REVENUE_EVENT ||--o| REVENUE_ATTRIBUTION` relationship) |

---

### `B9-AM-005` — register the `FRC-` public-ID prefix · **ADDITIVE**

| | |
|---|---|
| **Frozen source** | `BACKEND_PUBLIC_ID_REGISTRY.md` §A |
| **Frozen statement** | `FRC-` is unregistered; §143's new-prefix clause applies |
| **B9 requirement** | Register `FRC-` → FinancialReconciliationCase, domain Revenue/Finance, workspace-scoped |
| **Classification** | **ADDITIVE** |
| **Blast radius** | Registry §A plus the four demanded artifacts |
| **Compatibility** | No collision with any registered prefix |
| **Required synchronization** | as `B9-AM-002` |

---

### `B9-AM-006` — add `financial_reconciliation_cases` to the frozen table group · **ADDITIVE**

| | |
|---|---|
| **Frozen source** | `BACKEND_DATA_MODEL.md` table-group table |
| **Frozen statement** | as `B9-AM-004` |
| **B9 requirement** | Add `financial_reconciliation_cases` (`B9_STORAGE_MODEL.md` §5) |
| **Classification** | **ADDITIVE** — a fifth table in the group |
| **Why it is necessary** | `BACKEND_RECONCILIATION.md` mandates seven fields per mismatch but names no entity to carry them, and its process table has no Revenue row (`B9-AM-003`). Without this table the frozen mandate has nowhere to land for finance |
| **Blast radius** | One table group row |
| **Compatibility** | Full |
| **Required synchronization** | `BACKEND_DATA_MODEL.md` |

---

### `B9-AM-007` — register the twelve additive API operations · **ADDITIVE**

| | |
|---|---|
| **Frozen source** | `BACKEND_API_CATALOG.md`; `BACKEND_OPENAPI_V1.yaml` |
| **Frozen statement** | Registers `POST /api/v1/revenue-events` (`createRevenueEvent`) and `GET /attribution` (`getAttribution`). The remaining B9 surfaces are unregistered |
| **B9 requirement** | Register the twelve additive operations of `B9_API_DTO_CONTRACTS.md` §1 and their new DTOs. `B9-FIX.1` added operation 6, `GET /revenue-events/{public_id}/attribution` (`getRevenueEventAttribution`), and the `RevenueEventAttribution`/`AttributionSnapshot`/`ProvenanceChain` DTOs; `B9-FIX.2` added `touchpoint_count`, `trace_status` and `owner_ref` to `RevenueEventAttribution` (`B9_API_DTO_CONTRACTS.md` §2a) — fields on a B9-owned additive DTO, touching no frozen schema |
| **Classification** | **ADDITIVE** — new paths only. The two frozen operations keep their paths, `operationId`s, request **bodies** and `200` shapes, and no frozen DTO gains or loses a field. Their **response sets** change (`B9-AM-011`) and `getAttribution` gains optional query parameters (`B9-AM-012`); both are registered separately rather than described here as an absence of change |
| **Blast radius** | API catalog and OpenAPI |
| **Compatibility** | Full. `B9-FIX.2` corrected this row: an earlier version claimed *"unchanged request/response schemas"*, which was not accurate — the response sets changed, and `getAttribution` also gained query parameters. Both are now registered (`B9-AM-011`, `B9-AM-012`), and no request valid against the frozen contract becomes invalid |
| **Required synchronization** | `BACKEND_API_CATALOG.md`; `BACKEND_OPENAPI_V1.yaml` |

---

### `B9-AM-009` — expose a read-only `Refund` fact to B9 · **ADDITIVE**

| | |
|---|---|
| **Frozen source** | `B8_B9_FINANCE_BOUNDARY.md` §3 and §4 |
| **Frozen statement** | §3 offers exactly three facts: *"`Payment{public_id, amount, currency, status, captured_at}`, `Invoice{public_id, total, currency, issued_at}`, `Subscription{public_id, plan_version_ref, status}`"*. **No `Refund` and no refund amount.** §4: *"If B9 needs a **new** B8-exposed fact not already in §3, that is a future controlled amendment against this document, never an assumption baked into B8 today."* |
| **B9 requirement** | Add `Refund{payment_ref, amount, currency, status, created_at}` to §3's offered set, read-only and on demand |
| **Why it is necessary** | Two of B9's seventeen reconciliation case types — `refund_without_recognition` and `refund_without_reversal` — need a refund fact *with an amount*, and the human refund→reversal workflow (`B9-D-A009`) is the pack's answer to the brief's refund scenarios. Without this, both cases had no evidence source and `B9_B8_BILLING_BOUNDARY.md` §4 ("those fields and no others") contradicted its own §6. `Payment.status ∈ {refunded, partially_refunded}` is in the offered set but carries no amount, and B8 supports partial refunds whose amount lives on the child row (`B8-X-008`) |
| **Classification** | **ADDITIVE** — a fourth row in an offered-fact list, through the exact mechanism §4 prescribes. No existing fact is removed, narrowed or re-typed; B8 gains no knowledge of B9 and no event subscription is created (`CONSUMED_EVENT_COUNT` stays 0) |
| **Does B8 build anything?** | **No.** `refunds` is already a frozen B8 table with `payment_id`, `amount`, `currency`, `status`, `created_at` (`B8_CHECKOUT_PAYMENT_MODEL.md` §4; `B8_STORAGE_MODEL.md`, class *Financial*, append-only). The amendment exposes what exists |
| **Blast radius** | One row of one table in one boundary document |
| **Compatibility** | Full. A deployment that has not applied it simply leaves the two refund case types undetectable, which is the state B9 was in before the amendment |
| **Required synchronization** | `B8_B9_FINANCE_BOUNDARY.md` §3 |

---

### `B9-AM-010` — clarify "where status recognized" in the frozen metric definition · **COMPATIBLE_CLARIFICATION**

| | |
|---|---|
| **Frozen source** | `BACKEND_ANALYTICS_SEMANTICS.md`, Recognized Revenue row |
| **Frozen statement** | *"Recognized Revenue | event/period | sum gross/net per selected contract | none | RevenueEvent.recognized_at **where status recognized**"* |
| **B9 requirement** | Read the qualifier as **register membership net of compensating reversals**, not as a literal `status = 'recognized'` row filter |
| **Classification** | **COMPATIBLE_CLARIFICATION** — it fixes the meaning of an ambiguous qualifier without changing the metric's entity, timestamp, grouping, or contract. Both readings agree on every event that has never been reversed, which is the ordinary case the frozen row was written for; they differ only on partially reversed events, which the frozen row does not discuss |
| **Why the literal reading is untenable** | A 300 reversal against a 1,000 event would drop the event from the period entirely, reducing reported revenue by 1,000. That contradicts `BACKEND_DATA_MODEL.md`'s append-oriented financial records, contradicts the frozen frontend (`analytics-engine.js` treats unattributed as a *residual*, `FB-B9-021`/`FB-B9-022`), and would make a correction more destructive than the error it corrects |
| **Honesty note** | An earlier B9 draft claimed the `status` column existed *"so that the frozen phrase has a real column to mean"* while no selector filtered on it — asserting a compliance it did not implement. This amendment replaces that claim (`B9_ANALYTICS_PROJECTIONS.md` §1a) |
| **Blast radius** | One cell of one table |
| **Compatibility** | Full — no stored data changes and no other metric is touched |
| **Required synchronization** | `BACKEND_ANALYTICS_SEMANTICS.md` Recognized Revenue row |

---

### `B9-AM-011` — response-set additions on two frozen operations · **ADDITIVE**

| | |
|---|---|
| **Frozen source** | `BACKEND_OPENAPI_V1.yaml` — `createRevenueEvent`, `getAttribution` |
| **Frozen statement** | `POST /revenue-events` declares `201`, `400 ValidationError`, `401`, `403`, `409 Conflict`, `500` — **no `404`, no `422`**. `GET /attribution` declares `200`, `401`, `403`, `500` — **no `4xx` for a bad request**. Across the whole frozen contract, all 14 operations that declare `ValidationError` use `400` |
| **B9 requirement** | `createRevenueEvent` additionally returns `404 ENTITY_NOT_FOUND` (an unresolvable `source_ref`, `B9-AF-005`) and `422 VALIDATION_ERROR` (the semantic rules of `B9_REVENUE_RECOGNITION_POLICY.md` §8). `getAttribution` additionally returns `422 VALIDATION_ERROR` (`B9-AF-031`, a malformed period) and `422 WORKSPACE_CURRENCY_UNRESOLVED` (`B9-AF-036`) |
| **Classification** | **ADDITIVE** — statuses are added to a response set; none is removed or repurposed, and no request schema, path, `operationId` or success shape changes. `422` is inside the frozen taxonomy: `BACKEND_ERROR_CATALOG.md` maps `VALIDATION_ERROR` to *"400/422"*, so B9 selects a sanctioned status rather than inventing one |
| **Honesty note** | `B9-AM-007` previously said *"`POST /revenue-events` behaviour is unchanged."* That was not accurate — the response set changed. This amendment states the change instead of asserting the absence of one |
| **Blast radius** | Two operations' `responses` blocks |
| **Compatibility** | A client that handled only the frozen statuses sees new ones on inputs that would previously have been `400`. **No request that was valid against the frozen contract becomes a failure**, and `B9-FIX.2` is what makes that true: `B9-FIX.1` had also made `currency` a *required* parameter on `getAttribution`, which would have turned the frozen parameterless request into a `422`. That change is withdrawn (`B9-D-A039`); the parameters are now optional and registered as `B9-AM-012` |
| **Required synchronization** | `BACKEND_OPENAPI_V1.yaml`; `BACKEND_API_CATALOG.md` |

---


### `B9-AM-012` — optional query parameters on the frozen `getAttribution` · **ADDITIVE**

| | |
|---|---|
| **Frozen source** | `BACKEND_OPENAPI_V1.yaml` — `getAttribution` |
| **Frozen statement** | The operation declares `"parameters": []` — **no parameters at all**. The only request form the frozen contract defines is a bare `GET /attribution` |
| **B9 requirement** | Add four **optional** query parameters: `period_start`, `period_end`, `currency`, `source_type` (`B9_API_DTO_CONTRACTS.md` §5). Absent `period_*`, the operation reports its default window; absent `currency`, it reports in the workspace's own presentation currency (§3a) |
| **Classification** | **ADDITIVE** — every parameter is optional, so the frozen request form remains valid and returns `200`. No parameter is required, none is removed, and the `200` shape (`AttributionReport`) is unchanged |
| **Why this amendment exists at all** | `B9-FIX.1` made `currency` **required** here. That was a **non-additive** change to a frozen operation — `GET /attribution` with no parameters, the only form the frozen contract defines, would have begun returning `422` — and it was registered nowhere; `B9-AM-007` simultaneously claimed the operation was reused with *"unchanged request schemas"*. Independent verification found both. `B9-FIX.2` withdrew the required parameter (`B9-D-A039`) rather than register a breaking change, and registers the optional parameters that remain |
| **Blast radius** | One operation's `parameters` block |
| **Compatibility** | **Full, and specifically: no previously-valid request becomes invalid.** A client calling the bare frozen form keeps working and receives the workspace-currency report. The default is not a B9 invention — frozen `BACKEND_ANALYTICS_SEMANTICS.md` designates the workspace/report currency and frozen `B1_IDENTITY_DATA_MODEL.md` stores `workspaces.currency` NOT NULL default `SAR` (`B9-R-020`) |
| **Required synchronization** | `BACKEND_OPENAPI_V1.yaml`; `BACKEND_API_CATALOG.md` |

---

### `B9-AM-013` — read "valid touchpoint" as any qualifying acquisition fact · **COMPATIBLE_CLARIFICATION**

| | |
|---|---|
| **Frozen source** | `BACKEND_ANALYTICS_SEMANTICS.md`, first-touch paragraph |
| **Frozen statement** | *"Phase 1 uses deterministic first-touch attribution: **the earliest valid touchpoint** for a Business/Lead chain receives the RevenueEvent allocation. A valid touchpoint must be **workspace-scoped, linked to a Business/Lead or approved source identity, and occur no later than recognition** unless the product contract explicitly allows later touches."* |
| **B9 requirement** | Read *"valid touchpoint"* as **any acquisition fact meeting the three stated validity clauses**, not exclusively a row of the `attribution_touchpoints` table. B9's first-touch draws from two candidate classes — persisted `ATT-*` touchpoints and derived `RES-*` `discovery_results` rows read from frozen B3 — ordered as one total order (`B9_FIRST_TOUCH_MODEL.md` §2, §4; `B9-D-A035`) |
| **Classification** | **COMPATIBLE_CLARIFICATION** — the frozen sentence defines validity by three properties and B9 applies exactly those three. A `discovery_results` row is workspace-scoped (`B3-INV-1`), linked to a Business, and tested against `discovered_at ≤ recognized_at`. The frozen text's own *"or approved source identity"* clause is what admits a non-`ATT-*` acquisition fact; had it said *"a row of `attribution_touchpoints`"*, this would have been NON_ADDITIVE and B9 would have had to register it as such. The metric's entity, timestamp, grouping and contract are unchanged, and the allocation is still exactly one winner at 100% |
| **Where the two readings differ — stated plainly** | They agree on every event whose chain has a recorded touchpoint, and on every event with no acquisition history at all. They differ on exactly one population: **an event whose chain has discovery provenance but no recorded touchpoint.** The narrow reading reports it *unattributed*; B9 reports it *attributed to the discovery fact*. No recognized amount moves either way — only the attributed/unattributed split does, and `Recognized = Attributed + Unattributed` holds under both (`B9_ATTRIBUTION_MODEL.md` §1) |
| **Why the narrow reading is untenable** | B9 consumes zero events and B3 holds no write path into `attribution_touchpoints`, so under it **every** Track-A acquisition would be attributable only if a human re-typed, per business, a fact B3 had already stored. That is not a degradation of Track A; it is Track A not working (`B9_FIRST_TOUCH_MODEL.md` §2.3) |
| **Honesty note** | `B9-FIX.1` made this design change (`B9-D-A035`) without assessing it against the frozen metric definition at all. Independent verification flagged the omission. It is registered here so a CTO can disagree with the classification on the evidence rather than discover the widening later; if the narrow reading is preferred, `B9-D-A035` must be reopened, not worked around |
| **Blast radius** | One sentence of one frozen paragraph. No stored data, no other metric |
| **Compatibility** | Full. A deployment applying the narrow reading simply reports more revenue as unattributed; no total changes |
| **Required synchronization** | `BACKEND_ANALYTICS_SEMANTICS.md` first-touch paragraph |

---

### `B9-AM-008` — name the reversals table consistently · **COMPATIBLE_CLARIFICATION**

| | |
|---|---|
| **Frozen source** | `BACKEND_DOMAIN_OWNERSHIP.md` Revenue row, "Authoritative tables" cell |
| **Frozen statement** | *"revenue_events, reversals"* |
| **Other frozen statement** | `BACKEND_DATA_MODEL.md`: *"revenue_events, **revenue_reversals**, attribution_touchpoints"* |
| **B9 requirement** | Read the ownership row's abbreviated *"reversals"* as the same table `BACKEND_DATA_MODEL.md` names `revenue_reversals`, and state it that way |
| **Classification** | **COMPATIBLE_CLARIFICATION** — two frozen documents already describe one table, one abbreviating. B9 adopts the data model's fully-qualified name (the more specific of two consistent statements) and changes no meaning, no ownership, and no constraint. Exactly the shape of B7's own `B7-AM-004` |
| **Blast radius** | One cell of one table |
| **Compatibility** | Full — no implementation could have depended on the abbreviation |
| **Required synchronization** | `BACKEND_DOMAIN_OWNERSHIP.md` Revenue row |

---

## 2. Non-additive amendments

**None.** `NON_ADDITIVE_AMENDMENTS = 0`.

**Seven** candidates were examined and **rejected as designs** precisely because each would have been NON_ADDITIVE. They are recorded so it is visible the question was asked. (An earlier version of this line said *"Four"* above a six-row table while `B9_EXECUTIVE_SUMMARY.md` said *"Six"*; `B9-FIX.2` recounted the table and added the seventh.)

| Rejected candidate | Why it would have been NON_ADDITIVE | What B9 does instead |
|---|---|---|
| Rename `RecordRevenueEvent` → `RecognizeRevenue` | renames a command frozen in three documents | keeps `RecordRevenueEvent` (`B9-D-A001`) |
| Add typed `deal_id`/`payment_id` columns beside `source_ref` | frozen `BACKEND_DTO_CONTRACTS.md` says the polymorphic pair **replaces** those fields | keeps `source_type`+`source_ref` (`B9-D-A005`) |
| Make `RevenueEvent` mutable so corrections edit in place | contradicts "financial records are append-oriented and are not casually deleted" and ADR-007's explicit-recognition model | compensating reversals (`B9-D-A010`) |
| Let B9 subscribe to `PaymentSucceeded` | contradicts `B8_B9_FINANCE_BOUNDARY.md` §4's "never an event subscription" | on-demand read (`B9-D-A002`) |
| Reclassify `SRC-*` from registry §B into a resolvable `EntityRef` | frozen `BACKEND_PUBLIC_ID_REGISTRY.md` §B states `SRC-` is a contract string *"not an `EntityRef`"*, and frozen `B3_CONTROLLED_AMENDMENTS.md` restates *"`SRC-` stays a section B contract string"*. Promoting it would reverse two frozen classifications, and B9 additionally required it to "resolve in-workspace" though B3's `discovery_sources` is a **global** catalogue — a rule that could never be satisfied | **Redesigned, not registered.** `source_ref` now always names a registered §A entity (`JOB-*`, `RES-*`, `LEAD-*`, `BUS-*`); the acquisition channel moved to `origin_kind`; the DiscoverySource is carried as the non-resolved `source_code` contract string, exactly as B3 carries `provider_source`. `B9-D-A037`; `FROZEN_PUBLIC_ID_CONFLICTS = 0` |
| Make `currency` a **required** parameter on the frozen `getAttribution` | frozen `BACKEND_OPENAPI_V1.yaml` declares `"parameters": []`; requiring a parameter turns the only frozen request form into a `422`, so a previously-successful request becomes a failure | **Redesigned, not registered.** `currency` is optional and defaults to the workspace's presentation currency, a default frozen `BACKEND_ANALYTICS_SEMANTICS.md` and frozen `B1_IDENTITY_DATA_MODEL.md` already fix. `B9-D-A039`, `B9-AM-012`; `GET_ATTRIBUTION_FROZEN_CONTRACT_GAPS = 0` |
| Register opaque `import`/`api`/`form`/`referral` tokens as public IDs | the registry requires every `public_id` to carry a **registered prefix**; minting unregistered tokens inside a frozen `EntityRef` would breach that invariant | same redesign — these are `origin_kind` values, not identifiers (`B9_ATTRIBUTION_MODEL.md` §4b) |

## 3. A collision check worth stating

`REVR-` and `REV-` share a leading substring. The frozen registry's own invariant is that public IDs are **typed, exact-prefix tokens** resolved against a registry, never matched by `startswith`. `REV-01J…` and `REVR-01J…` are distinct tokens whose prefixes are `REV-` and `REVR-`; no registered prefix is a proper prefix of another *token* under exact-token matching. The same already holds in the frozen registry for `AUTO-`/`AUTOACT-`/`AUTOEXEC-`/`AUTOLOG-`/`AUTONOT-`/`AUTORUN-` and for `INV-`/`INV-BILL-`, so this is an established pattern rather than a new hazard. `AT-ID-3` **(NC)**.

## 4. Approval gate

All thirteen require explicit CTO approval **before** implementation. B9 applies none, and no B9 document assumes any is already granted. Because `NON_ADDITIVE_AMENDMENTS = 0`, this bundle raises **no closure blocker** — but note that this is now true by *redesign*, not by luck: the one genuinely breaking change `B9-FIX.1` carried was withdrawn rather than reclassified, and `B9-AM-013`'s classification is stated with the population where readings differ so it can be contested on evidence.

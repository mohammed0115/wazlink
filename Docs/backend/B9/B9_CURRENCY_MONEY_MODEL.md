# B9 — Currency & Money Model

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Frozen constraints B9 inherits

| Source | Constraint |
|---|---|
| `BACKEND_OPENAPI_V1.yaml` → `Money` | `{ amount: string matching ^-?\d+(\.\d{1,4})?$, currency: ^[A-Z]{3}$ }`, both required, **"Decimal string; never a binary float."** |
| `BACKEND_OPENAPI_V1.yaml` → `RevenueEvent.currency` | *"ISO-4217 currency code; authoritative for sibling monetary fields in this DTO. If a Money object is also present, this mirror MUST equal Money.currency; disagreement is a validation error."* |
| `BACKEND_ANALYTICS_SEMANTICS.md` | *"Currency is the requested workspace/report currency; Phase 1 defaults to SAR while every monetary row still stores ISO currency."* |
| `FB-B9-047` | Workspace carries one presentation `currency` (SAR) and one IANA `timezone` |

Every rule below either restates a frozen constraint or fills a gap the frozen documents leave open.

## 2. No FX conversion — resolved (Class A, `B9-D-A017`)

**B9 performs no currency conversion, holds no exchange rate, and has no FX authority.**

No frozen document defines a rate source, a rate date convention, a spread, or a rounding rule for conversion. Inventing one would make every multi-currency total depend on an undocumented rate that could not be reproduced or audited later — precisely the kind of silent financial fabrication this domain exists to prevent.

Consequences, all deliberate:

- Amounts are **grouped** by currency, never summed across currencies.
- A "total revenue" figure spanning two currencies **does not exist** as a scalar. The API returns a per-currency breakdown (`B9_ANALYTICS_PROJECTIONS.md` §3).
- A reversal must be in its event's currency (`B9-AF-015`).
- A workspace operating in two currencies sees two rows, not one converted number.

The capability is deferred as `B9-D-B004`, and would require a rate-source decision, a rate-date decision, and its own controlled amendment.

```
MULTI_CURRENCY_SUMMATION_LEAKS = 0
```

## 3. Currency rules

| Rule | Enforcement |
|---|---|
| `currency` is required on every recognition and reversal | frozen `required[]`; `B9-AF-012` |
| Syntactically a 3-letter uppercase ISO-4217 code | `CHECK (currency ~ '^[A-Z]{3}$')`; `B9-AF-012` |
| `gross.currency = net.currency = currency` | request validation; `B9-AF-011` |
| Immutable after insert | no update path (`B9_REVENUE_EVENT_MODEL.md` §3) |
| Reversal currency = event currency | validated under the event row lock; `B9-AF-015` |
| Attribution inherits its event's currency | `revenue_attributions` stores **no** currency and **no** amount — it stores an allocation, so it cannot disagree |
| A workspace may hold events in several currencies | permitted; every total is per-currency |

**Currency validation is syntactic, not a closed list.** B9 does not ship an ISO-4217 registry snapshot, because a hardcoded list becomes wrong when the standard changes and B9 has no authoritative source to maintain it against (`B9_RESEARCH_REGISTER.md` `B9-R-002`). A syntactically valid but economically meaningless code is a data-quality matter surfaced by reconciliation (`unknown_currency`), not a hard rejection that could block legitimate revenue in a currency B9's list happened to lack.

## 4. Money representation

| Aspect | Decision |
|---|---|
| **Database type** | `NUMERIC(18, 4)` — exact decimal. Never `float`, `double`, `real`, or `money` |
| **Scale** | **4**, fixed by the frozen `Money` pattern `\.\d{1,4}` |
| **Precision** | 18 → 14 integer digits, ~99 trillion major units. Ample, and bounded so a malformed input cannot store an absurd magnitude |
| **API serialization** | decimal **string**, per the frozen schema. Never a JSON number — IEEE-754 cannot represent 0.1 exactly and JSON numbers are parsed as doubles by most clients |
| **Application type** | arbitrary-precision decimal (e.g. Python `Decimal`) end to end. No `float` at any layer |
| **Rounding mode** | `ROUND_HALF_UP`, applied **only** where a division could occur. Phase 1 performs **no** division: recognition amounts are caller-supplied and first-touch allocates 100%, so **no rounding is ever applied to a Phase-1 amount**. The mode is declared so that `B9-D-B002` (multi-touch) inherits a decided rule rather than choosing one under pressure |
| **Minor units** | Not used. Amounts are stored in **major units** with 4 decimal places. Scale 4 accommodates zero-decimal currencies (JPY), 2-decimal (SAR, USD), 3-decimal (KWD, BHD, OMR) **and 4-decimal** currencies without a per-currency exponent table B9 has no authority to maintain. Scale 4 is fixed by the frozen `Money` pattern `\.\d{1,4}`; it is a **product policy inherited from a frozen contract**, and B9 asserts no ISO-4217 requirement that scale be 4 (`B9-R-002`, `B9-R-017`) |
| **Comparison** | Exact decimal comparison. Two amounts are equal iff their decimal values are equal; `100.00 = 100.0000` |
| **Zero** | **Rejected** on recognition (`B9-AF-009`) and on reversal (`B9-AF-013`). A zero recognition asserts nothing; a zero reversal compensates nothing. Both are almost certainly caller bugs |
| **Negative** | **Rejected** on both. `CHECK (gross_amount > 0)`, `CHECK (net_amount > 0)` on `revenue_events`; the same on `revenue_reversals`. A negative recognition is a reversal wearing the wrong hat, and would corrupt every gross total. The frozen `Money` pattern permits a leading `-` because `Money` is shared with contexts that need it (e.g. adjustments elsewhere); B9 narrows it |
| **Upper bound** | Two distinct bounds, and they are **not** the same number. The *type* bound is `NUMERIC(18,4)`'s own maximum, `99999999999999.9999` (14 integer digits). The *product* bound is `CHECK (gross_amount <= 999999999999.9999)` — 12 integer digits, ~1 trillion major units — declared as a real named constraint on both financial tables in `B9_STORAGE_MODEL.md` §1 and §2, not merely asserted here. The product bound is **an explicit B9 policy limit, not something implied by the column type**: a single recognition above a trillion major units is far more likely a misplaced decimal or a minor-unit/major-unit confusion than a real commercial fact, and rejecting it at write time is cheaper than discovering it in a period total. A workspace with a genuine need above the product bound raises it by amendment, not by silently exceeding it. Overflow of either bound is `B9-AF-008` |

## 5. The gross/net relationship

`net ≤ gross` is required (`B9-AF-010`), and both are caller assertions. B9 does **not** compute net from gross: it applies no discount, fee, commission or tax logic, because it owns none of those concepts (tax in particular is B10's, `B9_B10_TAX_BOUNDARY.md`). What net *means* commercially is the workspace's judgment; B9 constrains only the arithmetic.

Both contracts are reported side by side, never mixed in one figure (`B9_ANALYTICS_PROJECTIONS.md` §2), matching the frozen metric definition *"sum gross/net per selected contract"*.

## 6. Presentation vs storage

| Layer | Currency behavior |
|---|---|
| Storage | the event's own ISO code, always |
| Selector | grouping key; results are a list of `(currency, gross, net, …)` rows |
| API | per-currency rows plus the workspace's presentation currency as a **label**, never a conversion target |
| Frontend | renders SAR by default (`FB-B9-047`, `FB-B9-048`). A single-currency workspace sees exactly one row and the display is unchanged from today's fixture — the projection is compatible with the frozen frontend without B9 converting anything |

## 7. Negative controls

`AT-CUR-1` **(NC)**: a reversal in a currency other than its event's — rejected `B9-AF-015`.
`AT-CUR-2` **(NC)**: `gross.currency ≠ net.currency`, or either ≠ the mirror `currency` — rejected `B9-AF-011`.
`AT-CUR-3` **(NC)**: an implementation storing any monetary value as a binary float, or serialising `amount` as a JSON number — fails.
`AT-CUR-4` **(NC)**: a selector or endpoint returning one scalar total across two currencies — fails; `MULTI_CURRENCY_SUMMATION_LEAKS = 0`.
`AT-CUR-5` **(NC)**: an implementation applying an exchange rate anywhere in B9 — fails; no rate source exists.
`AT-CUR-6`: an operation carrying a single-currency `Money` called without `currency` reports in the workspace's presentation currency, and `Money.currency` names it (§8).
`AT-CUR-7` **(NC)**: an implementation treating an absent `currency` as "sum every currency" or as an arbitrary pick — fails (§8).
`AT-MON-1` **(NC)**: a zero or negative `gross`/`net` on recognition — rejected `B9-AF-009`.
`AT-MON-2` **(NC)**: `net > gross` — rejected `B9-AF-010`.
`AT-MON-3` **(NC)**: an amount with more than 4 decimal places — rejected `B9-AF-008`.
`AT-MON-4`: `100.00` and `100.0000` compare equal and cannot both be recognized as distinct amounts for the same source.
`AT-MON-5` **(NC)**: a document or comment asserting that scale 4 is required by ISO-4217 — fails; it is a product policy inherited from the frozen `Money` pattern (§4).
`AT-MON-6` **(NC)**: a document asserting the `999999999999.9999` product bound is implied by `NUMERIC(18,4)` — fails; the type permits `99999999999999.9999` and the tighter bound is an explicit policy (§4).

## 8. Single-currency API surfaces

Three response shapes carry a **single** `Money` rather than a per-currency list: the frozen `AttributionReport.unattributed_amount`, and the additive `AttributionSourceTotals` and per-event attribution rows. A single `Money` cannot represent a multi-currency workspace without either summing across currencies (forbidden, §2) or choosing one without saying so (worse).

B9 therefore makes `currency` an **optional** parameter on every operation whose response carries a single-currency scalar, and defines its absence to mean **the workspace's own presentation currency** (`B9_API_DTO_CONTRACTS.md` §3a, `B9-D-A039`, `B9-AF-036`). The choice is neither a sum nor an undeclared pick: frozen `BACKEND_ANALYTICS_SEMANTICS.md` already states *"Currency is the requested workspace/report currency; Phase 1 defaults to SAR"*, and frozen `B1_IDENTITY_DATA_MODEL.md` stores `workspaces.currency` NOT NULL with default `SAR`. B9 reads the default the frozen contracts already named rather than inventing one (`B9-R-020`).

`B9-FIX.1` made the parameter **required** instead. That was unambiguous but breaking: frozen `getAttribution` declares `"parameters": []`, so the only request form the frozen contract defines would have begun returning `422`. `B9-FIX.2` replaced it with the optional-plus-frozen-default rule, which is deterministic *and* leaves every previously valid request valid. This remains the only place the no-FX rule reaches the wire shape, and it is still resolved by constraining the *request* rather than relaxing the rule.

### 8a. The workspace currency is mutable — resolution instant, stated (Class A, `B9-D-A043`)

The default must not be described as an immutable fact, because frozen B1 makes it writable: `B1_API_DTO_CONTRACTS.md` types `WorkspaceDetail.currency` **`(R,W; ^[A-Z]{3}$)`**, `WorkspaceUpdateRequest` accepts it, and `UpdateWorkspace` (`workspace.manage`, `If-Match`) changes it (`B1_WORKSPACE_MEMBERSHIP_MODEL.md` §58).

> **Resolved at request time, from the workspace's current `currency`. It selects; it never converts.**

| Question | Answer |
|---|---|
| When is it read? | when the request is served — there is no as-of resolution and no stored currency history |
| What does it do? | **filters** to rows already denominated in that currency |
| Are historical amounts restated? | **never.** Every stored amount keeps its own immutable currency (`B9_REVENUE_EVENT_MODEL.md` §3) |
| After the workspace currency changes SAR → USD? | the same parameterless request over the same closed period now selects the **USD** rows. Nothing was converted; no amount moved; `Money.currency` names USD on the wire |
| How does a caller pin a currency? | pass `currency` explicitly — that is precisely what the optional parameter exists for |

**An "as-of the reporting period" rule is rejected, and could not be built.** Neither B9 nor frozen B1 stores any temporal record of `workspaces.currency`; B1 carries `version` and `updated_at` on the workspace row and no history table. Implementing as-of would require inventing that history or applying an exchange rate — and B9 has **no FX authority of any kind** (§2, `B9-D-A017`). Request-time resolution is the only rule the frozen contracts support, so it is stated rather than left to be rediscovered.

```
WORKSPACE_CURRENCY_MUTABILITY_AMBIGUITIES = 0
FX_CONVERSION_LEAKS                       = 0
```

`AT-CUR-8`, `AT-CUR-9` **(NC)**, `AT-CUR-10` **(NC)**.

```
MULTI_CURRENCY_SUMMATION_LEAKS = 0
MULTI_CURRENCY_API_AMBIGUITIES = 0
```

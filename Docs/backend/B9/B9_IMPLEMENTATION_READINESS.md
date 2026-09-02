# B9 — Implementation Readiness

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.
> **This document grants no implementation authorization.**

## 1. The test

An implementation agent must be able to answer every question below **from this pack alone**, without inventing business policy. Each answer cites where it is decided.

| # | Question | Answer | Decided in |
|---|---|---|---|
| 1 | **What tables are owned?** | Exactly five: `revenue_events`, `revenue_reversals`, `attribution_touchpoints`, `revenue_attributions`, `financial_reconciliation_cases` | `B9_STORAGE_MODEL.md` §7 |
| 2 | **What is immutable?** | Every financial column of `revenue_events` except the derived `status`; all of `revenue_reversals`, `revenue_attributions`, `attribution_touchpoints`. Nothing is ever deleted | `B9_REVENUE_EVENT_MODEL.md` §3 |
| 3 | **What command recognizes revenue?** | `RecordRevenueEvent` — the frozen B0 name — via `POST /revenue-events` (`createRevenueEvent`), the frozen path | `B9_COMMAND_EVENT_CATALOG.md` §1 |
| 4 | **Who may call it?** | A membership holding `revenue.recognize`: `owner` or `admin`. Never automation, never a provider, never the frontend directly | `B9_RBAC_TENANCY.md` §3 |
| 5 | **What evidence is required?** | `source_type` (closed set of 5) + `source_ref` resolving in the caller's workspace, and not a WazLink platform payment/invoice | `B9_REVENUE_RECOGNITION_POLICY.md` §4, §5 |
| 6 | **What is the idempotency identity?** | `(workspace_id, idempotency_key)` **and** the canonical source identity `(workspace_id, source_type, source_entity_type, source_public_id)` where `status <> 'reversed'`. Reconciliation resolution uses `(workspace_id, resolution_idempotency_key)` on a partial unique index | `B9_IDEMPOTENCY_CONCURRENCY.md` §1 |
| 7 | **When is revenue recognized?** | When the command commits. Never automatically, from any event, ever | `B9_REVENUE_RECOGNITION_POLICY.md` §1 |
| 8 | **What timestamp controls reporting?** | `recognized_at`, caller-supplied, UTC, half-open workspace-local period boundaries | `B9_TIME_PERIOD_MODEL.md` §2 |
| 9 | **How are reversals represented, and when may a reversal book zero net?** | Append-only `revenue_reversals` rows. The caller supplies **`gross` only**; `net` is derived as `ROUND_HALF_UP((Pg+Rg)×N/G, 4) − Pn` under the event row lock. A supplied `net` is `B9-AF-035`. `net = 0` is admitted **only** as the terminal gross-cleanup — `Pg+Rg = G` **and** `Pn = N` — and is `B9-AF-029` in every other case | `B9_REVERSAL_MODEL.md` §4, §4.1a |
| 10 | **How is over-reversal prevented, and when is an event fully reversed?** | `SELECT … FOR UPDATE` on the event row, re-read both Σ under that lock, derive `net`, evaluate the terminal test, validate the gross bound, insert, recompute `status` — one transaction, **not** a `CHECK`. `status='reversed'` requires `Σ gross = gross_amount` **AND** `Σ net = net_amount`. Gross exhaustion implies net exhaustion; **the converse does not**, so neither fold alone may drive `status` | `B9_IDEMPOTENCY_CONCURRENCY.md` §4; `B9-D-A034`, `B9-D-A040` |
| 11 | **How is first-touch selected?** | Two candidate sources merged into one set — recorded touchpoints and B3's `discovery_results` **where `filtered = false`** (a filtered row is B3 audit evidence, not a delivered acquisition result — `B9-D-A044`) — ordered by `occurred_at`, then candidate kind (touchpoint first), then the within-kind keys, then `public_id`. A total order, always decided | `B9_FIRST_TOUCH_MODEL.md` §2, §4 |
| 12 | **What happens without attribution, and how does resolution fail safely?** | If **both** candidate sources are empty the recognition commits with no attribution row and is reported unattributed. If resolution errors or times out, `ROLLBACK TO SAVEPOINT attribution_resolution` leaves the transaction usable, the event still commits, and `attribution_unresolved` opens | `B9_ATTRIBUTION_MODEL.md` §7; `B9_FIRST_TOUCH_MODEL.md` §4.1 |
| 13 | **What happens without Discovery, and who creates Track-A touchpoints?** | Every provenance hop is optional; Track B is fully supported. **Nobody creates Track-A touchpoints** — Track-A attribution is derived by *reading* B3's `discovery_results` at recognition time. `RecordTouchpoint` is human-only and there is no system writer | `B9_DUAL_TRACK_COMPATIBILITY.md` §3-§4; `B9-D-A036` |
| 14 | **How are currencies handled, including on single-scalar endpoints?** | Stored per event, immutable, never converted, always a grouping key. Where a response carries one `Money`, `currency` is an **optional** request parameter and its absence means the **workspace's own presentation currency** — a default frozen `BACKEND_ANALYTICS_SEMANTICS.md` and frozen `B1_IDENTITY_DATA_MODEL.md` already fix. Never a sum, never an undeclared pick. The frozen parameterless `GET /attribution` stays valid | `B9_CURRENCY_MONEY_MODEL.md` §2, §8; `B9_API_DTO_CONTRACTS.md` §3a |
| 15 | **What does B8 provide?** | `Payment{public_id, amount, currency, status, captured_at}`, `Invoice{public_id, total, currency, issued_at}`, `Subscription{public_id, plan_version_ref, status}`, and `Refund{payment_ref, amount, currency, status, created_at}` (`B9-AM-009`) — read-only, on demand, **never** by subscription | `B9_B8_BILLING_BOUNDARY.md` §4 |
| 16 | **What does B6 provide?** | Deal existence, `Deal → Lead` for provenance, status as reconciliation context, title for display. **Never** `Deal.value`, never timing | `B9_B6_PIPELINE_BOUNDARY.md` §3 |
| 17 | **What may automation do?** | **Nothing in B9.** No action, no permission, no path, with or without approval | `B9_B7_AUTOMATION_BOUNDARY.md` §1 |
| 18 | **What belongs to B10?** | All tax: VAT, rates, invoice numbering, XML, QR, ZATCA clearance and reporting, credit notes, tax periods | `B9_B10_TAX_BOUNDARY.md` §3 |
| 19 | **What does reconciliation detect?** | 17 closed case types across four states; it **never** writes a financial table | `B9_RECONCILIATION_MODEL.md` §3, §4 |
| 20 | **What APIs exist?** | 14 operations — 2 at frozen paths, 12 additive, including `GET /revenue-events/{id}/attribution` (op 6), which returns amounts, `owner_ref`, `touchpoint_count`, `trace_status`, the attribution snapshot and the resolved chain — every field the frozen frontend's three per-event surfaces render | `B9_API_DTO_CONTRACTS.md` §1, §2a |
| 21 | **What failures exist?** | 36 codes, `B9-AF-001`…`B9-AF-036`, 28 reusing frozen codes and 8 new values inside the frozen envelope | `B9_FAILURE_CATALOG.md` §1 |
| 22 | **What events are produced/consumed?** | 6 produced (3 frozen names reused); **0 consumed** | `B9_COMMAND_EVENT_CATALOG.md` §2, §3 |
| 23 | **What is `status`, who sets it, and do selectors filter on it?** | Derived from **both** reversal folds, recomputed under the event row lock, never directly assigned. **No selector filters on it** — recognized revenue is the register net of reversals (`B9-AM-010`) | `B9_REVENUE_EVENT_MODEL.md` §5; `B9_ANALYTICS_PROJECTIONS.md` §1a |
| 24 | **How is a correction made?** | Reverse (+ re-recognize if a corrected figure is due). Never an edit | `B9_REVERSAL_MODEL.md` §7 |
| 25 | **What is the money type, and what bounds it?** | `NUMERIC(18,4)`; decimal string on the wire; never a float. Recognition rejects zero and negative; a reversal's `gross > 0` and its derived `net >= 0`. The type maximum is `99999999999999.9999`; the tighter `999999999999.9999` bound is an explicit product limit declared as named `CHECK` constraints on both financial tables, not a type implication | `B9_CURRENCY_MONEY_MODEL.md` §4; `B9_STORAGE_MODEL.md` §1, §2 |
| 26 | **How is a source identifier modelled?** | Three separate things: `source_ref` (always a registered §A workspace-scoped `EntityRef`), `origin_kind` (the acquisition channel), `source_code` (a contract string such as a DiscoverySource code — never an `EntityRef`, never workspace-resolved) | `B9_ATTRIBUTION_MODEL.md` §4; `B9-D-A037` |
| 27 | **Who may read a monetary field?** | Only a caller holding `revenue.view`, conjunctively with whatever else the operation requires — stated on **every** operation returning `Money`, including ops 1 and 4 and the reconciliation reads, rather than inferred from today's role matrix. `analytics.view` alone never returns a `Money` | `B9_RBAC_TENANCY.md` §2a; `B9-D-A038` |
| 28 | **Where do the per-event `owner` and `touchpoint count` come from?** | `owner_ref` is the current owner of the chain's Deal, read from B6's `Deal.owner_ref` **live at read time and never snapshotted** — ownership is mutable and no evidence requires historical owner attribution. `touchpoint_count` is the number of **allocations** the event received (`1` attributed, `0` unattributed in Phase 1), derived from the snapshot's existence, **not** a count of candidates considered | `B9_API_DTO_CONTRACTS.md` §2a; `B9-D-A042` |

```
IMPLEMENTATION_HANDOFF = PASS
```

No answer above requires an implementer to invent policy.

**Seven of these answers changed in `B9-FIX.1`**, and each changed because the previous answer was one two competent engineers could have read differently: the reversal arithmetic (9, 10), the attribution fallback and its failure mechanism (11, 12), who creates Track-A touchpoints (13), multi-currency behaviour on a single-scalar endpoint (14), the source identifier model (26), and monetary authorization (27).

**Six changed again in `B9-FIX.2`**, for the same reason — each previous answer still left an engineer something to invent:

| # | What was still ambiguous or wrong after `B9-FIX.1` |
|---|---|
| 9, 10 | Whether a reversal may ever book zero net, and what happens to a gross residual left by rounding. The answer was "never" and the consequence was an unreversible event |
| 14 | `currency` was **required**, which silently broke the frozen parameterless `GET /attribution` |
| 20, 28 | Op 6 returned neither the owner nor the touchpoint count the frozen UI renders, so two CSV columns had no source and `touchpoint_count`'s meaning was undefined |
| 25 | The product amount bound existed in prose but as no constraint an implementer could build |

Question 28 is new. Questions 26 and 27 were new in `B9-FIX.1`, because the pack previously had no single place that answered them.

## 2. What must be approved before implementation

1. **CTO approval of all thirteen controlled amendments** (`B9_CONTROLLED_AMENDMENTS.md` — 10 additive, 3 compatible clarifications, **0 non-additive**). The six permissions, the `REVR-`/`FRC-` prefixes, the two additive tables, the reconciliation process row, the API-catalog registrations, the B8 `Refund` fact, the Recognized-Revenue clarification, the two frozen operations' response sets, the optional query parameters on `getAttribution`, and the first-touch candidate-set reading all require approval **before** any code is written. B9 applies none of them.

   Two are worth flagging to the approver specifically. `B9-AM-012` exists because `B9-FIX.1` had made `currency` a *required* parameter on a frozen operation — a genuinely breaking change that was withdrawn by redesign rather than reclassified. `B9-AM-013` is a `COMPATIBLE_CLARIFICATION` whose classification is contestable on the evidence, and it states exactly which population of events the two readings disagree about; if the narrower reading is preferred, `B9-D-A035` reopens.
2. **Independent CTO verification** of this pack.
3. **Explicit Backend Architecture-to-Coding authorization**, which no B9 document grants.

## 3. What an implementer must **not** do

- Recognize revenue from any event, trigger, webhook, or schedule (`B9-D-A008`).
- Add an update or delete path to any financial row (`B9-D-A010`).
- Enforce the over-reversal bound with a `CHECK` constraint — it cannot work (`B9_STORAGE_MODEL.md` §2a).
- Accept a reversal `net` from the caller, or derive it by per-reversal rounding (`B9-D-A033`).
- Admit a zero-net reversal outside the three terminal conditions, or reject the terminal one (`B9-D-A040`).
- Assert `Σ gross = G ⟺ Σ net = N`; only the forward implication holds (`B9-D-A040`).
- Make `currency` a required parameter on `getAttribution`, or sum currencies when it is absent (`B9-D-A039`).
- Snapshot a Deal owner into `revenue_attributions`, or compute `touchpoint_count` as candidates considered (`B9-D-A042`).
- Mark an event `reversed` on the gross fold alone (`B9-D-A034`).
- Treat `SRC-*` as a resolvable `EntityRef` (`B9-D-A037`).
- Return a `Money` field to a caller holding only `analytics.view` (`B9-D-A038`).
- Run attribution resolution without a savepoint and assume the transaction survives an error (`B9_FIRST_TOUCH_MODEL.md` §4.1).
- Derive an amount from `Deal.value`, `Plan.price`, or `Payment.amount` (`B9-D-A006`).
- Sum across currencies or apply an exchange rate (`B9-D-A017`).
- Recompute attribution at read time (`B9-D-A014`).
- Let an attribution failure roll back a recognition (`B9-D-A013`).
- Grant any B9 permission to `system:automation` (`B9-D-A022`).
- Subscribe to any upstream event (`B9-D-A002`).
- Claim IFRS/ZATCA/statutory compliance anywhere (`B9_FINANCIAL_MODEL.md` §7).

## 4. Suggested build order

1. `revenue_events` + `RecordRevenueEvent` + the two unique guards + `RevenueRecognized`
2. `revenue_reversals` + `ReverseRevenueEvent` + the locked Σ-bound + `status` fold
3. `attribution_touchpoints` + `RecordTouchpoint`
4. `revenue_attributions` + the first-touch resolver (both candidate sources) inside the recognition transaction, under its savepoint
5. Selectors and read APIs
6. `financial_reconciliation_cases` + the three scans + resolution
7. Observability

Steps 1-2 deliver the financial invariants; steps 3-4 the attribution invariants; step 6 the detection that proves both. Every step's acceptance tests are already written.

## 5. Explicitly out of Phase-1 scope

Automatic/rule-based recognition · deferred revenue and schedules · double-entry GL · customer invoicing · AR/AP/bank/payroll/inventory · FX conversion · multi-touch attribution · retro-attribution · tax of any kind. Each is a recorded Class-B or Class-C deferral, not an oversight.

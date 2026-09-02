# B9 — B6 Pipeline / Deal Boundary

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.
> Mirrors `B6_REVENUE_FIREWALL.md` from the other side. B6 proved it cannot push; B9 proves it does not pull.

## 1. What a Won Deal is, and is not

A Deal reaching `won` is **pipeline and commercial state**: the sales team believes the opportunity closed favourably. It is not a financial fact, does not assert money changed hands, and creates nothing in B9.

Frozen `B0_BACKEND_BLUEPRINT.md`: *"A Deal can become `won` without creating a RevenueEvent."* Frozen `BACKEND_PUBLIC_ID_REGISTRY.md`: *"`DEAL-*` does not imply `REV-*`."* The frontend says it four independent times (`FB-B9-008`, `FB-B9-031`, `FB-B9-033`, `FB-B9-034`).

## 2. Does B9 consume `DealWon`? — **No** (Class A, `B9-D-A002`)

```
B9 consumed events from B6 = 0
```

This was adjudicated rather than assumed. Consuming `DealWon` even "only for reconciliation" was considered and **rejected**:

- it would create the one thing the firewall exists to prevent — a live code path from a Deal closing into the finance domain — and future maintainers would have to keep understanding why that path must not lead to a write;
- it buys nothing: reconciliation compares *settled state* at scan time (`B9_RECONCILIATION_MODEL.md` §8), and an on-demand read of the Deal answers every question a `DealWon` payload could;
- B6's own firewall document §5 describes the intended relationship as *"read-only from B6's perspective … legible only by querying `RevenueEvent.source_ref`"* — a query, not a subscription.

So there is no B6 subscription, no B6 handler, and no B6 event in any B9 catalog. `DealWon → RevenueRecognized` is not merely forbidden; it is unreachable.

## 3. What B9 *does* read from B6, and why

Strictly on demand, strictly read-only, strictly workspace-scoped, through B6's own frozen `Deal` DTO:

| Purpose | Read | Consequence of the read |
|---|---|---|
| **Source validation** | does `DEAL-*` resolve in this workspace? | existence only. Failure ⇒ `B9-AF-005`. **No field is copied into any monetary column** |
| **Provenance** | `Deal → Lead` | contributes `LEAD-*` to the first-touch chain (`B9_FIRST_TOUCH_MODEL.md` §3) |
| **Reconciliation context** | Deal status | may open an *informational* `recognition_against_open_deal` case |
| **Display** | Deal title | rendered in reports; resolved live, never snapshotted as financial data |
| **Display** | `Deal.owner_ref` | the per-event `owner_ref` op 6 returns (`B9_API_DTO_CONTRACTS.md` §2a). An identifier already exposed by B6's own `Deal` DTO, **resolved live at read time and never snapshotted** — Deal ownership is mutable (`AssignDeal`) and B9 asserts no historical-ownership guarantee. Not monetary, never copied into a B9 column, never a grouping key for any total (`B9-D-A042`) |

`Deal.value` is **never read** in the recognition path. `Deal.closed_at`/`won_at` are **never** used for periodisation (`B9_TIME_PERIOD_MODEL.md` §1). `Deal.owner_ref` is read for **display only**, on op 6, and reassigning a Deal therefore changes who op 6 names as owner and changes no amount, attribution or total — `AT-B6-7`, `AT-API-13`.

## 4. `DealWon → RevenueRecognized` is explicitly prohibited

There is no automatic path, no rule, no toggle, no configuration, and no "approved recognition rule" in Phase 1 (`B9_REVENUE_RECOGNITION_POLICY.md` §1). Recognition against a `DEAL-*` source requires a human with `revenue.recognize` to supply the amount, currency and date explicitly. `AT-FW-1` **(NC)**, `AT-B6-1` **(NC)**.

## 5. A Deal need not be won — and this is deliberate

Requiring `Deal.status = 'won'` before permitting a `deal`-sourced recognition would have made recognition a **function of pipeline state** — exactly the coupling the firewall forbids — and would immediately raise "must revenue be un-recognized when a Deal is reopened?", to which the only safe answer is no. B9 therefore validates existence, not status, and surfaces the unusual case as an informational reconciliation signal. `B9-D-A023`; `AT-B6-5`.

## 6. Deal changes after recognition

| B6 action | Effect on B9 |
|---|---|
| `UpdateDeal` (value, probability, owner, title) | **none** — `FB-B9-033` |
| `MoveDealStage` | **none** |
| `CloseDealWon` / `CloseDealLost` | **none** — `FB-B9-034` |
| `ReopenDeal` | **none**; recognized revenue is not withdrawn. If the commercial outcome truly reversed, a human issues `ReverseRevenueEvent` |
| Deal deleted | cannot happen — B6 has no delete command |

The recognition's stored `deal_public_id` in its attribution snapshot is likewise never rewritten (`B9_ATTRIBUTION_MODEL.md` §8).

## 7. No B6 write, ever

B9 holds no ORM reference, FK write target, or command path into `deals`, `pipelines`, `pipeline_stages`, `deal_stage_transitions` or `deal_loss_reasons`. Recognizing revenue against a Deal does not stamp, flag, or annotate that Deal in any way — B6 rows are unchanged and unaware.

```
DIRECT_B6_WRITE_LEAKS  = 0
WON_DEAL_REVENUE_LEAKS = 0
PIPELINE_REVENUE_LEAKS = 0
```

## 8. Negative controls

`AT-B6-1` **(NC)**: `CloseDealWon` producing a `revenue_events` row or a `RevenueRecognized` event — fails.
`AT-B6-2` **(NC)**: an implementation defaulting `gross`/`net` from `Deal.value` — fails.
`AT-B6-3` **(NC)**: a B9 command writing any B6 table, including a "recognized" flag on `deals` — fails.
`AT-B6-4` **(NC)**: a selector unioning `deals.value` into a revenue figure — fails.
`AT-B6-5`: recognition against an `open` Deal succeeds and opens an informational case.
`AT-B6-6` **(NC)**: `ReopenDeal` reversing or voiding an existing `RevenueEvent` — fails.
`AT-B6-7`: reassigning a Deal (`AssignDeal`) changes the `owner_ref` op 6 reports for its recognitions and changes no amount, attribution or total — owner is resolved live, never snapshotted (`B9-D-A042`).

# B9 — Financial Model

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. The shape of the model, in one paragraph

B9 keeps an **immutable register of recognition facts** and a **parallel immutable register of compensating reversal facts**. Nothing is ever edited or deleted. Every question about revenue is answered by folding those two registers — never by reading a stored total, never by consulting Deals, payments, plans or the frontend. Attribution is a third, separate register that says *which acquisition source earned* a recognition fact; it can be absent, and its absence changes no revenue total.

## 2. Ledger scope — resolved (Class A, `B9-D-A003`)

Three candidate scopes were considered explicitly:

| Option | What it would mean | Verdict |
|---|---|---|
| **A. Double-entry general ledger** | Chart of accounts, debits/credits, journals, trial balance, period close | **Rejected.** No frozen document contains an account, a journal, a debit, a credit, or a period close. Building one would invent an entire accounting product with no evidence, and would make every recognition require a contra-account B9 has no basis to choose. |
| **B. Revenue subledger** | A revenue-only ledger that later *posts* to a general ledger, with deferral schedules and period-close mechanics | **Rejected for Phase 1.** Implies a GL to post to (none exists) and deferred-revenue scheduling (no evidence — `B9-D-C002`). Retained as the natural upgrade path if an accounting phase is ever authorized. |
| **C. Immutable revenue-event register + compensating reversal register** | Append-only recognition facts, append-only compensating facts, derived totals | **SELECTED.** |

**Why C.** It is exactly what the frozen contracts already describe: `BACKEND_DATA_MODEL.md` names the table group `revenue_events, revenue_reversals, attribution_touchpoints` and says financial records "are append-oriented and are not casually deleted"; `BACKEND_DOMAIN_OWNERSHIP.md` names two commands, `RecordRevenueEvent` and `ReverseRevenueEvent`, and no posting/closing command; `BACKEND_ANALYTICS_SEMANTICS.md` defines Recognized Revenue as a **sum over `RevenueEvent.recognized_at` where status recognized**, which is a register fold, not a ledger balance. Option C is the smallest model that satisfies every frozen contract and the task's reversal, attribution and audit requirements.

**This is a WazLink product policy, not an accounting standard.** B9 makes no claim of IFRS, GAAP, Saudi statutory, or ZATCA compliance. See §7 and `B9_RESEARCH_REGISTER.md`.

## 3. The three registers

```
                  ┌──────────────────────────┐
   RecordRevenue  │  revenue_events          │   immutable rows
   Event ────────▶│  gross, net, currency,   │   status derived from reversals
                  │  recognized_at, source   │
                  └───────────┬──────────────┘
                              │ 1
                              │
                              │ 0..N          ┌──────────────────────────┐
   ReverseRevenue             └──────────────▶│  revenue_reversals       │   immutable rows
   Event ───────────────────────────────────▶ │  gross, net, reason      │   Σ ≤ event amount
                              │               └──────────────────────────┘
                              │ 0..1
                              │               ┌──────────────────────────┐
   (resolved at recognition)  └──────────────▶│  revenue_attributions    │   immutable snapshot
                                              │  winning touchpoint, 100%│   absent ⇒ unattributed
                                              └──────────────────────────┘
```

`attribution_touchpoints` is a fourth, independent register of acquisition touches (`RecordTouchpoint`); `revenue_attributions` records *which* touchpoint won a given recognition.

## 4. The fold — how every total is computed

For a workspace `W`, a currency `C` and a period `[t0, t1)` over `recognized_at`:

```
gross_recognized(W,C,period) = Σ  e.gross
                               where e ∈ revenue_events, e.workspace = W,
                                     e.currency = C, e.recognized_at ∈ period

gross_reversed(W,C,period)   = Σ  r.gross
                               where r ∈ revenue_reversals, r.event ∈ the same set

net_recognized(W,C,period)   = gross_recognized − gross_reversed        (gross contract)
                             = Σ e.net − Σ r.net                        (net contract)
```

Neither fold filters on `status`. An event contributes because it is in the register; a reversal subtracts because it compensates one. `status` is a lifecycle label, not a selector predicate (`B9_ANALYTICS_PROJECTIONS.md` §1a, `B9-AM-010`).

Two facts follow directly and are load-bearing:

1. **A reversal is attributed to the period of the event it reverses**, not the period it was issued in. This is deliberate: reversing a January recognition in March must correct January, or a closed period silently changes meaning depending on when someone noticed the error. `B9-D-A020`; `AT-TIME-7`.
2. **Totals are never summed across currencies.** `C` is a grouping key, never collapsed. `B9-D-A017`; `AT-CUR-4`. Where a frozen DTO can only carry one currency, the *request* is constrained instead (`B9_API_DTO_CONTRACTS.md` §3a).
3. **The two contracts cannot diverge in the direction that matters.** A reversal's `net` is derived from its event's own gross→net ratio (`B9_REVERSAL_MODEL.md` §4.1), so `Σ r.gross = e.gross ⟹ Σ r.net = e.net`: the gross contract can never report an event exhausted while the net contract still shows a residual on it. The **converse is not claimed** — rounding can exhaust the net contract while a gross residual remains, and that residual is retired by the terminal gross-cleanup reversal (§4.1a). Until it is, `status` reads `partially_reversed`, which is accurate: real gross revenue is still outstanding. `B9-D-A033`, `B9-D-A040`; `AT-REVR-16`, `AT-REVR-23`, `AT-REVR-24`.

## 5. Why nothing is ever mutated or deleted

| Requirement | How the register satisfies it |
|---|---|
| "Financial history must not silently mutate" | `gross`/`net`/`currency`/`recognized_at`/`source_*` have no update path; the only mutable column is derived `status`, computed from both reversal folds (`B9_DOMAIN_OWNERSHIP.md` §4) |
| "Original 1,000 SAR fact must remain historically visible" | The 1,000 row is untouched; a 300 reversal row sits beside it; the net is a fold, not a stored balance |
| Audit reconstruction | Every row carries actor, reason, idempotency key, request id, and timestamps; nothing is overwritten so nothing needs an "old value" log |
| Correction | A correction is a compensating fact (`B9_REVERSAL_MODEL.md` §7), never an edit |

## 6. Worked example — the canonical scenario

Recognize gross 1,000 / net 800 SAR. Every reversal below supplies **gross only**; its net is derived (`B9_REVERSAL_MODEL.md` §4.1).

| Step | Register write | `gross_recognized` | `gross_reversed` | net-contract remaining | Event `status` |
|---|---|---:|---:|---:|---|
| Recognize 1,000 / 800 SAR | `revenue_events` +1 row | 1,000 | 0 | **800** | `recognized` |
| Reverse gross 300 → net **240** | `revenue_reversals` +1 row | 1,000 | 300 | **560** | `partially_reversed` |
| Reverse gross 200 → net **160** | `revenue_reversals` +1 row | 1,000 | 500 | **400** | `partially_reversed` |
| Attempt to reverse gross 600 | **rejected** `B9-AF-014` | 1,000 | 500 | **400** | `partially_reversed` |
| Attempt to reverse gross 1,000 / net 1 | **rejected** `B9-AF-035` | 1,000 | 500 | **400** | `partially_reversed` |
| Reverse remaining gross 500 → net **400** | `revenue_reversals` +1 row | 1,000 | 1,000 | **0** | `reversed` |

The fifth row is the corruption the fix removes. Under the earlier model the caller could supply an independent `net`, and `gross 1,000 / net 1` passed every bound: it exhausted the gross fold, flipped `status` to `reversed`, and left net revenue standing on an event that the register then called fully reversed — unreversible, and with its source released for re-recognition. The reversal command no longer accepts a `net` at all.

The 1,000 SAR fact is visible at every step, at its original amount. If that event was fully attributed to Source A, Source A's attributed revenue tracks the same columns exactly, under both contracts, because attribution is derived from them rather than stored beside them (`B9_ATTRIBUTION_MODEL.md` §6).

## 7. Product policy vs statutory accounting — the line

| B9 states | B9 does **not** state |
|---|---|
| When *WazLink's product* treats revenue as recognized for reporting inside the app | When revenue may be recognized under IFRS 15, Saudi statutory accounting, or any tax regime |
| That recognition requires an explicit authorized command and resolvable evidence | That this satisfies any auditor, regulator or standard |
| That reversals are compensating and bounded | Any treatment of deferred revenue, performance obligations, or contract assets |
| That amounts are stored as exact decimals | Any rounding rule required by a statute |

A workspace using WazLink's revenue figures for statutory reporting must have that reviewed by its own accountants. `B9_RESEARCH_REGISTER.md` records what was and was not verified against authoritative sources, and marks the standards questions **UNRESOLVED** rather than asserting compliance.

## 8. Negative controls

`AT-FM-1` **(NC)**: an implementation storing a running `recognized_total` column on any table and serving selectors from it — fails; totals are folds (`§4`), and a stored total is a second source of truth.
`AT-FM-2` **(NC)**: an implementation representing a correction by updating `revenue_events.gross` — fails (`AT-IMM-2`).
`AT-FM-3` **(NC)**: a document or endpoint claiming IFRS/ZATCA/statutory compliance for B9 output — fails (`§7`).
`AT-FM-4` **(NC)**: an implementation where the gross contract reports an event exhausted while the net contract reports a residual on it — fails (`§4`, `B9-D-A033`).
`AT-FM-5` **(NC)**: an implementation that treats the *reverse* case — net exhausted, gross residual outstanding — as impossible, or as grounds to mark the event `reversed` — fails; it is reachable, correctly labelled `partially_reversed`, and closed by the terminal gross-cleanup (`B9-D-A040`).

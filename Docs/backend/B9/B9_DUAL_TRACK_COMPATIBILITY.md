# B9 — Dual-Track Compatibility

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.
> **Design compatibility only. No Track-B entity is created here.**

## 1. The two tracks

| | **Track A — Customer Acquisition** | **Track B — Existing Customer CRM** |
|---|---|---|
| Origin | Discovery (Maps/scraper) | import · manual entry · API · web form · referral |
| Chain | Source → DiscoveryJob → Business → Lead → Deal → Revenue | Customer/Account/Contact → Opportunity/Deal → Revenue |
| Status today | fully modelled by frozen B3/B2/B6 | **not modelled** — no frozen entity exists |
| B9 Phase-1 support | full | **full, for revenue** |

## 2. The invariant

> **The CRM track must operate independently of the Discovery track.**

In B9 terms:

```
RevenueEvent  does NOT require  DiscoveryJob
RevenueEvent  does NOT require  a Business discovered through Maps
RevenueEvent  does NOT require  AI analysis
RevenueEvent  does NOT require  attribution of any kind
```

`TRACK_B_DISCOVERY_REQUIRED = NO`.

## 3. How B9 already satisfies it

Nothing special is needed, because B9 never made Discovery a precondition anywhere:

| Mechanism | Track-B behavior |
|---|---|
| **Source validation** (`B9_REVENUE_RECOGNITION_POLICY.md` §4) | Requires only that `source_ref` resolve in-workspace. A `LEAD-*` created by import resolves exactly as a discovered one does. A `DEAL-*` with no Lead at all resolves fine |
| **Provenance chain** (`B9_FIRST_TOUCH_MODEL.md` §3) | **Every hop is optional.** The walk `DEAL → LEAD → BUS → discovery_results → JOB` stops wherever the chain ends. A Track-B Deal whose Lead has no Business simply yields a shorter subject set and no derived candidates |
| **Attribution** (`B9_ATTRIBUTION_MODEL.md` §4) | Five of the seven `origin_kind` values — `import`, `manual`, `api`, `form`, `referral` — are Track-B native, and `other` is the catch-all. A Track-B touchpoint's `source_ref` names the `LEAD-*` or `BUS-*` that was acquired, so it always resolves without any Track-B entity existing |
| **Unattributed** (`B9_ATTRIBUTION_MODEL.md` §7) | A recognition with no qualifying touchpoint is fully recognized and reported as unattributed. Revenue is never lost to missing provenance |
| **Reversal** | Identical on both tracks |
| **Selectors** | Identical; Track-B revenue appears in every total, attributed to its own source type or reported as unattributed |

**The single most important line:** the first-touch resolver returns `NONE` rather than raising when **both** candidate sources are empty (`B9_FIRST_TOUCH_MODEL.md` §4 step 5), and `NONE` commits the recognition with no attribution row. That one design choice is what makes Track B work without a single Track-B entity existing.

## 4. Attribution degradation ladder

Attribution degrades gracefully rather than failing:

```
1. derived from B3 discovery_results    ← Track A, automatic, no touchpoint needed
                                          (visible rows only: filtered = false, B9-D-A044)
2. recorded touchpoint, origin=discovery ← Track A, explicitly recorded
3. import / api / form / referral       ← Track B, channel known
4. manual                               ← Track B, a human recorded the touch
5. other                                ← channel known only as "not one of the above"
6. (no candidate of either kind)        ← unattributed; revenue still fully recognized
```

Rung 1 is what `B9-FIX.1` added. Before it, Track A had no automatic rung at all: `RecordTouchpoint` was the only writer, B9 consumes no events, and B3 holds no write path into `attribution_touchpoints` — so a discovery-acquired business could be attributed only if a human re-typed, per business, a fact B3 had already stored. Reading `discovery_results` at recognition time makes rung 1 automatic without a writer, an actor, or a subscription (`B9-D-A035`, `B9-D-A036`).

Each rung down loses attribution detail. **No rung loses revenue.** `AT-TRACK-3`, `AT-TRACK-4`.

## 5. What Track B would add later — and what it would not disturb

A future Track-B phase would introduce Customer/Account entities and probably an `account` `source_type`. When it does:

| Would change | Would **not** change |
|---|---|
| One additive value in the `origin_kind` closed set, and possibly one in the touchpoint `source_type` set if a Track-B entity is founded (a controlled amendment) | The recognition command, its inputs, or its authority |
| One additive `subject_type` for touchpoints | The reversal model |
| Provenance-chain hops for the new entity | The immutability rules |
| — | Any existing `RevenueEvent` or attribution snapshot (both immutable) |
| — | The currency, money, or period models |
| — | The firewall |

Because attribution snapshots are immutable, historical Track-B revenue recognized *before* the Account entity existed keeps exactly the attribution it had. No backfill rewrites history. `AT-TRACK-5`.

## 6. What is deliberately **not** built now

No Customer entity, no Account entity, no Opportunity entity, no import pipeline, no form ingestion, no Track-B API. Frozen B0-B8 model none of them, and B9 has no authority to found a CRM sub-domain. B9 builds only the property that matters financially: **revenue does not depend on how the customer arrived.**

## 7. Negative controls

`AT-TRACK-1` **(NC)**: recognition rejected because the source has no `DiscoveryJob` — fails.
`AT-TRACK-2` **(NC)**: recognition rejected because no `Business` exists on the chain — fails.
`AT-TRACK-3`: a manually-created Lead with a `manual` touchpoint recognizes and attributes correctly.
`AT-TRACK-4`: an imported Lead with **no** touchpoint recognizes fully and reports as unattributed.
`AT-TRACK-5` **(NC)**: a later Track-B phase rewriting an existing attribution snapshot — fails.
`AT-TRACK-6` **(NC)**: an implementation requiring AI analysis before recognition — fails.
`AT-TRACK-7`: a Track-A recognition with **no** persisted touchpoint attributes automatically from a `discovery_results` row, with no human having recorded anything.
`AT-TRACK-8` **(NC)**: an implementation requiring a persisted touchpoint before Track-A revenue can be attributed — fails; that was the gap `B9-D-A035` closed.

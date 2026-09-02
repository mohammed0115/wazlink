# B9 — Time & Reporting Period Model

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. The timestamps, and exactly what each means

| Timestamp | Owner | Meaning | Caller-supplied? | Controls reporting? |
|---|---|---|---|---|
| `revenue_events.recognized_at` | B9 | **The business instant the revenue is recognized for.** | **yes** | **YES — this is the one** |
| `revenue_events.created_at` | B9 | when the row was physically written | no | no |
| `revenue_events.updated_at` | B9 | when `status` was last recomputed from the two reversal folds | no | no |
| `revenue_reversals.reversed_at` | B9 | the business instant of the reversal decision | yes (defaults `now()`) | **no** — a reversal corrects its *event's* period (§4), under both the gross and net contracts |
| `revenue_reversals.created_at` | B9 | physical write time | no | no |
| `attribution_touchpoints.occurred_at` | B9 | when the acquisition touch happened | yes | attribution only, never revenue |
| `revenue_attributions.acquired_at` | B9 | snapshot of the winning touch's `occurred_at` | no | no |
| `revenue_attributions.resolved_at` | B9 | when the snapshot was taken | no | no |
| `Deal.closed_at` / `won_at` | **B6** | pipeline outcome time | — | **never** — `FB-B9-029`: recognized revenue "does not use Deal value", and does not use Deal timing either |
| `Payment.captured_at` | **B8** | provider capture time | — | **never** in Phase 1; reconciliation evidence only |
| Provider/webhook timestamps | **B8** | provider clock | — | **never**; B9 never reads a provider clock |

**`effective_at` does not exist.** It was adjudicated and rejected (`B9_REVENUE_EVENT_MODEL.md` §2): a second business timestamp beside `recognized_at` creates the "which date is the real one" ambiguity B9 exists to remove, and no frozen contract or frontend behavior calls for it. `B9-D-A019`.

## 2. `recognized_at` is the single period key — resolved (Class A, `B9-D-A019`)

Frozen `BACKEND_ANALYTICS_SEMANTICS.md` defines Recognized Revenue as *"RevenueEvent.recognized_at where status recognized"*. Frozen `analytics-engine.js` agrees mechanically: for all three revenue metrics the period timestamp is `entity.recognizedAt` (`FB-B9-018`), with `timeMode:"event"`. The dashboard card's own trend label is "تاريخ الاعتراف بالإيراد" — *the revenue recognition date* (`FB-B9-029`).

Therefore **daily, monthly, quarterly and attribution reporting are all periodised by `recognized_at`**, and by nothing else.

## 3. Timezone handling

| Layer | Rule |
|---|---|
| Storage | **UTC**, always. `timestamptz`, matching frozen B0's "UTC `created_at/updated_at`" rule |
| Period boundaries | computed in the **workspace timezone**, then converted to a UTC half-open range for the query |
| Presentation | workspace timezone (`FB-B9-047`: `Asia/Riyadh`) |
| API | RFC-3339 with explicit offset on input; UTC (`Z`) on output |

Frozen `BACKEND_ANALYTICS_SEMANTICS.md` already fixes this: *"Event metrics use the event timestamp and the workspace timezone converted from stored UTC."*

A period is always **half-open**, `[start, end)`, in workspace-local terms:

```
"August 2026" for Asia/Riyadh (UTC+3)
  → local  [2026-08-01T00:00:00+03:00, 2026-09-01T00:00:00+03:00)
  → stored [2026-07-31T21:00:00Z,      2026-08-31T21:00:00Z)
```

Half-open removes the boundary double-count entirely: an event at exactly midnight belongs to the later period, once. `AT-TIME-3`.

**DST is not a concern for Asia/Riyadh** (no DST), but the rule is written generally and must hold for any IANA zone: boundaries are computed by the zone's own rules, never by adding a fixed offset. `AT-TIME-4`.

## 4. Reversals correct the original period — resolved (Class A, `B9-D-A020`)

A reversal reduces the net revenue of **the period its event was recognized in**, not the period the reversal was issued in.

| Alternative | Consequence | Verdict |
|---|---|---|
| Reversal hits its own period | January's reported revenue changes depending on *when someone noticed*; two reports of January run months apart disagree; the number is not a fact about January | **rejected** |
| Reversal hits its event's period | January's net is always the truth about January, restated as knowledge improves; the original gross remains visible | **selected** |

Consequence, stated plainly: **a closed period's net figure can change**. That is a property of any correcting financial system and is the honest behavior; the alternative hides corrections in the wrong month. B9 makes it visible rather than silent — every selector response carries `as_of` (§6), and the reversal's own `reversed_at` is retained and reportable so "what changed since last month's report" is answerable (`B9_ANALYTICS_PROJECTIONS.md` §5). `AT-TIME-7`.

## 5. Backdating and future-dating

| Case | Rule | Failure |
|---|---|---|
| `recognized_at` in the past | **allowed**, without limit | — |
| `recognized_at` in the future | **rejected** beyond a **5-minute** clock-skew tolerance | `B9-AF-016` `RECOGNITION_DATE_IN_FUTURE` (422) |
| `reversed_at` in the future | same tolerance, same failure | `B9-AF-016` |
| `occurred_at` (touchpoint) in the future | same tolerance | `B9-AF-016` |

**Why unlimited backdating.** Late recognition of a genuinely past event is ordinary bookkeeping. An arbitrary cut-off ("no more than 90 days") would be a policy B9 has no evidence for, and would block legitimate corrections. Backdating is instead made *visible*: any recognition whose `recognized_at` precedes its `created_at` by more than **7 days** opens a `backdated_recognition` reconciliation case for review (`B9_RECONCILIATION_MODEL.md` §3). Signal, not prohibition.

**Why future-dating is refused.** It would book revenue into a period that has not occurred, letting a workspace report revenue before it exists. The 5-minute tolerance absorbs ordinary client clock skew without opening that door. `AT-TIME-5`, `AT-TIME-6`.

## 6. Late and out-of-order evidence

B9 consumes **no** events (`B9_COMMAND_EVENT_CATALOG.md` §3), so it has no event-ordering problem to solve in the recognition path — there is no listener whose ordering could matter. Upstream facts are read on demand, at the moment a human acts.

Where out-of-order provider activity still matters is **reconciliation**, which compares B9's register against B8's current state at scan time:

| Situation | Deterministic outcome |
|---|---|
| A payment webhook arrives late, after a manual recognition already exists | Reconciliation finds a matched pair; no case, no duplicate. The recognition was never waiting on the webhook |
| A payment is later refunded in B8 | The scan reads the `Refund` fact as settled state (`B9-AM-009`) and opens `refund_without_reversal` carrying its amount. **No automatic reversal** — a human decides (`B9_B8_BILLING_BOUNDARY.md` §6) |
| Provider events arrive out of order in B8 | Invisible to B9: B9 reads B8's *settled current state* at scan time, never a stream position. Two scans over unchanged state produce identical cases |
| A refund exists with no recognition ever made | `refund_without_recognition` case, `severity=info` — usually correct and benign (§`B9_RECONCILIATION_MODEL.md` §3) |

Determinism comes from reading state, not from ordering a stream. `AT-TIME-8`, `AT-RECON-9`.

Every selector response carries an `as_of` UTC timestamp, so a report is always reproducible as "the truth of the register at this instant."

## 7. Negative controls

`AT-TIME-1` **(NC)**: an implementation periodising revenue by `created_at`, `Deal.closed_at`, or `Payment.captured_at` — fails; `recognized_at` is the only period key.
`AT-TIME-2` **(NC)**: an implementation storing a naive local timestamp in any B9 column — fails; all are `timestamptz` UTC.
`AT-TIME-3` **(NC)**: closed-interval period boundaries double-counting a midnight event — fails; ranges are half-open.
`AT-TIME-5` **(NC)**: `recognized_at` more than 5 minutes in the future accepted — fails `B9-AF-016`.
`AT-TIME-7` **(NC)**: a reversal reducing the period it was *issued* in rather than its event's period — fails.

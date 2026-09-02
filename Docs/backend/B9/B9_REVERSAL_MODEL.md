# B9 — Reversal Model

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Principle

Recognized revenue is never un-recognized by deletion or edit. It is **compensated** by an append-only `RevenueReversal` fact that names how much is being taken back, why, by whom, and against which event. The original recognition remains permanently visible and permanently queryable at its original amount.

Frozen `BACKEND_DOMAIN_OWNERSHIP.md` names the command `ReverseRevenueEvent` and the event `RevenueReversed`; frozen `BACKEND_DATA_MODEL.md` names the table `revenue_reversals`. B9 designs them.

## 2. Supported shapes — resolved (Class A, `B9-D-A011`)

| Shape | Supported | How |
|---|---|---|
| Full reversal | yes | one reversal for the event's whole remaining amount |
| Partial reversal | yes | one reversal for less than the remaining amount |
| Multiple partial reversals | yes | N appended rows; each bounded by what remains at its own commit |
| Refund-driven reversal | yes | a human cites the refund as `reason='refund'` with an optional `evidence_ref`; the refund never acts by itself (`B9_B8_BILLING_BOUNDARY.md` §6) |
| Manual correction | yes | `reason='correction'`, then a fresh recognition if a corrected figure is due (§7) |
| Duplicate-recognition cleanup | yes | `reason='duplicate'` |
| Chargeback | yes | `reason='chargeback'` |
| Reversal of a reversal ("un-reverse") | **no** | A reversal is itself immutable. Over-correction is fixed by a *new recognition*, never by negating a compensating fact — otherwise the register acquires signed arithmetic and the audit trail stops being readable. `B9-D-A012` |

## 3. Closed reason set

`full` is not a reason — it is an amount. The `reason` column answers *why*, and is closed:

| `reason` | Meaning |
|---|---|
| `refund` | the customer was refunded |
| `chargeback` | the payment was forcibly reversed by the provider/bank |
| `correction` | the original recognition was wrong (amount, period, or source) |
| `duplicate` | the same economic event was recognized twice |
| `cancellation` | the underlying commercial arrangement was cancelled |
| `write_off` | the amount is deemed uncollectible |

An unrecognised reason is `B9-AF-017`. Reasons are reported dimensions in `B9_ANALYTICS_PROJECTIONS.md` §4 and carry no arithmetic effect.

## 4. Amount rules — the caller supplies **gross only** (Class A, `B9-D-A033`)

A reversal carries **both** `gross` and `net`, because the frozen `RevenueEvent` carries both. But only `gross` is an input. **`net` is derived by B9 and is never accepted from the caller.**

An earlier draft let the caller supply both independently, bounded only by `Σ ≤ event.gross` and `Σ ≤ event.net`. That was wrong, and wrong in a way that corrupted financial truth: a reversal of `gross=1000, net=1` against an event of `gross=1000, net=800` satisfied every bound, exhausted the gross fold, and left **799 net recognized revenue** on an event marked `reversed` — unreversible, and with its source released for re-recognition. The register would then report more net revenue than the source was ever worth. `B9-D-A033` removes the input that made it expressible.

### 4.1 The derivation

A reversal preserves the event's own gross→net ratio. For an event with gross `G` and net `N`, a reversal of gross `Rg`, and `Pg`/`Pn` the sums of all prior committed reversals on that event:

```
cumulative_net(x) = ROUND_HALF_UP( x × N / G , 4 )          -- scale 4, B9_CURRENCY_MONEY_MODEL.md §4

Rn = cumulative_net(Pg + Rg) − Pn
```

This is a **running-total allocation**, not a per-reversal rounding of `Rg × N / G`. The distinction is the whole point:

| | per-reversal rounding | running total (**selected**) |
|---|---|---|
| Rounding error | accumulates across N reversals | cannot accumulate — each step corrects the last |
| Exhaustion | `Σ Rn` may miss `N` by a few minor units | `Σ Rn = N` **exactly** |

The exactness is structural, not lucky: when a reversal exhausts gross, `Pg + Rg = G`, so `cumulative_net(G) = ROUND_HALF_UP(G × N / G, 4) = N`, and therefore `Rn = N − Pn`. **The last reversal always takes exactly the residual net.**

**Gross exhaustion guarantees net exhaustion. The converse does not hold.** This is the correction made by `B9-FIX.2` (`B9-D-A040`), and the direction matters:

| Direction | Holds? | Why |
|---|---|---|
| `Σ gross = G` ⟹ `Σ net = N` | **yes, always** | `cumulative_net(G) = N` by construction, so the gross-exhausting reversal takes exactly `N − Pn` |
| `Σ net = N` ⟹ `Σ gross = G` | **no** | `cumulative_net` rounds. `cumulative_net(Pg) = N` is reachable while `Pg < G`, whenever `G − Pg ≤ G × 0.00005 / N` — i.e. for any event with `G / N ≥ 2` |

The counterexample is concrete and requires only one ordinary, fully-valid reversal:

```
G = 1000, N = 500      Rg = 999.9999   (scale 4 — permitted, B9-AF-008 rejects only scale > 4)
  Rn = ROUND_HALF_UP(999.9999 × 500 / 1000, 4) = ROUND_HALF_UP(499.99995, 4) = 500.0000
  remaining gross = 0.0001        remaining net = 0.0000
```

An earlier draft asserted the biconditional and proved only the first row. Under it the residual `0.0001` of gross was **unreversible** — every attempt derived `Rn = 0` and was rejected by `B9-AF-029` — so the event stayed `partially_reversed` forever and its source was never released. §4.1a closes that residual instead of denying it exists.

### 4.1a The terminal gross-cleanup reversal — resolved (Class A, `B9-D-A040`)

Ordinarily a reversal must allocate net: `Rn > 0`. **Exactly one narrowly-defined exception exists**, and it is the reversal that closes a rounding residual left by §4.1.

> A reversal MAY commit with derived `net = 0` **if and only if all three hold**:
>
> 1. it consumes the exact remaining gross — `Pg + Rg = G`;
> 2. prior committed reversals have already exhausted net — `Pn = N`;
> 3. it is therefore the **terminal** reversal of that event.
>
> In every other case `Rn = 0` is rejected `B9-AF-029 REVERSAL_NET_UNDERFLOW`.

Condition 2 is **entailed** by conditions 1 and 3 — if `Pg + Rg = G` then `Rn = cumulative_net(G) − Pn = N − Pn`, so `Rn = 0` forces `Pn = N`. It is stated and evaluated anyway, defensively, for the same reason `B9-D-A034` states its conjunction: a state that can only be reached when all three are true cannot be reached by an implementation that got one of them wrong.

```
Rn = 0  AND  Pg + Rg <  G   →  reject  B9-AF-029      (non-terminal: an underflowing dust reversal)
Rn = 0  AND  Pg + Rg =  G   →  ALLOW   terminal gross-cleanup reversal
Rn > 0                      →  ALLOW   ordinary reversal
```

Such a row legitimately carries `gross_amount > 0` and `net_amount = 0`. **This is the only way a zero-net reversal row can exist.** It is not an arbitrary zero-net reversal, it cannot be requested against an event with net still standing, and it compensates nothing in the net contract because there is nothing left to compensate — its entire purpose is to retire the gross residual so both folds close together and the event can reach `reversed`.

**The reachability theorem.** From *any* non-exhausted state, a single reversal of the whole remaining gross (`Rg = G − Pg`) always succeeds: it passes `B9-AF-013` (`Rg > 0` because `Pg < G`), passes `B9-AF-014` (`Pg + Rg = G`), and derives `Rn = N − Pn ≥ 0` — allowed as an ordinary reversal when positive and as the terminal cleanup when zero. **No event can be stranded.** `AT-REVR-23`…`AT-REVR-27`.

### 4.2 Worked derivations

| Event | Reversal `gross` | `Pg` | `Pn` | `cumulative_net(Pg+Rg)` | Derived `net` | Remaining gross / net |
|---|---:|---:|---:|---:|---:|---:|
| G=1000, N=800 | 1000 | 0 | 0 | 800.0000 | **800.0000** | 0 / 0 |
| G=1000, N=800 | 250 | 0 | 0 | 200.0000 | **200.0000** | 750 / 600 |
| G=1000, N=800 | 333.3333 | 0 | 0 | 266.6666 | **266.6666** | 666.6667 / 533.3334 |
| G=1000, N=800 | 333.3333 | 333.3333 | 266.6666 | 533.3333 | **266.6667** | 333.3334 / 266.6667 |
| G=1000, N=800 | 333.3334 | 666.6666 | 533.3333 | 800.0000 | **266.6667** | **0 / 0** |

The third-through-fifth rows are the case per-reversal rounding gets wrong: it would produce `266.6666 × 3 = 799.9998` and leave 0.0002 of net stranded on a fully-reversed event. The running total closes exactly.

### 4.3 Validation

| Rule | Failure |
|---|---|
| the request carries **no** `net` field | `B9-AF-035` — `net` is derived, never supplied |
| `gross.amount > 0` | `B9-AF-013` — a zero or negative reversal is not a reversal |
| `Σ prior gross + this gross ≤ event.gross_amount` | `B9-AF-014` `REVERSAL_EXCEEDS_REMAINING` (409) |
| derived `Rn > 0`, **unless** the reversal is the terminal gross-cleanup of §4.1a (`Pg + Rg = G` and `Pn = N`) | `B9-AF-029` `REVERSAL_NET_UNDERFLOW` (422) — a *non-terminal* reversal so small it allocates no net minor unit |
| `currency = event.currency` exactly | `B9-AF-015` `CURRENCY_MISMATCH` (422) |
| event is not already `reversed` (§5) | `B9-AF-018` `ALREADY_FULLY_REVERSED` (409) |
| `gross` scale ≤ 4 | `B9-AF-008` |

`Σ prior net + this net ≤ event.net_amount` is **not a separate validation** — it is a theorem of §4.1, because `cumulative_net` is monotonic non-decreasing and capped at `N`. It is still asserted by reconciliation (`reversal_exceeds_recognized`) as a corruption alarm, precisely because the design believes it cannot fail. The same monotonicity gives `Rn ≥ 0` unconditionally, so a *negative* derived net is unreachable.

`B9-AF-010` (`net > gross`) does **not** apply to reversals: `N ≤ G` on the event, so `Rn ≤ Rg` follows from the derivation. It remains a recognition-only rule.

## 5. The over-reversal invariant, and how it actually holds

The invariant is:

```
Σ revenue_reversals.gross_amount  ≤  revenue_events.gross_amount    (per event)
Σ revenue_reversals.net_amount    ≤  revenue_events.net_amount      (per event)

Σ gross = gross_amount   ⟹   Σ net = net_amount                     (one direction only, §4.1)
```

The implication runs **one way**. Net may reach `N` while gross still carries a rounding residual; the terminal gross-cleanup reversal of §4.1a closes it, after which both folds are exhausted together. `status = 'reversed'` is gated on **both** folds (`B9_REVENUE_EVENT_MODEL.md` §5), so the intermediate state is labelled `partially_reversed` — which is exactly what it is.

**This cannot be a PostgreSQL `CHECK` constraint.** A `CHECK` sees one row and cannot sum sibling rows in another table. Stating it as one would be a design that fails on first contact with the database. It is enforced instead by the mechanism that *can* enforce a cross-row invariant:

> Every `ReverseRevenueEvent` takes `SELECT … FROM revenue_events WHERE id = ? FOR UPDATE` **first**, in the same transaction, then re-reads `Σ revenue_reversals` under that lock, then **derives `net` from the sums read under that lock**, then evaluates the §4.1a terminal test against those same locked sums, then validates, then inserts, then recomputes `status` from **both** folds. Two concurrent reversals therefore serialise on the event row; the second one derives its net against the first one's committed effect, and is rejected if it would breach the gross bound.

The terminal-cleanup exception is decided **inside** that lock and nowhere else. `Pg + Rg = G` and `Pn = N` are read under the lock, so two clients racing to issue the same final cleanup cannot both see themselves as terminal: the first commits and flips `status` to `reversed`; the second re-reads under the lock and is rejected `B9-AF-018` (or replays, if it carries the same idempotency key). `AT-CONC-18`, `AT-CONC-19`.

`B9_IDEMPOTENCY_CONCURRENCY.md` §4 gives the full sequence and the adversarial cases. `AT-CONC-3`…`AT-CONC-6` prove it, including the full-vs-partial race.

## 6. Reversal record

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal |
| `public_id` | `REVR-*` | immutable (`B9-AM-002`) |
| `workspace_id` | FK → workspaces | must equal the event's workspace (`B9-AF-019`) |
| `revenue_event_id` | FK → `revenue_events` | the compensated event |
| `gross_amount` | NUMERIC(18,4) | caller-supplied, > 0 |
| `net_amount` | NUMERIC(18,4) | **derived** by §4.1 under the event row lock; `> 0` for every ordinary reversal and `= 0` only for the terminal gross-cleanup of §4.1a; never caller-supplied |
| `currency` | char(3) | must equal the event's currency |
| `reason` | enum (§3) | |
| `evidence_ref` | text, nullable | opaque operator reference — e.g. a provider refund id. Never resolved or trusted by B9 |
| `note` | text, nullable | ≤ 1000 chars |
| `reversed_by_membership_id` | FK → memberships | the authorizing actor |
| `reversed_at` | timestamptz | caller-supplied business instant; defaults to `now()` |
| `idempotency_key` | text | `UNIQUE (workspace_id, idempotency_key)` |
| `created_at` | timestamptz | system write time |

No `updated_at`, no `deleted_at`, no `version`: the row is written once and never touched again.

**Period attribution.** A reversal corrects the period of the **event it reverses** (`B9_FINANCIAL_MODEL.md` §4). `reversed_at` is retained for audit and for a separate "reversal activity" view, but it does **not** move revenue between reporting periods. `B9-D-A020`; `AT-TIME-7`.

## 7. Corrections — the explicit pattern

There is no edit. A correction is always two facts:

| Situation | Fact 1 | Fact 2 |
|---|---|---|
| Amount was too high by 300 | `ReverseRevenueEvent` 300, `reason='correction'` | — |
| Amount was too low by 300 | — | `RecordRevenueEvent` for 300 against a distinct source_ref, or reverse-and-re-recognize |
| Wrong period | `ReverseRevenueEvent` full, `reason='correction'` | `RecordRevenueEvent` with the right `recognized_at` |
| Wrong currency | `ReverseRevenueEvent` full, `reason='correction'` | `RecordRevenueEvent` in the right currency |
| Wrong source | `ReverseRevenueEvent` full, `reason='correction'` | `RecordRevenueEvent` against the right source |

Every correction is therefore an **auditable compensating pair**, never a mutation. `AT-REVR-12`.

Where the correction requires re-recognizing the *same* source, the source-uniqueness guard (`B9_REVENUE_RECOGNITION_POLICY.md` §7) would block the replacement. B9 resolves this explicitly: the guard is scoped to events that are **not fully reversed** —

```
UNIQUE (workspace_id, source_type, source_entity_type, source_public_id) WHERE status <> 'reversed'
```

That four-column tuple is the **canonical recognition-source identity**, used in exactly this form everywhere in B9 (`B9_REVENUE_RECOGNITION_POLICY.md` §7, `B9_STORAGE_MODEL.md` §1, `B9-D-A028`). `AT-REC-16` **(NC)**.

and `status = 'reversed'` requires **both** folds exhausted (`B9-D-A034`). So a source is released only when the event retains **zero gross and zero net** recognized revenue — never while any net value survives, and never while a gross rounding residual is still open. An event sitting at `Σ net = N` with `Σ gross < G` is **not** released; it is released once the terminal gross-cleanup of §4.1a closes the residual. This is the only exception, it is stated here rather than discovered later, and `AT-REVR-13`/`AT-REVR-14`/`AT-REVR-17`/`AT-REVR-26` prove all four halves.

## 8. Reversal and attribution

Attribution is **derived**, never separately reversed. Because Phase-1 first-touch allocates exactly 100% to one source, the net attributed amount for an event equals its net recognized amount at all times, automatically:

```
net_attributed(event) = net_recognized(event)  when an attribution snapshot exists
                      = 0                      when none exists (the amount is unattributed)
```

1,000 gross / 800 net recognized, fully attributed to Source A; a 300-gross reversal derives 240 net ⇒ net recognized 700 gross-contract / 560 net-contract, **and** net attributed to Source A tracks both exactly. There is no second register to keep in step and therefore no way for them to drift. `B9_ATTRIBUTION_MODEL.md` §6; `AT-ATTR-7`, `AT-ATTR-8`.

## 9. Negative controls

`AT-REVR-4` **(NC)**: a reversal whose amount exceeds the remaining amount — rejected `B9-AF-014`.
`AT-REVR-5` **(NC)**: two concurrent reversals that together exceed the event — exactly one commits.
`AT-REVR-6` **(NC)**: an implementation deleting or updating a `revenue_reversals` row — fails.
`AT-REVR-7` **(NC)**: an implementation representing a reversal as a negative-amount `revenue_events` row — fails; `gross_amount > 0` is a `CHECK` on `revenue_events`, and a negative recognition would corrupt every gross total.
`AT-REVR-8` **(NC)**: a reversal in a different currency from its event — rejected `B9-AF-015`.
`AT-REVR-15` **(NC)**: a reversal request supplying its own `net` — rejected `B9-AF-035`; `net` is derived (§4).
`AT-REVR-16` **(NC)**: an implementation deriving `net` by per-reversal rounding of `Rg × N / G` instead of the running total of §4.1 — fails; it strands net on a fully-reversed event.
`AT-REVR-17` **(NC)**: `status = 'reversed'` while `Σ net < net_amount` — structurally unreachable under §4.1; a hit is corruption.
`AT-REVR-9` **(NC)**: a reversal against an event in another workspace — `ENTITY_NOT_FOUND`, never `PERMISSION_DENIED` (no cross-workspace existence disclosure).
`AT-REVR-23`: `G=1000, N=500`, `Rg=999.9999` derives `Rn=500.0000`; the event stays `partially_reversed` with `0.0001` gross outstanding and its source **not** released.
`AT-REVR-24`: the following `Rg=0.0001` derives `Rn=0` and **commits** as the terminal gross-cleanup (§4.1a); both folds exhaust, `status='reversed'`, the source is released.
`AT-REVR-25` **(NC)**: a reversal deriving `Rn=0` that would **not** exhaust gross — rejected `B9-AF-029`.
`AT-REVR-26` **(NC)**: an implementation releasing the source, or setting `status='reversed'`, while a gross rounding residual is still open — fails; both folds are required (`B9-D-A034`).
`AT-REVR-27` **(NC)**: an implementation admitting any zero-net reversal outside the three conditions of §4.1a — fails.
`AT-REVR-28` **(NC)**: an implementation asserting `Σ gross = G ⟺ Σ net = N` (a biconditional) anywhere in code, comment or constraint — fails; only the forward implication holds (§4.1, `B9-D-A040`).

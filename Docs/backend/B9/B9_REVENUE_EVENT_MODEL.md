# B9 — RevenueEvent Model

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. The aggregate

`RevenueEvent` is the single authoritative record of one recognition decision. It is created by exactly one command (`RecordRevenueEvent`), never updated except for its derived `status`, and never deleted.

## 2. Field adjudication

The frozen `BACKEND_OPENAPI_V1.yaml` schema `RevenueEvent` is `additionalProperties: false` with eight required fields. B9 may not add or remove an API field. Storage carries additional columns that the DTO does not expose — permitted, because the frozen contract governs the wire shape, not the table.

| Candidate field | Verdict | Where | Rationale |
|---|---|---|---|
| `id` | **kept** — internal | column | UUIDv7, frozen ADR-006; never exposed |
| `public_id` | **kept** | column + DTO | `REV-*`, frozen registry §A, immutable |
| `workspace_id` | **kept** | column | tenancy root; never in the DTO (the session supplies scope) |
| `source_type` | **kept** | column + DTO | frozen polymorphic contract; closed set of 5 |
| `source_ref` | **kept** | column (`source_entity_type`, `source_public_id`) + DTO (`EntityRef`) | frozen; stored decomposed so it can be indexed and constrained |
| `gross` | **kept** | column `gross_amount` + `currency` → DTO `Money` | frozen required |
| `net` | **kept** | column `net_amount` + `currency` → DTO `Money` | frozen required |
| `currency` | **kept** | one column | frozen required; single column serves gross, net and the DTO mirror — one currency per event, so three copies would be three chances to disagree |
| `recognized_at` | **kept** | column + DTO | frozen required; the reporting-period timestamp |
| `status` | **kept** | column + DTO | frozen required; derived (§5) |
| `effective_at` | **rejected** | — | A second business timestamp with no frozen basis and no frontend evidence. `recognized_at` already carries period semantics; a second one creates the "which date is the real one" ambiguity B9 exists to remove. `B9-D-A019` |
| `recognition_type` | **rejected** | — | Phase 1 has exactly one recognition mode (manual/explicit). A type column with one value is a future migration pretending to be a design. `B9-D-A008` |
| `recognition_reference` | **rejected** | — | `source_type`+`source_ref` *is* the reference. `B9-D-A007` |
| `payment_id` / `subscription_id` / `deal_id` / `lead_id` / `business_id` | **rejected** | — | The frozen DTO text says the polymorphic pair "**replaces** separate typed `business_ref`/`lead_ref`/`deal_ref`/`external_payment_ref`/`invoice_ref` fields". Re-adding them would directly contradict a frozen contract. `B9-D-A005` |
| `idempotency_key` | **kept** — storage only | column | Frozen `RevenueEventCreate` requires it on input; the frozen `RevenueEvent` response schema does **not** carry it, so it is stored and never returned |
| `actor` | **kept** — storage only | column `recognized_by_membership_id` | ADR-007 makes the actor mandatory; not in the frozen response DTO |
| `note` | **kept** — storage only | column, nullable | operator context; never financially significant |
| `created_at` | **kept** — storage only | column | system write time, distinct from `recognized_at` |
| `updated_at` | **kept** — storage only | column | moves only when `status` is recomputed |
| `version` | **rejected** | — | Frozen ADR-010 scopes the version integer to *editable* resources. A `RevenueEvent` is not editable; optimistic concurrency would imply it is. Reversal concurrency is handled by row lock + constraint (`B9_IDEMPOTENCY_CONCURRENCY.md` §4). `B9-D-A025` |
| `deleted_at` / `archived_at` | **rejected** | — | Financial facts are never deleted or archived. Their absence is the enforcement. `B9-D-A010` |

## 3. Immutability — resolved (Class A, `B9-D-A010`)

| Question | Answer |
|---|---|
| Can a `RevenueEvent` be updated? | **No**, except the derived `status` column (§5). No command, endpoint, or admin surface can change any other column. |
| Can it be deleted? | **No.** No `DELETE` endpoint, no `deleted_at`, no hard-delete path. Workspace deletion is governed by `B9_SECURITY_PRIVACY.md` §5. |
| Can `gross`/`net` change? | **No.** A wrong amount is corrected by reversal + fresh recognition (`B9_REVERSAL_MODEL.md` §7). A reversal's own `net` is derived from these, never written back onto them. |
| Can `recognized_at` change? | **No.** A wrong period is corrected the same way. |
| Can `currency` change? | **No.** There is no conversion authority (`B9-D-A017`). |
| Can `source_type`/`source_ref` change? | **No.** The evidence a recognition rests on cannot be swapped after the fact. |
| Can attribution change? | The event's attribution **snapshot** is immutable (`B9_FIRST_TOUCH_MODEL.md` §6). Later Lead/Deal/Business edits never rewrite it. |

`REVENUE_EVENT_DELETE_PATHS = 0`. `UNCONTROLLED_REVENUE_MUTATION_PATHS = 0`.

## 4. Lifecycle

```
        RecordRevenueEvent
               │
               ▼
        ┌──────────────┐   first reversal, Σ < amount   ┌────────────────────┐
        │  recognized  │───────────────────────────────▶│ partially_reversed │
        └──────┬───────┘                                └─────────┬──────────┘
               │                                                  │
               │ reversal for the full amount                     │ reversals reach the full amount
               │                                                  │
               ▼                                                  ▼
        ┌───────────────────────────────────────────────────────────┐
        │                        reversed                           │
        └───────────────────────────────────────────────────────────┘
```

Three states, monotonic, no terminal cleanup, no return edges. There is no `draft`, no `pending`, no `void`: a `RevenueEvent` exists only once recognition has been decided, so a pre-recognition state would be a row asserting something that has not happened.

```
REVENUE_EVENT_STATE_COUNT = 3   (recognized, partially_reversed, reversed)
```

The transition into `reversed` fires only when the gross **and** net folds are both exhausted (§5). Gross exhaustion *guarantees* net exhaustion (`B9_REVERSAL_MODEL.md` §4.1); the converse does not hold, because rounding can drive the net fold to `N` while a gross residual remains. That residual is closed by the terminal gross-cleanup reversal of `B9_REVERSAL_MODEL.md` §4.1a, after which both folds are exhausted and the state is reached. It is never entered while net revenue survives, and never entered while gross is still outstanding.

## 5. `status` is derived from **both** folds, never set (Class A, `B9-D-A027`, `B9-D-A034`)

`status` is a materialised function of the reversal register, maintained inside the same transaction that writes a reversal, under the `SELECT … FOR UPDATE` lock that transaction already holds on the event row:

```
Σg = Σ reversals.gross_amount        Σn = Σ reversals.net_amount

status = 'recognized'          when Σg = 0                             (⟺ Σn = 0, see below)
       = 'reversed'            when Σg = gross_amount AND Σn = net_amount
       = 'partially_reversed'  otherwise
```

The `⟺` on the `recognized` line is the one biconditional that *does* hold, and it holds for a reason worth stating: no reversal can carry `net = 0` unless it is the terminal gross-cleanup, which requires `Pn = net_amount > 0` — so a zero-net reversal can never be an event's *first* reversal. `Σg = 0` and `Σn = 0` therefore mean the same thing: no reversal exists. This is not the exhaustion biconditional `AT-REVR-28` forbids (`B9-D-A040`).

**`reversed` requires both folds to be exhausted.** An earlier draft derived `status` from the gross fold alone and asserted that the two folds "always coincide, because a reversal's net is bounded proportionally" — a claim `B9_REVERSAL_MODEL.md` §4 did not then make.

`B9-FIX.1` removed `net` as a caller input and made `Σg = gross_amount ⟹ Σn = net_amount` a theorem of the running-total derivation. `B9-FIX.2` corrects the remaining overstatement: **only that implication holds, not its converse** (`B9-D-A040`, `B9_REVERSAL_MODEL.md` §4.1). Rounding can leave `Σn = net_amount` while `Σg < gross_amount`, and such an event is `partially_reversed` — correctly, because gross revenue is still outstanding on it. The terminal gross-cleanup reversal closes that residual.

The conjunction above is therefore not merely defensive, it is **load-bearing**: it is what keeps the rounding-residual state out of `reversed`. A gross-only rule would mislabel an event that still carries net revenue; a net-only rule would mislabel an event that still carries gross. `status` is load-bearing twice over:

| `status` is read by | Consequence of getting it wrong |
|---|---|
| `uq_revenue_events_source … WHERE status <> 'reversed'` | a source would be released for re-recognition while net revenue still stands on the original event |
| `B9-AF-018 ALREADY_FULLY_REVERSED` | surviving net revenue would become permanently unreversible |

Both are exactly the corruption `B9-D-A034` exists to prevent, so the state that gates them is defined conjunctively and defensively.

It is materialised rather than computed at read time so that the very common query "events in period" stays a single indexed scan. The invariant that `status` equals the two folds is checked by reconciliation (`B9_RECONCILIATION_MODEL.md` §3, `status_fold_mismatch`) — a defect detector, not a repair-by-guess.

**`status` is not a revenue filter.** No B9 selector filters on it; recognized revenue is the register net of reversals, not the rows whose `status` happens to read `recognized` (`B9_ANALYTICS_PROJECTIONS.md` §2, `B9-AM-010`).

## 6. Storage-to-DTO mapping

| Column | DTO field | Note |
|---|---|---|
| `public_id` | `public_id` | `REV-*` |
| `source_type` | `source_type` | |
| `source_entity_type`, `source_public_id` | `source_ref` | assembled into the frozen `EntityRef` |
| `gross_amount`, `currency` | `gross` | assembled into the frozen `Money` |
| `net_amount`, `currency` | `net` | assembled into the frozen `Money` |
| `currency` | `currency` | the frozen mirror field |
| `recognized_at` | `recognized_at` | RFC-3339 UTC |
| `status` | `status` | |
| `workspace_id`, `idempotency_key`, `recognized_by_membership_id`, `note`, `created_at`, `updated_at` | *(not exposed)* | storage only |

The response carries **no** reversal or attribution data. Net figures and attribution are served by their own read models (`B9_ANALYTICS_PROJECTIONS.md`), so a `RevenueEvent` DTO never becomes a second place where a total lives.

## 7. Negative controls

`AT-IMM-1` **(NC)**: any `PATCH`/`PUT` route addressing a `RevenueEvent` — fails; none exists in `B9_API_DTO_CONTRACTS.md`.
`AT-IMM-2` **(NC)**: an implementation updating `gross_amount`, `net_amount`, `currency`, `recognized_at`, `source_type` or `source_ref` after insert — fails.
`AT-IMM-3` **(NC)**: an implementation exposing `DELETE /revenue/events/{id}` or soft-deleting via a nullable timestamp — fails.
`AT-IMM-4` **(NC)**: an implementation adding a typed `deal_id`/`payment_id` column or DTO field alongside `source_ref` — fails; contradicts the frozen "replaces separate typed refs" clause.
`AT-IMM-5`: `status` reaches `reversed` only via the two-fold rule in §5, never by direct assignment.
`AT-IMM-6` **(NC)**: an implementation deriving `status` from the gross fold alone — fails; it can mark an event `reversed` while net recognized revenue survives.
`AT-IMM-7` **(NC)**: an implementation deriving `status` from the **net** fold alone — fails; a rounding residual would be labelled `reversed` while gross revenue is still outstanding (`B9-D-A040`).

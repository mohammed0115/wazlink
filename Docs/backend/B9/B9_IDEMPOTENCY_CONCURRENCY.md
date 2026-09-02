# B9 — Idempotency & Concurrency

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.

## 0. Frozen basis

`BACKEND_IDEMPOTENCY_STANDARD.md`: *"RevenueEvent creation uses an explicit source reference and unique source/idempotency key."* Both halves are honoured — two independent guards, neither substituting for the other.

## 1. Idempotency identity per mutation

| Command | Primary identity | Secondary guard | Enforced by |
|---|---|---|---|
| `RecordRevenueEvent` | `(workspace_id, idempotency_key)` | `(workspace_id, source_type, source_entity_type, source_public_id)` where `status <> 'reversed'` — the canonical source identity (`B9_STORAGE_MODEL.md` §1) | `uq_revenue_events_idempotency`, `uq_revenue_events_source` |
| `ReverseRevenueEvent` | `(workspace_id, idempotency_key)` | the Σ-bound under row lock (§4) | `uq_revenue_reversals_idempotency` |
| `RecordTouchpoint` | `(workspace_id, idempotency_key)` | `(workspace_id, subject_type, subject_public_id, position)` | two unique indexes |
| `ResolveFinancialReconciliationCase` | `(workspace_id, resolution_idempotency_key)` | terminal-state check under row lock | `uq_frc_resolution_idempotency` — `UNIQUE (workspace_id, resolution_idempotency_key) WHERE resolution_idempotency_key IS NOT NULL` (`B9_STORAGE_MODEL.md` §5) + `B9-AF-024` |
| `OpenFinancialReconciliationCase` | `(workspace_id, fingerprint)` where status live | — | partial unique index |

`idempotency_key` is **mandatory** on all four human commands — for recognition it is a frozen `required[]` field of `RevenueEventCreate`, and B9 extends the same discipline to the other three rather than leaving them weaker than the command they compensate.

**The reconciliation-resolution key lives on the case row, and is nullable.** An earlier draft declared `(workspace_id, idempotency_key)` for this command and said it was "enforced by a unique index" — but neither the column nor the index existed anywhere in the storage model, so the durable enforcement was asserted and not built. `B9-FIX.1` adds `resolution_idempotency_key` and `resolution_request_hash` to `financial_reconciliation_cases`, both written only on successful resolution and immutable thereafter, under a **partial** unique index.

Nullable and partial, for a reason: a case is opened by the scanner and may be assigned and investigated long before anyone resolves it. A NOT NULL key at open time would have had to invent a key for an action nobody had taken, and a full unique index would have collided every open case against every other on `NULL`. And because a case has exactly **one** terminal resolution (`B9_RECONCILIATION_MODEL.md` §4 — `resolved`/`dismissed` are terminal, and a recurrence opens a *new* case rather than reopening this one), one key per case is the correct cardinality; no separate resolution-attempt table is warranted, and B9 does not add one.

## 2. Replay semantics

| Case | Outcome |
|---|---|
| Same key, **same** semantic payload | The stored result is returned verbatim — same `public_id`, same status code as the original success. No second row. |
| Same key, **different** semantic payload | `409 IDEMPOTENCY_CONFLICT` (`B9-AF-003`). Nothing is written. |
| Different key, same source (recognition) | `409 DUPLICATE_RECOGNITION` (`B9-AF-002`) — the secondary guard. This is what makes payment/webhook replay safe even when the retry generates a fresh key. |
| Different key, same event (reversal) | **Allowed** — a genuine second partial reversal. Bounded by §4. |

The **semantic payload** for comparison is the canonicalised set of business fields, and it differs per command:

| Command | Semantic payload | Where the comparison basis lives |
|---|---|---|
| `RecordRevenueEvent` | `source_type`, `source_ref`, `gross`, `net`, `currency`, `recognized_at` | the `revenue_events` row itself — every field is stored, so nothing extra is needed |
| `ReverseRevenueEvent` | `revenue_event_ref`, `gross`, `currency`, `reason`, `reversed_at` | the `revenue_reversals` row itself. `net` is **not** in the payload: it is derived, so it cannot differ between two requests that agree on `gross` — including a terminal gross-cleanup, whose derived `net` is 0 |
| `RecordTouchpoint` | `subject_ref`, `source_type`, `source_ref`, `origin_kind`, `occurred_at`, `position` | the `attribution_touchpoints` row itself |
| `ResolveFinancialReconciliationCase` | `status`, `resolution_action`, `resolution_reason`, `resolution_command_ref`, `next_review_at` | `resolution_request_hash` — a SHA-256 over the canonicalised payload, stored beside the key, because the case row keeps the *outcome* of the resolution and not every input verbatim |

`note` is excluded everywhere (cosmetic). Comparison is over canonical decimal values, so `100.00` and `100.0000` are the *same* payload, not a conflict (`AT-IDEM-5`).

For the three financial commands the stored row **is** the replay record, so no separate idempotency store exists and none is needed — the durable guarantee is the unique index plus the row it protects. `IDEMPOTENCY_CONCURRENCY_GAPS = 0`, and no B9 idempotency identity depends on Redis or any cache.

## 3. Recognition concurrency

`RecordRevenueEvent` needs **no lock**. Two concurrent attempts for the same source race to insert; PostgreSQL's unique index decides. The loser receives `B9-AF-002` or `B9-AF-003` and writes nothing. Exactly one authoritative recognition survives — an insert race, not a read-modify-write, so there is no window in which both could believe they won.

The attribution snapshot is written in the **same transaction** as the event insert. If the transaction rolls back, both disappear together; there is no state where an event exists without its resolved attribution having been attempted.

## 4. Reversal concurrency — the critical path

The over-reversal invariant is a cross-row invariant and cannot be a `CHECK` (`B9_STORAGE_MODEL.md` §2a). The sequence:

```
BEGIN;

1.  SELECT id, workspace_id, gross_amount, net_amount, currency, status
      FROM revenue_events
     WHERE workspace_id = :ws AND public_id = :rev
       FOR UPDATE;                                  -- serialises all reversals of this event

2.  if not found                  -> B9-AF-019 / 404, ROLLBACK
    if status = 'reversed'        -> B9-AF-018, ROLLBACK
    if currency <> :currency      -> B9-AF-015, ROLLBACK

3.  SELECT COALESCE(SUM(gross_amount),0) AS Pg, COALESCE(SUM(net_amount),0) AS Pn
      FROM revenue_reversals
     WHERE revenue_event_id = :id;                  -- read under the lock held at step 1

4.  if Pg + :gross > event.gross_amount -> B9-AF-014, ROLLBACK

4b. DERIVE the net, from values read under this lock:      -- B9_REVERSAL_MODEL.md §4.1
      Rn := ROUND_HALF_UP((Pg + :gross) * event.net_amount / event.gross_amount, 4) - Pn

    -- Rn < 0 is unreachable (cumulative_net is monotonic); treat as corruption.
    if Rn <  0 -> B9-AF-030 INTERNAL_ERROR, ROLLBACK

    -- the terminal gross-cleanup exception, decided ONLY here, under this lock:
    terminal := (Pg + :gross = event.gross_amount) AND (Pn = event.net_amount)
    if Rn =  0 AND NOT terminal -> B9-AF-029 REVERSAL_NET_UNDERFLOW, ROLLBACK
    if Rn =  0 AND     terminal -> proceed; this row books gross > 0 and net = 0
                                   (B9_REVERSAL_MODEL.md §4.1a, B9-D-A040)

5.  INSERT INTO revenue_reversals (gross_amount=:gross, net_amount=Rn, ...);
                                                    -- uq_..._idempotency also applies

6.  UPDATE revenue_events
       SET status = CASE WHEN Pg + :gross = gross_amount
                          AND Pn + Rn     = net_amount
                         THEN 'reversed' ELSE 'partially_reversed' END,
           updated_at = now()
     WHERE id = :id;                                -- same row, already locked

7.  append outbox RevenueReversed;

COMMIT;
```

Step 1 is the whole design. Every reversal of a given event serialises on that row, so step 3 always observes every previously **committed** reversal, and steps 4 and **4b** are both evaluated against totals that cannot change underneath them.

**Step 4b must be inside the lock.** The derived net is a function of `Pg` and `Pn`; deriving it before the lock — from a stale read — would let two concurrent partial reversals each compute their net against the same prior state and together over-allocate net while gross stayed within bounds. `AT-CONC-16` **(NC)** is the control.

**The `terminal` test must be inside the same lock, for the same reason.** It is a predicate over `Pg`, `Pn` and the event's own columns, all read under the lock at steps 1 and 3. Evaluated outside it, two clients could each read `Pg + Rg = G` against the same stale prior state and both believe themselves terminal — booking the residual gross twice. Serialised, exactly one can: the first commits and step 6 flips `status` to `reversed`; the second re-reads at step 2 and is rejected `B9-AF-018` (or, on the same idempotency key, replays the first one's stored row). `AT-CONC-18`, `AT-CONC-19` **(NC)**.

The running-total form makes step 6's conjunction cheap and exact: when `Pg + :gross = gross_amount`, step 4b yields `Rn = net_amount − Pn` by construction, so both equalities in step 6 become true in the same commit. That is the **forward** implication only — gross exhaustion forces net exhaustion. The converse fails on rounding, which is precisely why the terminal-cleanup branch exists and why step 6 tests both folds rather than either one (`B9-D-A040`).

## 5. Adversarial scenarios — every one the brief names

| # | Scenario | Deterministic outcome |
|---|---|---|
| 1 | Two recognitions for the same payment | One inserts; the other gets `B9-AF-002` (source guard) or `B9-AF-003` (key guard). **One** event. `AT-CONC-1` |
| 2 | Payment-triggered recognition vs manual recognition | Cannot arise — there is no payment-triggered path (`B9-D-A008`). Two humans racing reduces to case 1. `AT-CONC-2` |
| 3 | Two partial reversals, together within the bound | Both succeed, serialised. Net is correct. `AT-CONC-3` |
| 4 | Two partial reversals, together exceeding the bound | The first commits; the second re-reads under the lock and gets `B9-AF-014`. **Never over-reversed.** `AT-CONC-4` |
| 5 | Full reversal racing a partial reversal | Whichever locks first commits. If full won, the partial gets `B9-AF-018`. If partial won, the full gets `B9-AF-014` (it no longer fits) and must be re-issued for the remaining amount. `AT-CONC-5` |
| 5b | Two partial reversals whose **gross** fits but whose independently-derived **net** would not | Cannot arise — net is derived under the lock from the committed prior sums (§4 step 4b), never supplied and never precomputed. `AT-CONC-16` |
| 5c | **Two clients race the same terminal gross-cleanup** (`Rg` = the whole remaining gross, deriving `Rn = 0`) | They serialise on the event row. The first commits the cleanup row and `status` becomes `reversed`. The second re-reads under the lock at step 2 and gets `B9-AF-018 ALREADY_FULLY_REVERSED`. The residual gross is booked exactly once. `AT-CONC-18` |
| 5d | The same terminal cleanup **replayed** with the same idempotency key | `uq_revenue_reversals_idempotency` admits one row; the replay returns the stored result verbatim — same `REVR-*`, same `201`. No second cleanup row. `AT-CONC-19`, `AT-IDEM-11` |
| 5e | The same terminal-cleanup key with a **different** payload (different `gross`, `reason` or `reversed_at`) | `409 IDEMPOTENCY_CONFLICT` (`B9-AF-003`). Nothing is written. `AT-IDEM-12` **(NC)** |
| 6 | Two identical full reversals | Same key ⇒ replay, one row. Different keys ⇒ the second gets `B9-AF-018`. `AT-CONC-6` |
| 7 | Recognition racing a refund in B8 | Independent — B8 refunds never touch B9 (`B9_B8_BILLING_BOUNDARY.md` §6). The recognition commits; reconciliation later opens `refund_without_reversal`. `AT-CONC-7` |
| 8 | Recognition racing a reconciliation scan | The scan is read-only and sees either the committed event or not. Either way it opens at most one case; a stale case is closed on the next scan. `AT-CONC-8` |
| 9 | Two attributions for one event | Impossible — `UNIQUE (revenue_event_id)`, and the row is written inside the recognition transaction. `AT-CONC-9` |
| 10 | Reconciliation resolution racing a manual correction | The case row is locked `FOR UPDATE`; the second resolver gets `B9-AF-024`. The financial commands they each may have run are independent and separately idempotent. `AT-CONC-10` |
| 10b | Two resolutions of one case with the **same** key | The partial unique index on `(workspace_id, resolution_idempotency_key)` admits one; the second replays the stored outcome if `resolution_request_hash` matches, else `B9-AF-003`. `AT-CONC-17`, `AT-IDEM-7`, `AT-IDEM-8` |
| 11 | Two touchpoints claiming the same `position` | Unique index rejects the second; `B9-AF-020`. `AT-CONC-11` |
| 12 | Reversal racing deletion of its event | Impossible — no delete path, plus `ON DELETE RESTRICT`. `AT-CONC-12` |
| 13 | Two scans detecting the same condition | Partial unique on `fingerprint` — one live case. `AT-CONC-13` |

## 6. Transaction boundaries

| Command | One transaction contains |
|---|---|
| `RecordRevenueEvent` | source validation read → `revenue_events` insert → **`SAVEPOINT`** → provenance walk + first-touch resolution → `revenue_attributions` insert (0/1) → **`RELEASE`** (or `ROLLBACK TO SAVEPOINT` on any error, then open `attribution_unresolved`) → outbox `RevenueRecognized` (+ `RevenueAttributionAssigned`) → audit |
| `ReverseRevenueEvent` | §4 steps 1-7 → audit |
| `RecordTouchpoint` | subject read → insert → outbox → audit |
| `ResolveFinancialReconciliationCase` | lock case → validate → update status fields **+ `resolution_idempotency_key` + `resolution_request_hash`** → outbox → audit |

Events are published through the **frozen transactional outbox** (ADR-005), inside the same transaction as the row. A committed financial fact therefore always has its event, and a rolled-back one never emits.

**Attribution failure never rolls back recognition — and the mechanism is named.** In PostgreSQL an uncaught error inside a transaction aborts it, so "the recognition still commits" is true only if the failing work sits in a subtransaction that can be discarded on its own. B9 therefore wraps resolution in an explicit `SAVEPOINT attribution_resolution` with a `SET LOCAL statement_timeout`; on any error or timeout the handler issues `ROLLBACK TO SAVEPOINT attribution_resolution`, which returns the transaction to a usable state and discards nothing but the attribution attempt. The event then commits with no attribution row and `attribution_unresolved` is opened. `B9_FIRST_TOUCH_MODEL.md` §4.1; `AT-FT-12`, `AT-CONC-15`.

An earlier draft asserted the outcome without the mechanism, which would have left an implementer to discover the aborted-transaction behaviour at runtime. The bounded timeout is retained for its original purpose: a slow B2/B3 must not hold a financial write transaction open.

## 7. No optimistic version on financial rows

Frozen ADR-010 scopes the `version` integer to *editable* resources. `RevenueEvent` and `RevenueReversal` are not editable, so neither carries `version` and neither returns `STALE_VERSION`. Concurrency is handled by unique indexes (recognition) and row locks (reversal) — mechanisms appropriate to append-only data. Attaching an optimistic version to an immutable row would advertise an editability that does not exist. `B9-D-A025`.

`FinancialReconciliationCase` **is** editable (status, assignment). It is protected by `FOR UPDATE` plus a terminal-state check rather than a version integer, because its only legal transitions are into terminal states — a lost-update window an integer would not close any better.

## 8. Negative controls

`AT-IDEM-1` **(NC)**: an implementation accepting `RecordRevenueEvent` without `idempotency_key` — fails.
`AT-IDEM-2` **(NC)**: same key + different payload silently returning the original result — fails; must be `B9-AF-003`.
`AT-IDEM-3` **(NC)**: an implementation relying on the idempotency key alone, so a fresh key duplicates revenue for one source — fails; `B9-AF-002` is the guard.
`AT-CONC-4` **(NC)**: concurrent reversals summing beyond the event amount — must be impossible.
`AT-CONC-14` **(NC)**: a reversal path that reads `Σ reversals` **before** taking the event row lock — fails; the read must be under the lock.
`AT-CONC-15`: an error inside attribution resolution rolls back to the savepoint and the recognition still commits, unattributed.
`AT-CONC-16` **(NC)**: a reversal path deriving `net` outside the event row lock, or from values read before it — fails.
`AT-CONC-18` **(NC)**: two concurrent terminal gross-cleanup reversals of one event — exactly one commits; the other gets `B9-AF-018`. The residual gross is never booked twice.
`AT-CONC-19`: a terminal gross-cleanup replayed with the same key and payload returns the stored `REVR-*` unchanged, with no second row.
`AT-CONC-20` **(NC)**: an implementation evaluating the §4.1a `terminal` predicate outside the event row lock, or from values read before it — fails; both clients could believe themselves terminal.
`AT-CONC-17`: two concurrent resolutions of one case with the same `idempotency_key` — one commits, the other replays it.
`AT-IDEM-7`: `ResolveFinancialReconciliationCase` replayed with the same key and payload returns the stored outcome, unchanged.
`AT-IDEM-8` **(NC)**: the same resolution key with a different payload — `B9-AF-003`, nothing written.
`AT-IDEM-9` **(NC)**: any B9 idempotency identity enforced only in Redis or an in-process cache — fails; every one is a database unique index.
`AT-IDEM-11`: a terminal gross-cleanup reversal replayed with the same key and payload — the stored zero-net row is returned; no second row.
`AT-IDEM-12` **(NC)**: the same terminal-cleanup key with a different payload — `B9-AF-003`, nothing written.

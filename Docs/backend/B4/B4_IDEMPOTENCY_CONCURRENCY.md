# B4 — Idempotency and Concurrency

> **B4 status:** Target design only. Idempotency for admission is covered in `B4_COST_RATE_LIMIT_MODEL.md` §8; this document covers the remaining concurrency questions §23–§24 of the brief raise, plus the "current pointer" mechanism `B4_INTELLIGENCE_RUN_STATE_MACHINE.md` and `B4_SCORING_MODEL.md` §8 both depend on.

## 1. Idempotency layers

| # | Boundary | Key | Mechanism | Outcome on duplicate |
|---|---|---|---|---|
| 1 | HTTP request | `Idempotency-Key` | frozen B0 standard (workspace + principal + endpoint + body hash) | stored response replayed, no second admission (`B4_COST_RATE_LIMIT_MODEL.md` §8) |
| 2 | Same-input reuse | `(business_id, input_hash)` | `B4_COST_RATE_LIMIT_MODEL.md` §7 | existing run reused/coalesced |
| 3 | Provider call → structured result write | `(run_id, provider_call_sequence)` unique | one `IntelligenceUsageRecord` row per attempt, unique constraint absorbs a duplicated callback/retry write | second write is a no-op |
| 4 | Current-pointer flip | `(business_id) WHERE is_current` partial unique | §4 below | only one run per Business can ever hold the flag |

## 2. `AnalyzeBusiness` / `ReanalyzeBusinessIntelligence` — same request ID

A request replayed under the identical `Idempotency-Key` always returns the identical stored `202` response, regardless of what has happened to the run since (even if it has since completed or failed) — idempotency replay is a transport guarantee, not a "give me current status" query. An actor wanting current status calls `GET /businesses/{id}/intelligence` (`B4_API_DTO_CONTRACTS.md` §2).

## 3. Concurrent requests for the same Business

Two actors request analysis for the same Business at the same moment, same or different input:

| Case | Outcome |
|---|---|
| Same `Idempotency-Key` | layer 1 — one admitted, one replayed |
| Different keys, same input (`input_hash` identical) | layer 2 — first admits a new run (or reuses an existing one), second reuses/coalesces onto the same run; **never two runs for one input** |
| Different keys, different input (e.g. one request's snapshot captured before, one after, a concurrent Business field update) | both admitted as distinct runs, each consuming its own admission slot — this is not a race to prevent, because both are legitimately answering "what did the evidence say at this moment," and §4 governs which one becomes current |
| `ReanalyzeBusinessIntelligence` requested while a run for the same Business is already `queued`/`running` (of any input) | **coalesced onto the already in-flight run** — its bypass of the same-input reuse check (`B4_COST_RATE_LIMIT_MODEL.md` §7) only skips reuse of a *completed* run; it never spawns a second concurrent run racing the first, which would waste an admission slot on a Business already being analyzed |

## 4. The "current" pointer, and why a stale completion can never silently win

> **`B4-D-A004`/`B4-D-A022`: `IntelligenceRun.is_current` is an explicit boolean, flipped inside the same transaction that marks a run `completed`. A run is only permitted to claim `is_current = true` if no run with a strictly newer `input_snapshot_version` for the same Business already holds it.**

```
ON run completion (status → completed):
  BEGIN
    SELECT current_snapshot_version FROM intelligence_runs
      WHERE business_id = :business_id AND is_current
      FOR UPDATE;                                   -- row lock, mirrors B3's version-checked lock pattern

    IF completing_run.input_snapshot_version > current_snapshot_version (or no current exists):
        UPDATE intelligence_runs SET is_current = false WHERE business_id = :business_id AND is_current;
        UPDATE intelligence_runs SET is_current = true  WHERE id = completing_run.id;
    ELSE:
        -- completing_run is retained as history but never becomes current
        NO-OP on is_current
  COMMIT
```

This directly answers the brief's §24 attack: *"a Business is rediscovered while a run is in progress"* or *"score model version changes mid-run"* — a run that started against an older snapshot, or under an older `scoring_model_version`, and finishes **after** a newer run has already gone current, is retained in full (immutability, `B4_INTELLIGENCE_RUN_STATE_MACHINE.md` §2) but never overwrites the newer result. **A stale completion can never silently become current truth.**

## 5. Attack sequence, traced

```
t0  Business version = 5. Run A admitted, snapshot at v5.
t1  Business rediscovered materially → version = 6.
t2  Run B admitted (actor requests re-analysis), snapshot at v6.
t3  Run B completes first (faster provider round trip) → is_current, snapshot_version = 6.
t4  Run A completes → snapshot_version = 5 < 6 → NO-OP, Run A retained as history, never current.
```

Reversing t3/t4's ordering changes nothing about the final state: whichever run holds the higher `input_snapshot_version` wins the pointer, regardless of completion order. This is the same "compare, don't assume completion order," row-locked guard B3 uses for its own version-checked transitions.

## 6. Lead conversion mid-run

A Business converting to a Lead while a run is `queued`/`running` has no effect on the run — `B4_INTELLIGENCE_SUBJECT_MODEL.md` §6 already establishes that conversion touches no intelligence state. The run completes (or fails/cancels) exactly as it would have, and `Lead360.intelligence` simply starts resolving through the new Lead the moment a completed run exists, whether that run started before or after conversion.

## 7. Business deleted/archived during analysis

B3's Business rows are never hard-deleted (`B3_ACQUISITION_PROVENANCE.md`); "archived" is a B2/B3-owned state on the Business or its owning Lead, not a B4 concern. A run in flight against an archived Business completes normally — its result is retained but is excluded from actor-facing "analyze" admission for that Business going forward (§4 of `B4_B3_ACQUISITION_BOUNDARY.md` governs the exact read-path visibility rule). B4 never blocks completion of already-admitted work merely because the subject's CRM-side state changed underneath it — consistent with §4's "retain, don't discard" discipline.

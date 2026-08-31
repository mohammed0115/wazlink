# B4 — Cost Control, Rate Limiting, and AI Cost Accounting

> **B4 status:** Target design only. **This document is closed before B4 requests closure, not deferred to a future fix cycle.** B3 needed two independent countersign rounds to close its retry-cost gap; B4 applies that lesson up front — every admission path that can trigger provider spend has a Class A, finite, computable-in-advance bound before this document is considered done.

## 1. The frozen anchor

Frozen `BACKEND_RATE_LIMIT_POLICY.md` already states: **"AI analysis — 60/hour/workspace plus quota."** B4 adopts this unchanged, exactly as B3 adopted "Discovery submit — 10/hour/workspace" unchanged.

> **`B4-D-A017`: `MAX_INTELLIGENCE_RUN_ADMISSIONS_PER_WORKSPACE_PER_HOUR = 60`** (frozen B0, Class A).

## 2. Why B4 does *not* need B3's split-counter fix, and where it needs its own

B3's independent audit found that splitting "create" from "retry" into two counters was necessary because retry was **free of quota** and had no rate limit of its own — creating an accumulation-then-burst attack. B4's economics differ in a load-bearing way:

- **Re-analysis is not free.** Every admitted run — first analysis or re-analysis — consumes one provider-cost unit and one slot from the same 60/hour pool. There is no "your fault vs. ours" asymmetry the way a failed Discovery job's quota release had, because a failed `IntelligenceRun`'s retry still spends fresh provider calls, not recovered ones. **One shared counter for every actor-triggered admission (first analysis + re-analysis) is therefore correct, not an oversight** — splitting it would only be needed if one path were exempted from the limit, and none is.
- **B4 has no automatic/eager trigger in Phase 1** (`B4-D-C001`, `B4_FRESHNESS_STALENESS.md` §5) — so there is no automatic-trigger-storm path to bound separately, unlike B3's automatic-vs-actor retry split.
- **B4 does have a genuinely new attack surface B3 did not**: an *unbounded single-request batch* (FB-17 — "analyze all visible results," no cap in the frozen UI). This is B4's own version of B3's gap, caught here rather than by a later independent audit, and closed in §3.

## 3. The batch admission cap

> **`B4-D-A019`: `MAX_BATCH_SIZE_PER_ANALYZE_REQUEST = 20`.** One `RequestBusinessIntelligence` (or `ReanalyzeBusinessIntelligence`) call may name at most 20 Business IDs. A request naming more is rejected in full — `422 VALIDATION_ERROR`, `details.reason = "batch_size_exceeded"`, `details.max = 20` — before any admission, any provider call, and any partial execution.

Rationale for 20, stated rather than asserted: it is comfortably below one third of the hourly ceiling (60), so a single UI click can never alone claim more than ~33% of a workspace's hourly budget — leaving room for other actors and for re-analysis that same hour. A workspace wanting to analyze more than 20 results issues multiple batch calls, each independently subject to §4's admission sequence, so the *pool*, not the *batch cap*, is what ultimately limits total hourly spend.

## 4. Admission sequence

Every admission (single or batch, first-analysis or re-analysis) follows one ordered sequence, mirroring B3's exact "cheaper check first" discipline (`B3_DISCOVERY_REQUEST_MODEL.md` §8):

| Step | Check | Failure |
|---|---|---|
| 1 | Authenticate | `401 AUTH_REQUIRED` |
| 2 | Authorize — `intelligence.run` (`B4_AUTHORIZATION_TENANCY.md`) | `403 PERMISSION_DENIED` |
| 3 | Batch size ≤ 20 (§3) | `422 VALIDATION_ERROR`, `batch_size_exceeded` |
| 4 | Each named Business resolves within workspace scope and has a completed Discovery result (`B4_B3_ACQUISITION_BOUNDARY.md` §2) | `404 ENTITY_NOT_FOUND` for that ID |
| 5 | Per-Business input-hash comparison (`B4_INPUT_SNAPSHOT_MODEL.md` §5) — identical, non-stale input already has a completed run → **reuse, not admit** | not an error; response includes the reused run |
| 6 | Workspace admission counter check — `admitted_this_hour < 60` | `429`, `details.reason = "intelligence_rate_limited"`, reusing frozen B0's generic `RateLimited` component exactly as `B4-D-A017`'s sibling decision in B3 (`B3-D-A032`) did — **no new error code** |
| 7 | Entitlement — capability check (Class B, provisional until B8 closes, mirroring `B3_QUOTA_COST_CONTROL.md` §2's exact "provisional until B8" framing) | `403 ENTITLEMENT_LOCKED` |
| 8 | Atomically admit and reserve one slot per admitted Business, in the same transaction as run-row creation | — |
| 9 | Persist `IntelligenceRun` rows (`queued`), the `IdempotencyRecord`, and the outbox row, in one transaction | — |
| 10 | Respond `202` with the admitted runs (and any reused runs from step 5) | — |

**Within one batch request, admission is partial-safe:** if the workspace counter has, say, 8 slots left when a batch of 20 arrives, exactly 8 are admitted (steps 6–9 evaluated per-Business, in request order) and the remaining 12 are rejected in the same response with `429` per ID — never a batch that succeeds by silently truncating without telling the caller which IDs were skipped.

Step 5's reuse check runs **before** the rate-limit check (step 6) — a reused run costs nothing and must never be blocked by a nearly-exhausted counter it was never going to draw from.

## 5. Automatic transient retry — bounded separately, inside one run

> **`B4-D-A018`: `MAX_RUN_ATTEMPTS_PER_INTELLIGENCE_REQUEST = 3`.** Inside one `IntelligenceRun`, an individual provider call (a `schema_invalid`, `timeout`, or `rate_limited` outcome, `B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §3) may be retried automatically up to 3 attempts total — 1 initial attempt plus a maximum of 2 automatic retries — before the affected component is treated as failed (`B4_RETRY_FAILURE_MODEL.md` §2).
>
> **Provenance, stated precisely:** this ceiling is **B4-owned**, not a citation of frozen `BACKEND_RETRY_POLICY.md`'s own generic ceilings, which are higher for the applicable classes (5 for Network timeout, 6 for Rate limited) and remain frozen and unmodified by this document. B4 imposes a stricter, domain-specific bound layered *underneath* that frozen retry architecture — B0 still supplies the retryable/non-retryable classification and the backoff mechanics (`B4_RETRY_FAILURE_MODEL.md` §1), but for B4 Intelligence provider work the lower B4 ceiling of 3 governs and wins over B0's larger generic ceiling. No provider retry path for B4 Intelligence work may fall back to B0's 5- or 6-attempt ceiling to exceed this bound.

This counter is **not** the same as §2's workspace/hour admission counter, exactly as B3 kept `attempt_no` (per-Job) and automatic transient retry (per-call) distinct (`B3_RETRY_FAILURE_MODEL.md` §1). It never increments the workspace admission counter and is invisible to the actor beyond the run's eventual `completed(partial)`/`failed` outcome.

## 6. The worst case, computed

```
(A) provider calls per admitted run
    at most 1 structured-extraction call + 1 presentation call = 2 logical calls

(B) absolute call-attempt bound per admitted run, including automatic
    transient retry (MAX_RUN_ATTEMPTS_PER_INTELLIGENCE_REQUEST = 3)
    2 × 3 = 6 call attempts

(C) admission-based hourly bound, per workspace
    60 admissions/hour × 6 = 360 absolute call attempts/hour/workspace

(D) single-batch worst case
    20 Business IDs × 6 = 120 call attempts, and no single batch can exceed
    this without a second admitted request drawing from the same 60/hour pool
```

Exactly as B3's own hourly figure had to be, (C) is stated as an **admission-based bound**, not a wall-clock guarantee: a run admitted in the final minute of the rolling hour can still be executing (and its automatic retries still firing) after the window closes and a fresh 60-admission budget opens. The only normative claim is: *at most 60 runs may be actor-admitted per workspace per rolling hour, and each admitted run individually carries bound (B) above.*

## 7. Duplicate-run suppression and same-input reuse

> **`B4-D-A020`: identical `(business_id, input_hash)` with a non-stale completed or in-flight run is reused, never re-admitted.**

| Case | Behavior |
|---|---|
| A completed, non-stale run already exists for this exact input | reused (§4 step 5) — no new run, no cost |
| A run is already `queued`/`running` for this exact input | the new request is coalesced onto the existing run — `202` with the existing run's ID, no second admission |
| The existing run is `failed`/`cancelled` | not reused — a fresh admission proceeds normally through §4, because a failed attempt is not evidence of anything |
| The existing run's input is stale (`B4_FRESHNESS_STALENESS.md` §3) | not reused — a fresh admission proceeds |

## 7.1 Cancellation and the admission slot — the same asymmetry B3 proved correct

> **`B4-D-A017`'s companion rule: cancelling a `queued` run releases its admission slot back to the hourly pool; cancelling a `running` run does not.**

| Cancellation from | Slot | Why |
|---|---|---|
| `queued` | **released** | no provider call has been made — nothing was spent |
| `running` | **retained/consumed** | a provider call may already be in flight; releasing would let cancel-spam manufacture free admission churn exactly where B3's original gap lived |

This is the identical asymmetry `B3_QUOTA_COST_CONTROL.md` §4 uses for Discovery Job cancellation, reapplied to B4's admission slot rather than a commercial quota unit. It does not reopen a cost attack: a workspace that admits and cancels runs before they ever reach `running` spends no provider budget and gains no analysis — repeating that cycle produces nothing an attacker could want. The only exploitable path would be a worker racing to `running` between admission and cancellation, and `B4_INTELLIGENCE_RUN_STATE_MACHINE.md` §5's cooperative-cancellation checkpoints already bound that race the same way B3 bounds its own.

## 8. Idempotency and retries never double-spend

`Idempotency-Key` is required on `RequestBusinessIntelligence`, `AnalyzeLead`, and `ReanalyzeBusinessIntelligence`. A request replayed under the same key returns the stored response from idempotency layer 1 and **consumes no second admission slot** — identical in mechanism to `B3_JOB_STATE_MACHINE.md` §3.2.1's idempotent-replay rule. Two genuinely distinct accepted requests each consume their own slot.

## 9. AI cost accounting — telemetry, not billing truth

> **B8 owns billing.** The following is technical telemetry only, mirroring `B3_QUOTA_COST_CONTROL.md` §7's exact "emits, never prices" discipline:

| Signal | Source | Never |
|---|---|---|
| `input_tokens`, `output_tokens` | provider response (§`B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §3) | treated as a currency amount |
| provider calls, by outcome | `IntelligenceUsageRecord` | conflated with commercial quota units |
| run duration | run start/end timestamps | — |
| provider errors, by class | `B4_RETRY_FAILURE_MODEL.md` §2 | — |
| estimated technical cost, where the adapter reports one | `IntelligenceUsageRecord.cost_units`, **nullable, never defaulted to zero** — reporting an unknown cost as `0` would silently under-report spend, the exact discipline `B3_QUOTA_COST_CONTROL.md` §7 already established | presented to a customer as an invoice line |

`B4_OBSERVABILITY_RECONCILIATION.md` §2 defines the exported metrics; this section defines only what they may and may not mean.

## 10. Commercial quota — separate from the technical admission slot

Whether `RequestBusinessIntelligence` consumes a commercial quota unit (an `aiAnalyses` capability, analogous to B3's `discoveryRuns`) is a **B8-owned, provisional** decision (`B4-D-B009`-adjacent, Class C until B8 ships — mirroring `B3_QUOTA_COST_CONTROL.md` §2's exact provisional framing). What is **not** provisional, and is Class A regardless of B8's eventual answer: the technical admission slot of §2–§4 is consumed on every admitted run whether or not a commercial unit is also charged — "no commercial charge" (if B8 ever grants unlimited re-analysis commercially) must never be read as "no provider-cost bound," the identical warning B3-D-A031/A032 encode for Discovery retries.

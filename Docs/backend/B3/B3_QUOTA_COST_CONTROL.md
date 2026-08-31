# B3 — Entitlement Boundary and Cost Control

> **B3 status:** Target design only. **B3 owns no billing truth.** B8 (Billing & Entitlements) is not designed; everything that depends on it is stated as a provisional consumption contract, never as invented billing semantics.

## 1. Why cost control is a correctness concern here

Discovery is the only WazLink domain in which **a single user action can cause an unbounded number of billable third-party calls**. A 10-keyword × 10-location request, paginated without a ceiling, retried without a bound, submitted in a loop, is a direct financial exposure with no natural brake.

So the bounds in §5 are not tuning parameters. They are invariants (`B3-INV-11`), validated before any quota is reserved and before any provider is contacted.

## 2. The boundary with B8

| Concern | Owner | B3's role |
|---|---|---|
| plan and capability catalogue | Entitlements (B8) | reads a decision |
| quota definition, limit, period, reset | Entitlements (B8) | reads a decision |
| price, invoice, payment, revenue | Billing (B8) | **nothing** |
| whether *this* workspace may run discovery **now** | Entitlements (B8) | **consumes** `EvaluateEntitlement` |
| reserving and releasing one usage unit | Entitlements (B8) storage | **calls** `ReserveQuota`; owns the *when* |
| **when** a unit is consumed, released, or retained | **B3** | §3–§4 — this is genuinely a Discovery decision |
| provider call volume and cost telemetry | **B3** | §5–§7 |

`EvaluateEntitlement` and `ReserveQuota` are frozen B0 Entitlements commands, and `usage_counters` / `usage_ledger` are frozen B0 tables. B3 introduces no counter, no metric, and no limit of its own.

**Provisional until B8 closes.** B3 assumes only: a capability decision distinguishing "not in plan" from "exhausted" (which the frozen frontend already requires — `Discovery.tsx:198-202`), a transactional reservation on a locked `usage_counters` row (frozen B0), and a release path. Anything B8 might additionally offer — overage, burst credits, per-provider metering, cost-based limits — is **`B3-D-C007`** and no B3 contract depends on it.

## 3. The consumption point

> **One admitted job consumes exactly one `discoveryRuns` unit** (`B3-INV-10`).

`discoveryRuns` is the frozen frontend's metric (`entitlementService.ts:25`, `contracts/entitlements.ts:13`), and the sidebar meters it as a run count (`Sidebar.tsx:31-33`). The capability is `discovery.basic`.

**Not** per query, per result, per provider call, or per page. Those are bounded by §5 instead. Metering runs matches the frozen product contract, is predictable for the user before they submit, and cannot be inflated by a provider returning more pages than expected.

Reservation happens at **admission step 9**, inside the same transaction as the job row, the query plan, the `IdempotencyRecord`, and the outbox row (`B3_DISCOVERY_REQUEST_MODEL.md` §8). A crash therefore cannot leave a reserved unit with no job or a job with no unit.

## 4. Release, retention, and the anti-abuse asymmetry

| Event | Unit | Why |
|---|---|---|
| job `completed` (any `completion_kind`) | **consumed** | the work ran |
| job `failed` after ≥ 1 provider call | **consumed** | real cost was incurred |
| job `failed` before any provider call — plan materialization, provider **configuration** fault | **released** | WazLink's fault, no external cost |
| job `cancelled` from `pending` | **released** | nothing was called |
| job `cancelled` from `processing` | **consumed** | provider calls were already made |
| **retry** of a `failed` or `cancelled` job | **no second unit** | the reservation is bound to the `JOB-*`, not to the attempt |
| duplicate `POST` under the same `Idempotency-Key` | **no second unit** | layer 1 replays the stored response |
| duplicate request fingerprint | **no unit at all** | rejected before step 9 |
| worker restart, redelivery, replay | **no effect** | quota is bound to admission only |

> **Retries never double-charge** (`B3-INV-10`). The reservation is a property of the job, written once at admission and never re-evaluated. There is no code path from a worker to `usage_counters`.

**The asymmetry on cancellation is deliberate.** Releasing after provider work had begun would let a workspace obtain unlimited free discovery by submitting and immediately cancelling. Retaining on a `pending` cancel would charge for nothing. The boundary sits exactly at "has a provider been contacted", which is a fact the job already records.

**Retry is genuinely free**, and that is the honest trade: it caps the user's exposure for a failure that was not theirs, at the cost of allowing repeated provider spend on one unit. That exposure is bounded by §5 — retry re-runs a plan whose worst case is already capped at 250 provider calls — so "free retry" cannot become unbounded cost.

## 5. The cost-control bounds

Every provider-facing path has an explicit maximum.

| Control | Limit | Class | Enforced at |
|---|---:|:--:|---|
| keywords | 10 | A | admission |
| locations | 10 | A | admission |
| **combinations** | **50** | A | admission, on the deduplicated arrays |
| results per job | `result_limit` ∈ {500, 1000, 2000} | A | ingestion |
| provider pages per execution | 5 | B | execution |
| concurrent executions per job | 4 | B | scheduler |
| concurrent running jobs per workspace | 2 | B | scheduler |
| **submissions** | **10/hour/workspace** | A — **frozen B0** | admission |
| retry attempts per execution | frozen B0 (5, or 6 rate-limited) | A — **frozen B0** | retry policy |
| duplicate-request suppression window | configurable | B | admission |
| workspace provider-budget ceiling | configurable | B | execution |

### 5.1 The worst case, computed

```
per job attempt : 50 combinations × 5 pages          =   250 provider calls
per hour/workspace : 10 submissions × 250            = 2,500 provider calls
```

Plus retries, themselves bounded by the frozen 5-or-6 attempt cap. **The number is finite, computable in advance, and independent of provider behaviour** — which is the property `B3-INV-11` asserts. No path in this design produces a fan-out that is not a term in this expression.

### 5.2 Where the bounds bite

Reaching a bound is a **success with reduced coverage**, never an error: `PAGE_LIMIT_REACHED` and `RESULT_LIMIT_REACHED` are success outcomes (`B3_JOB_STATE_MACHINE.md` §6) and the job completes with `completion_kind = truncated`. Results already acquired are visible; the user is told the search was truncated rather than being shown a failure for work that succeeded.

## 6. Duplicate-request suppression

The cheapest provider call is the one not made. A second job with the same `request_fingerprint` in the same workspace, while an earlier job with that fingerprint is still non-terminal, is rejected `409 CONFLICT` with `details.reason = "duplicate_discovery_request"` and `details.existing_job_ref` — no quota, no provider call, and a pointer to the job already running.

Suppression applies only against **non-terminal** jobs. A user re-running the same search tomorrow is a legitimate refresh, and rediscovery is a first-class product signal (it is what feeds B2's rediscovery contract), so suppressing it would be wrong.

**Result caching across jobs is not implemented** and is deliberately deferred to **`B3-D-C008`**: reusing a previous job's results would be constrained by the provider's caching terms (`B3-X-005`), and inventing a cache policy before those terms are verified would be exactly the kind of guessed provider fact this package refuses to make.

## 7. Cost telemetry

| Signal | Source | Emitted as |
|---|---|---|
| provider calls | one per page ingestion attempt | counter by provider, workspace, outcome |
| `cost_units` | adapter, where declared | counter; **`null` when unknown, never `0`** |
| pages fetched | execution | histogram |
| results per call | ingestion | histogram |
| duplicate ratio | `duplicate_count / found_count` | gauge — the efficiency of the search |
| suppressed duplicate requests | admission | counter — cost avoided |
| bound-triggered truncations | execution | counter by bound |

Reporting an unknown cost as zero would make a dashboard *look* correct while under-reporting spend — so `emits_cost_units = false` yields `null`, and the aggregate is explicitly marked incomplete rather than silently wrong.

B3 **emits** telemetry and **prices** nothing. Converting units to money is Billing's, and no B3 document contains a currency, a rate, or a price.

## 8. Rate limiting

Frozen `BACKEND_RATE_LIMIT_POLICY.md` already sets **"Discovery submit — 10/hour/workspace plus entitlement"**. B3 adopts it unchanged and adds no second limit.

Per frozen B0, the limiter's Redis counter is an **abuse/acceleration control, not the source of truth**: quota enforcement remains transactional and authoritative in PostgreSQL (`B3-INV-15`). A limiter failure therefore degrades to "no rate limit", never to "no quota check" — the entitlement and reservation steps are unconditional.

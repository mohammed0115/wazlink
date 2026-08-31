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
| **retry** of a `failed` or `cancelled` job, while `attempt_no < MAX_JOB_ATTEMPTS` | **no second unit** | the reservation is bound to the `JOB-*`, not to the attempt |
| **retry** rejected at `attempt_no ≥ MAX_JOB_ATTEMPTS` | **no effect — rejected before any side effect** | `409 CONFLICT`, `details.reason = "attempt_limit_reached"` (`B3-D-A031`) |
| duplicate `POST` under the same `Idempotency-Key` | **no second unit** | layer 1 replays the stored response |
| duplicate request fingerprint | **no unit at all** | rejected before step 9 |
| worker restart, redelivery, replay | **no effect** | quota is bound to admission only |

> **Retries never double-charge** (`B3-INV-10`). The reservation is a property of the job, written once at admission and never re-evaluated. There is no code path from a worker to `usage_counters`.

**The asymmetry on cancellation is deliberate.** Releasing after provider work had begun would let a workspace obtain unlimited free discovery by submitting and immediately cancelling. Retaining on a `pending` cancel would charge for nothing. The boundary sits exactly at "has a provider been contacted", which is a fact the job already records.

**Retry is genuinely free of a second quota unit**, and that is the honest trade: it caps the user's exposure for a failure that was not theirs, at the cost of allowing repeated provider spend on one unit. "No second quota unit" is a **commercial** statement and must not be read as "unlimited provider work" — commercial quota accounting and technical provider-cost safety are three deliberately separate concerns, not two:

1. **commercial quota unit** (`discoveryRuns`) — one per admitted Job, never re-charged by retry (this section);
2. **`MAX_JOB_ATTEMPTS = 3`** (`B3-D-A031`) — the technical ceiling on how many times *one Job* may reach `pending → processing`, regardless of cancellation in between;
3. **`MAX_ACTOR_RETRY_REQUESTS_PER_WORKSPACE_PER_HOUR = 10`** (`B3-D-A032`) — the technical ceiling on how many *distinct* retry admissions a workspace may cause across every Job it owns, in a rolling hour.

A retry consuming no commercial quota unit (1) says nothing about whether it is admitted at all — it must still clear both (2) and (3) before any provider-facing side effect. The worst-case provider spend on one `discoveryRuns` unit is capped at three attempts' worth of §5's per-attempt bound (2), and the worst-case *workspace-wide* retry-driven spend in any rolling hour is additionally capped by (3), computed together in §5.1 — never an unbounded loop of `create → execute → cancel → retry`, whether that loop targets one Job repeatedly or many Jobs at once.

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
| **submissions (`CreateDiscoveryJob`)** | **`MAX_NEW_DISCOVERY_JOBS_PER_WORKSPACE_PER_HOUR = 10`** | A — **frozen B0** | admission |
| **Job attempts (actor-triggered, per Job)** | **`MAX_JOB_ATTEMPTS = 3`** (1 initial + `MAX_ACTOR_RETRIES_PER_JOB = 2`) | **A** — `B3-D-A031` | `RetryDiscoveryJob`, before any provider-facing side effect |
| **actor-retry admissions (`RetryDiscoveryJob`, workspace-wide)** | **`MAX_ACTOR_RETRY_REQUESTS_PER_WORKSPACE_PER_HOUR = 10`** | **A** — `B3-D-A032` | `RetryDiscoveryJob`, before any provider-facing side effect; independent of the submission counter above |
| automatic transient retry, per provider call | frozen B0 (5, or 6 rate-limited) | A — **frozen B0** | retry policy; never opens a new Job attempt, never consumes a retry-rate slot |
| duplicate-request suppression window | configurable | B | admission |
| workspace provider-budget ceiling | configurable **lower** than the Class A maximum above | B — `B3-D-B011` | execution |
| retry-rate limiter's distributed counter mechanics | configurable implementation | B — `B3-D-B012` | admission |

### 5.1 The worst case, computed

Two figures, kept explicitly distinct: **logical provider executions** (one term per page a query plan would fetch) and **network/API call attempts** (inflated by frozen B0's automatic transient retry, which never opens a new Job attempt but does repeat a call).

```
(A) logical provider-work bound, per job attempt
    50 combinations × 5 pages                                    =    250 provider calls

(B) absolute call-attempt bound, per job attempt, including
    automatic transient retry (frozen B0's more permissive
    class — rate-limited, 6 attempts — is the conservative case)
    250 provider calls × 6 automatic attempts                     =  1,500 call attempts

    logical provider-work bound, per Job, across every actor
    attempt (MAX_JOB_ATTEMPTS = 3, B3-D-A031)
    250 × 3                                                       =    750 provider calls

    absolute call-attempt bound, per Job, across every actor
    attempt, including automatic transient retry
    1,500 × 3                                                     =  4,500 call attempts
```

#### 5.1.1 The hourly/workspace bound — admission-based, not wall-clock (B3-FIX.2)

**B3-FIX.1's hourly figure (45,000 absolute call attempts/hour/workspace) is superseded and is no longer normative.** It was computed by assuming an admitted job is retried to `MAX_JOB_ATTEMPTS` within the *same* hour it was created, on the reasoning that `RetryDiscoveryJob` doesn't share the 10/hour submission counter. An independent audit found that reasoning backwards: because retries are uncounted against the submission limiter, and nothing previously capped how many `failed`/`cancelled` Jobs a workspace could accumulate *across* hours, a workspace could stockpile retry-eligible Jobs over many admission-hours and then burst-retry all of them within a single hour — decoupling retry volume from the 10/hour figure the old computation relied on. **`B3-D-A032`** closes this with a second, independent admission-rate ceiling: `MAX_ACTOR_RETRY_REQUESTS_PER_WORKSPACE_PER_HOUR = 10` (`B3_JOB_STATE_MACHINE.md` §3.2.1).

```
    maximum actor-admitted Job attempts, per workspace, per
    rolling hour — two independent streams:
      CreateDiscoveryJob   (B3-D-A018, frozen B0)     =  10
      RetryDiscoveryJob    (B3-D-A032)                =  10
                                                       -----
                                                       =  20 admitted attempts/hour/workspace

    hourly/workspace, logical provider-work,
    admission-based
    20 × 250                                          = 5,000 provider calls

    hourly/workspace, absolute call-attempt bound,
    admission-based
    20 × 1,500                                        = 30,000 call attempts
```

**This is an admission-rate bound, not a wall-clock completion guarantee, and it is stated as one deliberately.** The architecture bounds how many *new* Job attempts a workspace may cause to be **admitted** within a rolling hour (20: 10 new-job admissions, each necessarily at attempt 1, plus 10 retry admissions, each opening attempt 2 or 3 of some Job). It does **not** bound — and no component in this design claims to bound — the wall-clock moment at which the provider calls those admitted attempts trigger actually complete. An attempt admitted in the final minute of a rolling window can still be executing, and its automatic transient retries (§2) can still be firing, after the window has closed and a fresh 20-admission budget has opened. Two admitted attempts can therefore have overlapping in-flight provider calls that a naive reading of "30,000/hour" would double-count against a single wall-clock hour. **The correct and only claim this design makes is the admission-rate one:** *at most 20 Discovery Job attempts may be actor-admitted per workspace per rolling hour (10 creates + 10 retries), and each admitted attempt individually carries the bounded provider-work figures of (A)/(B) above.* No wall-clock provider-call-per-hour ceiling is claimed, because none is enforced — claiming one would overstate the guarantee the limiter actually provides.

**Every number above is finite, computable in advance, and independent of provider behaviour** — the property `B3-INV-11` asserts. No path in this design produces a fan-out that is not a term in one of these expressions.

**Historical superseded figures — non-normative, retained only for audit trail:**

- `10 × 250 = 2,500 provider calls/hour` (pre-FIX.1) counted a single job attempt per admitted job and ignored both actor retries and automatic transient-retry amplification.
- `10 × 4,500 = 45,000 absolute call attempts/hour/workspace` (B3-FIX.1) counted only the `CreateDiscoveryJob` admission stream and assumed, without an enforcing control, that all retries of a job land inside its creation hour. **Neither figure is an enforced ceiling and neither may be cited normatively.** The 20-admission-per-hour model of §5.1.1 above is the current and only normative hourly bound.

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

Frozen `BACKEND_RATE_LIMIT_POLICY.md` already sets **"Discovery submit — 10/hour/workspace plus entitlement"** for `CreateDiscoveryJob`. B3 adopts it unchanged.

**B3-FIX.2 adds one second, independent limiter — `B3-D-A032`, `MAX_ACTOR_RETRY_REQUESTS_PER_WORKSPACE_PER_HOUR = 10`** — scoped to `RetryDiscoveryJob` only. This is a B3-owned architectural bound, not an amendment to frozen `BACKEND_RATE_LIMIT_POLICY.md`: it is layered on top of that document exactly as `MAX_JOB_ATTEMPTS` (`B3-D-A031`) already is, and no row of the frozen rate-limit table is added, removed, or retyped. The two limiters are explicitly **not** combined into one shared counter (`B3_JOB_STATE_MACHINE.md` §3.2.1, §4 above): unused Create capacity never increases Retry capacity, and unused Retry capacity never increases Create capacity — each is checked, and each rejects, independently.

**No new error code.** A limiter rejection reuses frozen B0's generic `RateLimited` reusable response component — the same bare `429` + `Retry-After` mechanism the 10/hour submission limit already uses (`B3_DISCOVERY_REQUEST_MODEL.md` §7) — carrying `details.reason = "actor_retry_rate_limited"` to distinguish it from the submission-limit case, the same way `409 CONFLICT` already carries a distinguishing `details.reason` for its several causes (`B3_API_DTO_CONTRACTS.md` §2.5). `ERROR_NEW_COUNT` remains `0` (`B3_RETRY_FAILURE_MODEL.md` §3); `NEW_ERROR_CODES = 0`.

Per frozen B0, a rate limiter's Redis counter is an **abuse/acceleration control, not the source of truth** (`B3-INV-15`); quota enforcement remains transactional and authoritative in PostgreSQL. The same doctrine applies to the new retry-rate limiter: its concrete distributed counter mechanism is Class B (`B3-D-B012`), but the counter it accelerates is authoritative in PostgreSQL, and a limiter failure degrades to "no rate limit", never to "no `attempt_no` check" — step 6 of `B3_JOB_STATE_MACHINE.md` §3.2.1 remains unconditional regardless of the limiter's availability.

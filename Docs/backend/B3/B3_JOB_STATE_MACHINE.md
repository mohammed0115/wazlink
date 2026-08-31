# B3 — Discovery Job State Machine

> **B3 status:** Target design only. No implementation.

## 1. Why the state set is not open for redesign

The frozen frontend enumerates the status vocabulary in three independent places — the label map (`data.js:91`), the integrity assertion (`data.js:490`), and the status filter dropdown (`DiscoveryJobs.tsx:80`) — as exactly:

```
pending · processing · completed · failed · cancelled
```

and gates the entire results surface on `status === "completed"` (`data.js:436`).

A sixth state such as `partially_completed` would render as a raw untranslated token, be unreachable through the status filter, and — because `isDiscoveryResultsAvailable` tests equality with `"completed"` — make the results of a partially successful job **permanently invisible**. That is not a cosmetic mismatch; it silently discards paid-for provider work.

**Decision (`B3-D-A006`): five states. Partial success is a property of a `completed` job, not a state.** It is carried by a `completion_kind` discriminator (§6) and by per-execution states, both of which are additive and neither of which the frozen frontend has to understand.

## 2. The five states

| State | Terminal? | Meaning | Results visible? | Provider work possible? |
|---|:--:|---|:--:|:--:|
| `pending` | no | admitted, quota reserved, plan persisted, not yet claimed by a worker | no | no |
| `processing` | no | at least one execution has been claimed; work is in flight | no | **yes** |
| `completed` | yes | every execution reached a terminal outcome and **at least one succeeded** | **yes** | no |
| `failed` | yes | every execution reached a terminal outcome and **none succeeded**, or admission-time planning failed | no | no |
| `cancelled` | yes | an actor requested cancellation while the job was non-terminal, and the request was accepted | no | no |

`JOB_STATE_COUNT = 5`.

## 3. Transitions

| # | From | To | Trigger | Owner | Guard |
|---:|---|---|---|---|---|
| 1 | — | `pending` | `CreateDiscoveryJob` commits | discovery application service | full admission sequence passed |
| 2 | `pending` | `processing` | first execution claimed | job worker | `version` unchanged; job still `pending` |
| 3 | `pending` | `cancelled` | `CancelDiscoveryJob` | actor | row lock; job still `pending`; **quota released** (§7) |
| 4 | `pending` | `failed` | plan materialization failed | job worker | terminal, no provider call was made; **quota released** |
| 5 | `processing` | `completed` | last execution terminal **and** `succeeded_executions ≥ 1` | job worker | all executions terminal |
| 6 | `processing` | `failed` | last execution terminal **and** `succeeded_executions = 0` | job worker | all executions terminal |
| 7 | `processing` | `cancelled` | `CancelDiscoveryJob` accepted, then executions drain | actor + worker | row lock; job still `processing`; **quota not released** |
| 8 | `failed` | `pending` | `RetryDiscoveryJob` | actor | row lock; `version` match; **`attempt_no < MAX_JOB_ATTEMPTS` (3)**; new attempt opened |
| 9 | `cancelled` | `pending` | `RetryDiscoveryJob` | actor | same |

**No other transition exists.** In particular there is no `completed → *` edge: a completed job is permanently completed, which matches the frozen frontend exactly (the retry control renders only for `["failed","cancelled"]` — `DiscoveryJobs.tsx:163`, `DiscoveryJob.tsx:184-188`).

### 3.1 Monotonicity, and the one place it is deliberately broken

Within a single **attempt**, state is strictly monotonic: `pending → processing → {completed, failed, cancelled}`, never backwards. Transitions 8 and 9 leave a terminal state, and they are the only ones that do.

This is safe because a retry is not a state *reversal*, it is a **new attempt**. `discovery_jobs.attempt_no` increments, a fresh set of `discovery_query_executions` rows is created with the new `attempt_no`, and the previous attempt's execution rows are retained unchanged. Nothing is rewritten, so no observer can see a job move backwards inside an attempt.

Retry is guarded by the ADR-010 integer `version` on `discovery_jobs`. A retry that races a late completion (transition 5 committing between the client's read and its retry) fails the version check and returns `409 STALE_VERSION` — which is exactly right, since the job it wanted to retry no longer exists in the state it observed.

### 3.2 The actor-retry attempt bound

> **`B3-D-A031`: `MAX_JOB_ATTEMPTS = 3`. A Job has at most one initial execution plus two actor-triggered retries (`MAX_ACTOR_RETRIES_PER_JOB = 2`).** This is an architectural safety bound (`B3-INV-11`), not a tunable — `B3_QUOTA_COST_CONTROL.md` §5.1 derives the provider-cost figure this closes.

`attempt_no` is written once at admission (`= 1`) and incremented **exactly once, transactionally**, when a retry is accepted — the same row lock and `version` check that guards transitions 8 and 9 also serializes the increment, so two concurrent retry requests can never both open attempt 2.

`RetryDiscoveryJob` evaluates the bound **before** transitions 8/9 execute and before any provider-facing side effect:

| Precondition | Result |
|---|---|
| `attempt_no < 3` | accepted; `attempt_no` increments by exactly 1; the job re-enters `pending` |
| `attempt_no ≥ 3` | **rejected** — `409 CONFLICT`, `details.reason = "attempt_limit_reached"`, `details.attempt_no`, `details.max_job_attempts = 3`. No execution is claimed, no provider is called, no scraper submission occurs, no continuation is created, and no quota or provider-cost side effect happens. `ERROR_NEW_COUNT` stays `0` — this reuses the frozen `CONFLICT`/`409` code with a new `details.reason`, exactly as `job_not_retryable` and `job_already_terminal` already do |

**Cancellation never resets the budget.** `CancelDiscoveryJob` mutates only `status` and `cancellation_requested_at` (transitions 3 and 7); it has no code path that touches `attempt_no`. Consequently the sequence `create → execute → cancel → retry → execute → cancel → retry → execute → cancel → retry` is structurally impossible past the third attempt: the third `retry` in that sequence targets a job already at `attempt_no = 3` and is rejected before any provider work, exactly like any other exhausted-budget retry. Cancellation cannot decrement `attempt_no`, restore a spent actor retry, mint a fresh `JOB-*` identity, or reset the provider-cost budget or retry history — the only way to search again is a genuinely new `CreateDiscoveryJob` admission, which is subject to its own admission sequence, rate limit, and quota reservation (`B3_DISCOVERY_REQUEST_MODEL.md` §8).

**Distinct from automatic transient retry.** `attempt_no` counts the initial Job attempt plus actor-triggered `RetryDiscoveryJob` calls only. It does **not** increment for frozen B0's automatic transient retry of an individual provider call inside an execution (network timeout, rate limit, storage failure — `B3_RETRY_FAILURE_MODEL.md` §2). No automatic retry ever creates a new Job attempt; automatic retries remain bounded by B0's own per-class attempt cap (5, or 6 for rate-limited) and are folded into the per-attempt provider-cost upper bound instead (`B3_QUOTA_COST_CONTROL.md` §5.1).

### 3.2.1 The workspace-wide retry-rate limiter and the full admission order

`B3-D-A031` bounds cost **per Job**. It places no ceiling on how many *distinct* Jobs one workspace may retry inside a single hour — and because `CreateDiscoveryJob`'s 10/hour cap only limits the rate of *new* admissions, not how many past `failed`/`cancelled` Jobs accumulate over time, a workspace could otherwise accumulate retry-eligible Jobs across many admission-hours and burst-retry all of them at once.

> **`B3-D-A032`: `MAX_ACTOR_RETRY_REQUESTS_PER_WORKSPACE_PER_HOUR = 10`.** At most 10 successfully admitted `RetryDiscoveryJob` operations — each opening a new Job attempt — per workspace, in a rolling one-hour window. This is a third counter, independent of both `CreateDiscoveryJob`'s frozen 10/hour submission limit (`B3-D-A018`) and `MAX_JOB_ATTEMPTS` (`B3-D-A031`); none of the three borrows capacity from another.

`RetryDiscoveryJob` evaluates preconditions in one fixed order, each cheaper than the next, mirroring `CreateDiscoveryJob`'s admission-order discipline (`B3_DISCOVERY_REQUEST_MODEL.md` §8):

| Step | Check | Failure |
|---:|---|---|
| 1 | Authenticate — session (ADR-009) | `401 AUTH_REQUIRED` |
| 2 | Resolve workspace — authorization context | — |
| 3 | Authorize actor — `discovery.run`, object scope (`B3_AUTHORIZATION_TENANCY.md` §3.1) | `403 PERMISSION_DENIED` |
| 4 | Resolve and row-lock the addressed `discovery_jobs` row within workspace scope | `404 ENTITY_NOT_FOUND` |
| 5 | Validate retryable state — `failed`/`cancelled`; `version` match (`If-Match`) | `409 job_not_retryable` / `409 STALE_VERSION` |
| 6 | Validate `attempt_no < MAX_JOB_ATTEMPTS` (3) | `409 attempt_limit_reached` (`B3-D-A031`) |
| 7 | Check the actor-retry workspace/hour limiter | `429`, `details.reason = "actor_retry_rate_limited"` (`B3-D-A032`) |
| 8 | Atomically admit — reserve one retry-rate slot for this workspace/hour window, in the same transaction as steps 9–10 | — |
| 9 | Increment `attempt_no` exactly once | — |
| 10 | Commit the `failed`/`cancelled → pending` transition (transitions 8/9 of §2) | — |
| 11 | Dispatcher releases the job to a worker **only after commit** | — |

Steps 1–6 acquire nothing and can be re-run freely. Step 7 is a pure read-then-reject against the counter: rejection here mutates no `attempt_no`, claims no execution, calls no provider, submits nothing to a scraper, and creates no continuation — exactly the same "before any side effect" discipline step 6 already has. Steps 8–10 are one transaction, so a crash between them cannot leave a consumed rate-limit slot with no incremented `attempt_no`, or the reverse.

**Idempotent replay consumes no second slot.** The retry-rate slot is consumed by *admission*, keyed the same way `CreateDiscoveryJob`'s admission is — a `RetryDiscoveryJob` request replayed under the same `Idempotency-Key` returns the stored `202` from idempotency layer 1 (`B3_IDEMPOTENCY_CONCURRENCY.md`) and never re-evaluates step 7. Two *distinct* accepted retry requests — different Jobs, or the same Job retried again after a later failure — each consume their own slot. Concurrent requests are serialized by the same admission-time lock that already prevents step 6 from double-incrementing `attempt_no`, so concurrent retries workspace-wide can never admit more than 10 in one rolling hour (AT-RETRY-27).

**The historical-burst attack, closed.** A workspace accumulates 1,000 `failed`/`cancelled` Jobs over many days — each individually legitimate, created under the unrelated 10/hour *create* cap on its own admission day. At hour H the actor issues `RetryDiscoveryJob` against all 1,000. Step 7 admits at most 10 within hour H's rolling window; the remaining ~990 are rejected `429` before step 8, before `attempt_no` increments, and before any provider-facing side effect. This is the exact scenario `B3-D-A032` exists to close (AT-RETRY-28).

**Cancel/retry-loop interaction.** The per-Job bound (`B3-D-A031`, §3.2) and the per-workspace-hour bound (`B3-D-A032`, here) are cumulative, not substitutive: cancellation still never resets `attempt_no`, so no single Job can exceed 3 attempts regardless of the workspace counter — and the workspace counter still caps total retry admissions across every Job in the workspace regardless of how any one Job's attempts are distributed. Neither bound alone was sufficient; both together are.

**Automatic transient retry consumes no slot.** Frozen B0's per-call backoff/attempt mechanics (`B3_RETRY_FAILURE_MODEL.md` §2) never call `RetryDiscoveryJob`, never reach step 7, and are counted nowhere in this limiter — consistent with `attempt_no` itself, which they also never increment (AT-RETRY-30).

### 3.3 What a retry resets and what it preserves

Traced from the frozen mock (`data.js:481`), which resets `progress`, `foundCount`, `duplicateCount`, `deduplicatedCount`, `discoveredCount`, `current` and calls `startDiscoveryJob`:

| Reset on retry | Preserved across retry |
|---|---|
| `progress` → 0 | `public_id` (`JOB-*`) — the same job |
| the three counters → 0 | the request: keywords, locations, filters, source, `result_limit` |
| `failure_code` / `failure_message` → null | `discovery_queries` — the plan is identical |
| `completed_at` → null | **every `discovery_results` row from previous attempts** |
| `completion_kind` → null | previous `discovery_query_executions` rows |
| — | the single `discoveryRuns` reservation (`B3-INV-10`) |
| — | every `businesses` and `business_identities` row already created |

**Retained provenance is the point.** A retry re-observes the same world, so most results will be re-ingested; the `(query_execution_id, business_id)` uniqueness is per-execution, so a re-observation creates a *new* `discovery_results` row against the new execution. That is correct — it is a genuinely new observation at a new instant — and the Business itself is upserted, not duplicated (`B3-INV-4`).

## 4. Progress semantics

`progress` is a server-computed integer 0–100:

```
progress = floor( 100 × terminal_executions / total_executions )
```

with `progress = 100` written only at the moment the job reaches a terminal state, so a client never sees 100 % on a non-terminal job. On `pending`, `progress = 0`.

Progress is **execution-based, not result-based**, because result counts are unbounded-until-fetched while the execution count is known at admission. This makes progress monotonic within an attempt and never revisable downward — the property the frontend progress bar assumes (`DiscoveryJob.tsx:143-155`).

The seven cosmetic stages the frontend renders (`DiscoveryJob.tsx:14-31`) are a client animation derived from `progress`. **B3 models no stages** and returns none.

### 4.1 The three counters

Traced from `DiscoveryJob.tsx:157-161` and the mock's own integrity assertion (`data.js:489`):

| Counter | Definition |
|---|---|
| `found_count` | provider result records ingested across every execution of the current attempt, before identity resolution |
| `duplicate_count` | ingested records that resolved to a Business already recorded for this job attempt, plus records rejected by a post-filter |
| `deduplicated_count` | distinct, unfiltered Businesses recorded for this job attempt |

**Invariant: `found_count − duplicate_count = deduplicated_count`**, asserted at every counter write. The mock asserts exactly this identity for completed jobs; B3 makes it a server invariant for every state, with the counters advancing only inside the ingestion transaction that causes them.

## 5. Result visibility — the load-bearing rule

> **`B3-INV-8`: a Discovery result is visible if and only if its job is in state `completed`.**

`GET /discovery/jobs/{id}/results` returns:

| Job state | Response |
|---|---|
| `completed` | `200` with the paginated result list |
| `pending`, `processing` | `409 CONFLICT`, `details.reason = "results_not_available"`, `details.job_status` |
| `failed`, `cancelled` | `409 CONFLICT`, same shape |
| not in workspace / absent | `404 ENTITY_NOT_FOUND` |

**Persistence is not visibility.** Results are written to `discovery_results` as each page commits, so a worker crash loses no acquired data and no provider spend. They are simply not *served* until the job completes. Separating the two gives durability without exposing a half-finished result set that would change under the reader's feet and break cursor stability (`B3_PAGINATION_MODEL.md` §4).

**Why not stream partial results?** Three reasons, in order of weight: the frozen frontend gates on `completed` in two independent places (`data.js:436`, `DiscoveryResults.tsx:78`), so partial streaming would be unreachable UI; a growing result set cannot offer a stable cursor; and the deduplication counters are only final once every execution has terminated, so a partial view would report numbers that later change. Revisiting this is a **Class C** item for a future phase (`B3-D-C004`) and would require a frontend change, not just a backend one.

**A cancelled or failed job's rows are retained**, not deleted — the provider work was paid for, the provenance is real, and a later retry benefits from the already-upserted Businesses. They are simply not served. `B3-D-C005` records exposing them under an operator permission as a future option.

## 6. Partial success

An execution ends in exactly one outcome:

| Execution outcome | Counts as success? | Contributes results? |
|---|:--:|:--:|
| `SUCCEEDED` | yes | yes |
| `PAGE_LIMIT_REACHED` | **yes** | yes — coverage was bounded, not broken |
| `RESULT_LIMIT_REACHED` | **yes** | yes |
| `PROVIDER_NO_MATCH` | **yes** | no — a valid empty answer |
| `FAILED_RETRYABLE_EXHAUSTED` | no | possibly (pages committed before failure) |
| `FAILED_PERMANENT` | no | possibly |
| `CANCELLED` | no | possibly |

The job's terminal state then follows from the aggregate, and `completion_kind` names the shape:

| Condition | Job state | `completion_kind` |
|---|---|---|
| every execution succeeded, no limit hit, ≥1 result | `completed` | `full` |
| ≥1 execution succeeded, ≥1 failed | `completed` | `partial` |
| every execution succeeded, all `PROVIDER_NO_MATCH` | `completed` | `empty` |
| a limit stopped ingestion | `completed` | `truncated` |
| **no** execution succeeded | `failed` | — |

> **One failed combination must not fail the job.** A 20-combination job in which 19 succeed has acquired 19 combinations' worth of paid provider data. Failing it would discard that data, waste the spend, and — because retry re-runs the whole plan — spend it again. The job therefore completes as `partial`, results are visible, and `failed_query_count` plus per-execution outcomes tell the user and the operator exactly what was missed.

`completion_kind` is additive: the frozen frontend ignores it and behaves correctly, showing results for every `completed` job.

**Retry scope after a partial completion.** A `completed` job is not retryable (§3), so a partial result set cannot be topped up by retrying. Narrowing retry to only the failed executions of a completed job is a genuine product question, recorded as **`B3-D-C006`**; the honest Phase-1 answer is that the user submits a new job for the missing combinations, and duplicate-request suppression will not block it because the keyword/location set differs.

## 7. Cancellation

`CancelDiscoveryJob` is accepted only from `pending` or `processing`, matching the frontend's `isProcessing` gate (`shared.tsx:13`, `DiscoveryJobs.tsx:151`).

1. Lock the `discovery_jobs` row.
2. If the job is already terminal → `409 CONFLICT`, `details.reason = "job_already_terminal"`, `details.job_status`. Nothing is mutated.
3. Otherwise set `cancellation_requested_at` and move the job to `cancelled` in the same transaction.
4. In-flight executions observe the cancellation at their **next checkpoint** — before starting, or after a page commits — and terminate `CANCELLED`. A provider call already in flight is allowed to finish and its page **is** ingested, because the cost was already incurred and discarding the evidence would be strictly worse than keeping it.
5. The job stays in the log as `cancelled`, never deleted (`data.js:480`, `DiscoveryModal.tsx:63-65`).

**Cancel racing completion.** Both transitions take the same row lock, so one wins. If completion commits first, cancel returns `409` and the job is `completed` — correct, because the work genuinely finished. If cancel commits first, a completing worker finds the job non-`processing` and records its execution outcome without transitioning the job — so a job never moves from `cancelled` to `completed`.

**Quota on cancellation** (`B3_QUOTA_COST_CONTROL.md` §4): released if cancelled from `pending` (no provider call was ever made), retained if cancelled from `processing` (real cost was incurred). Releasing after spend would let a workspace obtain unlimited free provider calls by cancelling every job — the exact abuse this asymmetry closes.

## 8. Timestamps

| Column | Written when | Immutable after |
|---|---|---|
| `created_at` | admission commit | always — never reset by retry |
| `started_at` | first `pending → processing` of the **current attempt** | until the next retry |
| `completed_at` | entry to `completed` or `failed` | until the next retry |
| `cancellation_requested_at` | cancel accepted | until the next retry |
| `attempt_started_at` | each attempt's `pending → processing` | per attempt |

`completed_at` is null for a cancelled job, matching the frozen mock (`data.js:480` sets `completedAt = null` on cancel). All timestamps are UTC, server-clock, and never client-supplied.

## 9. Failure representation

A `failed` job exposes a **safe** `failure_code` from the closed set in `B3_RETRY_FAILURE_MODEL.md` §3 and a translated `failure_message`. Neither ever contains a provider error string, endpoint, credential, HTTP body, or stack detail (`B3-INV-3`).

The frozen frontend renders `job.failureMessage` directly (`DiscoveryJob.tsx:166-171`) alongside the reassurance "لم يتم فقد أي بيانات محفوظة" — which B3 makes literally true: failure never deletes an already-ingested `discovery_results` row, an upserted Business, or a previous attempt's history.

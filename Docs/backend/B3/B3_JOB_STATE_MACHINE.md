# B3 — Discovery Job State Machine

> **B3 status:** Target design only. No implementation.

## 1. Why the state set is not open for redesign

The frozen frontend enumerates the status vocabulary in three independent places — the label map (`data.js:91`), the integrity assertion (`data.js:488`), and the status filter dropdown (`DiscoveryJobs.tsx:80`) — as exactly:

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
| 8 | `failed` | `pending` | `RetryDiscoveryJob` | actor | row lock; `version` match; new attempt opened |
| 9 | `cancelled` | `pending` | `RetryDiscoveryJob` | actor | same |

**No other transition exists.** In particular there is no `completed → *` edge: a completed job is permanently completed, which matches the frozen frontend exactly (the retry control renders only for `["failed","cancelled"]` — `DiscoveryJobs.tsx:163`, `DiscoveryJob.tsx:184-188`).

### 3.1 Monotonicity, and the one place it is deliberately broken

Within a single **attempt**, state is strictly monotonic: `pending → processing → {completed, failed, cancelled}`, never backwards. Transitions 8 and 9 leave a terminal state, and they are the only ones that do.

This is safe because a retry is not a state *reversal*, it is a **new attempt**. `discovery_jobs.attempt_no` increments, a fresh set of `discovery_query_executions` rows is created with the new `attempt_no`, and the previous attempt's execution rows are retained unchanged. Nothing is rewritten, so no observer can see a job move backwards inside an attempt.

Retry is guarded by the ADR-010 integer `version` on `discovery_jobs`. A retry that races a late completion (transition 5 committing between the client's read and its retry) fails the version check and returns `409 STALE_VERSION` — which is exactly right, since the job it wanted to retry no longer exists in the state it observed.

### 3.2 What a retry resets and what it preserves

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

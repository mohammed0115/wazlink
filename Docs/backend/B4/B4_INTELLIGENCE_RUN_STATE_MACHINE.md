# B4 — Intelligence Run State Machine

> **B4 status:** Target design only. Reuses B3's proven "partial success is a completion property, not a state" pattern — the same discipline that kept B3's Job state machine at five states applies here for the same reason.

## 1. Why the state set is not six or seven

Candidate states from the brief's own list: `queued, running, completed, partially_completed, failed, cancelled, stale`. Two collapse:

- **`partially_completed`** is not a state. Whether a run's deterministic signals succeeded while its AI-assisted summary failed is a *property of a completed run* (`completion_kind`), not a different place in the lifecycle — exactly B3's `B3-INV-9` reasoning, reapplied. See `B4_RETRY_FAILURE_MODEL.md` §3 (partial success).
- **`stale`** is not a state either. Staleness is a function of *time and input drift relative to a completed run*, computed at read time by comparing the run's `input_snapshot_version` against the Business's current `version` (`B4_FRESHNESS_STALENESS.md`). Storing it as a state would require a background sweep to keep it accurate and would make "is this run stale" ambiguous during the sweep's lag window.

> **`B4-D-A003`: `IntelligenceRun` has exactly five states: `queued, running, completed, failed, cancelled`.**

## 2. The state table

| # | From | To | Trigger | Actor | Guard |
|---|---|---|---|---|---|
| 1 | — | `queued` | `RequestBusinessIntelligence` / `AnalyzeLead` (alias) admitted | actor | admission sequence complete (`B4_COST_RATE_LIMIT_MODEL.md` §2) |
| 2 | `queued` | `running` | worker claims the run | worker | lease acquired |
| 3 | `running` | `completed` | deterministic signals resolved **and** every non-optional component succeeded | worker | `completion_kind = full` |
| 4 | `running` | `completed` | deterministic signals resolved, an AI-assisted (optional) component failed or was skipped | worker | `completion_kind = partial` (`B4_RETRY_FAILURE_MODEL.md` §3) |
| 5 | `running` | `failed` | a required component failed (invalid structured output after exhausting `MAX_RUN_ATTEMPTS_PER_INTELLIGENCE_REQUEST`, or a job-scope fault) | worker | `failure_code` set (`B4_RETRY_FAILURE_MODEL.md` §2) |
| 6 | `queued`, `running` | `cancelled` | `CancelIntelligenceRun` | actor | row lock; `version` match |
| 7 | `failed`, `cancelled` | `queued` | `ReanalyzeBusinessIntelligence` | actor | `attempt_no < MAX_RUN_ATTEMPTS_ADMITTED_PER_REQUEST` and workspace admission slot available (`B4_COST_RATE_LIMIT_MODEL.md`) |

**No other transition exists.** In particular there is no `completed → *` edge — a completed run, `full` or `partial`, is permanently completed. Re-analysis always opens a **new** `IntelligenceRun` row; it never mutates a finished one. This differs from B3's Job model (which reuses the same `JOB-*` across retries) on purpose: an `IntelligenceRun` is evidence of *one specific analysis attempt over one specific input snapshot*, and overwriting it would destroy the audit trail §`B4_OBSERVABILITY_RECONCILIATION.md` §4 requires. Immutable history, not a mutable retry counter, is the right shape here.

## 3. Terminal state visibility and history

| State | Visible to actor? | Counts as "current"? | Retained? |
|---|---|---|---|
| `queued` | yes (`status` field) | no | yes |
| `running` | yes | no | yes |
| `completed` (`full`) | yes, in full | **yes**, if not superseded (`B4_IDEMPOTENCY_CONCURRENCY.md` §4) | yes, forever within retention policy |
| `completed` (`partial`) | yes, with `completion_kind = partial` surfaced | yes, if not superseded — a partial result with valid deterministic signals is still usable (§4) | yes |
| `failed` | yes, `failure_code` only, never a raw provider error | no | yes |
| `cancelled` | yes | no | yes |

## 4. The critical product question — does the last successful intelligence remain visible after a failed re-analysis?

> **Yes, always.** A `failed` or `cancelled` re-analysis never removes, hides, or marks unusable the previous `completed` run. The "current" pointer (`B4_IDEMPOTENCY_CONCURRENCY.md` §4) only ever advances to a **new completed** run; it is untouched by a failed or cancelled attempt.

This mirrors the frozen frontend's own explicit promise for Discovery failures (*"لم يتم فقد أي بيانات محفوظة"* — no saved data is ever lost) and closes the same defect class B3's retry model was built to prevent: a transient AI-provider hiccup must never regress a Business from "we know its score" to "we know nothing."

## 5. Cancellation semantics

`CancelIntelligenceRun` is cooperative, checked at two points only — before the provider call and after each structured-output validation step — never mid-provider-call, for the same reason B3 never checks mid-call: abandoning an in-flight call pays the cost without keeping the evidence. A cancelled run:

- consumes its `IntelligenceUsageRecord` entries already written (provider cost already incurred is retained for telemetry, `B4_COST_RATE_LIMIT_MODEL.md` §5),
- does **not** become current,
- does **not** block a subsequent `ReanalyzeBusinessIntelligence` beyond the normal admission/attempt bounds.

## 6. Failure semantics

Handled in full in `B4_RETRY_FAILURE_MODEL.md`. Summarized here only for state-machine completeness: a `failed` run always carries a closed-set `failure_code`, never a raw provider message, and always preserves whatever `completed` run preceded it (§4).

## 7. What a re-analysis resets and what it preserves

| Aspect | Reset | Preserved |
|---|---|---|
| `IntelligenceRun` row | a **new** row is created (`ANL-*` new public ID) | — |
| `input_snapshot` | recomputed fresh from current Business state | — |
| prior runs | — | retained in full, immutable, queryable as history |
| "current" pointer | flips to the new run **only if it completes** and its input is not already superseded (`B4_IDEMPOTENCY_CONCURRENCY.md` §4) | if the new run fails, the pointer stays on the prior completed run |

This is the opposite of B3's retry model (same `JOB-*`, `attempt_no` increments) by design: B3 retries an *execution*, B4 retries an *opinion*, and opinions from different points in time are each individually meaningful evidence, not disposable attempts.

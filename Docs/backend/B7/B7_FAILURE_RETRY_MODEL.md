# B7 — Failure / Retry Model

> **B7 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Failure classification — resolved (Class A, `B7-D-A022`)

| Class | Examples | Retryable | Reused from |
|---|---|---:|---|
| `TRANSIENT` | timeout calling a target domain's command, DB deadlock on the run/action row | yes | `BACKEND_RETRY_POLICY.md` "Network timeout/provider unavailable" row |
| `PERMANENT` | invalid phone format at `SendMessage` admission, target Deal already archived | no | "Validation" row |
| `POLICY` | loop-prevention block, structural self-loop rejection | no | new — B7-specific, no frozen precedent, but matches "Authorization/entitlement" row's no-retry posture |
| `CONCURRENCY` | `409 STALE_VERSION` from the target command | no — §`B7_CONCURRENCY_MODEL.md` §5 settles the action `failed`; a bounded re-evaluation is deferred (`B7-D-B008`) and never a blind retry | new |
| `ENTITLEMENT` | workspace lost `automation.rules`, or the specific action's capability, between admission and invocation | no | "Authorization/entitlement" row |
| `AUTHORIZATION` | target command's own RBAC check rejects (role downgraded since rule authored) | no | same |
| `VALIDATION` | malformed event envelope, action payload fails target DTO validation | no | "Validation" row |
| `DEPENDENCY_UNAVAILABLE` | target domain's service temporarily down (5xx) | yes, same schedule as `TRANSIENT` | "Network timeout/provider unavailable" row |

A `Deal already won`/`conversation closed`/`workspace suspended`-shaped rejection is `PERMANENT` (a specific state fact, not expected to change on retry) unless the specific rejection code is independently listed as `CONCURRENCY` (a version conflict) or `ENTITLEMENT` (a suspended workspace specifically) — `workspace suspended` is classified `ENTITLEMENT`, not `PERMANENT`, since a suspension can lift and a later admission (not a retry of *this* action) would naturally re-attempt.

## 2. Retry doctrine — reused verbatim from frozen B0

`BACKEND_RETRY_POLICY.md`'s exact table applies unmodified to B7's own retryable classes: exponential backoff `base * 2^(attempt-1)` with full jitter, capped at 15 minutes; default maximum 5 attempts, after which the action (not necessarily the whole run) becomes `dead_lettered`-eligible (§3). B7 introduces no separate retry-math — this is a direct reuse, not a refinement, matching how B3/B4/B5 each reused it without modification for their own worker retries.

Retries are designed **separately per layer**, per task brief §23:

| Layer | What retries | Governed by |
|---|---|---|
| Event admission | the inbox consumer's own transaction (§`B7_EVENT_CONSUMPTION_MODEL.md` §4) — a crash mid-transaction simply redelivers safely (dedup absorbs it); this is not a "retry" in the backoff sense, it's transactional atomicity | `B7_EVENT_CONSUMPTION_MODEL.md` §4 |
| Execution worker | the Celery task that advances a `queued`/`running` run — re-reads the run's current state before resuming (never blindly replays from the start), per `BACKEND_RETRY_POLICY.md`'s closing principle | this document, §1-2 |
| Action command invocation | one action execution's attempt count (`automation_run_steps.attempt`) — re-derives its idempotency key identically every attempt (§`B7_IDEMPOTENCY_MODEL.md` §2), never generates a new one per retry | this document, §1-2 |
| Approval wait | nothing retries — an `awaiting_approval` run holds no worker and consumes no attempt budget; it advances only on an `ApproveAutomationRun` decision or a cancel (`B7_ACTION_AUTHORIZATION.md` §2, `B7_PAUSE_DISABLE_CANCEL.md` §2) | this document, §3 |

## 3. Dead-letter threshold and manual replay

An action's retry budget is exhausted at 5 attempts (§2) → the action transitions `failed`, and — because Phase-1 has no continue-on-failure policy (`B7_AUTOMATION_RULE_AGGREGATE.md` §2) — the **run** transitions to `dead_lettered` if the exhausted action was not the result of an explicit business rejection (`PERMANENT`/`AUTHORIZATION`/`VALIDATION`, which instead settle the run as plain `failed` — no further retry was ever appropriate for those, so there is nothing to "exhaust"). `dead_lettered` is reserved specifically for **retryable-class exhaustion** (`TRANSIENT`/`DEPENDENCY_UNAVAILABLE` only, §`B7_CONCURRENCY_MODEL.md` §5 — a `CONCURRENCY` failure settles the run `failed` without entering a retry schedule), distinguishing "we gave up after genuinely trying" from "this was never going to work." Manual replay is `B7_DEAD_LETTER_REPLAY.md`.

## 4. Non-retryable failures never retry blindly

`AT-RETRY-1` **(NC)**: an implementation retrying a `PERMANENT`-classified action failure (e.g., re-attempting `MoveDealStage` against a target stage that is archived) — fails; `PERMANENT` failures settle the run immediately, no backoff schedule is entered, matching `BACKEND_RETRY_POLICY.md`'s own "Validation … no … failed with safe user error" row precisely.

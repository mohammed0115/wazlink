# B12 — Retry & Backoff Model

> Design only. Reuses frozen `BACKEND_RETRY_POLICY.md` verbatim and adds only the layering the frozen table does not state.

## 1. Six retry classes — and why they are not interchangeable

> **`B12-D-A017`. Six retry counters exist. Each has exactly one owner. No counter may be incremented, reset, or bypassed by a layer that does not own it.**

| # | Class | Counter lives in | Owner | Bounded by | May B12 change it? |
|---:|---|---|---|---|:--:|
| 1 | **Business retry** (an actor asks again) | the domain aggregate, e.g. `discovery_jobs.attempt_no` | **the domain** | `MAX_JOB_ATTEMPTS = 3` (`B3-D-A031`); for AI, `MAX_RUN_ATTEMPTS_PER_INTELLIGENCE_REQUEST = 3` (`B4-D-A018`) | **never** |
| 2 | **Admission retry** (rate of new attempts) | a durable admission record | **the domain** | 10/workspace/hour (`B3-D-A032`) | **never** |
| 3 | **Execution retry** (worker-level) | `worker_executions.attempt_no` | B12 | frozen `BACKEND_RETRY_POLICY.md` class row | yes |
| 4 | **Provider transport retry** (network/5xx/429) | `provider_request_attempts` | B12 | frozen row: 5 (transient), 6 (rate limited) | yes |
| 5 | **Provider semantic retry** (async provider state) | the domain's own poll record | **the domain** | frozen: "Payment pending, scheduled poll, 8" | **never** |
| 6 | **Operator replay** | `platform_dead_letters.replay_count` | operator + B12 | `B12_DEAD_LETTER_REPLAY_MODEL.md` §4 | yes, under permission |

> **The load-bearing consequence.** Classes 3 and 4 are B12's. Classes 1, 2, and 5 are **not**, and no amount of transport retrying may consume, reset, or exceed them. Frozen **`B3_DECISION_REGISTER.md` (`B3-D-A031`)** already states the same separation from the other side, verbatim: *"Automatic transient retry (frozen B0's per-call backoff/attempt mechanics) is a distinct, unrelated counter: it never increments `attempt_no` and never creates a new Job attempt."* `B3_RETRY_FAILURE_MODEL.md` §1 is the document that sentence cross-references and is the **supporting substantive evidence** in B3's own words — *"`attempt_no` advances only on an actor's explicit retry, never automatically"* — not the source of the quotation. B12 ratifies both rather than reinterpreting either. `RETRY_BUDGET_OVERRIDE_GAPS = 0`; negative controls `AT-B12RTY-5`, `AT-B12FW-2`, `AT-B12FW-3`.

## 2. The frozen classification table, reused

`BACKEND_RETRY_POLICY.md` is adopted unchanged. B12 adds no row and changes no figure:

| Class | Retry | Max | Terminal action |
|---|:--:|---:|---|
| Network timeout / provider unavailable (HTTP timeout, DNS, 5xx) | yes | 5 | dead letter + alert |
| Rate limited (429 / provider quota) | yes | 6 | honor `Retry-After`, alert if exhausted |
| Validation (malformed, unsupported field) | **no** | 1 | failed with safe user error |
| Authorization / entitlement (401/403/quota) | **no** | 1 | blocked; **no provider retry** |
| Payment pending (async provider state) | scheduled poll | 8 | pending / reconciliation |
| Payment final failure (declined/invalid) | **no** | 1 | failed; user action required |
| Duplicate webhook (known receipt key) | no-op | n/a | acknowledge 2xx |
| ZATCA unavailable | yes | 8 | pending + reconciliation |
| Storage failure | yes | 5 | failed asset + retry action |

**The two "no" rows are the important ones.** A validation error and an authorization error are *deterministic*: retrying them spends money and changes nothing. B12's adapter classifier must map to these rows correctly, because a misclassification turns a permanent failure into five wasted provider calls (`B12_OUTBOUND_HTTP_POLICY.md` §3).

## 3. Backoff

Frozen `BACKEND_RETRY_POLICY.md` fixes the formula: *"Exponential backoff is `base * 2^(attempt-1)` with full jitter, capped at 15 minutes for ordinary providers and 60 minutes for reconciliation."* B12 reuses it and states the precedence order the frozen text implies but does not enumerate:

```
delay = MIN(
          cap_for_class,                                   -- 15m ordinary, 60m reconciliation
          MAX(
            provider_Retry_After_if_present,               -- HIGHEST precedence
            full_jitter( base * 2^(attempt-1) )
          )
        )
```

> **`B12-D-A018`. A provider-supplied `Retry-After` always wins over the computed backoff when it is longer, and is never shortened by jitter.** Ignoring it is how a rate-limited integration becomes a banned one. The cap still applies as an upper bound so a hostile or erroneous header cannot park work for a day.

**Full jitter, not fixed backoff**, because every worker that failed at the same instant would otherwise retry at the same instant — the thundering-herd that turns one provider blip into a self-inflicted outage.

## 4. Attempt ceilings are per class, never global

There is no universal `MAX_RETRIES` constant in B12. The ceiling for any given operation is the frozen row for its **failure class**, further bounded by any **domain** budget above it. Where the two disagree, **the smaller wins**:

```
effective_attempts = MIN(frozen_class_max, domain_budget_remaining)
```

**Worked example 2 — the AI ceiling, which is *lower* than the frozen transport class.** Frozen `B4_COST_RATE_LIMIT_MODEL.md` §5 states `MAX_RUN_ATTEMPTS_PER_INTELLIGENCE_REQUEST = 3` and, unusually, says so *against* B0's own figures: *"for B4 Intelligence provider work the lower B4 ceiling of 3 governs and wins over B0's larger generic ceiling. No provider retry path for B4 Intelligence work may fall back to B0's 5- or 6-attempt ceiling to exceed this bound."* The `MIN()` rule above is exactly that sentence made mechanical: `MIN(5, 3) = 3`. B4's own §6 computes the resulting envelope — **2 logical calls × 3 attempts = 6 provider call attempts per admitted run** — and B12 adds nothing to it. Neither a transport retry (class 4) nor a worker-level execution retry (class 3) may push a run past 6, because the count is durable in B4's own rows and is re-read under a lock at execution time (`B12_CONCURRENCY_MODEL.md` §3). **B12 states this number only to cite it; B4 remains its sole authority** (`B12-D-B012`). Negative controls `AT-B12FW-3`, `AT-B12RTY-8`.

Worked example 1 — a Discovery execution on its third and final job attempt (`B3-D-A031`) suffers a provider timeout: the transport class allows 5 attempts, and B12 uses them **within that one execution**. If all 5 are exhausted, the execution is dead-lettered — and `attempt_no` on the Job is **not** incremented, because transport exhaustion is not an actor retry. Only the actor, invoking `RetryDiscoveryJob`, can spend a job attempt, and only if `attempt_no < 3`.

## 5. Terminal classification

A retry sequence ends in exactly one of four terminal states, and `unknown` is deliberately **not** among them:

| Terminal | Meaning | Next |
|---|---|---|
| `succeeded` | provider confirmed | domain command applies the result |
| `failed_permanent` | deterministic rejection (validation, auth) | domain records failure; **no** further attempt |
| `dead_lettered` | transient class exhausted its budget | `DeadLetterRecord` + alert |
| `unresolved_unknown` | outcome never determined | **reconciliation case**, never a guess (`B12_UNKNOWN_OUTCOME_MODEL.md`) |

`BLIND_NON_IDEMPOTENT_RETRY_GAPS = 0` rests on the fourth row existing at all: without it, every timeout would be forced into `failed` or `succeeded`, and one of those would be a lie.

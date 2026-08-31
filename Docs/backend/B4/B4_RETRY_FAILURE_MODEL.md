# B4 — Retry, Failure, and Partial Success Model

> **B4 status:** Target design only. Classifies B4's failures into frozen B0's policy, exactly as B3 did — no competing retry policy is defined.

## 1. Division of authority

| Layer | Owner | Content |
|---|---|---|
| retry mechanics — backoff, jitter, attempt counts | frozen B0 `BACKEND_RETRY_POLICY.md` | `base * 2^(attempt-1)` with jitter, capped at 15 min, default 5 attempts (6 for rate-limited) |
| which B4 condition belongs to which frozen class | B4 | §2 |
| the per-run automatic-attempt bound | B4-owned, layered on top, not a B0 class | `MAX_RUN_ATTEMPTS_PER_INTELLIGENCE_REQUEST = 3` (`B4_COST_RATE_LIMIT_MODEL.md` §5) |
| the workspace/hour admission bound | B4-owned | `B4_COST_RATE_LIMIT_MODEL.md` §2 |

## 2. Failure classification

| B4 condition | Frozen class | Retryable | Scope | Terminal action | User-visible |
|---|---|:--:|---|---|---|
| malformed request, batch size exceeded, bad Business ref | Validation | no | request | — | `400`/`422 VALIDATION_ERROR` |
| lacks `intelligence.run` | Authorization | no | request | — | `403 PERMISSION_DENIED` |
| capability absent / quota exhausted (provisional B8) | Authorization/entitlement | no | request | — | `403 ENTITLEMENT_LOCKED` |
| workspace admission limit reached (§`B4_COST_RATE_LIMIT_MODEL.md` §2) | Rate limited | client | request | — | `429`, `intelligence_rate_limited` |
| provider timeout | Network timeout | **yes**, ≤3 (`B4-D-A018`) | this provider call | dead letter + alert if exhausted | none while retrying |
| provider 5xx / unavailable | Network timeout | **yes**, ≤3 | this provider call | same | none while retrying |
| provider rate-limited (429) | Rate limited | **yes**, honors `Retry-After` | this provider call | same | none while retrying |
| structured output schema-invalid (`B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §4) | Validation, provider-boundary | **yes**, ≤3, **no repair attempt** — each retry re-issues the identical request, never "fixes up" the malformed response | this provider call | see §3 | none while retrying |
| provider safety refusal | Validation, provider-boundary | **no** — a refusal is a definitive answer, not a transient fault | this call/component | see §3 | `completion_kind=partial` (Class C) or `failed` (Class B) per §3 |
| insufficient evidence | *not a failure* | n/a | — | run completes `outcome=insufficient_data` (`B4_SCORING_MODEL.md` §6) | `200`, no error |
| stale input at completion | *not a failure* | n/a | — | run completes normally but never claims `is_current` (`B4_IDEMPOTENCY_CONCURRENCY.md` §4) | `200`, `stale` on the superseded run's own re-read |
| concurrent newer run already current | *not a failure* | n/a | — | same as above | — |
| cancelled | terminal by actor request | n/a | run | `B4_INTELLIGENCE_RUN_STATE_MACHINE.md` §5 | `202` on the cancel call |
| workspace/hour budget exhausted | Rate limited | client | request | — | `429` |
| internal persistence failure at completion commit | — | no | run, quarantined | `500 INTERNAL_ERROR`, `internal_error` failure code; the run is retried only via a fresh actor `ReanalyzeBusinessIntelligence` | `500` |

`ERROR_NEW_COUNT = 0` beyond the one new `details.reason` value (`intelligence_rate_limited`) reusing the existing generic `429`/`RateLimited` component — the identical technique B3-D-A032 used, **not** a new error code (`B4_AUTHORIZATION_TENANCY.md` §5 confirms zero new codes).

## 3. Partial success — exactly what can be partial and what cannot

> A run's Class A/B deterministic and structured-extraction signals are **required**; Class C presentation artifacts are **optional**.

| Component | If it fails |
|---|---|
| Deterministic signal extraction (Class A, `B4_SCORING_MODEL.md` §5) | **cannot fail** in the provider-fault sense — it reads only already-persisted B3 fields. An extraction bug here is an internal invariant violation (`500`), not a retryable/partial condition |
| AI-assisted structured extraction (Class B) | **required** for any signal it is the sole source of. If it exhausts `MAX_RUN_ATTEMPTS_PER_INTELLIGENCE_REQUEST` without a valid response, the run **fails** (`status=failed`, `failure_code=structured_extraction_unavailable`) — a business's opportunity score must never be computed with a silently-missing required component |
| Presentation generation (Class C) | **optional**. If it exhausts its attempts, the run still `completes`, `completion_kind = partial`, with `presentation = null` or partially populated. The score, confidence, signals, and recommendations are all still valid and visible |

This is the exact answer the brief's §39 asks for: *"deterministic signals complete, AI summary fails — does the run fail entirely or complete partially?"* → **it completes, `partial`**, because the summary is Class C and score-irrelevant; a Class B structured-extraction failure, by contrast, **does** fail the run, because a signal the score genuinely depends on is missing — the two cases are not symmetric, and treating them the same in either direction (always-fail or always-partial) would be wrong.

| Visibility of a `completed(partial)` run | Rule |
|---|---|
| Score, confidence, signals, recommendations | fully visible, fully valid, fully usable for filtering/sorting/downstream consumption |
| `presentation` fields | `null` or partial, with no error surfaced beyond their own absence — a UI simply omits the summary card |
| Retry behavior | `ReanalyzeBusinessIntelligence` may be called to attempt the presentation artifacts again; it opens a fresh run (§`B4_INTELLIGENCE_RUN_STATE_MACHINE.md` §7), never patches the partial one in place (immutability) |

## 4. No infinite retry, anywhere

Every retryable condition in §2 inherits a finite frozen or B4-owned bound — automatic (≤3 per call, `B4-D-A018`) or actor-triggered (≤60/hour/workspace, `B4-D-A017`, with a 20-item batch cap, `B4-D-A019`). No B4 document states a backoff formula, an attempt count, or a jitter rule of its own — all four are citations of frozen B0, exactly as `B3_RETRY_FAILURE_MODEL.md` §7 states for Discovery.

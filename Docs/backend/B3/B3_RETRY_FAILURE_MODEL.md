# B3 — Retry and Failure Classification

> **B3 status:** Target design only. **B3 defines no retry mechanics.** It classifies B3's failures into the frozen B0 policy and adds nothing to it.

## 1. Division of authority

| Layer | Owner | Content |
|---|---|---|
| retry mechanics — backoff, jitter, attempt counts, dead-letter records, alerting | **frozen B0** `BACKEND_RETRY_POLICY.md` | `base * 2^(attempt-1)` with full jitter, capped at 15 min for ordinary providers, default 5 attempts, 6 for rate-limited, then dead-letter + alert |
| the concrete scheduler, dead-letter store, replay tooling | **B12** (not designed) | recorded as a forward dependency, exactly as B2 §5.5.6 did |
| **which B3 condition belongs to which frozen class** | **B3** | §3 below |

B3 **adds no row to B0's class table, changes none of its numbers, and registers no amendment.** A classification is not a modification. Every B3 condition maps onto a frozen class that already exists.

**Two B3-owned bounds are deliberately not a classification into a B0 class.** The automatic transient retries this document classifies happen *inside* one Job attempt and never open a new one. `RetryDiscoveryJob` — the actor-triggered command that *does* open a new Job attempt — is bounded two ways, neither of which is a B0 retry class: per-Job, by `MAX_JOB_ATTEMPTS = 3` (`B3-D-A031`, `B3_JOB_STATE_MACHINE.md` §3.2); and per-workspace-per-hour, by `MAX_ACTOR_RETRY_REQUESTS_PER_WORKSPACE_PER_HOUR = 10` (`B3-D-A032`, `B3_JOB_STATE_MACHINE.md` §3.2.1, B3-FIX.2). All three counters are independent: an execution may exhaust its 5-or-6 automatic attempts without ever touching `attempt_no` or the workspace retry-rate counter; `attempt_no` advances only on an actor's explicit retry, never automatically; and the workspace retry-rate counter advances only on a successfully *admitted* actor retry, never on an automatic one. Folding either actor-retry bound into this document's classification table would misrepresent it as a B0 mechanic; both are B3 architectural safety bounds layered on top of B0's mechanics, not B0 classes.

## 2. The frozen classes B3 uses

| Frozen class | Retry | Max | Terminal action |
|---|:--:|:--:|---|
| Network timeout / provider unavailable | yes | 5 | dead letter + alert |
| Rate limited | yes | 6 | honor `Retry-After`, alert if exhausted |
| Validation | no | 1 | failed with safe user error |
| Authorization / entitlement | no | 1 | blocked; **no provider retry** |
| Duplicate webhook | no-op | n/a | acknowledge `2xx` |
| Storage failure | yes | 5 | failed asset + retry action |

## 3. B3 failure classification

| B3 condition | Frozen class | Retryable | Scope of failure | User-visible | Operator-visible |
|---|---|:--:|---|---|---|
| malformed request, closed-set violation, bound exceeded | Validation | **no** | request | `400 VALIDATION_ERROR` | no |
| unknown or non-dispatchable `provider_source` | Validation | **no** | request | `422 VALIDATION_ERROR` | no |
| duplicate request fingerprint | Validation | **no** | request | `409 CONFLICT` | no |
| `Idempotency-Key` reused with a different body | Validation | **no** | request | `409 IDEMPOTENCY_CONFLICT` | no |
| not authenticated | Authorization | **no** | request | `401 AUTH_REQUIRED` | no |
| lacks `discovery.run` | Authorization | **no** | request | `403 PERMISSION_DENIED` | no |
| capability absent from plan | Authorization/entitlement | **no** | request | `403 ENTITLEMENT_LOCKED` | no |
| `discoveryRuns` exhausted | Authorization/entitlement | **no** | request | `403 QUOTA_EXHAUSTED` | usage alert |
| submission rate limit | Rate limited | **client** | request | `429` + `Retry-After` | abuse signal |
| provider timeout | Network timeout | **yes (5)** | **execution** | none while retrying | latency alert |
| provider unavailable / 5xx | Provider unavailable | **yes (5)** | **execution** | none while retrying | availability alert |
| provider rate limit | Rate limited | **yes (6)** | **execution** | none while retrying | quota alert |
| provider continuation expired | Network/transient | **yes (5)** | **execution**, restarts at page 1 | none | counted |
| provider rejected the request permanently | Validation | **no** | execution | via `completion_kind = partial` | error alert |
| provider auth failure | Authorization | **no** | **job** — every execution will fail identically | `failure_code = provider_configuration_error` | **critical alert** |
| provider account quota exceeded | Authorization/entitlement | **no** | **job** | `failure_code = provider_quota_exceeded` | **critical alert** |
| provider returned no match | *not a failure* | n/a | execution ends `PROVIDER_NO_MATCH` | empty results | counted |
| malformed provider payload (one page) | Validation | **no** | that page only | none | payload-error alert |
| record-level normalization failure | *not a failure* | n/a | that record | none | counted |
| identity resolution ambiguity | *not a failure* | n/a | that record | none | review candidate |
| duplicate provider callback | Duplicate webhook | no-op | — | `200 WEBHOOK_DUPLICATE` | counted |
| forged/unsigned callback | Authorization | **no** | callback | `401 WEBHOOK_INVALID_SIGNATURE` | **security alert** |
| stale callback for a terminal execution | *not a failure* | n/a | callback | `200`, not applied | counted |
| database write failure | Storage failure | **yes (5)** | execution | none while retrying | infrastructure alert |
| internal invariant violation | — | **no** | execution, and the job is quarantined from further transitions | `500 INTERNAL_ERROR` | **critical alert** |
| page limit reached | *not a failure* | n/a | execution ends `PAGE_LIMIT_REACHED` | `completion_kind = truncated` | counted |
| result limit reached | *not a failure* | n/a | execution ends `RESULT_LIMIT_REACHED` | `completion_kind = truncated` | counted |
| cost safety bound reached | *not a failure* | n/a | execution ends `CANCELLED` | `completion_kind = truncated` | budget alert |

`ERROR_NEW_COUNT = 0`. Every user-visible code above already exists in the frozen `BACKEND_ERROR_CATALOG.md`; B3 mints none.

### 3.1 The scope column is the design

Three scopes, and choosing correctly is what makes partial success work:

- **request** — nothing is created; no quota is consumed; the client sees an error immediately.
- **execution** — one keyword×location combination is affected. Other executions continue. The job can still complete `partial`.
- **job** — every execution would fail identically, so continuing only burns retry budget and alert noise. Two conditions qualify: provider auth failure and provider account quota exhaustion. Both are *configuration* faults, not transient ones.

Promoting an execution-scope failure to job scope destroys paid-for results from combinations that succeeded. Demoting a job-scope failure to execution scope produces N identical alerts and N wasted retry budgets. The classification is therefore not cosmetic.

## 4. Why `provider auth failure` fails the whole job

It fails identically on every attempt of every execution, because the credential is per-provider, not per-query. Retrying it 5 times × 50 combinations would be 250 guaranteed-failing calls, 250 alerts, and a job that ends `failed` many minutes later than it could have. The job therefore terminates on the first occurrence with a safe `failure_code` and a critical operator alert — and, because it never called a provider successfully, the honest treatment of its quota is a release (`B3_QUOTA_COST_CONTROL.md` §4).

## 5. Failure exposure

A `failed` job exposes a `failure_code` from this closed set and a translated `failure_message`:

| `failure_code` | Meaning |
|---|---|
| `all_queries_failed` | every combination failed; per-execution detail is available in the job detail |
| `provider_unavailable` | the provider was unreachable throughout |
| `provider_configuration_error` | provider auth/credential fault — operator action required |
| `provider_quota_exceeded` | the provider account's own quota is exhausted |
| `internal_error` | a safe generic failure |

**No provider error string, endpoint, status code, credential, header, or payload fragment is ever exposed** (`B3-INV-3`), and no code distinguishes "does not exist" from "exists in another workspace" (`B3_AUTHORIZATION_TENANCY.md` §4).

The frozen frontend renders `failureMessage` verbatim (`DiscoveryJob.tsx:166-171`) alongside "لم يتم فقد أي بيانات محفوظة", so the message must be safe, translated, and true — and B3 makes the reassurance literally true: failure deletes no committed result, no upserted Business, and no earlier attempt.

## 6. Dead-letter and reconciliation

For execution-scope retryable failures that exhaust their budget, B3 requires the frozen B0 terminal action — a dead-letter record and an operational alert — and specifies **no store, schema, broker, scheduler, or tool**, exactly as B2 §5.5.4 did.

| B3 requires | B3 does not build |
|---|---|
| the dead-lettered work keeps its `execution_id`, `job_ref`, `workspace_id`, and attempt number | the dead-letter table or its schema |
| a `reason` distinguishable per §3 | the broker or queue |
| an operational alert; terminal failure is never silent | the retry scheduler |
| replay re-enters the **same** execution semantics — replay is not a bypass | the replay tooling |
| replay is idempotent — layers 6–8 of `B3_IDEMPOTENCY_CONCURRENCY.md` absorb every duplicate | — |

A dead-lettered execution leaves its job in `processing` until every execution is terminal; the dead-letter transition **is** a terminal outcome for that execution, so the job proceeds to `completed` (`partial`) or `failed` normally. A dead-letter never strands a job in `processing` forever.

**B12 forward dependency.** The scheduler, dead-letter store, and replay capability belong to B12 — Async & Integration Platform. B3 depends on them and designs none of them. This mirrors B2's B12 boundary exactly and introduces no competing queue technology: ADR-004's Celery + Redis stands, and there is no Kafka, no BullMQ, and no new broker anywhere in this package.

## 7. What B3 deliberately does not do

- **No competing retry policy.** No B3 document states a backoff formula, an attempt count, or a jitter rule. All four appear only as citations of frozen B0.
- **No unbounded retry.** Every retryable condition inherits a finite frozen bound.
- **No silent acknowledgement of failure.** An exhausted execution is dead-lettered and alerted, never marked successful — the defect B2-FIX.3 closed for its own consumer, avoided here by construction.
- **No retry of a non-retryable class.** Validation and authorization failures are attempted exactly once, as frozen B0 requires.

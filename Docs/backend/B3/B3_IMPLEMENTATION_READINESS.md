# B3 — Implementation Readiness

> **B3 status:** `DESIGN IN PROGRESS`. **B3 is NOT closed.** Closure requires an independent CTO audit. This document states readiness and shows the evidence; it does not claim closure.

## 1. Readiness gates

| Gate | Status | Evidence |
|---|---|---|
| `FRONTEND_TRUTH_ESTABLISHED` | **READY** | 52 behaviors traced with file:line citations, each classified A/B/C/D (`B3_FRONTEND_TRACEABILITY.md`) |
| `DOMAIN_OWNERSHIP_READY` | **READY** | two aggregates derived from frozen B0; 12 explicit non-ownership prohibitions; boundaries against nine domains |
| `REQUEST_MODEL_READY` | **READY** | 10-step normalization with a display/normalized split; worked examples for every case the brief names; a deterministic fingerprint |
| `QUERY_EXPANSION_READY` | **READY** | cross product with a stored ordinal, a unique logical identity, and a 50-combination cap |
| `JOB_STATE_MACHINE_READY` | **READY** | 5 states, 9 transitions, every terminal/non-terminal, retry, progress, and timestamp rule specified |
| `RESULT_VISIBILITY_READY` | **READY** | `B3-INV-8` stated, enforced server-side with `409`, and defended against the streaming alternative |
| `PARTIAL_SUCCESS_READY` | **READY** | 7 execution outcomes → 4 `completion_kind` values; one failed combination never fails a job |
| `BUSINESS_IDENTITY_READY` | **READY** | four concepts separated; identity resolution specified; the four discovery cases answered |
| `CROSS_PROVIDER_DEDUP_READY` | **READY** | 4 classes, graded signals, 5 explicit auto-merge prohibitions, a shared-signal disqualification guard |
| `MERGE_READY` | **READY** | 7-step transaction, tombstones, provenance re-point, `BusinessMerged` → B2 contract 7 |
| `PROVENANCE_READY` | **READY** | append-only rows, `(query_execution_id, business_id)` unique, `discovered_at` from WazLink's clock |
| `PROVIDER_ABSTRACTION_READY` | **READY** | frozen port names, a capability declaration, 10 normalized outcomes, 9 external-validation items isolated |
| `RAW_PAYLOAD_POLICY_READY` | **READY** | hash always, snapshot flagged/PII-excluded/30-day, never exposed |
| `NORMALIZATION_READY` | **READY** | per-field rules, a minimum-viable definition, deterministic disagreement resolution |
| `IDEMPOTENCY_READY` | **READY** | 9 layers, each with a PostgreSQL constraint |
| `CONCURRENCY_READY` | **READY** | 18 races, each with mechanism, winner, loser, and result; no Redis in any row |
| `PAGINATION_READY` | **READY** | provider continuation and API cursor fully separated; stability proved from `B3-INV-8` |
| `RETRY_FAILURE_READY` | **READY** | 30 conditions classified into frozen B0 classes; `ERROR_NEW_COUNT = 0`; no competing policy |
| `QUOTA_BOUNDARY_READY` | **READY** | one unit per admission; release/retain asymmetry; provisional B8 contract |
| `COST_CONTROL_READY` | **READY** | every bound explicit; worst case computed at ≤ 250 provider calls per job attempt |
| `AUTHORIZATION_READY` | **READY** | B1 reused verbatim; no new code; object scope for cancel |
| `TENANCY_READY` | **READY** | `workspace_id` on every tenant table with one documented exception; uniform `404` |
| `API_CONTRACT_READY` | **READY** | 8 operations, each with method, route, operationId, auth, permission, DTOs, validation, idempotency, errors, pagination, concurrency |
| `DTO_CONTRACTS_READY` | **READY** | 3 request + 9 response DTOs; a leak prohibition list |
| `COMMAND_EVENT_READY` | **READY** | 7 commands, 7 events, 0 consumed; envelope quoted verbatim |
| `DATA_MODEL_READY` | **READY** | 10 tables with purpose, columns, constraints, indexes, immutability, retention; **no DDL** |
| `OBSERVABILITY_READY` | **READY** | 40+ metrics, a 7-hop correlation chain, 10 alert conditions, a logging prohibition list |
| `SECURITY_PRIVACY_READY` | **READY** | 12 threats mitigated; SSRF closed structurally; CSV injection neutralized; 5 legal escalations |
| `B2_BOUNDARY_READY` | **READY** | the `BusinessRediscovered` producer contract decided; B2 untouched |
| `B4_HANDOFF_READY` | **READY** | a stable acquisition contract; 7 prohibitions; 5 deferred B4 items |
| `FAILURE_SCENARIOS_READY` | **READY** | DF1–DF40 with deterministic outcomes |
| `ACCEPTANCE_TESTS_READY` | **READY** | 344 criteria across 29 categories, 0 duplicates, 22 negative controls |
| `DECISION_REGISTER_READY` | **READY** | 30 Class A closed, 11 Class B, 18 Class C |
| `CONTROLLED_AMENDMENTS_READY` | **READY** | 6 items across 3 frozen artifacts; the one non-additive item stated plainly |
| `B3_CLOSED` | **NOT CLAIMED** | closure requires an independent CTO audit |

## 2. Mechanically recomputed evidence

Every number below was produced by a script over the corpus, not asserted by hand.

| Metric | Value |
|---|---|
| `B3_DOCUMENT_COUNT` | **26** |
| Non-`.md` files in the package | **0** |
| `FRONTEND_DISCOVERY_BEHAVIOR_COUNT` | **52** (A 44 · B 3 · C 4 · D 1; sum 52) |
| `DOMAIN_AGGREGATE_COUNT` | **2** — `DiscoveryJob`, `Business` |
| `DOMAIN_ENTITY_COUNT` | **8** — `DiscoveryQuery`, `DiscoveryQueryExecution`, `ProviderPageIngestion`, `DiscoveryResult`, `BusinessIdentity`, `BusinessMatchCandidate`, `BusinessMerge`, `DiscoverySource` |
| `JOB_STATE_COUNT` | **5** |
| `API_OPERATION_COUNT` | **8** (3 frozen + 5 additive) |
| `REQUEST_DTO_COUNT` | **3** |
| `RESPONSE_DTO_COUNT` | **9** |
| `COMMAND_COUNT` | **7** (4 frozen, 1 additive, 2 internal) |
| `EVENT_COUNT` | **7** (5 frozen, 2 additive) |
| `CONSUMED_EVENT_COUNT` | **0** |
| `FAILURE_SCENARIO_COUNT` | **40** (DF1–DF40, contiguous) |
| `ACCEPTANCE_TEST_COUNT` / unique / categories | **344 / 344 / 29** |
| `DUPLICATE_ACCEPTANCE_TESTS` | **0** |
| Negative controls | **22** |
| `CLASS_A_UNRESOLVED` | **0** (30 defined, all closed) |
| `CLASS_B_UNRESOLVED` | **11** |
| `CLASS_C_UNRESOLVED` | **18** |
| `UNDEFINED_AT_REFS` | **0** |
| `UNDEFINED_B3_DECISION_REFS` | **0** |
| Undefined `B3-INV-*` refs | **0** |
| Undefined `B3-X-*` refs | **0** |
| `BROKEN_CROSS_DOCUMENT_REFS` | **0** |
| `PUBLIC_ID_COLLISIONS` | **0** |
| `ERROR_NEW_COUNT` | **0** |
| `B0_DRIFT` / `B1_DRIFT` / `B2_DRIFT` | **0 / 0 / 0** |
| `IMPLEMENTATION_LEAKAGE` | **0** |
| `UNAUTHORIZED_FILES` | **0** |
| Fenced blocks | **18**, of which **0** are SQL |

## 3. How the drift and leakage numbers were derived

| Metric | Method |
|---|---|
| `B0_DRIFT = 0` | `git status` shows **no** modified tracked file. Every frozen B0 artifact — OpenAPI, registry, data model, error catalog, retry policy, idempotency standard, rate-limit policy, API standard, ADRs, domain ownership, privacy — is byte-unchanged |
| `B1_DRIFT = 0` | no file under `Docs/backend/B1/` is modified |
| `B2_DRIFT = 0` | no file under `Docs/backend/B2/` is modified |
| Envelope fidelity | the frozen sentence *"All events carry event ID … correlation/request ID."* was extracted from `BACKEND_COMMAND_EVENT_CATALOG.md` and string-compared against its restatement in `B3_COMMAND_EVENT_CATALOG.md` §0 — **exact match** |
| `PUBLIC_ID_COLLISIONS = 0` | every prefix B3 uses — `JOB-`, `RES-`, `BUS-`, `LEAD-`, `AUD-`, `WHR-`, `SIG-`, `SRC-` — is already in the frozen registry, and `MEM-` is B1's proposed/reserved prefix that B2's bundle also depends on. **B3 proposes none of its own** |
| `IMPLEMENTATION_LEAKAGE = 0` | scan for `CREATE/ALTER/DROP TABLE`, `from django`, `import django`, `models.Model`, `serializers.`, `@shared_task`, `@app.task`, `makemigrations`, `migrations.CreateModel/AddField`, and function definitions — **zero hits in all 26 documents**. The package contains **no SQL fenced block at all** |
| Forbidden queue technology | `Kafka`, `BullMQ`, `RabbitMQ`, `SQS` appear only inside explicit prohibitions (`B3_COMMAND_EVENT_CATALOG.md` §5, `AT-CMD-12`). No B3 contract names or depends on a broker |
| `UNAUTHORIZED_FILES = 0` | the working tree contains `Docs/backend/B3/*.md`, the two pre-existing untracked `B2-FIX.1-*` audit artifacts (**not touched, not staged, not part of B3**), and — after the index update — `BACKEND_DOCUMENTATION_INDEX.md` |

## 4. Semantic gates

| Gate | Verdict | Basis |
|---|---|---|
| `BUSINESS_IDENTITY_MODEL` | **PASS** | four concepts separated; `(workspace, provider, external_id)` key; the four discovery cases answered; the frozen `Business` schema satisfied without amendment |
| `CROSS_PROVIDER_DEDUP_MODEL` | **PASS** | 4 classes; auto-link requires ≥2 independent strong signals; name similarity can never merge; ambiguity never resolves itself |
| `DISCOVERY_PROVENANCE_MODEL` | **PASS** | append-only; idempotent; merge-safe; retry-safe; `discovered_at` from WazLink's clock |
| `JOB_STATE_MACHINE` | **PASS** | 5 states, 9 transitions, monotonic within an attempt, retry as a new attempt |
| `RESULT_VISIBILITY_MODEL` | **PASS** | visible iff `completed`; enforced with `409`; persistence separated from visibility |
| `PARTIAL_SUCCESS_MODEL` | **PASS** | `completion_kind` on a `completed` job; one failure never discards the rest |
| `PROVIDER_ABSTRACTION_MODEL` | **PASS** | frozen ports; 10 normalized outcomes; no provider vocabulary crosses the boundary |
| `GOOGLE_BOUNDARY_MODEL` | **PASS** | mapped conceptually; every provider-specific fact marked `B3-X-*`; nothing invented |
| `SCRAPING_BOUNDARY_MODEL` | **PASS** | replaceable; submit/poll/callback; no vendor named; webhook verification specified |
| `IDEMPOTENCY_MODEL` | **PASS** | 9 layers, each constrained by PostgreSQL; pre-checks are optimizations only |
| `PAGINATION_MODEL` | **PASS** | continuation never leaves the server; cursor stability derived from `B3-INV-8` |
| `RETRY_FAILURE_MODEL` | **PASS** | classification only; frozen bounds; no competing policy; dead-letter is terminal and alerted |
| `QUOTA_BOUNDARY_MODEL` | **PASS** | one unit per admission; retries never double-charge; release/retain asymmetry justified |
| `B2_CRM_BOUNDARY` | **PASS** | no CRM write path; `BusinessRediscovered` carries exactly B2's four fields; B2 untouched |
| `B4_HANDOFF_BOUNDARY` | **PASS** | stable acquisition contract; B3 owns no AI field; B3 is correct if B4 never ships |
| `TENANCY_MODEL` | **PASS** | `workspace_id` everywhere but the documented catalogue; uniform `404`; scope precedes state |
| `CONCURRENCY_MODEL` | **PASS** | 18 races decided by PostgreSQL; no Redis in any correctness path |
| `COST_CONTROL_MODEL` | **PASS** | every provider path bounded; worst case computed; unknown cost never reported as zero |

## 5. Self-adversarial review

Twenty-one attacks were run against this design. Each is recorded with its outcome.

| # | Attack | Outcome |
|---:|---|---|
| 1 | Business identity contradictions | **none found.** One identity table, one uniqueness key, one resolution algorithm. The frozen single-`provider_external_id` DTO is reconciled through the anchor-identity rule (`B3_NORMALIZATION_DATA_QUALITY.md` §3) |
| 2 | unsafe fuzzy merge | **closed.** `B3-INV-6` + AT-DEDUP-4/13/14 |
| 3 | provider IDs treated as global | **closed.** `provider` is part of the key; AT-ID-6/11 |
| 4 | lost provenance | **closed.** Append-only; merge re-points; retry retains; failure retains. AT-PROV-2/10/12, AT-MERGE-2 |
| 5 | duplicate job creation | **closed.** Two layers — idempotency key and fingerprint. AT-IDEM-1/3 |
| 6 | duplicate result ingestion | **closed.** Three layers — page, identity, provenance. AT-IDEM-6/7/8 |
| 7 | retries double-charging quota | **closed.** Quota bound to admission; no worker path writes `usage_counters`. AT-QUOTA-4/10 |
| 8 | provider continuation leaking into the API | **closed.** `B3-INV-12`; AT-PAGE-2/3/13 |
| 9 | partial-success contradictions | **closed.** Every execution outcome maps to exactly one job state and one `completion_kind` |
| 10 | cancellation race | **closed.** Row lock; a job never goes `cancelled → completed`. AT-CAN-5/6 |
| 11 | result-visibility contradictions | **closed.** One rule, enforced server-side, consistent with both frozen client gates |
| 12 | cross-workspace leakage | **closed.** Scope precedes state; uniform `404`; cursor bound to its job. AT-TEN-2/6/7 |
| 13 | B2 ownership leakage | **closed.** No CRM write path, no Lead reference, no timeline claim. AT-B2-1/2/3/11 |
| 14 | B4 ownership leakage | **closed.** `B3-INV-16`; the `websiteQuality` trap identified explicitly. AT-B4-1/2 |
| 15 | raw provider payload leakage | **closed.** Never in an API, event, or log; operator-only and audited |
| 16 | B0 envelope widening | **closed.** Verbatim string match; no B3 contract uses aggregate version or arrival order |
| 17 | competing retry policy | **closed.** No B3 document states a backoff formula, attempt count, or jitter rule. AT-FAIL-7 |
| 18 | new queue technology | **closed.** ADR-004 stands; the four candidate names appear only in prohibitions |
| 19 | implementation code leakage | **closed.** Zero hits; zero SQL blocks |
| 20 | hidden provider assumptions | **closed.** Nine `B3-X-*` items isolate every provider and legal fact; none blocks design closure |
| 21 | unlimited API cost fan-out | **closed.** ≤ 250 provider calls per job attempt, computed, not asserted |

### 5.1 Issues found by the review and repaired in B3 documents

| Found | Repair |
|---|---|
| the frozen `Business` schema requires a single `provider_external_id`, which appeared to contradict multi-identity | added the **anchor identity** rule and carried additional identities inside the frozen, unconstrained `provenance` object — removing a would-be amendment |
| `business_identities` uniqueness quoted from B0 as `workspace/provider_external_id` would let two providers collide | added the precision amendment `B3-D-B002` and the negative control AT-ID-11 |
| the retry-resets-counters rule initially left `created_at` ambiguous | fixed explicitly in `B3_JOB_STATE_MACHINE.md` §3.2 and pinned by AT-STATE-11 |
| an expired continuation could loop and multiply provider spend | added "fetched pages still count against the cap" (`B3_PAGINATION_MODEL.md` §2.1, AT-PAGE-7) |
| a shared reception phone or social URL could cascade a whole category into one Business | added the `>5 Businesses` disqualification guard (AT-DEDUP-8/9) |
| a cancel-spam loop could obtain free provider calls | added the release/retain asymmetry (`B3_QUOTA_COST_CONTROL.md` §4, AT-CAN-11) |
| unknown provider cost defaulting to zero would silently under-report spend | `cost_units` is nullable and never defaulted; a dedicated unknown-cost counter exists (AT-QUOTA-13) |
| provider-supplied names could execute as formulas in the already-built Excel export | added CSV formula neutralization (`B3_SECURITY_PRIVACY_LEGAL.md` §6.2, AT-SEC-5) |

## 6. Known non-blocking observations

| # | Severity | Observation |
|---:|---|---|
| 1 | INFO | Frozen B0 names the same command `RetryDiscoveryJob` in `BACKEND_COMMAND_EVENT_CATALOG.md` and `RetryDiscovery` in `BACKEND_DOMAIN_OWNERSHIP.md`. B3 uses the explicit command-list form and **does not amend B0** for a naming variant |
| 2 | INFO | `B3-D-C011` (analysis keyed by Business or by Lead) is the same open cross-domain question B2 recorded as `B2-D-B006`. Neither CRM nor Discovery may settle it; it belongs to B4 |
| 3 | INFO | Amendment item 1 is the only non-additive change in the bundle. It is stated plainly in `B3_CONTROLLED_AMENDMENTS.md` §2 rather than buried in a schema diff |
| 4 | INFO | An unresolved PROBABLE match can leave two Businesses for one company, permitting two Leads. This is the deliberate, **recoverable** cost of refusing unsafe merges; `business_match_candidates` makes it visible |
| 5 | INFO | Discovery data retention durations remain **PRODUCT / LEGAL DECISION REQUIRED**, inherited from frozen ADR-012. Every table already carries the timestamp a policy would need |
| 6 | INFO | Nine `B3-X-*` external-validation items must be resolved before **implementation**, not before design closure. Each is isolated behind an adapter or a configuration value |
| 7 | INFO | Two pre-existing untracked root files (`B2-FIX.1-*`) remain in the working tree. They are **not** B3 inputs and were not modified, moved, or staged |

## 7. What an implementation agent still cannot do

Until the amendment bundle is approved and applied, no agent may serve `POST /discovery/jobs` with a `keywords`/`locations` body, add any Discovery route, add `filters`/`sort` to a Discovery collection, create any of the five additive tables, alter the `business_identities` key, or emit `DiscoveryJobCancelled` or `BusinessRediscovered` (`B3_CONTROLLED_AMENDMENTS.md` §5).

Independently of the bundle, **B3 grants no implementation authorization at all**. It is design documentation.

## 8. B4 readiness

B4 (AI Lead Intelligence) inherits a stable acquisition contract: one Business per real-world business per workspace, deterministic normalized fields, explicit data-quality metadata, resolvable provenance, and a `BusinessDiscovered` trigger — with B3 owning no score, confidence, tier, or signal (`B3_B4_HANDOFF_CONTRACT.md`).

Five B4-owned decisions are recorded as deferred (`B3-D-C011`…`C015`), and one of them is already open as B2's `B2-D-B006`. **B3's design is complete and correct even if B4 is never built.**

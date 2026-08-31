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
| `RETRY_FAILURE_READY` | **READY** | 30 conditions classified into frozen B0 classes; `ERROR_NEW_COUNT = 0`; no competing policy; the per-Job actor-retry attempt bound (`B3-D-A031`) and the workspace/hour actor-retry admission bound (`B3-D-A032`) both kept explicitly distinct from B0's automatic transient-retry classes |
| `QUOTA_BOUNDARY_READY` | **READY** | one unit per admission; release/retain asymmetry; provisional B8 contract; commercial quota accounting kept explicitly separate from **two** technical provider-cost safety bounds — `MAX_JOB_ATTEMPTS` (per Job) and `MAX_ACTOR_RETRY_REQUESTS_PER_WORKSPACE_PER_HOUR` (workspace/hour) |
| `COST_CONTROL_READY` | **READY** | every bound explicit; ≤ 250 provider calls per job attempt (logical); ≤ 750 per Job across `MAX_JOB_ATTEMPTS = 3`; ≤ 4,500 absolute call attempts per Job including frozen B0 automatic retry; ≤ 20 actor-admitted Job attempts/hour/workspace (10 creates + 10 retries, `B3-D-A032`) ⇒ ≤ 30,000 absolute call attempts/hour/workspace, stated as an **admission-based**, not wall-clock, bound (`B3_QUOTA_COST_CONTROL.md` §5.1.1; the prior 45,000 figure is superseded and non-normative) |
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
| `ACCEPTANCE_TESTS_READY` | **READY** | 378 criteria across 29 categories, 0 duplicates, 28 negative controls (B3-FIX.1 added 23 rows; B3-FIX.2 added 11 more — AT-RETRY-21…31, the workspace/hour actor-retry rate-limiter coverage) |
| `DECISION_REGISTER_READY` | **READY** | 32 Class A closed (B3-FIX.1 added `B3-D-A031`, the per-Job actor-retry attempt bound; B3-FIX.2 added `B3-D-A032`, the workspace/hour actor-retry admission bound), 12 Class B (B3-FIX.2 added `B3-D-B012`, the retry-rate limiter's implementation mechanics), 19 Class C (B3-FIX.1 added `B3-D-C019`, the `BusinessUpserted` downstream requirement) |
| `CONTROLLED_AMENDMENTS_READY` | **READY** | 7 operations / 4 decisions across 4 frozen artifacts, unchanged by B3-FIX.2 (the new retry-rate limiter is a B3-owned architectural bound layered on frozen `BACKEND_RATE_LIMIT_POLICY.md`, not an amendment to it); the one non-additive item stated plainly and mechanically classified (`B3_CONTROLLED_AMENDMENTS.md` §8); B2/B3 composition order made explicit for the one artifact both bundles amend (§6) |
| `B3_CLOSED` | **NOT CLAIMED** | closure requires an independent CTO audit; B3-FIX.1 and B3-FIX.2 are self-authored repairs and do not themselves constitute that audit (§5.2, §5.3 below) |

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
| `ACCEPTANCE_TEST_COUNT` / unique / categories | **378 / 378 / 29** |
| `DUPLICATE_ACCEPTANCE_TESTS` | **0** |
| Negative controls | **28** |
| `CLASS_A_UNRESOLVED` | **0** (32 defined, all closed) |
| `CLASS_B_UNRESOLVED` | **12** |
| `CLASS_C_UNRESOLVED` | **19** |
| `AMENDMENT_DECISION_COUNT` | **4** |
| `AMENDMENT_OPERATION_COUNT` | **7** |
| `AMENDMENT_TARGET_ARTIFACT_COUNT` | **4** |
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
| `ROOT_ARTIFACTS_PRESENT_IN_INTENDED_TREE` | **0** (B3-FIX.2 forward-deletes the two accidental `B2-FIX.1-*` root files — §5.3, §6 item 7) |
| Fenced blocks | **20**, of which **0** are SQL |

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
| `UNAUTHORIZED_FILES = 0` | as of B3-FIX.2, the working tree contains only `Docs/backend/B3/*.md` and `BACKEND_DOCUMENTATION_INDEX.md`. The two `B2-FIX.1-*` root artifacts — accidentally committed by `8a0ea524` (§5.3, §6 item 7) — have been forward-deleted from the working tree; the deletion is authorized B3-FIX.2 scope, not an unauthorized change, and will be included in the B3 closure checkpoint commit without any history rewrite |

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
| `RETRY_FAILURE_MODEL` | **PASS** | classification only; frozen bounds; no competing policy; dead-letter is terminal and alerted; actor-triggered `RetryDiscoveryJob` bounded per-Job by `MAX_JOB_ATTEMPTS = 3` (`B3-D-A031`) and workspace-wide-per-hour by `MAX_ACTOR_RETRY_REQUESTS_PER_WORKSPACE_PER_HOUR = 10` (`B3-D-A032`), both kept explicitly distinct from B0's automatic transient-retry classes |
| `QUOTA_BOUNDARY_MODEL` | **PASS** | one unit per admission; retries never double-charge; release/retain asymmetry justified; "no second quota unit" no longer implies unlimited provider work — bounded independently by `MAX_JOB_ATTEMPTS` (per Job) and `MAX_ACTOR_RETRY_REQUESTS_PER_WORKSPACE_PER_HOUR` (workspace/hour) |
| `B2_CRM_BOUNDARY` | **PASS** | no CRM write path; `BusinessRediscovered` carries exactly B2's four fields; B2 untouched |
| `B4_HANDOFF_BOUNDARY` | **PASS** | stable acquisition contract; B3 owns no AI field; B3 is correct if B4 never ships |
| `TENANCY_MODEL` | **PASS** | `workspace_id` everywhere but the documented catalogue; uniform `404`; scope precedes state |
| `CONCURRENCY_MODEL` | **PASS** | 18 races decided by PostgreSQL; no Redis in any correctness path |
| `COST_CONTROL_MODEL` | **PASS** | every provider path bounded; per-attempt and per-Job worst case computed; the hourly/workspace worst case is now an explicit, honestly-scoped **admission-based** bound (≤ 20 actor-admitted Job attempts/hour/workspace, `B3-D-A032` — `B3_QUOTA_COST_CONTROL.md` §5.1.1), not an overstated wall-clock guarantee; unknown cost never reported as zero |

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
| the retry-resets-counters rule initially left `created_at` ambiguous | fixed explicitly in `B3_JOB_STATE_MACHINE.md` §3.3 and pinned by AT-STATE-11 |
| an expired continuation could loop and multiply provider spend | added "fetched pages still count against the cap" (`B3_PAGINATION_MODEL.md` §2.1, AT-PAGE-7) |
| a shared reception phone or social URL could cascade a whole category into one Business | added the `>5 Businesses` disqualification guard (AT-DEDUP-8/9) |
| a cancel-spam loop could obtain free provider calls | added the release/retain asymmetry (`B3_QUOTA_COST_CONTROL.md` §4, AT-CAN-11) |
| unknown provider cost defaulting to zero would silently under-report spend | `cost_units` is nullable and never defaulted; a dedicated unknown-cost counter exists (AT-QUOTA-13) |
| provider-supplied names could execute as formulas in the already-built Excel export | added CSV formula neutralization (`B3_SECURITY_PRIVACY_LEGAL.md` §6.2, AT-SEC-5) |

### 5.2 B3-FIX.1 — repairs made against a genuinely independent CTO audit

Unlike §5's self-review, the findings below were raised by an **independent** audit, not found by B3's own authors. They are recorded the same way for the same reason: an approver should see what was wrong, not only that it is now fixed.

| Finding | Severity | Repair |
|---|---|---|
| `RetryDiscoveryJob` had no upper bound on actor-triggered attempts — `create → execute → cancel → retry` could repeat indefinitely, and "no second quota unit" (§4) was previously indistinguishable from "unlimited provider work" | **MAJOR** | added `B3-D-A031`: `MAX_JOB_ATTEMPTS = 3`, `MAX_ACTOR_RETRIES_PER_JOB = 2`, enforced transactionally before any provider-facing side effect (`B3_JOB_STATE_MACHINE.md` §3.2); cancellation proven not to reset the bound; automatic transient retry proven distinct and still B0-bounded; the hourly/workspace cost model recomputed (`B3_QUOTA_COST_CONTROL.md` §5.1); 8 new acceptance tests (AT-RETRY-13…20) |
| `DiscoveryJobCreate` had undeclared drift: two documents stated `provider_source` as required (never true of the frozen contract or of B3's own controlled amendment), the query-requiredness change from frozen `required:[query]` was never stated as non-additive, and the request DTO table omitted `query` entirely while adjacent prose called it a retained alias | **MAJOR** | `provider_source` requiredness corrected to optional everywhere in the corpus, with a deterministic non-guessing omission rule (`B3_API_DTO_CONTRACTS.md` §3.1.3); the requiredness change stated plainly as non-additive (§3.1, §2 of `B3_CONTROLLED_AMENDMENTS.md`); a full deterministic compatibility table added for every `query`/`keywords`/`locations` combination (§3.1.2); 12 new acceptance tests (AT-REQ-22…31, AT-ADM-11…13) |
| `B3_CONTROLLED_AMENDMENTS.md` §6 claimed B3's bundle "touches no artifact B2's items touch" and "may be approved in either order" — false for `BACKEND_API_CATALOG.md`, which both B2's item 3 and B3's item 5 extend | **MAJOR** | the false independence claim withdrawn; a canonical B0→B1→B2→B3 composition order stated; a full overlapping-artifact composition matrix added (§6.1) proving `GET /leads`/`GET /tasks` survive B3's amendment; 2 new acceptance tests (AT-B2-14/15) |
| the amendment bundle's own count was internally inconsistent — "6 items across 3 artifacts" undercounted the artifacts touched (`BACKEND_API_CATALOG.md` was folded into the OpenAPI tally) | **MINOR** | three explicit, mechanically derived counting units — `AMENDMENT_OPERATION_COUNT = 7`, `AMENDMENT_DECISION_COUNT = 4`, `AMENDMENT_TARGET_ARTIFACT_COUNT = 4` — replacing the single ambiguous "items" word |
| no acceptance coverage existed for the `DiscoveryJobCreate` K×L/compatibility amendment | **MINOR** | added (see the DTO-drift repair row above) |
| `DiscoveryJob.query`'s role changed from B0's authoritative search input to a B3 compatibility/display projection, without saying so — and collided in description with the new `name` field | **MINOR** | `B3_API_DTO_CONTRACTS.md` §4.1 now names the three roles explicitly (`keywords`/`locations` = authoritative input, `name` = current display, `query` = frozen-compatibility-only) |
| frozen `B2_CRM_LIST_QUERY_MODEL.md` and `B2_FAILURE_SCENARIOS.md` name `BusinessUpserted` as a consumer-side refresh trigger for `crm_lead_list_projection`; `B3_B4_HANDOFF_CONTRACT.md` said "no consumer exists" for the adjacent `BusinessUpdated` question, which was true for B4 but not honestly stated relative to B2's already-named dependency | **MINOR** | corrected to acknowledge B2 as an existing named consumer; the gap between B3's current events and that trigger recorded honestly as `B3-D-C019`, non-blocking because the projection is non-authoritative and nightly-reconciled |
| an ID collision — `B3-D-B004` was used for two unrelated decisions (the `>5 Businesses` threshold in `B3_DECISION_REGISTER.md`, and the `CancelDiscoveryJob` command in `B3_COMMAND_EVENT_CATALOG.md`) | consequential (found while repairing MINOR-1) | the command's citation corrected to `B3-D-B005`, which already covered the two additive events; `B3-D-B005`'s description broadened to cover the command too |
| `B3_JOB_STATE_MACHINE.md` and `B3_FRONTEND_TRACEABILITY.md` cited `data.js:488` for the frozen status-vocabulary integrity assertion; the actual assertion is at `data.js:490` (`:488` is the combination-count assertion, correctly cited elsewhere) | INFO | both citations corrected to `data.js:490` |

### 5.3 B3-FIX.2 — repairs against the fresh independent B3-FIX.1 re-countersign

A **second**, genuinely independent auditor re-verified B3-FIX.1 from a fresh session — not the same party that authored either B3 or B3-FIX.1 — and found the repair of the retry-attempt-bound and DTO-drift findings solid, but surfaced two remaining blockers. Both are repaired here, and neither required reopening anything the re-countersign verified as already closed (the list in that audit's closing summary — `MAX_JOB_ATTEMPTS`, `provider_source` optionality, query compatibility, K×L semantics, amendment composition, `BusinessUpserted` compatibility, and all domain-model gates — is untouched by this pass).

| Finding | Severity | Repair |
|---|---|---|
| Commit `8a0ea5248ea304d1090511b2e1bee646f0457404` ("B3") accidentally bundled two unrelated historical `B2-FIX.1-*` process artifacts (707 lines) alongside the genuine B3 documentation surface — left uncommitted after the prior B2-FIX.1 session and swept into the next commit instead of being committed or discarded on their own | **MAJOR** (repository hygiene) | forward working-tree deletion of `B2-FIX.1-COMPLETION-REPORT.md` and `B2-FIX.1-INDEPENDENT-CTO-AUDIT.md` — **no history rewrite, no amend, no rebase, no reset, no force push**; the deletion is staged for the eventual B3 closure checkpoint commit only; §6 item 7 below corrected to state the history accurately rather than the now-stale "remain untracked" claim |
| Actor-triggered retries had a correct per-Job ceiling (`MAX_JOB_ATTEMPTS = 3`, `B3-D-A031`) but no independent per-workspace/hour ceiling — a workspace could accumulate `failed`/`cancelled` Jobs across many admission-hours (`CreateDiscoveryJob`'s 10/hour cap only limits new-admission *rate*, not accumulation over time) and burst-retry all of them within a single hour, decoupling retry-driven provider cost from the hourly figure the design previously claimed | **MAJOR** (unbounded cost path) | added `B3-D-A032`: `MAX_ACTOR_RETRY_REQUESTS_PER_WORKSPACE_PER_HOUR = 10`, a third counter independent of both `CreateDiscoveryJob`'s submission limit and `MAX_JOB_ATTEMPTS`, enforced before `attempt_no` increment and before any provider-facing side effect (`B3_JOB_STATE_MACHINE.md` §3.2.1); the historical-burst attack (1,000 accumulated jobs retried in one hour) traced explicitly and closed; the superseded 45,000/hour figure marked non-normative and replaced with an honestly-scoped **admission-based** bound of ≤ 20 actor-admitted Job attempts/hour/workspace ⇒ ≤ 30,000 absolute call attempts/hour/workspace, with the admission-rate-vs-wall-clock distinction stated explicitly rather than overclaimed (`B3_QUOTA_COST_CONTROL.md` §5.1.1); 11 new acceptance tests (AT-RETRY-21…31, including the historical-burst test AT-RETRY-28 and a negative control AT-RETRY-31) |

No new error code was introduced (`NEW_ERROR_CODES = 0`): the retry-rate rejection reuses frozen B0's generic `RateLimited` `429` component with a distinguishing `details.reason`, the same technique `409 CONFLICT` already uses for its several causes.

## 6. Known non-blocking observations

| # | Severity | Observation |
|---:|---|---|
| 1 | INFO | Frozen B0 names the same command `RetryDiscoveryJob` in `BACKEND_COMMAND_EVENT_CATALOG.md` and `RetryDiscovery` in `BACKEND_DOMAIN_OWNERSHIP.md`. B3 uses the explicit command-list form and **does not amend B0** for a naming variant |
| 2 | INFO | `B3-D-C011` (analysis keyed by Business or by Lead) is the same open cross-domain question B2 recorded as `B2-D-B006`. Neither CRM nor Discovery may settle it; it belongs to B4 |
| 3 | INFO | Amendment item 1 is the only non-additive change in the bundle. It is stated plainly in `B3_CONTROLLED_AMENDMENTS.md` §2 rather than buried in a schema diff |
| 4 | INFO | An unresolved PROBABLE match can leave two Businesses for one company, permitting two Leads. This is the deliberate, **recoverable** cost of refusing unsafe merges; `business_match_candidates` makes it visible |
| 5 | INFO | Discovery data retention durations remain **PRODUCT / LEGAL DECISION REQUIRED**, inherited from frozen ADR-012. Every table already carries the timestamp a policy would need |
| 6 | INFO | Nine `B3-X-*` external-validation items must be resolved before **implementation**, not before design closure. Each is isolated behind an adapter or a configuration value |
| 7 | INFO (history correction, B3-FIX.2) | Two `B2-FIX.1-*` root files were **not** B3 inputs, but the prior claim that they "remain untracked/unstaged" is no longer true: they were nonnormative B2 process artifacts left over from the earlier B2-FIX.1 session, and were accidentally swept into B3's own commit `8a0ea524` alongside the genuine B3 documentation surface. B3-FIX.2 corrects this by forward-deleting both from the working tree (§5.3) — no Git history rewrite is performed, no frozen B2 normative document is affected, and the deletion is authorized, not unauthorized, B3 scope |
| 8 | INFO | `B3-FIX.1`'s repairs (§5.2) and `B3-FIX.2`'s repairs (§5.3) were each authored and mechanically self-verified by the same party that produced the design being repaired. **Neither constitutes independent verification.** Every gate in §1 reading `READY`, and every FIX.1/FIX.2 success condition in the accompanying reports reading `PASS`, states evidence — it does not substitute for the fresh independent CTO countersignature B3 still requires before it may be considered closed |

## 7. What an implementation agent still cannot do

Until the amendment bundle is approved and applied, no agent may serve `POST /discovery/jobs` with a `keywords`/`locations` body, add any Discovery route, add `filters`/`sort` to a Discovery collection, create any of the five additive tables, alter the `business_identities` key, or emit `DiscoveryJobCancelled` or `BusinessRediscovered` (`B3_CONTROLLED_AMENDMENTS.md` §5).

Independently of the bundle, **B3 grants no implementation authorization at all**. It is design documentation.

## 8. B4 readiness

B4 (AI Lead Intelligence) inherits a stable acquisition contract: one Business per real-world business per workspace, deterministic normalized fields, explicit data-quality metadata, resolvable provenance, and a `BusinessDiscovered` trigger — with B3 owning no score, confidence, tier, or signal (`B3_B4_HANDOFF_CONTRACT.md`).

Five B4-owned decisions are recorded as deferred (`B3-D-C011`…`C015`), and one of them is already open as B2's `B2-D-B006`. **B3's design is complete and correct even if B4 is never built.**

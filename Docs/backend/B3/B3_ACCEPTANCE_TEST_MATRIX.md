# B3 — Acceptance Test Matrix

> **B3 status:** Implementation-independent acceptance criteria. Each row gives a unique ID, preconditions, action, expected outcome, and the invariant protected. Nothing here names a framework, a library, or a file path. Rows marked **NC** are negative controls that must **fail** an implementation with the named defect.

## 1. Request normalization — AT-REQ

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-REQ-1 | authorized member | submit `keywords: []` | `400 VALIDATION_ERROR`, `details.field="keywords"`; no job, no quota, no provider call | B3-INV-11 |
| AT-REQ-2 | same | submit `locations: []` | `400`, `details.field="locations"` | B3-INV-11 |
| AT-REQ-3 | same | submit `keywords: ["   "]` | `400` — blank after normalization | B3-INV-11 |
| AT-REQ-4 | same | submit `["restaurant"," Restaurant ","RESTAURANT"]` | exactly **one** keyword; display form `"restaurant"`; `combination_count` reflects 1 | B3-INV-11 |
| AT-REQ-5 | same | submit `["مطاعم","مطاعم "]` | one keyword | B3-INV-11 |
| AT-REQ-6 | same | submit `["مَطَاعِم","مطاعم"]` | one keyword; the **diacritic form** is the dispatched display form (first-wins) | B3-D-A004 |
| AT-REQ-7 | same | submit `["أحمد","احمد"]` | one keyword — alef forms unified in the normalized key | B3-D-A004 |
| AT-REQ-8 | same | submit `["مطاعم","مطعم"]` | **two** keywords — no stemming | B3-D-A004 |
| AT-REQ-9 | same | submit locations `["الرياض","رياض"]` | **two** locations — no article stripping | B3-D-A004 |
| AT-REQ-10 | same | submit a keyword containing `ة` and one containing `ه` | **two** keywords — ta marbuta is never unified | B3-D-A004 |
| AT-REQ-11 | same | submit a 200-character keyword | `400` — length bound | B3-INV-11 |
| AT-REQ-12 | same | submit a keyword containing a control character | `400` | §2 security |
| AT-REQ-13 | same | submit Arabic-Indic digits in a keyword | normalized key uses ASCII digits; display form preserves the original | B3-D-A004 |
| AT-REQ-14 | job created | inspect the dispatched provider request | the **display** form is dispatched, not the normalized key | B3-D-A004 |
| AT-REQ-15 | same | inspect `discovery_queries` | both `*_display` and `*_norm` are stored | B3-D-A004 |
| AT-REQ-16 | same | submit `["a","b"]` then `["b","a"]`, same filters | identical `request_fingerprint`; **different** execution order | §4 |
| AT-REQ-17 | same | submit `result_limit: 750` | `400` — not in `{500,1000,2000}` | B3-INV-11 |
| AT-REQ-18 | same | submit `filters.min_rating: "3"` | `400` — closed set violation | §3 |
| AT-REQ-19 | same | submit an unknown filter key | `400` — no opaque passthrough | B3-INV-3 |
| AT-REQ-20 **NC** | same | an implementation that dispatches the **normalized** key to the provider | AT-REQ-14 fails — over-normalization changed search semantics | B3-D-A004 |
| AT-REQ-21 **NC** | same | an implementation that counts combinations **before** duplicate collapse | AT-REQ-4 fails — duplicates inflate cost | B3-INV-11 |

## 2. Query expansion — AT-EXP

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-EXP-1 | 3 keywords, 4 locations | create the job | 12 `discovery_queries` rows; `combination_count = 12` | §5 |
| AT-EXP-2 | same | inspect ordering | `sequence` follows `(keyword_index, location_index)` over the deduplicated arrays | §5 |
| AT-EXP-3 | same | attempt to insert a duplicate `(job, keyword_norm, location_norm)` | rejected by the unique constraint | §5 |
| AT-EXP-4 | job created | check the stored `combination_count` against the arrays | `combination_count = |kw| × |loc|`, enforced as a database constraint | data model §2 |
| AT-EXP-5 | 2 keywords, 1 location, one keyword duplicated by case | create | 2 queries, not 4 | B3-INV-11 |
| AT-EXP-6 | any job | restart the planner | the plan is byte-identical — expansion is deterministic | §5 |

## 3. Safety bounds — AT-BOUND

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-BOUND-1 | authorized | 11 keywords | `400` | B3-INV-11 |
| AT-BOUND-2 | authorized | 11 locations | `400` | B3-INV-11 |
| AT-BOUND-3 | authorized | 10 kw × 8 loc = 80 | `400`, `reason="combination_limit_exceeded"`, `combination_count=80`, `max=50` | B3-INV-11 |
| AT-BOUND-4 | authorized | 10 kw × 5 loc = 50 | **accepted** — the boundary is inclusive | B3-INV-11 |
| AT-BOUND-5 | execution running | provider offers a 6th page | execution ends `PAGE_LIMIT_REACHED` — a **success** | §6 |
| AT-BOUND-6 | job with `result_limit=500` | ingestion reaches 500 | ingestion stops; job completes `truncated`; results **visible** | B3-INV-8 |
| AT-BOUND-7 | 11th submission in one hour | submit | `429` + `Retry-After`; no job | frozen B0 rate limit |
| AT-BOUND-8 | any job attempt | count provider calls | ≤ 250 (50 combinations × 5 pages) | B3-INV-11 |
| AT-BOUND-9 **NC** | — | an implementation with no page cap | AT-BOUND-5 and AT-BOUND-8 fail — unbounded fan-out | B3-INV-11 |

## 4. Admission — AT-ADM

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-ADM-1 | valid request | submit | `202` with the job resource; status `pending` | API §2.1 |
| AT-ADM-2 | quota exhausted | submit | `403 QUOTA_EXHAUSTED`; **no job row** | B3-INV-10 |
| AT-ADM-3 | capability absent from plan | submit | `403 ENTITLEMENT_LOCKED` — **distinct** from quota exhaustion | frontend #21 |
| AT-ADM-4 | `provider_source` with `status="mock"` | submit | `422`, `reason="source_not_dispatchable"` | §8 |
| AT-ADM-5 | unknown `provider_source` | submit | `422` | §8 |
| AT-ADM-6 | validation fails | submit | no quota reserved — validation precedes reservation | §8 |
| AT-ADM-7 | admission succeeds | inspect the transaction | job + queries + reservation + idempotency record + outbox row commit **together** | §8 |
| AT-ADM-8 | crash between reservation and job insert | recover | neither exists — one transaction | §8 |
| AT-ADM-9 | rate limit exceeded | submit | `429` before any entitlement or quota call | §8 ordering |
| AT-ADM-10 **NC** | — | an implementation reserving quota before validation | AT-ADM-6 fails | B3-INV-10 |

## 5. Job state machine — AT-STATE

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-STATE-1 | — | enumerate job states | exactly **5**: `pending, processing, completed, failed, cancelled` | B3-INV-9 |
| AT-STATE-2 | `pending` | worker claims an execution | → `processing` | §3 |
| AT-STATE-3 | `processing`, all executions terminal, ≥1 succeeded | evaluate | → `completed` | §3 |
| AT-STATE-4 | `processing`, all terminal, none succeeded | evaluate | → `failed` | §3 |
| AT-STATE-5 | `completed` | attempt any transition other than retry | rejected | §3 |
| AT-STATE-6 | `completed` | retry | `409 job_not_retryable` | §3 |
| AT-STATE-7 | `failed` | retry | → `pending`, `attempt_no` incremented | §3 |
| AT-STATE-8 | `cancelled` | retry | → `pending` | §3 |
| AT-STATE-9 | any job | inspect state within one attempt | monotonic; never moves backwards | §3.1 |
| AT-STATE-10 | job cancelled | inspect `completed_at` | `null` | §8 |
| AT-STATE-11 | job completed | inspect `created_at` after a retry | **unchanged** — retry never resets creation | §3.2 |
| AT-STATE-12 **NC** | — | an implementation adding a 6th state `partially_completed` | AT-STATE-1 fails; and results become invisible for it | B3-INV-9 |

## 6. Progress and counters — AT-PROG

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-PROG-1 | `pending` | read | `progress = 0` | §4 |
| AT-PROG-2 | 4 of 10 executions terminal | read | `progress = 40` | §4 |
| AT-PROG-3 | non-terminal job | read | `progress < 100` — 100 is written only at terminal entry | §4 |
| AT-PROG-4 | any attempt | observe progress over time | non-decreasing | §4 |
| AT-PROG-5 | any job, any state | check counters | `found − duplicate = deduplicated` | data model §2 |
| AT-PROG-6 | duplicate absorbed | check counters | `found` and `duplicate` both advance; `deduplicated` unchanged | §4.1 |
| AT-PROG-7 | record rejected for missing identity | check counters | none of the three advances — it never became a result | quality §4 |
| AT-PROG-8 | retry | check counters | reset to 0 at the new attempt | §3.2 |
| AT-PROG-9 | duplicate page absorbed | check counters | **no** counter advances | idem layer 6 |
| AT-PROG-10 | any job | read `query_executions` | one entry per combination of the current attempt, each with an outcome | API §4.2 |

## 7. Result visibility — AT-VIS

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-VIS-1 | job `completed` | `GET .../results` | `200` with the paginated list | **B3-INV-8** |
| AT-VIS-2 | job `processing` | `GET .../results` | `409`, `reason="results_not_available"`, `job_status="processing"` | **B3-INV-8** |
| AT-VIS-3 | job `pending` | same | `409` | B3-INV-8 |
| AT-VIS-4 | job `failed` | same | `409` | B3-INV-8 |
| AT-VIS-5 | job `cancelled` | same | `409` | B3-INV-8 |
| AT-VIS-6 | job `processing` with rows already committed | inspect storage vs API | rows **exist** in storage; API returns `409` — persistence ≠ visibility | B3-INV-8 |
| AT-VIS-7 | job `failed` with committed rows | inspect storage | rows **retained**, not deleted | §5 |
| AT-VIS-8 | job `cancelled` with committed rows | inspect storage | rows retained | §5 |
| AT-VIS-9 | foreign workspace's completed job | `GET .../results` | `404`, **not** `409` — scope check precedes state check | B3-INV-1 |
| AT-VIS-10 | job completed with `filtered` rows | list results | filtered rows excluded from the visible set and from `deduplicated_count` | §3 |
| AT-VIS-11 **NC** | — | an implementation serving results while `processing` | AT-VIS-2 fails; and cursor stability is lost | B3-INV-8 |

## 8. Partial success — AT-PART

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-PART-1 | 20 combinations, 19 succeed, 1 fails permanently | complete | `completed`, `completion_kind="partial"`, `failed_query_count=1` | §6 |
| AT-PART-2 | same | `GET .../results` | `200` — **the 19 combinations' results are visible** | §6 |
| AT-PART-3 | all succeed, no limit hit | complete | `completion_kind="full"` | §6 |
| AT-PART-4 | all executions `PROVIDER_NO_MATCH` | complete | `completed`, `completion_kind="empty"` — **not `failed`** | §6 |
| AT-PART-5 | result limit reached | complete | `completion_kind="truncated"`; results visible | §6 |
| AT-PART-6 | page limit reached on one execution | complete | that execution is a **success**; job `truncated` | §6 |
| AT-PART-7 | no execution succeeded | complete | `failed`, `failure_code="all_queries_failed"` | §6 |
| AT-PART-8 | partial completion | inspect `query_executions` | each failed combination names its outcome; **no provider error string** | B3-INV-3 |
| AT-PART-9 **NC** | — | an implementation failing the whole job when one execution fails | AT-PART-1 and AT-PART-2 fail — 19 combinations of paid data discarded | §6 |

## 9. Cancellation — AT-CAN

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-CAN-1 | `pending` | cancel | `200`; → `cancelled`; **quota released** | §7 |
| AT-CAN-2 | `processing` | cancel | `200`; → `cancelled`; **quota retained** | §7 |
| AT-CAN-3 | terminal | cancel | `409`, `reason="job_already_terminal"`; nothing mutated | §7 |
| AT-CAN-4 | cancel commits while a provider call is in flight | observe | the call completes and **its page is ingested**; execution then `CANCELLED` | §7 |
| AT-CAN-5 | cancel racing completion, completion first | observe | cancel `409`; job `completed` | R-12 |
| AT-CAN-6 | cancel racing completion, cancel first | observe | job stays `cancelled`; the worker records its outcome without transitioning the job | R-12 |
| AT-CAN-7 | cancelled | list jobs | the job is **present** with status `cancelled` — never deleted | frontend #35 |
| AT-CAN-8 | non-owner, member rank | cancel | `403` | authz §3.1 |
| AT-CAN-9 | non-owner, manager rank | cancel | `200` | authz §3.1 |
| AT-CAN-10 | stale `version` | cancel | `409 STALE_VERSION` | ADR-010 |
| AT-CAN-11 **NC** | — | an implementation releasing quota on a `processing` cancel | AT-CAN-2 fails — unlimited free provider calls by cancel-spam | B3-INV-10 |

## 10. Retry — AT-RETRY

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-RETRY-1 | `failed` | retry | `202`; `pending`; **same `JOB-*`** | frontend #37 |
| AT-RETRY-2 | same | inspect quota | **no second `discoveryRuns` unit** | **B3-INV-10** |
| AT-RETRY-3 | same | inspect the request | keywords, locations, filters, source, limit **unchanged** | §3.2 |
| AT-RETRY-4 | same | inspect counters and progress | reset to 0 | §3.2 |
| AT-RETRY-5 | same | inspect prior `discovery_results` | **retained** | §3.2 |
| AT-RETRY-6 | same | inspect prior execution rows | retained with their original `attempt_no` | §3.2 |
| AT-RETRY-7 | retry re-observes the same Business | inspect | **no** duplicate Business; a **new** `discovery_results` row against the new execution | B3-INV-4 |
| AT-RETRY-8 | `completed` | retry | `409 job_not_retryable` | §3 |
| AT-RETRY-9 | stale `version` | retry | `409 STALE_VERSION`; no double execution | R-11 |
| AT-RETRY-10 | member with exhausted quota, `failed` job | retry | **allowed** — retry consumes no quota | authz §3 |
| AT-RETRY-11 **NC** | — | an implementation charging a quota unit per retry | AT-RETRY-2 and AT-RETRY-10 fail | B3-INV-10 |
| AT-RETRY-12 **NC** | — | an implementation minting a new `JOB-*` on retry | AT-RETRY-1 fails — the frozen frontend navigates to the same id | frontend #37 |

## 11. Business identity — AT-ID

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-ID-1 | new provider result | ingest | one `businesses` row + one `business_identities` row | §4 |
| AT-ID-2 | same identity ingested again | ingest | **no** second Business; fields refreshed | B3-INV-4 |
| AT-ID-3 | two keywords find the same business in one job | ingest both | 1 Business, **2** `discovery_results` | B3-INV-4 |
| AT-ID-4 | two locations, same business | ingest | 1 Business, 2 results | B3-INV-4 |
| AT-ID-5 | two jobs, same business | ingest | 1 Business, 2 results | B3-INV-4 |
| AT-ID-6 | two providers reusing the same external-id string for **different** businesses | ingest both | **2** Businesses — `provider` is part of the key | **B3-INV-5** |
| AT-ID-7 | same real business in two workspaces | ingest | **2** independent Businesses, no shared row | B3-INV-1 |
| AT-ID-8 | any Business | inspect `provider_source`/`provider_external_id` | the **anchor** identity; immutable across refresh and link | quality §3 |
| AT-ID-9 | Business with 2 identities | `GET /businesses/{id}` | frozen schema unchanged; both identities in `provenance.identities` | quality §3 |
| AT-ID-10 | any Business | inspect `first_discovered_at` | write-once; never changes | data model §6 |
| AT-ID-11 **NC** | — | an implementation keyed on `(workspace, external_id)` without `provider` | AT-ID-6 fails — two companies collapse into one | B3-INV-5 |
| AT-ID-12 **NC** | — | an implementation storing a single `discovery_job_id` on the Business | AT-ID-3/4/5 fail — provenance is lost | B3-INV-4 |

## 12. Cross-provider deduplication — AT-DEDUP

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-DEDUP-1 | provider B result matching an existing Business on **phone + domain + country** | ingest | **auto-link**: 1 Business, 2 identities, `link_basis="strong_match"` | §5.1 |
| AT-DEDUP-2 | matching on **phone only** | ingest | **no link**: 2 Businesses + a `probable` candidate row | **B3-INV-6** |
| AT-DEDUP-3 | matching on **domain only** | ingest | 2 Businesses + candidate | B3-INV-6 |
| AT-DEDUP-4 | **identical normalized name, same city**, no phone, no website | ingest | 2 Businesses + at most a `probable` candidate; **never merged, never linked** | **B3-INV-6** |
| AT-DEDUP-5 | coordinates within 75 m, high name similarity, nothing else | ingest | 2 Businesses + `probable` candidate | B3-INV-6 |
| AT-DEDUP-6 | phone matches, domains differ and both present | ingest | demoted to `probable`; no link | §5.1 |
| AT-DEDUP-7 | two existing Businesses both match strongly | ingest | **no link**; new Business + one `ambiguous` candidate per contender | §5.1 |
| AT-DEDUP-8 | a phone appearing on 6 Businesses | ingest a 7th sharing it | the phone is disqualified as a strong signal; no cascade | §5.3 |
| AT-DEDUP-9 | website is a social-media/aggregator host | ingest | the domain is disqualified as a strong signal | §5.3 |
| AT-DEDUP-10 | country codes differ | ingest with 2 strong signals | **no auto-link** — country must match | §5.1 |
| AT-DEDUP-11 | candidate recorded | inspect | it never applies itself; resolution requires an explicit merge or rejection | B3-INV-6 |
| AT-DEDUP-12 | strong match across **workspaces** | ingest | **no link** — matching never crosses a workspace | B3-INV-1 |
| AT-DEDUP-13 **NC** | — | an implementation auto-merging on name similarity at any threshold | AT-DEDUP-4 fails — two companies irreversibly commingled | **B3-INV-6** |
| AT-DEDUP-14 **NC** | — | an implementation auto-linking on a single strong signal | AT-DEDUP-2 fails — the franchise/reception-line case | B3-INV-6 |

## 13. Merge — AT-MERGE

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-MERGE-1 | two Businesses, each with identities and results | merge | all identities re-point to the survivor | B3-INV-7 |
| AT-MERGE-2 | same | merge | all `discovery_results` re-point, keeping `discovered_at`, job, query, provider | **B3-INV-7** |
| AT-MERGE-3 | same | merge | the loser is a **tombstone**, not deleted; `merged_into_business_id` set, `archived_at` set | §6.2 |
| AT-MERGE-4 | merged-away `BUS-*` | `GET /businesses/{id}` | `200` with `provenance.merged_into_ref` | §6.2 |
| AT-MERGE-5 | survivor has a populated field, loser has a different value | merge | **survivor's value kept**; the loser's is retained in field history | §6.1 |
| AT-MERGE-6 | survivor's field is null, loser's is populated | merge | survivor's field filled | §6.1 |
| AT-MERGE-7 | both have a result from the same execution | merge | the duplicate is dropped; **no unique violation** | §6.1 |
| AT-MERGE-8 | merge commits | observe events | `BusinessMerged` with both public IDs | catalog §2 |
| AT-MERGE-9 | Leads exist on both sides | merge | B3 writes **no CRM row**; B2 contract 7 performs the re-point/archive | **B3-INV-2** |
| AT-MERGE-10 | two concurrent merges of the same pair | execute | one succeeds, one `409`; **no deadlock** | R-14 |
| AT-MERGE-11 | merge racing an ingestion resolving to the loser | execute | provenance lands on the **survivor** | R-15 |
| AT-MERGE-12 | any merge | inspect `business_merges` | one append-only row naming actor, reason, evidence, and counts | §6.1 |
| AT-MERGE-13 | analytics over a past period | merge, then re-run | historical counts **unchanged** | B3-INV-7 |
| AT-MERGE-14 **NC** | — | an implementation deleting the losing Business | AT-MERGE-3 and AT-MERGE-4 fail — old references dangle | B3-INV-7 |

## 14. Provenance — AT-PROV

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-PROV-1 | any ingestion | inspect | one `discovery_results` row per (execution × Business) | §3 |
| AT-PROV-2 | rediscovery | inspect | a **new** row; **no existing row modified** | §4 |
| AT-PROV-3 | any row | attempt an update of any column but `business_id` | no such path exists | §4 |
| AT-PROV-4 | any row | inspect `discovered_at` | WazLink **server** clock at ingestion | **B3-INV-13** |
| AT-PROV-5 | provider supplies a timestamp | ingest | `provider_observed_at` recorded separately; **`discovered_at` unaffected** | **B3-INV-13** |
| AT-PROV-6 | provider supplies a **future** timestamp | ingest | `discovered_at` is still the server clock — never future-dated | B3-INV-13 |
| AT-PROV-7 | Business observed 3 times | read `Business.provenance` | 3 observations, 3 job refs, correct first/last | §5 |
| AT-PROV-8 | Business with N results | resolve the deciding job | earliest by `(discovered_at ASC, public_id ASC)`; total order | identity §8 |
| AT-PROV-9 | same execution returns one Business twice | ingest | one row — `(query_execution_id, business_id)` unique | idem layer 8 |
| AT-PROV-10 | job failed after some ingestion | inspect | rows **retained** | §4 |
| AT-PROV-11 | any row | inspect `result_name_at_discovery` | a historical snapshot; unaffected by a later Business rename | §3 |
| AT-PROV-12 | contact fields deleted on a Business | inspect provenance | `discovery_results` **intact**; analytics and audit still answerable | §7 |
| AT-PROV-13 **NC** | — | an implementation stamping `discovered_at` from the provider | AT-PROV-5 and AT-PROV-6 fail — a provider clock enters a downstream column | **B3-INV-13** |

## 15. Idempotency — AT-IDEM

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-IDEM-1 | — | same `Idempotency-Key`, same body, twice | one job, one quota unit; the stored `202` replayed | layer 1 |
| AT-IDEM-2 | — | same key, different body | `409 IDEMPOTENCY_CONFLICT` | layer 1 |
| AT-IDEM-3 | a live job with fingerprint F | submit F again | `409 duplicate_discovery_request` + `existing_job_ref`; no quota, no provider call | layer 2 |
| AT-IDEM-4 | a **terminal** job with fingerprint F | submit F again | **accepted** — a re-run is legitimate | layer 2 |
| AT-IDEM-5 | — | two workers claim one execution | one wins; the other skips | layer 4 |
| AT-IDEM-6 | — | ingest the same page twice | no-op; no counter advances | layer 6 |
| AT-IDEM-7 | — | upsert the same identity twice | one Business; fields refreshed | layer 7 |
| AT-IDEM-8 | — | attach the same (execution, Business) twice | one row | layer 8 |
| AT-IDEM-9 | — | deliver the same callback twice | `200 WEBHOOK_DUPLICATE`; one ingestion | layer 9 |
| AT-IDEM-10 | — | replay a dead-lettered execution | idempotent; no duplicate results | retry §6 |
| AT-IDEM-11 | pre-check passes then loses the race | ingest | the unique constraint absorbs it; **no error surfaces** | §2 |
| AT-IDEM-12 **NC** | — | an implementation relying on a pre-check without a constraint | AT-IDEM-11 fails under concurrency | §2 |

## 16. Concurrency — AT-CONC

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-CONC-1 | — | N simultaneous identical creates | exactly one job | R-01 |
| AT-CONC-2 | — | N workers, one execution | one execution runs | R-03 |
| AT-CONC-3 | — | two providers upsert the same new identity concurrently | one Business | R-07 |
| AT-CONC-4 | — | two executions find one Business concurrently | 1 Business, 2 results | R-08 |
| AT-CONC-5 | — | concurrent normalizations of one identity | deterministic final value | R-10 |
| AT-CONC-6 | — | retry vs completion | one wins; `409 STALE_VERSION` for the loser | R-11 |
| AT-CONC-7 | — | cancel vs completion | exactly one terminal state | R-12 |
| AT-CONC-8 | — | conversion vs rediscovery | both commit; no contention; B2 absorbs any duplicate | R-16 |
| AT-CONC-9 | quota edge | two concurrent reservations | quota never oversold | R-17 |
| AT-CONC-10 | any race in `B3_IDEMPOTENCY_CONCURRENCY.md` §3 | inspect the deciding mechanism | a PostgreSQL row lock, unique index, or `version` — **no Redis key participates** | **B3-INV-15** |
| AT-CONC-11 | ingestion path | inspect locks | ingestion takes **no lock** on its own tables | §4 |

## 17. Pagination — AT-PAGE

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-PAGE-1 | completed job | list results | cursor-paginated; ordered `(discovered_at DESC, public_id DESC)` | §3 |
| AT-PAGE-2 | any page | inspect the cursor and every response field | **no provider continuation token anywhere** | **B3-INV-12** |
| AT-PAGE-3 | any response or log line | search for a provider page token | absent | B3-INV-12 |
| AT-PAGE-4 | completed job | page fully, twice | identical order, no skips, no repeats | §4 |
| AT-PAGE-5 | a cursor from job A | present it to job B | `400 cursor_job_mismatch` | §3 |
| AT-PAGE-6 | a merge occurs between pages | continue paging | the cursor stays valid; the row shows the survivor's `BUS-*`; no skip or repeat | §4 |
| AT-PAGE-7 | provider continuation expires | retry | the query restarts at page 1; results absorbed; fetched pages **still count** against the cap | §2.1 |
| AT-PAGE-8 | job list | filter by each allow-listed key | applied | §5 |
| AT-PAGE-9 | job list | unknown filter key or value | `400` | §5 |
| AT-PAGE-10 | job list | each of the three sorts | total order via the public-ID tiebreaker | §5 |
| AT-PAGE-11 | job list | `date=today` | the **workspace-local** calendar day, not a fixture constant | §5 |
| AT-PAGE-12 | results collection | supply `filters` or `sort` | rejected — not offered on this collection | §3 |
| AT-PAGE-13 **NC** | — | an implementation exposing the provider token as the API cursor | AT-PAGE-2 fails; the cursor expires under the client | **B3-INV-12** |

## 18. Retry and failure classification — AT-FAIL

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-FAIL-1 | provider timeout | observe | retryable, frozen transient class; **execution** scope | §3 |
| AT-FAIL-2 | provider 429 | observe | retryable, honors `Retry-After`; execution scope | §3 |
| AT-FAIL-3 | provider invalid request | observe | **non-retryable**; execution scope | §3 |
| AT-FAIL-4 | provider auth failure | observe | non-retryable; **job** scope; critical alert; quota **released** | §4 |
| AT-FAIL-5 | provider account quota exceeded | observe | non-retryable; job scope; critical alert | §3 |
| AT-FAIL-6 | malformed page | observe | non-retryable for that page; earlier pages kept | §3 |
| AT-FAIL-7 | any B3 document | search for a backoff formula, attempt count, or jitter rule | **none stated except as a citation of frozen B0** | §7 |
| AT-FAIL-8 | any retryable condition | observe | a finite frozen bound applies; no unbounded retry | §7 |
| AT-FAIL-9 | budget exhausted | observe | dead-lettered + alerted; **never marked successful** | §6 |
| AT-FAIL-10 | dead-lettered execution | observe the job | the job still reaches a terminal state; it is not stranded in `processing` | §6 |
| AT-FAIL-11 | any failed job | read `failure_code` | from the closed set; **no provider string, endpoint, or status** | **B3-INV-3** |
| AT-FAIL-12 | any error response | inspect the code | already in the frozen `BACKEND_ERROR_CATALOG.md`; `ERROR_NEW_COUNT = 0` | §3 |
| AT-FAIL-13 | validation failure | observe | attempted exactly once — no retry of a non-retryable class | §7 |
| AT-FAIL-14 **NC** | — | an implementation retrying a validation failure | AT-FAIL-13 fails | frozen B0 |

## 19. Quota and cost — AT-QUOTA

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-QUOTA-1 | admission succeeds | inspect usage | exactly **one** `discoveryRuns` unit | **B3-INV-10** |
| AT-QUOTA-2 | 50-combination job | inspect usage | still **one** unit — not per query | B3-INV-10 |
| AT-QUOTA-3 | 2000 results | inspect usage | still one unit — not per result | B3-INV-10 |
| AT-QUOTA-4 | retry | inspect usage | no second unit | B3-INV-10 |
| AT-QUOTA-5 | worker restart / redelivery / replay | inspect usage | unchanged | B3-INV-10 |
| AT-QUOTA-6 | cancel from `pending` | inspect usage | released | §4 |
| AT-QUOTA-7 | cancel from `processing` | inspect usage | retained | §4 |
| AT-QUOTA-8 | job fails before any provider call | inspect usage | released | §4 |
| AT-QUOTA-9 | job fails after ≥1 provider call | inspect usage | consumed | §4 |
| AT-QUOTA-10 | any worker path | search for a write to `usage_counters` | **none exists** | B3-INV-10 |
| AT-QUOTA-11 | adapter cannot report cost | inspect telemetry | `cost_units` is **null**, never `0`; the unknown-cost counter increments | cost §7 |
| AT-QUOTA-12 | duplicate request suppressed | inspect telemetry | cost-avoided counter increments; no provider call | cost §6 |
| AT-QUOTA-13 **NC** | — | an implementation defaulting unknown cost to `0` | AT-QUOTA-11 fails — spend is silently under-reported | cost §7 |

## 20. Tenancy — AT-TEN

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-TEN-1 | every tenant-owned B3 table | inspect | `workspace_id` NOT NULL; `discovery_sources` is the one documented exception | **B3-INV-1** |
| AT-TEN-2 | foreign `JOB-*` | GET | `404`, identical to an absent ID | B3-INV-1 |
| AT-TEN-3 | foreign `BUS-*` | GET | `404` | B3-INV-1 |
| AT-TEN-4 | any `discovery_results` row | check | `workspace_id` equals the job's **and** the Business's | B3-INV-1 |
| AT-TEN-5 | foreign `provider_external_id` | ingest | no cross-workspace resolution; a new Business is created; no signal returned | B3-INV-1 |
| AT-TEN-6 | foreign completed job | list results | `404`, **not** `409` | authz §4 |
| AT-TEN-7 | any error response | compare foreign vs absent | indistinguishable, including timing | authz §4 |

## 21. Authorization — AT-AUTHZ

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-AUTHZ-1 | no session | any operation | `401 AUTH_REQUIRED` | ADR-009 |
| AT-AUTHZ-2 | viewer | create a job | `403 PERMISSION_DENIED` | B1 matrix |
| AT-AUTHZ-3 | viewer | read a job | allowed | B1 matrix |
| AT-AUTHZ-4 | member with entitlement + quota | create | allowed | B1 matrix |
| AT-AUTHZ-5 | — | enumerate B3 permission codes | exactly `discovery.run`, `discovery.view`, `discovery.export` — **no new code** | authz §1 |
| AT-AUTHZ-6 | — | diff the B1 matrix | **no cell changed** | authz §6 |
| AT-AUTHZ-7 | cookie auth, unsafe request | omit CSRF | rejected | frozen API standard |
| AT-AUTHZ-8 | actor-initiated command | inspect audit | one `AUD-*` row with actor, workspace, action, target, request id | authz §5 |
| AT-AUTHZ-9 | machine ingestion | inspect audit | **no** audit row; traced and metered instead | authz §5 |

## 22. API and DTO — AT-API

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-API-1 | — | enumerate B3 operations | exactly **8** | API §1 |
| AT-API-2 | create | observe the status | **`202`** — frozen async contract | API §2.1 |
| AT-API-3 | cancel | observe | `200` — the transition is committed synchronously | API §2.6 |
| AT-API-4 | retry | observe | `202` | API §2.5 |
| AT-API-5 | every mutation | omit `Idempotency-Key` | rejected | frozen standard |
| AT-API-6 | retry/cancel | omit `If-Match`/`version` | rejected | ADR-010 |
| AT-API-7 | any response | inspect | `request_id` present | frozen standard |
| AT-API-8 | any DTO | search for a provider payload, token, credential, internal UUID, or queue id | absent | **B3-INV-3, B3-INV-12** |
| AT-API-9 | any DTO | search for a score, confidence, tier, or signal | absent | **B3-INV-16** |
| AT-API-10 | any DTO | search for a Lead reference | absent | **B3-INV-2** |
| AT-API-11 | `DiscoveryJob` | compare with the frozen schema | every frozen property retained with its type; `required` unchanged | amendments |
| AT-API-12 | `Business` | compare with the frozen schema | **unchanged**; multi-identity carried inside `provenance` | quality §3 |
| AT-API-13 | `DiscoveryResultList` | compare | unchanged; frozen `PageInfo` | API §4.6 |
| AT-API-14 | source catalogue | GET | no pagination — a bounded catalogue | ADR-011 |
| AT-API-15 | `DiscoverySource` | inspect | no endpoint, credential, or vendor detail | security §4 |
| AT-API-16 | — | look for a provider-diagnostics endpoint | **none exists** | API §6 |
| AT-API-17 | every timestamp | inspect | UTC ISO-8601 with `Z` | frozen standard |

## 23. Commands and events — AT-CMD

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-CMD-1 | — | enumerate commands | **7**; 4 frozen, 1 additive, 2 internal | catalog §1 |
| AT-CMD-2 | — | enumerate events | **7**; 5 frozen, 2 additive | catalog §2 |
| AT-CMD-3 | — | enumerate consumed domain events | **0** | catalog §4 |
| AT-CMD-4 | — | compare the envelope sentence with frozen B0 | **verbatim**; no B3 field added | catalog §0 |
| AT-CMD-5 | any B3 consumer or contract | inspect | no dependence on aggregate version, delivery position, or arrival order | catalog §0 |
| AT-CMD-6 | state change | inspect the outbox | the event row commits in the **same transaction** | ADR-005 |
| AT-CMD-7 | any event | redeliver | idempotent for every consumer | catalog §3 |
| AT-CMD-8 | first discovery of a Business | observe | `BusinessDiscovered` only | catalog §2.2 |
| AT-CMD-9 | rediscovery | observe | `BusinessRediscovered` only — **never both** | catalog §2.2 |
| AT-CMD-10 | one job finds a Business via two keywords | observe | **one** `BusinessRediscovered` for that (business, job) | provenance §6 |
| AT-CMD-11 | — | look for `DiscoveryQueryCompleted` | **absent** — queue mechanics are not events | catalog §2.1 |
| AT-CMD-12 | any B3 document | search for Kafka, BullMQ, SQS, RabbitMQ, or another broker | **absent** | catalog §5 |
| AT-CMD-13 | any event payload | inspect | public IDs, enums, counts, timestamps only | catalog §2.3 |

## 24. B2 / CRM boundary — AT-B2

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-B2-1 | a Business is discovered | inspect CRM | **no Lead created** | **B3-INV-2** |
| AT-B2-2 | any B3 code path | search for a CRM table write | **none exists** | B3-INV-2 |
| AT-B2-3 | any B3 table | search for a Lead reference column | absent | B3-INV-2 |
| AT-B2-4 | rediscovery | inspect the event | exactly B2's **four** fields, nothing more | boundary §4.2 |
| AT-B2-5 | rediscovery of a Business with **no** Lead | observe | the event is still emitted; B2 guard 3 discards it silently | boundary §4.4 |
| AT-B2-6 | any B3 path | search for a read of CRM state | **none** — B3 never consults CRM | boundary §4.4 |
| AT-B2-7 | `BusinessRediscovered` | inspect `discovered_at` | WazLink server clock; skew against B2's `processing_reference_time` is non-positive | **B3-INV-13** |
| AT-B2-8 | conversion with `source_job_ref` naming a job that did **not** discover the Business | submit | `400 source_job_did_not_discover_business` | identity §8 |
| AT-B2-9 | conversion with `source_job_ref = null`, Business found by 3 jobs | submit | the **earliest** discovering job is used; deterministic | identity §8 |
| AT-B2-10 | merge | observe | `BusinessMerged` emitted; B3 writes no CRM row | boundary §5 |
| AT-B2-11 | any B3 output | search for a CRM timeline entry or a `source_domain` claim | absent; Discovery is not in `{messaging, pipeline}` | **B3-INV-14** |
| AT-B2-12 | the frozen B2 corpus | diff against the B2 checkpoint | **unchanged**; `B2_DRIFT = 0` | boundary §7 |
| AT-B2-13 **NC** | — | an implementation reading CRM to filter rediscovery events | AT-B2-6 fails — the dependency direction inverts | domain §5 |

## 25. B4 handoff — AT-B4

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-B4-1 | any B3 table or DTO | search for score, confidence, tier, signal, gap, or analysis status | absent | **B3-INV-16** |
| AT-B4-2 | any Business | inspect for `websiteQuality` as a judgement | absent — B3 stores `website`/`website_domain` only | B3-INV-16 |
| AT-B4-3 | first discovery | observe | `BusinessDiscovered` emitted with the documented payload | handoff §3.2 |
| AT-B4-4 | a Business with missing fields | inspect | `data_quality.{level, missing[], invalid[]}` present | handoff §3.1 |
| AT-B4-5 | a missing field | inspect | `null`, never `""`, `0`, or a placeholder | handoff §3.1 |
| AT-B4-6 | normalized fields change | inspect | `version` increments; `last_observed_at` advances | handoff §3.3 |
| AT-B4-7 | B4 absent entirely | run the full journey | discovery, normalization, dedup, provenance, and conversion all work | handoff §6 |

## 26. Provider abstraction — AT-PROVIDER

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-PROVIDER-1 | — | enumerate ports | `PlacesProvider`, `ScrapingProvider` — the frozen names; no `DiscoveryPort` | §1 |
| AT-PROVIDER-2 | any provider error | inspect the domain-visible value | one of the **ten** normalized outcomes | **B3-INV-3** |
| AT-PROVIDER-3 | any adapter output | inspect | only the `NormalizedProviderResult` fields | B3-INV-3 |
| AT-PROVIDER-4 | adapter without pagination | execute | one page, then `SUCCEEDED` | §3.1 |
| AT-PROVIDER-5 | adapter without `open_now` | request `activity=open` | `filter_degraded` recorded; the constraint is **not** silently dropped | request §3 |
| AT-PROVIDER-6 | result missing `provider_external_id` | ingest | rejected and counted; **job unaffected** | quality §4 |
| AT-PROVIDER-7 | result missing `name` | ingest | rejected and counted | quality §4 |
| AT-PROVIDER-8 | asynchronous provider | execute | submit → callback (or bounded poll) → ingest | §6.1 |
| AT-PROVIDER-9 | callback after the execution is terminal | deliver | `200`, **not applied**, counted | §6.2 |
| AT-PROVIDER-10 | provider swapped | inspect existing identities | original `provider` values retained; history stays interpretable | §6.1 |
| AT-PROVIDER-11 | any request path | search for a caller-supplied URL | **none** — structurally no SSRF surface | security §3 |
| AT-PROVIDER-12 | a discovered `website` value | observe | stored and normalized, **never fetched** | security §3 |

## 27. Normalization and data quality — AT-NORM

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-NORM-1 | valid identity + name, everything else invalid | ingest | **accepted**; `data_quality.level="minimal"` | quality §4 |
| AT-NORM-2 | invalid phone | ingest | phone `null` + `invalid_phone`; record accepted | quality §4.1 |
| AT-NORM-3 | invalid URL | ingest | website `null` + `invalid_url`; record accepted | quality §4.1 |
| AT-NORM-4 | coordinates `(0,0)` | ingest | coordinates `null` + `invalid_coordinates` | quality §4.1 |
| AT-NORM-5 | unknown category | ingest | stored as free text; **no enum coercion to `other`** | quality §6 |
| AT-NORM-6 | duplicate address across businesses | ingest | accepted; a **weak** signal only; never a rejection | quality §4.2 |
| AT-NORM-7 | malformed Unicode | ingest | sanitized per field; the record survives if name and identity survive | quality §4.1 |
| AT-NORM-8 | refresh returns `null` for a populated field | ingest | the stored value is **kept** | quality §5 |
| AT-NORM-9 | refresh returns a new value | ingest | updated; the previous value retained in field history | quality §5 |
| AT-NORM-10 | providers A and B disagree | inspect | one deterministic winner (most recent → anchor → lexicographic); the loser retained in history | quality §5.1 |
| AT-NORM-11 | disagreement | inspect | **never** averaged, concatenated, or longest-string-wins | quality §5.1 |
| AT-NORM-12 | mobile-class phone present | inspect | `whatsapp_available = true`, meaning only that a number exists | quality §7 |
| AT-NORM-13 | any Business | attempt a client edit | no such operation exists in Phase 1 | quality §2 |
| AT-NORM-14 | same provider result | normalize twice | byte-identical field values | quality §1 |
| AT-NORM-15 **NC** | — | an implementation overwriting a populated field with `null` on refresh | AT-NORM-8 fails — an outage erases contact data | quality §5 |

## 28. Security and privacy — AT-SEC

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-SEC-1 | invalid webhook signature | deliver | `401`, security alert, **no parsing, no domain effect** | security §5 |
| AT-SEC-2 | oversized webhook payload | deliver | rejected before parsing | security §5 |
| AT-SEC-3 | replayed webhook outside the freshness window | deliver | rejected | security §5 |
| AT-SEC-4 | webhook naming a foreign workspace's execution | deliver | acknowledged, **not applied** | security §5 |
| AT-SEC-5 | business name beginning `=`, `+`, `-`, or `@` | export CSV | neutralized as text — no formula execution | security §6.2 |
| AT-SEC-6 | any log line | search for a credential, token, raw payload, or contact PII | absent | observability §3 |
| AT-SEC-7 | any trace span | search for a sensitive payload | absent | frozen B0 |
| AT-SEC-8 | raw snapshots enabled | inspect a snapshot | **PII excluded**; size-capped; expiry set | provider §7 |
| AT-SEC-9 | raw snapshot older than the retention window | run the sweep | purged | provider §7 |
| AT-SEC-10 | any tenant API surface | attempt to read a raw snapshot | **not exposed to any role** | provider §7 |
| AT-SEC-11 | operator reads a raw snapshot | inspect audit | an `AUD-*` row naming operator, target, and reason | observability §5 |
| AT-SEC-12 | any B3 table | search for a credential column | absent | security §4 |
| AT-SEC-13 | deletion request | null the contact fields | provenance intact; analytics still answerable | provenance §7 |
| AT-SEC-14 | adapter outbound request | target a private/loopback/metadata address | denied, including after DNS resolution and on every redirect hop | security §3 |

## 29. Observability — AT-OBS

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-OBS-1 | any Business | trace backwards | `BUS-* → RES-* → provider_request_id → execution → query → JOB-* → request_id` resolves fully | observability §4 |
| AT-OBS-2 | any request | trace forwards | every provider call it caused is reachable | observability §4 |
| AT-OBS-3 | provider auth failure | observe | **critical** alert | observability §6 |
| AT-OBS-4 | forged webhook | observe | security alert | observability §6 |
| AT-OBS-5 | dead-lettered execution | observe | alert; never silent | retry §6 |
| AT-OBS-6 | ambiguous-match rate above threshold | observe | alert — silent identity degradation is surfaced | observability §6 |
| AT-OBS-7 | stale callbacks dropped | observe | counted; alert above threshold | observability §6 |
| AT-OBS-8 | rejected records | observe | counted by reason | observability §2.4 |
| AT-OBS-9 | suppressed duplicate request | observe | cost-avoided counter increments | observability §2.4 |
| AT-OBS-10 | 2000-result job | count log lines | one per transition, provider call, and rejection — **not** one per result | observability §3 |

---

## 30. Counts

| Metric | Value |
|---|---|
| `ACCEPTANCE_TEST_COUNT` | **344** |
| `ACCEPTANCE_CATEGORY_COUNT` | **29** |
| `DUPLICATE_ACCEPTANCE_TESTS` | **0** |
| Negative controls | **22** |

Every Class A frontend behavior in `B3_FRONTEND_TRACEABILITY.md` §2, every invariant in `B3_DISCOVERY_BLUEPRINT.md` §4, every Class A decision in `B3_DECISION_REGISTER.md` §1, and every scenario in `B3_FAILURE_SCENARIOS.md` maps to at least one row above.

**Negative controls exist for each defect most likely to be implemented by accident:** over-normalized dispatch (AT-REQ-20), pre-collapse combination counting (AT-REQ-21), unbounded pages (AT-BOUND-9), quota before validation (AT-ADM-10), a sixth job state (AT-STATE-12), streaming partial results (AT-VIS-11), failing a job on one failed execution (AT-PART-9), releasing quota after provider spend (AT-CAN-11), charging quota per retry (AT-RETRY-11), a new job ID on retry (AT-RETRY-12), a provider-only identity key (AT-ID-11), a scalar `discovery_job_id` (AT-ID-12), name-similarity auto-merge (AT-DEDUP-13), single-signal auto-link (AT-DEDUP-14), deleting a merged Business (AT-MERGE-14), a provider-supplied `discovered_at` (AT-PROV-13), pre-check-without-constraint (AT-IDEM-12), a leaked provider cursor (AT-PAGE-13), retrying a validation failure (AT-FAIL-14), zero-defaulted unknown cost (AT-QUOTA-13), CRM reads on the ingestion path (AT-B2-13), and null-overwriting refresh (AT-NORM-15).

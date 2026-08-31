# B3 — Failure Scenarios

> **B3 status:** Target design only. Each scenario states the trigger, the deterministic outcome, the state mutation, and the invariant protected. Every outcome is derivable from the contracts in this package; none is new behavior introduced here.

## Index

DF1–DF8 admission · DF9–DF17 provider · DF18–DF23 execution and retry · DF24–DF28 cancellation · DF29–DF34 identity and merge · DF35–DF38 crash and delivery · DF39–DF40 boundary.

---

## Admission

**DF1 — empty keywords.** `keywords: []`, or every element blank after normalization.
→ `400 VALIDATION_ERROR`, `details.field = "keywords"`. **No job, no quota, no provider call.** Protects `B3-INV-11`.

**DF2 — empty locations.** Symmetric to DF1 → `400`, `details.field = "locations"`.

**DF3 — duplicate keyword.** `["restaurant", " Restaurant ", "RESTAURANT"]`.
→ collapsed to **one** keyword, first-wins display form. **No error.** `combination_count` is computed from the collapsed array, so duplicates cannot inflate cost. Protects `B3-INV-11`.

**DF4 — duplicate location.** Symmetric to DF3.

**DF5 — too many combinations.** 10 keywords × 8 locations = 80 > 50.
→ `400 VALIDATION_ERROR`, `details.reason = "combination_limit_exceeded"`, `details.combination_count = 80`, `details.max = 50`. Checked **after** duplicate collapse, so `["a","A"] × 30` is measured as 30. No job, no quota.

**DF6 — unauthorized workspace.** A caller without `discovery.run`, or a `JOB-*` from another workspace.
→ `403 PERMISSION_DENIED` for the permission failure; `404 ENTITY_NOT_FOUND` for the foreign ID — **identical to a non-existent ID**, so existence is never confirmed. Protects `B3-INV-1`.

**DF7 — quota rejected.** `discoveryRuns` exhausted.
→ `403 QUOTA_EXHAUSTED`. **No job row, no provider call.** The entitlement check precedes the reservation, so a plan-absent capability yields `403 ENTITLEMENT_LOCKED` instead — the two are distinguished, as the frozen frontend requires (`Discovery.tsx:198-202`).

**DF8 — duplicate create request.**
(a) Same `Idempotency-Key`, same body → the stored `202` is replayed. **One** job, **one** quota unit.
(b) Same key, different body → `409 IDEMPOTENCY_CONFLICT`.
(c) Different key, same fingerprint, earlier job still non-terminal → `409 CONFLICT`, `details.reason = "duplicate_discovery_request"`, `details.existing_job_ref`. **No quota, no provider call.**
(d) Different key, same fingerprint, earlier job terminal → **accepted**; a re-run is a legitimate refresh.
Protects `B3-INV-10`.

---

## Provider

**DF9 — provider timeout.** No response within the deadline.
→ `Timeout`, retryable under the frozen transient class (5 attempts). Other executions continue. On exhaustion the execution is dead-lettered and alerted; the job may still complete `partial`. **Scope: execution.**

**DF10 — provider 429 / rate limit.**
→ `RateLimited`, retryable (frozen: 6 attempts), honoring `Retry-After`. Scope: execution. Alert on exhaustion.

**DF11 — provider permanent rejection.** The provider rejects the query as invalid.
→ `InvalidRequest`, **non-retryable**. Execution ends `FAILED_PERMANENT`. Other combinations continue; job completes `partial` if any succeeded.

**DF12 — malformed provider payload.** One page is unparseable.
→ `MalformedResponse`, non-retryable **for that page**. `raw_payload_hash` is recorded and an alert raised. Pages already ingested by that execution are **kept**. Protects `B3-INV-3` — the payload never reaches the domain.

**DF13 — duplicate provider result.** The same place appears twice in one execution.
→ absorbed by `(query_execution_id, business_id)` unique. **One** `discovery_results` row. `found_count` counts the raw record; the absorbed duplicate increments `duplicate_count`, preserving `found − duplicate = deduplicated`.

**DF14 — duplicate provider page.** The same `page_index` ingested twice.
→ absorbed by `(execution_id, page_index)` unique. **No-op**: no counters advance, no Business is re-upserted, no provenance row added.

**DF15 — expired provider continuation.**
→ `ContinuationExpired`, retryable; the retry **restarts that query at page 1**. Re-ingested results are absorbed at layers 6–8. Pages already fetched **still count** against the page limit, so an expiry loop cannot multiply spend. Protects `B3-INV-11`.

**DF16 — provider unavailable.** Sustained 5xx or unreachable.
→ `Unavailable`, retryable (5). If **every** execution exhausts, the job ends `failed` with `failure_code = provider_unavailable`. Quota is **consumed** — provider calls were made.

**DF17 — provider auth failure or account quota exceeded.**
→ **Job-scope.** Every execution would fail identically, so the job terminates immediately with `provider_configuration_error` / `provider_quota_exceeded` and a **critical** operator alert. Quota is **released** on the auth branch — no successful provider work occurred. No provider string is exposed to the tenant.

---

## Execution and retry

**DF18 — partial query success.** Keyword A × location X succeeds; keyword B × location X fails permanently.
→ job `completed`, `completion_kind = partial`, `failed_query_count = 1`. **Results from A are visible.** Per-execution outcomes are in `query_executions`. **The successful combination's paid-for data is not discarded** — the central partial-success guarantee.

**DF19 — all queries fail.**
→ job `failed`, `failure_code = all_queries_failed`. Results are not visible. Any `discovery_results` rows committed before the failures are **retained**, not deleted, and a later retry benefits from the Businesses already upserted.

**DF20 — retry succeeds.** A `failed` job is retried and completes.
→ `attempt_no` increments; new executions are created; the job reaches `completed`. **No second quota unit** (`B3-INV-10`). Previous attempts' `discovery_results` rows are **retained**; re-observations create new rows against the new executions — a genuinely new observation at a new instant.

**DF21 — retry fails.**
→ the job returns to `failed`; `attempt_no` has advanced; both attempts' execution rows are retained. Still no second quota unit. Retry remains available.

**DF22 — retry of a completed job.**
→ `409 CONFLICT`, `details.reason = "job_not_retryable"`, `details.job_status = "completed"`. Matches the frozen frontend, which offers retry only for `["failed","cancelled"]`.

**DF23 — retry racing an in-flight execution.** A late completion commits between the client's read and its retry.
→ the `version` check fails → `409 STALE_VERSION`. **No double execution.** Race R-11.

---

## Cancellation

**DF24 — cancel before execution.** Job is `pending`.
→ `cancelled`; no execution was ever claimed; **quota released**. Job remains in the log (`data.js:480`).

**DF25 — cancel during execution.** Job is `processing`.
→ `cancelled` immediately; in-flight executions terminate `CANCELLED` at their next checkpoint. **A provider call already in flight completes and its page is ingested** — the cost was incurred, so discarding the evidence would be strictly worse. **Quota retained.**

**DF26 — completion racing cancellation.**
→ both take the `discovery_jobs` row lock; one wins. Completion first → cancel gets `409 job_already_terminal` and the job is `completed`. Cancel first → the completing worker records its execution outcome without transitioning the job. **A job never moves from `cancelled` to `completed`.** Race R-12.

**DF27 — cancel an already-terminal job.**
→ `409 CONFLICT`, `details.reason = "job_already_terminal"`. Nothing mutated. Idempotent under retry of the same call.

**DF28 — cancel by a non-owner without manager rank.**
→ `403 PERMISSION_DENIED`. Object scope per `B3_AUTHORIZATION_TENANCY.md` §3.1.

---

## Identity and merge

**DF29 — the same business discovered in two jobs.**
→ **one** `businesses` row, **two** `discovery_results` rows. The second job emits `BusinessRediscovered`, which B2 consumes as contract 9 and appends one `lead_provenance_additional_jobs` row (or discards it if no live Lead exists — B2 guard 3). Protects `B3-INV-4`.

**DF30 — the same business discovered through two providers.**
→ two identity rows. If **≥ 2 independent strong signals** agree (phone **and** domain, plus matching country) → **auto-link**: one Business, two `business_identities` rows. Otherwise → **two Businesses** plus a `business_match_candidates` row. Protects `B3-INV-6`.

**DF31 — ambiguous cross-provider match.** An incoming record matches two existing Businesses.
→ **no merge, no auto-link.** A new Business is created and one candidate row per contender is recorded, flagged `ambiguous`. An ambiguity alert fires above threshold. Guessing here would irreversibly commingle two companies.

**DF32 — name-similarity-only match.** Identical normalized names, same city, no phone, no website.
→ **classification `PROBABLE` at most; never auto-merged, never auto-linked**, at any threshold. Two Businesses, one candidate row. `B3-INV-6`. This is the scenario the invariant exists for.

**DF33 — shared phone across many businesses.** A directory's reception number appears on 40 records.
→ the phone is disqualified as a strong signal by the ">5 Businesses" guard. Records do not cascade into one Business. Without this guard a single shared line would collapse an entire category.

**DF34 — merge with existing Leads on both sides.**
→ B3 re-points identities and provenance to the survivor and tombstones the loser, then emits `BusinessMerged`. **B2 contract 7** re-points `leads.business_id`; where the partial unique index would break, B2 archives the losing Lead, emits `LeadArchived`, and writes the one permitted `crm_activities` row. **B3 does none of the CRM work.** No provenance row is lost (`B3-INV-7`).

---

## Crash and delivery

**DF35 — duplicate webhook.** The scraping provider delivers the same callback twice.
→ `WebhookReceipt` dedup on provider + event identity + payload hash → `200 WEBHOOK_DUPLICATE`. **No second ingestion.** Frozen B0 duplicate-webhook class: no-op, acknowledge `2xx`.

**DF36 — forged webhook.** Invalid or absent signature.
→ `401 WEBHOOK_INVALID_SIGNATURE`, **security alert**, **no receipt applied, no parsing, no domain effect**. Verification precedes parsing (`B3_SECURITY_PRIVACY_LEGAL.md` §5).

**DF37 — worker crash after the provider response, before persistence.**
→ no page row committed; the execution lease expires and it is re-claimed; the page is re-fetched. Provider cost is paid twice, **bounded by the page limit**. `(execution_id, page_index)` absorbs any partial effect.

**DF38 — worker crash after persistence, before acknowledgement.**
→ redelivery re-runs `IngestProviderPage`, which is a **no-op** at layers 6, 7, and 8. Counters advance once. **Acknowledgement is never load-bearing for correctness** — every ingestion effect is idempotent under its own constraint. Race R-18.

---

## Boundary

**DF39 — CRM conversion after rediscovery.** A Business is rediscovered by `JOB-B` at the moment a user converts it from `JOB-A`.
→ **no lock contention** — B2 takes no lock on the Lead for rediscovery, and B3 writes no CRM table. Both commit. The Lead is created with `source_job_ref = JOB-A`; `BusinessRediscovered(JOB-B)` is processed by B2 and appends one `lead_provenance_additional_jobs` row. If the signal arrives *before* the Lead exists, B2 guard 3 discards it — a correct, permanent no-op, and `JOB-B` will be re-observed on any later rediscovery. Race R-16.

**DF40 — cost or rate-limit safety bound reached.**
→ page limit → execution `PAGE_LIMIT_REACHED` (**success**); result limit → `RESULT_LIMIT_REACHED` (**success**); job completes `truncated` with results **visible**. Submission rate limit → `429` + `Retry-After` at admission, no job. Workspace budget ceiling → executions end `CANCELLED`, job completes `truncated`, budget alert. **Every bound produces a bounded, observable outcome — never an error for work that succeeded, and never an unbounded call.** `B3-INV-11`.

---

`FAILURE_SCENARIO_COUNT = 40`.

## Cross-cutting guarantees

Every scenario above satisfies all seven:

1. **No unbounded provider fan-out** — every path terminates within §7 of `B3_DISCOVERY_REQUEST_MODEL.md`.
2. **No duplicate quota consumption** — quota is bound to admission only.
3. **No silent data loss** — committed provenance is never deleted by failure, cancellation, or retry.
4. **No provider vocabulary crosses the boundary** — every tenant-visible outcome is a closed-set WazLink code.
5. **No cross-workspace disclosure** — a foreign ID is indistinguishable from an absent one.
6. **No CRM mutation by Discovery** — B3 has no CRM write path in any scenario.
7. **No unsafe merge** — every automatic identity action requires deterministic or doubly-strong evidence.

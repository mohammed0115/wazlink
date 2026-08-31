# B3 — Discovery Request, Normalization, and Execution Plan

> **B3 status:** Target design only. No implementation, no migration, no provider call.

## 1. The authoritative request

A Discovery request is the complete, immutable statement of search intent. It is captured once at admission and **never edited**; a change of intent is a new job.

| Field | Type | Required | Source of truth | Notes |
|---|---|---|---|---|
| `workspace_id` | UUID | yes | authorization context (B1) | never client-supplied; `B3-INV-1` |
| `actor_membership_ref` | `MEM-*` | yes | authorization context (B1) | the member who submitted; B1 owns the identity |
| `keywords` | array of text | yes, 1..10 | request body | normalized per §2 |
| `locations` | array of text | yes, 1..10 | request body | normalized per §2 |
| `provider_source` | text | yes | request body | a plain contract string, not an `EntityRef` (frozen registry §B) |
| `filters` | object | no (defaults apply) | request body | the closed set in §3 |
| `result_limit` | integer | no, default 2000 | request body | one of `{500, 1000, 2000}` — the frozen frontend allow-list (`Discovery.tsx:130-138`) |
| `requested_at` | timestamptz | yes | **server clock at admission** | never client-supplied |
| `request_fingerprint` | text | derived | §4 | deterministic hash of the normalized request |
| `idempotency_key` | text | yes for `POST` | `Idempotency-Key` header | frozen B0 standard |

**Nothing about a Business is part of the request.** A Discovery request names *what to look for*, never *what to create*.

## 2. Deterministic normalization

Normalization has one purpose and one non-purpose. It exists to make **identity and deduplication** deterministic. It does **not** exist to improve provider results, and it never changes what is sent to the provider.

> **The dispatch rule.** The **display form** — the user's original text after trimming and Unicode NFKC only — is what the provider adapter receives. The **normalized form** is used solely for duplicate collapse, `discovery_queries` uniqueness, and the request fingerprint. Over-normalizing the dispatched text would silently change search semantics in a language the design cannot reason about (`B3-D-A004`).

### 2.1 The normalization pipeline

Applied to each keyword and each location, in this exact order:

| Step | Operation | Applies to display form? | Applies to normalized form? |
|---|---|---|---|
| 1 | Reject if the raw value contains a Unicode control character or exceeds 120 characters | — | — |
| 2 | Unicode **NFKC** | **yes** | yes |
| 3 | Trim leading/trailing whitespace | **yes** | yes |
| 4 | Collapse internal whitespace runs to a single space | **yes** | yes |
| 5 | Reject if the result is empty | — | — |
| 6 | Unicode case-fold | no | yes |
| 7 | Remove Arabic tatweel `U+0640` | no | yes |
| 8 | Remove Arabic diacritics `U+064B`–`U+0652` and `U+0670` | no | yes |
| 9 | Unify alef forms `أ إ آ ٱ` → `ا` | no | yes |
| 10 | Map Arabic-Indic digits `٠`–`٩` and `۰`–`۹` to ASCII `0`–`9` | no | yes |

**Deliberately excluded from normalization**, because each is lossy enough to merge genuinely distinct terms:

- `ة` → `ه` (ta marbuta). Distinguishes real words.
- `ى` → `ي` (alef maqsura). Same.
- Definite-article `ال` stripping. Changes meaning.
- Stemming, lemmatization, transliteration, or synonym expansion of any kind.

### 2.2 Worked examples — the cases the brief names

| Input list | Display forms kept | Normalized keys | Result |
|---|---|---|---|
| `["restaurant", " Restaurant ", "RESTAURANT"]` | `["restaurant"]` | `["restaurant"]` | **one** keyword. First occurrence wins the display form |
| `["مطاعم", "مطاعم "]` | `["مطاعم"]` | `["مطاعم"]` | one keyword |
| `["مَطَاعِم", "مطاعم"]` | `["مَطَاعِم"]` | `["مطاعم"]` | one keyword; the diacritic form was first, so it is dispatched |
| `["أحمد", "احمد"]` | `["أحمد"]` | `["احمد"]` | one keyword — alef unified |
| `["مطاعم", "مطعم"]` | both | both | **two** keywords — no stemming |
| `["الرياض", "رياض"]` | both | both | **two** locations — no article stripping |
| `["الرياض", "  الرياض"]` | `["الرياض"]` | `["الرياض"]` | one location |
| `[""]` or `["   "]` | — | — | `400 VALIDATION_ERROR`, `details.field = "keywords[0]"` |
| `["a".repeat(200)]` | — | — | `400 VALIDATION_ERROR`, length bound |

Duplicate collapse is **order-preserving and first-wins**. This matters: `combination_count` and the execution order are both derived from the surviving order, so two requests differing only in duplicate placement must produce identical plans.

### 2.3 Unsupported geographic input

A location string is **not** validated against a gazetteer at admission, and this is a deliberate decision (`B3-D-A005`). WazLink has no authoritative geography of its own, and asking a provider to validate a location is itself a billable provider call — so admission-time validation would either invent a geography or spend money to reject a request.

Instead: an unresolvable location becomes a **per-query execution outcome**, not an admission failure. The execution terminates with `PROVIDER_NO_MATCH` — non-retryable, zero results, no cost beyond the one call — and the job proceeds with its remaining combinations under the partial-success rules of `B3_JOB_STATE_MACHINE.md` §6. A job whose *every* combination returns `PROVIDER_NO_MATCH` ends `completed` with `completion_kind = empty`, not `failed`: the search ran correctly and found nothing, which is a legitimate answer.

## 3. The closed filter set

Every filter value below is an allow-listed member of a closed set, traced to the frozen frontend. An unknown key or value is `400 VALIDATION_ERROR`; filters are never passed through opaquely to a provider.

| Filter | Values | Frontend source | Applied where |
|---|---|---|---|
| `min_rating` | `any` \| `4` \| `4.5` | `Discovery.tsx:97-104` | post-normalization, WazLink-side |
| `min_reviews` | `any` \| `50` \| `100` \| `500` | `Discovery.tsx:105-113` | post-normalization, WazLink-side |
| `website` | `any` \| `yes` \| `no` | `Discovery.tsx:114-121` | post-normalization, WazLink-side |
| `activity` | `any` \| `active` \| `open` | `Discovery.tsx:122-129` | provider-side **where the provider supports it**, else WazLink-side, else ignored with a recorded `filter_degraded` note |
| `has_phone` | boolean | `Discovery.tsx:80-85` | post-normalization |
| `has_email` | boolean | same | post-normalization |
| `has_whatsapp` | boolean | same | post-normalization |
| `has_instagram` | boolean | same | post-normalization |

**Where a filter is applied is part of the contract.** Filters marked "post-normalization, WazLink-side" are applied to the *normalized* Business after ingestion, so the same request yields the same result set regardless of which provider served it. Only `activity` may be pushed down, because "open now" cannot be evaluated from stored data — and when a provider cannot express it, the job records `filter_degraded` rather than silently dropping the constraint or silently returning fewer results.

**A filtered-out result still creates provenance.** A Business that was ingested and then failed a post-filter is recorded in `discovery_results` with `filtered = true` and is excluded from the visible result set and from `deduplicated_count`. Discarding it entirely would destroy the evidence that the job observed it, and would make a later identical job look like a first discovery.

## 4. Request fingerprint and idempotency

```
request_fingerprint = hash(
  workspace_id ‖ provider_source ‖
  sorted(keyword_norm[]) ‖ sorted(location_norm[]) ‖
  canonical(filters) ‖ result_limit
)
```

Sorting the normalized arrays makes the fingerprint **order-independent**, so `["a","b"]` and `["b","a"]` fingerprint identically. That is correct for *duplicate-request suppression* — the two describe the same search and should not both be paid for — while the **execution plan** still uses the submitted order, so the two jobs execute their combinations in different sequences. Identity and ordering are separate concerns and are separated here on purpose.

The fingerprint is **not** the idempotency key. The frozen B0 standard's key (workspace + principal + endpoint + body hash) governs exact retransmission. The fingerprint additionally powers **duplicate-request suppression** (`B3_QUOTA_COST_CONTROL.md` §6): a second job with the same fingerprint inside a configurable window returns `409 CONFLICT` with `details.reason = "duplicate_discovery_request"` and `details.existing_job_ref`, consuming no quota and calling no provider. The window is Class B configuration; the mechanism is Class A.

## 5. Query expansion

```
queries = [ (k, l) for k in keywords for l in locations ]
combination_count = |keywords| × |locations|
```

This is exactly the frozen frontend's cross product (`data.js:449`, `Discovery.tsx:42-45`), and `combination_count` must equal `|keywords| × |locations|` — the mock already asserts this identity (`data.js:488`), and B3 promotes it to a server invariant.

**Deterministic order.** Queries are ordered by `(keyword_index ASC, location_index ASC)` over the deduplicated, order-preserving arrays. `discovery_queries.sequence` stores this 0-based ordinal so the plan is reproducible after a restart.

**Logical query identity** is `(job_id, keyword_norm, location_norm)`, unique. Because the arrays were already deduplicated, this constraint can only fire on a programming error or a concurrent double-plan — which is exactly what it exists to stop.

## 6. Execution plan and concurrency

A query is a *plan*; an **execution** is one attempt at it. `discovery_query_executions` holds `(query_id, attempt_no)` unique, so a retry is a new execution row rather than a mutation of the old one — the failure history of a job survives its retry.

| Boundary | Value | Class | Rationale |
|---|---|---|---:|
| Concurrent executions per job | **4** | B | bounds burst cost per job while keeping a 50-combination job tractable |
| Concurrent running jobs per workspace | **2** | B | a workspace cannot serialize the platform or multiply its own provider spend |
| Provider pages per execution | **5** | B | requires provider validation (`B3-X-002`); the *existence* of a finite bound is Class A |
| Results ingested per job | `result_limit`, max **2000** | **A** | frozen frontend allow-list |
| Executions per job | `combination_count`, max **50** | **A** | §7 |

Executions of one job are independent: no execution reads another's state, so ordering is a scheduling detail and never a correctness one. This is what makes partial success representable at all.

**Continuation.** An execution advances page by page, persisting `provider_continuation` and `pages_fetched` after each ingestion commit. A worker that dies mid-execution resumes from the persisted continuation; the page-ingestion unique constraint absorbs any page that was fetched but not recorded (`B3_IDEMPOTENCY_CONCURRENCY.md` §2).

**Cancellation** is cooperative and checked at two points only: before an execution starts, and after each page commits. It is never checked mid-provider-call, because abandoning an in-flight call would incur the cost without recording the evidence (`B3_JOB_STATE_MACHINE.md` §7).

## 7. Hard safety bounds

These bounds exist to make combinatorial explosion **structurally impossible**, not merely unlikely. Every one is validated at admission, before any quota is reserved and before any provider is contacted.

| Bound | Limit | Violation |
|---|---:|---|
| `|keywords|` | 1..10 | `400 VALIDATION_ERROR` |
| `|locations|` | 1..10 | `400 VALIDATION_ERROR` |
| **`|keywords| × |locations|`** | **≤ 50** | `400 VALIDATION_ERROR`, `details.reason = "combination_limit_exceeded"`, `details.combination_count`, `details.max` |
| keyword/location length | ≤ 120 characters | `400 VALIDATION_ERROR` |
| `result_limit` | ∈ `{500, 1000, 2000}` | `400 VALIDATION_ERROR` |
| provider pages per execution | ≤ 5 | execution ends `PAGE_LIMIT_REACHED`, a **success** with partial coverage |
| results per job | ≤ `result_limit` | ingestion stops; job ends `completed` with `completion_kind = truncated` |
| discovery submissions | 10/hour/workspace | `429` with `Retry-After` (frozen `BACKEND_RATE_LIMIT_POLICY.md`) |

The composite ceiling is the one that matters: **50 combinations × 5 pages = 250 provider calls per job attempt, absolutely**, before any per-provider page-size effect. Multiplied by the frozen 10-submissions-per-hour rate limit, a single workspace's worst-case hourly provider fan-out is bounded and computable in advance — which is the property `B3-INV-11` asserts.

Note that `10 × 10 = 100` exceeds the combination cap of 50. This is intentional and not an oversight: the per-axis limits bound *input size* for validation and display, while the product bound governs *cost*. A request of 10 keywords × 10 locations is rejected with the combination-limit error, and the error names the count and the maximum so the user can reduce either axis.

## 8. Admission sequence

Ordered, and the order is part of the contract — each step is cheaper than the next, and no step incurs cost before a cheaper check could have rejected the request:

1. **Authentication** — session (ADR-009). Failure: `401 AUTH_REQUIRED`.
2. **Authorization** — `discovery.run` (B1). Failure: `403 PERMISSION_DENIED`.
3. **Rate limit** — 10/hour/workspace. Failure: `429` + `Retry-After`.
4. **Transport validation** — shape, types, closed sets, §7 bounds. Failure: `400 VALIDATION_ERROR`.
5. **Normalization and duplicate collapse** — §2. Re-checks §7 bounds against the *collapsed* arrays, so `["a","A"] × 10 locations` is measured as 10 combinations, not 20.
6. **Source resolution** — `provider_source` must be a known, dispatchable source. A `mock`-status source is rejected `422 VALIDATION_ERROR`, `details.reason = "source_not_dispatchable"`.
7. **Duplicate-request suppression** — §4. Failure: `409 CONFLICT`.
8. **Entitlement** — capability `discovery.basic`. Failure: `403 ENTITLEMENT_LOCKED`.
9. **Quota reservation** — one `discoveryRuns` unit, on a locked `usage_counters` row. Failure: `403 QUOTA_EXHAUSTED`.
10. **Persist** — `discovery_jobs` + `discovery_queries` + the quota reservation + the `IdempotencyRecord` + the `DiscoveryJobQueued` outbox row, **in one transaction**.
11. **Respond `202`** with the job resource; the dispatcher picks up the outbox row after commit.

Steps 8–10 are one transaction, so a crash cannot leave a reserved quota with no job or a job with no reservation. Steps 1–7 acquire nothing and can be re-run freely.

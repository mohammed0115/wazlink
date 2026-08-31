# B3 — Pagination

> **B3 status:** Target design only. No implementation.

## 1. Two paginations that must never touch

| | **Provider pagination** | **WazLink API pagination** |
|---|---|---|
| Purpose | walk a provider's result pages during execution | let a client page a completed job's results |
| Identity | provider continuation token | opaque WazLink cursor |
| Lifetime | one execution, minutes | as long as the job's result set is stable — permanently, since a completed job never changes |
| Owner | the provider adapter | the API layer |
| Stored | `discovery_query_executions.provider_continuation` | nowhere — the cursor is self-describing |
| Visible to a client | **never** (`B3-INV-12`) | always |
| On expiry | execution restarts that query from page 1 | cannot expire |

Conflating them is the defect this document exists to prevent. A provider token in a public cursor would leak provider vocabulary (`B3-INV-3`), tie a durable WazLink contract to a vendor's opaque format, expire under the client, and change meaning when the provider is swapped.

## 2. Provider continuation

```
execute(query, attempt):
  continuation ← null ; page ← 0
  loop:
    result ← adapter.search(request, continuation)   # provider call
    ingest(result.items, page_index = page)          # committed transactionally
    persist(execution.provider_continuation = result.continuation,
            execution.pages_fetched = page + 1)      # same transaction
    if result.continuation is null      → SUCCEEDED
    if page + 1 ≥ MAX_PAGES             → PAGE_LIMIT_REACHED
    if job.results ≥ result_limit       → RESULT_LIMIT_REACHED
    if cancellation_requested           → CANCELLED
    page ← page + 1
```

The continuation and the page's results commit **in the same transaction**, so a crash can never advance the cursor past unrecorded data or re-read data already recorded. Restart resumes from the persisted continuation, and the `(execution_id, page_index)` unique constraint absorbs any page that was fetched but not committed.

The continuation is **opaque to WazLink**: it is stored, echoed back to the adapter, and never parsed, validated, ordered, or compared.

### 2.1 Expired continuation

Providers expire continuation tokens. On `ContinuationExpired`:

1. The execution is **retryable** under the frozen B0 transient class.
2. The retry **restarts that query from page 1** — an expired token cannot be resumed, and there is no correct way to skip forward without one.
3. Re-ingested results are absorbed by layers 6–8 of `B3_IDEMPOTENCY_CONCURRENCY.md`: pages by `(execution_id, page_index)` within the same execution, Businesses by identity, and provenance by `(query_execution_id, business_id)`.
4. Pages already fetched **do count** against `MAX_PAGES` for the attempt, so an expiry loop cannot multiply provider spend.

Point 4 is the cost-safety clause: without it, a provider expiring tokens quickly would let one execution consume unbounded pages across repeated restarts.

### 2.2 Duplicate and replayed pages

| Case | Handling |
|---|---|
| the provider returns the same page twice | `(execution_id, page_index)` unique → no-op |
| a callback replays a page already ingested | `WebhookReceipt` dedup, then the same constraint |
| a retry re-fetches pages 1..N | pages absorbed; Businesses upserted; provenance absorbed |
| the provider returns overlapping results across adjacent pages | absorbed at the provenance layer — one `discovery_results` row per (execution, Business) regardless of which page carried it |

Counters advance only inside the ingestion transaction that actually inserts a row, so **`found_count` never double-counts an absorbed duplicate**.

## 3. WazLink API pagination

`GET /discovery/jobs/{id}/results` is cursor-paginated per ADR-011 and the frozen `DiscoveryResultList` + `PageInfo` contract.

**Order:** `(discovered_at DESC, result_public_id DESC)`.

Total and deterministic — `result_public_id` is unique, so no two rows tie, and every cursor position is unambiguous. `discovered_at` leads because "most recently found" is the meaningful reading order; the public ID breaks ties within an ingestion instant.

**Cursor:** an opaque base64 encoding of the order tuple `(discovered_at, result_public_id)` plus the `job_ref` it was issued for. It contains no provider token, no internal UUID, no offset, and no workspace identifier.

**Cross-job cursor reuse** is rejected: a cursor presented to a different job returns `400 VALIDATION_ERROR`, `details.reason = "cursor_job_mismatch"`. This prevents a cursor from being used as a probe across workspaces (`B3_AUTHORIZATION_TENANCY.md` §4).

**Filtering and sorting** are not offered on the results collection. The frozen API standard permits `filters`/`sort` only on catalog-marked collections, and every result filter the frontend applies is client-side over intelligence fields B4 will own (`DiscoveryResults.tsx:31-66`). Adding server-side result filtering would claim B4 semantics B3 does not own.

## 4. Why cursor stability is free here

A cursor is stable when the underlying set does not change under the reader. For discovery results that is guaranteed by two rules already established elsewhere:

1. Results are visible **only** for a `completed` job (`B3-INV-8`).
2. A `completed` job never re-enters execution — the only edge out of a terminal state is `RetryDiscoveryJob`, and `completed` is not retryable (`B3_JOB_STATE_MACHINE.md` §3).

So a visible result set is **immutable**, and no insertion, deletion, or reordering can occur while a client pages it. Cursor stability is a consequence of the visibility rule rather than a separate mechanism — which is a further argument for that rule.

The one thing that can change a visible row is a **merge** re-pointing `business_id` (`B3_BUSINESS_IDENTITY_MODEL.md` §6). This changes a row's `business_ref` but never its `discovered_at`, its `public_id`, or its position, so the cursor stays valid and no row is skipped or repeated. A client that re-reads sees the survivor's `BUS-*` — the correct answer.

## 5. Job list pagination

`GET /discovery/jobs` is cursor-paginated on `(created_at DESC, job_public_id DESC)`.

Unlike results, this collection **does** accept filters and sort keys, because the frozen frontend requires them (`DiscoveryJobs.tsx:17-40`). Both are strictly allow-listed, and the allow-list is the whole contract — no expression language, no arbitrary field, no ORM passthrough:

| `filters` key | Allowed values |
|---|---|
| `status` | `pending` \| `processing` \| `completed` \| `failed` \| `cancelled` |
| `provider_source` | a known source string |
| `date` | `all` \| `recent` \| `today` |
| `search` | free text, ≤ 120 chars, matched against job name and `JOB-*` |

| `sort` value | Order |
|---|---|
| `newest` (default) | `created_at DESC, job_public_id DESC` |
| `oldest` | `created_at ASC, job_public_id ASC` |
| `results` | `deduplicated_count DESC, created_at DESC, job_public_id DESC` |

Every sort is made total by the public-ID tiebreaker, so cursors remain unambiguous on all three.

`date=today` and `date=recent` are evaluated in the **workspace timezone** per ADR-011 ("use workspace timezone for period display and reporting boundaries"). The frozen frontend hardcodes a fixture reference date (`data.js:437-438`) — a Class C prototype artifact that B3 replaces with a real window: `today` is the workspace-local calendar day, `recent` the trailing 48 hours.

Because a job's status and counts change while it runs, this collection is **not** immutable, so a cursor may skip or repeat a job that changed position mid-page. That is inherent to any live collection, is the ordinary late-arrival case, and is acceptable for a job log — the `newest` default minimizes it, since new jobs enter at the head rather than in the middle of a page.

Requiring `filters` and `sort` on this collection is the one API-standard change B3 needs, registered as `B3-D-B003`.

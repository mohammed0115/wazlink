# B2 — Rediscovery Provenance Process

> **B2 status:** Deterministic writer specification (B2-FIX.1). This document resolves MAJOR-2: `lead_provenance_additional_jobs` has no deterministic writer. The feature is **KEPT** in Phase 1; its writer is defined here.

## 1. Feature decision

**DECISION: KEEP** `lead_provenance_additional_jobs` in Phase 1.

**Rationale.** Knowing that a Business was re-discovered by later Discovery Jobs is valuable for analytics ("Is this lead ever re-prioritized by new discovery?") and for compliance ("When was this Business last observed?"). Removing it would lose that signal. The feature can be made deterministic without inventing B3 internals; it is a CRM consumer of an existing Discovery concept.

## 2. Application-level process: `RecordLeadRediscoveryProvenance`

**Owner:** CRM Domain Application Service.

**Trigger:** A specific Discovery-domain event (defined below) is received by the CRM service through the B0 outbox consumer pattern (ADR-005).

**Purpose:** When a Business that is already the subject of an active Lead in a workspace is observed through a **different** Discovery Job, record the additional job in `lead_provenance_additional_jobs` without creating a new Lead or mutating `lead_provenance`.

### 2.1 Input event semantics

**Event:** A Discovery-domain event signifying "A Business was discovered by a Discovery Job, and this Business is already the subject of a conversion in the calling workspace."

**B2-specified semantic contract** (what CRM needs to know):

```
workspace_id: UUID
business_public_id: text (BUS-*)
discovery_job_public_id: text (JOB-*)
discovered_at: timestamptz
```

**CRM-side name.** Within B2 this contract is referred to as **`BusinessRediscoveredSignal`**. This is a *consumer-side alias for the semantic contract*, not a claim about the producer's event name, and it exists so that `B2_COMMAND_EVENT_CATALOG.md` §4, `B2_DOMAIN_OWNERSHIP.md` §4, and the acceptance tests can name one thing consistently.

**Exact producer event name and schema:** To be aligned during **B3 Discovery Design**. CRM specifies the above semantic contract; the Discovery team chooses whether this is:
- A `DiscoveryJobCompleted` event with a filter/side-effect for already-converted businesses, or
- A dedicated `BusinessRediscovered` event, or
- A different mechanism that guarantees the same semantics.

**What B3 must supply, and nothing more:** the four fields above, at-least-once, with `discovery_job_public_id` identifying the observing Job. B2 requires no ordering guarantee, no exactly-once guarantee, and no event ID — the unique constraint on `(lead_id, discovery_job_public_id)` supplies idempotency without one (§2.2.1). This is why the pending producer name leaves **no CRM behavior undetermined**.

**This is acceptable precisely because CRM's own behavior is already deterministic:** CRM does not invent job IDs, does not query Discovery speculatively, and does not assume a particular event name or schema until B3 publishes it. CRM simply declares: "We need to know when a Business we already converted is observed by a different job, with these identifiers and timestamp."

### 2.2 Guard conditions

`RecordLeadRediscoveryProvenance` evaluates the following guards **in the stated order**, and stops at the first that fails. The order is part of the contract: it resolves identity before it compares jobs, so a cross-workspace event can never be answered with a Lead from the caller's own workspace.

1. **Workspace exists and is active.** A message from another workspace is silently discarded (CRM-INV-1, tenant isolation). `workspace_id` is never NULL.

2. **Business exists in this workspace.** `business_public_id` resolves to a row in `businesses WHERE workspace_id = :w`. If not, the event is **discarded** (out of scope; perhaps it is a deletion event or cross-workspace leakage from Discovery). No error is raised.

3. **Live Lead exists for this Business in this workspace.** `SELECT … WHERE workspace_id = :w AND business_id = :b AND archived_at IS NULL`. Exactly one is expected (enforced by partial unique constraint). If none, the event is **discarded** (perhaps the Lead was archived; provenance is not updated retroactively). If found, proceed to step 4.

4. **Discovery Job is not the Lead's deciding job.** `lead.source_job_id ≠ discovery_job_public_id`. If they match, the event is **idempotent**; this is a redelivery or the same job reporting on itself. It is a no-op (step 6, below).

5. **No duplicate additional-job row.** `SELECT … FROM lead_provenance_additional_jobs WHERE lead_id = :L AND discovery_job_public_id = :J`. If found, it is a redelivery; no-op (step 6). If not found, proceed to insert.

6. **Insert** (idempotent if found in step 5):

```sql
INSERT INTO lead_provenance_additional_jobs (
  lead_id,
  discovery_job_public_id,
  observed_at
) VALUES (
  :lead_id,
  :discovery_job_public_id,
  :discovered_at
)
ON CONFLICT (lead_id, discovery_job_public_id) DO NOTHING
```

**Constraint:** Unique on `(lead_id, discovery_job_public_id)`. The same Lead can be re-discovered by many different jobs; each (Lead, Job) pair appears at most once.

### 2.2.1 Transaction boundary

The whole process is **one PostgreSQL transaction per consumed event**, opened after the outbox consumer deserializes the payload and closed before it acknowledges:

```
BEGIN
  resolve workspace        (guard 1)
  resolve business         (guard 2)
  SELECT the live Lead     (guard 3)   -- plain read; no FOR UPDATE is taken
  compare deciding job     (guard 4)
  INSERT … ON CONFLICT DO NOTHING      (guards 5–6 collapse into this statement)
COMMIT
```

Three properties follow, and each is load-bearing:

- **No lock is taken on the Lead.** The Lead row is read, never written, so a rediscovery can never block or be blocked by a user editing that Lead, and it can never cause an `If-Match` failure for a human.
- **Guards 5 and 6 are one statement, not two.** The pre-check `SELECT` in guard 5 is an optimization, never the correctness mechanism; the unique constraint in the `INSERT` is. A pre-check that passes and then loses a race still commits correctly, because `ON CONFLICT DO NOTHING` absorbs it. This is why the process needs no advisory lock and no serializable isolation.
- **Acknowledgement follows commit.** The consumer acknowledges the message only after `COMMIT`. A crash between `COMMIT` and acknowledgement causes redelivery, which is harmless — see §2.3.

**Read Committed is sufficient.** No guard reads a value it later writes, and the only write is guarded by a unique index, so there is no lost-update, no write-skew, and no phantom to defend against.

### 2.2.2 **NO TIMELINE ACTIVITY ROW**

`RecordLeadRediscoveryProvenance` writes **NO TIMELINE ACTIVITY ROW**.

**Reason.** A rediscovery is Discovery observing the world again; it is not someone working the Lead. Writing a timeline entry would place a machine event with no actor into a record whose entire purpose is "what did people do to this Lead", and — because rediscovery runs on a crawl schedule rather than on human action — would let a large re-crawl flood every Lead's timeline with entries nobody performed. The signal is preserved where it belongs: in `lead_provenance_additional_jobs`, surfaced by the `Lead360` provenance section (§4).

This is the process-level counterpart of the command-level list in `B2_CRM_ACTIVITY_VOCABULARY.md` §6.

### 2.3 Concurrency and idempotency

| Scenario | Handling |
|---|---|
| **Same event delivered twice** | Constraint `ON CONFLICT … DO NOTHING` makes it idempotent. Second delivery is a no-op. |
| **Two concurrent deliveries of the same rediscovery event (same workspace, business, job)** | Both reach the insert. One succeeds; the other hits the unique constraint and is silently absorbed. No errors, no duplicates. |
| **Concurrent rediscovery by different jobs** | Each (lead_id, job_id) pair is unique, so two different jobs are separate rows. Concurrency is handled by the constraint. |
| **Rediscovery event arrives out-of-order (Job-B before Job-A)** | Each is stored independently by (job_id). Order of arrival does not affect the final state; the set of additional jobs is correct regardless. |
| **Event replay after full system recovery** | Same event ID replayed produces the same insert attempt. Unique constraint absorbs duplicates. State is consistent. |

**Authority:** PostgreSQL constraint is authoritative. No Redis counter, no distributed lock, no Celery side-effect.

**Quota:** No quota is consumed. Additional jobs are records of discovery, not additional Leads.

### 2.4 Side effects and events

| Question | Answer | Rationale |
|---|---|---|
| **Is a CRM event emitted?** | **No.** | The additional job is an internal record of Discovery's activity, not a CRM state change. The Lead itself does not change. |
| **Is `last_activity_at` updated?** | **No.** | Rediscovery is not business activity on the Lead (like a Task, Note, or Contact). It is a data-quality signal — the Lead was already alive; discovering it again confirms relevance, not a new activity. |
| **Is the Lead's `version` bumped?** | **No.** | No mutation occurs to the Lead row itself. |
| **Is an audit row written?** | **No, directly.** But see below. | CRM does not audit inbound events from other domains. Discovery owns its own audit of the Job. CRM may log the processing through application tracing, separate from `audit_logs` (which record user commands). |
| **What if the Lead is archived?** | **The row is discarded.** | An archived Lead has left the partial unique index. It is not "currently converted", so observing the Business again does not re-populate `lead_provenance_additional_jobs` for the archived row. If the Business is later re-converted, a new Lead is created with a fresh `lead_provenance` snapshot, and subsequent rediscoveries feed that new Lead. Archived provenance remains read-only. |
| **What if the Business is merged away?** | **Deterministic, by guard 2 alone — no special case is needed.** | Guard 2 resolves `business_public_id` to a row in `businesses`, and Discovery's merge is what decides which row that is. Three cases, all already covered: (a) the event names the **surviving** `BUS-A` → guard 2 resolves it, guard 3 finds the surviving Lead, the job is appended there; (b) the event names the **merged-away** `BUS-B` and Discovery has retired that row → guard 2 finds nothing and the event is **discarded**; (c) the event names `BUS-B` and Discovery still resolves it as an alias of `BUS-A` → guard 2 lands on `BUS-A` and case (a) applies. CRM never chases the merge itself and never rewrites history: `lead_provenance.business_public_id` keeps naming what the user actually converted (`B2_LEAD_PROVENANCE_DUPLICATION.md` §7), while additional jobs accumulate on whichever Lead is live now. A rediscovery arriving *during* the merge transaction serializes behind it, because the merge holds the Lead row and guard 3 reads it after commit. |
| **What if the event comes from another workspace?** | **Discarded at guard 1, then again at guard 2.** | Two independent barriers. Guard 1 rejects a `workspace_id` that is not an active workspace; guard 2 resolves `business_public_id` **within `workspace_id`**, so a valid-looking `BUS-*` belonging to a different tenant resolves to nothing. There is no code path in which a Lead from workspace X receives an additional job observed in workspace Y, and no error is returned that would confirm the foreign Business exists (CRM-INV-1). |

### 2.5 Validation of source data

**`workspace_id`:** Required; must resolve to an active workspace. If not found, event is discarded.

**`business_public_id`:** Required; must have format `BUS-*`. Resolution to `business.id` is performed via `workspace_id + public_id`. If business does not exist or is in a different workspace, event is discarded.

**`discovery_job_public_id`:** Required; must have format `JOB-*`. **No validation that the job exists.** (It may be archived or purged by Discovery retention policy.) CRM stores this as a **historical string**, the same way `lead_provenance` does. If later the job is not queryable, `Lead360` renders it as "historical" with `resolvable: false`.

**`discovered_at`:** Required; must be a valid, parseable timestamptz.

**Malformed payloads are poison, not backlog.** A structurally invalid payload — a missing or unparseable `discovered_at`, a `business_public_id` that is not `BUS-*`, a `discovery_job_public_id` that is not `JOB-*`, a missing `workspace_id` — will fail identically on every redelivery, so retrying it forever is a defect, not resilience. The policy is **fail fast, then quarantine**: the event is retried at most the B0 outbox consumer's standard bounded attempt count, and on final failure it is moved to the outbox dead-letter store and an operator alert is raised. It is never acknowledged as processed and never partially applied. This is distinct from the **discard** outcome of guards 1–4, which is a correct, permanent, silent no-op for a well-formed event that simply does not apply.

**Future-dated `discovered_at`.** This consumer applies the **same** admission rule, the **same** tolerance, and the **same** reference clock as every other B2 consumer. It defines no clock of its own:

> `discovered_at` is eligible on processing attempt *N* ⇔ `discovered_at ≤ processing_reference_time_N + CLOCK_SKEW_TOLERANCE`, where `processing_reference_time_N` is **CRM's trusted server clock sampled afresh at the start of attempt *N*** — the one canonical clock defined by `B2_TIMELINE_IDENTITY_MODEL.md` §5.2.1, with the six substitutes that section forbids forbidden here identically.

In particular the reference is **never** the ingestion instant, an immutable `ingested_at`/`recorded_at` column, the first-receipt stamp, the previous attempt's reference time, `discovered_at` itself, any source or client clock. A fresh sample is taken on **initial processing, on every automatic retry, and on every replay**. This is the consumer evaluation point of `B2_TIMELINE_IDENTITY_MODEL.md` §5.2, which is where every persisted write is gated; the read-path eligibility filter of `B2_TIMELINE_IDENTITY_MODEL.md` §5.3 governs the timeline only and has no bearing here.

**When ineligible on attempt *N*:** no provenance row is written, the delivery is classified `RETRYABLE_CLOCK_SKEW`, and it is **not** acknowledged as successfully processed, so bounded retry eligibility is preserved (`B2_TIMELINE_IDENTITY_MODEL.md` §5.5.1–§5.5.3). `discovered_at` is never clamped, rewritten, or substituted.

**Why recovery is reachable by construction.** The event is immutable across attempts — same logical event identity, same `discovered_at`, same `workspace_id`, same `business_public_id` and `discovery_job_public_id` — and **only the trusted clock advances**. The comparison is therefore strictly easier to satisfy on every later attempt, so the first attempt taken after CRM's clock reaches `discovered_at − CLOCK_SKEW_TOLERANCE` evaluates eligible and proceeds to the ordinary guarded insert of **this document's** §2.2. **No source redelivery, no new event, no new logical event identity, no mutation of `discovered_at`, and no operator action is required** for that to happen. Had the comparison been frozen against a first-receipt instant, every attempt would fail identically, the budget would always exhaust, and the provenance row would be permanently lost — which is exactly why `B2_TIMELINE_IDENTITY_MODEL.md` §5.2.1 forbids that reading.

**On exhaustion:** the delivery is `DEAD_LETTERED` with `reason = CLOCK_SKEW`, an operational alert, and the original logical event identity, `workspace_id`, source references and an unclamped `discovered_at` preserved (`B2_TIMELINE_IDENTITY_MODEL.md` §5.5.4). Replay (`B2_TIMELINE_IDENTITY_MODEL.md` §5.5.5) samples its **own** fresh `processing_reference_time`, re-enters this same rule rather than overriding it — a replay whose sampled clock still leaves the event out of tolerance writes no row and returns the delivery to a retryable-or-dead-lettered state — and on success performs the normal insert exactly once. Retry and replay are **idempotent** throughout: the unique `(lead_id, discovery_job_public_id)` constraint of **this document's** §2.3 absorbs any duplicate, so N attempts of which one succeeds are indistinguishable from one attempt that succeeds. Recovery is *caused* by the consumer refusing to acknowledge, not assumed from source redelivery, and **no CRM quarantine store is introduced** — the dead-letter surface is B12's (`B2_TIMELINE_IDENTITY_MODEL.md` §5.5.6).

**No permanent provenance under-count may arise solely from a future-skewed first delivery.** Because this process moves neither `last_activity_at` nor any timeline ordering key, a skewed timestamp here cannot poison an ordering column — but storing an observation dated in the future would still corrupt the analytics in **this document's** §5, and silently losing one would under-count them, so the rule is applied uniformly. Verified by `AT-DUP-5J`.

## 3. Stored identities in `lead_provenance_additional_jobs`

| Column | Type | Immutability | Rationale |
|---|---|---|---|
| `id` | UUIDv7 PK | — | Standard surrogate key |
| `lead_id` | UUID FK → `leads.id` | immutable | Identifies the Lead that was re-discovered. `ON DELETE CASCADE` so archiving or deleting a Lead (if ever allowed) cleans up additional jobs. |
| `discovery_job_public_id` | text | immutable | The `JOB-*` that re-discovered the Business. Stored as text so archiving/purging the Job doesn't orphan this row. |
| `observed_at` | timestamptz | immutable | The timestamp from the Discovery event. Immutable because it reflects when the discovery happened, not when CRM processed it. |
| `recorded_at` | timestamptz (auto) | immutable | When CRM wrote the row (for audit). Allows "CRM knows about this rediscovery since…" queries. |
| `workspace_id` | UUID | immutable | Denormalized for efficient workspace-scoped queries. **Invariant:** must match `lead.workspace_id`. Not enforced by FK (to avoid a composite FK), but verified by nightly integrity assertion. |

**Constraints:**

- Unique `(lead_id, discovery_job_public_id)`: The same Lead cannot be re-discovered by the same Job twice. Duplicate attempts are silently absorbed by `ON CONFLICT DO NOTHING`.
- Index on `(workspace_id, lead_id)` for queries like "all additional jobs for a Lead" (used by `Lead360`).
- Index on `(workspace_id, observed_at DESC)` for analytics queries like "Businesses re-discovered in the last 30 days".

## 4. Read model and Lead360 integration

**`GET /leads/{id}/360` provenance section:**

The Lead360 response includes:

```json
{
  "provenance": {
    "lead_converted_at": "2025-01-15T09:30:00Z",
    "conversion_source_job_ref": "JOB-1001",
    "conversion_business_ref": "BUS-2000",
    "conversion_business_name_at_time": "عيادات القاهرة",
    "intelligence_score_at_conversion": 85,
    "intelligence_tier_at_conversion": "high",
    "additional_jobs": [
      {
        "discovery_job_ref": "JOB-1004",
        "observed_at": "2025-02-03T14:22:00Z",
        "resolvable": true  // Job metadata is available
      },
      {
        "discovery_job_ref": "JOB-1099",
        "observed_at": "2025-03-10T11:15:00Z",
        "resolvable": false // Job was archived; metadata unavailable
      }
    ]
  }
}
```

**Semantics:** "This Lead was converted from JOB-1001 on Jan 15; the same Business was later observed via JOB-1004 (Feb 3) and JOB-1099 (Mar 10)." `JOB-1001` — the deciding job — never appears in `additional_jobs`, because guard 4 excludes it.

**Access control:** The provenance section is visible only to callers with `lead.view`. No separate `provenance.view` permission. The `additional_jobs` section carries only the Job identity and timestamp, no sensitive Discovery data (score, analysis, signals).

## 5. Analytics and retention

**Analytics queries:**

- "Leads that were re-discovered more than once": `COUNT(*) WHERE additional_jobs > 0 GROUP BY …`
- "Average time between conversion and first rediscovery": `AVG(observed_at - converted_at) WHERE additional_jobs EXISTS`
- "Businesses re-discovered in the last 30 days": Join on `(workspace_id, observed_at)`.
- "Correlation between re-discovery frequency and Lead conversion rate": Cross-join with events.

**Retention:** Follows the Lead's own retention policy. When a Lead is archived or (if ever implemented) deleted, `lead_provenance_additional_jobs` is cleaned up. Historical rows are retained as long as the Lead is retained, matching the frozen retention doctrine.

## 6. Boundary with Discovery and B3 alignment

### 6.1 B2 contract (what CRM provides)

CRM declares: "We need to know when a Business that is the subject of an active Lead is discovered by a different Job, with these fields: workspace, business, job, timestamp."

### 6.2 B3 contract (what Discovery provides)

**To be determined in B3 Discovery Design.** Discovery team specifies:
- The exact event type, schema, and routing key.
- Whether this is derived from an existing `DiscoveryJobCompleted` event or a new `BusinessRediscovered` event.
- Whether the event carries additional metadata (e.g., new score, new category) or just the identifiers.

**CRM assumption:** Discovery publishes to the B0 outbox under a topic like `discovery.business_rediscovered` or filters an existing topic. CRM subscribes via Celery consumer and deserializes the JSON payload into the CRM semantic contract above.

### 6.3 Pre-B3 implementation readiness

**CRM is already deterministic.** The logic in §2–5 is complete and does not depend on B3 internals. What **is** pending is:

1. The exact Discovery event name and schema (to be published in B3).
2. The Celery consumer routing and error-handling (to be configured during integration).
3. The data migration (if existing frozen rediscovery data exists to populate the table).

**What "pending" does and does not mean.** The *feature* is KEPT and fully specified; it is the *subscription* that waits on B3. Until the producer contract is published:
- `lead_provenance_additional_jobs` is created and read normally; it simply has no inbound producer yet, so it holds no rows outside tests.
- `Lead360.provenance.additional_jobs` returns an empty array — a correct answer, not a degraded section.
- Analytics queries in §5 are valid and return zero rows.

On B3 publication the consumer is bound to the producer's topic. **No CRM behavior specified in §2–§5 changes**, because none of it depends on the producer's name or schema — only on the four semantic fields in §2.1. That is the precise sense in which `PROVENANCE_WRITER_DEFINED = PASS` despite an open B3 item: an implementation agent building this today has nothing left to invent.

## 7. Closure statement

**PROVENANCE_WRITER_DEFINED = PASS.**

- CRM behavior is deterministic and requires no B3 internals to be guessed.
- The trigger is a well-defined event semantic.
- Concurrency, idempotency, and audit are specified.
- The B3 Discovery team has a clear contract to implement.
- The feature is ready to be turned on the moment B3's event is published.

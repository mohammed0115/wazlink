# B3 — Authorization and Tenancy

> **B3 status:** Target design only. **B1 is reused verbatim.** B3 adds no role, no permission code, no matrix cell, and no pipeline step.

## 1. What B1 already provides

Frozen `B1_AUTHORIZATION_RBAC.md` already registers the Discovery permissions:

| Permission | owner | admin | manager | sales | member | viewer | Condition |
|---|:--:|:--:|:--:|:--:|:--:|:--:|---|
| `discovery.run` | A | A | A | A | C | · | member: entitlement + quota |
| `discovery.view` | A | A | A | A | A | C | viewer: read-only workspace scope |
| `discovery.export` | A | A | A | C | C | · | export permission + quota |

`A` = allowed · `C` = conditional · `·` = denied.

**B3 needs no new permission code.** Every B3 operation maps onto one of these three, and no existing cell changes. This is a deliberate outcome, not a coincidence: an operation that would have needed a fourth code was a sign that the operation was wrong for the domain.

## 2. Tenancy

> **`B3-INV-1`: every tenant-owned B3 row carries a non-null `workspace_id`, and every query is workspace-scoped.**

| Table | `workspace_id` | Justification |
|---|:--:|---|
| `discovery_jobs` | **required** | tenant-owned |
| `discovery_queries` | **required** | denormalized from the job for scoped queries |
| `discovery_query_executions` | **required** | same |
| `provider_page_ingestions` | **required** | carries provider evidence for one tenant's job |
| `discovery_results` | **required** | tenant-owned provenance |
| `businesses` | **required** | tenant-owned |
| `business_identities` | **required** | part of the workspace-scoped uniqueness key |
| `business_match_candidates` | **required** | tenant-owned |
| `business_merges` | **required** | tenant-owned audit |
| `discovery_sources` | **absent — documented exception** | a **global bounded catalogue** of provider source types (`data.js:145-149`), containing no tenant data. It is read by every workspace and written by no tenant. Frozen B0 treats `plans` the same way ("Global bounded catalog"). |

`discovery_sources` is the only B3 table without `workspace_id`, and the exception is documented here as `B3-INV-1` requires.

**Invariant:** `discovery_results.workspace_id`, `job.workspace_id`, and `business.workspace_id` must be equal. A result can never join a job in one workspace to a Business in another. Not enforced by a composite FK (avoiding one, per frozen B0's data-model style), but asserted by a nightly integrity check and by acceptance test `AT-TEN-4`.

## 3. Per-operation authorization

| Operation | Permission | Additional condition |
|---|---|---|
| `POST /discovery/jobs` | `discovery.run` | `discovery.basic` capability + `discoveryRuns` quota |
| `GET /discovery/jobs` | `discovery.view` | workspace scope |
| `GET /discovery/jobs/{id}` | `discovery.view` | workspace scope |
| `GET /discovery/jobs/{id}/results` | `discovery.view` | workspace scope + job `completed` |
| `POST /discovery/jobs/{id}/retry` | `discovery.run` | workspace scope; job `failed`/`cancelled`; **no** new quota unit |
| `POST /discovery/jobs/{id}/cancel` | `discovery.run` | workspace scope; job non-terminal; §3.1 |
| `GET /discovery/sources` | `discovery.view` | none — a global catalogue |
| `GET /businesses/{id}` | `discovery.view` | workspace scope |
| result export | `discovery.export` | frozen B1; a separate concern from acquisition |

**Rationale for binding retry and cancel to `discovery.run`.** Both are *mutations of execution*, so `discovery.view` would be too weak — a viewer could cancel a colleague's running job. A fourth permission code would be too strong, requiring a B1 amendment for an action already covered by "may cause or stop discovery work". `discovery.run` is exactly right, and B1's existing conditional for members (entitlement + quota) degrades correctly: retry consumes no quota, so a member whose quota is exhausted may still retry a failed job — which is the desirable behaviour, since the failure was not their doing.

### 3.1 Cancel object scope

Cancel additionally requires **one** of:

- the actor created the job (`discovery_jobs.actor_membership_ref` equals the caller's `MEM-*`), **or**
- the actor's role is `manager` or above.

This mirrors B1's existing object-scope pattern (`lead.assign`: "sales: own assignments only") and needs no new code. A `sales` member can cancel their own job; only a manager can cancel someone else's.

## 4. Cross-workspace defence

> **A guessed public ID must never reveal that it exists.**

| Attack | Defence |
|---|---|
| `GET /discovery/jobs/JOB-<other tenant>` | resolved as `WHERE workspace_id = :active AND public_id = :id` → **`404 ENTITY_NOT_FOUND`**, identical to a non-existent ID |
| `GET /businesses/BUS-<other tenant>` | same |
| `GET /discovery/jobs/{id}/results` on a foreign job | `404` — the scope check precedes the `completed` check, so a foreign job never returns the `409 results_not_available` that would confirm it exists |
| result cursor from another workspace | cursor is validated against the addressed job, which is already workspace-scoped → `400 cursor_job_mismatch` |
| `provider_external_id` probing | identity lookup is keyed by `(workspace_id, provider, provider_external_id)`; a foreign identity is simply not found and a new Business is created — no signal is returned either way |
| `source_job_ref` in a conversion request | B2's conversion validates that the job discovered the Business **within the workspace** (`B3_BUSINESS_IDENTITY_MODEL.md` §8) |
| timing side channel | scope resolution runs before any state-dependent branch, so a foreign ID takes the same path as an absent one |

**Ordering is the mechanism.** In every route the sequence is: authenticate → authorize → **resolve within workspace scope** → then any state check. Reversing the last two would let a state-specific error code confirm that a foreign resource exists.

## 5. Audit

Frozen B0 assigns audit to the `audit_logs` table with `AUD-*` identities. B3 records **actor-initiated commands only**:

| Action | Audited | Why |
|---|:--:|---|
| `discovery_job_created` | **yes** | a human spent quota and will spend provider budget |
| `discovery_job_retried` | **yes** | a human caused new provider spend |
| `discovery_job_cancelled` | **yes** | a human stopped work; includes the object-scope basis |
| `business_merged` | **yes** | a human or system irreversibly joined two records |
| `discovery_results_exported` | **yes** | data left the system |
| query execution, page ingestion, business upsert, provenance append | **no** | machine execution of an already-audited command. Traced and metered (`B3_OBSERVABILITY.md`), not audited |

This matches B2's rule that audit records *user commands* while machine processing is observed through tracing. Auditing every page ingestion would drown the audit log — 250 rows per job — and would say nothing the trace does not already say.

Audit entries carry actor, workspace, action, target public ID, request ID, and timestamp. They carry **no** provider payload, no credential, and no contact PII.

## 6. What B3 does not change in B1

- The six roles, and every existing matrix cell.
- All 51 existing permission codes (50 from B1 plus B2's `lead.archive`).
- The authorization pipeline — no step is added, removed, or reordered.
- Session authentication (ADR-009) and CSRF for cookie-authenticated unsafe requests.
- Membership, invitation, and actor identity resolution.

`B3_CONTROLLED_AMENDMENTS.md` therefore contains **no B1 item**.

# B3 — Business Identity, Cross-Provider Deduplication, and Merge

> **B3 status:** Target design only. No implementation, no migration.

This is the load-bearing document of B3. Every downstream guarantee — no duplicate CRM conversion, complete provenance, safe cross-provider linking, a stable B4 handoff — rests on the identity model here.

## 1. The four concepts, kept apart

They are routinely conflated, and conflating any two of them produces a specific, nameable defect.

| | Concept | Lives where | Lifetime | Identity | If merged with its neighbour |
|---|---|---|---|---|---|
| **A** | **Provider result** — one record as a provider returned it | in memory during ingestion; a hash (and optionally a bounded snapshot) in `provider_page_ingestions` | the request | none of WazLink's; only the provider's own external ID | provider schema leaks into the domain — B0's explicit prohibition |
| **B** | **Business** — WazLink's normalized record of a real-world organization | `businesses` (`BUS-*`) | outlives every job; permanent within the workspace | `BUS-*`, resolved through `business_identities` | one business per observation → duplicate Leads, broken CRM uniqueness |
| **C** | **Discovery result** — the fact that one query execution observed one Business at one instant | `discovery_results` (`RES-*`) | permanent, append-only | `RES-*`, unique on `(query_execution_id, business_id)` | provenance is overwritten; "found by two jobs" becomes unanswerable |
| **D** | **Lead** — a human decision to pursue | `leads` (`LEAD-*`) — **B2, frozen** | CRM lifecycle | `LEAD-*`, unique per `(workspace_id, business_id)` while active | B0's "no Lead auto-create" is violated |

**A is evidence. B is identity. C is provenance. D is intent.** B3 owns A, B, and C, and never writes D.

## 2. The identity problem

A provider's external ID is authoritative **only within that provider**. It is not globally unique, not stable across providers, and not guaranteed collision-free against another provider's opaque ID space. Treating `provider_external_id` alone as the Business key would mean:

- the same real business found by Google and by the scraper becomes two Businesses, so a user can convert both and hold two Leads for one company — defeating B2's `(workspace_id, business_id)` active-Lead uniqueness at the level *above* it, where B2 cannot see the problem; and
- two providers that happen to mint the same opaque string collapse two different businesses into one — silently merging unrelated companies' provenance and contact data.

Frozen `BACKEND_DATA_MODEL.md` names `business_identities` as a table precisely because B0 anticipated this. B3 gives it its semantics.

## 3. The model

```
                     business_identities                      discovery_results
                 (workspace, provider, ext_id)              (execution × business)
                             │  unique                              │  unique
                             ▼                                      ▼
   provider result ──► resolve identity ──► businesses (BUS-*) ◄── append provenance
                             │                     ▲
                             └── not found ────────┘  create, or link to an existing
                                                       Business via a strong match
```

**One real-world business in one workspace is one `businesses` row, reachable through one or more `business_identities` rows, and referenced by any number of `discovery_results` rows.**

### 3.1 The four cases the brief asks about

| The same real business is discovered… | `businesses` rows | `business_identities` rows | `discovery_results` rows |
|---|:--:|:--:|:--:|
| by two **keywords** in one job | 1 | 1 | **2** (one per query execution) |
| in two **locations** in one job | 1 | 1 | **2** |
| by two **jobs** | 1 | 1 | **2** |
| through two **providers** | 1 *(if the match is deterministic or strong; otherwise 2 — see §5)* | **2** | 2 |

Provenance count and Business count are independent (`B3-INV-4`). This is what lets the system answer both "how many distinct companies did we find?" and "how did we come to know about this one?" without either question corrupting the other.

### 3.2 Why not a single `discoveryJobId` column

The frozen frontend stores exactly one `discoveryJobId` per business (`data.js:44`) and asserts it (`data.js:491`). B3 **does not** adopt this. With a scalar, a rediscovery has only two options — overwrite the column, destroying the first discovery's provenance, or ignore the rediscovery, destroying the second's. B2's frozen `lead_provenance_additional_jobs` table exists specifically because the second discovery must be preserved, so a scalar on the Discovery side would make B2's contract unimplementable. The divergence from the prototype is required, not optional.

### 3.3 Workspace scoping

Identity resolution is **always** scoped to `workspace_id`. Two workspaces that discover the same real business hold two independent `businesses` rows with independent `BUS-*` values, independent provenance, and no shared row. Businesses are workspace-owned data, and cross-tenant identity sharing would leak the existence of one tenant's data to another (`B3-INV-1`).

## 4. Identity resolution at ingestion

For each normalized provider result, inside the ingestion transaction:

1. **Deterministic lookup** — `SELECT business_id FROM business_identities WHERE workspace_id = :w AND provider = :p AND provider_external_id = :x`.
2. **Hit** → that Business. Refresh its normalized fields under the rules of `B3_NORMALIZATION_DATA_QUALITY.md` §5, append a `discovery_results` row, done.
3. **Miss** → run the cross-provider match evaluator of §5 against the workspace's existing Businesses.
   - **STRONG** → link: insert a new `business_identities` row pointing at the existing Business. No new `businesses` row.
   - **PROBABLE** or **AMBIGUOUS** → create a **new** Business, and record a `business_match_candidates` row. Nothing is merged.
   - **NONE** → create a new Business.
4. Append the `discovery_results` row.

Steps 1–4 are one transaction. Concurrency is decided by the unique indexes, not by the pre-checks: a lost race on step 1 surfaces as a unique violation on the identity insert, which is re-resolved to the winner's Business rather than raising (`B3_IDEMPOTENCY_CONCURRENCY.md` §3, race R-07).

## 5. Cross-provider deduplication — four classes

Evidence is graded by whether it is **verifiable and globally unique**, not by how similar two records look.

| Signal | Strength | Why |
|---|---|---|
| same `(provider, provider_external_id)` | **deterministic** | the provider's own identity assertion |
| normalized **E.164 phone** equality | **strong** | globally unique, verifiable, rarely shared between distinct businesses |
| **registrable domain** (eTLD+1) equality of the website | **strong** | globally unique and owned |
| coordinates within **75 m** | **weak** | a mall or tower holds dozens of businesses |
| normalized address equality | **weak** | shared buildings and formatting variance |
| **name similarity** | **weak, and never sufficient** | chains, franchises, branches, and translations all collide |
| same category | **corroborating only** | never contributes to a link on its own |

### 5.1 The classification rule

| Class | Condition | Action |
|---|---|---|
| **DETERMINISTIC** | identity tuple already maps to a Business | use it. Automatic |
| **STRONG** | **≥ 2 independent strong signals** agree, **and** the country matches, **and** no strong signal *contradicts* | **auto-link** a new identity row to the existing Business |
| **PROBABLE** | exactly 1 strong signal, or coordinate proximity combined with high name similarity | **no merge.** New Business + `business_match_candidates` row for review |
| **AMBIGUOUS** | ≥ 2 existing Businesses each classify as STRONG or PROBABLE for the same incoming record | **no merge, no auto-link.** New Business + one candidate row per contender, flagged `ambiguous` |
| **NONE** | nothing above | new Business |

**A contradiction demotes.** If phone matches but the registrable domains differ and both are present, the pair is at most PROBABLE — a shared reception line is more likely than two domains for one business.

### 5.2 What can never auto-merge

Stated as prohibitions, because each has a plausible wrong implementation (`B3-INV-6`):

- **Name similarity alone** — at any threshold, in any language, with or without a shared city, category, or country. "مطعم الرياض" appears many times in Riyadh.
- **Coordinates alone**, at any radius. A tower shares one point.
- **Address alone.**
- **A single strong signal alone** — one shared phone number is exactly the franchise/reception-desk case.
- **Anything at all across `workspace_id` boundaries.**

### 5.3 Signal normalization

Comparison is meaningless without canonical forms, so each strong signal has one:

| Signal | Canonical form | Rejected as unusable |
|---|---|---|
| phone | E.164, with the workspace default region applied to national-format numbers | unparseable; premium/short codes; a number appearing on **> 5** Businesses in the workspace (a shared aggregator line) |
| website | scheme- and `www`-stripped registrable domain (eTLD+1), lowercased | free hosts and link aggregators on a maintained deny-list — `facebook.com`, `instagram.com`, `linktr.ee`, and similar; a domain appearing on **> 5** Businesses |
| coordinates | WGS-84 decimal degrees | absent; `(0,0)`; outside valid ranges |
| country | ISO-3166-1 alpha-2 | absent — a missing country blocks STRONG, never demotes to a link |

The "> 5 Businesses" guard is what stops a directory-wide shared phone or a social-media URL from cascading an entire category into one Business. Its exact threshold is Class B (`B3-D-B004`); the existence of such a guard is Class A.

## 6. Merge

Merge is **operator- or system-initiated**, never a silent side effect of ingestion. Its only automatic trigger is a STRONG classification, which produces a **link** (a second identity row) rather than a merge — because linking at ingestion time never has two Businesses to reconcile. A true merge applies only when two Businesses already exist and must become one.

`MergeBusiness` (frozen B0 command) → `BusinessMerged` (frozen B0 event) → B2 consumed contract 7.

### 6.1 The merge transaction

Losing Business `L` into surviving Business `S`, both in one workspace, in one transaction:

1. Lock both rows in a deterministic order (`business_id` ascending) — two concurrent merges of the same pair cannot deadlock.
2. Re-point every `business_identities` row from `L` to `S`. The unique constraint absorbs an identity already held by `S`.
3. Re-point every `discovery_results` row from `L` to `S`, preserving `discovered_at`, the execution reference, and every other column. Where `(query_execution_id, business_id)` would collide, the duplicate is dropped — the same execution already recorded that observation against `S`.
4. Fill absent fields on `S` from `L` under `B3_NORMALIZATION_DATA_QUALITY.md` §5. **A populated field on `S` is never overwritten by `L`.**
5. Set `L.merged_into_business_id = S.id` and `L.archived_at = now()`. **`L` is not deleted, and `LEAD-*` records or exports referencing `BUS-L` still resolve** — to a tombstone that names its survivor.
6. Append a `business_merges` row: `(workspace_id, losing_business_id, surviving_business_id, actor_ref, reason, evidence, merged_at)`. Append-only.
7. Emit `BusinessMerged` with both public IDs.

### 6.2 What merge guarantees

| Guarantee | Mechanism |
|---|---|
| **No provenance is lost** | step 3 re-points rather than deleting; a dropped row is only ever an exact duplicate of one already on `S` (`B3-INV-7`) |
| **Old references resolve** | step 5 keeps `L` as a tombstone; `GET /businesses/{BUS-L}` returns `200` with `merged_into_ref` set |
| **CRM stays consistent** | `BusinessMerged` drives B2's frozen contract 7, which re-points `leads.business_id` and — where the partial unique index would break — archives the losing Lead and writes the one permitted `crm_activities` row. **B3 does none of this and must not attempt to.** |
| **Analytics stay correct** | `discovery_results` keeps its original `discovered_at`, job, query, and provider, so "businesses discovered in period P" is unchanged by a later merge |
| **Auditability** | `business_merges` is append-only and names the actor and the evidence |

### 6.3 Correction and un-merge

Un-merge is **not supported in Phase 1** (`B3-D-C001`). A wrong merge is corrected forward: create a new Business, move the disputed identities to it, and record a compensating `business_merges` row with `reason = 'correction'`. Because merges are append-only and never delete provenance, the information needed to reconstruct the pre-merge state is always present — which is what makes a future un-merge implementable without a data migration.

## 7. Preventing duplicate CRM conversion

The chain, end to end:

1. One real business ⇒ one `businesses` row per workspace (§3).
2. B2's frozen partial unique index `(workspace_id, business_id) WHERE archived_at IS NULL` ⇒ at most one active Lead per Business.
3. Therefore at most one active Lead per real business — **provided step 1 holds**, which is exactly what §4–§6 exist to guarantee.

Where step 1 *fails* — an unresolved PROBABLE match leaves two Businesses for one company — the user can convert both and hold two Leads. B3 does not hide this: it is the honest cost of refusing to auto-merge on weak evidence, and it is **recoverable** (merge later, and B2 contract 7 archives the losing Lead) whereas a wrong auto-merge is **not** (two companies' contact data and provenance are irreversibly commingled). The asymmetry is why the rule is conservative, and `business_match_candidates` exists so the recoverable case is visible rather than silent.

## 8. The deciding job for conversion

Frozen `ConvertBusinessRequest` already carries a nullable `source_job_ref`. With multi-job provenance, B2 needs a deterministic answer for both branches (`B3-D-A011`):

| Caller supplies | Rule |
|---|---|
| `source_job_ref = JOB-X` | **validate**: `JOB-X` must be a job that actually discovered this Business — a `discovery_results` row must exist joining them in this workspace. Otherwise `400 VALIDATION_ERROR`, `details.reason = "source_job_did_not_discover_business"`. This closes provenance forgery. |
| `source_job_ref = null` | the job of the **earliest** `discovery_results` row by `(discovered_at ASC, result_public_id ASC)` — the first job that found it. Total and deterministic; ties broken by the monotonic public ID. |

Every later job that also discovered this Business is exactly the population of B2's `lead_provenance_additional_jobs`, fed by `BusinessRediscovered` (`B3_CRM_B2_BOUNDARY.md` §4). The deciding job and the additional jobs partition the provenance set with no overlap and no gap — B2 guard 4 excludes the deciding job from the additional set by construction.

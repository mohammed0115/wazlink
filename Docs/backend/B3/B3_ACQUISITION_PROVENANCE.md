# B3 — Acquisition Provenance

> **B3 status:** Target design only. No implementation.

## 1. The question provenance must answer

> **Where did this business come from?**

Answered completely, permanently, and for **every** observation — not just the first:

*"`BUS-1042` was first discovered on 12 Aug by job `JOB-1028` (source `خرائط الأعمال`), through the query `عيادات أسنان × الرياض`, as provider result page 1. It was observed again on 3 Feb by `JOB-1104` through `عيادات × الرياض`, and again on 10 Mar by `JOB-1199` through a different provider."*

Every clause is a stored fact. None is reconstructed, inferred, or overwritten.

## 2. Why provenance is a table, not a column

The frozen frontend stores one `discoveryJobId` per business (`data.js:44`) and asserts it (`data.js:491`). A scalar has exactly two behaviours on rediscovery and both destroy information:

| Scalar strategy | What it loses |
|---|---|
| overwrite with the newest job | the original discovery — so "when did we first find this?" and every first-touch attribution question become unanswerable |
| keep the first, ignore later | every rediscovery — which is precisely what B2's `lead_provenance_additional_jobs` is contractually required to receive |

The second is fatal to the frozen B2 contract: B2 consumed contract 9 exists **only** to record additional discovery jobs, so a Discovery side that cannot name them makes B2 unimplementable. Provenance must therefore be append-only rows (`B3-INV-4`).

## 3. The provenance record

One `discovery_results` row per **(query execution × Business)**.

| Column | Immutable? | Meaning |
|---|:--:|---|
| `public_id` (`RES-*`) | yes | frozen registry §A; frozen `DiscoveryResult.public_id` |
| `workspace_id` | yes | `B3-INV-1` |
| `job_id` → `JOB-*` | yes | which job observed it — frozen `DiscoveryResult.job_ref` |
| `query_id` | yes | which keyword×location combination |
| `query_execution_id` | yes | which attempt of that combination |
| `business_id` → `BUS-*` | **re-pointable by merge only** | frozen `DiscoveryResult.business_ref` |
| `provider` | yes | which provider produced it |
| `provider_external_id` | yes | the identity as asserted at that moment |
| `page_index` | yes | which provider page |
| `position_in_page` | yes | ordering within the page |
| `discovered_at` | yes | **WazLink trusted server clock at ingestion** — §3.1 |
| `filtered` | yes | true if a post-filter excluded it from the visible set |
| `filter_reason` | yes | which filter, when `filtered` |
| `result_name_at_discovery` | yes | the name as observed — a historical snapshot, never refreshed |

**Uniqueness: `(query_execution_id, business_id)`.** One execution records one Business at most once; a provider returning the same place twice in one execution is absorbed as a duplicate. Across executions, jobs, and providers, additional rows are correct and expected.

`result_name_at_discovery` is deliberately a snapshot. When a Business is later renamed by a provider refresh, "what did we see when we found it?" remains answerable — the same reasoning B2 applies to `lead_provenance.conversion_business_name_at_time`.

### 3.1 `discovered_at` is our clock, never theirs

> **`B3-INV-13`: `discovered_at` is WazLink's trusted server clock, sampled inside the ingestion transaction that creates the row.**

It is explicitly **not** `provider_observed_at`, not any provider timestamp, not a page header date, and not a client value. `provider_observed_at` is retained separately as diagnostic evidence and is never copied here.

This has a consequence that reaches into B2. `discovered_at` is the field B3 hands to B2's `BusinessRediscoveredSignal`, where B2 subjects it to the `processing_reference_time` skew rule of `B2_TIMELINE_IDENTITY_MODEL.md` §5.2.1. Because B3 stamps it from the same trusted infrastructure clock at a strictly earlier instant than CRM's processing attempt, the skew is structurally non-positive and the rejection branch is unreachable in practice.

**B2's machinery still governs, and that is deliberate.** B3 does not claim the skew check is unnecessary; it removes the *cause* while B2 keeps the *defence*. Two independent barriers, and the one place a provider clock could have poisoned a downstream monotonic column is closed at the source.

## 4. What provenance guarantees

| Guarantee | Mechanism |
|---|---|
| **Append-only** | no `UPDATE` path exists except merge's `business_id` re-point (`B3_BUSINESS_IDENTITY_MODEL.md` §6) |
| **No overwrite on rediscovery** | a new observation is a new row; nothing existing is touched |
| **Idempotent** | `(query_execution_id, business_id)` unique + `ON CONFLICT DO NOTHING` |
| **Survives merge** | rows re-point to the survivor and keep every other column (`B3-INV-7`) |
| **Survives retry** | earlier attempts' rows are retained; a retry adds rows against new executions |
| **Survives job failure/cancellation** | rows already committed are kept — the provider was paid |
| **Complete for the deciding-job rule** | `(discovered_at ASC, public_id ASC)` is a total order, so "the first job that found it" is always well-defined (`B3_BUSINESS_IDENTITY_MODEL.md` §8) |
| **Analytics-stable** | period, job, query, and provider are immutable, so a historical count never changes retroactively |

## 5. Provenance projections

Three read shapes, all derived — none is a second source of truth:

| Projection | Derivation | Consumer |
|---|---|---|
| `Business.provenance` | aggregate `discovery_results` for one Business | `GET /businesses/{id}`, the frontend preview modal (`DiscoveryModal.tsx:90-131`) |
| job result list | `discovery_results` for one job where `filtered = false` | `GET /discovery/jobs/{id}/results` |
| rediscovery signal | one row whose Business already existed before this job | `BusinessRediscovered` → B2 contract 9 |

## 6. Coordination with B2 rediscovery

B2's frozen `B2_REDISCOVERY_PROVENANCE_PROCESS.md` §2.1 states exactly what it needs and explicitly bounds it: *"What B3 must supply, and nothing more: the four fields above, at-least-once, with `discovery_job_public_id` identifying the observing Job. B2 requires no ordering guarantee, no exactly-once guarantee, and no event ID."*

B3 supplies exactly those four and nothing more:

| B2 field | B3 source |
|---|---|
| `workspace_id` | `discovery_results.workspace_id` |
| `business_public_id` | the resolved `BUS-*` |
| `discovery_job_public_id` | `discovery_results.job_id` → `JOB-*` |
| `discovered_at` | `discovery_results.discovered_at` (§3.1) |

**Emission rule.** One `BusinessRediscovered` per `discovery_results` row whose Business **existed before this job** — that is, `first_discovered_at < this row's discovered_at` **and** no earlier row for this Business shares this `job_id`. The second clause prevents a multi-combination job from emitting several signals for one Business it found through two keywords; B2's `(lead_id, discovery_job_public_id)` uniqueness would absorb them, but emitting once is cheaper and clearer.

**B3 does not filter on CRM state**, and this is a boundary decision rather than an oversight — see `B3_CRM_B2_BOUNDARY.md` §4.

## 7. Provenance and privacy

Provenance rows carry identity references, a provider name, a page index, and a timestamp. They carry **no** contact PII: name is a historical display snapshot, and phone, email, and address live only on the Business, where the deletion and retention rules of `B3_SECURITY_PRIVACY_LEGAL.md` §7 apply.

Consequently a business-data deletion request can null the contact fields on `businesses` while leaving `discovery_results` intact — so audit ("did we ever query for this?") and analytics ("how many results did `JOB-1028` produce?") both survive a deletion that removes the personal data. Frozen B0 asks for exactly this: *"anonymize rather than erase relational history when necessary."*

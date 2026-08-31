# B2 — Lead Origin, Provenance, Conversion, and Duplicate Policy

> **B2 status:** Target design only. The conversion workflow below is the single most concurrency-sensitive command in the CRM domain.

## 1. Origin model

| Origin | Phase 1 | Evidence | Requirement |
|---|---|---|---|
| **`DISCOVERY`** | **ENABLED** | the only creation path in the frozen tree (`CrmModal.tsx` → `convertBusinessToLead`); frozen `Lead.business_ref` is in `required` | a Business in the same workspace |
| `MANUAL` | **NOT_SUPPORTED** (`B2-D-C001`) | no frontend surface exists; the frozen `Lead` schema **requires** `business_ref`, so a Business-less Lead is not representable | would require a frozen-schema amendment making `business_ref` nullable, plus a manual-duplicate policy |
| `IMPORT` | **NOT_SUPPORTED** (`B2-D-C002`) | no import surface, no file/column mapping contract, no dedup policy anywhere in the tree | would require a mapping contract, a batch idempotency model, and a bulk quota decision |

`origin_type` is nonetheless a **column from day one**, constrained to `('discovery')`. Adding a value later is a check-constraint widening; retrofitting the column onto a populated table would require back-filling provenance that no longer exists.

**No fake records.** When `MANUAL` is enabled, it must **not** fabricate a Business or a Discovery Job to satisfy a foreign key. That would pollute the Discovery domain with rows no crawler produced and corrupt every Discovery metric in `BACKEND_ANALYTICS_SEMANTICS.md` ("Businesses discovered", "Lead conversion" cohort). This prohibition is recorded now so the future implementer cannot reach for it.

## 2. What provenance must survive

A Lead must still answer *where did this come from* after the Business is re-crawled and renamed, the analysis is regenerated with a different score, the Opportunity is replaced, and the Discovery Job is archived. Live references alone cannot do that — they answer *what is true now*, not *what was true when a human decided*.

## 3. `lead_provenance` — immutable snapshot

One row per Lead, written inside the conversion transaction, **never updated and never deleted**.

| Column | Type | Notes |
|---|---|---|
| `id` / `workspace_id` | | tenant column |
| `lead_id` | UUID FK → `leads.id`, **unique** | exactly one snapshot per Lead |
| `source_public_id` | text null | `SRC-*` at conversion time |
| `discovery_job_public_id` | text null | `JOB-*` at conversion time |
| `business_public_id` | text NOT NULL | `BUS-*` at conversion time — survives a later merge |
| `analysis_public_id` | text null | the `ANL-*` that existed at conversion, if any |
| `opportunity_public_id` | text null | the `OPP-*` that existed at conversion, if any |
| `intelligence_score` | integer null | the score **as displayed at the moment of the decision** |
| `intelligence_tier` | text null | the tier at that moment |
| `intelligence_status` | text NOT NULL | `analyzed` \| `insufficient_data` (the two convertible states, §5) |
| `scoring_version` | text null | `SCORING_VERSION` (frozen tree: `"S4-MOCK-v1"`) so a score is interpretable later |
| `business_name_snapshot` | text NOT NULL | what the user saw in the conversion modal |
| `converted_by_membership_id` | UUID FK → `memberships.id` | who decided |
| `converted_at` | timestamptz | when |

**Stored as text public IDs, not foreign keys, on purpose.** A snapshot must outlive the row it names: if a Discovery Job is archived or an Opportunity is replaced, a FK would either block the cleanup or cascade the history away. These columns are historical strings, not live references — and `B2_LEAD360_READ_MODEL.md` §4 states that the provenance panel renders them as text and marks any that no longer resolve as *historical*, never as broken.

**Snapshot scope is narrow, and the boundary is stated.** Only the identities, the two AI numbers a human actually acted on, and the Business name shown in the modal are captured. Signals, reasons, services, evidence, dimension breakdowns, the full analysis payload, and the sales approach are **not** snapshotted: they are large, they are the Intelligence domain's to version, and copying them would make CRM a second AI-output store in violation of CRM-INV-4.

**Additional Discovery Jobs.** When a Business already converted is re-discovered by a different Job, no new Lead and no new provenance row is created. The additional job identity is appended to `lead_provenance_additional_jobs (lead_id, discovery_job_public_id, observed_at)` — unique on `(lead_id, discovery_job_public_id)` — so "this Business came back in JOB-1099 too" is recorded without disturbing the conversion snapshot or the `leads.source_job_id` that explains the original decision.

**How and when the additional job is recorded:** Defined in `B2_REDISCOVERY_PROVENANCE_PROCESS.md`. When Discovery publishes an event signifying "a Business already converted was observed by a different Job", CRM's `RecordLeadRediscoveryProvenance` process appends the job to `lead_provenance_additional_jobs` idempotently. This is a CRM consumer of a Discovery-domain event, with full specification for B3 alignment.

## 4. Duplicate policy — the explicit answers

| Question | Answer |
|---|---|
| **Can one Workspace have multiple *active* Leads for one Business?** | **No.** Partial unique `(workspace_id, business_id) WHERE archived_at IS NULL`. This is B0's "business/workspace conversion unique" made precise, and it matches the frozen `getLeadByBusinessId` rule and integrity check `B`. |
| **Can an archived Lead's Business be converted again?** | **Yes.** The archived row leaves the partial index. A new `LEAD-*` is created; the archived row is retained forever. History is never rewritten (the same doctrine B1 applies to re-invitation after membership removal). |
| **Can a deleted Lead be recreated?** | **Leads are never deleted.** There is no hard delete and no `deleted_at`. "Delete" is archive; see the row above. |
| **Same Business through multiple Discovery Jobs?** | **One Lead.** Business identity is `(workspace_id, provider_external_id)` unique (B0 Discovery). `leads.source_job_id` records the job that led to the conversion decision; every other job is appended to `lead_provenance_additional_jobs`. |
| **What identifies a Manual Lead?** | Nothing — `NOT_SUPPORTED` in Phase 1. When enabled it needs its own identity rule; it must **not** reuse the Business index, and the answer must be a product decision, not an implementer's guess (`B2-D-C001`). |
| **What identifies an Imported Lead?** | `NOT_SUPPORTED` (`B2-D-C002`). |
| **Are phone/email duplicates prevented?** | **No, and deliberately never.** There is **no** unique index on `contacts.phone` or `contacts.email` at any scope (CRM-INV-18). A shared reception number, a `info@` mailbox, or a franchise head-office line are all legitimately shared by distinct Businesses — the frozen fixtures already show a business-level mailbox (`info@ibtisama.med`) used as a contact address. Making either column an identity key would silently merge unrelated Leads. Duplicate contact details may be **surfaced** as an advisory (`B2-D-C003`), never enforced. |

## 5. `ConvertBusinessToLead` — the authoritative workflow

**Transport:** `POST /api/v1/businesses/{id}/convert-to-lead` (**frozen B0 operation**, unchanged path, unchanged `201 Lead` response body).

| Aspect | Specification |
|---|---|
| Permission | `business.convert` (B1 catalog; matrix `A A A C · ·`). `lead.create` is reserved for the future manual path and is **not** required here (`B2-D-A022`) |
| Entitlement | `crm.core` |
| Quota | `leads`, reserved **inside** the transaction before the insert |
| Idempotency | `Idempotency-Key` header **REQUIRED** (already declared on the frozen operation) |
| Concurrency | `SELECT … FOR UPDATE` on the Business row + the partial unique index |
| Version | not applicable (creation); the response carries `version = 1` |
| Request DTO | `ConvertBusinessRequest` (frozen): `owner_ref?`, `source_job_ref?` |
| Response | `201 Lead` (frozen schema, unchanged) + `X-Lead-Conversion-Outcome: created \| existing` (`B2-D-B005`) |
| Event | `LeadCreated` (+ `ContactAdded` when a contactable detail exists) |
| Audit | `lead.converted` with the Business, Job, and outcome |

**Ordered steps, inside one transaction after B1 pipeline steps 1–14 pass:**

1. Resolve the Business through the active-workspace queryset (Doctrine R-1). A miss ⇒ `404 ENTITY_NOT_FOUND`, byte-identical for "does not exist" and "belongs to another workspace" (CRM-INV-2).
2. Reject a Business that is archived or that has been merged away (`businesses.merged_into_id IS NOT NULL`) ⇒ `409 CONFLICT`, `details.reason = "business_not_convertible"`.
3. **Convertibility guard.** The Business's intelligence status must not be `not_analyzed` or `analysis_error` ⇒ `409 CONFLICT`, `details.reason = "business_not_analyzed"`. This mirrors the frozen `canConvert` check exactly, and `insufficient_data` **is** convertible (a Business with no provable gap is still a legitimate Lead, and the frozen check excludes only the two error-ish states).
4. `SELECT … FOR UPDATE` on the Business row. This serializes concurrent conversions of the same Business without taking a lock on anything another workspace touches.
5. Re-read for a live Lead: `SELECT … WHERE workspace_id = :w AND business_id = :b AND archived_at IS NULL`. If one exists, **return it** with `201` and `X-Lead-Conversion-Outcome: existing`. No mutation, no event, no quota consumption, no second Contact. Audit `lead.convert_deduplicated`.
6. Resolve the owner Membership: `owner_ref` if supplied, else the acting Membership. It must be `active` in this workspace ⇒ otherwise `409 CONFLICT`, `details.reason = "owner_membership_inactive"`; if it is not in this workspace at all ⇒ `404 ENTITY_NOT_FOUND` (no cross-workspace disclosure).
7. Resolve `source_job_ref` if supplied — it must be a Discovery Job in this workspace **that actually discovered this Business** ⇒ otherwise `404 ENTITY_NOT_FOUND`. If omitted, derive it from the Business's discovering job.
8. Reserve one unit of the `leads` quota against the locked `usage_counters` row ⇒ `403 QUOTA_EXHAUSTED` on failure, **before** any insert.
9. Insert the `leads` row: `status = 'new'`, `priority = 'medium'`, `origin_type = 'discovery'`, `converted_at = now()`, `last_activity_at = now()`, `next_activity_at = NULL`, `version = 1`. *(Defaults match the frozen modal, which passes `{status:"new", priority:"medium"}`.)*
10. Insert `lead_provenance` from the values resolved in steps 1–7.
11. If the Business carries a phone or an email, create or link a Contact (`B2_CONTACT_MODEL.md` §5) and emit `ContactAdded`.
12. Append `crm_activities` entry `type = 'lead_converted'` (canonical vocabulary from `B2_CRM_ACTIVITY_VOCABULARY.md`).
13. Write the `IdempotencyRecord`, the `audit_logs` row, and the outbox events in the same transaction.
14. Commit.

**Losing the race (step 9).** If a concurrent transaction commits first, the insert violates the partial unique index. The loser **does not** return `409`. It catches the violation, re-reads the winner's Lead, releases its quota reservation with the rollback, and returns that Lead with `201` and `X-Lead-Conversion-Outcome: existing`. Exactly one Lead, exactly one quota unit, exactly one `LeadCreated`, and both callers see success — which is the behavior the frozen UI already presents.

## 6. Conversion stress tests

| Scenario | Mechanism | Outcome |
|---|---|---|
| **Double click** (same key, same body) | `IdempotencyRecord` unique constraint | second request replays the stored `201` verbatim. One Lead, one event, one quota unit |
| **Two browser tabs** (different keys, same Business) | Business row lock + partial unique index | one `created`, one `existing`. Both `201`. One Lead |
| **Two users, same Business** | as above | as above; the first committer's owner wins and the second sees the existing Lead |
| **Two workers, same Business** | as above | as above; no Redis lock participates (CRM-INV-11) |
| **Same Business via two different Discovery Jobs** | Business identity is unique per workspace | one Lead; the second job is appended to `lead_provenance_additional_jobs` |
| **Retry after timeout, request never committed** | no `IdempotencyRecord` exists | executes normally and creates the Lead |
| **Retry after commit but the response was lost** | `IdempotencyRecord` found, terminal | replays the stored `201`. **No second Lead and no second quota unit** — this is precisely why the key is REQUIRED rather than recommended |
| **Retry with the same key but a different body** | key/body-hash mismatch | `409 IDEMPOTENCY_CONFLICT` |
| **Business archived between the modal opening and confirm** | step 2 | `409 CONFLICT`, `reason = "business_not_convertible"` |
| **Business merged away between read and confirm** | step 2 under the row lock | `409 CONFLICT`, `reason = "business_not_convertible"`. The caller retries against the surviving Business |
| **Business in another workspace** | step 1 | `404 ENTITY_NOT_FOUND`, indistinguishable from a random `BUS-*` |
| **Quota exhausted** | step 8, before the insert | `403 QUOTA_EXHAUSTED`. **No Lead row, no Contact, no provenance, no event** |
| **The Lead's only prior instance is archived** | archived rows are outside the partial index | a **new** Lead is created and a new quota unit is consumed |

## 7. `BusinessMerged` and provenance

When Discovery merges `BUS-B` into `BUS-A`:
- Every live Lead pointing at `BUS-B` is re-pointed to `BUS-A` **inside the merge transaction**.
- If a live Lead already exists for `BUS-A` in that workspace, the partial unique index would be violated. The **older** Lead (by `converted_at`, tie-broken by `public_id`) survives; the newer is archived with `archived_at = now()` and exactly one `crm_activities` entry of the canonical type `lead_business_merged` (`B2_CRM_ACTIVITY_VOCABULARY.md` §2.1), naming the surviving Lead. A deterministic rule is required here because an arbitrary choice would silently discard whichever Lead carried the Deals.
- `lead_provenance` is **never rewritten**. It keeps naming `BUS-B`, which remains the honest answer to "what did the user convert?".
- No `LeadCreated` and no `LeadArchived`-by-user event is emitted; a distinct `LeadArchived` with `reason = "business_merged"` is emitted for the archived row so downstream consumers can distinguish it from a human archive.

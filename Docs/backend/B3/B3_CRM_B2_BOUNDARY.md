# B3 — CRM / B2 Boundary

> **B3 status:** Target design only. **B2 is CLOSED, PUBLISHED, and FROZEN at `24643397254caac4117320df756d8bc164882635`. B3 changes nothing in it.** Every B2 statement below is quoted or cited, never restated as a target.

## 1. The rule

> **A discovered Business is not a Lead.**

Frozen `BACKEND_DOMAIN_OWNERSHIP.md` states Discovery's forbidden coupling as **"no Lead auto-create"**, and frozen `B2_DOMAIN_OWNERSHIP.md` §4 records the hop `BUS-1042 → LEAD-1042` as *"a human decides to pursue … CRM … `ConvertBusinessToLead` … **owner of this hop and only this hop**"*.

B3 enforces this **structurally**, not by policy: B3 has no write path to any CRM table, issues no CRM command, and stores no Lead reference. There is no code path that could auto-create a Lead, so the prohibition cannot be violated by an implementation mistake — only by adding something this design does not contain (`B3-INV-2`).

## 2. What B3 gives B2

Exactly three things:

| # | What | When | How |
|---:|---|---|---|
| 1 | a **stable, resolvable `BUS-*`** with normalized fields | always | `businesses`; `GET /businesses/{id}` |
| 2 | a **deterministic deciding `JOB-*`** | at conversion | `B3_BUSINESS_IDENTITY_MODEL.md` §8 |
| 3 | a **`BusinessRediscovered` signal** per additional discovering job | on rediscovery | §4 |

Plus one event B2 already consumes: `BusinessMerged` (§5).

**One acknowledged, non-blocking gap.** Frozen `B2_CRM_LIST_QUERY_MODEL.md` additionally names a `BusinessUpserted` event as the refresh mechanism for `crm_lead_list_projection`'s `business_name`/`business_category`/`business_city` columns on a normalized-field change. B3's current event set (`BusinessDiscovered`, `BusinessRediscovered`, `BusinessMerged`) does not fire for every case that name implies — specifically a same-job re-observation or an in-place refresh with no new discovering job. This is recorded honestly as `B3-D-C019` (`B3_DECISION_REGISTER.md` §4, `B3_B4_HANDOFF_CONTRACT.md` §3.3) rather than asserted as already satisfied, and it is non-blocking because the projection is explicitly non-authoritative, rebuildable, and nightly-reconciled, and `GET /leads/{id}` / `/360` always read Business fields live (`B2_CRM_LIST_QUERY_MODEL.md` §6).

## 3. The conversion hop

`POST /businesses/{id}/convert-to-lead` is **frozen and B2-owned**. B3 neither implements nor amends it. B3's obligations are only that the identifiers it resolves are correct:

| B2 needs | B3 guarantees |
|---|---|
| `BUS-*` resolves inside the workspace | `B3-INV-1`; a merged-away ID resolves to its tombstone and names the survivor |
| one Business per real-world business | `B3-INV-4`, §3–§6 of `B3_BUSINESS_IDENTITY_MODEL.md` — this is what makes B2's `(workspace_id, business_id)` active-Lead uniqueness meaningful one level up |
| `source_job_ref` names a job that really discovered it | validated against `discovery_results`; otherwise `400` (`B3_BUSINESS_IDENTITY_MODEL.md` §8) — this closes provenance forgery |
| `source_job_ref` may be null | the earliest-discovering job by `(discovered_at ASC, public_id ASC)` — total and deterministic |
| business fields for the provenance snapshot | normalized `businesses` fields, stable at read time |

**B2's duplicate semantics are untouched.** A conversion of a Business that already has an active Lead returns B2's existing-Lead outcome. B3 is not consulted and does not care — the frozen frontend already shows this behaviour (`DiscoveryModal.tsx:188-200` counts `created` vs `duplicate`).

## 4. The `BusinessRediscovered` producer contract

Frozen `B2_REDISCOVERY_PROVENANCE_PROCESS.md` §2.1 leaves B3 a **choice** and states its bound:

> *"Exact producer event name and schema: To be aligned during B3 Discovery Design. CRM specifies the above semantic contract; the Discovery team chooses whether this is: a `DiscoveryJobCompleted` event with a filter/side-effect for already-converted businesses, or a dedicated `BusinessRediscovered` event, or a different mechanism that guarantees the same semantics."*
>
> *"What B3 must supply, and nothing more: the four fields above, at-least-once, with `discovery_job_public_id` identifying the observing Job. B2 requires no ordering guarantee, no exactly-once guarantee, and no event ID."*

### 4.1 The decision

**B3 chooses the dedicated `BusinessRediscovered` event** (`B3-D-A012`).

| Option | Rejected because |
|---|---|
| filtered `DiscoveryJobCompleted` | CRM would have to receive the job's result set and work out which businesses it already knew — putting Discovery's internals inside CRM, and making a CRM consumer's correctness depend on a Discovery payload shape |
| a synchronous call from Discovery to CRM | inverts the dependency (`B3_DOMAIN_OWNERSHIP.md` §5) and couples discovery latency to CRM availability |
| **a dedicated event** ✔ | one row of the payload maps to one row of B2's table; CRM learns nothing about Discovery beyond four identifiers |

### 4.2 The payload — exactly B2's four fields

```
BusinessRediscovered {
  workspace_id              # B2 guard 1
  business_public_id        # BUS-*, B2 guard 2
  discovery_job_public_id   # JOB-*, B2 guards 4 and 5
  discovered_at             # the observation instant
}
```

**Nothing more.** B2 says "and nothing more"; adding a provider name or a keyword would create a payload B2 must ignore and a future consumer might depend on.

### 4.3 Emission rule

One event per `discovery_results` row where the Business **existed before this job**, and at most one per `(business, job)` pair (`B3_ACQUISITION_PROVENANCE.md` §6).

### 4.4 Why B3 does not filter on CRM state

B2 §2.1 describes the semantic as *"a Business … already the subject of a conversion in the calling workspace."* Filtering on that would require Discovery to **read CRM** to decide whether to emit — inverting the dependency direction that `B3_DOMAIN_OWNERSHIP.md` §5 establishes, coupling Discovery's ingestion path to CRM availability, and giving Discovery knowledge of Lead existence that `B3-INV-2` forbids.

**B3 therefore emits unconditionally on rediscovery, and B2's own guards filter.** This is sound under B2's frozen text: guard 3 states that when no live Lead exists *"the event is **discarded** … No error is raised"* — a correct, permanent, silent no-op that B2 already specifies. B2 §2.1 additionally requires only at-least-once delivery, which unconditional emission trivially satisfies.

**The cost is honest and bounded**: CRM processes some events it discards. Each discard is two indexed lookups (guard 2 by `(workspace_id, business_public_id)`, guard 3 by `(workspace_id, business_id)` on a partial unique index), and the volume is bounded by the rediscovery rate, itself bounded by the 10-submissions-per-hour rate limit. That is a much better trade than a cross-domain read on the ingestion hot path.

### 4.5 The clock guarantee

`discovered_at` is **WazLink's trusted server clock at ingestion**, never a provider timestamp (`B3-INV-13`).

B2 subjects it to the `processing_reference_time` skew rule of `B2_TIMELINE_IDENTITY_MODEL.md` §5.2.1 — the rule B2-FIX.4 and B2-FIX.4.1 spent two rounds hardening. Because B3 stamps `discovered_at` from the same trusted infrastructure clock at a strictly earlier instant than CRM's processing attempt, the skew is structurally non-positive and B2's `RETRYABLE_CLOCK_SKEW` branch is unreachable in practice.

**B2's defence still runs, and B3 does not ask it to stop.** B3 removes the cause; B2 keeps the defence. Two independent barriers, and the one place a provider clock could have poisoned a downstream column is closed at the source rather than mitigated downstream.

## 5. `BusinessMerged` and B2 contract 7

`MergeBusiness` emits frozen `BusinessMerged`, which B2 consumes as contract 7 — *"re-point `leads.business_id` to the surviving Business inside the merge transaction; `lead_provenance` is untouched. Where the partial unique index would be violated, archive the losing Lead, emit `LeadArchived` with `reason='business_merged'`, and write one `lead_business_merged` activity."*

| B2 does | B3 does |
|---|---|
| re-points `leads.business_id` | re-points `business_identities` and `discovery_results` |
| archives a losing Lead where the index would break | keeps the losing Business as a resolvable tombstone |
| writes the **one** permitted `crm_activities` row | writes **no** CRM row of any kind |
| leaves `lead_provenance` untouched | leaves every `discovery_results` column but `business_id` untouched |

B3 emits the event and does not wait for, observe, or depend on CRM's reaction.

## 6. Discovery is not a timeline source

Frozen `B2_TIMELINE_IDENTITY_MODEL.md` §2.2 defines cross-domain timeline identity as `<source_domain>:<source_event_id>` with `source_domain` drawn from the **closed set `{messaging, pipeline}`**.

**Discovery is not in that set, and B3 does not ask to join it** (`B3-INV-14`). No Discovery event creates a CRM timeline entry, and B3 exposes no `source_event_id` for timeline consumption.

This is consistent throughout frozen B2: `BusinessRediscovered`'s consumer writes **NO TIMELINE ACTIVITY ROW** (`B2_REDISCOVERY_PROVENANCE_PROCESS.md` §2.2.2), and its stated reason applies directly — a rediscovery is *"Discovery observing the world again; it is not someone working the Lead"*, and a large re-crawl would otherwise flood every Lead's timeline with entries nobody performed.

Joining the set later would require a B2 amendment, a `source_event_id` contract per `B2_TIMELINE_IDENTITY_MODEL.md` §2.2.1, and a product decision that machine observation belongs on a human activity timeline. **B3 requests none of this.**

## 7. What B3 does not touch in B2

- `leads`, `lead_provenance`, `lead_provenance_additional_jobs`, `crm_activities`, `notes`, `lead_tags`, `contacts`, `tasks`, `appointments` — B3 has no write path to any of them.
- `ConvertBusinessToLead` and `POST /businesses/{id}/convert-to-lead`.
- `RecordLeadRediscoveryProvenance` and its four guards.
- The `last_activity_at` recovery contract, the three processing states, and the acknowledgement semantics of `B2_TIMELINE_IDENTITY_MODEL.md` §5.5.
- The timeline model, cursor contract, deduplication rule, and `entry_id` shapes.
- B2's 11 controlled amendments and its 27 Class A decisions.

`B3_CONTROLLED_AMENDMENTS.md` therefore contains **no B2 item**, and `B2_DRIFT = 0`.

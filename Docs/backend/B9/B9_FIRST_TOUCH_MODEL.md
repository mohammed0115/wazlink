# B9 — First-Touch Attribution Algorithm

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. Frozen basis — verified against the repository, not assumed

The task brief expects first-touch. The repository confirms it, in two independent frozen places:

- `BACKEND_ARCHITECTURE_DECISIONS.md` **ADR-008**: *"Phase 1 stores touchpoints and exposes deterministic first-touch attribution. Last-touch and multi-touch reports may be added as separate read models after product acceptance. Attribution never changes RevenueEvent amount."*
- `BACKEND_ANALYTICS_SEMANTICS.md`: *"Phase 1 uses deterministic first-touch attribution: the earliest valid touchpoint for a Business/Lead chain receives the RevenueEvent allocation. A valid touchpoint must be workspace-scoped, linked to a Business/Lead or approved source identity, and occur no later than recognition unless the product contract explicitly allows later touches. Unattributed and over-attributed amounts are reported; allocation is clamped so attributed revenue never exceeds the source RevenueEvent."*

Frontend corroboration: every fixture touchpoint is `type:"first_touch"` (`FB-B9-003`) with exactly one per revenue event (`FB-B9-049`), and the default allocation weight is 1 (`FB-B9-019`).

**One conflict was found and resolved against the frozen document.** `analytics-engine.js:102` labels its trace `attributionModel:"multi_touch_weighted"` (`FB-B9-020`). This is a **label on a mock projection**, classified **B**; its own data is uniformly first-touch. Frozen ADR-008 governs, and Phase 1 is first-touch. The multi-touch generalisation is recorded as `B9-D-B002`, not silently adopted.

## 2. Two candidate sources, one ordering — resolved (Class A, `B9-D-A035`)

First-touch resolution draws candidates from **two** sources and orders them together as one set:

| Source | What it is | Written by | `public_id` |
|---|---|---|---|
| **Persisted touchpoint** | an explicitly recorded acquisition fact | `RecordTouchpoint`, a human with `attribution.manage` | `ATT-*` |
| **Derived provenance candidate** | an acquisition fact frozen B3 already recorded | **nobody in B9** — read from B3's append-only `discovery_results` | `RES-*` |

An earlier draft made `revenue_attributions.touchpoint_id` nullable "when the winner was derived from the provenance chain", and said unattributed meant "no touchpoint **and no derivable provenance chain**", while this document's algorithm returned `NONE` the moment no touchpoint qualified. Those two statements described different products. `B9-D-A035` resolves it in favour of deriving, and specifies the derivation completely below — because the alternative (touchpoints only) would have left Track A with no attribution at all (§2.3).

### 2.1 Qualifying persisted touchpoint

A row of `attribution_touchpoints` qualifies for a recognition when **all** hold:

1. same **workspace** as the RevenueEvent;
2. its `subject` (`BUS-*`/`LEAD-*`) is on the recognition's **provenance chain** (§3);
3. `occurred_at` **≤** the event's `recognized_at`;
4. its `source_type` is in the closed set (`B9_ATTRIBUTION_MODEL.md` §4) and its `source_ref` resolves **in-workspace** — which it always can, because every touchpoint `source_type` names a registered workspace-scoped entity (`B9-D-A037`).

### 2.2 Qualifying derived provenance candidate

A row of frozen B3's `discovery_results` qualifies when **all** hold:

1. same **workspace** as the RevenueEvent;
2. its `business_id` (`BUS-*`) is on the recognition's **provenance chain** (§3);
3. its `discovered_at` **≤** the event's `recognized_at`;
4. its `job_id` (`JOB-*`) resolves in-workspace;
5. **`filtered = false`** — the observation is in the job's *visible* result set (§2.2a, `B9-D-A044`).

### 2.2a Clause 5 — filtered observations are **not** candidates (Class A, `B9-D-A044`)

Frozen B3's `discovery_results` carries `filtered` and `filter_reason`: *"true if a post-filter excluded it from the visible set"* (`B3_ACQUISITION_PROVENANCE.md` §3). `B9-FIX.2` left this unstated, so the four clauses above admitted filtered rows by omission — a substantive attribution choice nobody had made. `B9-FIX.2a` makes it, and makes it **exclusive**.

**What `filtered` actually means in frozen B3.** It is not a data-quality flag and not an ingestion failure. It records that the Business *was* observed and then failed a **caller-supplied post-filter** from the closed `DiscoveryFilters` set — `min_rating`, `min_reviews`, `website`, `activity`, `has_phone`, `has_email`, `has_whatsapp`, `has_instagram` (`B3_API_DTO_CONTRACTS.md` §3.1.4). The workspace itself asked for those businesses to be excluded. B3 keeps the row anyway, and says exactly why: *"Discarding it entirely would destroy the evidence that the job observed it, and would make a later identical job look like a first discovery"* (`B3_DISCOVERY_REQUEST_MODEL.md` §3). The row is **audit evidence**, deliberately retained — not a delivered acquisition result.

**Three frozen facts say the same thing.** B3 excludes a filtered row from `GET /discovery/jobs/{id}/results`; excludes it from `deduplicated_count` and counts it under `duplicate_count` (`B3_JOB_STATE_MACHINE.md` §141-142); and names its partial index `(workspace_id, job_id) WHERE filtered = false` *"the visible result set"* (`B3_DATA_MODEL.md` §109). Frozen B3 draws the visible/evidence line itself; B9 adopts B3's own line rather than inventing a different one.

**Why exclusion is the right side of that line.**

| Reason | |
|---|---|
| **The frozen analytics clause** | `BACKEND_ANALYTICS_SEMANTICS.md` requires a valid touchpoint be *"linked to a Business/Lead or **approved** source identity."* A row the workspace's own filter policy rejected is the one thing that is demonstrably **not** approved. Excluding it is what keeps `B9-AM-013`'s `COMPATIBLE_CLARIFICATION` honest — admitting it would have leaned on the same clause to carry the opposite meaning |
| **The trace would not resolve** | Op 6 returns `chain.discovery_job_ref` and the Revenue tab, trace modal and CSV export render it (`FB-B9-051`…`FB-B9-053`). An operator drilling from a recognized amount into that `JOB-*` would find the business **absent from the job's result list** — a financial attribution pointing at acquisition evidence the acquisition surface does not show |
| **It can only ever be conservative** | The rule removes candidates; it never adds one. Its worst case is that an event reports **unattributed**, which is a fully supported outcome that changes no recognized amount (`B9-D-A013`). It cannot manufacture, move, or destroy revenue |

**Track A is not weakened.** A Business that failed a filter on one job and was later observed unfiltered by another still attributes — to the unfiltered observation, which is the acquisition that actually delivered it. A Business whose *every* `discovery_results` row is filtered was never delivered by any job's visible result set, so it reached the CRM another way; its recognition attributes to a recorded touchpoint if one exists, and reports unattributed otherwise. Recognition is unaffected in every branch.

**Determinism is unaffected.** Clause 5 is a predicate on the candidate set, evaluated before the ordering of §4 step 6. It removes rows; it changes no comparator and introduces no tie. The total order still terminates on `public_id`. `AT-FT-17`, `AT-FT-18` **(NC)**.

**This reads frozen B3; it changes nothing in it.** No B3 row is written, updated, or reinterpreted — B9 applies an additional predicate to its own `SELECT`. `B3_DRIFT = 0`.

Every field used is frozen, immutable and already stored. `B3_ACQUISITION_PROVENANCE.md` §3 defines `discovery_results` as one append-only row per (query execution × Business) carrying `job_id`, `business_id`, `page_index`, `position_in_page` and `discovered_at`, and §3.1 fixes `discovered_at` as *"WazLink's trusted server clock, sampled inside the ingestion transaction"* — never a provider clock. §4 guarantees the rows are append-only, survive merge, survive retry and are never overwritten on rediscovery. That is exactly the immutability a first-touch decision needs, and B9 **reads** it without writing anything.

A candidate failing any clause is simply not a candidate. It is never an error and never blocks recognition.

### 2.3 Why deriving is necessary, not merely convenient

B9 consumes zero events (`B9-D-A002`) and B3 holds no write path into `attribution_touchpoints`. If persisted touchpoints were the only candidate source, then **every** Track-A acquisition — the discovery → job → business → lead → deal chain the product exists to measure — could be attributed only if a human manually re-typed, per business, a fact B3 had already recorded. That is not a degradation; it is Track A not working. Deriving from `discovery_results` makes Track-A attribution automatic **without** inventing a background writer, a system actor, or an event subscription (`B9-D-A036`, `B9_ATTRIBUTION_MODEL.md` §2).

## 3. The provenance chain

At recognition time B9 walks **upward** from the recognition's own `source_ref` by on-demand read:

```
source_type='deal'      DEAL-* ──▶ LEAD-* ──▶ BUS-* ──▶ (discovery_results) ──▶ JOB-*
source_type='lead'                  LEAD-* ──▶ BUS-* ──▶ (discovery_results) ──▶ JOB-*
source_type='business'                         BUS-* ──▶ (discovery_results) ──▶ JOB-*
source_type='payment'   PAY-*   ──▶ (platform billing — rejected, B9-AF-007)
source_type='invoice'   INV-BILL-* ──▶ (platform billing — rejected, B9-AF-007)
```

**Every hop is optional.** A Deal with no Lead, a Lead with no Business, a Business with no `discovery_results` row each simply end the walk. The chain contributes the set of `subject` identifiers (`BUS-*`, `LEAD-*`) that touchpoints may be attached to, and the set of `BUS-*` whose `discovery_results` rows become derived candidates. It is a *read*: B9 writes nothing to B2/B3/B6 and holds no foreign key into them.

Discovery is never required. A Track-B Lead created by import has an empty upward chain beyond itself, no `discovery_results` rows, and still attributes correctly from its own recorded touchpoint — or reports as unattributed (`B9_DUAL_TRACK_COMPATIBILITY.md` §3).

**`DiscoverySource` is not a chain hop.** Frozen `BACKEND_PUBLIC_ID_REGISTRY.md` §B classifies `SRC-*` as a contract string, *"not an `EntityRef`"*, and frozen B3 keeps `DiscoveryJob.provider_source` a plain string in a bounded **global** catalogue. B9 honours both: the source is carried as the non-resolved `source_code` string, never walked to, never workspace-resolved, never an `EntityRef` (`B9-D-A037`, `B9_ATTRIBUTION_MODEL.md` §4).

## 4. The algorithm — fully deterministic

```
resolve_first_touch(event) -> attribution_snapshot | NONE

 1. subjects ← walk_provenance_chain(event.source_type, event.source_ref)   # §3, in-workspace reads
    if event.source_type ∈ {lead, business}: subjects also includes source_ref itself

 2. C_tp  ← SELECT * FROM attribution_touchpoints                    # §2.1
            WHERE workspace_id = event.workspace_id
              AND (subject_type, subject_public_id) ∈ subjects
              AND occurred_at <= event.recognized_at

 3. C_dp  ← SELECT * FROM discovery_results                          # §2.2, B3-owned, READ ONLY
            WHERE workspace_id = event.workspace_id
              AND business_id  ∈ subjects(business)
              AND discovered_at <= event.recognized_at
              AND filtered      = false          # §2.2a clause 5, B9-D-A044

 4. candidates ← C_tp ∪ C_dp                                         # one merged set

 5. if candidates is empty:
        return NONE                      # → unattributed. NOT an error.

 6. order candidates by:
        a. occurred_at ASC            # touchpoint.occurred_at | result.discovered_at
        b. candidate_kind ASC         # 'touchpoint'=0 before 'derived_provenance'=1
        c. within touchpoint:         position ASC, then created_at ASC
           within derived_provenance: page_index ASC, then position_in_page ASC
        d. public_id ASC              # ATT-* | RES-*, unique per workspace — always decides

 7. winner ← first row

 8. snapshot ← {
        model            = 'first_touch',
        allocation_bps   = 10000,
        candidate_kind   = winner.kind,
        touchpoint_id    = winner.id   if kind='touchpoint'      else NULL,
        derived_result_public_id = winner.public_id if kind='derived_provenance' else NULL,
        source_type      = 'discovery_result' if kind='derived_provenance' else winner.source_type,
        source_entity_type, source_public_id = the winner's registered entity reference,
        origin_kind      = 'discovery' if kind='derived_provenance' else winner.origin_kind,
        source_code      = winner.source_code | the winning result's job provider_source,
        acquired_at      = winner.occurred_at | winner.discovered_at,
        + the chain identifiers resolved in step 1
    }
 9. return snapshot
```

**Step 6 is a total order.** Key (d) alone settles every pair: `ATT-*` and `RES-*` are distinct registered prefixes and each is unique per workspace, so no two distinct candidates compare equal. Keys (a)-(c) are the meaningful ones; (d) exists so the comparator is *never* undefined. Key (b) breaks an exact `occurred_at` tie in favour of the explicitly recorded human fact over the inferred one — a deliberate choice, stated so it is not rediscovered as an accident. There is no randomness, no `LIMIT 1` without `ORDER BY`, and no dependence on physical row order. Re-running on unchanged data always returns the same winner. `AT-FT-1`, `AT-FT-2`, `AT-FT-10`, `AT-FT-11`.

### 4.1 Where the resolution runs, and what happens when it fails

Resolution runs **inside** the `RecordRevenueEvent` transaction, wrapped in an explicit savepoint:

```
BEGIN;
  INSERT INTO revenue_events (...);                    -- the financial fact, first
  SAVEPOINT attribution_resolution;
  SET LOCAL statement_timeout = <bounded>;             -- a slow B2/B3 cannot hold the write open
  <steps 1-9>
  INSERT INTO revenue_attributions (...);              -- 0 or 1 row
  RELEASE SAVEPOINT attribution_resolution;
  -- on ANY error or timeout raised above:
  --   ROLLBACK TO SAVEPOINT attribution_resolution;   -- transaction usable again
  --   open reconciliation case `attribution_unresolved`
  <outbox, audit>
COMMIT;
```

The savepoint is load-bearing and is stated because the naive reading is wrong: in PostgreSQL an uncaught error inside a transaction aborts it, so "the transaction still commits the recognition" is **only** true if the failing work sits inside a subtransaction that can be rolled back independently. `ROLLBACK TO SAVEPOINT` restores the transaction to a usable state and discards nothing but the attribution attempt. `B9_IDEMPOTENCY_CONCURRENCY.md` §6; `AT-FT-12`, `AT-CONC-15`.

**Resolution failure is never recognition failure.** The event commits with no attribution row and a case is opened. Revenue is never lost to an attribution problem (`B9-D-A013`).

## 5. Every edge case the brief names, answered

| Case | Deterministic outcome |
|---|---|
| **What is a qualifying touchpoint?** | §2.1, four clauses — and §2.2's four for a derived provenance candidate |
| **What timestamp participates?** | `occurred_at`, compared against the event's `recognized_at` |
| **Timestamps tie?** | **`candidate_kind`** (touchpoint before derived provenance), then the within-kind keys — `position`, `created_at` for a touchpoint; `page_index`, `position_in_page` for a derived candidate — then `public_id`. A total order (§4, **step 6**) |
| **Source missing?** | Every candidate's source is a registered workspace-scoped entity (`B9-D-A037`), so "unresolvable source" means the entity is gone; such a candidate is skipped. If nothing qualifies → **unattributed** |
| **Customer created manually?** | Its recorded touchpoint (`origin_kind='manual'`) wins; if none was recorded and no `discovery_results` row exists → **unattributed**. Recognition is unaffected either way |
| **Business rediscovered?** | B3 appends a **new** `discovery_results` row with a later `discovered_at` (`B3_ACQUISITION_PROVENANCE.md` §4: *"a new observation is a new row; nothing existing is touched"*). A later row cannot win a first-touch comparison against the original, and snapshots already taken are never revisited (`B9_ATTRIBUTION_MODEL.md` §8) |
| **Lead has immutable provenance?** | Honoured — the chain walk reads it; B9 never rewrites it |
| **Duplicate leads merged?** | The snapshot keeps the `lead_public_id` it captured. For *future* recognitions the chain walk follows the surviving Lead; the merged-away Lead's touchpoints remain attached to their original subject and remain candidates only for events whose chain still reaches them. B3 merge re-points `discovery_results.business_id` to the survivor (`B3-INV-7`), so derived candidates follow the survivor too — which is B3's own decided behaviour, not a B9 rule. No historical attribution moves. `AT-FT-8` |
| **Deal created long after acquisition?** | Irrelevant — `occurred_at ≤ recognized_at` is the only temporal test; there is no maximum look-back window (`B9-D-A018`) |
| **Revenue occurs months later?** | Same — the original touch still wins |
| **Acquisition source deleted/retired?** | Touchpoint and `discovery_results` rows are both append-only and survive. The snapshot stores the winning entity id plus the `source_code` string; the report renders it as retired. Revenue stays attributed. `AT-FT-9` |
| **No touchpoint at all?** | If a qualifying `discovery_results` row exists, it wins as a derived candidate (§2.2). If neither exists → **NONE** → unattributed, revenue fully recognized. `AT-FT-10` |
| **Business observed but filtered out?** | The row is **not** a candidate (§2.2a, `B9-D-A044`) — it is B3 audit evidence, not a delivered acquisition result. If no other candidate qualifies the event is **unattributed**; the recognized amount is unchanged. `AT-FT-17`, `AT-FT-18` **(NC)** |
| **Touch recorded after recognition?** | Excluded by §2.1 clause 3 (and §2.2 clause 3 for derived candidates). It never retro-attributes an existing event; it may win for a *later* recognition |

## 6. Snapshot-at-recognition — resolved (Class A, `B9-D-A014`)

Attribution is resolved **once**, inside the `RecordRevenueEvent` transaction, and written to `revenue_attributions` as an immutable snapshot.

The alternative — recomputing first-touch at read time — was considered and **rejected**: a recomputed attribution silently changes historical reports whenever a Lead is merged, a Business rediscovered, or a touchpoint backfilled. Frozen `BACKEND_ANALYTICS_SEMANTICS.md` requires *deterministic* attribution; a figure that changes under you is not deterministic. `AT-ATTR-9`…`AT-ATTR-14` are the regression controls.

The resolution runs in the same transaction as the recognition insert, so a `RevenueEvent` and its attribution are always mutually consistent. Crucially, **resolution failure is not recognition failure**: if the chain walk errors or times out, the transaction still commits the recognition with **no** attribution row, and a reconciliation case `attribution_unresolved` is opened. Revenue is never lost to an attribution problem (`B9-D-A013`).

## 7. No back-fill, no retro-attribution in Phase 1

There is no command to attribute an already-recognized event, and no `AssignRevenueAttribution` command (`B9_COMMAND_EVENT_CATALOG.md` §1 adjudication). Such a command would be a way to change a historical financial report after the fact, which is exactly what §6 exists to prevent. Correcting a genuinely mis-attributed event uses the same compensating pattern as every other correction: reverse and re-recognize (`B9_REVERSAL_MODEL.md` §7). `B9-D-A024`; deferred alternative `B9-D-B005`.

## 8. Negative controls

`AT-FT-3` **(NC)**: an implementation selecting the winner with `LIMIT 1` and no total-order `ORDER BY` — fails; non-deterministic under equal timestamps.
`AT-FT-4` **(NC)**: an implementation allowing a touchpoint with `occurred_at > recognized_at` to win — fails.
`AT-FT-5` **(NC)**: an implementation recomputing attribution at read time — fails.
`AT-FT-6` **(NC)**: an implementation rejecting a recognition because no touchpoint qualified — fails.
`AT-FT-7` **(NC)**: an implementation crossing a workspace boundary while walking the provenance chain or reading `discovery_results` — fails.
`AT-FT-10`: a recognition whose chain has **no** touchpoint but a qualifying `discovery_results` row attributes to that row, with `touchpoint_id IS NULL` and `candidate_kind='derived_provenance'`.
`AT-FT-11`: a persisted touchpoint and a derived candidate sharing an exact `occurred_at` — the touchpoint wins (step 6 key b), deterministically.
`AT-FT-12`: a provenance read raising a DB error inside the recognition transaction — `ROLLBACK TO SAVEPOINT` leaves the transaction usable, the event commits unattributed, `attribution_unresolved` opens.
`AT-FT-13` **(NC)**: an implementation writing to `discovery_results` or any B3 table during resolution — fails; the read is strictly read-only.
`AT-FT-14` **(NC)**: an implementation treating `SRC-*` as a resolvable workspace-scoped `EntityRef` — fails; it is a contract string (§3).
`AT-FT-17`: a Business with one `filtered = true` row and one later `filtered = false` row attributes to the **unfiltered** observation, not the earlier filtered one.
`AT-FT-18` **(NC)**: an implementation admitting a `filtered = true` `discovery_results` row as a first-touch candidate — fails (§2.2a, `B9-D-A044`).

# B9 — Attribution Model

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.

## 1. The separation that defines this document — resolved (Class A, `B9-D-A013`)

**Recognition and attribution are independent.** Recognition answers *did the workspace earn money*. Attribution answers *which acquisition source earned it*. The second question failing must never change the answer to the first.

```
Recognized Revenue  =  Attributed Revenue  +  Unattributed Revenue
```

This identity is exact, per workspace, per currency, per period, at gross and at net. It is the single most important property of this document, and it is what the older `data.js` fixture layer got wrong (`FB-B9-005`/`006`/`007`) and the newer `analytics-engine.js` layer got right (`FB-B9-021`/`022`/`023`).

`ATTRIBUTION_RECOGNITION_COUPLING_LEAKS = 0` means precisely: no code path lets an attribution outcome add to, subtract from, or suppress a recognized amount.

## 2. Two registers, two jobs

| Register | Table | Owner | Written by | Answers |
|---|---|---|---|---|
| **Touchpoints** | `attribution_touchpoints` | **B9** | `RecordTouchpoint` (frozen command), a **human** with `attribution.manage` | "an acquisition touch was explicitly recorded, here, at this time" |
| **Discovery provenance** | `discovery_results` | **B3 (frozen)** | B3's ingestion — **never B9** | "this Business was observed by this job at this instant". Only rows in B3's **visible** result set (`filtered = false`) are candidates (`B9-D-A044`, `B9_FIRST_TOUCH_MODEL.md` §2.2a) |
| **Attribution snapshot** | `revenue_attributions` | **B9** | `RecordRevenueEvent`, in the same transaction | "*this* recognition was earned by *that* acquisition fact" |

The middle row is the one that makes Track A work. B9 does **not** copy B3's provenance into touchpoints, does not subscribe to a discovery event, and does not run a background writer; it **reads** B3's existing append-only rows at recognition time and lets them compete as first-touch candidates (`B9_FIRST_TOUCH_MODEL.md` §2.2, `B9-D-A035`).

**There is no system actor and no "provenance resolver" component.** An earlier draft named one as an alternative writer of `RecordTouchpoint`, defined it nowhere, and left `recorded_by_membership_id` nullable to accommodate it. `B9-D-A036` deletes the idea: `RecordTouchpoint` is human-only, `recorded_by_membership_id` is NOT NULL, and automatic Track-A attribution comes from *reading* B3 rather than from any B9 writer. This also keeps `B9_RBAC_TENANCY.md` §5's "no system actor, no service account" statement true without exception.

A touchpoint can exist with no revenue. A recognition can exist with no attribution. Neither is an error.

## 3. AttributionTouchpoint

The frozen `AttributionTouchpoint` DTO is `additionalProperties: false` with five required fields: `public_id`, `source_type`, `source_ref`, `occurred_at`, `position`.

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal |
| `public_id` | `ATT-*` | immutable; **frozen** registry §A — no amendment is needed or claimed |
| `workspace_id` | FK → workspaces | tenancy root |
| `subject_type`, `subject_public_id` | text | **what was acquired** — the `BUS-*` or `LEAD-*` the touch belongs to. Storage-only; not in the frozen DTO |
| `source_type` | text | **what did the acquiring** — closed set §4; always a registered entity type |
| `source_entity_type`, `source_public_id` | text | assembled into the DTO's `source_ref`; always a registered §A workspace-scoped `public_id` |
| `origin_kind` | text | the acquisition **channel** dimension — closed set §4a. Storage-only; not in the frozen DTO |
| `source_code` | text, nullable | a bounded **contract string** (e.g. a DiscoverySource code such as `SRC-1004`). Storage-only; never an `EntityRef`, never workspace-resolved (§4b) |
| `occurred_at` | timestamptz | when the touch happened (UTC) |
| `position` | integer ≥ 1 | ordinal within the subject's touch sequence; `1` is the first touch |
| `channel` | text, nullable | display dimension |
| `campaign` | text, nullable | display dimension |
| `recorded_by_membership_id` | FK → memberships, **NOT NULL** | the human who recorded the touch (`B9-D-A036`) |
| `idempotency_key` | text | `UNIQUE (workspace_id, idempotency_key)` |
| `created_at` | timestamptz | |

Touchpoints are **immutable and append-only**. `UNIQUE (workspace_id, subject_type, subject_public_id, position)` keeps the ordinal sequence single-valued per subject.

The `subject_*` pair is essential and is why storage exceeds the DTO: without it a touchpoint would be an event floating free of the thing it acquired, and first-touch could not be computed. The frozen DTO omits it because the API always returns touchpoints *in the context of* a subject or a report.

## 4. Source identity — entity reference, channel, and code (Class A, `B9-D-A037`)

The frozen `AttributionTouchpoint` DTO types `source_ref` as an `EntityRef{public_id, entity_type}`. Frozen `BACKEND_PUBLIC_ID_REGISTRY.md` requires every `public_id` to carry **a registered prefix**, and its §B explicitly excludes `SRC-*`: *"`DiscoveryJob.provider_source` is a plain contract string, **not an `EntityRef`**."* Frozen B3 restated and kept that: *"`SRC-` stays a section B contract string"* (`B3_CONTROLLED_AMENDMENTS.md`), and its `discovery_sources` catalogue is **global**, not workspace-scoped.

An earlier draft put `SRC-*` — and free opaque tokens for `import`/`api`/`form`/`referral`/`other` — into that `EntityRef`, and then required them to "resolve in-workspace". That contradicted the registry, contradicted B3, and was unsatisfiable for a global catalogue. B9 now separates the three things that draft conflated:

### 4a. `source_type` + `source_ref` — always a registered entity

| `source_type` | `source_ref` → | Registry | Track |
|---|---|---|---|
| `discovery_job` | `JOB-*` | §A, workspace-scoped | A |
| `discovery_result` | `RES-*` | §A, workspace-scoped | A (derived candidates) |
| `lead` | `LEAD-*` | §A, workspace-scoped | B |
| `business` | `BUS-*` | §A, workspace-scoped | either |

Every value resolves in-workspace, so `B9_FIRST_TOUCH_MODEL.md` §2.1 clause 4 is always satisfiable. `FROZEN_PUBLIC_ID_CONFLICTS = 0`: B9 registers no new prefix for attribution and reclassifies none.

### 4b. `origin_kind` — the acquisition channel

The reporting dimension the old `source_type` set was really trying to express. Closed at seven values, storage-only and carried on B9's own additive DTOs (never added to a frozen one):

| `origin_kind` | Meaning | Track |
|---|---|---|
| `discovery` | acquired through a Discovery job | A |
| `import` | arrived in a bulk import | B |
| `manual` | entered by a human | B |
| `api` | created through the API | B |
| `form` | arrived through a web form | B |
| `referral` | arrived by referral | B |
| `other` | known only as "not one of the above" | either |

Tracks A and B are both first-class. `other` is the deliberate degradation target that keeps Track-B revenue attributable without inventing Track-B entities (`B9_DUAL_TRACK_COMPATIBILITY.md` §4).

### 4c. `source_code` — a contract string, never an identifier

The DiscoverySource is carried as `source_code`: a bounded contract string, stored, reported and grouped on, and **never** resolved, never workspace-scoped, never an `EntityRef`. This is precisely how frozen B3 carries `DiscoveryJob.provider_source`, and it is the whole reason no registry amendment is needed. Frozen registry §B's own note on `CMP-` — *"attribution source identity is carried by `AttributionTouchpoint.source_ref`"* — is honoured: identity is the `EntityRef`; the code is a label beside it.

`AT-ATTR-16` **(NC)** and `AT-FT-14` **(NC)** prove `SRC-*` is never treated as an `EntityRef`.

## 5. RevenueAttribution — the immutable snapshot

| Column | Type | Notes |
|---|---|---|
| `id` | UUIDv7 | internal |
| `revenue_event_id` | FK → `revenue_events` | **`UNIQUE`** — at most one attribution per event (first-touch has one winner) |
| `workspace_id` | FK → workspaces | must equal the event's workspace |
| `candidate_kind` | enum(`touchpoint`,`derived_provenance`) | which resolution source won (`B9_FIRST_TOUCH_MODEL.md` §4) |
| `touchpoint_id` | FK → `attribution_touchpoints`, nullable | the winning `ATT-*`; **NULL iff** `candidate_kind='derived_provenance'` |
| `derived_result_public_id` | text, nullable | the winning `RES-*` `DiscoveryResult`; **NOT NULL iff** `candidate_kind='derived_provenance'` |
| `origin_kind` | enum (§4b) | snapshot of the winning candidate's channel |
| `source_code` | text, nullable | snapshot of the winning candidate's contract string (§4c) |
| `model` | enum(`first_touch`) | closed at one value in Phase 1 — the column exists because `B9-D-B002` will add values, and a later phase must be able to tell old rows apart |
| `allocation_bps` | integer | **always 10000** in Phase 1 (100.00%), `CHECK (allocation_bps = 10000)` |
| `source_type` | text | snapshot of the winning source's type |
| `source_entity_type`, `source_public_id` | text | snapshot of the winning source reference |
| `discovery_job_public_id` | text, nullable | snapshot — Track A only |
| `business_public_id` | text, nullable | snapshot |
| `lead_public_id` | text, nullable | snapshot |
| `deal_public_id` | text, nullable | snapshot |
| `acquired_at` | timestamptz | snapshot of the winning touch's `occurred_at` |
| `resolved_at` | timestamptz | when the snapshot was taken (= the event's `created_at`) |
| `created_at` | timestamptz | |

No `updated_at`, no `deleted_at`. Written once, in the recognition transaction, never touched again. A `CHECK` enforces that exactly one of `touchpoint_id`/`derived_result_public_id` is present and that it agrees with `candidate_kind` (`B9_STORAGE_MODEL.md` §4) — expressible on a single row, so it is a real constraint rather than an aspiration.

**Why basis points, not a percentage or a decimal.** `allocation_bps` is an integer out of 10000. Phase 1 always writes 10000, so no rounding can occur; and when `B9-D-B002` adds multi-touch, integer basis points summing to exactly 10000 is a constraint a database can actually check, whereas summing decimal percentages invites the 99.99%/100.01% failure the task names. `B9-D-A016`.

## 6. Reversal propagates automatically

There is no reversal-attribution row, no compensating allocation, and nothing to keep in step. Because Phase-1 allocation is always exactly 100% to one winner:

```
gross_attributed(event) = gross_recognized(event) − gross_reversed(event)   if a snapshot exists
                        = 0                                                 otherwise
net_attributed(event)   = net_recognized(event)   − net_reversed(event)     if a snapshot exists
                        = 0                                                 otherwise
```

Attribution is **derived**, not snapshotted-as-an-amount and not separately compensated (`B9-D-A015`). The canonical scenario therefore cannot drift:

| Step | net recognized | net attributed to Source A | net unattributed |
|---|---:|---:|---:|
| Recognize 1,000 SAR, attributed to A | 1,000 | 1,000 | 0 |
| Reverse 300 SAR | **700** | **700** | 0 |

`recognized = 700, attributed = 1,000` is structurally unreachable: the two numbers are computed from the same two columns. `AT-ATTR-7`, `AT-ATTR-8`.

## 7. Unattributed revenue

A recognized event with no `revenue_attributions` row is **unattributed**. It is fully recognized, fully counted, fully reportable, and appears in the frozen `AttributionReport.unattributed_amount` field.

```
gross_unattributed(W,C,period) = gross_recognized − gross_attributed
```

Causes, all legitimate, none an error:

| Cause | Track |
|---|---|
| Neither a qualifying touchpoint **nor** a qualifying (`filtered = false`) `discovery_results` row exists | B |
| Customer created manually or imported with no touch recorded and no discovery history | B |
| Every candidate's `occurred_at`/`discovered_at` is later than `recognized_at` | either |
| Revenue recognized against a `business`/`lead` with no acquisition record of any kind | either |
| Attribution resolution failed or timed out (`B9_FIRST_TOUCH_MODEL.md` §4.1) | either |

"Unattributed" now means *both* candidate sources came back empty — a genuinely stronger statement than the earlier draft's, which meant only that no touchpoint row existed.

`UNATTRIBUTED_REVENUE_SUPPORTED = YES`. `AT-UNATT-1`…`AT-UNATT-6`.

## 8. What never rewrites an existing attribution

| Later change | Effect on an existing snapshot |
|---|---|
| Lead edited, renamed, re-owned | **none** |
| Lead merged into another Lead | **none** — the snapshot keeps the original `lead_public_id` |
| Deal edited, reopened, re-closed, re-valued | **none** |
| Business rediscovered by a later DiscoveryJob | **none** — B3 appends a new `discovery_results` row, but a *later* observation cannot win a *first*-touch decision already made |
| DiscoverySource renamed | **none** to the snapshot; `source_code` is unchanged and the display name is resolved live for presentation only |
| DiscoverySource deleted/retired | **none** — the snapshot keeps `source_code`; the report labels it as retired |
| A touchpoint recorded *after* the recognition | **none** (`B9_FIRST_TOUCH_MODEL.md` §5) |

The mechanism is simply that nothing writes the table after insert. `AT-ATTR-9`…`AT-ATTR-14`.

## 9. Immutable vs display vs recalculable dimensions

| Dimension | Kind | Behavior |
|---|---|---|
| `candidate_kind`, `source_type`, `source_entity_type`, `source_public_id`, `origin_kind`, `source_code`, `discovery_job_public_id`, `business_public_id`, `lead_public_id`, `deal_public_id`, `acquired_at`, `model`, `allocation_bps` | **immutable** | frozen at recognition; never re-derived |
| Source display name (resolved from `source_code` against B3's global catalogue), job keyword/location, lead name, deal title, **Deal owner** | **display** | resolved live at read time; a rename or a reassignment changes the label, never the grouping and never an amount (`B9-D-A042`) |
| `gross_attributed`, `net_attributed`, `gross_unattributed`, revenue-by-source totals | **recalculable** | always folded from the registers; never stored |

This split is what makes "a renamed source does not rewrite history" and "a renamed source shows its new name" both true at once.

## 10. Over-attribution

`FB-B9-026`/`027` show the frozen frontend rendering an "over-attributed" figure and flagging it as a danger state. In B9's Phase-1 model over-attribution is **structurally impossible** — one snapshot per event, `UNIQUE (revenue_event_id)`, `allocation_bps = 10000` — so the selector `gross_over_attributed` exists, is defined as `max(0, attributed − recognized)`, and must always return zero. It is retained precisely because it must be zero: a non-zero value is a corruption alarm, surfaced as the reconciliation case `over_attribution` (`B9_RECONCILIATION_MODEL.md` §3). `AT-ATTR-15` **(NC)**.

## 11. Negative controls

`AT-ATTR-1` **(NC)**: an implementation refusing, deleting, or suppressing a recognition because attribution could not be resolved — fails.
`AT-ATTR-2` **(NC)**: an implementation computing recognized revenue by summing attributed rows (the `FB-B9-006` defect) — fails.
`AT-ATTR-3` **(NC)**: two `revenue_attributions` rows for one event — rejected by `UNIQUE (revenue_event_id)`.
`AT-ATTR-4` **(NC)**: an `allocation_bps` other than 10000 in Phase 1 — rejected by `CHECK`.
`AT-ATTR-5` **(NC)**: an attribution whose workspace differs from its event's — rejected `B9-AF-021`.
`AT-ATTR-6` **(NC)**: an implementation mutating `revenue_events.gross`/`net` as a result of any attribution operation — fails; frozen ADR-008: *"Attribution never changes RevenueEvent amount."*
`AT-ATTR-16` **(NC)**: `SRC-*` stored in `source_public_id`, or any attempt to resolve it as a workspace-scoped `EntityRef` — fails; it belongs in `source_code` (§4c).
`AT-ATTR-17` **(NC)**: a `RecordTouchpoint` accepted with a null/system `recorded_by_membership_id` — fails; touchpoints are human-recorded (`B9-D-A036`).
`AT-ATTR-18` **(NC)**: a `revenue_attributions` row where `candidate_kind` disagrees with which of `touchpoint_id`/`derived_result_public_id` is populated — rejected by `CHECK`.
`AT-ATTR-19` **(NC)**: any B9 code path writing `discovery_results` or any other B3 table during resolution — fails; the derived-candidate read is strictly read-only.
`AT-ATTR-21` **(NC)**: an implementation storing a Deal owner on `revenue_attributions`, or otherwise snapshotting ownership into financial truth — fails; `owner_ref` is display-only and resolved live (`B9-D-A042`, `B9_API_DTO_CONTRACTS.md` §2a).

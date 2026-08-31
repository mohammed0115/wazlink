# B4 — Domain Ownership

> **B4 status:** Target design only. Defines exactly what B4 owns, in the minimum defensible model — not every entity the brief's candidate list names.

## 1. What B4 is, precisely

> Converts normalized Business/Discovery evidence into structured sales intelligence — a score, a confidence, a set of evidence-backed signals, and a recommended next action — favoring deterministic rules and versioned scoring logic over opaque free-form judgement.

B4 is **not** a generic AI service. It has one subject type (`Business`, `B4_INTELLIGENCE_SUBJECT_MODEL.md`), one execution unit (`IntelligenceRun`), and a closed set of output shapes. It does not summarize conversations, does not write replies, does not manage tasks, and does not execute anything in another domain (`B4_DOWNSTREAM_HANDOFFS.md`).

## 2. The minimum entity model

Five persisted concepts, no more:

| Entity | What it is | Persisted? | Public ID? | Owner |
|---|---|---|---|---|
| `IntelligenceRun` | one execution attempt of analysis against one input snapshot | **yes**, immutable once terminal | `ANL-*` (promoted from registry §B — `B4_DATA_MODEL.md` §5) | B4 |
| `Signal` | one evidence-backed observation, deterministic or AI-extracted | **yes**, embedded rows scoped to a run | no (embedded, workspace-scoped `id` only — registry §B, unchanged) | B4 |
| `Evidence` | the source/provenance backing one Signal, score component, or recommendation claim | **yes**, embedded within Signal/Recommendation rows, never a standalone table | no | B4 |
| `Recommendation` | one structured next-action suggestion produced by a run | **yes**, embedded rows scoped to a run | no | B4 |
| `IntelligenceUsageRecord` | technical AI-cost telemetry for one provider call | **yes** (`ai_usage_records`, frozen B0 name kept) | no | B4 |

Two further concepts are **derived, never stored**:

| Concept | Why it is not a table |
|---|---|
| **Score** (`overall_priority_score` + components) | computed once at run completion and frozen onto the `IntelligenceRun` row itself — it is a *result field* of the run, not a separate aggregate with its own lifecycle |
| **Confidence** | same — a result field of the run, not separately versioned or queried |

The brief's candidate list also names `Score`, `ScoreComponent`, `Confidence`, and `OpportunitySignal`/`RiskSignal`/`AIAnalysisArtifact` as possible separate aggregates. None earns independent existence: scores and confidence are fields on `IntelligenceRun` (§ above); opportunity/risk signals are `Signal` rows distinguished by `category` (`B4_SIGNAL_TAXONOMY.md`), not separate types; and "AI analysis artifact" is exactly what `IntelligenceRun` plus its embedded `Signal`/`Recommendation` rows already is — naming a sixth concept for the same data would be gratuitous drift, the same discipline B3 applied when it refused a sixth job state.

## 3. What each entity is not

| Entity | Explicit non-ownership |
|---|---|
| `IntelligenceRun` | does not own Business identity, category, address, phone, website, rating, or any other observed fact — those are B3's (`businesses` table). It only *references* them via `input_snapshot` (`B4_INPUT_SNAPSHOT_MODEL.md`) |
| `IntelligenceRun` | does not own Lead status, priority, owner, or any CRM state — those are B2's |
| `Signal` | is not a CRM timeline entry, not an audit row, and never becomes one — B4 is not a member of B2's `{messaging, pipeline}` timeline-source closed set, mirroring B3's own exclusion (`B3-INV-14`) |
| `Recommendation` | is never itself an action — it is read by an actor or a future domain (B5/B6/B7) and *may* motivate one, but `RequestBusinessIntelligence`/`ReanalyzeBusinessIntelligence` write no CRM, messaging, pipeline, or revenue row (`B4_DOWNSTREAM_HANDOFFS.md`) |

## 4. Per-entity ownership table

| Property | `IntelligenceRun` |
|---|---|
| Owner domain | Intelligence (B4) |
| Identity | `ANL-*` public ID, internal UUIDv7 |
| Workspace scoping | `workspace_id` required, direct FK |
| Lifecycle | `B4_INTELLIGENCE_RUN_STATE_MACHINE.md` — 5 states |
| Mutability | append-only until terminal; terminal rows are immutable (score, confidence, signals, recommendations frozen at completion) |
| Source of truth | for score/confidence/signals/recommendations — yes, authoritative. For the Business facts it analyzed — no, those remain B3's, referenced only |
| Relationship to Business | `business_id` FK → `businesses.id`, `ON DELETE RESTRICT` (mirrors B2's `leads.business_id` pattern exactly) |
| Relationship to Lead | none, direct. Resolved only via `lead.business_id` at read time (`B4_INTELLIGENCE_SUBJECT_MODEL.md` §5) |
| Relationship to Discovery Job | indirect, through the Business's own provenance (`businesses.provenance`) — B4 does not store a second `job_id` reference |
| Persisted vs derived | persisted |
| Externally visible | yes, via `B4_API_DTO_CONTRACTS.md` |
| Authoritative | yes, for its own fields |

| Property | `Signal` / `Recommendation` |
|---|---|
| Owner domain | Intelligence (B4) |
| Identity | workspace-scoped `id` (e.g. `sig_01J...`), embedded — not a registry public ID (§2 registry table) |
| Workspace scoping | inherited from the owning `IntelligenceRun` |
| Lifecycle | written once, at run completion; never updated in place |
| Mutability | immutable |
| Relationship to Business | indirect, through the owning run |
| Persisted vs derived | persisted (embedded JSONB array on the run row — `B4_DATA_MODEL.md` §3) |
| Externally visible | yes |
| Authoritative | yes |

| Property | `IntelligenceUsageRecord` |
|---|---|
| Owner domain | Intelligence (B4) |
| Identity | internal only, no public ID |
| Workspace scoping | required, direct |
| Lifecycle | one row per provider call, written by the adapter boundary |
| Mutability | immutable |
| Persisted vs derived | persisted |
| Externally visible | **no** — operator/telemetry surface only (`B4_OBSERVABILITY_RECONCILIATION.md`) |
| Authoritative | for technical cost telemetry only; **never** billing truth (`B4_COST_RATE_LIMIT_MODEL.md` §6) |

## 5. Domain boundary summary

```
B3 Discovery                  │  B4 Intelligence                │  B2 CRM
───────────────────────────── ┼───────────────────────────────── ┼ ────────────────────
acquires a Business            │  analyzes a Business             │  converts a Business to Lead
normalizes fields               │  IntelligenceRun (5 states)      │  owns Lead/status/priority/owner
records provenance              │  Signal, Evidence, Recommendation│  reads intelligence live (never copies)
emits BusinessDiscovered        │  emits BusinessIntelligenceCompleted│  Lead360.intelligence = read-through
                                 │  never writes businesses/leads   │
```

`B4-D-A030`: B4 never writes to a B3 table (`businesses`, `business_identities`, `discovery_results`) or a B2 table (`leads`, and friends). Every B4-owned row lives in a B4 table keyed by `BUS-*`, exactly as `B3_B4_HANDOFF_CONTRACT.md` §5 asks.

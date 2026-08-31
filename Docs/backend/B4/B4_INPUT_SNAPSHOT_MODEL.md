# B4 — Input Snapshot Model

> **B4 status:** Target design only. An `IntelligenceRun` sees a stable, versioned copy of the world, never mutable live state.

## 1. Why a snapshot, not a live read

A run can take seconds to minutes end to end (deterministic signal extraction, then a provider round trip, then structured-output validation). If a Business's `phone` or `category` changed mid-run, a live read would let one run silently blend two different moments of truth — undetectable, unauditable, and impossible to reproduce. `B4-D-A005` fixes this:

> **`B4-D-A005`: Every `IntelligenceRun` captures an immutable `input_snapshot` at admission time, before any deterministic extraction or provider call runs. Nothing downstream ever re-reads live Business state mid-run.**

## 2. What goes in the snapshot — and what does not

B4 does **not** send everything to a provider by default (brief §8). The snapshot has two layers: a **full local copy** (used for deterministic signal extraction) and a **provider payload** (a minimized subset — `B4_SECURITY_PRIVACY_SAFETY.md` §2 owns exactly what crosses the provider boundary).

| Local snapshot field | Source | Sent to provider? |
|---|---|---|
| `business.public_id`, `name`, `category`, `address` | B3 `businesses` (frozen fields) | name/category/city only, never `public_id` |
| `business.phone`, `website`, `coordinates` | B3 `businesses` | presence-only booleans, never raw values (`B4_SECURITY_PRIVACY_SAFETY.md` §2) |
| Discovery-observed rating, review count, additional normalized fields | B3 `discovery_results` (per-observation) — most recent observation for this Business | numeric values only |
| `business.provenance` (job/provider/first-last-observed) | B3 `businesses.provenance` | **no** — provenance is B4's own audit concern, not the provider's input |
| `business.version` at snapshot time | B3 `businesses.version` | **no** — internal freshness bookkeeping only |
| `data_quality.{level, missing[], invalid[]}` | B3 `businesses`/`discovery_results` | field-name lists only (e.g. "website: missing"), never raw values |

Nothing else. No workspace metadata, no other Leads, no Conversations, no billing data, no auth tokens ever enters the snapshot (`B4_SECURITY_PRIVACY_SAFETY.md` §1 states this as a hard boundary, not a preference).

## 3. Versioning identifiers

Four distinct identifiers travel with every run, and none is optional:

| Identifier | What it captures | Changes when |
|---|---|---|
| `input_snapshot_version` | a monotonically increasing per-Business counter for *analyzable input states*, incremented each time a snapshot is taken with a materially different fingerprint (§4) than the last | a material Business field changes |
| `input_hash` | a deterministic hash of the material-input fingerprint (§4) | the fingerprinted fields change |
| `scoring_model_version` | the version of `B4_SCORING_MODEL.md`'s weight/threshold table in effect | a scoring model change ships |
| `signal_taxonomy_version` | the version of `B4_SIGNAL_TAXONOMY.md`'s signal-code registry in effect | a signal code is added/retired |

`prompt_policy_version` and `structured_output_schema_version` are **provider-boundary** metadata, not input-snapshot metadata — they live on the run's provider-call record (`B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §6), because they describe *how the run asked*, not *what it saw*.

## 4. The material-input fingerprint

Not every Business field is fingerprint-material. A `last_observed_at` bump with no field change must not force a needless re-analysis; a `category` change must.

```
material_fingerprint = hash(
  business.name_normalized ‖ business.category ‖ business.address_normalized ‖
  business.phone_present ‖ business.website_present ‖ business.coordinates ‖
  discovery_result.rating ‖ discovery_result.review_count ‖
  discovery_result.data_quality.level
)
```

`business.version` incrementing is a *candidate* trigger for taking a new snapshot (`B4_FRESHNESS_STALENESS.md` §2); the fingerprint decides whether that new snapshot is actually **material** — i.e., whether it warrants a new `input_snapshot_version`, or is folded into the existing one because nothing in the fingerprinted field set moved.

## 5. Same input, changed input, stale intelligence

| Scenario | `input_hash` | Behavior |
|---|---|---|
| Re-analysis requested, Business unchanged since last completed run | identical | reused, not re-admitted — no new run, no provider spend (`B4-D-A020`, `B4_COST_RATE_LIMIT_MODEL.md` §4) |
| Re-analysis requested, Business changed materially | different | new snapshot, new `input_snapshot_version`, admitted as a fresh run |
| Current run's snapshot no longer matches live Business state | different from current `businesses.version`'s fingerprint | current intelligence is **stale**, not wrong — visible with a marker, per `B4_FRESHNESS_STALENESS.md` §3 |

## 6. What a rerun determines, precisely

```
IF new_fingerprint == current_run.input_hash:
    → REUSE current_run (no new run created)
ELSE:
    → new IntelligenceRun, new input_snapshot_version = current + 1
```

This is the entire reuse/rerun decision procedure. It requires no judgement call and no provider call to evaluate — it is a hash comparison against already-stored data, evaluated inside the admission sequence (`B4_COST_RATE_LIMIT_MODEL.md` §2 step 5) before any cost is committed.

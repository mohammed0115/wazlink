# B4 — Freshness and Staleness

> **B4 status:** Target design only. Staleness is computed, never stored (`B4_INTELLIGENCE_RUN_STATE_MACHINE.md` §1).

## 1. The dimensions

> **`B4-D-A023`: a current `IntelligenceRun` is stale if any of the following holds, evaluated at read time:**

| Dimension | Trigger |
|---|---|
| Business input changed | current Business `material_fingerprint` (`B4_INPUT_SNAPSHOT_MODEL.md` §4) ≠ the current run's `input_hash` |
| Age threshold elapsed | `now() - completed_at > freshness_age_threshold` (Class B, `B4-D-B003`) |
| Score model changed | current run's `scoring_model_version` ≠ the latest published `scoring_model_version` |
| Critical evidence expired | any evidence item backing a score-affecting signal has `freshness = expired` (`B4_EVIDENCE_MODEL.md` §2) |
| Provider/source data refreshed | Business `last_observed_at` advanced since the run's snapshot, **even if** the fingerprint didn't change materially — surfaced as a softer "re-observed, unchanged" staleness reason distinct from "materially changed" |

```
is_stale(run) =
    run.input_hash != current_business.material_fingerprint
    OR (now() - run.completed_at) > freshness_age_threshold
    OR run.scoring_model_version != latest_scoring_model_version
    OR any(evidence.freshness == "expired" for evidence in run.score_affecting_evidence)
```

## 2. Why computed, not stored

A stored flag needs a sweep to stay accurate, and the sweep's lag window would let a stale run be momentarily reported as fresh (or vice versa) — an inconsistency a computed check cannot have, since it is evaluated fresh on every read against the actual current state. The only cost is a handful of comparisons per read, which is cheap relative to the correctness this buys.

## 3. What staleness changes

| Surface | Behavior |
|---|---|
| `GET /businesses/{id}/intelligence` | returns the current run in full, **with `stale: true` and `stale_reasons[]`** — never withheld |
| Filters/sort (`opportunityTier`, `minScore`, `highOpportunity` — FB-22) | stale runs remain included; hiding them would silently shrink a workspace's result set with no explanation |
| Priority-sort / "highOpportunity" dashboard aggregation (FB-27) | stale runs are **excluded** from the "top opportunity" ranking used by the future Analytics/dashboard consumer — ranking on data known to be outdated would misrepresent freshness as confidence |
| Automation-eligible signals (future B7 consumption, `B4_DOWNSTREAM_HANDOFFS.md` §3) | stale runs are **excluded** — an automation trigger firing on outdated evidence is a correctness risk the recommendation-only boundary already exists to avoid |
| AI presentation artifacts | shown with the same `stale: true` marker as their owning run (`B4_RECOMMENDATION_MODEL.md` §5) |

This is the explicit decision the brief's §25 requires: staleness is *visible with a marker* for direct inspection, but *excluded from ranking/automation trust surfaces* — never silently hidden, never silently trusted.

## 4. When a rerun is worth suggesting

`GET /businesses/{id}/intelligence` includes `rerun_suggested: boolean`, `true` exactly when `is_stale(run)` is true **and** the Business's evidence has plausibly improved (i.e., `last_observed_at` advanced, or `data_quality.level` improved since the snapshot) — distinguishing "outdated, and there's new evidence worth seeing" from "outdated, and nothing has actually changed" (age-only staleness with no new observation gains nothing from an immediate rerun).

## 5. No automatic re-analysis in Phase 1

> **`B4-D-C001`: staleness never, by itself, admits a new `IntelligenceRun`.** Every admission is actor-triggered (`RequestBusinessIntelligence` / `ReanalyzeBusinessIntelligence`) or the thin `AnalyzeLead` alias — never a background job reacting to a staleness computation.

This closes the "automatic-trigger storm" attack (brief §7, §26) at the root: there is no automatic trigger to storm. `B4-D-C012` (Class C, `B4_DECISION_REGISTER.md`) records automatic/eager re-analysis as an explicit future option, contingent on B7 Automation existing to govern it responsibly, and is **not** part of this phase's target.

## 6. Rediscovery integration — consuming B3 without a circular dependency

B3 emits `BusinessRediscovered` (already defined, frozen: `B3_COMMAND_EVENT_CATALOG.md`) whenever a later Discovery job re-observes an already-known Business. B4 is a **consumer only**:

```
ON BusinessRediscovered { business_public_id, job_public_id, discovered_at, provider }:
    -- no run is admitted
    -- no write to any B4 table beyond what §1's read-time computation already covers
    -- the event's only effect is implicit: business.version has already advanced (B3's own
       write), so the NEXT read of GET /businesses/{id}/intelligence will compute is_stale=true
       and rerun_suggested per §4, purely as a side effect of B3's own version bump.
```

B4 does not even need to *subscribe* to `BusinessRediscovered` to get this behavior — §1's freshness computation reads `businesses.version`/fingerprint directly at request time, so B3's event is informative to a human observer (`B4_OBSERVABILITY_RECONCILIATION.md`) but not load-bearing to B4's own correctness. This is the cleanest possible answer to the brief's "no B4→B3 circular dependency" requirement: **B4 depends on B3's data, never on B3's events being delivered.** If B4 later adds automatic triggering (`B4-D-C001`), *that* feature would need to actually subscribe — recorded as a forward dependency, not built now.

`BusinessUpdated` (`B3-D-C010`, not yet emitted by B3 — `B3_B4_HANDOFF_CONTRACT.md` §3.3) is therefore **not needed** by this design. If B3 ships it later, adopting it is purely additive (an optional cache-invalidation hint), never required.

# B4 — Scoring, Confidence, and Insufficient-Evidence Model

> **B4 status:** Target design only. Covers score, confidence, and the explicit "not enough evidence" state together, because the frozen frontend specifies all three as one inseparable contract (`intelligence.js:66-98`).

## 1. What WazLink uses

> **`B4-D-A009`: multiple named score components summing to one overall score, plus a bounded tier — not a single opaque "AI score 87."**

The frozen frontend's five dimensions are adopted verbatim as the authoritative component set, because they are already a Class A product contract (FB-01):

| Component | Category (`B4_SIGNAL_TAXONOMY.md`) | Max points |
|---|---|---|
| `activity` | ACTIVITY | 25 |
| `digital_opportunity` | DIGITAL_MATURITY | 30 |
| `reachability` | REACHABILITY | 20 |
| `service_fit` | SERVICE_FIT | 15 |
| `data_quality` | DATA_COMPLETENESS | 10 |

`overall_priority_score = Σ(component scores)`, bounded `0..100`. No `fit_score`/`reachability_score`/`intent_or_opportunity_score` naming from the brief's candidate list is separately adopted — `reachability` already exists as a named component above, `service_fit` already covers the intent/opportunity question WazLink actually asks ("does this business have a gap we sell into"), and a company-level "intent" score with no evidence source would violate `B4-D-A007`.

## 2. Component computation

Each component's score is the sum of its category's score-affecting signals' `strength` (`B4_SIGNAL_TAXONOMY.md` §2), clamped to the component's max:

```
component.score = clamp( Σ(signal.strength for signal in run.signals where signal.category maps to component), 0, component.max )
```

This is pure arithmetic over already-computed signals — no separate weighting model, no judgement call at the component level. All judgement lives one layer down, in how individual `ai_extracted` signals are derived (§5), where it is bounded and auditable per-signal rather than opaque at the score level.

## 3. Missing evidence behavior

A component with **zero** score-affecting signals fired for it scores `0`, not `null` — a `0` in one component (e.g. no `service_fit` signal fired because no gap was found) is a legitimate, meaningful result, distinct from the *entire run* having insufficient evidence (§6). This mirrors the frozen frontend's own distinction: `record.services.length === 0` renders "no service gap identified," never an error state.

## 4. Rounding and reproducibility

- All component and overall scores are integers — no fractional points, matching the frozen frontend's display contract exactly.
- Given an identical `input_snapshot` and an identical `scoring_model_version`, the overall score, tier, and ordered reasons **must** be bit-for-bit reproducible (FB-12, `B4-D-A005`'s reproducibility guarantee). This holds even for `ai_extracted` signals, because the *signal itself* — not the score arithmetic — is what the provider call determines, and re-running against a cached, unchanged snapshot reuses the prior signals rather than re-calling the provider (`B4_INPUT_SNAPSHOT_MODEL.md` §5).

## 5. The deterministic/AI boundary — a hard rule, not a preference

> **`B4-D-A008`: if deterministic logic can establish a fact reliably, the provider is never called merely to restate it.**

| Class | Examples | Rule |
|---|---|---|
| **A — deterministic** | website present, phone present, review count ≥ threshold, WhatsApp channel present, service-catalog gap join | computed entirely from normalized B3 fields; **no provider call is permitted to produce these signals**, enforced by `B4_ACCEPTANCE_TESTS.md`'s negative control AT-DET-NC |
| **B — AI-assisted structured extraction** | "is this website weak" (a quality judgement over an observed fact), "which gap best matches the described operational friction" | provider call permitted, output constrained to a closed enum/bounded value via `B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` |
| **C — AI reasoning/classification** | suggested outreach angle phrasing, business summary prose | provider call permitted, output is presentation-only and never score-affecting (`B4_RECOMMENDATION_MODEL.md` §5) |
| **D — prohibited/unsafe** | company solvency without reliable evidence, any protected-trait inference, individual-level profiling | never attempted, at any confidence, by any signal or recommendation — `B4_SECURITY_PRIVACY_SAFETY.md` §3 |

Every signal definition in `B4_SIGNAL_TAXONOMY.md` §4 declares its class explicitly via `source`; there is no "the model decided this deterministically-derivable fact anyway" escape hatch — it is a schema-level constraint on what a Class-A-derivable `signal_code` is permitted to declare as its source.

## 6. Insufficient evidence — the explicit fourth outcome

> **`B4-D-A011`: a Business is not forced into `high/good/medium/low` when evidence is poor. `insufficient_data` is a first-class run outcome, not a fallback tier.**

| Condition | Threshold |
|---|---|
| Minimum evidence to attempt scoring | at least one score-affecting signal fires in **≥ 2 of the 5 components**, and `DATA_COMPLETENESS` itself is not `critical_field_missing` for every required field | 

Below this threshold:

- `IntelligenceRun.status = completed`, `outcome = insufficient_data` (reusing the frozen frontend's exact status name)
- `overall_priority_score = null`, no tier is assigned, no `full`/`partial` `completion_kind` distinction applies (there is nothing to be partial about)
- `insufficient_reason_codes[]` is populated (closed set: `no_reachability_evidence`, `no_activity_evidence`, `critical_fields_missing`, `data_quality_below_threshold`)
- **No recommendation is produced** — `B4_RECOMMENDATION_MODEL.md` §4 forbids recommending an action from a business the system cannot yet characterize
- A rerun is meaningful once more evidence exists (e.g. after a rediscovery brings new fields) — `B4_FRESHNESS_STALENESS.md` §4 governs when that is worth suggesting to the actor

This is Class A because the frozen frontend already enforces it as an integrity invariant (FB-05, FB-08) — B4 is not inventing new product behavior, only giving the existing rule a server-side, evidence-threshold-driven trigger instead of a fixture flag.

## 7. Confidence — independent of score

> **`B4-D-A010`: confidence and score are orthogonal. A high score with low confidence, and a low score with high confidence, must both be representable.**

Confidence is **not** a byproduct of the score arithmetic. It is computed from:

| Input | Effect |
|---|---|
| evidence quantity | more fired signals across more components → higher confidence |
| evidence quality (`freshness` per evidence item, §`B4_EVIDENCE_MODEL.md` §2) | `expired` evidence pulls confidence down even if the signal it backs is still counted |
| agreement/disagreement | if an `ai_extracted` signal's judgement conflicts with a deterministic signal in the same category (e.g. AI says "weak website" but a `no_website` deterministic signal already fired for the same field — a contradiction, not reinforcement), confidence is penalized and the disagreement is surfaced, never silently resolved in one direction |
| source reliability | `provider_observed` evidence contributes more than `ai_extracted` evidence per item, reflecting that an observation is more certain than a judgement |
| missing critical fields | `DATA_COMPLETENESS` component score has an outsized weight in the confidence formula specifically, distinct from its score-component weight |

`confidence ∈ [0, 1]`, computed once per run at completion, immutable thereafter (§`B4_INTELLIGENCE_RUN_STATE_MACHINE.md`). The exact weight formula is Class B (`B4-D-B002`, `B4_DECISION_REGISTER.md`) — the *existence* of an independent, multi-factor confidence computation (this section) is Class A.

## 8. Score versioning

> **`B4-D-A005`/companion: every run records `scoring_model_version` and `signal_taxonomy_version` at completion, both immutable thereafter.**

A score computed under version N remains fully auditable after version N+1 ships — `B4_INTELLIGENCE_RUN_STATE_MACHINE.md` §2 already makes runs immutable history, so this falls out for free: nothing overwrites an old run's interpretation when the scoring model changes. The **current pointer** may move to a new run computed under a newer version (`B4_IDEMPOTENCY_CONCURRENCY.md` §4), but the old run's own fields never change to match the new model. There is no silent reinterpretation of history.

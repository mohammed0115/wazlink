# B4 — Signal Taxonomy

> **B4 status:** Target design only. A structured, versioned taxonomy — not one-off prose signals.

## 1. Categories

The frozen frontend's five score dimensions (`intelligence.js:5-11`) are the authoritative starting point, but a **signal category** and a **score dimension** are not the same thing: a dimension is a scoring bucket; a category is a semantic classification a signal can carry independent of whether it happens to move the score. B4 defines six categories, four of which map 1:1 to a frontend dimension and two of which are score-neutral but user-visible.

| Category | Frontend dimension mapped | Score-affecting? | Meaning |
|---|---|---|---|
| `ACTIVITY` | `activity` | yes | evidence of real, ongoing business operation (rating, review volume, recency) |
| `DIGITAL_MATURITY` | `digitalOpportunity` | yes | gaps and strengths in the business's digital presence (website, booking automation, WhatsApp) |
| `REACHABILITY` | `reachability` | yes | how contactable the business is (phone, website, verified channels present) |
| `SERVICE_FIT` | `serviceFit` | yes | how well WazLink's own service catalog maps to an identified gap |
| `DATA_COMPLETENESS` | `dataQuality` | yes | how much of the required evidence is actually present — feeds both the score's `dataQuality` component *and* the confidence model |
| `CONTEXT` | *(none)* | **no** | neutral, informational observations (e.g. category/city context) shown for explanation but never moving the score |

`FIT`, `INTENT`, `MOMENTUM`, `URGENCY`, `RISK`, and `COMMERCIAL_POTENTIAL` from the brief's example list are **not adopted** — nothing in the frozen frontend or Discovery evidence currently supports them (no time-series, no intent signal source, no risk-relevant field exists in B3's Business schema), and inventing categories with no evidence source would violate `B4-D-A007`'s evidence-backing rule before a single signal could ever populate them. Adding a category later, once a real evidence source exists, is purely additive (`B4-D-A006`).

## 2. Per-signal-type contract

Every signal code is defined once, in a versioned registry, with:

| Field | Meaning |
|---|---|
| `signal_code` | stable identifier, e.g. `weak_website`, `strong_review_volume` |
| `category` | one of §1's six |
| `polarity` | `positive` \| `gap` \| `unknown` \| `neutral` (frozen frontend's exact vocabulary, `data.js:152`) |
| `strength` | integer points this signal contributes to its dimension, bounded by the dimension's max (§`B4_SCORING_MODEL.md` §2) |
| `source` | `deterministic` \| `ai_extracted` (§`B4_SCORING_MODEL.md` §5 — the deterministic/AI boundary) |
| `evidence_requirement` | which Business/DiscoveryResult field(s) must be present, non-null, and non-stale for this code to fire |
| `confidence_contribution` | how this signal's presence/absence feeds the run's overall confidence (`B4_SCORING_MODEL.md` §7) |
| `freshness_window` | how long this signal remains usable without a new observation before it is excluded from a new run (Class B, `B4_DECISION_REGISTER.md`) |
| `score_affecting` | boolean — `CONTEXT`-category signals are always `false` |
| `user_visible` | boolean — every signal defined here is `true`; B4 defines no hidden signal (`B4_OBSERVABILITY_RECONCILIATION.md` §4 requires full auditability, which a hidden signal would break) |

## 3. `unknown` is not `gap` — the hard rule the frontend already enforces

> **`unknown`-polarity signals are never score-affecting and never treated as evidence of a deficiency.** A missing rating is "not observed," not "observed as bad" (FB-08, `intelligence.js:135`).

This is enforced structurally: `strength = 0` is a schema constraint on every `unknown`-polarity signal definition, not a runtime convention a bug could violate.

## 4. The starter registry

Existence of a closed, versioned signal-code set is **Class A** (`B4-D-A006`). The exact roster below is **Class B** — extensible without a controlled amendment as long as every addition stays inside §1's six categories and follows §2's contract, the same "existence is A, roster is B" pattern B3 used for its `>5 Businesses` threshold (`B3-D-B004`).

| `signal_code` | category | polarity | source |
|---|---|---|---|
| `strong_review_volume` | ACTIVITY | positive | deterministic |
| `high_rating` | ACTIVITY | positive | deterministic |
| `rating_unknown` | ACTIVITY | unknown | deterministic |
| `weak_website` | DIGITAL_MATURITY | gap | ai_extracted (quality judgement — never `deterministic`, per `B3_B4_HANDOFF_CONTRACT.md` §2's `websiteQuality` note) |
| `no_website` | DIGITAL_MATURITY | gap | deterministic (presence check) |
| `weak_visibility` | DIGITAL_MATURITY | gap | ai_extracted |
| `manual_booking` | DIGITAL_MATURITY | gap | ai_extracted |
| `missing_whatsapp` | DIGITAL_MATURITY | gap | deterministic (channel presence) |
| `appointment_friction` | DIGITAL_MATURITY | gap | ai_extracted |
| `phone_present` | REACHABILITY | positive | deterministic |
| `phone_absent` | REACHABILITY | gap | deterministic |
| `no_verified_channel` | REACHABILITY | gap | deterministic |
| `service_gap_matched` | SERVICE_FIT | positive | deterministic (rule join against the service catalog, §`B4_RECOMMENDATION_MODEL.md` §2) |
| `no_gap_identified` | SERVICE_FIT | neutral | deterministic |
| `high_data_completeness` | DATA_COMPLETENESS | positive | deterministic |
| `critical_field_missing` | DATA_COMPLETENESS | unknown | deterministic |
| `category_context` | CONTEXT | neutral | deterministic |
| `city_context` | CONTEXT | neutral | deterministic |

`weak_website` and `weak_visibility` are `ai_extracted` because judging "weak" is a quality opinion, not an observation — exactly the `websiteQuality` distinction `B3_B4_HANDOFF_CONTRACT.md` §2 draws. `no_website`, `phone_present/absent`, and channel-presence codes are `deterministic` because presence/absence of a field is a fact, not an opinion — enforcing `B4-D-A008` (§`B4_SCORING_MODEL.md` §5) at the level of individual signal definitions, not just prose intent.

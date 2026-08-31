# B3 — B4 AI Intelligence Handoff Contract

> **B3 status:** Target design only. **B4 is not designed.** This document states what B3 *guarantees* to a future B4, and what B3 refuses to own on its behalf. It specifies no B4 internals.

## 1. The boundary

```
B3 Discovery                        │  B4 AI Intelligence
────────────────────────────────────┼──────────────────────────────
acquires a Business                 │  analyzes a Business
normalizes provider fields          │  derives a score
records provenance                  │  derives confidence
emits BusinessDiscovered            │  derives signals and gaps
                                    │  derives a tier
                                    │  recommends an approach
```

The line is **fact versus judgement**. B3 records what was observed. B4 forms an opinion about it. A field is B3's if a provider asserted it or B3 derived it deterministically; it is B4's if it required a model, a heuristic, or a threshold.

## 2. What B3 must never own

`B3-INV-16`, stated as prohibitions because the frozen frontend displays every one of these next to Discovery data and the temptation to store them alongside a Business is real:

| B3 must not own | Frontend evidence it is B4's |
|---|---|
| opportunity **score** | `record.score`, `SCORING_VERSION` — `DiscoveryResults.tsx:29`, `:57` |
| **confidence** | `record.confidence` — `:58` |
| **tier** (`high`/`good`/`medium`/`low`) | `record.tier` — `:45` |
| **signals** and `gapCode` | `record.signals` — `:37`; `SIG-*` rows — `data.js:153-156` |
| **analysis status** (`analyzed`/`analyzing`/`not_analyzed`/`insufficient_data`) | `record.status` — `:47-49` |
| **reasons** / recommended sales approach | `record.reasons` — `:373` |
| `websiteQuality` as a **judgement** | `data.js:44` — a scored assessment, not an observation |

No `businesses` column, no `discovery_results` column, and no B3 DTO field carries any of these (`B3_DATA_MODEL.md` §13, `B3_API_DTO_CONTRACTS.md` §5).

**`websiteQuality` is the sharp case.** The frozen fixture stores `websiteQuality: "ضعيف"` on a business row (`data.js:44`) and the intelligence engine consumes it as a gap signal. It is a *judgement about* an observation, not the observation. B3 stores the observation — `website`, `website_domain`, and whether a website exists — and B4 forms the quality opinion. Storing it in B3 would put a scoring heuristic inside the acquisition domain and make B3 the owner of a value it cannot justify.

## 3. What B3 guarantees B4

### 3.1 A stable acquisition contract

| Guarantee | Mechanism |
|---|---|
| `BUS-*` is stable and permanently resolvable | immutable `public_id`; merge leaves a resolvable tombstone (`B3_BUSINESS_IDENTITY_MODEL.md` §6.2) |
| one Business per real-world business per workspace | `B3-INV-4` — so B4 analyzes a company once, not once per provider |
| normalized, deterministic field values | `B3_NORMALIZATION_DATA_QUALITY.md` — the same input always yields the same fields, so a re-analysis is comparable |
| explicit data-quality metadata | `data_quality.{level, missing[], invalid[]}` — B4 can express "insufficient data" **without guessing why** |
| absence is explicit | a missing field is `null` with a recorded reason, never `""`, `0`, or a placeholder |
| provenance is available | `Business.provenance` — job, provider, first/last observation |
| an acquisition signal | `BusinessDiscovered` (frozen B0 event) |
| refresh is observable | `last_observed_at` advances and `version` increments when normalized fields change |

### 3.2 `BusinessDiscovered` as the trigger

Frozen B0 event, emitted once per Business per workspace, on first creation (`B3_COMMAND_EVENT_CATALOG.md` §2.2):

```
BusinessDiscovered {  business_public_id, job_public_id, provider, discovered_at  }
```

B4 subscribes and decides its own analysis policy — eagerly on the event, lazily on first view, or in batch. **B3 does not know or care which**, and stores no analysis state either way.

### 3.3 Re-analysis triggers

B4 needs to know when a Business changed enough to be worth re-analyzing. B3 supplies two deterministic signals and takes no position on how B4 uses them:

| Signal | Meaning |
|---|---|
| `businesses.version` incremented | a normalized field changed |
| `last_observed_at` advanced | the Business was seen again, possibly unchanged |

A dedicated `BusinessUpdated` event is **not** emitted in Phase 1: no consumer exists yet, and inventing its payload before B4 is designed would be guessing at a contract B4 has not asked for. Recorded as **`B3-D-C010`**, and adding it later is purely additive.

## 4. Deferred B4 contract requirements

Items B4 must resolve, which B3 deliberately does not:

| ID | Item | Why B3 cannot decide it |
|---|---|---|
| `B3-D-C011` | whether analysis is keyed by **Business** or by **Lead** | frozen B0 keys `lead_intelligence_analyses` on `lead/input_fingerprint`, while the frozen frontend keys on `businessId` (`DiscoveryResults.tsx:29`). **B2 already recorded this as `B2-D-B006`**, an open cross-domain disagreement neither CRM nor Discovery may settle unilaterally |
| `B3-D-C012` | the analysis trigger policy — eager, lazy, or batch | a B4 cost and product decision |
| `B3-D-C013` | which normalized fields constitute the analysis input fingerprint | B4 owns its input contract; B3 guarantees only that the fields are deterministic |
| `B3-D-C014` | how B4 exposes results to Discovery result surfaces | B4's read model; the frozen frontend reads it client-side today |
| `B3-D-C015` | whether an unanalyzed Business is convertible to a Lead | product; B2 imposes no analysis precondition today, and B3 adds none |

**`B3-D-C011` is the one to watch.** If B4 keys analysis by Business, B3's identity guarantees carry it directly. If B4 keys by Lead, analysis becomes unavailable for a discovered-but-unconverted Business — which the frozen frontend contradicts, since it analyzes results before any conversion (`DiscoveryResults.tsx:307-320`). B3 records the tension and leaves the decision where B2 already left it.

## 5. What B3 asks of B4

Only two things, both boundary-preserving:

1. **Do not write B3 tables.** `businesses`, `business_identities`, and `discovery_results` are written by the normalization service and the ingestion workers only (frozen `BACKEND_DOMAIN_OWNERSHIP.md`). A B4 score belongs in a B4 table keyed by `BUS-*`.
2. **Do not treat absence as zero.** `data_quality` distinguishes "not observed" from "observed as absent". Scoring a missing rating as 0 would systematically penalize businesses for a provider's coverage gap — the exact defect the frozen frontend's `insufficient_data` status exists to prevent (`DiscoveryResults.tsx:48`, `:368`).

## 6. What B3 does not assume about B4

B3's design is complete and correct if B4 is **never built**. Discovery acquires, normalizes, deduplicates, records provenance, and hands Businesses to CRM conversion with no analysis in the loop. `BusinessDiscovered` is emitted whether or not anyone consumes it — frozen B0 already lists it, and the outbox tolerates an event with no subscriber.

No B3 contract, invariant, state machine, or acceptance test depends on B4 existing. `B4_AI_INTELLIGENCE_DESIGN_READINESS` is therefore a statement about what B4 *inherits*, not a dependency B3 is waiting on.

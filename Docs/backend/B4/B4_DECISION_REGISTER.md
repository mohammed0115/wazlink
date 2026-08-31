# B4 — Decision Register

> **Class A** — must be resolved before B4 closes. **Class B** — may be resolved during implementation preparation without changing architecture. **Class C** — belongs to a later phase or is genuinely non-blocking.
>
> **B4 cannot close with an unresolved Class A.**

## 1. Class A — resolved

| ID | Question | Decision | Rationale | Where |
|---|---|---|---|---|
| `B4-D-A001` | Does intelligence attach to Business or Lead? | **Business.** Resolves `B2-D-B006`/`B3-D-C011`, both explicitly deferred to this phase | frontend evidence is conclusive (`Lead360.tsx:106,172`); a Business is analyzable long before any Lead exists | `B4_INTELLIGENCE_SUBJECT_MODEL.md` |
| `B4-D-A002` | What is B4's aggregate model? | **`IntelligenceRun`**, `BUS-*`-owned; no separate `LeadIntelligenceAnalysis`/`Score`/`Confidence` aggregate | score/confidence are result fields on the run, not independent lifecycles | `B4_DOMAIN_OWNERSHIP.md` §2 |
| `B4-D-A003` | How many run states? | **Five**: `queued, running, completed, failed, cancelled`. Partial success is `completion_kind` on `completed`, not a sixth state | reuses B3's proven "partial success is a property, not a state" discipline | `B4_INTELLIGENCE_RUN_STATE_MACHINE.md` §1 |
| `B4-D-A004` | Is "current" a mutable pointer or is the latest run always current? | **explicit `is_current` boolean**, partial-unique `(business_id) WHERE is_current`, flipped only if no newer-snapshot run already holds it | prevents a stale completion from silently winning (§24 of the brief) | `B4_IDEMPOTENCY_CONCURRENCY.md` §4 |
| `B4-D-A005` | What does a run see, and how is reuse decided? | **immutable `input_snapshot`** captured at admission; `input_hash` over a defined material fingerprint governs reuse | mutable mid-run reads would make one run silently blend two moments of truth | `B4_INPUT_SNAPSHOT_MODEL.md` |
| `B4-D-A006` | Is the signal taxonomy closed and versioned? | **Yes** — six categories (§`B4_SIGNAL_TAXONOMY.md` §1), each signal code declares category/polarity/source/evidence-requirement | prevents one-off, unstructured signal prose | `B4_SIGNAL_TAXONOMY.md` |
| `B4-D-A007` | Must every claim be evidence-backed? | **Yes, without exception.** A `Signal`/`Recommendation` with empty `evidence_refs` is a defect | the headline "no opaque claim" requirement | `B4_EVIDENCE_MODEL.md` §1 |
| `B4-D-A008` | May the provider be called to restate a deterministically-derivable fact? | **No.** Presence/absence/threshold facts are computed locally; the provider is called only for genuine judgement or extraction | the brief's explicit hard rule | `B4_SCORING_MODEL.md` §5 |
| `B4-D-A009` | What is the score model? | **Five weighted components** (reused verbatim from the frozen frontend: activity/25, digital_opportunity/30, reachability/20, service_fit/15, data_quality/10 = 100), tier thresholds 80/65/40 | already an authoritative product contract (FB-01, FB-03) | `B4_SCORING_MODEL.md` §1 |
| `B4-D-A010` | Is confidence independent of score? | **Yes.** Computed from evidence quantity/quality/agreement/freshness, never derived from the score value | both high-score-low-confidence and the reverse must be representable | `B4_SCORING_MODEL.md` §7 |
| `B4-D-A011` | Is "insufficient evidence" a first-class outcome? | **Yes.** `outcome=insufficient_data`, `score=null`, no tier, no recommendation, below a defined minimum-evidence threshold | already an authoritative product contract (FB-05, FB-08) | `B4_SCORING_MODEL.md` §6 |
| `B4-D-A012` | Does B4 execute anything? | **No.** `Recommendation` rows only; no CRM/messaging/deal/automation write from any B4 code path | keeps B4 a recommender, matching the frozen S8 Copilot's own approval-gated discipline one layer further back | `B4_RECOMMENDATION_MODEL.md` §1 |
| `B4-D-A013` | How is a score's interpretation preserved across scoring-model changes? | **Runs are immutable history**; `scoring_model_version`/`signal_taxonomy_version` frozen at completion; only the *current pointer* may move to a newer-versioned run, never the old run's own fields | no silent reinterpretation of a historical score | `B4_SCORING_MODEL.md` §8 |
| `B4-D-A014` | What provider port name? | **`AI Gateway`** — reuses the name frozen `BACKEND_DOMAIN_OWNERSHIP.md` already assigned, rather than inventing a new one | no new port name where a frozen one already fits | `B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §1 |
| `B4-D-A015` | May a raw provider response mutate domain truth? | **No.** Strict schema validation (`additionalProperties:false`, bounded enums/numerics, evidence-reference validation) gates every write; malformed/partial responses are always `schema_invalid`, never best-effort parsed | the brief's explicit "no free-form mutation" rule | `B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §4 |
| `B4-D-A016` | Is provider/model identity business-semantic? | **No — technical audit metadata only.** No score/recommendation logic ever branches on it | provider swappability | `B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §6–§7 |
| `B4-D-A017` | What is the actor-triggered admission ceiling? | **`MAX_INTELLIGENCE_RUN_ADMISSIONS_PER_WORKSPACE_PER_HOUR = 60`** — adopts frozen `BACKEND_RATE_LIMIT_POLICY.md`'s "AI analysis — 60/hour/workspace" verbatim; one shared counter for first-analysis and re-analysis alike | the frozen anchor, closed before closure per the brief's explicit instruction | `B4_COST_RATE_LIMIT_MODEL.md` §1 |
| `B4-D-A018` | What bounds automatic transient retry within one run? | **`MAX_RUN_ATTEMPTS_PER_INTELLIGENCE_REQUEST = 3`**, distinct from and never incrementing the workspace admission counter | mirrors B3's exact separation of automatic vs. actor-triggered retry | `B4_COST_RATE_LIMIT_MODEL.md` §5 |
| `B4-D-A019` | What bounds a single batch-analyze request? | **`MAX_BATCH_SIZE_PER_ANALYZE_REQUEST = 20`** — rejected in full above this, before any admission | closes the frozen frontend's unbounded "analyze all visible" action (FB-17) — the exact class of gap an independent B3 audit found after the fact; closed here proactively | `B4_COST_RATE_LIMIT_MODEL.md` §3 |
| `B4-D-A020` | Is identical-input reuse mandatory? | **Yes.** `(workspace_id, business_id, input_hash)` match against a non-stale completed/in-flight run is reused/coalesced, never re-admitted | no duplicate provider spend for unchanged evidence | `B4_COST_RATE_LIMIT_MODEL.md` §7 |
| `B4-D-A021` | Is admission idempotent? | **Yes.** `Idempotency-Key` required on every admission command; replay returns the stored response and consumes no second slot | prevents accidental double-spend from network retries | `B4_COST_RATE_LIMIT_MODEL.md` §8, `B4_IDEMPOTENCY_CONCURRENCY.md` §1 |
| `B4-D-A022` | How is the current-pointer race resolved? | **Row-locked, version-compared flip** — a completing run only claims `is_current` if no run with a strictly newer `input_snapshot_version` already holds it | closes the "stale completion silently wins" attack | `B4_IDEMPOTENCY_CONCURRENCY.md` §4 |
| `B4-D-A023` | Is staleness stored or computed? | **Computed at read time**, never a persisted/mutated state | avoids a sweep-lag correctness gap | `B4_FRESHNESS_STALENESS.md` §1–§2 |
| `B4-D-A024` | Does B4 need to subscribe to any B3 event to stay correct? | **No.** Freshness and admissibility are fully computable from a direct, synchronous read of B3's tables; `BusinessRediscovered`/`BusinessDiscovered` are informative only | the strongest form of "no circular dependency" — not just no write, no delivery-order dependency either | `B4_B3_ACQUISITION_BOUNDARY.md` §5, `B4_FRESHNESS_STALENESS.md` §6 |
| `B4-D-A025` | Does Lead conversion copy or trigger intelligence? | **Neither.** No copy, ever (`B4-D-A001`'s corollary); no automatic analysis request on conversion | avoids duplicated truth and wasted provider spend | `B4_B2_CRM_LEAD360_BOUNDARY.md` §3 |
| `B4-D-A026` | Can an AI score or recommendation ever imply revenue? | **Never.** No B4 field, event, or write path touches Deal value/probability, payment, invoice, subscription, or attribution state | mirrors frozen B0's own `DealWon`/`RevenueRecognized` separation, and the frozen S8 Agent's hard-coded `create_revenue` prohibition | `B4_DOWNSTREAM_HANDOFFS.md` §5 |
| `B4-D-A027` | What happens to frozen `AnalyzeLead`/`LeadIntelligenceCompleted`? | **Retained, redefined, demoted.** `AnalyzeLead` becomes a thin Lead-context alias delegating to the Business-keyed primary path; `LeadIntelligenceCompleted` is not emitted, superseded by additive `BusinessIntelligenceCompleted` | resolves the frozen-name/resolved-model conflict without editing frozen text | `B4_COMMAND_EVENT_CATALOG.md` §1, `B4_CONTROLLED_AMENDMENTS.md` item 3 |
| `B4-D-A028` | Tenancy model? | **Every row workspace-scoped directly**, except three global definition catalogues (`signal_definitions`, `recommendation_definitions`, `scoring_model_versions`) | mirrors B3's exact `discovery_sources` global-catalogue exception | `B4_AUTHORIZATION_TENANCY.md` §6 |
| `B4-D-A029` | Are new permission codes needed? | **Yes — `intelligence.view`, `intelligence.run`.** No existing B1 code covers this domain | first domain in this corpus with no reusable permission family | `B4_AUTHORIZATION_TENANCY.md` §1 |
| `B4-D-A030` | Does B4 write any B3 table? | **Never.** Read-only access to `businesses`/`discovery_results`; zero write credential | the explicit ask `B3_B4_HANDOFF_CONTRACT.md` §5 makes | `B4_B3_ACQUISITION_BOUNDARY.md` §3 |
| `B4-D-A031` | Is Arabic prose ever the sole representation of a signal/recommendation? | **No.** A stable, language-neutral code always exists alongside any Arabic explanation | safe automation consumption, localization independent of truth | `B4_SECURITY_PRIVACY_SAFETY.md` §5 |
| `B4-D-A032` | What may a future automation consumer key on? | **Only versioned structured `signal_code`/`recommendation_code` values and thresholds — never free-form prose** | closes the "LLM prose becomes automation predicate" risk before B7 exists to be tempted by it | `B4_DOWNSTREAM_HANDOFFS.md` §4 |

**`CLASS_A_UNRESOLVED = 0`.** All 32 Class A questions are decided.

## 2. Class A unresolved

**None.**

## 3. Class B — implementation preparation

| ID | Item | Why it is not Class A |
|---|---|---|
| `B4-D-B001` | the exact signal→dimension weight table (`strength` values per `signal_code`) | the *existence* of a component-sum scoring model is Class A; individual point values are tunable |
| `B4-D-B002` | the exact confidence formula weights (evidence quantity/quality/agreement/freshness coefficients) | independence from score is Class A; the formula's coefficients are operational |
| `B4-D-B003` | the freshness age threshold | the *existence* of an age dimension in staleness is Class A; the exact duration is tunable |
| `B4-D-B004` | the exact minimum-evidence threshold (currently: score-affecting signals in ≥2 of 5 components) | the *existence* of an explicit threshold is Class A (`B4-D-A011`); the precise count is Class B |
| `B4-D-B005` | the exact DDL for `intelligence_runs`/`ai_usage_records` and the three global catalogues | every column, constraint, and index is specified in `B4_DATA_MODEL.md`; only the migration text remains |
| `B4-D-B006` | the exact JSON schema documents for structured-extraction and presentation-generation provider calls | the *requirement* of strict schema validation is Class A (`B4-D-A015`); the literal schema files are implementation artifacts |
| `B4-D-B007` | prompt template text itself | architecture (§`B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §5) is Class A; wording is not a domain decision |
| `B4-D-B008` | the exact recommendation-code roster beyond the six defined in `B4_RECOMMENDATION_MODEL.md` §3 | the closed-set discipline is Class A (`B4-D-A012`); the roster is extensible within it |
| `B4-D-B009` | whether `RequestBusinessIntelligence` consumes a commercial quota unit | provisional, pending B8 — mirrors `B3_QUOTA_COST_CONTROL.md` §2's identical "provisional until B8" posture |
| `B4-D-B010` | the concrete distributed implementation of the workspace/hour admission counter | mirrors `B3-D-B012` exactly — existence and value (60) are Class A; storage/algorithm mechanics are Class B |
| `B4-D-B011` | the exact `insufficient_reason_codes` and `stale_reasons` enum rosters beyond the examples given | the requirement that these be closed, structured sets is Class A; the exact members are refinable |
| `B4-D-B012` | batch admission ordering within one request when the counter is partially exhausted (currently: request order) | the partial-admission behavior itself is Class A (`B4_COST_RATE_LIMIT_MODEL.md` §4); the tie-break rule is operational |

**`CLASS_B_UNRESOLVED = 12`.**

## 4. Class C — later phases / non-blocking

| ID | Item | Owner |
|---|---|---|
| `B4-D-C001` | automatic/eager analysis triggering policy | explicitly deferred — Phase 1 is actor-triggered and lazy-on-view only |
| `B4-D-C002` | S8 Sales Copilot / governed Agent integration | a later, cross-cutting phase needing B2+B5+B6+B7 simultaneously |
| `B4-D-C003` | the "highOpportunity" dashboard aggregate's owning domain (Analytics) | not B4's to own; B4 exposes queryable fields only |
| `B4-D-C004` | data retention durations for `intelligence_runs` | **PRODUCT/LEGAL** (frozen ADR-012 posture, mirrors `B3-D-C018`) |
| `B4-D-C005` | adopting a future `BusinessUpdated` event from B3, if B3 ever ships one (`B3-D-C010`) | purely additive if it happens; not required now (`B4-D-A024`) |
| `B4-D-C006` | cross-workspace result caching of any kind | not deferred as "maybe later" — **prohibited** by `B4-D-A028`/§`B4_AUTHORIZATION_TENANCY.md` §7; listed here only to record that it was considered and rejected, not left open |
| `B4-D-C007` | non-Arabic presentation-artifact output | a later localization phase |
| `B4-D-C008` | website/content enrichment (crawling a Business's own site) as an additional evidence source | a separate capability, not this phase's input model |
| `B4-D-C009` | B6 Deal-stage-aware re-analysis triggers | belongs to B6's design |
| `B4-D-C010` | the concrete B7 automation trigger catalogue | belongs to B7's design; `B4_DOWNSTREAM_HANDOFFS.md` §4 only fixes the contract shape B7 must respect |
| `B4-D-C011` | result caching/reuse across a merged Business's pre-merge history | `B4_B3_ACQUISITION_BOUNDARY.md` §4 states the no-blending rule; a smarter reuse policy across a merge is future work |
| `B4-D-C012` | the analysis trigger policy's eventual eager/lazy/batch tuning once B7 exists | inherits B3's own `B3-D-C012` framing, now B4's to eventually revisit with a real automation consumer in hand |
| `B4-D-C013` | the exact `ai_usage_records` cost-unit currency/units, once a provider's pricing model is confirmed | `B4_EXTERNAL_VALIDATION_REGISTER.md` item — pricing is provider-specific and time-sensitive |
| `B4-D-C014` | multi-provider fallback/routing policy | not designed; `B4_PROVIDER_STRUCTURED_OUTPUT_CONTRACT.md` §7 only guarantees the domain model doesn't block it |
| `B4-D-C015` | whether an unanalyzed Business is convertible to a Lead | **product; B2 imposes no precondition today and B4 adds none** — inherits B3's own framing of the identical question (`B3-D-C015`) |

**`CLASS_C_UNRESOLVED = 15`.**

## 5. External validation register

See `B4_EXTERNAL_VALIDATION_REGISTER.md` for provider-specific facts B4 must not invent — none blocks design closure.

## 6. Decisions inherited rather than made

Recorded so no reader mistakes silence for an open question: every ADR, the frozen B0 event envelope/retry policy/idempotency standard/rate-limit policy/error catalog/API standard, B1's roles/permissions/authorization pipeline (extended additively, §`B4_AUTHORIZATION_TENANCY.md` §1), and every B2/B3 contract this corpus consumes unchanged.

# B4 — Acceptance Test Pack

> **B4 status:** Target design only. Implementation-independent. `**NC**` rows are negative controls: an implementation that fails the cited invariant must fail these, not merely happen to pass the positive rows.

## 1. Subject ownership — AT-SUBJ

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-SUBJ-1 | Business exists, no Lead | `RequestBusinessIntelligence` | `202`, run admitted | `B4-D-A001` |
| AT-SUBJ-2 | Business converts to Lead after a completed run exists | `GET /businesses/{id}/intelligence` | identical response before and after conversion | `B4-D-A001` |
| AT-SUBJ-3 | Lead exists, converted from Business with a completed run | `GET Lead360` | `intelligence` resolves via `lead.business_id`, matches `GET /businesses/{id}/intelligence/summary` exactly | subject model §5 |
| AT-SUBJ-4 | `AnalyzeLead(lead_id)` called | inspect | resolves `lead.business_id`, delegates to identical admission path as `RequestBusinessIntelligence` | subject model §4 |
| AT-SUBJ-5 | two Leads somehow reference the same Business (should be impossible per B2) | — | B4 still resolves one intelligence history — B4 does not itself enforce Lead uniqueness, that is B2's | domain ownership §4 |
| AT-SUBJ-6 **NC** | — | an implementation storing a score/opportunity value on a `leads` row | AT-SUBJ-2 fails after any Lead-side mutation touches that column; `B2_DRIFT` also fails | `B4-D-A001` |
| AT-SUBJ-7 **NC** | — | an implementation that returns `404` for `GET /businesses/{id}/intelligence` when no Lead exists yet | AT-SUBJ-1 fails — pre-Lead analysis must work | `B4-D-A001` |

## 2. Run state machine — AT-STATE

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-STATE-1 | new admission | inspect | `status=queued` | §1 |
| AT-STATE-2 | worker claims | inspect | `status=running` | transition 2 |
| AT-STATE-3 | all required components succeed | inspect | `completed`, `completion_kind=full` | transition 3 |
| AT-STATE-4 | deterministic ok, Class C fails | inspect | `completed`, `completion_kind=partial` | transition 4 |
| AT-STATE-5 | required Class B component exhausts attempts | inspect | `failed`, `failure_code` set | transition 5 |
| AT-STATE-6 | `queued` run | `CancelIntelligenceRun` | `cancelled` | transition 6 |
| AT-STATE-7 | `running` run | `CancelIntelligenceRun` | `cancelled` after checkpoint (§5) | transition 6 |
| AT-STATE-8 | `failed` run | `ReanalyzeBusinessIntelligence` | new run, `queued` | transition 7 |
| AT-STATE-9 | `completed` run | attempt any further transition | rejected — no `completed → *` edge exists | §2 |
| AT-STATE-10 | `completed` run | `ReanalyzeBusinessIntelligence` | **new** run row created; old row untouched | §7 |
| AT-STATE-11 **NC** | — | an implementation with a 6th state `stale` | AT-STATE-9 semantics break — staleness must be computed, never stored | §1 |
| AT-STATE-12 **NC** | — | an implementation reusing the same `ANL-*` row across a re-analysis (mutating in place) | AT-STATE-10 fails — history would be destroyed | §7 |

## 3. Input snapshot — AT-SNAP

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-SNAP-1 | admission | inspect | `input_snapshot` captured before any deterministic extraction runs | §1 |
| AT-SNAP-2 | Business field changes mid-run | inspect run's snapshot after completion | unchanged from admission time | §1 |
| AT-SNAP-3 | provider payload | inspect | contains no `public_id`, no raw phone/website value, no provenance | §2 |
| AT-SNAP-4 | two runs, identical fingerprinted fields, differing `last_observed_at` only | compare `input_snapshot_version` | identical — non-material change | §4 |
| AT-SNAP-5 | `category` changes | new snapshot | `input_snapshot_version` increments | §4 |
| AT-SNAP-6 | rerun requested, unchanged input | compare `input_hash` | identical → reuse (`B4-D-A020`) | §5 |
| AT-SNAP-7 **NC** | — | an implementation re-reading live Business state mid-run for a second provider call | AT-SNAP-2 fails | §1 |

## 4. Signal taxonomy — AT-SIG

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-SIG-1 | any signal | inspect | `category` is one of the six §1 categories | `B4-D-A006` |
| AT-SIG-2 | `unknown`-polarity signal | inspect | `strength=0` | §3 |
| AT-SIG-3 | `CONTEXT`-category signal | inspect | `score_affecting=false` | §1 |
| AT-SIG-4 | `weak_website` signal fires | inspect `source` | `ai_extracted` | §4 |
| AT-SIG-5 | `no_website` signal fires | inspect `source` | `deterministic` | §4 |
| AT-SIG-6 | any signal | inspect | `evidence_requirement` field(s) were actually present and non-null when it fired | §2 |
| AT-SIG-7 **NC** | — | an implementation setting `strength > 0` on an `unknown`-polarity signal | AT-SIG-2 fails | §3 |
| AT-SIG-8 **NC** | — | an implementation defining a `RISK`/`INTENT` category with no evidence source | §1 — rejected, no such category is defined |

## 5. Evidence — AT-EVID

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-EVID-1 | any Signal | inspect | `evidence_refs` non-empty | `B4-D-A007` |
| AT-EVID-2 | any Recommendation | inspect | `evidence_refs` non-empty | `B4-D-A007` |
| AT-EVID-3 | `provider_observed` evidence | inspect | `source_ref` points directly at a B3 field | §3 |
| AT-EVID-4 | `ai_extracted` evidence | inspect | `source_ref` points at a structured-output field plus a provider-call reference, never a raw prompt | §3 |
| AT-EVID-5 | expired evidence | inspect | `freshness=expired`, confidence penalized (`B4_SCORING_MODEL.md` §7) | §2 |
| AT-EVID-6 **NC** | — | an implementation producing a `Signal` or `Recommendation` with `evidence_refs=[]` | rejected — this is the headline negative control the brief requires | `B4-D-A007` |
| AT-EVID-7 **NC** | — | an implementation storing a raw provider response inside an `Evidence` row | AT-EVID-4 fails | §4 |

## 6. Scoring — AT-SCORE

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-SCORE-1 | completed run | inspect | `overall_priority_score = Σ(component scores)` | §1 |
| AT-SCORE-2 | any run | inspect | `0 ≤ overall_priority_score ≤ 100` | §1 |
| AT-SCORE-3 | `score=82` | inspect `tier` | `high` | tier thresholds |
| AT-SCORE-4 | `score=65` | inspect `tier` | `good` | boundary inclusive |
| AT-SCORE-5 | `score=40` | inspect `tier` | `medium` | boundary inclusive |
| AT-SCORE-6 | `score=39` | inspect `tier` | `low` | boundary |
| AT-SCORE-7 | component with zero fired signals | inspect | component score `=0`, not `null` | §3 |
| AT-SCORE-8 | identical `input_snapshot`, identical `scoring_model_version`, rerun via cache/reuse | compare score/tier/reasons | bit-for-bit identical | §4, `B4-D-A005` |
| AT-SCORE-9 | website presence check | trace signal `source` | `deterministic`, no provider call made | `B4-D-A008` |
| AT-SCORE-10 | phone presence check | trace signal `source` | `deterministic`, no provider call made | `B4-D-A008` |
| AT-SCORE-11 | review-count threshold check | trace | `deterministic` | `B4-D-A008` |
| AT-SCORE-12 | website *quality* judgement | trace | `ai_extracted`, permitted | §5 Class B |
| AT-SCORE-13 | attempted "company solvency" signal | — | no such signal is defined; rejected at the taxonomy level | §5 Class D |
| AT-SCORE-14 **NC** | — | an implementation calling the AI provider to check phone-number presence | AT-SCORE-10 fails — the hard deterministic-first rule | `B4-D-A008` |
| AT-SCORE-15 **NC** | — | an implementation producing `overall_priority_score` as a single opaque provider-returned number with no component breakdown | fails §1's headline requirement — "not a single opaque AI score" | `B4-D-A009` |

## 7. Confidence — AT-CONF

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-CONF-1 | any run | inspect | `0 ≤ confidence ≤ 1` | §7 |
| AT-CONF-2 | high score, thin/aging evidence | inspect | high `score`, low `confidence` — both representable simultaneously | `B4-D-A010` |
| AT-CONF-3 | low score, abundant fresh evidence | inspect | low `score`, high `confidence` | `B4-D-A010` |
| AT-CONF-4 | `ai_extracted` signal contradicts a `deterministic` signal in the same category | inspect | confidence penalized, disagreement surfaced, not silently resolved | §7 |
| AT-CONF-5 | provider response includes its own confidence field | inspect final `confidence` | computed independently by B4's formula, provider's value not used directly | DF19 |
| AT-CONF-6 **NC** | — | an implementation deriving `confidence` as a direct function of `overall_priority_score` | AT-CONF-2/3 fail | `B4-D-A010` |

## 8. Insufficient evidence — AT-INSUFF

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-INSUFF-1 | evidence below the §6 threshold | run completes | `outcome=insufficient_data`, `score=null`, no `tier` | `B4-D-A011` |
| AT-INSUFF-2 | same | inspect | `insufficient_reason_codes` populated from the closed set | §6 |
| AT-INSUFF-3 | same | inspect | zero `Recommendation` rows | §6, `B4_RECOMMENDATION_MODEL.md` §4 |
| AT-INSUFF-4 | evidence improves (new observation) | rerun | may now score normally | §6 |
| AT-INSUFF-5 **NC** | — | an implementation assigning `tier=low` instead of `insufficient_data` when evidence is genuinely absent | fails — `low` implies "we evaluated it and it's weak," not "we don't know" | `B4-D-A011` |
| AT-INSUFF-6 **NC** | — | an implementation forcing a numeric score from `≤1` fired signal by defaulting missing components to a floor value | this is the brief's explicit "high score forced from insufficient evidence" negative control | `B4-D-A011` |

## 9. Recommendation — AT-REC

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-REC-1 | `tier=high`, reachability + service-fit signals present | inspect | `recommendation_code=contact_now` | §3 |
| AT-REC-2 | `tier ∈ {good,medium}` | inspect | `review_manually` | §3 |
| AT-REC-3 | `DATA_COMPLETENESS` below threshold, not insufficient | inspect | `enrich_data` | §3 |
| AT-REC-4 | `tier=low`, no gap | inspect | `defer` | §3 |
| AT-REC-5 | any recommendation | inspect | `priority` matches the run's `tier`, never set independently | §2 |
| AT-REC-6 | any recommendation | attempt to trace an executed side effect | none exists — no CRM/messaging/deal/automation write occurred | `B4-D-A012` |
| AT-REC-7 **NC** | — | an implementation where `RequestBusinessIntelligence`'s handler also calls `CreateTask` or `SendMessage` | fails §1's headline rule | `B4-D-A012` |
| AT-REC-8 **NC** | — | an implementation adding `create_lead`/`send_whatsapp` as recommendation codes | fails §3 — these name actions in domains B4 does not own |

## 10. AI presentation artifacts — AT-PRES

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-PRES-1 | `business_summary` present | inspect | every claim traces to an `evidence_ref` already on the run | §5.1 |
| AT-PRES-2 | artifact generation fails | inspect run | `completed`, `completion_kind=partial`, `presentation=null` — never `failed` | §6, `B4_RETRY_FAILURE_MODEL.md` §3 |
| AT-PRES-3 | any artifact | measure length | within the §5.1 size bound | §5.1 |
| AT-PRES-4 | provider returns an artifact citing an `evidence_id` not on the run | validate | `schema_invalid`, artifact omitted | §5.1 |
| AT-PRES-5 | run is stale | inspect artifact | carries the same `stale` marker as the owning run | §5.1 |
| AT-PRES-6 **NC** | — | an implementation generating `suggested_outreach_angle` before signals/recommendations are finalized | AT-PRES-1 fails — nothing yet exists to ground it | §6 |
| AT-PRES-7 **NC** | — | an implementation where a numeric value (e.g. a probability) appears only in prose, not as a structured field | fails "never hidden commercial truth" | §5.1 |

## 11. Provider abstraction / structured output — AT-PROV

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-PROV-1 | valid provider response | inspect | validated against `output_schema_ref` before any domain write | §4 |
| AT-PROV-2 | malformed JSON | inspect | `schema_invalid`, no repair attempt | §4 |
| AT-PROV-3 | unknown field in response | inspect | rejected (`additionalProperties:false`) | §4 |
| AT-PROV-4 | numeric field out of bound | inspect | `schema_invalid` | §4 |
| AT-PROV-5 | enum field with an unrecognized value | inspect | `schema_invalid`, not coerced | §4 |
| AT-PROV-6 | any provider call | inspect domain model code | no OpenAI-specific (or any vendor-specific) type appears | §7 |
| AT-PROV-7 | any `IntelligenceUsageRecord` | inspect | `provider`, `model_identifier`, `prompt_policy_version` all present | §6 |
| AT-PROV-8 | domain rule referencing provider identity | search | none exists — no score/recommendation logic branches on provider/model | `B4-D-A016` |
| AT-PROV-9 **NC** | — | an implementation writing a `Signal` directly from an unvalidated provider response | this is the brief's explicit "raw provider response trusted without schema validation" negative control | `B4-D-A015` |
| AT-PROV-10 **NC** | — | an implementation "best-effort parsing" a malformed response instead of rejecting it | AT-PROV-2 fails | §4 |

## 12. Cost control / rate limiting — AT-COST

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-COST-1 | workspace at 0 admissions this hour | admit 59 sequential requests | all 59 succeed | `B4-D-A017` |
| AT-COST-2 | workspace at 59 admissions | 60th request | admitted | `B4-D-A017` |
| AT-COST-3 | workspace at 60 admissions | 61st request | `429`, `intelligence_rate_limited`, before any provider call | `B4-D-A017` |
| AT-COST-4 | batch of 21 IDs | submit | `422 batch_size_exceeded`, entire batch rejected before admission | `B4-D-A019` |
| AT-COST-5 | batch of 20 IDs, workspace has 8 slots left | submit | 8 admitted, 12 individually `429` in the same response | §4 |
| AT-COST-6 | identical input, completed non-stale run exists | request analysis | `outcome=reused`, no counter decrement | `B4-D-A020` |
| AT-COST-7 | a run already `queued`/`running` for identical input | request analysis again | coalesced onto the existing run, no second admission | `B4-D-A020` |
| AT-COST-8 | provider call fails transiently | observe | retried automatically ≤3 times, `attempt_no`/workspace counter untouched by automatic retries | `B4-D-A018` |
| AT-COST-9 | `cost_units` unknown from adapter | inspect | `null`, never defaulted to `0` | §9 |
| AT-COST-10 | 1,000 Businesses accumulated over many days, actor requests re-analysis of all via repeated batches within one hour | observe | at most 60 total admissions succeed in that rolling hour, regardless of batch grouping | `B4-D-A017`, `B4-D-A019` |
| AT-COST-13 | run admitted (`queued`), no provider call has been made yet | `CancelIntelligenceRun` | admission slot is released back to the workspace's hourly pool; a subsequent admission in the same rolling hour can use it | §7.1 |
| AT-COST-14 | run `running`, provider call already in flight | `CancelIntelligenceRun` | admission slot is **retained/consumed** — not released back to the pool, even though the run ends `cancelled` | §7.1 |
| AT-COST-11 **NC** | — | an implementation with no workspace/hour admission limiter at all | AT-COST-3 and AT-COST-10 fail — this is the brief's explicit "unlimited actor re-analysis" negative control | `B4-D-A017` |
| AT-COST-12 **NC** | — | an implementation exempting `ReanalyzeBusinessIntelligence` from the shared counter | AT-COST-10 fails via a re-analysis-only burst | §2 |
| AT-COST-15 **NC** | workspace at 60/60 admissions, one run `running` | request analysis → provider call starts → `CancelIntelligenceRun` → immediately request analysis again, repeated | the released-on-`running`-cancel behavior AT-COST-14 forbids would let this loop regain admission capacity for free after spend already occurred; an implementation that refunds a `running` cancellation's slot fails AT-COST-14 and permits exactly this free provider-spend loop — the brief's explicit "cancellation refunds spent slot" negative control | §7.1 |

## 13. Idempotency / concurrency — AT-IDEM

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-IDEM-1 | request replayed under same `Idempotency-Key` | submit twice | identical stored response, one admission | §1 layer 1 |
| AT-IDEM-2 | two concurrent requests, same input | submit simultaneously | one run, coalesced | §3 |
| AT-IDEM-3 | two concurrent requests, different (materially distinct) input | submit simultaneously | two distinct runs admitted | §3 |
| AT-IDEM-4 | run A (older snapshot) completes after run B (newer snapshot) already went current | inspect `is_current` | still points to run B | §4–§5 |
| AT-IDEM-5 | reverse completion order (A before B) | inspect | `is_current` still ends on B (higher `input_snapshot_version`) | §5 |
| AT-IDEM-6 | Business converts to Lead mid-run | inspect run after completion | unaffected, completes normally | §6 |
| AT-IDEM-7 **NC** | — | an implementation where the last run to *complete* (not the highest snapshot version) becomes current | AT-IDEM-4/5 fail — this is the brief's "stale run overwrites newer current intelligence" negative control | `B4-D-A022` |
| AT-IDEM-8 **NC** | — | an implementation with no row lock on the current-pointer flip, allowing two concurrent completions to both claim `is_current` | the partial unique index rejects the second write; an implementation lacking it fails |

## 14. Freshness / staleness — AT-FRESH

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-FRESH-1 | current run's `input_hash` ≠ current Business fingerprint | `GET` | `stale=true`, `stale_reasons` includes `input_changed` | §1 |
| AT-FRESH-2 | run older than the age threshold, input unchanged | `GET` | `stale=true`, `stale_reasons` includes `age_threshold` | §1 |
| AT-FRESH-3 | `scoring_model_version` superseded | `GET` | `stale=true`, `stale_reasons` includes `model_version` | §1 |
| AT-FRESH-4 | stale run | apply `highOpportunity`/priority-sort filter | excluded from ranking | §3 |
| AT-FRESH-5 | stale run | apply plain `opportunityTier`/`minScore` filter | **included**, with the marker | §3 |
| AT-FRESH-6 | stale, no new evidence since | inspect | `rerun_suggested=false` | §4 |
| AT-FRESH-7 | stale, new evidence available | inspect | `rerun_suggested=true` | §4 |
| AT-FRESH-8 **NC** | — | an implementation hiding stale runs from `GET` entirely | AT-FRESH-1 fails — "visible with stale marker," never withheld | §3 |
| AT-FRESH-9 **NC** | — | an implementation storing `is_stale` as a column updated by a periodic sweep | contradicts §2's "computed, never stored" design; a lag-window read would return a wrong answer this design cannot have |

## 15. B3 boundary / rediscovery — AT-B3

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-B3-1 | any B4 write path | inspect | writes only B4-owned tables | `B4-D-A030` |
| AT-B3-2 | `BusinessRediscovered` fires | observe B4 | no run admitted automatically | §6 boundary |
| AT-B3-3 | same | next `GET` for that Business | reflects `stale=true` purely from the resulting `businesses.version` change, with no event subscription required | §6 |
| AT-B3-4 | Business merged, losing side had intelligence history | inspect | history retained, reachable via the tombstone `BUS-*` | §4 |
| AT-B3-5 | Business merged | inspect surviving Business | no automatic re-analysis; no blending of the two runs' signals | §4 |
| AT-B3-6 | the entire B3 corpus | diff | unchanged; `B3_DRIFT=0` | §6 |
| AT-B3-7 **NC** | — | an implementation with a domain-code ORM join from B4 into `businesses`/`discovery_results` bypassing the read-only repository boundary | fails §3's structural "no write credential" test at the design-review level |
| AT-B3-8 **NC** | — | an implementation that blends two merged Businesses' signals into one run | AT-B3-5 fails |

## 16. B2 CRM / Lead 360 / conversion — AT-B2

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-B2-1 | Lead360 requested | inspect `intelligence` field | resolved live via `lead.business_id`, matches the summary endpoint exactly | `B4_B2_CRM_LEAD360_BOUNDARY.md` §1 |
| AT-B2-2 | no completed run exists | Lead360 requested | `intelligence=null` | frozen contract nullable |
| AT-B2-3 | Business converts to Lead | inspect | no B4 write occurs as a side effect of `ConvertBusinessToLead` | §3 |
| AT-B2-4 | never-analyzed Business converts | inspect | `Lead360.intelligence=null`; no automatic analysis triggered | §3 |
| AT-B2-5 | Lead archived | `GET` intelligence via Lead360 | still resolves live, subject only to B2's own archived-read rule | §5 |
| AT-B2-6 | any B4 table | search for a `leads` FK | none exists | §2 |
| AT-B2-7 **NC** | — | an implementation copying `score`/`tier` onto the `leads` row at conversion time | AT-B2-1 fails after a later re-analysis (the copy would go stale) | §4 |
| AT-B2-8 **NC** | — | an implementation auto-triggering `RequestBusinessIntelligence` inside the `ConvertBusinessToLead` handler | AT-B2-3 fails; also violates the no-automatic-trigger rule (`B4-D-C001`) |

## 17. Downstream handoffs / revenue invariant — AT-DOWN

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-DOWN-1 | any B4 command | search for a write to `CONV-*`/`MSG-*` | none | §2 |
| AT-DOWN-2 | any B4 command | search for a write to `DEAL-*` | none | §3 |
| AT-DOWN-3 | high `overall_priority_score` | search for any implied Deal-won/probability field | none exists in any B4 DTO | §3 |
| AT-DOWN-4 | any B4 event | inspect | none is `RevenueRecognized` or references `REV-*`/`ATT-*`/`PAY-*`/`UPQ-*` | §5 |
| AT-DOWN-5 | recommendation-code roster | inspect | contains no channel-specific or CRM-specific action name | `B4_RECOMMENDATION_MODEL.md` §3 |
| AT-DOWN-6 | a hypothetical B7 automation rule | key on `recommendation_code`/`signal_code` | works, stable, versioned | §4 |
| AT-DOWN-7 | same hypothetical rule | attempt to key on `presentation.business_summary` substring | not supported by any structured field designed for that purpose | §4 |
| AT-DOWN-8 **NC** | — | an implementation where a `contact_now` recommendation auto-creates a Task or sends a message | fails §1's headline rule — this is the brief's explicit "free-form recommendation directly triggers automation" negative control | `B4-D-A012` |
| AT-DOWN-9 **NC** | — | an implementation computing an "estimated deal value" field from `overall_priority_score` | this is the brief's explicit "AI score creates revenue" negative control | `B4-D-A026` |

## 18. API / DTO — AT-API

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-API-1 | no completed run | `GET /businesses/{id}/intelligence` | `200`, body `null` | §1.4 |
| AT-API-2 | foreign-workspace Business ID | `GET` | `404`, identical to non-existent | `B4_AUTHORIZATION_TENANCY.md` §7 |
| AT-API-3 | batch analyze, mixed valid/invalid IDs | submit | `202`, per-ID `outcome`, invalid IDs marked `not_found` | §1.1 |
| AT-API-4 | `POST /intelligence/runs/{id}/cancel`, stale `version` | submit | `409 STALE_VERSION` | §1.3 |
| AT-API-5 | `GET .../history` | inspect | cursor-paginated, frozen `PageInfo` shape | §1.6 |
| AT-API-6 | any response DTO | inspect | `additionalProperties: false` | frozen DTO discipline |
| AT-API-7 **NC** | — | an implementation returning `404` instead of `200 null` when no run exists | AT-API-1 fails |

## 19. Command / event — AT-CMD

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-CMD-1 | successful run completion | inspect outbox | `BusinessIntelligenceCompleted` emitted, not `LeadIntelligenceCompleted` | `B4_COMMAND_EVENT_CATALOG.md` §1 |
| AT-CMD-2 | `AnalyzeLead` invoked | inspect | delegates to the same handler as `RequestBusinessIntelligence`, no parallel code path | §1 |
| AT-CMD-3 | event envelope | inspect | matches the frozen B0 sentence verbatim | §5 |
| AT-CMD-4 | `queued`/`running` transitions | search outbox | no event published for either | §3 |
| AT-CMD-5 | any B4 event | inspect | `CONSUMED_EVENT_COUNT` referenced by any B4 handler | `0` |
| AT-CMD-6 **NC** | — | an implementation emitting `LeadIntelligenceCompleted` for a pre-Lead Business | structurally impossible (no `lead_public_id` exists to populate) and explicitly disallowed | §1 |

## 20. Retry / failure / partial success — AT-FAIL

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-FAIL-1 | required Class B component fails after 3 attempts | inspect | `status=failed` | §2 |
| AT-FAIL-2 | optional Class C component fails after 3 attempts | inspect | `status=completed`, `completion_kind=partial` | §3 |
| AT-FAIL-3 | validation failure (bad request) | inspect | not retried automatically | §2 |
| AT-FAIL-4 | provider safety refusal on a Class B call | inspect | `failed`, not retried (refusal is definitive) | §2 |
| AT-FAIL-5 | any `failed` run | inspect user-visible error | `failure_code` only, no raw provider message | §2 |
| AT-FAIL-6 | failed re-analysis | inspect prior completed run | still current, still fully visible | `B4_INTELLIGENCE_RUN_STATE_MACHINE.md` §4 |
| AT-FAIL-7 **NC** | — | an implementation retrying a `PERMISSION_DENIED`/validation failure automatically | AT-FAIL-3 fails |
| AT-FAIL-8 **NC** | — | an implementation that discards the prior completed run when a re-analysis fails | AT-FAIL-6 fails — the brief's explicit "last good result must remain visible" requirement |

## 21. Authorization — AT-AUTHZ

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-AUTHZ-1 | `viewer` role | `GET` intelligence | allowed | `B4_AUTHORIZATION_TENANCY.md` §1 |
| AT-AUTHZ-2 | `viewer` role | `POST /intelligence/analyze` | `403` | §1 |
| AT-AUTHZ-3 | `sales` member, own-requested run | cancel it | allowed | §3 |
| AT-AUTHZ-4 | `sales` member, colleague's run | cancel it | `403` | §3 |
| AT-AUTHZ-5 | `manager` role | cancel any run | allowed | §3 |
| AT-AUTHZ-6 | any actor-initiated command | inspect audit log | `AUD-*` row present | §4 |
| AT-AUTHZ-7 | machine-executed signal extraction | inspect audit log | absent — traced, not audited | §4 |
| AT-AUTHZ-8 **NC** | — | an implementation gating evidence view behind a separate permission from the run itself | breaks explainability — no such permission exists |

## 22. Tenancy — AT-TEN

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-TEN-1 | every persisted table | inspect schema | `workspace_id` present, except the three global catalogues | §6 |
| AT-TEN-2 | identical Business existing in two workspaces | request analysis in each | two independent run histories, zero shared state | §7 |
| AT-TEN-3 | any cache/reuse key | inspect | keyed `(workspace_id, business_id, input_hash)` | §7 |
| AT-TEN-4 | cross-workspace `GET /intelligence/runs/{id}` | attempt | `404` | §7 |
| AT-TEN-5 **NC** | — | an implementation with a provider-adapter-level cache keyed only on `business_id` | AT-TEN-2 fails — this is the brief's explicit "cross-workspace cache reuse" negative control | §7 |

## 23. Security / privacy / prohibited inference — AT-SEC

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-SEC-1 | provider request payload | inspect | no secret, no token, no credential | §1 |
| AT-SEC-2 | provider request payload | inspect | phone/website reduced to presence booleans | §1 |
| AT-SEC-3 | log line for a provider call | inspect | no raw prompt, no raw response | §2 |
| AT-SEC-4 | structured-output schema | inspect | no field for any protected personal trait | §3 |
| AT-SEC-5 | Business description text containing adversarial instructions | provider call made | system/domain instructions unaffected; output still schema-validated | §6 threat 7 |
| AT-SEC-6 | Arabic UI surface | inspect `presentation.*` | Arabic; `signal_code`/`recommendation_code` remain language-neutral | §5 |
| AT-SEC-7 **NC** | — | an implementation logging the full provider request/response at debug level | AT-SEC-3 fails — this is the brief's explicit "prompt/raw payload logged with secrets" negative control | §2 |
| AT-SEC-8 **NC** | — | an implementation with a `financial_solvency` or `sentiment_about_owner` signal | rejected — no such taxonomy entry exists and none may be added without violating §3 |

## 24. Data model / registry — AT-DATA

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-DATA-1 | `ANL-*` public ID | resolve directly via `GET /intelligence/runs/{id}` | resolves | `B4_DATA_MODEL.md` §5 |
| AT-DATA-2 | `SIG-*`/`OPP-*` | attempt direct top-level resolution | not supported — embedded only, unchanged from registry §B | §5 |
| AT-DATA-3 | new permission codes | count | exactly 2 | §5 |
| AT-DATA-4 | new error codes | count | 0 | `B4_AUTHORIZATION_TENANCY.md` §5 |
| AT-DATA-5 | raw provider response | search retained storage | never found | `B4_DATA_MODEL.md` §4 |
| AT-DATA-6 **NC** | — | an implementation minting a brand-new public-ID prefix for `IntelligenceRun` instead of reusing/reclassifying `ANL-*` | fails "reuse frozen prefixes where already registered" |

## 25. Observability / auditability / explainability — AT-OBS

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-OBS-1 | any completed run | trace `score → components → signals → evidence → snapshot → run → provider metadata` | every link resolvable from stored fields, no log reconstruction needed | §4 |
| AT-OBS-2 | end-user view | inspect | top reasons, risks, missing data, confidence, recommendation — no prompt internals | §5 |
| AT-OBS-3 | any run | search for a stored chain-of-thought field | none exists | §5 |
| AT-OBS-4 | operator surface | inspect | `provider_request_id`/`ai_usage_records` reachable only there, audited on access | §3 |
| AT-OBS-5 | metric labels | inspect | closed enums and `workspace_id` only, no secret | §1 |
| AT-OBS-6 **NC** | — | an implementation returning `overall_priority_score` with no way to retrieve which signals/evidence produced it | this is the brief's explicit "opaque unexplainable single score" negative control | §4 |

## 26. Localization — AT-LOC

| ID | Preconditions | Action | Expected outcome | Invariant |
|---|---|---|---|---|
| AT-LOC-1 | `signal_code` | inspect | stable, non-Arabic, unaffected by locale | §5 |
| AT-LOC-2 | `presentation.*` | inspect | Arabic | §5 |
| AT-LOC-3 | `evidence.extracted_value` | inspect | source-faithful, not translated | §5 |
| AT-LOC-4 **NC** | — | an implementation translating `signal_code` per-workspace locale | breaks automation stability (§`B4_DOWNSTREAM_HANDOFFS.md` §4) |

## 27. Counts

```
ACCEPTANCE_TEST_COUNT = 208
ACCEPTANCE_CATEGORY_COUNT = 26
DUPLICATE_ACCEPTANCE_TESTS = 0
Negative controls = 44
```

Recomputed mechanically (`grep -c` over `^\| AT-` rows, `**NC**` markers within rows, and `##` category headings — the `## 27. Counts` summary section itself is excluded from the category count).

Every Class A decision in `B4_DECISION_REGISTER.md` §1, every failure scenario in `B4_FAILURE_SCENARIOS.md`, and every frontend behavior classified `A` in `B4_FRONTEND_TRACEABILITY.md` maps to at least one row above.

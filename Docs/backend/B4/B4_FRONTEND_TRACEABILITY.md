# B4 — Frontend Traceability

> **B4 status:** Target design only. Every row below was traced from the frozen frontend before any backend concept was invented. Classification A/B/C/D follows B2/B3's convention: **A** = authoritative current product behavior B4 must preserve, **B** = UX prototype requiring a backend target, **C** = future/placeholder, **D** = conflicting/stale/dead.

## 0. Where AI/intelligence concepts live

Two, largely disjoint, frozen frontend subsystems mention "intelligence" or AI judgement:

| Subsystem | File(s) | Engine version | Scope |
|---|---|---|---|
| **S4 — Opportunity Intelligence** | `client/src/domain/intelligence.js`, `client/src/features/intelligence/*` | `S4-MOCK-v1` | scores a **Business** as a sales opportunity from Discovery evidence. **This is B4's scope.** |
| **S8 — Sales Copilot / Governed Agent** | `client/src/domain/sales-ai.js` | `S8-DETERMINISTIC-v1` | summarizes a **Lead + Conversation**, proposes next-best-actions, and (behind an approval gate) executes bounded CRM-side actions. **This is explicitly out of B4's scope** — see §6. |

Conflating the two would make B4 a generic AI service, which §3 of the brief forbids. B4 designs only the first.

## 1. S4 — Opportunity Intelligence (B4 scope)

| # | Behavior | File:line | Frontend field/state | Class |
|---|---|---|---|---|
| FB-01 | Score is the sum of exactly five named dimensions: `activity`(25), `digitalOpportunity`(30), `reachability`(20), `serviceFit`(15), `dataQuality`(10) — summing to 100 | `intelligence.js:5-11` | `dimensionContract` | **A** — the dimension *set*, labels, and max points are an authoritative product contract; the specific point-generation logic behind them is prototype (**B**) |
| FB-02 | `score = Σ(dimension.score)`, bounded `0..100`, and this identity is integrity-checked | `intelligence.js:73`, `:131-132` | `record.score` | **A** |
| FB-03 | Tier thresholds: `high ≥ 80`, `good ≥ 65`, `medium ≥ 40`, else `low` | `intelligence.js:29-34` | `getOpportunityTier()` | **A** |
| FB-04 | Exactly five analysis states: `not_analyzed`, `analyzing`, `analyzed`, `analysis_error`, `insufficient_data` | `intelligence.js:13` | `analysisStatusLabels` | **A** |
| FB-05 | `insufficient_data` → `score = null`, no tier, no misleading number; UI renders `—` never `0` | `intelligence.js:39,74`; `Intelligence.tsx:57-83`; `shared.tsx:26-33` | `record.score === null` | **A** |
| FB-06 | Confidence is a separate float `0..1`, independent of score, bounded and integrity-checked | `intelligence.js:81,134` | `record.confidence` | **A** |
| FB-07 | Signals carry `dimension`, `points`, `polarity ∈ {positive, gap, unknown, neutral}`, `value`, `key`, optional `gapCode`, and an `evidence` string | `data.js:152-156` | `mockModel.signals` | **A** (shape) / **B** (fixture values) |
| FB-08 | `unknown`-polarity signals never contribute a misleading score — an integrity check asserts unknown signals score 0 and never masquerade as negative evidence | `intelligence.js:135` (check H) | — | **A** — negative-control-grade invariant |
| FB-09 | A recommended service is shown only when backed by ≥ 1 gap signal (`service.signalIds.length > 0`) | `intelligence.js:136` (check I), `:45-48` | `record.services` | **A** |
| FB-10 | Full provenance chain is rendered end to end: Source ← Job ← Business ← Signals ← Analysis ← Opportunity | `Intelligence.tsx:280-304` | `record.provenance` | **A** |
| FB-11 | Every analysis requires a resolvable Business → Job → Source chain (Discovery provenance) | `intelligence.js:137` (check J) | — | **A** |
| FB-12 | Same input always yields the same score, tier, and ordered reasons (analysis stability / determinism) | `intelligence.js:138` (check K) | — | **A** — must survive the move to a real backend, including any AI-assisted component |
| FB-13 | Results — and therefore analysis — are only reachable for a Discovery Job in `status = completed` | `DiscoveryResults.tsx:78-89` | `job.status` | **A** — inherited B3 dependency (`B3-INV-8`) |
| FB-14 | "Suggested outreach angle" (`salesApproach`) is templated text chosen deterministically from which gap codes are present | `intelligence.js:57-64` | `record.salesApproach` | **B** — current logic is a fixed template; B4 may make the *phrasing* AI-assisted but the *selection basis* must stay evidence-tied |
| FB-15 | Single-record "تحليل الفرصة" (analyze) action, shown for `not_analyzed`/`analysis_error` | `intelligence.js:210` | `data-intelligence-action="analyze-one"` | **A** — actor-triggered single analysis |
| FB-16 | Same action relabels to "إعادة محاولة التحليل" (retry) when status is `analysis_error` | `intelligence.js:210` | — | **A** — actor-triggered retry is a first-class, separately labeled action |
| FB-17 | Batch actions "تحليل المحدد" (analyze selected) and "تحليل النتائج الظاهرة" (analyze all visible) pass an **unbounded** list of Business IDs to the analyzer in one call | `DiscoveryResults.tsx:308-329` | `runIntelligenceSimulation(rows.map(...))` | **B** — MAJOR cost-control flag. The prototype has no batch-size cap. B4's target design **must** cap batch admission size, exactly the class of gap the B3 retry-rate audit found — see `B4_COST_RATE_LIMIT_MODEL.md` |
| FB-18 | Processing UX: named stage list → gradual score/confidence/signal reveal → batch progress list → distinct "insufficient" outcome | `IntelligenceProcessing.tsx`, `simulation.ts` | `ProcessingState` | **C** — pure client-side animation/simulation detail. The backend target is an ordinary async run with real states; it owes the frontend no staged-reveal protocol |
| FB-19 | **Lead 360 reads Business intelligence live via `lead.businessId` and explicitly does not copy score or opportunity into the Lead** | `Lead360.tsx:106,172` | *"مرجع حي من S4، ولا تنسخ Lead Score أو Opportunity"* | **A** — the authoritative, explicit resolution of the Business-vs-Lead ownership question. See `B4_INTELLIGENCE_SUBJECT_MODEL.md` |
| FB-20 | Exactly one Lead per Business is resolvable by `businessId` (`crmService.getLeadByBusinessId`) | `DiscoveryResults.tsx:407` | — | **A** — consistent with B2's frozen `(workspace_id, business_id)` partial-unique Lead constraint |
| FB-21 | The UI explicitly self-discloses it is a local, deterministic simulation with **no external AI provider connection** | `Intelligence.tsx:117-123`, `DiscoveryResults.tsx:146-152`, `IntelligenceProcessing.tsx:158-160` | *"لا يوجد اتصال بنموذج AI خارجي"* | **B** — this disclosure is the honest prototype label the backend target replaces; B4 preserves the *explainable, evidence-based* spirit while introducing a real, bounded AI-assisted backend |
| FB-22 | Filters/sorts operate on: `opportunityTier`, `minScore` (80/65/40 thresholds), `confidence` (0.8/0.7/0.5 thresholds), `gap` (code), `intelligenceStatus`, `highOpportunity` toggle (`score ≥ 80`); sorts by `score`, `confidence`, `reviews`, `rating`, `name`, `newest` | `intelligence.js:184-192`; `DiscoveryResults.tsx:217-258` | `state.resultFilters` | **A** — every one of these must be server-computable fields |
| FB-23 | Evidence modal shows one signal's `value`, `polarity`, `id`, and `evidence` text, resolved by `signalId` | `IntelligenceModal.tsx:63-93` | — | **A** |
| FB-24 | Score-breakdown modal shows the same five dimension rows plus the total | `IntelligenceModal.tsx:32-60` | — | **A** |
| FB-25 | "Review add to CRM" is an explicit, separate actor step from the Intelligence page; it never auto-creates a Lead | `Intelligence.tsx:266-276` | — | **A** — matches B3's frozen conversion boundary |
| FB-26 | Batch analyze-summary counts by tier are derived from current Business/Intelligence state, "not independent display numbers" | `intelligence.js:244`; `IntelligenceProcessing.tsx:85-96` | — | **A** — any dashboard/summary aggregate must be a live query, never a cached independent counter |
| FB-27 | Dashboard "Today's Opportunity" recommendation card surfaces the top `highOpportunityBusinesses` entry, resolving through an existing Lead if converted | `dashboardProjection.ts:117-140` | `REC-BUSINESS-*` | **B** — confirms a downstream Analytics/dashboard consumer exists and needs a queryable score/tier surface; the aggregate itself is **not** B4's to own (`B4_DOWNSTREAM_HANDOFFS.md` §Analytics) |

## 2. S8 — Sales Copilot / Governed Agent (explicitly out of scope)

Traced for completeness, and to make the scope boundary a decision rather than an oversight:

| # | Behavior | File:line | Class |
|---|---|---|---|
| FB-28 | `runCopilotAnalysis(leadId, conversationId)` produces `conversation_summary`, `qualification`, `next_best_action`, `suggested_reply`, `escalation` records, each with `confidence` and `evidenceRefs`, and explicitly consumes `getBusinessIntelligence()` (B4's own output) as one input among Lead/Conversation/Deal/Task context | `sales-ai.js:33-100` | **C** — a real, later-phase capability. It needs Lead (B2), Conversation (B5), Deal (B6), and Task (B2) simultaneously, none of which except Lead exist as designed backend domains yet. It cannot be B4's, which sits before B5/B6 |
| FB-29 | A governed "Agent" proposes CRM-side actions (`draft_reply`, `create_task`, `update_lead_status`, `update_lead_priority`, `assign_lead`, `create_deal_draft`, `escalate_to_human`) gated by explicit human approval, with a **hard-coded forbidden list**: `send_message`, `close_won_deal`, `close_lost_deal`, `create_revenue`, `create_attribution`, `change_deal_value`, `change_deal_probability`, `delete_lead` | `sales-ai.js:12-18, 123-183` | **C** — out of B4 scope, but its forbidden-action list is strong independent corroboration for `B4_DOWNSTREAM_HANDOFFS.md`'s revenue negative invariant and B4's own "recommend, never execute" rule |
| FB-30 | `state.agentMode` is never `"fully_autonomous"` — an explicit integrity check | `sales-ai.js:195` | **C** — same governance principle B4 must also honor for its own recommendation surface (§`B4_DOWNSTREAM_HANDOFFS.md`) |

Recorded as `B4-D-C002` in `B4_DECISION_REGISTER.md` — a forward dependency, not a B4 deliverable. B4's documents note precisely which of its own fields (`score`, `tier`, `confidence`, `reasons[]`, `analysis.id`) this future capability already relies on in the frozen fixture, so a later phase does not have to guess the shape.

## 3. Counts

```
FRONTEND_AI_BEHAVIOR_COUNT = 30
FRONTEND_TRACE_A = 22
FRONTEND_TRACE_B = 4
FRONTEND_TRACE_C = 4
FRONTEND_TRACE_D = 0
```

(FB-01 and FB-07 each carry a primary `A` classification with a narrower `B` carve-out noted inline — the sole cases counted in §1 are `A` here; the carve-outs are for the reader's precision, not a second row.)

No `D` (conflicting/stale/dead) behavior was found — S4 and S8 are each internally consistent; the only tension is a **scope** question (§0), not a contradiction, and it is resolved by exclusion rather than reconciliation.

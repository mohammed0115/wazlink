# B6 — Frontend Behavior Inventory

> **B6 status:** Target design only. Traced against the frozen frontend at the same commit B0's reference pins (`30bc15e9ca3c0205df2b49e792fce1b8e78a36b1`-era tree, current at HEAD `c18cf7947ee320ea4b7b766e3cf7bdda4d6c44c0`). Scope: `client/src/features/sales/{Deal360,DealModal,Deals,LeadDealControls,Pipeline,shared}.tsx`, `client/src/domain/data.js`, `client/src/domain/analytics-engine.js`, `client/src/domain/sales-ai.js`, plus every cross-domain touch point (CRM, Inbox, AI, Automation, Dashboard, Analytics).

Two prior closed phases already speak directly to this scope: `B2_DOMAIN_OWNERSHIP.md` and `B2_CRM_DOMAIN_BLUEPRINT.md` name `CRM-INV-6/7/8` ("Lead ≠ Deal", "no Lead or Deal state creates recognized revenue") and cite `LeadDealControls.tsx` for "many open Deals per Lead permitted." `B5_B6_B7_BOUNDARIES.md` §1 pre-registers `B5-D-A024` (B5 never mutates Deal/Revenue). This inventory corroborates both independently from the Deal/Pipeline side.

## 1. Scope map

| Surface | Files | B6 relevance |
|---|---|---|
| S6 — Pipeline/Deals (the mock's own name for this feature) | `features/sales/*.tsx`, `data.js` deal/pipeline/stage fixtures + mutators | **This is B6's scope.** Self-discloses its boundary in code comments: *"حد S6 محفوظ صراحة: تغيير حالة Deal هنا لا يضيف RevenueEvent ولا AttributionTouchpoint"* (`Deal360.tsx:5-6`). |
| S2/Revenue (out of scope, read-only anchor) | `mockModel.revenueEvents`, `analytics-engine.js` | Structurally separate entity; never written by any S6 mutator. |
| S8 — Sales Copilot/Agent, deal-adjacent | `domain/sales-ai.js`, `features/ai/{CopilotPanel,Agent}.tsx` | Read-only plus one propose-only action (§ Group H). |
| S9 — Automation, deal-adjacent | `data.js` trigger/condition/forbidden-action catalogs | Deal lifecycle as trigger/condition; deal *mutation* explicitly forbidden. |
| S10 — Analytics/Dashboard | `domain/analytics-engine.js`, `features/{analytics,dashboard}/*.tsx` | Deal snapshot metrics, structurally separate from Revenue metrics. |
| **Dead/legacy, not evidence** | `data.js` `dashboardData`, `metrics`, `getDashboardMetrics()`, `getRevenueSummary()`, `getAttributionIntegrityReport()` | Defined and re-exported through the service bridge but **zero `.tsx` consumers** — excluded from this inventory as evidence (§4). |

## 2. FB-D rows

| ID | Behavior | Source | Class |
|---|---|---|---|
| FB-D01 | A Deal cannot exist without a resolvable Lead; every creation entry point starts from a Lead | `data.js:710-720`, `DealModal.tsx:37-69` | A |
| FB-D02 | Multiple open Deals per Lead permitted when service or title differs (dedupe key = `serviceId` else normalized title) | `data.js:708`, `DealModal.tsx:78-81`, `LeadDealControls.tsx:4-5` | A |
| FB-D03 | Creating against an existing matching-key open deal is a no-op that selects the existing deal, not an error | `data.js:713`, `DealModal.tsx:61-62` | B — B6 returns `409 duplicate_open_deal` referencing the existing `DEAL-*` instead of silently substituting a different resource for what a `POST` asked to create (`B6_FAILURE_CATALOG.md`) |
| FB-D04 | Deal value is a positive-integer SAR amount; no currency selector anywhere; self-asserted `currency==="SAR"` invariant | `data.js:706,715,767`, `DealModal.tsx:113-116` | B — mock never exercises multi-currency; B6 decides currency scope independently (`B6_CURRENCY_MODEL.md`) |
| FB-D05 | Probability is stage-default unless manually overridden; override survives a stage move, absence of an override re-seeds on every stage move | `data.js:670,711,714,724,740` | A |
| FB-D06 | Weighted value = value × probability ÷ 100, computed identically at four independent read sites, never stored | `data.js:691,701`, `Deals.tsx:212`, `Deal360.tsx:114` | A |
| FB-D07 | Deal owner defaults to Lead owner at creation, independently editable thereafter, any workspace user | `DealModal.tsx:138`, `Deal360.tsx:154-160`, `data.js:724,727,732` | A |
| FB-D08 | Expected close date: format-validated ISO date only, no business-rule constraint | `data.js:353` | B |
| FB-D09 | Legacy field-alias back-fill (`name`↔`title`, synthetic historical loss-reason placeholder) on load | `data.js:336-349` | D |
| FB-D10 | Eight-stage single pipeline: 6 open stages + `won`(100%) + `lost`(0%) as `kind`-flagged rows; `pipelineId` filter exists in state but is never rendered | `data.js:262-264` | A (stage shape) / D (dead filter control) |
| FB-D11 | Won/Lost dual-represented: `deal.status` **and** `stage.kind`, kept in sync only by mutator discipline; a third hand-maintained slug map exists for automation matching | `data.js:264,255-260,746-761,856` | B — **B6 resolves this to one authoritative field, `Deal.status`; `stage.kind` becomes a non-existent concept (Won/Lost are never stage rows, `B6-D-A012`)** |
| FB-D12 | Drag-and-drop allows dropping on any open-stage column — forward, backward, or skipping — with zero order validation; only "not a closed stage" is enforced | `Pipeline.tsx:160-165`, `data.js:737-738` | C/B — B6 adopts unrestricted open-stage movement deliberately (`B6-D-A015`), not by accident |
| FB-D13 | UI copy claims only "no drop on closing stages," which is narrower than, but not contradicted by, the actual zero-order-validation code | `Pipeline.tsx:141-147` | C (evidence-precision note) |
| FB-D14 | Pipeline board renders only open-kind stage columns; closing removes a deal from the board entirely | `Pipeline.tsx:107` | A |
| FB-D15 | Per-stage column shows count/unweighted total/weighted total, scoped to open deals only | `Pipeline.tsx:167-179`, `data.js:697-704` | A |
| FB-D16 | Top MetricStrip: open count, total value (unweighted), weighted value, average probability — all open-only, never labeled revenue | `shared.tsx:53-61`, `data.js:688-695` | A |
| FB-D17 | Won/Lost are separate, explicit two-step confirmation-modal flows, never reachable by drag | `Deal360.tsx:83-89`, `DealModal.tsx:168-238` | A |
| FB-D18 | Won confirmation pins probability to 100% and states in-UI that no revenue/attribution is created | `DealModal.tsx:176,180-183`, `data.js:746-752` | A — the strongest single piece of frontend evidence for the revenue firewall (§4) |
| FB-D19 | Lost confirmation requires non-empty free-text reason; a 5-item closed taxonomy is defined in code but never wired to any picker | `DealModal.tsx:203-213,227-230`, `data.js:663` | C (free-text execution) / B (the taxonomy's existence is legitimate intent — B6 restores it as a required structured `loss_reason_code`, `B6_WON_LOST_LOSS_REASONS.md`) |
| FB-D20 | No reopen affordance exists anywhere for Won/Lost; both mutators hard-reject non-open Deals; the won-modal states this explicitly | `DealModal.tsx:176`, `services/index.ts:428-430` | — (excluded from the A/B/C/D tally, §5) **Not evidenced by the frontend at all.** B6 nonetheless adds `ReopenDeal` (`B6-D-A014`) because the task brief requires it and the corpus already has a directly analogous precedent (`reopenConversation`, B5). Recorded honestly as a B6-authored addition beyond frontend evidence, not a misreading of it. |
| FB-D21 | Closed Deal360 becomes read-only; the edit form disappears; closed-note text repeats the no-new-revenue guarantee a third time | `Deal360.tsx:134-179` | A |
| FB-D22 | Deals list: 10 filters (search/status/stage/owner/min-value/probability-floor/expected-close-bucket/source-job/AI-tier/sort), default `status:"open"`; `pipelineId` in state but unrendered | `Deals.tsx:96-160`, `data.js:11` | A (shape) / D (unrendered pipeline filter) |
| FB-D23 | Sort includes weighted value, computed inline in the comparator | `Deals.tsx:51-52` | A |
| FB-D24 | Deals list is a pure cross-domain join view (Lead/Business/Stage/AI-tier resolved by reference); Deal stores none of it | `Deals.tsx:17-26` | A |
| FB-D25 | Deal360's editable form covers exactly title/value/probability/owner/expected-close; stage is not editable there | `Deal360.tsx:135-169` | A |
| FB-D26 | Every field-level change on save produces its own typed activity entry (up to 6 independent entries per save), written into the **Lead's** activity log, not a Deal-owned one | `data.js:722-734` | A (field-level granularity) / B (Deal has no independent event stream in the mock — B6 gives it one via its own events + `deal_stage_transitions`, `B6_STAGE_TRANSITION_HISTORY.md`) |
| FB-D27 | Timeline icon mapping, 9 types including `deal_won`/`deal_lost` | `Deal360.tsx:19-23` | D |
| FB-D28 | Deal360 sidebar carries a dedicated "Revenue Boundary" card restating the guarantee a third time | `Deal360.tsx:291-302` | A |
| FB-D29 | "Next follow-up" shown on Deal/Pipeline cards is Lead-level, not Deal-level, even though Deal-scoped task/appointment read functions exist unused | `data.js:514,676,893`, `Deal360.tsx:250-251` | C — data-model scaffolding exists (Deal↔Task/Appointment linkage) but is never exercised by any rendered component; not confirmed UI behavior |
| FB-D30 | Lead 360's deal panel shows open deals inline, with a distinct "0 open, N historical" state | `LeadDealControls.tsx:18-61` | A |
| FB-D31 | Lead 360 hero shows a raw Deal count (all statuses) alongside Conversation count | `Lead360.tsx:368` | A |
| FB-D32 | Lead's automation panel cross-references Deal-triggered automation runs via an O(n) client join | `LeadControlPanels.tsx:104-112` | B |
| FB-D33 | Inbox's conversation context panel shows the Lead's full deal list read-only; one-directional (Conversation reads Deal via shared Lead; Deal never reads Conversation) | `Inbox.tsx:456,535-545`, `data.js:533` | A — direct evidence for `B6_B5_MESSAGING_BOUNDARY.md` |
| FB-D34 | Copilot's deterministic simulation reads Deals as evidence only, never mutates | `sales-ai.js:40-49`, `CopilotPanel.tsx:143` | A |
| FB-D35 | Agent's only deal-adjacent action opens a prefilled, unsubmitted create-deal modal — never creates a Deal itself | `sales-ai.js:13,18,172,127` | A — structurally identical to B5's FB-30 pattern, the correct AI-boundary shape |
| FB-D36 | Both Agent and Automation carry independently-maintained but agreeing forbidden-action lists blocking all deal-value/probability/close/revenue/attribution mutation | `sales-ai.js:17`, `data.js:815`, `Agent.tsx:5,127-128` | A (the invariant) / B (the duplicated, hand-synced list) |
| FB-D37 | Two deal-related automation triggers (`deal_created`, `deal_stage_changed`), three condition fields (`deal.stage`, `deal.status`, `deal.value`) | `data.js:787,798-800` | B |
| FB-D38 | One seeded automation rule reacts to a deal reaching `proposal`, gated behind mandatory approval, no auto-execute path | `data.js:840` | B |
| FB-D39 | Live analytics engine computes 4 deal-derived snapshot metrics, all explicitly non-revenue-labeled | `analytics-engine.js:15-18` | A |
| FB-D40 | `averageDealValue` is a genuine `deal.value` aggregate, correctly labeled "average won deal," never "revenue" | `analytics-engine.js:190`, `Dashboard.tsx:733` | A |
| FB-D41 | `winRate` = Won ÷ (Won + Lost), a deal-count ratio computed live; a disconnected dead-fixture formula exists and disagrees — not evidence | `analytics-engine.js:190`, `Analytics.tsx:572` | A (live) / C (dead) |
| FB-D42 | No optimistic-concurrency or conflict handling anywhere in the deal-mutation path | `shared/store/appStore.ts:22-26` | C — explicit gap B6 must design for, not preserve |
| FB-D43 | Deal bulk-selection state exists in the store shape but has zero consumers | `data.js:10` | D |
| FB-D44 | No workspace scoping demonstrated anywhere in the Deal/Pipeline fixtures (single implicit workspace) | `mockModel.deals/pipelines/pipelineStages` | D — B1's tenancy model governs regardless |

## 3. Answers to the task's specific questions

| Question | Answer |
|---|---|
| Multiple pipelines, or one implicit? | One (`PIPE-1001`). Data shape is multi-pipeline-capable; nothing in the UI ever creates/switches/filters a second one. |
| Are Won/Lost stages or a separate status? | Both, simultaneously, in the mock (FB-D11) — kept in sync only by mutator discipline, plus a third automation-only slug vocabulary. **B6 resolves this to `Deal.status` alone** (`B6-D-A012`). |
| Backward movement / stage skip / client validation? | Freely allowed via drag, zero order validation, only "not onto a closed stage" enforced; the button UI (adjacent-only) is a rendering choice, not a `moveDealStage` guard. |
| Reopen affordance? | None exists. B6 adds it anyway (`B6-D-A014`), stated explicitly as a B6-authored addition, not a misreading of frontend evidence. |
| Loss-reason field/picker? | Required free-text field; a 5-item closed taxonomy is defined in code with zero UI consumers. B6 restores it as the authoritative structured field. |
| Owner/assignment independent of Lead owner? | Yes — defaults from Lead owner at creation, independently mutable thereafter, own audit entry. |
| Currency — single or multiple? | Single, hard-coded `SAR`, no evidence multi-currency was ever considered. |
| Optimistic concurrency? | None (expected of a synchronous local mock) — an explicit design gap for B6, not a behavior to copy. |

## 4. The Won-Deal-vs-Revenue conflation check

**The live, rendered frontend does not conflate them — it actively guards against it.** Four independent places in the sales feature state the boundary verbatim: `Deal360.tsx:5-6`, `Deal360.tsx:131`, `Deal360.tsx:176`, `Deal360.tsx:291-302` (a dedicated "Revenue Boundary" sidebar card), and the won-confirmation modal itself (`DealModal.tsx:180-183`, plus its success toast: *"— بلا إيراد جديد"*, "without new revenue"). `RevenueEvent` is a structurally separate entity with its own `status`/`recognizedAt`/`amount`, never written by `closeDealAsWon`. The **live** analytics engine (`analytics-engine.js:19`) defines its `revenue_total` metric with the explicit note *"لا يستخدم Deal value"* ("does not use Deal value"); the live Dashboard labels the same metric *"الإيراد المعترف به ... لا يستخدم قيمة الصفقة"* ("Recognized Revenue ... does not use the deal's value"). `averageDealValue` is the one genuine `deal.value` aggregate on the live surface, and it is correctly labeled "average **won deal**," never "revenue" (FB-D40).

**A dead, unreferenced code path in `data.js` (`dashboardData`, `getDashboardMetrics`, `getRevenueSummary`) does use recognition-adjacent labeling** ("الإيراد المحقق" / "إيراد معترف به تجريبيًا" — "revenue recognized, experimentally") over a value that happens to numerically equal the sum of the fixture's three Won deals, because every Won deal in the fixture is paired 1:1 with an identical-amount `RevenueEvent`. This path is **verified to have zero `.tsx` consumers** and its own internal win-rate formula reads a third, disconnected static fixture that disagrees with the live deal count — it was superseded and left unpruned. It is excluded from this inventory as evidence and is recorded here only as a naming-hygiene warning: if ever revived, its label text is exactly the wording `B6_REVENUE_FIREWALL.md` requires B6 to never produce unless genuinely RevenueEvent-sourced and independently timed from Deal-close.

**Conclusion: no conflation in the authoritative frontend surface.** `B6_REVENUE_FIREWALL.md` is written to preserve this separation structurally, not merely by copying frontend labels.

## 5. Counts

Mechanically recounted from the table's own leading `Class` letter (§2), the same discipline `B5_FRONTEND_TRACEABILITY_MATRIX.md` §3 uses for its own split rows:

```
FRONTEND_DEAL_PIPELINE_BEHAVIOR_COUNT = 44   (FB-D01–FB-D44)
FRONTEND_A = 27
FRONTEND_B = 7
FRONTEND_C = 5
FRONTEND_D = 4
UNCLASSIFIED (excluded from A/B/C/D, footnoted in-row) = 1   (FB-D20 — no frontend evidence exists
                                                               either way; B6 adds the capability anyway)
27 + 7 + 5 + 4 + 1 = 44, matching the row count exactly.
```

Rows carrying a secondary/split note (FB-D03, FB-D04, FB-D09/10 already primary-D-excluded above, FB-D11, FB-D12, FB-D19, FB-D22, FB-D26, FB-D36, FB-D41) are counted once, by their leading letter, per the convention above.

# B9 — Frontend Behavior Inventory

> **B9 status:** Target design only. Not closed. Awaits independent CTO verification.

Every row below was read from `client/src` at the frozen baseline `0c424c8a2e5df1bc1bdc9edc80f25f785b26560d`. No row is copied from a documentation summary; each cites a file and a line. Arabic source strings are quoted with an English gloss.

## 1. Classification legend

| Class | Meaning | Weight in B9 |
|---|---|---|
| **A** | Authoritative semantic requirement — the mock states a business invariant the backend must preserve | binding |
| **B** | UX/projection behavior — a presentation or read-model shape, not a truth claim | informative |
| **C** | Fixture/mock/local implementation — an artifact of the in-browser simulation | **not binding**; several are explicitly *rejected* below |
| **D** | Irrelevant/non-authoritative commercial presentation — marketing copy, demo numbers | none |

## 2. Inventory

| ID | Category | Source | Observed behavior | Backend implication | Class |
|---|---|---|---|---|---|
| FB-B9-001 | provenance | `domain/data.js:1` | Header: "one Arabic RTL prototype source of truth links discovery source → job → business → lead → deal → revenue event → attribution touchpoint" | The acquisition chain B9's first-touch resolver walks is a stated product model, not an invention | **A** |
| FB-B9-002 | fixture | `domain/data.js:278` | `revenueEvents: [{ id:"REV-4061", dealId, status:"recognized", amount, recognizedAt, period }]` | Confirms `REV-*` prefix, a `status`, a recognition timestamp; the single `amount` field is a fixture simplification — frozen B0 DTO carries `gross`+`net` | **C** |
| FB-B9-003 | attribution | `domain/data.js:283-284` | `attributionTouchpoints: [{ id:"ATT-4061", revenueEventId, discoveryJobId, type:"first_touch" }]` | Touchpoints are **first-touch** typed and bind one revenue event to one acquisition job | **A** |
| FB-B9-004 | recognition | `domain/data.js:363` | `revenueEvents.filter(e => e.status === "recognized")` | Only `recognized`-status events count as revenue | **A** |
| FB-B9-005 | fixture defect | `domain/data.js:372` | `if (!deal \|\| !lead \|\| !business \|\| !touchpoint \|\| !job \|\| !source) return;` — silently **drops** a recognized event whose provenance chain is incomplete | **REJECTED.** B9 must never let missing provenance erase recognized revenue (`B9_ATTRIBUTION_MODEL.md` §1, `B9-D-A014`) | **C** |
| FB-B9-006 | fixture defect | `domain/data.js:385` | `getRevenueSummary().revenue` is summed **from** `getRevenueAttribution()` — recognition derived from attribution | **REJECTED.** Couples recognition to attribution; B9 inverts this (`B9-D-A013`) | **C** |
| FB-B9-007 | fixture defect | `domain/data.js:426` | Integrity check asserts `attributionTotal === revenueSummary` | Holds only *because* of FB-B9-005/006; in B9 this identity is false whenever unattributed revenue exists — replaced by `recognized = attributed + unattributed` | **C** |
| FB-B9-008 | firewall | `domain/data.js:750` | Deal-won activity detail: "لم يُنشأ RevenueEvent في S6؛ الإغلاق حالة CRM فقط" ("No RevenueEvent was created in S6; closing is CRM state only") | **WON DEAL ≠ RECOGNIZED REVENUE**, stated by the mock itself | **A** |
| FB-B9-009 | firewall | `domain/data.js:770` | Self-check F: "Won لا تنشئ Revenue" ("Won does not create Revenue") | A standing frontend regression control for the same invariant | **A** |
| FB-B9-010 | automation | `domain/data.js:815` | `forbiddenAutomationActions` includes `"create_revenue"`, `"create_attribution"` | Automation must not create financial truth (`B9_B7_AUTOMATION_BOUNDARY.md`) | **A** |
| FB-B9-011 | billing | `domain/data.js:1005` | S11 comment: billing domains "never call providers, retain secrets, gate existing features, or create customer-sales revenue" | Platform billing ≠ customer revenue | **A** |
| FB-B9-012 | billing | `domain/data.js:1065` | Checkout self-check H: "S11 لا ينشئ RevenueEvent أو AttributionTouchpoint" | **PAYMENT SUCCESS ≠ RECOGNIZED REVENUE** | **A** |
| FB-B9-013 | demo copy | `domain/data.js:116` | Dashboard metric "الإيراد المحقق" = 382000, note "إيراد معترف به تجريبيًا" ("demo recognized revenue") | Fixed demo number; no backend meaning | **D** |
| FB-B9-014 | demo copy | `domain/data.js:106` | `metrics.aiRevenue = 146000` | Demo number | **D** |
| FB-B9-015 | selector | `domain/analytics-engine.js:19` | `revenue_total`: entity `RevenueEvent`, aggregation `sum`, field `amount`, `timestampField:"RevenueEvent.recognizedAt"`, `timeMode:"event"`, `currency:"SAR"` | The canonical recognized-revenue selector shape: sum over recognized events, periodised by `recognized_at`, currency-labelled | **A** |
| FB-B9-016 | selector | `domain/analytics-engine.js:20` | `attributed_revenue`: `weighted_sum` of `amount × touchpoint.weight` | A projection shape; the *weight* generalisation is deferred — frozen ADR-008 fixes Phase 1 at first-touch | **B** |
| FB-B9-017 | demo copy | `domain/analytics-engine.js:21` | `ai_influenced_revenue` metric | Not a Phase-1 B9 selector | **D** |
| FB-B9-018 | period | `domain/analytics-engine.js:70` | For all three revenue metrics the period timestamp is `entity.recognizedAt` | `recognized_at` is the reporting-period timestamp | **A** |
| FB-B9-019 | allocation | `domain/analytics-engine.js:87-88` | `getAttributionAllocation` uses `Number(touchpoint.weight ?? 1)` — default weight 1 | A single touchpoint receives 100%; consistent with first-touch | **B** |
| FB-B9-020 | model label | `domain/analytics-engine.js:102` | Trace carries `attributionModel:"multi_touch_weighted"` | **Label only.** Every fixture touchpoint is `type:"first_touch"` with default weight 1, so the *data* is first-touch. Frozen ADR-008 governs: Phase 1 is first-touch, multi-touch deferred | **B** |
| FB-B9-021 | unattributed | `domain/analytics-engine.js:174` | `unattributed: Math.max(0, amount(event.amount) - attributed)` | Unattributed revenue is a **residual of a recognized event**, never a reason to discard it | **A** |
| FB-B9-022 | selector | `domain/analytics-engine.js:176` | `revenueSummary` sums **all** traces' event amounts; `attributed` and `unattributed` are summed separately | Recognition is computed independently of attribution — the correct inversion of FB-B9-006 | **A** |
| FB-B9-023 | data quality | `domain/analytics-engine.js:213` | `getDataQuality` counts `brokenAttribution` and `revenueWithoutAttribution` | Missing attribution is a **reportable data-quality signal**, not an error that voids revenue | **A** |
| FB-B9-024 | recognition | `domain/analytics-engine.js:140` | Events filtered on `event.status === "recognized"` before entering any metric | Same as FB-B9-004, in the newer engine | **A** |
| FB-B9-025 | invariant | `features/analytics/Analytics.tsx:6` | "الإيراد من `RevenueEvent.status = recognized` فقط، والإسناد لا يتجاوز مبلغ الحدث" ("revenue from status=recognized only, and attribution does not exceed the event amount") | Two invariants: recognized-only, and attribution ≤ event amount | **A** |
| FB-B9-026 | reporting | `features/analytics/Analytics.tsx:106-109` | Reconciliation panel renders four figures: إجمالي الإيراد (total), الإيراد المنسوب (attributed), غير منسوب (unattributed), فوق المنسوب (over-attributed) | B9 must expose all four; over-attribution is a first-class reported condition | **A** |
| FB-B9-027 | invariant | `features/analytics/Analytics.tsx:109` | Over-attributed value carries `className={revenue.overAttributed ? "danger" : ""}` | Over-attribution is an alarm state, never normal | **A** |
| FB-B9-028 | invariant | `features/analytics/Analytics.tsx:111` | "Σ الإسناد لا تتجاوز مبلغ RevenueEvent" ("Σ attribution does not exceed the RevenueEvent amount") | Allocation clamp, matching frozen `BACKEND_ANALYTICS_SEMANTICS.md` | **A** |
| FB-B9-029 | firewall | `features/dashboard/Dashboard.tsx:127` | "الإيراد المعترف به" card, trend "تاريخ الاعتراف بالإيراد", note **"لا يستخدم قيمة الصفقة"** ("does not use Deal value") | Recognized revenue is periodised by recognition date and never sourced from `Deal.value` | **A** |
| FB-B9-030 | attribution | `features/dashboard/Dashboard.tsx:128` | Attributed-revenue card note: "من نقاط إسناد صالحة" ("from valid touchpoints") | Only *valid* touchpoints allocate | **A** |
| FB-B9-031 | firewall | `features/sales/DealModal.tsx:5` | "حد S6 محفوظ: الإغلاق كرابحة لا ينشئ `RevenueEvent` ولا `AttributionTouchpoint`" | Closing won creates neither entity | **A** |
| FB-B9-032 | firewall | `features/sales/DealModal.tsx:182` | "لن يُنشأ RevenueEvent ولا AttributionTouchpoint؛ مصدرهما S2 وحده" ("neither will be created; their source is S2 alone") | Revenue/attribution have exactly one origin, outside the Deal surface | **A** |
| FB-B9-033 | firewall | `features/sales/Deal360.tsx:131` | "القيمة والاحتمال والمالك محفوظة في Deal ولا تؤثر على Revenue أو Attribution" ("value, probability and owner live on the Deal and do not affect Revenue or Attribution") | Deal field edits never mutate financial truth | **A** |
| FB-B9-034 | firewall | `features/sales/Deal360.tsx:300` | "تغيير حالة Deal هنا لا يضيف RevenueEvent ولا AttributionTouchpoint" | Deal state transitions are financially inert | **A** |
| FB-B9-035 | firewall | `features/settings/Checkout.tsx:6-7` | "لا يُنشئ نجاحُ الدفع `RevenueEvent` ولا `AttributionTouchpoint` — الفوترة منفصلة عن إيراد العملاء" ("payment success creates neither; billing is separate from customer revenue") | **PaymentSucceeded ≠ RevenueRecognized** | **A** |
| FB-B9-036 | firewall | `features/settings/Billing.tsx:5` | Billing/BillingActivity never becomes `RevenueEvent` or `AttributionTouchpoint` | Platform billing activity is not customer revenue | **A** |
| FB-B9-037 | automation | `features/ai/Agent.tsx:5` | The agent surface "يحظر مركزيًا ... إنشاء Revenue/Attribution" ("centrally forbids ... creating Revenue/Attribution") | AI agent has no financial authority | **A** |
| FB-B9-038 | automation | `domain/sales-ai.js:17` | `forbiddenAgentActions` includes `create_revenue`, `create_attribution` | Second independent statement of FB-B9-037 | **A** |
| FB-B9-039 | automation | `domain/sales-ai.js:128` | Capability matrix rows `["create_revenue","ممنوع","ممنوع"]` ("forbidden","forbidden") — forbidden in **both** columns | Forbidden with and without approval — no approval tier unlocks it | **A** |
| FB-B9-040 | fixture | `domain/intelligence.js:142` | Regression N: "Attributed Revenue − Revenue Summary = 0" | Same artifact as FB-B9-007; not a B9 invariant | **C** |
| FB-B9-041 | fixture | `domain/types.ts:131` | `interface RevenueEvent { id: RevenueEventId; ... }` | Local TS shape, superseded by the frozen B0 DTO | **C** |
| FB-B9-042 | fixture | `domain/types.ts:139-141` | `interface AttributionTouchpoint { id; revenueEventId; ... }` | Local shape; the mock points touchpoint → revenue event | **C** |
| FB-B9-043 | projection | `services/contracts/services.ts:20` | `AnalyticsSnapshot = { funnel; revenue: number; attributedRevenue: number }` | Recognized and attributed are two separate fields in the service contract | **B** |
| FB-B9-044 | projection | `services/dashboardProjection.ts:204` | `recognizedRevenue: overview.metrics.revenue.value` | Dashboard consumes the analytics selector; it does not recompute | **B** |
| FB-B9-045 | marketing | `features/landing/Landing.tsx:22` | "قِس الإيراد المعترف به" — "RevenueEvent / Analytics" | Marketing copy | **D** |
| FB-B9-046 | marketing | `features/auth/Onboarding.tsx:29` | Onboarding item "attribution — قياس الإيراد من المصادر" | Marketing copy | **D** |
| FB-B9-047 | currency | `domain/data.js` workspace record | `workspace: { timezone:"Asia/Riyadh", currency:"SAR", locale:"ar-SA" }` | A workspace has one presentation currency and an IANA timezone; SAR/Asia-Riyadh is the Phase-1 default, not a hardcoded universal | **A** |
| FB-B9-048 | currency | `domain/analytics-engine.js:19-21` | Every revenue metric carries `currency:"SAR"` | Metrics are currency-labelled, never currency-free scalars | **B** |
| FB-B9-049 | attribution | `domain/data.js:284` | Exactly one touchpoint exists per revenue event across the whole fixture (ATT-4061→REV-4061, ATT-4062→REV-4062, ATT-4063→REV-4063) | 1:1 first-touch allocation — one winner, 100% | **A** |
| FB-B9-051 | reporting | `features/analytics/Analytics.tsx:381-420` | The Revenue tab renders a **per-RevenueEvent** table: `trace.event.id`, `event.recognizedAt`, owner, `money(event.amount)`, `touchpointCount`, `money(trace.attributed)`, `money(trace.unattributed)`, and a complete/incomplete chain pill | B9 must expose per-event attributed and unattributed amounts, **plus the owner and the touchpoint count**, not only per-period and per-source totals. All eight rendered columns are served by `GET /revenue-events/{id}/attribution` (`B9_API_DTO_CONTRACTS.md` op 6 and §2a); `owner_ref`, `touchpoint_count` and `trace_status` were added by `B9-FIX.2` | **A** |
| FB-B9-052 | reporting | `features/analytics/AnalyticsModal.tsx:46-47,118-152` | A routed attribution-trace drill-down (`?modal=trace&revenueId=REV-*`) rendering the chain `REV ← ATT ← DEAL ← LEAD ← BUS ← JOB ← SRC` with per-touchpoint amounts, and the footer "المنسوب … غير المنسوب … مجموع الإسناد لا يتجاوز مبلغ RevenueEvent" | B9 must expose the resolved provenance chain and the attribution snapshot for one event, **and the same owner and touchpoint count the table shows** (`AnalyticsModal.tsx:131`). Served by op 6's `chain`, `attribution`, `owner_ref` and `touchpoint_count` | **A** |
| FB-B9-053 | export | `features/analytics/export.ts:11-28`; rows from `domain/analytics-engine.js:217`; invoked at `features/analytics/Analytics.tsx:223` | `exportAnalyticsCsv` writes `nomo-analytics-attribution.csv` from `getAnalyticsExportRows`, whose columns are `revenueEventId, recognizedAt, revenue, attributed, unattributed, dealId, leadId, businessId, ownerId, attributionModel, touchpointCount, jobIds, sourceIds, traceStatus`. The header comment records "لا نقل بيانات إلى خدمة خارجية" — a purely local Blob | An attribution export exists and is per-event, with **fourteen** columns. B9's export rule is that an export reveals *"exactly the API's own DTO fields"* (`B9_SECURITY_PRIVACY.md` §4). `B9-FIX.1`'s op 6 covered twelve of the fourteen and left `ownerId` and `touchpointCount` unserved; `B9-FIX.2` added `owner_ref` and `touchpoint_count` so all fourteen are composable (`B9_API_DTO_CONTRACTS.md` §2a, `AT-API-12`). `attributionModel` is the same **B**-class mock label as `FB-B9-020` and is not adopted | **A** |
| FB-B9-050 | money | `features/sales/DealModal.tsx:152` | "القيمة يجب أن تكون موجبة وبالريال السعودي ... لن يتم إنشاء Revenue أو Attribution" ("value must be positive and in SAR ... no Revenue or Attribution will be created") | Positive-amount discipline and the firewall restated on the same control | **A** |

## 3. Counts

```
FRONTEND_BEHAVIOR_COUNT = 53
FRONTEND_A              = 35
FRONTEND_B              =  6
FRONTEND_C              =  7
FRONTEND_D              =  5
35 + 6 + 7 + 5          = 53   ✓ reconciles against the row count

FRONTEND_DUPLICATE_BEHAVIORS   = 0
FRONTEND_UNSUPPORTED_BEHAVIORS = 0   every A-class behavior has a named B9 operation and field
FRONTEND_OMITTED_MATERIAL_BEHAVIORS = 0
```

**`FRONTEND_UNSUPPORTED_BEHAVIORS` means something specific, and `B9-FIX.2` had to earn it.** It is not "every row cites a file and line" — that is a different property. It is that every **A**-class behavior can be served by a named B9 operation returning named fields. Independent verification found the counter was `0` by assertion while `FB-B9-051`/`052`/`053` each rendered an `owner` and a `touchpointCount` that no B9 DTO carried. The re-check below is field-by-field, against the source, not against these rows.

### 3a. Per-event field coverage, re-read from source

`Analytics.tsx:405-411` renders eight columns; `AnalyticsModal.tsx:126-152` renders the owner, the count and the chain; `analytics-engine.js:217` emits fourteen CSV columns. Each maps to exactly one op-6 field:

| Frontend field | Source line | Op 6 field |
|---|---|---|
| `trace.event.id` / `revenueEventId` | `Analytics.tsx:406` | `revenue_event_ref` |
| `trace.event.recognizedAt` / `recognizedAt` | `:407` | `recognized_at` |
| `trace.owner?.name` / `ownerId` | `:408`, `AnalyticsModal.tsx:131` | **`owner_ref`** |
| `money(trace.event.amount)` / `revenue` | `:409` | `gross_recognized` |
| `fmt(trace.touchpointCount)` / `touchpointCount` | `:410`, `AnalyticsModal.tsx:131` | **`touchpoint_count`** |
| `money(trace.attributed)` / `attributed` | `:411` | `gross_attributed` |
| `money(trace.unattributed)` / `unattributed` | `:412` | `gross_unattributed` |
| `trace.complete` pill / `traceStatus` | `:414` | **`trace_status`** |
| `dealId`, `leadId`, `businessId` | `analytics-engine.js:217` | `chain.deal_ref`, `chain.lead_ref`, `chain.business_ref` |
| `jobIds` | same | `chain.discovery_job_ref` |
| `sourceIds` | same | `attribution.source_ref` / `attribution.source_code` |
| `attributionModel` | same | `attribution.model` (**B**-class label, `FB-B9-020`; B9 returns `first_touch`) |

The three fields in bold were added by `B9-FIX.2`. Semantics for each are derived from the frontend's own expressions rather than assumed — see `B9_API_DTO_CONTRACTS.md` §2a, which records why `touchpoint_count` counts *allocations* and not *candidates considered*.

**`FB-B9-051`, `FB-B9-052` and `FB-B9-053` were added by `B9-FIX.1`.** All three were material and all three were missed by the first pass, which had surveyed `domain/` and the dashboard but not `features/analytics/Analytics.tsx`'s Revenue tab, `AnalyticsModal.tsx`, or `features/analytics/export.ts`. The omission mattered: together they are the frozen frontend's **per-revenue-event** attribution surface, and no B9 operation returned per-event attributed/unattributed figures — op 3 carries no attribution data by design, op 7 is per-period and op 9 is per-source. `B9_API_DTO_CONTRACTS.md` op 6 exists because of these three rows.

## 4. The three rejected fixture behaviors, and why

`FB-B9-005`, `FB-B9-006` and `FB-B9-007` form a single defect in the **older** `data.js` (S2) layer: it drops recognized revenue whose provenance chain is incomplete, then computes "revenue" by summing what survived, then congratulates itself that attribution equals revenue. The identity holds only because the numerator and denominator were made the same number.

The **newer** `analytics-engine.js` (S10) layer independently corrects this: `FB-B9-021` computes unattributed as a residual of the recognized amount, `FB-B9-022` sums recognition over all events regardless of attribution, and `FB-B9-023` demotes missing attribution to a data-quality counter. `FB-B9-026` renders all four figures side by side in the UI.

B9 adopts the newer layer's semantics and explicitly rejects the older one's. This is recorded as `B9-D-A013` (recognition is computed independently of attribution) and `B9-D-A014` (missing provenance never invalidates recognized revenue), and enforced by `AT-UNATT-1`…`AT-UNATT-6`.

## 5. What the frontend does **not** evidence

No frontend surface anywhere creates, edits, or deletes a `RevenueEvent` or `AttributionTouchpoint` — there is no mutation path, no form, and no service method that does so (`services/index.ts` exposes only `getRevenueAttribution`, `getRevenueSummary`, `getAttributionIntegrityReport`, `getAttributionTraces`, all read-only). `FRONTEND_REVENUE_AUTHORITY_LEAKS = 0` is therefore a property of the frozen frontend itself, not only of B9's design.

The one **read** surface that leaves the browser is the local CSV export (`FB-B9-053`): it builds a Blob from already-loaded rows and explicitly transfers nothing to an external service. It is a read projection, not a mutation, so `FRONTEND_REVENUE_AUTHORITY_LEAKS = 0` is unaffected; it does, however, place a real requirement on B9's read contract, which op 6 meets.

There is likewise **no** frontend evidence for: reversals or refunds of recognized revenue, multi-currency revenue, manual recognition UI, reconciliation case management, or partial recognition. Those parts of B9 are derived from frozen B0 contracts (`ReverseRevenueEvent` is a frozen B0 command name) and from the task brief's explicit requirements, and each is recorded as such in `B9_DECISION_REGISTER.md` rather than claimed as frontend-evidenced.

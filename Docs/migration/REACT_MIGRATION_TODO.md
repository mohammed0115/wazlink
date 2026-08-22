# REACT-MIGRATION — قائمة المهام حسب الشحنات S0–S12

**المنهج:** تحويل حرفي يتبع الكود القديم (HTML/CSS/JavaScript) — نفس الترميز ونفس الأصناف ونفس النصوص.
**غير مسموح:** إعادة تصميم، أو تغيير عقود، أو مصدر حقيقة ثانٍ. طبقة النطاق في `client/js/*.js` لا تُمس.
**القياس:** `node scripts/verify-react-coverage.mjs` — يخرج بـ`1` ما دام هناك دالة عرض غير محوَّلة.

**الحالة:** **مكتمل — S0 حتى S12.** طبقة Vanilla محذوفة، والمعمارية feature-based، و19 فحصًا يمر في ثلاث مناطق زمنية.

---

## ✅ S0 — Product Foundation + UI Kit

- [x] `renderUiKit` → `routes/UiKit.tsx` · مسار `#/ui-kit`
- [x] الغلاف: `AppShell` · `Sidebar` · `Topbar` · `NavIcon` · `Brand` · `routeMeta`
- [x] الأساس: `useHashRoute` · `appStore` · `toast` · `styles` · `PageHead` · `Placeholder`

## ✅ S1 — Landing + Login + Onboarding

- [x] `renderLandingTruth` → `routes/Landing.tsx` · مسار `#/`
- [x] `renderLogin` → `routes/Login.tsx` · مسار `#/login`
- [x] `renderOnboarding` + `renderOnboardingStep` → `routes/Onboarding.tsx` · مسار `#/onboarding`
- [x] `renderReferenceScraperScenario` → `routes/ScraperReferenceHero.tsx` (نسختا Landing وDiscovery)

## ✅ S2 — Executive Dashboard

- [x] `renderDashboard` → `routes/Dashboard.tsx` · مسار `#/dashboard`
- [x] حالات العرض الأربع: ready · loading · empty · error

---

## ✅ S3 — Discovery + Jobs

- [x] `renderDiscovery` → `routes/Discovery.tsx` · `#/discovery`
- [x] `renderDiscoveryJobs` → `routes/DiscoveryJobs.tsx` · `#/discovery/jobs`
- [x] `renderDiscoveryJob` → `routes/DiscoveryJob.tsx` · `#/discovery/jobs/:id`
- [x] `renderDiscoveryModal` → `components/DiscoveryModal.tsx` (إلغاء + معاينة شركة)
- [x] محاكاة التقدم → `store/discoverySimulation.ts` (مؤقت لكل Job خارج شجرة React)
- [x] aliases: `#/discovery-jobs` · `#/job`
- [x] تحقق: `verify-s3` 12/12 · البناء · لقطات المتصفح
- [ ] ~~`renderDiscoveryResults`~~ — **دالة ميتة**، استبدلتها `renderIntelligenceResults` في S4
- [ ] أنواع النافذة الخاصة بقرار Scraper/CRM — تُضاف مع سطح النتائج في S4

## ✅ S4 — Results + AI Lead Intelligence

- [x] `renderIntelligenceResults` → `routes/DiscoveryResults.tsx` — 13 فلترًا وجدول النتائج
- [x] `renderIntelligence` → `routes/Intelligence.tsx` · `#/intelligence?business=BUS-####`
- [x] `renderIntelligenceModal` → `components/IntelligenceModal.tsx` (تفسير الدرجة + دليل الإشارة)
- [x] `renderIntelligenceProcessing` → `components/IntelligenceProcessing.tsx` + `store/intelligenceSimulation.ts`
- [x] حالات الـfixtures الأربع تعمل: `BUS-1042` 92 · `BUS-1402` 51 · `BUS-1403` خطأ · `BUS-1404` غير كافية
- [x] لوحة أعمدة Scraper + تصدير CSV محلي → `lib/scraperExport.ts` (UTF-8 BOM)
- [x] نوافذ قرار Scraper/CRM والتصدير الناجح
- [x] alias `#/lead-profile` و`#/results`
- [x] تحقق: `verify-s4` 31/31 · `verify-s4-ux` 11/11 · البناء · لقطة تؤكد 92/100

## ✅ S5 — Lead 360 + CRM

- [x] `renderCrm` → `routes/Crm.tsx` · `#/crm` — 10 فلاتر وحالات العرض الأربع
- [x] `renderLead360` → `routes/Lead360.tsx` · `#/crm/leads/:id`
- [x] `renderCrmModal` → `components/CrmModal.tsx` (Conversion Preview + منع التكرار)
- [x] alias `#/leads` · حماية التكرار تعيد إلى Lead القائمة
- [x] تحقق: `verify-s5` 22/22 · لقطة تؤكد سلسلة SRC-1001 ← JOB-1028 ← BUS-1042 ← LEAD-1042
- [x] `renderLeadDealControls` → `components/LeadDealControls.tsx` (مع S6)
- [x] `renderLeadConversationControls` → `components/LeadControlPanels.tsx` (مع S7)
- [x] `renderLeadAiControls` → `components/LeadControlPanels.tsx` (مع S8)
- [x] `renderLeadAutomationControls` → `components/LeadControlPanels.tsx` (مع S9)

## ✅ S6 — Pipeline + Deals

- [x] `renderPipeline` → `routes/Pipeline.tsx` · `#/pipeline`
- [x] `renderDeals` → `routes/Deals.tsx` · `#/deals`
- [x] `renderDeal360` → `routes/Deal360.tsx` · `#/deals/:id`
- [x] `renderDealModal` → `components/DealModal.tsx`
- [x] السحب والإفلات بين المراحل (`moveDealStage`)
- [x] حد S6: الإغلاق كرابحة لا ينشئ `RevenueEvent`
- [x] تحقق: `verify-s6` 22/22

## ✅ S7 — Inbox + WhatsApp Mock

- [x] `renderInbox` → `routes/Inbox.tsx` · `#/inbox` و`#/inbox/:conversationId`
- [x] Composer بشري فقط · `senderType = user`
- [x] انتقال حالة الرسالة: `queued → sent → delivered` كـ`useEffect`
- [x] alias `#/whatsapp` · تعليم المقروء عند الفتح
- [x] تحقق: `verify-s7` 25/25

## ✅ S8 — Sales Copilot + AI Agent

- [x] `renderCopilotWorkspace` → `routes/Copilot.tsx` · `#/copilot`
- [x] `renderAgentWorkspace` → `routes/Agent.tsx` · `#/agent`
- [x] `renderCopilotPanel` → `components/CopilotPanel.tsx` (داخل Inbox وLead 360)
- [x] «استخدام الرد» يملأ Composer فقط ولا يرسل
- [x] سياسة الموافقة: `proposed → approved/rejected → executed`
- [x] تحقق: `verify-s8` 22/22 · `verify-s8-runtime` 11/11

## ✅ S9 — Automation + Tasks + Appointments

- [x] `renderAutomation` → `routes/Automation.tsx` · `#/automation` و`#/automation/rules/:id`
- [x] `renderTasksWorkspace` → `routes/Tasks.tsx` · `#/tasks`
- [x] `renderAppointmentsWorkspace` → `routes/Appointments.tsx` · `#/appointments`
- [x] `renderAutomationModal` → `components/AutomationModal.tsx`
- [x] `renderAppointmentModal` → `components/AppointmentModal.tsx`
- [x] قائمة انتظار الموافقة · `manual_only` · idempotency · تحذير التداخل
- [x] تحقق: `verify-s9` 22/22 **في كل منطقة زمنية**

## ✅ S10 — Analytics + Revenue Attribution

- [x] `renderAnalytics` → `routes/Analytics.tsx` + 6 أقسام:
  - [x] `#/analytics` الملخص التنفيذي
  - [x] `#/analytics/funnel` القمع
  - [x] `#/analytics/revenue` الإيراد والإسناد
  - [x] `#/analytics/sources` أداء المصادر
  - [x] `#/analytics/sales` Pipeline والمبيعات
  - [x] `#/analytics/ai` الذكاء والأتمتة
- [x] `renderAnalyticsModal` → `components/AnalyticsModal.tsx` (Drill-down وRevenue Trace)
- [x] تصدير CSV محلي · إفصاح event مقابل snapshot
- [x] تحقق: `verify-s10` 29/29

## ✅ S11 — Settings + Integrations + Billing

- [x] `renderSettings` → `routes/Settings.tsx` · `#/settings` و`/team` و`/notifications`
- [x] `renderIntegrations` → `routes/Integrations.tsx` · `#/settings/integrations`
- [x] `renderBilling` → `routes/Billing.tsx` · `#/settings/billing`
- [x] `renderCheckout` → `routes/Checkout.tsx` (Checkout التجريبي بأربع خطوات)
- [x] `bindS11Events` → معالجات داخل المكوّنات
- [x] aliases `#/integrations` و`#/billing` · فصل الفوترة عن `RevenueEvent`
- [x] تحقق: `verify-s11` 20/20 · `verify-payment-checkout` 14/14

## ✅ S12 — E2E + Final Polish

- [x] حذف `client/js/` بالكامل — 15 ملف عرض
- [x] فصل دوال العرض عن طبقة النطاق ونقلها إلى `client/src/domain/`
- [x] إعادة الهيكلة إلى `features/` + `shared/` + `domain/` + `styles/`
- [x] تحديث الفحوص التسعة التي تقرأ نص `app.js` لتقرأ مصادر React
- [x] `verify-s8-runtime` أُعيد كتابته ليرسم مكوّن React عبر SSR
- [x] `verify-react-coverage` → `verify-architecture` كحارس معماري (18/18)
- [x] إضافة Escape واستعادة التركيز لكل النوافذ السبع
- [x] تحقق: `verify-s12` 24/24 · الانحدار **19/19** في UTC وRiyadh وLos Angeles

---

## مهام موازية (خارج الشحنات)

- [x] حذف `sales.js` و`operations.js` و13 وحدة عرض أخرى
- [x] GAP-001: بادئات `ENTITY_MODEL §11` صارت `COND`/`AUTORUN`/`AUTOEXEC` مطابقة للكود
- [x] GAP-002: `CopilotDecisionRecord` موسوم «معلن ولم يُنفَّذ»
- [x] GAP-003: وُثقت 5 كيانات ناقصة أهمها `AUTOACT-`
- [x] GAP-004: `README.md` بمتطلبات Node والتثبيت والتشغيل والفحوص
- [x] نقل كل الوثائق إلى `Docs/` بتصنيف واضح

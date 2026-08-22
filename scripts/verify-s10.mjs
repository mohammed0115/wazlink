import { readFile } from "node:fs/promises";
import { mockModel } from "../client/src/domain/data.js";
import {
  analyticsDefaultContext,
  analyticsMetricDefinitions,
  getAppointmentAnalytics,
  getAnalyticsExportRows,
  getAnalyticsFunnel,
  getAnalyticsOverview,
  getAnalyticsOptions,
  getAttributionAllocation,
  getAttributionTraces,
  getAutomationAnalytics,
  getConversationAnalytics,
  getDataQuality,
  getIntelligenceAnalytics,
  getMetricDrilldown,
  getSourcePerformance,
  getTaskAnalytics,
  normalizeAnalyticsContext
} from "../client/src/domain/analytics-engine.js";

const results = [];
const check = (id, pass, detail) => results.push({ id, pass:Boolean(pass), detail });
const snapshot = () => JSON.stringify({
  businesses:mockModel.businesses,
  leads:mockModel.leads,
  deals:mockModel.deals,
  messages:mockModel.messages,
  revenueEvents:mockModel.revenueEvents,
  attributionTouchpoints:mockModel.attributionTouchpoints,
  tasks:mockModel.tasks,
  appointments:mockModel.appointments,
  automationRules:mockModel.automationRules,
  automationRuns:mockModel.automationRuns,
  automationActionExecutions:mockModel.automationActionExecutions
});

const before = snapshot();
const overview = getAnalyticsOverview(analyticsDefaultContext);
const funnel = getAnalyticsFunnel(analyticsDefaultContext);
const traces = getAttributionTraces(analyticsDefaultContext);
const sourceRows = getSourcePerformance(analyticsDefaultContext);
const secondary = {
  intelligence:getIntelligenceAnalytics(analyticsDefaultContext),
  conversations:getConversationAnalytics(analyticsDefaultContext),
  automation:getAutomationAnalytics(analyticsDefaultContext),
  appointments:getAppointmentAnalytics(analyticsDefaultContext),
  tasks:getTaskAnalytics(analyticsDefaultContext)
};
const after = snapshot();
const analyticsUiSource = await readFile(new URL("../.ui-sources/analytics.txt", import.meta.url), "utf8");
const dashboardSource = await readFile(new URL("../.ui-sources/dashboard.txt", import.meta.url), "utf8");

check("A metric registry", analyticsMetricDefinitions.length >= 15 && new Set(analyticsMetricDefinitions.map((item) => item.id)).size === analyticsMetricDefinitions.length, "تعريفات المقاييس فريدة ومعلنة.");
check("B read-only selectors", before === after, "Selectors S10 لا تغير حقائق S0–S9.");
check("C context defaults", JSON.stringify(normalizeAnalyticsContext({})) === JSON.stringify(analyticsDefaultContext), "السياق الافتراضي ثابت.");
check("D custom date safety", normalizeAnalyticsContext({ dateRange:"custom", customStart:"2026-08-15", customEnd:"2026-08-01" }).dateRange === "all", "النطاق المخصص غير الصالح لا ينتج أرقامًا مضللة.");
check("E metrics traceability", Object.values(overview.metrics).every((metric) => Array.isArray(metric.entityIds)), "كل metric يحتفظ بمعرفات drill-down.");
check("F open pipeline", overview.metrics.openPipeline.value === overview.sales.openDeals.reduce((sum, deal) => sum + deal.value, 0), "قيمة Pipeline من Deals المفتوحة فقط.");
check("G weighted pipeline", overview.metrics.weightedPipeline.value === overview.sales.openDeals.reduce((sum, deal) => sum + deal.value * (deal.probability ?? deal.probabilityOverride ?? 0) / 100, 0), "Pipeline المرجحة = value × probability.");
check("H score separation", overview.metrics.weightedPipeline.value !== overview.sales.openDeals.reduce((sum, deal) => sum + deal.value * 0.92, 0), "لم تستخدم Opportunity Score كاحتمال Deal.");
check("I funnel order", funnel.stages.map((stage) => stage.id).join(",") === "discovered,enriched,high,lead,contacted,qualified,deal,won,revenue", "مراحل القمع ثابتة ومعلنة.");
check("J funnel entity sets", funnel.stages.every((stage) => stage.count === new Set(stage.entityIds).size), "كل مرحلة تعد Business فريدة.");
check("K conversion denominator", funnel.stages.slice(1).every((stage, index) => stage.denominator === funnel.stages[index].count), "كل conversion تقارن بالمرحلة السابقة فقط.");
check("K2 nested funnel cohorts", funnel.stages.slice(1).every((stage, index) => stage.entityIds.every((id) => funnel.stages[index].entityIds.includes(id)) && (stage.conversion === null || stage.conversion <= 100)), "كل cohort فرعية من المرحلة السابقة ولا توجد نسبة تحويل أعلى من 100%.");
check("L zero denominator", getAnalyticsFunnel({ sourceId:"__none__" }).stages.slice(1).every((stage) => stage.conversion === null), "المقام الصفري يعرض null لا نسبة مخترعة.");
check("M revenue totals", overview.metrics.revenue.value === traces.reduce((sum, trace) => sum + trace.event.amount, 0), "الإيراد من RevenueEvent recognized فقط.");
check("N attribution conservation", traces.every((trace) => trace.attributed <= trace.event.amount && trace.overAttributed === 0), "الإسناد لا يتجاوز RevenueEvent.");
check("O attribution trace", traces.some((trace) => trace.complete && trace.deal && trace.lead && trace.business && trace.touchpoints.some((point) => point.job && point.source)), "هناك trace مكتمل Revenue → Deal → Lead → Business → Job → Source.");
check("P attribution reconciliation", overview.metrics.attributedRevenue.value + overview.revenue.unattributed === overview.metrics.revenue.value, "المعروف وغير المنسوب يطابقان إجمالي الإيراد.");
check("Q source filter", (() => { const source = getAnalyticsOptions().sources[0]; const scoped = getAnalyticsOverview({ sourceId:source.id }); return scoped.context.sourceId === source.id && scoped.metrics.businessesDiscovered.value <= overview.metrics.businessesDiscovered.value; })(), "فلتر المصدر يطبق في context واحد.");
check("R job filter", (() => { const job = getAnalyticsOptions().jobs[0]; const scoped = getAnalyticsOverview({ jobId:job.id }); return scoped.context.jobId === job.id && scoped.metrics.businessesDiscovered.value <= overview.metrics.businessesDiscovered.value; })(), "فلتر Job يطبق في context واحد.");
check("S source performance", sourceRows.every((row) => row.businesses >= row.leads || row.leadConversion === null), "تحويل المصدر يستخدم denominator Business المعلن.");
check("T drilldown", analyticsMetricDefinitions.every((definition) => getMetricDrilldown(definition.id).definition?.id === definition.id), "كل metric يفتح definition وIDs قابلة للتتبع.");
check("U export rows", getAnalyticsExportRows().every((row) => "revenueEventId" in row && "ownerId" in row && row.attributionModel === "multi_touch_weighted" && "touchpointCount" in row && "traceStatus" in row), "تصدير CSV يحمل provenance وowner وmulti-touch وإشارة اكتمال trace.");
check("V data quality", (() => { const quality=getDataQuality({ dateRange:"today" }); return typeof quality.severity === "string" && Array.isArray(quality.rows) && quality.structural && quality.coverage && typeof quality.coverage.missingTimestamps === "number"; })(), "جودة البيانات مقسمة إلى سلامة مراجع وتغطية تحليل/زمن.");
check("W secondary metrics", secondary.intelligence && secondary.conversations && secondary.automation && secondary.appointments && secondary.tasks, "تحليلات AI/Inbox/Automation/Appointments/Tasks متاحة.");
check("X no operational writes", before === snapshot(), "لا رسالة أو Task أو Deal أو Revenue أو Attribution أنشئت خلال التحليل.");
check("Y event and snapshot semantics", (() => { const eventDrilldown=getMetricDrilldown("revenue_total",{dateRange:"today"});const snapshotDrilldown=getMetricDrilldown("open_pipeline",{dateRange:"today"});return eventDrilldown.definition?.timeMode === "event" && eventDrilldown.period === "اليوم" && snapshotDrilldown.definition?.timeMode === "snapshot" && snapshotDrilldown.period.includes("لقطة حالية"); })(), "Event metrics تعتمد timestamp محددًا ضمن الفترة؛ snapshot metrics تفصح أنها لقطة حالية.");
check("Z zero denominator semantics", (() => { const zeroFunnel=getAnalyticsFunnel({ sourceId:"__none__" }); return zeroFunnel.stages.slice(1).every((stage)=>stage.conversion===null) && analyticsUiSource.includes("لا يوجد مقام سابق") && dashboardSource.includes("لا يوجد مقام سابق"); })(), "denominator صفر يبقى null ويعرض — بدل 0% أو NaN.");
check("AA owner and multi-touch", (() => { const fixture=getAttributionAllocation(100,[{id:"T1",weight:.6},{id:"T2",weight:.4}]);return traces.every((trace)=>trace.owner?.id === trace.deal?.ownerId && trace.attributionModel === "multi_touch_weighted" && trace.touchpointCount === trace.touchpoints.filter((point)=>point.touchpoint).length) && fixture.reduce((sum,item)=>sum+item.attributedAmount,0) === 100; })(), "owner في الإيراد هو Deal owner، ونموذج multi-touch weighted يحافظ على مجموع المبالغ المنسوبة.");
check("AB dashboard and modal accessibility", dashboardSource.includes("getAnalyticsOverview({ ...state.analyticsContext") && dashboardSource.includes("getAttributionTraces") && analyticsUiSource.includes('role="dialog"') && analyticsUiSource.includes('aria-modal="true"') && analyticsUiSource.includes("aria-labelledby"), "Dashboard يستخدم selectors S10، وModal يملك ARIA ومسار إغلاق صريح.");

const failed = results.filter((item) => !item.pass);
for (const item of results) console.log(`${item.pass ? "PASS" : "FAIL"} ${item.id}: ${item.detail}`);
console.log(`\nS10 verification: ${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);

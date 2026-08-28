import {
  analyticsService,
  automationFeatureService,
  crmService,
  dashboardService,
  discoveryService,
  entitlementService,
  messagingService,
  pipelineService,
} from "@services";
import { journeyProjection } from "./journey";
import type {
  AnalyticsAttributionTraceView,
  AnalyticsOverviewView,
  AnalyticsSourcePerformanceView,
  DashboardAttentionItem,
  DashboardNearClosingDeal,
  DashboardPlanContext,
  DashboardProjection,
  DashboardProjectionService,
  DashboardRecommendation,
  DealDetailView,
  DiscoveryJobSummary,
  LeadRecordView,
  PipelineStageView,
  TaskView,
} from "./contracts/services";

const finite = (value: unknown, fallback = 0): number => typeof value === "number" && Number.isFinite(value) ? value : fallback;
const text = (value: unknown, fallback = ""): string => typeof value === "string" ? value : fallback;
const asLeadRows = (): LeadRecordView[] => crmService.listLeads() as LeadRecordView[];
const asDealRows = (): DealDetailView[] => pipelineService.listDeals() as DealDetailView[];
const asTaskRows = (leads: readonly LeadRecordView[]): TaskView[] => leads.flatMap((lead) => crmService.getLeadTasks(lead.id) as TaskView[]);
const routeForLead = (id: string): string => `crm/leads/${encodeURIComponent(id)}`;
const routeForDeal = (id: string): string => `deals/${encodeURIComponent(id)}`;

function attentionItem(
  id: string,
  tone: DashboardAttentionItem["tone"],
  title: string,
  description: string,
  action: string,
  route: string,
  entityId?: string,
): DashboardAttentionItem {
  return { id, tone, title, description, action, route, entityId };
}

function planContext(): DashboardPlanContext {
  const plan = entitlementService.currentPlan();
  const usage = entitlementService.usageFor("discoveryRuns");
  const decision = entitlementService.evaluate("discovery.basic");
  const limit = usage.limit.kind === "finite" ? usage.limit.value : null;
  return {
    planId: plan.id,
    planName: plan.name,
    discoveryRunsUsed: usage.used,
    discoveryRunsLimit: limit,
    discoveryRunsRemaining: usage.remaining,
    discoveryStatus: usage.status,
    discoveryAllowed: decision.allowed,
    billingRoute: "settings/billing",
  };
}

function latestCompletedJob(jobs: readonly DiscoveryJobSummary[]): DiscoveryJobSummary | null {
  return [...jobs]
    .filter((job) => job.status === "completed")
    .sort((a, b) => text(b.completedAt || b.updatedAt || b.createdAt).localeCompare(text(a.completedAt || a.updatedAt || a.createdAt)))[0] || null;
}

function getAttentionItems(
  leads: readonly LeadRecordView[],
  deals: readonly DealDetailView[],
  tasks: readonly TaskView[],
  jobs: readonly DiscoveryJobSummary[],
  plan: DashboardPlanContext,
): DashboardAttentionItem[] {
  const items: Array<DashboardAttentionItem & { rank: number }> = [];
  const conversations = messagingService.listConversations();
  const waiting = conversations
    .filter((conversation) => messagingService.getConversationNeedsReply(conversation))
    .sort((a, b) => text(b.lastMessageAt).localeCompare(text(a.lastMessageAt)))[0];
  if (waiting?.id) {
    items.push({ ...attentionItem("ATTN-CONVERSATION", "danger", "محادثة تحتاج ردًا", "آخر رسالة واردة ما زالت تنتظر تدخلًا بشريًا.", "فتح المحادثة", `inbox/${encodeURIComponent(waiting.id)}`, waiting.id), rank: 1 });
  }

  const overdue = tasks.filter((task) => task.status === "overdue").sort((a, b) => text(a.dueAt).localeCompare(text(b.dueAt)))[0];
  if (overdue?.id && overdue.leadId) {
    items.push({ ...attentionItem("ATTN-TASK", "warning", "متابعة متأخرة", text(overdue.title, "توجد مهمة متأخرة مرتبطة بعميل."), "فتح Lead 360", routeForLead(overdue.leadId), overdue.id), rank: 2 });
  }

  const openDeals = deals.filter((deal) => deal.status === "open");
  const highValueDeal = [...openDeals].sort((a, b) => finite(b.value) * finite(b.probability) - finite(a.value) * finite(a.probability))[0];
  if (highValueDeal?.id) {
    items.push({ ...attentionItem("ATTN-DEAL", "warning", "صفقة مفتوحة تحتاج خطوة", `${text(highValueDeal.name, "صفقة مفتوحة")} بقيمة مرجحة ${Math.round(finite(highValueDeal.value) * finite(highValueDeal.probability) / 100).toLocaleString("ar-SA")} ر.س.`, "فتح الصفقة", routeForDeal(highValueDeal.id), highValueDeal.id), rank: 3 });
  }

  const automation = automationFeatureService.getAutomationMetrics();
  if (finite(automation.failed) > 0) {
    items.push({ ...attentionItem("ATTN-AUTOMATION", "warning", "تشغيل أتمتة يحتاج مراجعة", `${finite(automation.failed)} تشغيلات فشلت وفق سجل الأتمتة المحلي.`, "فتح الأتمتة", "automation"), rank: 4 });
  }

  const job = latestCompletedJob(jobs);
  const jobResultCount = finite(job?.current, finite(job?.resultCount));
  if (job?.id && jobResultCount > finite(job.crmAdded)) {
    items.push({ ...attentionItem("ATTN-DISCOVERY", "info", "نتائج اكتشاف جاهزة للمراجعة", `${jobResultCount - finite(job.crmAdded)} نتائج Business لم تُراجع في CRM بعد.`, "مراجعة النتائج", `discovery/results?job=${encodeURIComponent(job.id)}`, job.id), rank: 5 });
  }

  if (!plan.discoveryAllowed) {
    items.push({ ...attentionItem("ATTN-ENTITLEMENT", "info", "الاكتشاف غير متاح ضمن الحالة الحالية", "تحقق من الاستخدام أو راجع الباقة قبل بدء عملية جديدة.", "مراجعة الباقة", plan.billingRoute, plan.planId), rank: 6 });
  }

  return items.sort((a, b) => a.rank - b.rank).slice(0, 5).map(({ rank: _rank, ...item }) => item);
}

function getRecommendations(
  overview: AnalyticsOverviewView,
  deals: readonly DealDetailView[],
  jobs: readonly DiscoveryJobSummary[],
): DashboardRecommendation[] {
  const recommendations: DashboardRecommendation[] = [];
  const topBusinessId = overview.metrics.highOpportunityBusinesses.entityIds[0];
  const business = topBusinessId ? dashboardService.listBusinesses().find((item) => item.id === topBusinessId) : null;
  const businessLead = business ? crmService.getLeadByBusinessId(business.id) : null;
  const businessContext = businessLead ? journeyProjection.getContext(businessLead.id) : null;
  if (business) {
    recommendations.push({
      id: `REC-BUSINESS-${business.id}`,
      kind: "فرصة اليوم",
      title: business.name,
      score: undefined,
      reason: businessContext?.lead ? "سجل Business عالي الفرصة مرتبط بعميل موجود في CRM." : "سجل Business عالي الفرصة مشتق من Intelligence الحالية.",
      action: "راجع الدليل قبل بدء التواصل.",
      primary: businessContext?.lead ? "فتح العميل" : "فتح الذكاء",
      primaryRoute: businessContext?.lead ? `crm/leads/${encodeURIComponent(businessContext.lead.id)}` : `intelligence?business=${encodeURIComponent(business.id)}`,
      businessId: business.id,
      entityId: businessContext?.lead?.id || business.id,
    });
  }

  const openDeal = [...deals].filter((deal) => deal.status === "open").sort((a, b) => finite(b.value) - finite(a.value))[0];
  if (openDeal?.id) {
    const dealBusiness = pipelineService.getDealBusiness(openDeal);
    recommendations.push({
      id: `REC-DEAL-${openDeal.id}`,
      kind: "خطوة Pipeline",
      title: text(openDeal.name, openDeal.id),
      reason: "صفقة مفتوحة بقيمة فعلية تحتاج متابعة يدوية.",
      action: "افتح تفاصيل الصفقة وراجع الخطوة التالية.",
      primary: "فتح الصفقة",
      primaryRoute: routeForDeal(openDeal.id),
      businessId: dealBusiness?.id,
      entityId: openDeal.id,
    });
  }

  const job = latestCompletedJob(jobs);
  if (job?.id) {
    recommendations.push({
      id: `REC-JOB-${job.id}`,
      kind: "إشارة اكتشاف",
      title: text(job.keyword || job.query, job.id),
      reason: "نتائج مكتملة يمكن مراجعتها قبل التحويل اليدوي إلى CRM.",
      action: "راجع النتائج مع الحفاظ على Business وJob IDs.",
      primary: "عرض النتائج",
      primaryRoute: `discovery/results?job=${encodeURIComponent(job.id)}`,
      entityId: job.id,
    });
  }
  return recommendations.slice(0, 4);
}

function getNearClosingDeals(deals: readonly DealDetailView[]): DashboardNearClosingDeal[] {
  return [...deals]
    .filter((deal) => deal.status === "open")
    .sort((a, b) => finite(b.probability) - finite(a.probability) || finite(b.value) - finite(a.value))
    .slice(0, 3)
    .map((deal) => {
      const stage = pipelineService.getDealStage(deal) as PipelineStageView | null;
      return {
        id: text(deal.id),
        businessId: text(pipelineService.getDealBusiness(deal)?.id),
        stage: text(stage?.name, "مرحلة مفتوحة"),
        value: finite(deal.value),
        probability: finite(deal.probability),
        lastActivity: text(deal.updatedAt, "غير محدد"),
        nextAction: "مراجعة الخطوة التالية",
      };
    })
    .filter((deal) => Boolean(deal.id && deal.businessId));
}

function getJourneyStatus(overview: AnalyticsOverviewView, conversations: number, deals: readonly DealDetailView[]): DashboardProjection["journey"] {
  const leads = overview.metrics.leadsCreated.value;
  const openDeals = deals.filter((deal) => deal.status === "open").length;
  const bottleneck = conversations === 0 ? "لا توجد محادثات مرتبطة بعد" : openDeals === 0 ? "لا توجد صفقات مفتوحة بعد" : "المتابعة والقرار التجاري";
  return {
    discovered: overview.metrics.businessesDiscovered.value,
    leads,
    conversations,
    deals: deals.length,
    won: overview.metrics.wonDeals.value,
    recognizedRevenue: overview.metrics.revenue.value,
    bottleneck,
  };
}

export const dashboardProjection: DashboardProjectionService = {
  getSnapshot(): DashboardProjection {
    const overview = analyticsService.getOverview({ dateRange: "all" });
    const leads = asLeadRows();
    const deals = asDealRows();
    const tasks = asTaskRows(leads);
    const jobs = discoveryService.listDiscoveryJobs() as DiscoveryJobSummary[];
    const plan = planContext();
    const conversations = messagingService.listConversations();
    const attentionItems = getAttentionItems(leads, deals, tasks, jobs, plan);
    return {
      attentionItems,
      aiRecommendations: getRecommendations(overview, deals, jobs),
      nearClosingDeals: getNearClosingDeals(deals),
      journey: getJourneyStatus(overview, conversations.length, deals),
      plan,
    };
  },
};

export type DashboardAnalyticsTrace = AnalyticsAttributionTraceView;
export type DashboardAnalyticsSource = AnalyticsSourcePerformanceView;
export { journeyProjection };

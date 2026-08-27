import { dashboardService } from "@services";
/**
 * الرئيسية — لوحة القيادة التنفيذية (S2 / S2-FIX).
 *
 * كل مؤشر مالي يقرأ من selectors S10 نفسها عبر `getAnalyticsOverview`،
 * ولا يعاد احتساب الإيراد أو Pipeline داخل view model منفصل.
 * الإفصاح عن event مقابل snapshot محفوظ كما اعتمدته S10.
 */
import { useState, type CSSProperties } from "react";
import { appConfig } from "@config/env";
import { getAgentActions } from "@domain/sales-ai.js";
import { analyticsService, onboardingService, workspaceService } from "@services";

const { getOverview: getAnalyticsOverview, getAttributionTraces, getSourcePerformance } = analyticsService as typeof analyticsService & Record<string, any>;
import { go } from "../../shared/router/useHashRoute";
import { useSession } from "../../shared/context/AppProviders";
import { useToast } from "../../shared/store/toast";
import { fmt } from "../../shared/lib/format";
import type { AttributionSummaryRow } from "../../domain/types";

const money = (value: number) => `${fmt(value)} ر.س`;

const timeframes = ["اليوم", "7 أيام", "30 يومًا", "هذا الربع"];

const dateRangeByTimeframe: Record<string, string> = {
  "اليوم": "today",
  "7 أيام": "last7",
  "30 يومًا": "last30",
  "هذا الربع": "all",
};

const timeframeTitles: Record<string, string> = {
  "اليوم": "ملخص أداء المبيعات واكتشاف العملاء اليوم",
  "7 أيام": "ملخص أداء المبيعات واكتشاف العملاء خلال آخر 7 أيام",
  "30 يومًا": "ملخص أداء المبيعات واكتشاف العملاء خلال آخر 30 يومًا",
  "هذا الربع": "ملخص أداء المبيعات واكتشاف العملاء خلال هذا الربع",
};

const viewStates: [string, string][] = [
  ["ready", "مكتمل"],
  ["loading", "تحميل"],
  ["empty", "فارغ"],
  ["error", "خطأ"],
];

const feedbackConfigurations: Record<string, [string, string, string, string]> = {
  loading: ["تحميل", "يتم تجهيز ملخص الأداء التجريبي…", "↻", "loading"],
  empty: ["لا توجد بيانات كافية بعد", "ابدأ أول عملية اكتشاف لبناء لوحة الأداء ومسار المتابعة.", "○", "empty"],
  error: ["تعذر عرض الملخص التجريبي", "هذه حالة واجهة مخصصة للفحص فقط، ويمكن العودة إلى البيانات التجريبية.", "!", "error"],
};

const agentActionLabels: Record<string, string> = {
  create_task: "إنشاء مهمة",
  update_lead_status: "تحديث حالة العميل",
  escalate_to_human: "تصعيد بشري",
};

const agentStatusLabels: Record<string, string> = {
  proposed: "بانتظار الموافقة البشرية",
  executed: "نُفذ بسجل تدقيق",
  failed: "فشل تجريبي واضح",
};

function StateSwitcher({ view, onChange }: { view: string; onChange: (id: string) => void }) {
  return (
    <section className="dashboard-state-panel" aria-label="حالات عرض لوحة التحكم">
      <span>حالات اختبار الواجهة:</span>
      <div>
        {viewStates.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={view === id ? "active" : ""}
            onClick={() => onChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

/** ينتقل إلى المسار مع تمرير هوية السجل في query بدل mixed global state. */
function openRoute(route: string, businessId?: string) {
  if (!businessId) return go(route);
  const separator = route.includes("?") ? "&" : "?";
  go(`${route}${separator}business=${encodeURIComponent(businessId)}`);
}

export function Dashboard() {
  const toast = useToast();
  const { onboardingDone } = useSession();
  const [dashboardTimeframe, setDashboardTimeframe] = useState("اليوم");
  const [activationDismissed, setActivationDismissed] = useState(false);
  const [dashboardView, setDashboardView] = useState("ready");
  const data = dashboardService.getDashboardOverview();
  const onboardingProfile = onboardingService.profileFromWorkspace(workspaceService.getCurrent());
  const onboardingRecommendation = onboardingDone && onboardingProfile.companyName ? onboardingService.recommend(onboardingProfile) : null;

  const dashboardDateRange = dateRangeByTimeframe[dashboardTimeframe] || "all";
  const analytics = getAnalyticsOverview({ dateRange: dashboardDateRange });
  const analyticsFunnel = analytics.funnel.stages;
  const analyticsSources = getSourcePerformance();
  const business = (id: string) => dashboardService.listBusinesses().find((item: { id: string }) => item.id === id);
  const maxFunnel = analyticsFunnel[0]?.count || 1;

  const dashboardMetrics = [
    { label: "شركات مكتشفة", value: analytics.metrics.businessesDiscovered.value, format: "number", tone: "cyan", trend: "تاريخ اكتمال عملية الاكتشاف", note: "حدث ضمن الفترة" },
    { label: "عملاء محتملون", value: analytics.metrics.leadsCreated.value, format: "number", tone: "blue", trend: "تاريخ إنشاء العميل المحتمل", note: "حدث ضمن الفترة" },
    { label: "مسار المبيعات المفتوح", value: analytics.metrics.openPipeline.value, format: "sar", tone: "violet", trend: "لقطة حالية", note: "لا يطبق نطاق التاريخ" },
    { label: "الإيراد المعترف به", value: analytics.metrics.revenue.value, format: "sar", tone: "green", trend: "تاريخ الاعتراف بالإيراد", note: "لا يستخدم قيمة الصفقة" },
    { label: "الإيراد المنسوب", value: analytics.metrics.attributedRevenue.value, format: "sar", tone: "cyan", trend: "إسناد متعدد نقاط اللمس مرجّح", note: "من نقاط إسناد صالحة" },
    { label: "فرص عالية", value: analytics.metrics.highOpportunityBusinesses.value, format: "number", tone: "amber", trend: "تاريخ تحليل الفرصة", note: "درجة الفرصة لا تساوي احتمال الصفقة" },
  ];

  const upcomingActivities = dashboardService.getUpcomingActivities();
  const revenueSummary = {
    revenue: analytics.metrics.revenue.value,
    pipeline: analytics.metrics.openPipeline.value,
    weightedPipeline: analytics.metrics.weightedPipeline.value,
    averageDeal: (analytics.sales.averageDealValue ?? 0) as number,
    winRate: analytics.sales.winRate,
    averageCycle: "—",
  };

  const attributionSummary = getAttributionTraces(analytics.context).map((trace: any) => {
    const touch = trace.touchpoints[0];
    return {
      label: trace.event.id,
      sourceName: touch?.source?.name || "غير مكتمل",
      jobId: touch?.job?.id || "—",
      discovered: "—",
      qualified: "—",
      won: trace.deal?.status === "won" ? 1 : 0,
      revenueEventIds: [trace.event.id],
      revenue: trace.attributed,
    };
  });

  const pipelineSummary = dashboardService.getPipelineStageSummary().filter(({ stage }: any) => stage.kind === "open");
  const maxPipelineStageValue = Math.max(...pipelineSummary.map((item: any) => item.value), 1);
  const recentConversations = dashboardService.getInboxConversations({ search: "", filter: "all", ownerId: "all", channel: "whatsapp", sort: "latest" }).slice(0, 4);
  const agentActions = getAgentActions().slice(0, 4);
  const automationMetrics = dashboardService.getAutomationMetrics();
  const timeframeTitle = timeframeTitles[dashboardTimeframe];

  if (dashboardView !== "ready") {
    const [title, description, icon, kind] = feedbackConfigurations[dashboardView];
    return (
      <div className="exec-dashboard">
        <StateSwitcher view={dashboardView} onChange={setDashboardView} />
        <section className={`dashboard-feedback ${kind}`}>
          <i>{icon}</i>
          <h2>{title}</h2>
          <p>{description}</p>
          {dashboardView === "empty" ? (
            <button className="button primary" type="button" onClick={() => go("discovery")}>
              اكتشاف عملاء
            </button>
          ) : (
            <button
              className="button primary"
              type="button"
              onClick={() => setDashboardView("ready")}
            >
              العودة إلى الملخص
            </button>
          )}
        </section>
      </div>
    );
  }

  return (
    <div className="exec-dashboard">
      <section className="decision-rail" aria-label="مسار القرار">
        <div className="decision-brand">
          <img src={`${appConfig.assetBaseUrl}wazlink-mark.svg`} alt="wazlink" />
          مسار القرار
        </div>
        <div className="decision-steps">
          <span className="done"><i>١</i><b>اكتشاف</b></span>
          <span className="done"><i>٢</i><b>فهم</b></span>
          <span className="done"><i>٣</i><b>تواصل</b></span>
          <span className="active"><i>٤</i><b>قرار</b></span>
          <span><i>٥</i><b>إيراد</b></span>
        </div>
        <small>ملخص تنفيذي</small>
      </section>

      <header className="exec-header">
        <div>
          <p className="eyebrow">الرئيسية</p>
          <h1>{timeframeTitle}</h1>
          <p>هذه لوحة قيادة تجريبية تضع الفرص والقرارات ومصدر الإيراد في سياق واحد قابل للمراجعة.</p>
        </div>
        <div className="exec-header-actions">
          <div className="time-filter" aria-label="الفترة الزمنية">
            {timeframes.map((label) => (
              <button
                key={label}
                type="button"
                className={dashboardTimeframe === label ? "active" : ""}
                onClick={() => setDashboardTimeframe(label)}
              >
                {label}
              </button>
            ))}
          </div>
          <button className="button primary" type="button" onClick={() => go("discovery")}>
            اكتشاف عملاء جدد
          </button>
          <span className="exec-meta">
            <i />
            آخر تحديث تجريبي الآن
          </span>
        </div>
      </header>

      <section className="dashboard-journey-card" aria-label="رحلة المبيعات اليوم">
        <div className="dashboard-journey-copy">
          <p className="eyebrow">منصة واحدة · سياق واحد</p>
          <h2>ماذا يحدث في رحلة المبيعات اليوم؟</h2>
          <p>تابع انتقال الشركة من الاكتشاف إلى العميل المحتمل، ثم المحادثة والصفقة والإيراد.</p>
        </div>
        <div className="dashboard-journey-path">
          {["اكتشاف", "تحليل AI", "CRM", "واتساب", "صفقة", "إيراد"].map((step, index) => (
            <span key={step} className={index < 4 ? "complete" : index === 4 ? "current" : ""}>
              <i>{index + 1}</i>{step}
            </span>
          ))}
        </div>
        <div className="dashboard-quick-actions" aria-label="الإجراءات التالية">
          <button type="button" onClick={() => go("discovery")}>اكتشاف عميل</button>
          <button type="button" onClick={() => go("inbox")}>فتح Inbox</button>
          <button type="button" onClick={() => go("crm")}>إضافة Lead</button>
          <button type="button" onClick={() => go("pipeline")}>إنشاء صفقة</button>
        </div>
      </section>

      {onboardingRecommendation && !activationDismissed && (
        <section className="first-run-activation" aria-labelledby="first-run-title">
          <div className="first-run-copy">
            <p className="eyebrow">خطوتك التالية</p>
            <h2 id="first-run-title">أهلًا بك في {onboardingProfile.companyName}</h2>
            <p>{onboardingRecommendation.firstAction.reason} نبدأ بخطوة صغيرة قابلة للمراجعة، دون تنفيذ تلقائي.</p>
          </div>
          <div className="first-run-context">
            <span>الخطة الحالية</span>
            <strong>{onboardingRecommendation.currentPlan.name}</strong>
            <small>{onboardingRecommendation.currentPlanSufficient ? "الخطة الحالية كافية لأهدافك الأساسية." : `قد تكون ${onboardingRecommendation.recommendedPlan?.name || "خطة أعلى"} مناسبة عند التوسع.`}</small>
          </div>
          <div className="first-run-actions">
            <button className="button primary" type="button" onClick={() => go(onboardingRecommendation.firstAction.route)}>
              {onboardingRecommendation.firstAction.label}
            </button>
            {!onboardingRecommendation.currentPlanSufficient && <button className="button ghost" type="button" onClick={() => go("settings/billing")}>مراجعة الباقة</button>}
            <button className="first-run-dismiss" type="button" onClick={() => setActivationDismissed(true)} aria-label="إخفاء إرشادات البداية">إخفاء</button>
          </div>
        </section>
      )}

      <div className="mock-strip">
        <b>بيانات تجريبية ثابتة</b>
        <span>تطبق الفترة على event metrics؛ أما Pipeline واللقطات الحالية فتظهر كلقطات حالية صراحة.</span>
      </div>

      <StateSwitcher view={dashboardView} onChange={setDashboardView} />

      <section className="exec-kpi-grid" aria-label="مؤشرات الأداء الرئيسية">
        {dashboardMetrics.map((metric) => (
          <article className={`metric-card tone-${metric.tone}`} key={metric.label}>
            <span>{metric.label}</span>
            <b>{metric.format === "sar" ? money(metric.value) : fmt(metric.value)}</b>
            <small className="metric-trend">{metric.trend}</small>
            <div className="metric-foot">
              <i />
              {metric.note}
            </div>
          </article>
        ))}
      </section>

      <section className="executive-pair">
        <article className="card">
          <header className="card-head">
            <div>
              <h2>يحتاج انتباهك</h2>
              <p>عناصر محدودة تحتاج قرارًا أو متابعة من الفريق.</p>
            </div>
          </header>
          <div className="attention-list">
            {data.attentionItems.map((item: any, index: number) => (
              <article className="attention-item" key={item.id}>
                <i className={`attention-mark ${item.tone}`}>{String(index + 1).padStart(2, "0")}</i>
                <div>
                  <b>{item.title}</b>
                  <small>{item.description}</small>
                </div>
                <button type="button" className="button ghost" onClick={() => go(item.route)}>
                  {item.action}
                </button>
              </article>
            ))}
          </div>
        </article>

        <article className="card">
          <header className="card-head">
            <div>
              <h2>توصيات الذكاء الاصطناعي</h2>
              <p>توصيات قابلة للتنفيذ وليست نافذة محادثة.</p>
            </div>
          </header>
          <div className="ai-recommendation-list">
            {data.aiRecommendations.map((recommendation: any) => {
              const related = business(recommendation.businessId);
              return (
                <article className="ai-recommendation" key={recommendation.id}>
                  <header>
                    <span>{recommendation.kind}</span>
                    {recommendation.score ? <em className="score-inline">{recommendation.score}/100</em> : null}
                  </header>
                  <b>{recommendation.title}</b>
                  <p>{recommendation.reason}</p>
                  <small>{recommendation.action}</small>
                  <footer>
                    <button
                      type="button"
                      className="button compact primary"
                      onClick={() => openRoute(recommendation.primaryRoute, related?.id)}
                    >
                      {recommendation.primary}
                    </button>
                    {recommendation.secondary ? (
                      <button
                        type="button"
                        className="button compact"
                        onClick={() => {
                          toast(`تم إنشاء متابعة تجريبية مرتبطة بالعميل ${recommendation.businessId || ""}.`, "success");
                        }}
                      >
                        {recommendation.secondary}
                      </button>
                    ) : null}
                  </footer>
                </article>
              );
            })}
          </div>
        </article>
      </section>

      <section className="card">
        <header className="card-head">
          <div>
            <h2>من الاكتشاف إلى الإيراد</h2>
            <p>قمع مشتق من مجموعات Business فريدة؛ النسبة تقارن المرحلة بالمرحلة السابقة فقط.</p>
          </div>
          <button type="button" className="button ghost" onClick={() => go("analytics/funnel")}>
            عرض التحليل
          </button>
        </header>
        <div className="funnel-exec">
          {analyticsFunnel.map((stage: any, index: number) => (
            <article className="funnel-stage-exec" key={stage.id}>
              <span>{stage.label}</span>
              <b>{fmt(stage.count)}</b>
              {index ? (
                <small>
                  {stage.conversion === null
                    ? "— · لا يوجد مقام سابق"
                    : `${stage.conversion}% انتقال من ${fmt(stage.denominator)}`}
                </small>
              ) : (
                <small>نقطة بداية القمع</small>
              )}
              <i style={{ width: `${Math.max(14, Math.round((stage.count / maxFunnel) * 100))}%` }} />
            </article>
          ))}
        </div>
      </section>

      <section className="executive-pair">
        <article className="card">
          <header className="card-head">
            <div>
              <h2>ملخص مسار المبيعات</h2>
              <p>قيمة الصفقات المفتوحة مشتقة من الصفقات ومراحلها الفعلية داخل S6.</p>
            </div>
            <button type="button" className="button ghost" onClick={() => go("pipeline")}>
              فتح المسار
            </button>
          </header>
          <div className="pipeline-summary">
            {pipelineSummary.map(({ stage, count, value }: any) => (
              <button type="button" key={stage.id} onClick={() => go("pipeline")}>
                <span>{stage.name}</span>
                <b>{fmt(count)} صفقة</b>
                <small>{money(value)}</small>
                <i
                  style={
                    {
                      "--share": `${Math.min(100, Math.max(8, Math.round((value / maxPipelineStageValue) * 100)))}%`,
                    } as CSSProperties
                  }
                />
              </button>
            ))}
          </div>
        </article>

        <article className="card">
          <header className="card-head">
            <div>
              <h2>أفضل مصادر العملاء</h2>
              <p>تحويل Lead مشتق من Business وLead المتصلة بالمصدر عبر Job IDs.</p>
            </div>
            <button type="button" className="button ghost" onClick={() => go("analytics/sources")}>
              تفاصيل المصدر
            </button>
          </header>
          <div className="source-performance">
            {analyticsSources.map((source: any) => (
              <div className="source-bar info" key={source.sourceId ?? source.sourceName}>
                <div>
                  <span>{source.sourceName}</span>
                  <i style={{ "--source": `${Math.max(0, source.leadConversion || 0)}%` } as CSSProperties}>
                    <b />
                  </i>
                </div>
                <strong>{source.leadConversion === null ? "—" : `${source.leadConversion}%`}</strong>
              </div>
            ))}
          </div>
        </article>
      </section>

      <section className="executive-pair">
        <article className="card">
          <header className="card-head">
            <div>
              <h2>صفقات قريبة من الإغلاق</h2>
              <p>ثلاث صفقات تحتاج خطوة واضحة لتقليل وقت الإغلاق.</p>
            </div>
            <button type="button" className="button ghost" onClick={() => go("deals")}>
              كل الصفقات
            </button>
          </header>
          <div className="table-wrap">
            <table className="data-table deal-focus-table">
              <thead>
                <tr>
                  <th>الصفقة</th>
                  <th>المرحلة</th>
                  <th>القيمة</th>
                  <th>الاحتمال</th>
                  <th>آخر نشاط</th>
                  <th>الإجراء التالي</th>
                </tr>
              </thead>
              <tbody>
                {data.nearClosingDeals.map((deal: any) => {
                  const item = business(deal.businessId);
                  return (
                    <tr key={deal.id}>
                      <td>
                        <button type="button" onClick={() => openRoute("lead-profile", deal.businessId)}>
                          {item?.short || item?.name || deal.id}
                          <small className="mono">{deal.id}</small>
                        </button>
                      </td>
                      <td>
                        <span className="status contact">{deal.stage}</span>
                      </td>
                      <td>{money(deal.value)}</td>
                      <td>
                        <b className="probability">{deal.probability}%</b>
                      </td>
                      <td>{deal.lastActivity}</td>
                      <td>
                        <small>{deal.nextAction}</small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </article>

        <article className="card">
          <header className="card-head">
            <div>
              <h2>أداء الاكتشاف</h2>
              <p>تنتقل نتائج البحث التجريبية إلى مؤشرات تأهيل وCRM واضحة.</p>
            </div>
            <button type="button" className="button ghost" onClick={() => go("discovery")}>
              اكتشاف جديد
            </button>
          </header>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>العملية</th>
                  <th>المصدر</th>
                  <th>الموقع</th>
                  <th>مكتشف</th>
                  <th>درجة عالية</th>
                  <th>أضيف إلى CRM</th>
                  <th>مؤهل</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {dashboardService.listDiscoveryJobs().slice(0, 3).map((job: any) => (
                  <tr key={job.id}>
                    <td className="mono">
                      {job.id}
                      <small>{job.keyword}</small>
                    </td>
                    <td>{job.source}</td>
                    <td>{job.location}</td>
                    <td>{fmt(job.current)}</td>
                    <td>{fmt(job.highScore)}</td>
                    <td>{fmt(job.crmAdded)}</td>
                    <td>{fmt(job.qualified)}</td>
                    <td>
                      <span className={`status ${job.status === "completed" ? "qualified" : "contact"}`}>
                        {job.status === "completed" ? "مكتمل" : "قيد المعالجة"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="executive-pair">
        <article className="card">
          <header className="card-head">
            <div>
              <h2>المتابعات القادمة</h2>
              <p>قائمة مشتقة من سجل المهام المركزي وربط العميل الفعلي.</p>
            </div>
            <button type="button" className="button ghost" onClick={() => go("tasks")}>
              كل المهام
            </button>
          </header>
          <div className="mini-list">
            {upcomingActivities.map((activity: any) => {
              const item = business(activity.businessId);
              const className =
                activity.status === "متأخر" ? "overdue" : activity.status === "اليوم" ? "today" : "upcoming";
              return (
                <button
                  type="button"
                  className="mini-list-item"
                  key={activity.id ?? `${activity.title}-${activity.when}`}
                  onClick={() => openRoute(activity.route, activity.businessId)}
                >
                  <i className="list-icon">{activity.type.slice(0, 1)}</i>
                  <div>
                    <b>{activity.title}</b>
                    <small>
                      {item?.short || item?.name || "عميل تجريبي"} · {activity.type}
                    </small>
                  </div>
                  <span>
                    <em className={`activity-status ${className}`}>{activity.status}</em>
                    <small>{activity.when}</small>
                  </span>
                </button>
              );
            })}
          </div>
        </article>

        <article className="card">
          <header className="card-head">
            <div>
              <h2>آخر المحادثات</h2>
              <p>السياق التجاري والقناة والحالة بجانب آخر رسالة؛ واتساب في وضع تجريبي محلي.</p>
            </div>
            <button type="button" className="button ghost" onClick={() => go("inbox")}>
              فتح صندوق الوارد
            </button>
          </header>
          <div className="mini-list">
            {recentConversations.map(({ conversation, business: relatedBusiness, contact, latest, needsReply }: any) => {
              const className = needsReply ? "today" : conversation.status === "closed" ? "upcoming" : "today";
              return (
                <button
                  type="button"
                  className="mini-list-item"
                  key={conversation.id}
                  onClick={() => go(`inbox/${conversation.id}`)}
                >
                  <i className="list-icon">و</i>
                  <div>
                    <b>{relatedBusiness?.short || relatedBusiness?.name || contact?.name || "جهة اتصال"}</b>
                    <small>واتساب · {latest?.body || "مرفق تجريبي"}</small>
                  </div>
                  <span>
                    <em className={`activity-status ${className}`}>
                      {needsReply ? "تحتاج ردًا" : conversation.status === "closed" ? "مغلقة" : "مفتوحة"}
                    </em>
                    <small>
                      {new Intl.DateTimeFormat("ar-SA", { hour: "2-digit", minute: "2-digit" }).format(
                        new Date(conversation.lastMessageAt),
                      )}
                    </small>
                  </span>
                </button>
              );
            })}
          </div>
        </article>
      </section>

      <section className="card s8-dashboard-agent">
        <header className="card-head">
          <div>
            <h2>مساعد المبيعات وAgent</h2>
            <p>سجل اقتراحات محلية محكومة بالموافقة؛ لا يوجد تنفيذ ذاتي أو اتصال خارجي.</p>
          </div>
          <button type="button" className="button ghost" onClick={() => go("agent")}>
            فتح Agent
          </button>
        </header>
        <div className="mini-list">
          {agentActions.length ? (
            agentActions.map((action: any) => (
              <button type="button" className="mini-list-item" key={action.id} onClick={() => go("agent")}>
                <i className="list-icon">✧</i>
                <div>
                  <b>{agentActionLabels[action.type] ?? action.type}</b>
                  <small>{agentStatusLabels[action.status] ?? action.status}</small>
                </div>
                <span>
                  <em
                    className={`activity-status ${
                      action.status === "proposed" ? "today" : action.status === "failed" ? "overdue" : "upcoming"
                    }`}
                  >
                    ثقة {Math.round(action.confidence * 100)}%
                  </em>
                  <small>{action.id}</small>
                </span>
              </button>
            ))
          ) : (
            <div className="crm-empty-inline">لا توجد اقتراحات Agent بعد.</div>
          )}
        </div>
      </section>

      <section className="card s9-dashboard-automation">
        <header className="card-head">
          <div>
            <h2>الأتمتة والمتابعات</h2>
            <p>قواعد محلية حتمية تنشئ مهامًا أو اقتراحات بعد تقييم يدوي؛ لا يوجد Scheduler أو إرسال خارجي.</p>
          </div>
          <button type="button" className="button ghost" onClick={() => go("automation")}>
            فتح الأتمتة
          </button>
        </header>
        <div className="revenue-summary">
          <div><span>قواعد مفعلة</span><b>{fmt(automationMetrics.enabled)}</b></div>
          <div><span>تشغيلات اليوم</span><b>{fmt(automationMetrics.runsToday)}</b></div>
          <div><span>بانتظار موافقة</span><b>{fmt(automationMetrics.awaitingApproval)}</b></div>
          <div><span>فشل مضبوط</span><b>{fmt(automationMetrics.failed)}</b></div>
        </div>
      </section>

      <section className="card">
        <header className="card-head">
          <div>
            <h2>ملخص الإيراد</h2>
            <p>
              الإيراد المعترف به يأتي من أحداث الإيراد، بينما قيمة مسار المبيعات المفتوحة تأتي من الصفقات الحالية ولا
              تختلط به.
            </p>
          </div>
          <button type="button" className="button ghost" onClick={() => go("analytics")}>
            تحليل الإيراد
          </button>
        </header>
        <div className="revenue-summary">
          <div><span>إيراد العرض التجريبي</span><b>{money(revenueSummary.revenue)}</b></div>
          <div><span>قيمة مسار المبيعات المفتوحة</span><b>{money(revenueSummary.pipeline)}</b></div>
          <div><span>مسار المبيعات المرجّح</span><b>{money(revenueSummary.weightedPipeline)}</b></div>
          <div><span>متوسط الصفقة الرابحة</span><b>{money(revenueSummary.averageDeal)}</b></div>
          <div><span>معدل الفوز</span><b>{revenueSummary.winRate}%</b></div>
          <div><span>متوسط دورة البيع</span><b>{revenueSummary.averageCycle}</b></div>
        </div>
      </section>

      <section className="card">
        <header className="card-head">
          <div>
            <h2>من أين جاء الإيراد؟</h2>
            <p>
              مشتق من أحداث إيراد معترف بها مرتبطة بصفقة وعميل وعملية اكتشاف ومصدر فعلي. إجمالي الإسناد يطابق إيراد
              العرض التجريبي.
            </p>
          </div>
          <button type="button" className="button ghost" onClick={() => go("analytics")}>
            عرض الإسناد
          </button>
        </header>
        <div className="attribution-snapshot">
          {attributionSummary.map((source: AttributionSummaryRow) => (
            <article className="attribution-source" key={source.label}>
              <h3>{source.label}</h3>
              <dl>
                <div><dt>مصدر الاكتشاف</dt><dd>{source.sourceName}</dd></div>
                <div><dt>عملية البحث</dt><dd>{source.jobId}</dd></div>
                <div><dt>مكتشف</dt><dd>{fmt(source.discovered as unknown as number)}</dd></div>
                <div><dt>مؤهل</dt><dd>{fmt(source.qualified as unknown as number)}</dd></div>
                <div><dt>رابح</dt><dd>{fmt(source.won)}</dd></div>
                <div><dt>حدث الإيراد</dt><dd>{source.revenueEventIds.join("، ")}</dd></div>
              </dl>
              <footer>
                <span>الإيراد المنسوب</span>
                <b>{money(source.revenue)}</b>
              </footer>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

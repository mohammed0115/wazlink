/**
 * التحليلات — S10.
 *
 * طبقة **قراءة فقط** فوق selectors `analytics-engine`. لا تعيد الواجهة
 * حساب أي رقم ولا تنفذ mutation على أي كيان. الإيراد من
 * `RevenueEvent.status = recognized` فقط، والإسناد لا يتجاوز مبلغ الحدث.
 */
import {
  ANALYTICS_REFERENCE_DATE as _refDate,
  activeAnalyticsFilters,
  analyticsMetricDefinitions as rawMetricDefs,
  getAnalyticsFunnel,
  getAnalyticsOptions,
  getAnalyticsOverview,
  getAppointmentAnalytics,
  getAttributionTraces,
  getAutomationAnalytics,
  getConversationAnalytics,
  getDataQuality,
  getIntelligenceAnalytics,
  getJobPerformance,
  getSourcePerformance,
  getTaskAnalytics,
  normalizeAnalyticsContext,
} from "@domain/analytics-engine.js";
import { state } from "@domain/data.js";
import { go } from "../../shared/router/useHashRoute";
import { notifyStateChanged } from "../../shared/store/appStore";
import { useToast } from "../../shared/store/toast";
import { PageHead } from "../../shared/components/PageHead";
import { exportAnalyticsCsv } from "./export";

void _refDate;

type Row = Record<string, any>;
const metricDefinitions = rawMetricDefs as Row[];

const fmt = (value: unknown) =>
  value === null || value === undefined ? "—" : new Intl.NumberFormat("ar-SA").format(Number(value));
const money = (value: unknown) => (value === null || value === undefined ? "—" : `${fmt(value)} ر.س`);
const pct = (value: unknown) => (value === null || value === undefined ? "—" : `${fmt(value)}٪`);

const context = () => normalizeAnalyticsContext(state.analyticsContext);
const metric = (id: string) => metricDefinitions.find((item) => item.id === id);

const tabs: [string, string][] = [
  ["overview", "ملخص تنفيذي"], ["funnel", "قمع الاكتساب"], ["revenue", "الإيراد والإسناد"],
  ["sources", "المصادر والعمليات"], ["sales", "المبيعات"], ["ai", "الذكاء والتواصل"],
];

function MetricCard({ id, value, unit = "number" }: { id: string; value: unknown; unit?: string }) {
  const definition = metric(id);
  const visible = unit === "money" ? money(value) : unit === "percent" ? pct(value) : fmt(value);
  return (
    <article
      className="analytics-kpi"
      role="button"
      tabIndex={0}
      aria-label={`عرض تفاصيل ${definition?.label || id}`}
      onClick={() => {
        state.analyticsUi = { ...state.analyticsUi, drilldown: { type: "metric", metricId: id } as never };
        notifyStateChanged();
      }}
    >
      <span>{definition?.label || id}</span>
      <b className={unit === "money" ? "mono" : ""}>{visible}</b>
      <small>{definition?.definition || ""}</small>
      <i>كيف حُسب؟</i>
    </article>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <section className="analytics-empty">
      <b>لا توجد بيانات تطابق هذه الفلاتر.</b>
      <span>جرّب إعادة ضبط الفلاتر أو توسيع الفترة التجريبية.</span>
      <button className="button" type="button" onClick={onReset}>إعادة ضبط</button>
    </section>
  );
}

function ReconciliationPanel({ revenue }: { revenue: Row }) {
  return (
    <section className="analytics-panel reconciliation">
      <header>
        <div>
          <span className="eyebrow">تسوية الإيراد</span>
          <h2>RevenueEvent مقابل الإسناد</h2>
        </div>
        <button className="button compact" type="button" onClick={() => go("analytics/revenue")}>شرح الإسناد</button>
      </header>
      <dl>
        <div><dt>إجمالي الإيراد</dt><dd>{money(revenue.revenue)}</dd></div>
        <div><dt>الإيراد المنسوب</dt><dd>{money(revenue.attributed)}</dd></div>
        <div><dt>غير منسوب</dt><dd>{money(revenue.unattributed)}</dd></div>
        <div><dt>فوق المنسوب</dt><dd className={revenue.overAttributed ? "danger" : ""}>{money(revenue.overAttributed)}</dd></div>
      </dl>
      <small>Σ الإسناد لا تتجاوز مبلغ RevenueEvent وفق contract Touchpoint الحالية.</small>
    </section>
  );
}

function DataQualityPanel({ quality }: { quality: Row }) {
  const label = quality.severity === "ok" ? "OK" : quality.severity === "warning" ? "تحذير" : "حرج";
  const structural = quality.structural || {};
  const coverage = quality.coverage || {};
  return (
    <section className={`analytics-panel data-quality ${quality.severity}`}>
      <header>
        <div>
          <span className="eyebrow">جودة البيانات</span>
          <h2>{label}</h2>
        </div>
        <span className={`status-pill ${quality.severity}`}>{label}</span>
      </header>
      <div className="quality-sections">
        <div>
          <b>سلامة المراجع</b>
          <div className="quality-grid">
            <span>سلاسل إسناد ناقصة <b>{fmt(structural.brokenAttribution)}</b></span>
            <span>Lead بلا Business <b>{fmt(structural.brokenLeadBusiness)}</b></span>
            <span>Deal بلا Lead <b>{fmt(structural.brokenDealLead)}</b></span>
            <span>فوق المنسوب <b>{fmt(structural.overAttributed)}</b></span>
          </div>
        </div>
        <div>
          <b>تغطية التحليل والزمن</b>
          <div className="quality-grid">
            <span>Intelligence غير معروفة <b>{fmt(coverage.unknownIntelligence)}</b></span>
            <span>تحليلات فاشلة <b>{fmt(coverage.failedIntelligence)}</b></span>
            <span>timestamps ناقصة <b>{fmt(coverage.missingTimestamps)}</b></span>
            <span>إيراد غير منسوب <b>{fmt(coverage.revenueWithoutAttribution)}</b></span>
          </div>
        </div>
      </div>
    </section>
  );
}

function funnelConversionCopy(stage: Row, index: number) {
  if (!index) return "بداية القمع";
  return stage.conversion === null ? "— · لا يوجد مقام سابق" : `${pct(stage.conversion)} من ${fmt(stage.denominator)}`;
}

export function Analytics({ section = "overview" }: { section?: string }) {
  const toast = useToast();
  const ctx = context();
  const options = getAnalyticsOptions() as Row;
  const chips = activeAnalyticsFilters(ctx) as Row[];
  const tab = tabs.some(([id]) => id === section) ? section : "overview";

  const setFilter = (key: string, value: string) => {
    state.analyticsContext = { ...state.analyticsContext, [key]: value };
    notifyStateChanged();
  };
  const resetFilters = () => {
    state.analyticsContext = normalizeAnalyticsContext({});
    notifyStateChanged();
  };

  const dateOptions: [string, string][] = [
    ["all", "كل الفترة التجريبية"], ["today", "اليوم"], ["last7", "آخر 7 أيام"],
    ["last30", "آخر 30 يومًا"], ["month", "هذا الشهر"], ["custom", "مخصص"],
  ];

  const filterSelects: [string, string, Row[]][] = [
    ["sourceId", "المصدر", options.sources],
    ["jobId", "العملية", options.jobs],
    ["ownerId", "المالك", options.owners],
    ["city", "المدينة", options.cities],
    ["opportunityTier", "Tier الفرصة", options.tiers],
    ["leadStatus", "حالة Lead", options.leadStatuses],
    ["dealStageId", "مرحلة Deal", options.stages],
    ["channel", "القناة", options.channels],
    ["automationRuleId", "قاعدة الأتمتة", options.automationRules],
  ];

  return (
    <>
      <PageHead
        kicker="S10 · طبقة مشتقة"
        title="التحليلات"
        description="كل رقم مشتق من selectors المحرك؛ الواجهة لا تعيد الحساب ولا تغيّر أي كيان تشغيلي."
      />

      <nav className="analytics-tabs" aria-label="أقسام التحليلات">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? "active" : ""}
            aria-current={tab === id ? "page" : "false"}
            onClick={() => go(`analytics${id === "overview" ? "" : `/${id}`}`)}
          >
            {label}
          </button>
        ))}
      </nav>

      <section className="analytics-filter-panel" aria-label="فلاتر التحليلات">
        <div className="analytics-filter-head">
          <div>
            <span className="eyebrow">سياق التحليل</span>
            <b>بيانات تجريبية ثابتة — تُحسب عند تغيير الفلاتر</b>
          </div>
          <div>
            <button
              className="button compact"
              type="button"
              onClick={() => {
                const count = exportAnalyticsCsv(ctx);
                toast(`صُدِّر ${count} صفًا محليًا؛ لا يوجد نقل بيانات إلى خدمة خارجية.`, "success");
              }}
            >
              تصدير CSV محلي
            </button>
            <button className="button ghost compact" type="button" onClick={resetFilters}>إعادة ضبط</button>
          </div>
        </div>

        <div className="analytics-filter-grid">
          <label className="analytics-filter">
            <span>الفترة</span>
            <select value={ctx.dateRange} onChange={(e) => setFilter("dateRange", e.target.value)}>
              {dateOptions.map(([id, label]) => (
                <option value={id} key={id}>{label}</option>
              ))}
            </select>
          </label>
          {ctx.dateRange === "custom" && (
            <>
              <label className="analytics-filter">
                <span>من</span>
                <input type="date" value={ctx.customStart} onChange={(e) => setFilter("customStart", e.target.value)} />
              </label>
              <label className="analytics-filter">
                <span>إلى</span>
                <input type="date" value={ctx.customEnd} onChange={(e) => setFilter("customEnd", e.target.value)} />
              </label>
            </>
          )}
          {filterSelects.map(([key, label, items]) => (
            <label className="analytics-filter" key={key}>
              <span>{label}</span>
              <select aria-label={label} value={(ctx as Row)[key]} onChange={(e) => setFilter(key, e.target.value)}>
                <option value="all">الكل</option>
                {(items || []).map((item) => (
                  <option value={item.id} key={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
          ))}
        </div>

        {chips.length > 0 && (
          <div className="analytics-chips">
            <span>فلاتر فعّالة:</span>
            {chips.map((chip) => (
              <button key={chip.key} type="button" onClick={() => setFilter(chip.key, "all")}>
                {chip.label}: <b>{chip.value}</b> ×
              </button>
            ))}
          </div>
        )}
      </section>

      {tab === "overview" && <Overview ctx={ctx} onReset={resetFilters} />}
      {tab === "funnel" && <Funnel ctx={ctx} onReset={resetFilters} />}
      {tab === "revenue" && <Revenue ctx={ctx} onReset={resetFilters} />}
      {tab === "sources" && <Sources ctx={ctx} onReset={resetFilters} />}
      {tab === "sales" && <Sales ctx={ctx} />}
      {tab === "ai" && <AiAnalytics ctx={ctx} />}
    </>
  );
}

function Overview({ ctx, onReset }: { ctx: Row; onReset: () => void }) {
  const overview = getAnalyticsOverview(ctx) as Row;
  const quality = getDataQuality(ctx) as Row;
  if (!overview.metrics.businessesDiscovered.value) return <EmptyState onReset={onReset} />;

  return (
    <>
      <section className="analytics-kpis">
        <MetricCard id="revenue_total" value={overview.metrics.revenue.value} unit="money" />
        <MetricCard id="attributed_revenue" value={overview.metrics.attributedRevenue.value} unit="money" />
        <MetricCard id="open_pipeline" value={overview.metrics.openPipeline.value} unit="money" />
        <MetricCard id="weighted_pipeline" value={overview.metrics.weightedPipeline.value} unit="money" />
        <MetricCard id="won_deals" value={overview.metrics.wonDeals.value} />
        <MetricCard id="leads_created" value={overview.metrics.leadsCreated.value} />
      </section>
      <div className="analytics-split">
        <ReconciliationPanel revenue={overview.revenue} />
        <DataQualityPanel quality={quality} />
      </div>
      <section className="analytics-panel">
        <header>
          <div>
            <span className="eyebrow">قمع الاكتساب</span>
            <h2>من Business إلى إيراد</h2>
          </div>
          <button className="button compact" type="button" onClick={() => go("analytics/funnel")}>فتح القمع</button>
        </header>
        <div className="funnel-mini">
          {overview.funnel.stages.map((stage: Row, index: number) => (
            <button
              key={stage.id}
              type="button"
              onClick={() => {
                state.analyticsUi = { ...state.analyticsUi, drilldown: { type: "funnel", stageId: stage.id } as never };
                notifyStateChanged();
              }}
            >
              <span>{String(index + 1).padStart(2, "0")}</span>
              <b>{stage.label}</b>
              <strong>{fmt(stage.count)}</strong>
              <small className={index && stage.conversion === null ? "no-denominator" : ""}>
                {funnelConversionCopy(stage, index)}
              </small>
            </button>
          ))}
        </div>
      </section>
    </>
  );
}

function Funnel({ ctx, onReset }: { ctx: Row; onReset: () => void }) {
  const funnel = getAnalyticsFunnel(ctx) as Row;
  if (!funnel.stages[0].count) return <EmptyState onReset={onReset} />;
  return (
    <section className="analytics-panel funnel-page">
      <header>
        <div>
          <span className="eyebrow">Funnel قابلة للتتبع</span>
          <h2>كل مرحلة تعرض مجموعة Business فريدة</h2>
          <p>النسبة التالية = Business المرحلة التالية ÷ Business المرحلة السابقة المؤهلة.</p>
        </div>
      </header>
      <ol className="analytics-funnel">
        {funnel.stages.map((stage: Row, index: number) => (
          <li key={stage.id}>
            <button
              type="button"
              onClick={() => {
                state.analyticsUi = { ...state.analyticsUi, drilldown: { type: "funnel", stageId: stage.id } as never };
                notifyStateChanged();
              }}
            >
              <span>{index + 1}</span>
              <div>
                <b>{stage.label}</b>
                <small>{stage.definition}</small>
              </div>
              <strong>{fmt(stage.count)}</strong>
              <em className={index && stage.conversion === null ? "no-denominator" : ""}>
                {index && stage.conversion === null
                  ? "— · لا يوجد مقام سابق"
                  : stage.conversion === null
                    ? "—"
                    : `${pct(stage.conversion)} / ${fmt(stage.denominator)}`}
              </em>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Revenue({ ctx, onReset }: { ctx: Row; onReset: () => void }) {
  const revenue = (getAnalyticsOverview(ctx) as Row).revenue;
  const traces = getAttributionTraces(ctx) as Row[];
  if (!traces.length) return <EmptyState onReset={onReset} />;

  return (
    <>
      <ReconciliationPanel revenue={revenue} />
      <section className="analytics-panel">
        <header>
          <div>
            <span className="eyebrow">Revenue attribution</span>
            <h2>لماذا نُسب هذا الإيراد؟</h2>
            <p>
              الموديل: multi-touch weighted. كل Touchpoint يحمل وزنًا؛ مجموع المبالغ المنسوبة لا يتجاوز RevenueEvent،
              ومالك الإيراد هو Deal owner عند وجوده.
            </p>
          </div>
        </header>
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>RevenueEvent</th><th>التاريخ</th><th>المالك</th><th>الإيراد</th>
                <th>نقاط اللمس</th><th>المنسوب</th><th>غير منسوب</th><th>الحالة</th><th />
              </tr>
            </thead>
            <tbody>
              {traces.map((trace) => (
                <tr key={trace.event.id}>
                  <td className="mono">{trace.event.id}</td>
                  <td>{trace.event.recognizedAt}</td>
                  <td>{trace.owner?.name || "—"}</td>
                  <td>{money(trace.event.amount)}</td>
                  <td>{fmt(trace.touchpointCount)}</td>
                  <td>{money(trace.attributed)}</td>
                  <td>{money(trace.unattributed)}</td>
                  <td>
                    <span className={`status-pill ${trace.complete ? "ok" : "warning"}`}>
                      {trace.complete ? "سلسلة مكتملة" : "سلسلة ناقصة"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="button compact"
                      type="button"
                      onClick={() => {
                        state.analyticsUi = {
                          ...state.analyticsUi,
                          drilldown: { type: "trace", revenueId: trace.event.id } as never,
                        };
                        notifyStateChanged();
                      }}
                    >
                      التتبع
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Sources({ ctx, onReset }: { ctx: Row; onReset: () => void }) {
  const sources = getSourcePerformance(ctx) as Row[];
  const jobs = getJobPerformance(ctx) as Row[];
  if (!sources.length) return <EmptyState onReset={onReset} />;

  return (
    <>
      <section className="analytics-panel">
        <header>
          <div>
            <span className="eyebrow">أداء المصدر</span>
            <h2>الجودة لا الحجم فقط</h2>
          </div>
        </header>
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>المصدر</th><th>Business</th><th>عالية</th><th>Leads</th><th>تحويل</th>
                <th>Deals</th><th>رابحة</th><th>منسوب</th><th>لكل Lead</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((row) => (
                <tr key={row.sourceId ?? row.sourceName}>
                  <td>{row.sourceName}</td>
                  <td>{fmt(row.businesses)}</td>
                  <td>{fmt(row.highOpportunity)}</td>
                  <td>{fmt(row.leads)}</td>
                  <td>{pct(row.leadConversion)}</td>
                  <td>{fmt(row.deals)}</td>
                  <td>{fmt(row.won)}</td>
                  <td>{money(row.attributedRevenue)}</td>
                  <td>{row.revenuePerLead === null ? "—" : money(row.revenuePerLead)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="analytics-panel">
        <header>
          <div>
            <span className="eyebrow">أداء عمليات الاكتشاف</span>
            <h2>DiscoveryJob إلى نتيجة بيع</h2>
          </div>
        </header>
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>المعرف</th><th>العملية</th><th>المصدر</th><th>Business</th>
                <th>بعد إزالة التكرار</th><th>عالية</th><th>Leads</th><th>Deals</th><th>إيراد</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((row) => (
                <tr key={row.jobId}>
                  <td className="mono">{row.jobId}</td>
                  <td>{row.jobName}</td>
                  <td>{row.sourceName}</td>
                  <td>{fmt(row.discovered)}</td>
                  <td>{row.deduplicated === null ? "—" : fmt(row.deduplicated)}</td>
                  <td>{fmt(row.highOpportunity)}</td>
                  <td>{fmt(row.leads)}</td>
                  <td>{fmt(row.deals)}</td>
                  <td>{money(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function Sales({ ctx }: { ctx: Row }) {
  const overview = getAnalyticsOverview(ctx) as Row;
  const options = getAnalyticsOptions() as Row;
  const grouped: Record<string, Row[]> = {};
  for (const deal of overview.sales.openDeals) {
    (grouped[deal.stageId] ||= []).push(deal);
  }

  return (
    <>
      <section className="analytics-kpis">
        <MetricCard id="open_deals" value={overview.metrics.openDeals.value} />
        <MetricCard id="open_pipeline" value={overview.metrics.openPipeline.value} unit="money" />
        <MetricCard id="weighted_pipeline" value={overview.metrics.weightedPipeline.value} unit="money" />
        <MetricCard id="won_deals" value={overview.metrics.wonDeals.value} />
      </section>

      <section className="analytics-panel">
        <header>
          <div>
            <span className="eyebrow">Sales analytics</span>
            <h2>Pipeline واحتمال الصفقة التجاري</h2>
            <p>Weighted Pipeline = Σ(open Deal value × Deal probability). Opportunity Score لا يدخل المعادلة.</p>
          </div>
        </header>
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr><th>المرحلة</th><th>Deals</th><th>القيمة المفتوحة</th><th>القيمة المرجحة</th></tr>
            </thead>
            <tbody>
              {Object.keys(grouped).length ? (
                Object.entries(grouped).map(([stageId, deals]) => {
                  const stage = options.stages.find((item: Row) => item.id === stageId);
                  return (
                    <tr key={stageId}>
                      <td>{stage?.label || stageId}</td>
                      <td>{fmt(deals.length)}</td>
                      <td>{money(deals.reduce((sum, item) => sum + item.value, 0))}</td>
                      <td>{money(deals.reduce((sum, item) => sum + (item.value * item.probability) / 100, 0))}</td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={4}>لا توجد Deals مفتوحة.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="analytics-note">
          <b>Win rate:</b> {pct(overview.sales.winRate)} <span>التعريف: Won ÷ (Won + Lost).</span>
          <b>متوسط Deal رابحة:</b> {money(overview.sales.averageDealValue)} <span>{overview.sales.reason}</span>
        </div>
      </section>
    </>
  );
}

function AiAnalytics({ ctx }: { ctx: Row }) {
  const intelligence = getIntelligenceAnalytics(ctx) as Row;
  const conversations = getConversationAnalytics(ctx) as Row;
  const automation = getAutomationAnalytics(ctx) as Row;
  const appointments = getAppointmentAnalytics(ctx) as Row;
  const tasks = getTaskAnalytics(ctx) as Row;

  return (
    <>
      <section className="analytics-split thirds">
        <section className="analytics-panel">
          <header>
            <div>
              <span className="eyebrow">Intelligence</span>
              <h2>الذكاء وصفي لا سببي</h2>
            </div>
          </header>
          <dl className="stacked-data">
            <div><dt>متوسط Score</dt><dd>{fmt(intelligence.averageScore)}</dd></div>
            <div><dt>متوسط الثقة</dt><dd>{pct(intelligence.averageConfidence)}</dd></div>
            <div><dt>فشل / غير كافٍ</dt><dd>{fmt(intelligence.failed)} / {fmt(intelligence.unknown)}</dd></div>
          </dl>
          <p>
            Top gaps:{" "}
            {intelligence.topGapSignals.map((item: Row) => `${item.key} (${item.count})`).join(" · ") || "—"}
          </p>
          <p>
            الخدمات:{" "}
            {intelligence.recommendedServices.map((item: Row) => `${item.name} (${item.count})`).join(" · ") || "—"}
          </p>
        </section>

        <section className="analytics-panel">
          <header>
            <div>
              <span className="eyebrow">المحادثات</span>
              <h2>Human Messages فقط</h2>
            </div>
          </header>
          <dl className="stacked-data">
            <div><dt>المحادثات</dt><dd>{fmt(conversations.total)}</dd></div>
            <div><dt>تحتاج ردًا</dt><dd>{fmt(conversations.needsReply)}</dd></div>
            <div><dt>واردة / صادرة بشرية</dt><dd>{fmt(conversations.inbound)} / {fmt(conversations.humanOutbound)}</dd></div>
            <div><dt>معدل الرد</dt><dd>{pct(conversations.responseRate)}</dd></div>
          </dl>
          <small>Copilot suggestions ليست Messages ولا تدخل هذا المقياس.</small>
        </section>

        <section className="analytics-panel">
          <header>
            <div>
              <span className="eyebrow">الأتمتة</span>
              <h2>تشغيل ≠ بيع ناجح</h2>
            </div>
          </header>
          <dl className="stacked-data">
            <div><dt>Rules مفعلة</dt><dd>{fmt(automation.rulesEnabled)}</dd></div>
            <div><dt>Runs / Executed</dt><dd>{fmt(automation.runs)} / {fmt(automation.executed)}</dd></div>
            <div><dt>Awaiting / Failed</dt><dd>{fmt(automation.awaitingApproval)} / {fmt(automation.failed)}</dd></div>
          </dl>
        </section>
      </section>

      <section className="analytics-split">
        <section className="analytics-panel">
          <header>
            <div>
              <span className="eyebrow">المواعيد</span>
              <h2>مواعيد محلية</h2>
            </div>
          </header>
          <dl className="stacked-data">
            <div><dt>الإجمالي</dt><dd>{fmt(appointments.total)}</dd></div>
            <div><dt>مجدولة</dt><dd>{fmt(appointments.scheduled)}</dd></div>
            <div><dt>من الأتمتة</dt><dd>{fmt(appointments.fromAutomation)}</dd></div>
          </dl>
        </section>
        <section className="analytics-panel">
          <header>
            <div>
              <span className="eyebrow">المهام</span>
              <h2>المتابعة التشغيلية</h2>
            </div>
          </header>
          <dl className="stacked-data">
            <div><dt>الإجمالي</dt><dd>{fmt(tasks.total)}</dd></div>
            <div><dt>مكتملة</dt><dd>{fmt(tasks.completed)}</dd></div>
            <div><dt>متأخرة</dt><dd>{fmt(tasks.overdue)}</dd></div>
          </dl>
        </section>
      </section>
    </>
  );
}

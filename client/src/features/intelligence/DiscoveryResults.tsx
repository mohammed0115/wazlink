/**
 * نتائج + ذكاء الفرص — S4.
 *
 * منقولة عن `renderIntelligenceResults()`. التحليل حتمي محلي من الإصدار
 * `S4-MOCK-v1` ولا ينشئ Lead أو Deal أو CRM. النتائج تظهر فقط لعملية
 * حالتها `completed` وفق عقد S3.
 */
import { getDiscoveryJob, getDiscoverySource, scraperCrmPackages, scraperExportColumns, state } from "@services/data";
import { SCORING_VERSION, getBusinessIntelligence, getIntelligenceSummary } from "@domain/intelligence.js";
import { go } from "../../shared/router/useHashRoute";
import { notifyStateChanged } from "../../shared/store/appStore";
import { useToast } from "../../shared/store/toast";
import { PageHead } from "../../shared/components/PageHead";
import { runIntelligenceSimulation } from "./simulation";
import { AnalysisStatusBadge, DecisionRail, Mono, ScoreDisplay, fmt, percent } from "./shared";
import type { DiscoveryModalState } from "../../domain/types";

type Record_ = Record<string, any>;

/** `selectedResultIds` يبدأ `[]` في الـfixture فيستنتجه TS كـnever[]. */
const selectedIds = () => state.selectedResultIds as string[];
const setSelectedIds = (ids: string[]) => {
  (state as { selectedResultIds: string[] }).selectedResultIds = ids;
};

function filteredRecords(jobId: string): Record_[] {
  const filters = state.resultFilters;
  const job = getDiscoveryJob(jobId);
  const records = (job?.resultBusinessIds || []).map(getBusinessIntelligence).filter(Boolean) as Record_[];

  const rows = records.filter((record) => {
    const business = record.business;
    const text = `${business.name} ${business.category} ${business.city}`;
    const hasGap = record.signals.some((signal: Record_) => signal.gapCode === filters.gap);
    return (
      (!filters.search || text.includes(filters.search)) &&
      (filters.category === "all" || business.category === filters.category) &&
      (filters.city === "all" || business.city === filters.city) &&
      (filters.rating === "all" || (business.rating ?? 0) >= Number(filters.rating)) &&
      (filters.reviews === "all" || (business.reviews ?? 0) >= Number(filters.reviews)) &&
      (filters.website === "all" || (filters.website === "yes" ? Boolean(business.website) : !business.website)) &&
      (filters.phone === "all" || (filters.phone === "yes" ? Boolean(business.phone) : !business.phone)) &&
      (filters.opportunityTier === "all" ||
        (filters.opportunityTier === "not_analyzed"
          ? ["not_analyzed", "insufficient_data"].includes(record.status)
          : record.tier === filters.opportunityTier)) &&
      (filters.minScore === "all" || (record.score !== null && record.score >= Number(filters.minScore))) &&
      (filters.confidence === "all" || record.confidence >= Number(filters.confidence)) &&
      (filters.gap === "all" || hasGap) &&
      (filters.intelligenceStatus === "all" || record.status === filters.intelligenceStatus) &&
      (!filters.highOpportunity || record.score >= 80)
    );
  });

  const sorters: Record<string, (a: Record_, b: Record_) => number> = {
    score: (a, b) => (b.score ?? -1) - (a.score ?? -1),
    confidence: (a, b) => b.confidence - a.confidence,
    reviews: (a, b) => (b.business.reviews ?? -1) - (a.business.reviews ?? -1),
    rating: (a, b) => (b.business.rating ?? -1) - (a.business.rating ?? -1),
    name: (a, b) => a.business.name.localeCompare(b.business.name, "ar"),
    newest: () => 0,
  };
  return [...rows].sort(sorters[filters.sort] || sorters.newest);
}

export function DiscoveryResults({ jobId }: { jobId: string }) {
  const toast = useToast();
  const job = getDiscoveryJob(jobId);

  if (!job) {
    return (
      <PageHead
        kicker="نتائج الاكتشاف"
        title="لا توجد نتائج بعد"
        description="ابدأ عملية اكتشاف مكتملة لعرض العينة التجريبية."
        actions={
          <button className="button primary" type="button" onClick={() => go("discovery")}>
            بدء عملية جديدة
          </button>
        }
      />
    );
  }

  if (job.status !== "completed") {
    return (
      <section className="card discovery-results-blocked">
        <span className="status warning">{job.status === "processing" ? "قيد المعالجة" : "النتائج غير متاحة"}</span>
        <h2>نتائج الذكاء غير جاهزة لهذه العملية</h2>
        <p>يظل تحليل الفرص مرتبطًا فقط بنتائج Job مكتملة. عد إلى تفاصيل العملية لمتابعة الحالة.</p>
        <button className="button primary" type="button" onClick={() => go(`discovery/jobs/${job.id}`)}>
          العودة إلى تفاصيل العملية
        </button>
      </section>
    );
  }

  const allRecords = (job.resultBusinessIds.map(getBusinessIntelligence).filter(Boolean) as Record_[]) ?? [];
  const rows = filteredRecords(job.id);
  const selected = selectedIds().filter((id: string) => rows.some((record) => record.business.id === id));
  const summary = getIntelligenceSummary(allRecords.map((record) => record.business.id));
  const filters = state.resultFilters;

  const categories = [...new Set(allRecords.map((record) => record.business.category))];
  const cities = [...new Set(allRecords.map((record) => record.business.city))];

  const setFilter = (key: string, value: string | boolean) => {
    (state.resultFilters as Record<string, unknown>)[key] = value;
    notifyStateChanged();
  };

  const toggleSelect = (businessId: string) => {
    const current = selectedIds();
    setSelectedIds(current.includes(businessId) ? current.filter((id) => id !== businessId) : [...current, businessId]);
    notifyStateChanged();
  };

  const toggleColumn = (columnId: string) => {
    const current: string[] = state.scraperCrmUi.exportColumns;
    state.scraperCrmUi = {
      ...state.scraperCrmUi,
      exportColumns: current.includes(columnId) ? current.filter((id) => id !== columnId) : [...current, columnId],
    };
    notifyStateChanged();
  };

  const openDecision = () => {
    if (!selected.length) {
      toast("حدد نتيجة واحدة على الأقل ثم اختر Excel أو CRM نمو.", "error");
      return;
    }
    state.scraperCrmUi = { ...state.scraperCrmUi, jobId: job.id };
    (state as { discoveryModal: DiscoveryModalState }).discoveryModal = {
      type: "scraper-crm-decision",
      jobId: job.id,
      businessIds: selected,
    };
    notifyStateChanged();
  };

  const countWith = (key: string) => fmt(allRecords.filter((record) => record.business[key]).length);

  return (
    <>
      <PageHead
        kicker="نتائج + ذكاء الفرص"
        title={job.name}
        description={
          <>
            عينة Business مرتبطة بـ<Mono>{job.id}</Mono>؛ التحليل حتمي ومفسّر، ولا ينشئ سجلات CRM.
          </>
        }
        actions={
          <>
            <button className="button" type="button" onClick={() => go(`discovery/jobs/${job.id}`)}>
              عودة للعملية
            </button>
            <button className="button primary" type="button" onClick={() => go("discovery")}>
              بدء اكتشاف جديد
            </button>
          </>
        }
      />

      <div className="prototype-notice discovery-notice">
        <b>محاكاة Intelligence</b>
        <span>
          الدرجة والثقة والإشارات تُشتق من بيانات العرض المحلية والإصدار {SCORING_VERSION} فقط؛ لا يوجد AI API أو
          Enrichment.
        </span>
      </div>

      <DecisionRail stage="results" job={job} source={getDiscoverySource(job.sourceId)} />

      <section className="s4-opportunity-summary" aria-label="ملخص ذكاء النتائج">
        <article><span>ملخص Job</span><b>{fmt(job.deduplicatedCount)}</b><small>نتيجة نهائية في العملية</small></article>
        <article><span>العينة المحمّلة</span><b>{fmt(summary.total)}</b><small>سجلات Business ظاهرة</small></article>
        <article><span>تم تحليلها</span><b>{fmt(summary.analyzed)}</b><small>تحليل حتمي محلي</small></article>
        <article><span>فرص عالية</span><b>{fmt(summary.high)}</b><small>درجة 80 فأعلى</small></article>
        <article><span>فرص جيدة</span><b>{fmt(summary.good)}</b><small>درجة 65–79</small></article>
        <article><span>بيانات غير كافية</span><b>{fmt(summary.insufficient)}</b><small>بلا درجة مضللة</small></article>
      </section>

      <section className="scraper-package-strip" aria-label="خيار باقة الاستخراج">
        <div>
          <span className="eyebrow">{scraperCrmPackages.scraper.label}</span>
          <b>هذه النتائج جاهزة للتنزيل حتى لو لم تستخدم CRM.</b>
          <small>
            {scraperCrmPackages.scraper.price} · {scraperCrmPackages.scraper.purpose}
          </small>
        </div>
        <span className="package-chip">CRM اختياري</span>
      </section>

      <section className="scraper-data-visibility card" aria-label="بيانات ملف Excel">
        <header>
          <div>
            <p className="eyebrow">ماذا سيظهر في ملفك؟</p>
            <h2>بيانات Scraper قابلة للتحديد والتصدير</h2>
            <p>اختر الأعمدة التي تحتاجها قبل تنزيل Excel التجريبي. القيم المتاحة أدناه من العينة المحلية فقط.</p>
          </div>
          <span className="package-chip">{state.scraperCrmUi.exportColumns.length} أعمدة مختارة</span>
        </header>
        <div className="scraper-availability-grid">
          <span><b>{countWith("phone")}</b> هاتف</span>
          <span><b>{countWith("email")}</b> بريد</span>
          <span><b>{countWith("website")}</b> موقع</span>
          <span><b>{countWith("instagram")}</b> إنستغرام</span>
          <span><b>{countWith("whatsapp")}</b> واتساب</span>
        </div>
        <fieldset className="export-columns-selector">
          <legend>أعمدة Excel</legend>
          {scraperExportColumns.map((column: { id: string; label: string }) => (
            <label className="check" key={column.id}>
              <input
                type="checkbox"
                checked={state.scraperCrmUi.exportColumns.includes(column.id)}
                onChange={() => toggleColumn(column.id)}
              />{" "}
              {column.label}
            </label>
          ))}
        </fieldset>
      </section>

      <section className="card">
        <div className="results-filter-grid s4-filter-grid">
          <label className="search-field">
            <span>⌕</span>
            <input
              value={filters.search}
              placeholder="ابحث في الشركة أو النشاط أو المدينة"
              onChange={(event) => setFilter("search", event.target.value)}
            />
          </label>
          <select value={filters.opportunityTier} onChange={(event) => setFilter("opportunityTier", event.target.value)}>
            <option value="all">كل مستويات الفرصة</option>
            <option value="high">فرصة عالية</option>
            <option value="good">فرصة جيدة</option>
            <option value="medium">فرصة متوسطة</option>
            <option value="low">فرصة منخفضة</option>
            <option value="not_analyzed">غير محللة / غير كافية</option>
          </select>
          <select value={filters.minScore} onChange={(event) => setFilter("minScore", event.target.value)}>
            <option value="all">أي درجة</option>
            <option value="80">80+ نقطة</option>
            <option value="65">65+ نقطة</option>
            <option value="40">40+ نقطة</option>
          </select>
          <select value={filters.confidence} onChange={(event) => setFilter("confidence", event.target.value)}>
            <option value="all">أي ثقة</option>
            <option value="0.8">80%+ ثقة</option>
            <option value="0.7">70%+ ثقة</option>
            <option value="0.5">50%+ ثقة</option>
          </select>
          <select value={filters.gap} onChange={(event) => setFilter("gap", event.target.value)}>
            <option value="all">كل الفجوات</option>
            <option value="weak_website">الموقع</option>
            <option value="weak_visibility">الظهور</option>
            <option value="manual_booking">الحجز اليدوي</option>
            <option value="missing_whatsapp">واتساب</option>
          </select>
          <select value={filters.intelligenceStatus} onChange={(event) => setFilter("intelligenceStatus", event.target.value)}>
            <option value="all">كل حالات التحليل</option>
            <option value="analyzed">تم التحليل</option>
            <option value="not_analyzed">لم تُحلل</option>
            <option value="analyzing">جارٍ التحليل</option>
            <option value="insufficient_data">بيانات غير كافية</option>
          </select>
          <select value={filters.sort} onChange={(event) => setFilter("sort", event.target.value)}>
            <option value="newest">الأحدث اكتشافًا</option>
            <option value="score">أعلى درجة فرصة</option>
            <option value="confidence">أعلى ثقة</option>
            <option value="reviews">الأكثر مراجعات</option>
            <option value="rating">الأعلى تقييمًا</option>
            <option value="name">الاسم</option>
          </select>
        </div>

        <div className="s4-secondary-filter-row">
          <button
            type="button"
            className={`button ${filters.highOpportunity ? "primary" : "ghost"}`}
            onClick={() => setFilter("highOpportunity", !filters.highOpportunity)}
          >
            أفضل الفرص <span>80+ نقطة</span>
          </button>
          <select value={filters.category} onChange={(event) => setFilter("category", event.target.value)}>
            <option value="all">كل الأنشطة</option>
            {categories.map((category) => (
              <option value={category} key={category}>
                {category}
              </option>
            ))}
          </select>
          <select value={filters.city} onChange={(event) => setFilter("city", event.target.value)}>
            <option value="all">كل المدن</option>
            {cities.map((city) => (
              <option value={city} key={city}>
                {city}
              </option>
            ))}
          </select>
          <small>
            الفلاتر تخص العينة المحمّلة فقط من <Mono>{job.id}</Mono>.
          </small>
        </div>

        <div className="results-selection-bar scraper-selection-bar">
          <label className="check">
            <input
              type="checkbox"
              checked={Boolean(rows.length) && selected.length === rows.length}
              onChange={() => {
                setSelectedIds(selected.length === rows.length ? [] : rows.map((record) => record.business.id));
                notifyStateChanged();
              }}
            />{" "}
            تحديد النتائج الظاهرة
          </label>
          <span>
            {fmt(selected.length)} محدد من {fmt(rows.length)} ظاهرة
          </span>
          <div>
            <button type="button" className="button primary" disabled={!selected.length} onClick={openDecision}>
              Excel أو CRM نمو
            </button>
            <button
              type="button"
              className="button"
              disabled={!selected.length}
              onClick={() => runIntelligenceSimulation(selected, toast, "تم تحليل فرص Business المحددة", "batch")}
            >
              تحليل المحدد
            </button>
            <button
              type="button"
              className="button ghost"
              onClick={() =>
                runIntelligenceSimulation(
                  rows.map((record) => record.business.id),
                  toast,
                  "تم تحليل النتائج الظاهرة",
                  "batch",
                )
              }
            >
              تحليل النتائج الظاهرة
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table discovery-results-table s4-results-table">
            <thead>
              <tr>
                <th><span className="sr-only">تحديد</span></th>
                <th>الشركة</th>
                <th>النشاط</th>
                <th>المدينة</th>
                <th className="s4-optional-col">التقييم</th>
                <th>الفرصة</th>
                <th>الثقة</th>
                <th className="s4-optional-col">أهم فجوة</th>
                <th>حالة الذكاء</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((record) => {
                  const b = record.business;
                  const topGap = record.reasons[0]?.value || "لا توجد فجوة مثبتة";
                  return (
                    <tr className={selected.includes(b.id) ? "selected" : ""} key={b.id}>
                      <td>
                        <input
                          aria-label={`تحديد ${b.name}`}
                          type="checkbox"
                          checked={selected.includes(b.id)}
                          onChange={() => toggleSelect(b.id)}
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="row-link company-cell"
                          onClick={() => {
                            state.selectedBusinessId = b.id;
                            go(`intelligence?business=${b.id}`);
                          }}
                        >
                          <i className="company-mark">{b.short.slice(0, 1)}</i>
                          <span>
                            <b>{b.name}</b>
                            <small className="mono ltr">{b.id}</small>
                          </span>
                        </button>
                      </td>
                      <td>{b.category}</td>
                      <td>{b.city}</td>
                      <td className="s4-optional-col">
                        {b.rating === null ? "غير معروف" : <span className="rating-value">★ {b.rating}</span>}
                      </td>
                      <td><ScoreDisplay record={record} /></td>
                      <td>
                        <b className="confidence-value">
                          {record.status === "insufficient_data" ? "—" : percent(record.confidence)}
                        </b>
                      </td>
                      <td className="s4-optional-col"><small>{topGap}</small></td>
                      <td><AnalysisStatusBadge status={record.status} /></td>
                      <td>
                        <div className="s5-results-actions">
                          <button
                            type="button"
                            className="button compact"
                            onClick={() => {
                              state.selectedBusinessId = b.id;
                              go(`intelligence?business=${b.id}`);
                            }}
                          >
                            {record.status === "insufficient_data" ? "عرض سبب عدم الكفاية" : "فتح الذكاء"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10}>
                    <div className="table-empty">
                      <b>لم نجد سجلات تطابق هذه المعايير.</b>
                      <span>عدّل فلاتر Intelligence أو أزل عرض أفضل الفرص.</span>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

/**
 * الصفقات — S6.
 * منقولة عن `renderDeals()`: 10 فلاتر وجدول تشغيلي.
 * القيمة المرجحة = القيمة × احتمال الصفقة ÷ 100 وفق `ENTITY_MODEL §8`.
 */
import { getDealBusiness, getDealLead, getDealProbability, getDealStage, getPipelineMetrics, getPipelineStageSummary, listUsers, listDeals, getUiState } from "@services";
import { getBusinessIntelligence, tierLabels as rawTiers } from "@domain/intelligence.js";
import { go } from "../../shared/router/useHashRoute";
import { notifyStateChanged } from "../../shared/store/appStore";
import { PageHead } from "../../shared/components/PageHead";
import { DecisionRail, MetricStrip, Mono, dateLabel, dealStatusLabels, fmt, money, ownerName, statusTone } from "./shared";

const tierLabels = rawTiers as Record<string, string>;
type Row = Record<string, any>;

function dealRecord(deal: Row): Row {
  const business = getDealBusiness(deal);
  return {
    deal,
    lead: getDealLead(deal),
    business,
    stage: getDealStage(deal),
    intelligence: business ? getBusinessIntelligence(business.id) : null,
  };
}

function dealRows(): Row[] {
  const filters = getUiState().dealFilters;
  return listDeals()
    .map(dealRecord)
    .filter((row: Row) => {
      const text = `${row.deal.title} ${row.deal.id} ${row.lead?.id || ""} ${row.business?.name || ""} ${row.business?.city || ""}`.toLowerCase();
      const probability = getDealProbability(row.deal);
      return (
        (!filters.search || text.includes(filters.search.toLowerCase())) &&
        (filters.pipelineId === "all" || row.deal.pipelineId === filters.pipelineId) &&
        (filters.stageId === "all" || row.deal.stageId === filters.stageId) &&
        (filters.ownerId === "all" || row.deal.ownerId === filters.ownerId) &&
        (filters.status === "all" || row.deal.status === filters.status) &&
        (filters.minValue === "all" || row.deal.value >= Number(filters.minValue)) &&
        (filters.probability === "all" || probability >= Number(filters.probability)) &&
        (filters.expectedClose === "all" ||
          (filters.expectedClose === "this_month" && row.deal.expectedCloseAt?.startsWith("2026-08")) ||
          (filters.expectedClose === "next_7" && row.deal.expectedCloseAt >= "2026-08-15" && row.deal.expectedCloseAt <= "2026-08-22")) &&
        (filters.sourceJobId === "all" || row.lead?.sourceJobId === filters.sourceJobId) &&
        (filters.opportunityTier === "all" || row.intelligence?.tier === filters.opportunityTier)
      );
    })
    .sort((a: Row, b: Row) => {
      if (filters.sort === "value") return b.deal.value - a.deal.value;
      if (filters.sort === "weighted")
        return b.deal.value * getDealProbability(b.deal) - a.deal.value * getDealProbability(a.deal);
      if (filters.sort === "probability") return getDealProbability(b.deal) - getDealProbability(a.deal);
      if (filters.sort === "close") return String(a.deal.expectedCloseAt).localeCompare(String(b.deal.expectedCloseAt));
      if (filters.sort === "lastActivity") return String(b.deal.lastActivityAt).localeCompare(String(a.deal.lastActivityAt));
      return String(b.deal.updatedAt).localeCompare(String(a.deal.updatedAt));
    });
}

export function Deals() {
  const filters = getUiState().dealFilters;
  const rows = dealRows();
  const metrics = getPipelineMetrics();
  const stages = getPipelineStageSummary("PIPE-1001").map(({ stage }: Row) => stage);
  const jobIds = [...new Set(listDeals().map((deal: Row) => getDealLead(deal)?.sourceJobId).filter(Boolean))] as string[];

  const setFilter = (key: string, value: string) => {
    (getUiState().dealFilters as Record<string, string>)[key] = value;
    notifyStateChanged();
  };

  return (
    <>
      <PageHead
        kicker="إدارة المبيعات"
        title="الصفقات"
        description="قائمة تشغيلية تقرأ القيمة والاحتمال والمرحلة من Deal، وتحفظ أصل الاكتشاف عبر Lead دون نسخ السجل."
        actions={
          <>
            <button className="button" type="button" onClick={() => go("pipeline")}>فتح Pipeline</button>
            <button
              className="button primary"
              type="button"
              onClick={() => {
                (getUiState() as { dealModal: unknown }).dealModal = { type: "create" };
                notifyStateChanged();
              }}
            >
              إنشاء صفقة
            </button>
          </>
        }
      />

      <DecisionRail label="قائمة موحدة للقرار التجاري وإغلاق الصفقة" />
      <MetricStrip metrics={metrics} />

      <section className="card s6-filters">
        <div className="s6-filter-grid">
          <label className="search-field">
            <span>⌕</span>
            <input
              value={filters.search}
              placeholder="ابحث بعنوان الصفقة أو الشركة أو Lead أو المعرف"
              onChange={(e) => setFilter("search", e.target.value)}
            />
          </label>
          <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="all">كل الحالات</option>
            {Object.entries(dealStatusLabels).map(([key, label]) => (
              <option value={key} key={key}>{label}</option>
            ))}
          </select>
          <select value={filters.stageId} onChange={(e) => setFilter("stageId", e.target.value)}>
            <option value="all">كل المراحل</option>
            {stages.map((stage: Row) => (
              <option value={stage.id} key={stage.id}>{stage.name}</option>
            ))}
          </select>
          <select value={filters.ownerId} onChange={(e) => setFilter("ownerId", e.target.value)}>
            <option value="all">كل الملاك</option>
            {listUsers().map((user: Row) => (
              <option value={user.id} key={user.id}>{user.name}</option>
            ))}
          </select>
          <select value={filters.minValue} onChange={(e) => setFilter("minValue", e.target.value)}>
            <option value="all">كل القيم</option>
            <option value="50000">٥٠٬٠٠٠ ر.س فأعلى</option>
            <option value="100000">١٠٠٬٠٠٠ ر.س فأعلى</option>
          </select>
          <select value={filters.probability} onChange={(e) => setFilter("probability", e.target.value)}>
            <option value="all">كل الاحتمالات</option>
            <option value="50">٥٠٪ فأعلى</option>
            <option value="75">٧٥٪ فأعلى</option>
          </select>
          <select value={filters.expectedClose} onChange={(e) => setFilter("expectedClose", e.target.value)}>
            <option value="all">كل تواريخ الإغلاق</option>
            <option value="next_7">خلال ٧ أيام</option>
            <option value="this_month">خلال الشهر</option>
          </select>
          <select value={filters.sourceJobId} onChange={(e) => setFilter("sourceJobId", e.target.value)}>
            <option value="all">كل المصادر</option>
            {jobIds.map((id) => (
              <option value={id} key={id}>{id}</option>
            ))}
          </select>
          <select value={filters.opportunityTier} onChange={(e) => setFilter("opportunityTier", e.target.value)}>
            <option value="all">كل مستويات الفرصة</option>
            {Object.entries(tierLabels).map(([key, label]) => (
              <option value={key} key={key}>{label}</option>
            ))}
          </select>
          <select value={filters.sort} onChange={(e) => setFilter("sort", e.target.value)}>
            <option value="updated">الأحدث</option>
            <option value="lastActivity">آخر نشاط</option>
            <option value="value">أعلى قيمة</option>
            <option value="weighted">أعلى قيمة مرجحة</option>
            <option value="probability">أعلى احتمال</option>
            <option value="close">أقرب إغلاق</option>
          </select>
        </div>
      </section>

      <section className="card s6-deals-table-card">
        <header className="s6-list-head">
          <div>
            <b>{fmt(rows.length)} صفقة</b>
            <span>تطابق الفلاتر الحالية</span>
          </div>
          <small>القيمة المرجحة = القيمة × احتمال الصفقة</small>
        </header>
        <div className="table-wrap">
          <table className="data-table s6-deals-table">
            <thead>
              <tr>
                <th>الصفقة</th><th>Lead</th><th>المرحلة</th><th>القيمة</th><th>الاحتمال</th>
                <th>المالك</th><th>الإغلاق المتوقع</th><th>المصدر</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map(({ deal, lead, business, stage }) => (
                  <tr key={deal.id}>
                    <td>
                      <button
                        type="button"
                        className="row-link"
                        onClick={() => {
                          getUiState().selectedDealId = deal.id;
                          go(`deals/${deal.id}`);
                        }}
                      >
                        <b>{deal.title}</b>
                        <small><Mono>{deal.id}</Mono></small>
                      </button>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="row-link"
                        onClick={() => {
                          if (lead?.id) {
                            getUiState().selectedLeadId = lead.id;
                            go(`crm/leads/${lead.id}`);
                          }
                        }}
                      >
                        {business?.name || lead?.id || "—"}
                        <small><Mono>{lead?.id || "—"}</Mono></small>
                      </button>
                    </td>
                    <td><span className={`status ${statusTone(deal.status)}`}>{stage?.name || "—"}</span></td>
                    <td><b>{money(deal.value)}</b><small>SAR</small></td>
                    <td>
                      <b className="s6-probability">{getDealProbability(deal)}%</b>
                      <small>مرجح {money((deal.value * getDealProbability(deal)) / 100)}</small>
                    </td>
                    <td>{ownerName(deal.ownerId)}</td>
                    <td>{dateLabel(deal.expectedCloseAt)}</td>
                    <td><Mono>{lead?.sourceJobId || "—"}</Mono></td>
                    <td>
                      <button
                        type="button"
                        className="button ghost compact"
                        onClick={() => {
                          getUiState().selectedDealId = deal.id;
                          go(`deals/${deal.id}`);
                        }}
                      >
                        فتح
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9}>
                    <div className="table-empty">
                      <b>لا توجد صفقات تطابق الفلاتر.</b>
                      <span>غيّر الفلاتر أو أنشئ صفقة من Lead مؤهلة.</span>
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

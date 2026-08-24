import { pipelineService } from "@services";
/**
 * الصفقات — S6.
 * منقولة عن `renderDeals()`: 10 فلاتر وجدول تشغيلي.
 * القيمة المرجحة = القيمة × احتمال الصفقة ÷ 100 وفق `ENTITY_MODEL §8`.
 */
import { useState } from "react";
import { getDealBusiness, listUsers } from "@services";
import { getBusinessIntelligence, tierLabels as rawTiers } from "@domain/intelligence.js";
import { go } from "../../shared/router/useHashRoute";
import { PageHead } from "../../shared/components/PageHead";
import { DecisionRail, MetricStrip, Mono, dateLabel, dealStatusLabels, fmt, money, ownerName, statusTone } from "./shared";

const tierLabels = rawTiers as Record<string, string>;
type Row = Record<string, any>;

function dealRecord(deal: Row): Row {
  const business = pipelineService.getDealBusiness(deal);
  return {
    deal,
    lead: pipelineService.getDealLead(deal),
    business,
    stage: pipelineService.getDealStage(deal),
    intelligence: business ? getBusinessIntelligence(business.id) : null,
  };
}

function dealRows(filters: Record<string, string>): Row[] {
  return pipelineService.listDeals()
    .map(dealRecord)
    .filter((row: Row) => {
      const text = `${row.deal.title} ${row.deal.id} ${row.lead?.id || ""} ${row.business?.name || ""} ${row.business?.city || ""}`.toLowerCase();
      const probability = pipelineService.getDealProbability(row.deal);
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
        return b.deal.value * pipelineService.getDealProbability(b.deal) - a.deal.value * pipelineService.getDealProbability(a.deal);
      if (filters.sort === "probability") return pipelineService.getDealProbability(b.deal) - pipelineService.getDealProbability(a.deal);
      if (filters.sort === "close") return String(a.deal.expectedCloseAt).localeCompare(String(b.deal.expectedCloseAt));
      if (filters.sort === "lastActivity") return String(b.deal.lastActivityAt).localeCompare(String(a.deal.lastActivityAt));
      return String(b.deal.updatedAt).localeCompare(String(a.deal.updatedAt));
    });
}

export function Deals() {
  const [filters, setFilters] = useState<Record<string, string>>(() => pipelineService.getDealFiltersSnapshot());
  const rows = dealRows(filters);
  const metrics = pipelineService.getPipelineMetrics();
  const stages = pipelineService.getPipelineStageSummary("PIPE-1001").map(({ stage }: Row) => stage);
  const jobIds = [...new Set(pipelineService.listDeals().map((deal: Row) => pipelineService.getDealLead(deal)?.sourceJobId).filter(Boolean))] as string[];

  const setFilter = (key: string, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
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
                go("deals?modal=create");
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
                          go(`deals/${encodeURIComponent(deal.id)}`);
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
                            go(`crm/leads/${encodeURIComponent(lead.id)}`);
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
                      <b className="s6-probability">{pipelineService.getDealProbability(deal)}%</b>
                      <small>مرجح {money((deal.value * pipelineService.getDealProbability(deal)) / 100)}</small>
                    </td>
                    <td>{ownerName(deal.ownerId)}</td>
                    <td>{dateLabel(deal.expectedCloseAt)}</td>
                    <td><Mono>{lead?.sourceJobId || "—"}</Mono></td>
                    <td>
                      <button
                        type="button"
                        className="button ghost compact"
                        onClick={() => {
                          go(`deals/${encodeURIComponent(deal.id)}`);
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

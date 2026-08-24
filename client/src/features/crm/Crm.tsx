/**
 * إدارة العملاء — S5.
 *
 * منقولة عن `renderCrm()`. Lead تُنشأ فقط بعد تأكيد مستخدم صريح، ولا تنسخ
 * Business أو Score أو Opportunity — تُقرأ بالمرجع عند العرض فقط.
 */
import { useState } from "react";
import { businesses, getCrmFiltersSnapshot, getCrmSummary, getDiscoveryJob, getLeadActivitySummary, getLeadOwner, listUsers, listLeads } from "@services";
import { getBusinessIntelligence } from "@domain/intelligence.js";
import { go } from "../../shared/router/useHashRoute";
import { PageHead } from "../../shared/components/PageHead";
import {
  LeadRail,
  LeadStatusBadge,
  Mono,
  PriorityBadge,
  ScoreBadge,
  fmt,
  formatIso,
  leadPriorityLabels,
  leadStatusLabels,
  tierLabels,
} from "./shared";

type Row = Record<string, any>;

function leadRows(filters: Record<string, string>): Row[] {
  return listLeads()
    .map((lead: Row) => ({
      lead,
      business: businesses.find((item: Row) => item.id === lead.businessId),
      owner: getLeadOwner(lead),
      intelligence: getBusinessIntelligence(lead.businessId),
      job: getDiscoveryJob(lead.sourceJobId),
      activity: getLeadActivitySummary(lead.id),
    }))
    .filter((row: Row) => {
      const text = `${row.business?.name || ""} ${row.business?.category || ""} ${row.business?.city || ""} ${row.lead.id}`;
      const score = row.intelligence?.score;
      return (
        (!filters.search || text.includes(filters.search)) &&
        (filters.ownerId === "all" || row.lead.ownerId === filters.ownerId) &&
        (filters.status === "all" || row.lead.status === filters.status) &&
        (filters.priority === "all" || row.lead.priority === filters.priority) &&
        (filters.sourceJobId === "all" || row.lead.sourceJobId === filters.sourceJobId) &&
        (filters.city === "all" || row.business?.city === filters.city) &&
        (filters.tier === "all" || row.intelligence?.tier === filters.tier) &&
        (filters.tag === "all" || row.lead.tags?.includes(filters.tag)) &&
        (filters.minScore === "all" || (score !== null && score >= Number(filters.minScore)))
      );
    })
    .sort((a: Row, b: Row) => {
      if (filters.sort === "score") return (b.intelligence?.score ?? -1) - (a.intelligence?.score ?? -1);
      if (filters.sort === "created") return a.lead.createdAt.localeCompare(b.lead.createdAt);
      if (filters.sort === "name") return (a.business?.name || "").localeCompare(b.business?.name || "", "ar");
      if (filters.sort === "priority")
        return (({ high: 3, medium: 2, low: 1 } as Record<string, number>)[b.lead.priority] || 0) -
          (({ high: 3, medium: 2, low: 1 } as Record<string, number>)[a.lead.priority] || 0);
      if (filters.sort === "lastActivity") return (b.activity.lastActivityAt || "").localeCompare(a.activity.lastActivityAt || "");
      return b.lead.updatedAt.localeCompare(a.lead.updatedAt);
    });
}

export function Crm() {
  const [filters, setFilters] = useState<Record<string, string>>(() => getCrmFiltersSnapshot());
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [view, setView] = useState<"ready" | "loading" | "empty" | "error">("ready");

  const setFilter = (key: string, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  // حالات عرض الواجهة الأربع — محاكاة محلية بلا Backend
  if (view === "loading") {
    return (
      <>
        <PageHead kicker="إدارة العملاء" title="جارٍ تحميل Leads" description="محاكاة محلية لحالة التحميل؛ لا يوجد Backend." />
        <section className="crm-state-card card">
          <span className="status info">جارٍ التحميل</span>
          <h2>نجهز سياق العملاء وملكية السجلات.</h2>
          <div className="crm-skeleton" />
        </section>
      </>
    );
  }
  if (view === "empty") {
    return (
      <>
        <PageHead
          kicker="إدارة العملاء"
          title="لا توجد Leads بعد"
          description="حوّل Business من صفحة Intelligence لإضافتها إلى CRM."
          actions={
            <button className="button primary" type="button" onClick={() => go("discovery/results?job=JOB-1028")}>
              فتح نتائج الذكاء
            </button>
          }
        />
        <section className="crm-state-card card">
          <span className="status neutral">قائمة فارغة</span>
          <h2>لم تُضف أي Business إلى CRM في هذه الجلسة.</h2>
          <p>التحويل فعل مستخدم صريح ويحفظ مصدر الاكتشاف وسياق Intelligence.</p>
        </section>
      </>
    );
  }
  if (view === "error") {
    return (
      <>
        <PageHead
          kicker="إدارة العملاء"
          title="تعذر عرض CRM التجريبية"
          description="حالة عرض محلية فقط؛ لا توجد بيانات خارجية مفقودة."
          actions={
            <button
              className="button primary"
              type="button"
              onClick={() => {
                setView("ready");
              }}
            >
              إعادة المحاولة
            </button>
          }
        />
        <section className="crm-state-card card">
          <span className="status danger">تعذر العرض</span>
          <h2>يمكنك العودة إلى الحالة الجاهزة بأمان.</h2>
        </section>
      </>
    );
  }

  const rows = leadRows(filters);
  const summary = getCrmSummary();
  const selected = selectedIds.filter((id) => rows.some((row) => row.lead.id === id));

  const jobsList = [...new Map(listLeads().map((lead: Row) => [lead.sourceJobId, getDiscoveryJob(lead.sourceJobId)])).values()].filter(Boolean) as Row[];
  const cities = [...new Set(listLeads().map((lead: Row) => businesses.find((b: Row) => b.id === lead.businessId)?.city).filter(Boolean))] as string[];
  const tags = [...new Set(listLeads().flatMap((lead: Row) => lead.tags || []))] as string[];

  return (
    <>
      <PageHead
        kicker="إدارة العملاء"
        title="العملاء المحتملون"
        description="سجل موحد يحفظ أصل الاكتشاف وقرار الذكاء، ثم يوضح المالك والإجراء التالي دون نسخ درجات الفرص."
        actions={
          <button className="button primary" type="button" onClick={() => go("discovery/results?job=JOB-1028")}>
            فتح نتائج الذكاء
          </button>
        }
      />

      <LeadRail />

      <div className="prototype-notice crm-notice">
        <b>CRM محلية</b>
        <span>تُنشأ Lead فقط بعد مراجعة وتحويل صريح. لا توجد مزامنة أو رسائل أو صفقات جديدة في S5.</span>
      </div>

      <section className="crm-summary-grid" aria-label="ملخص إدارة العملاء">
        <article><span>إجمالي Leads</span><b>{fmt(summary.total)}</b><small>من مصدر الحقيقة CRM</small></article>
        <article><span>جدد</span><b>{fmt(summary.new)}</b><small>جاهزون للتوزيع</small></article>
        <article><span>تم التواصل</span><b>{fmt(summary.contacted)}</b><small>بانتظار خطوة تأهيل</small></article>
        <article><span>مؤهلون</span><b>{fmt(summary.qualified)}</b><small>بعد مراجعة بشرية</small></article>
        <article><span>أولوية عالية</span><b>{fmt(summary.highPriority)}</b><small>تحتاج إجراء واضح</small></article>
        <article><span>مهام اليوم</span><b>{fmt(summary.todayTasks)}</b><small>ضمن جدول الفريق</small></article>
      </section>

      <section className="card crm-filter-card">
        <div className="crm-filter-grid">
          <label className="search-field">
            <span>⌕</span>
            <input
              value={filters.search}
              placeholder="ابحث بالاسم أو النشاط أو المدينة أو المعرف"
              onChange={(event) => setFilter("search", event.target.value)}
            />
          </label>
          <select value={filters.ownerId} onChange={(e) => setFilter("ownerId", e.target.value)}>
            <option value="all">كل الملاك</option>
            {listUsers().map((user: Row) => (
              <option value={user.id} key={user.id}>{user.name}</option>
            ))}
          </select>
          <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="all">كل الحالات</option>
            {Object.entries(leadStatusLabels).map(([key, label]) => (
              <option value={key} key={key}>{label}</option>
            ))}
          </select>
          <select value={filters.priority} onChange={(e) => setFilter("priority", e.target.value)}>
            <option value="all">كل الأولويات</option>
            {Object.entries(leadPriorityLabels).map(([key, label]) => (
              <option value={key} key={key}>{label}</option>
            ))}
          </select>
          <select value={filters.sourceJobId} onChange={(e) => setFilter("sourceJobId", e.target.value)}>
            <option value="all">كل عمليات الاكتشاف</option>
            {jobsList.map((job) => (
              <option value={job.id} key={job.id}>{job.name}</option>
            ))}
          </select>
          <select value={filters.city} onChange={(e) => setFilter("city", e.target.value)}>
            <option value="all">كل المدن</option>
            {cities.map((city) => (
              <option value={city} key={city}>{city}</option>
            ))}
          </select>
          <select value={filters.tier} onChange={(e) => setFilter("tier", e.target.value)}>
            <option value="all">كل مستويات الفرصة</option>
            {Object.entries(tierLabels).map(([key, label]) => (
              <option value={key} key={key}>{label}</option>
            ))}
          </select>
          <select value={filters.tag} onChange={(e) => setFilter("tag", e.target.value)}>
            <option value="all">كل الوسوم</option>
            {tags.map((tag) => (
              <option value={tag} key={tag}>{tag}</option>
            ))}
          </select>
          <select value={filters.minScore} onChange={(e) => setFilter("minScore", e.target.value)}>
            <option value="all">أي درجة فرصة</option>
            <option value="80">80+ نقطة</option>
            <option value="65">65+ نقطة</option>
            <option value="40">40+ نقطة</option>
          </select>
          <select value={filters.sort} onChange={(e) => setFilter("sort", e.target.value)}>
            <option value="updated">الأحدث تحديثًا</option>
            <option value="score">أعلى درجة فرصة</option>
            <option value="created">الأقدم إنشاءً</option>
            <option value="name">الاسم</option>
            <option value="priority">الأولوية</option>
            <option value="lastActivity">آخر نشاط</option>
          </select>
        </div>
      </section>

      <section className="card crm-list-card">
        <div className="crm-selection-bar">
          <label className="check">
            <input
              type="checkbox"
              checked={Boolean(rows.length) && selected.length === rows.length}
              onChange={() => setSelectedIds(selected.length === rows.length ? [] : rows.map((row) => row.lead.id))}
            />{" "}
            تحديد الظاهر
          </label>
          <span>
            {fmt(selected.length)} محدد من {fmt(rows.length)} Lead
          </span>
        </div>

        <div className="table-wrap">
          <table className="data-table crm-leads-table">
            <thead>
              <tr>
                <th />
                <th>Lead</th>
                <th>المالك</th>
                <th>الحالة</th>
                <th>الأولوية</th>
                <th>درجة الفرصة</th>
                <th>المصدر</th>
                <th>آخر نشاط</th>
                <th>المتابعة التالية</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map(({ lead, business, owner, intelligence, job, activity }) => (
                  <tr className={selected.includes(lead.id) ? "selected" : ""} key={lead.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`تحديد ${business?.name || lead.id}`}
                        checked={selected.includes(lead.id)}
                        onChange={() => {
                          setSelectedIds((current) =>
                            current.includes(lead.id) ? current.filter((id) => id !== lead.id) : [...current, lead.id],
                          );
                        }}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="row-link company-cell"
                        onClick={() => {
                          go(`crm/leads/${encodeURIComponent(lead.id)}`);
                        }}
                      >
                        <i className="company-mark">{business?.short?.slice(0, 1) || "ع"}</i>
                        <span>
                          <b>{business?.name || lead.id}</b>
                          <small>
                            <Mono>{lead.id}</Mono> · {business?.category || "—"}
                          </small>
                        </span>
                      </button>
                    </td>
                    <td>{owner?.name || "غير مسند"}</td>
                    <td><LeadStatusBadge status={lead.status} /></td>
                    <td><PriorityBadge priority={lead.priority} /></td>
                    <td><ScoreBadge record={intelligence} /></td>
                    <td><small>{job?.name || lead.sourceJobId}</small></td>
                    <td><small>{formatIso(activity.lastActivityAt)}</small></td>
                    <td>
                      <small>
                        {activity.nextTask ? `${activity.nextTask.title} · ${formatIso(activity.nextTask.dueAt)}` : "لا توجد"}
                      </small>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="button ghost compact"
                        onClick={() => {
                          go(`crm/leads/${encodeURIComponent(lead.id)}`);
                        }}
                      >
                        فتح 360
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10}>
                    <div className="table-empty">
                      <b>لا توجد Leads تطابق الفلاتر.</b>
                      <span>غيّر الفلاتر أو حوّل Business من Intelligence إلى CRM.</span>
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

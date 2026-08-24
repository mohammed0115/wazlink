/**
 * عمليات الاكتشاف — S3.
 * منقولة عن `renderDiscoveryJobs()` مع نفس الفلاتر والترتيب وأعمدة الجدول.
 */
import { useState } from "react";
import { cancelDiscoveryJob, formatDiscoveryJobCreatedAt, getDiscoveryListFiltersSnapshot, getJobStatusLabel, isDiscoveryJobRecent, isDiscoveryJobToday, isDiscoveryResultsAvailable, jobs, retryDiscoveryJob, listDiscoverySources } from "@services";
import { go } from "../../shared/router/useHashRoute";
import { useToast } from "../../shared/store/toast";
import { runDiscoverySimulation, stopDiscoverySimulation } from "./simulation";
import { PageHead } from "../../shared/components/PageHead";
import { StatusBadge, fmt, isProcessing, sourceName } from "./shared";
import type { DiscoveryListFilters } from "../../domain/types";

type Job = Record<string, any>;

function applyJobFilters(filters: DiscoveryListFilters): Job[] {
  const matchesDate = (job: Job) =>
    filters.date === "all" ||
    (filters.date === "today" && isDiscoveryJobToday(job)) ||
    (filters.date === "recent" && isDiscoveryJobRecent(job));

  return [...jobs]
    .filter(
      (job: Job) =>
        (!filters.search || `${job.name} ${job.id}`.includes(filters.search)) &&
        (filters.status === "all" || job.status === filters.status) &&
        (filters.sourceId === "all" || job.sourceId === filters.sourceId) &&
        matchesDate(job),
    )
    .sort((a: Job, b: Job) =>
      filters.sort === "oldest"
        ? a.createdAt.localeCompare(b.createdAt)
        : filters.sort === "results"
          ? b.deduplicatedCount - a.deduplicatedCount
          : b.createdAt.localeCompare(a.createdAt),
    );
}

export function DiscoveryJobs() {
  const toast = useToast();
  const [filters, setFilters] = useState<DiscoveryListFilters>(() => getDiscoveryListFiltersSnapshot() as DiscoveryListFilters);
  const visible = applyJobFilters(filters);

  const setFilter = (key: string, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  function retry(jobId: string) {
    retryDiscoveryJob(jobId);
    runDiscoverySimulation(jobId, (id) => toast(`اكتملت العملية ${id} ببيانات تجريبية ثابتة.`, "success"));
    go(`discovery/jobs/${jobId}`);
  }

  return (
    <>
      <PageHead
        kicker="سجل الاكتشاف"
        title="عمليات الاكتشاف"
        description="تابع حالة كل عملية، نتائجها، ومصدرها من دون فقدان إعدادات البحث."
        actions={
          <button className="button primary" type="button" onClick={() => go("discovery")}>
            بدء عملية جديدة
          </button>
        }
      />

      <section className="card">
        <div className="discovery-list-toolbar">
          <label className="search-field">
            <span>⌕</span>
            <input
              value={filters.search}
              placeholder="ابحث بالاسم أو المعرف"
              onChange={(event) => setFilter("search", event.target.value)}
            />
          </label>
          <select value={filters.status} onChange={(event) => setFilter("status", event.target.value)}>
            <option value="all">كل الحالات</option>
            {["pending", "processing", "completed", "failed", "cancelled"].map((status) => (
              <option value={status} key={status}>
                {getJobStatusLabel(status)}
              </option>
            ))}
          </select>
          <select value={filters.sourceId} onChange={(event) => setFilter("sourceId", event.target.value)}>
            <option value="all">كل المصادر</option>
            {listDiscoverySources().map((source: { id: string; name: string }) => (
              <option value={source.id} key={source.id}>
                {source.name}
              </option>
            ))}
          </select>
          <select value={filters.date} onChange={(event) => setFilter("date", event.target.value)}>
            <option value="all">كل التواريخ</option>
            <option value="recent">حديثًا</option>
            <option value="today">اليوم</option>
          </select>
          <select value={filters.sort} onChange={(event) => setFilter("sort", event.target.value)}>
            <option value="newest">الأحدث</option>
            <option value="oldest">الأقدم</option>
            <option value="results">الأكثر نتائج</option>
          </select>
        </div>

        <div className="table-wrap">
          <table className="data-table discovery-jobs-table">
            <thead>
              <tr>
                <th>العملية</th>
                <th>المصدر</th>
                <th>الكلمات</th>
                <th>المواقع</th>
                <th>النتائج</th>
                <th>الحالة</th>
                <th>التاريخ</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.length ? (
                visible.map((job) => (
                  <tr key={job.id}>
                    <td>
                      <button className="row-link" type="button" onClick={() => go(`discovery/jobs/${job.id}`)}>
                        <b>{job.name}</b>
                        <small className="mono ltr">{job.id}</small>
                      </button>
                    </td>
                    <td>{sourceName(job.sourceId)}</td>
                    <td>{fmt(job.keywords.length)} كلمات</td>
                    <td>{fmt(job.locations.length)} مواقع</td>
                    <td>{isDiscoveryResultsAvailable(job) ? fmt(job.deduplicatedCount) : "—"}</td>
                    <td>
                      <StatusBadge status={job.status} />
                    </td>
                    <td>{formatDiscoveryJobCreatedAt(job)}</td>
                    <td>
                      <div className="job-table-actions">
                        <button type="button" className="button ghost" onClick={() => go(`discovery/jobs/${job.id}`)}>
                          {isProcessing(job) ? "متابعة التقدم" : "فتح"}
                        </button>
                        {isDiscoveryResultsAvailable(job) && (
                          <button
                            type="button"
                            className="button ghost"
                            onClick={() => go(`discovery/results?job=${job.id}`)}
                          >
                            النتائج
                          </button>
                        )}
                        {isProcessing(job) && (
                          <button
                            type="button"
                            className="button ghost danger-action"
                            onClick={() => {
                              go(`discovery/jobs?modal=cancel&job=${encodeURIComponent(job.id)}`);
                            }}
                          >
                            إلغاء
                          </button>
                        )}
                        {["failed", "cancelled"].includes(job.status) && (
                          <button type="button" className="button ghost" onClick={() => retry(job.id)}>
                            إعادة التشغيل
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8}>
                    <div className="table-empty">لم نجد عمليات تطابق هذه المعايير.</div>
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

/** يُستخدم من نافذة التأكيد — إلغاء العملية وإيقاف مؤقتها. */
export function confirmCancelDiscovery(jobId: string): void {
  cancelDiscoveryJob(jobId);
  stopDiscoverySimulation(jobId);
}

/**
 * تفاصيل عملية اكتشاف — S3.
 * منقولة عن `renderDiscoveryJob()`: ملخص، تقدم، أعداد، ومراحل معالجة.
 * المراحل تمثل تجربة محلية ثابتة لا Scraping ولا Enrichment فعليًا.
 */
import {
  completeDiscoveryJob,
  formatDiscoveryJobCreatedAt,
  getDiscoveryJob,
  getJobStatusLabel,
  isDiscoveryResultsAvailable,
  retryDiscoveryJob,
  state,
} from "@domain/data.js";
import { go } from "../../shared/router/useHashRoute";
import { notifyStateChanged } from "../../shared/store/appStore";
import { useToast } from "../../shared/store/toast";
import { runDiscoverySimulation, stopDiscoverySimulation } from "./simulation";
import { PageHead } from "../../shared/components/PageHead";
import { Mono, StatusBadge, fmt, isProcessing, sourceName } from "./shared";
import type { DiscoveryModalState } from "../../domain/types";

const stages = [
  "تهيئة البحث",
  "البحث في المصادر",
  "جمع بيانات الشركات",
  "تنظيف البيانات",
  "إزالة التكرارات",
  "التحقق من السجلات",
  "إنهاء النتائج",
];

function stageState(job: Record<string, any>, index: number): string {
  if (job.status === "failed") return index < 3 ? "done" : index === 3 ? "failed" : "pending";
  if (job.status === "cancelled") return index < 2 ? "done" : index === 2 ? "cancelled" : "pending";
  if (job.status === "completed") return "done";
  const active = Math.min(6, Math.floor(job.progress / 15));
  return index < active ? "done" : index === active ? "processing" : "pending";
}

const stageLabels: Record<string, string> = {
  done: "مكتمل",
  processing: "قيد المعالجة",
  failed: "تعذر الإكمال",
  cancelled: "تم الإلغاء",
  pending: "بانتظار المرحلة السابقة",
};

const stageMarks: Record<string, string> = { done: "✓", processing: "…", failed: "!", cancelled: "×", pending: "○" };

export function DiscoveryJob({ jobId }: { jobId: string }) {
  const toast = useToast();
  const job = getDiscoveryJob(jobId);

  if (!job) {
    return (
      <PageHead
        kicker="سجل الاكتشاف"
        title="لم نجد عملية الاكتشاف"
        description="قد تكون العملية غير موجودة في هذه الجلسة التجريبية."
        actions={
          <button className="button primary" type="button" onClick={() => go("discovery/jobs")}>
            العودة للعمليات
          </button>
        }
      />
    );
  }

  const canResults = isDiscoveryResultsAvailable(job);

  const requestCancel = () => {
    (state as { discoveryModal: DiscoveryModalState }).discoveryModal = { type: "cancel", jobId: job.id };
    notifyStateChanged();
  };

  const retry = () => {
    retryDiscoveryJob(job.id);
    runDiscoverySimulation(job.id, (id) => toast(`اكتملت العملية ${id} ببيانات تجريبية ثابتة.`, "success"));
    go(`discovery/jobs/${job.id}`);
  };

  const complete = () => {
    completeDiscoveryJob(job.id);
    stopDiscoverySimulation(job.id);
    toast("اكتملت المحاكاة التجريبية.", "success");
    notifyStateChanged();
  };

  const headAction = canResults ? (
    <button className="button primary" type="button" onClick={() => go(`discovery/results?job=${job.id}`)}>
      عرض النتائج
    </button>
  ) : job.status === "failed" || job.status === "cancelled" ? (
    <button className="button primary" type="button" onClick={retry}>
      {job.status === "failed" ? "إعادة المحاولة" : "إعادة التشغيل"}
    </button>
  ) : (
    <button className="button" type="button" onClick={complete}>
      تسريع المحاكاة
    </button>
  );

  return (
    <>
      <PageHead
        kicker="عملية اكتشاف"
        title={job.name}
        description="حالة معالجة تجريبية قابلة للتتبع. لا يتم الاتصال بأي مصدر أعمال خارجي."
        actions={headAction}
      />

      <div className="prototype-notice discovery-notice">
        <b>محاكاة بيانات</b>
        <span>المراحل والأعداد أدناه تمثل تجربة محلية ثابتة، وليست عملية Scraping أو Enrichment فعلية.</span>
      </div>

      <section className="job-detail-grid">
        <article className="card job-summary-card">
          <header>
            <div>
              <span>معرف العملية</span>
              <Mono>{job.id}</Mono>
            </div>
            <StatusBadge status={job.status} />
          </header>
          <div className="job-query-facts">
            <div><span>المصدر</span><b>{sourceName(job.sourceId)}</b></div>
            <div><span>الكلمات</span><b>{job.keywords.join("، ")}</b></div>
            <div><span>المواقع</span><b>{job.locations.join("، ")}</b></div>
            <div><span>المجموعات</span><b>{fmt(job.combinationCount)} مجموعة</b></div>
            <div><span>أنشئت</span><b>{formatDiscoveryJobCreatedAt(job)}</b></div>
            <div>
              <span>الفلاتر</span>
              <b>
                {job.filters.minRating === "any" ? "أي تقييم" : `${job.filters.minRating}+`} ·{" "}
                {job.filters.minReviews === "any" ? "أي مراجعات" : `${job.filters.minReviews}+`}
              </b>
            </div>
          </div>
        </article>

        <article className="card job-progress-card">
          <div className="job-progress-top">
            <div>
              <span>تقدم المعالجة</span>
              <b>{fmt(job.progress)}%</b>
            </div>
            <span>{getJobStatusLabel(job.status)}</span>
          </div>

          <div
            className="progress-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={job.progress}
            aria-label="تقدم عملية الاكتشاف"
          >
            <i style={{ width: `${job.progress}%` }} />
          </div>

          <div className="job-count-strip">
            <span><small>تم العثور</small><b>{fmt(job.foundCount || job.discoveredCount)}</b></span>
            <span><small>مكرر</small><b>{fmt(job.duplicateCount)}</b></span>
            <span><small>النتيجة النهائية</small><b>{fmt(job.deduplicatedCount)}</b></span>
          </div>

          {job.status === "completed" && (
            <div className="job-completed-note">
              <b>اكتملت عملية الاكتشاف</b>
              <span>
                {fmt(job.foundCount)} تم العثور − {fmt(job.duplicateCount)} مكرر = {fmt(job.deduplicatedCount)} نتيجة نهائية
              </span>
              <strong>المدة التجريبية: 00:12</strong>
            </div>
          )}

          {job.status === "failed" && (
            <div className="job-error-note">
              <b>تعذر إكمال عملية الاكتشاف.</b>
              <span>{job.failureMessage}</span>
            </div>
          )}

          <footer className="job-detail-actions">
            {isProcessing(job) && (
              <>
                <button className="button danger" type="button" onClick={requestCancel}>إلغاء العملية</button>
                <button className="button" type="button" onClick={complete}>إكمال المحاكاة</button>
              </>
            )}
            {(job.status === "failed" || job.status === "cancelled") && (
              <>
                <button className="button primary" type="button" onClick={retry}>
                  {job.status === "failed" ? "إعادة المحاولة" : "إعادة التشغيل"}
                </button>
                <button className="button" type="button" onClick={() => go("discovery/jobs")}>العودة للعمليات</button>
              </>
            )}
            {canResults && (
              <>
                <button className="button primary" type="button" onClick={() => go(`discovery/results?job=${job.id}`)}>
                  عرض النتائج
                </button>
                <button className="button" type="button" onClick={() => go("discovery/jobs")}>العودة للعمليات</button>
              </>
            )}
          </footer>
        </article>
      </section>

      <section className="card">
        <header className="card-head">
          <div>
            <h2>مراحل المعالجة</h2>
            <p>كل مرحلة تشرح سير الاكتشاف فقط، من دون ذكاء اصطناعي أو CRM.</p>
          </div>
        </header>
        <ol className="discovery-processing-list">
          {stages.map((stage, index) => {
            const stageClass = stageState(job, index);
            return (
              <li className={stageClass} key={stage}>
                <i>{stageMarks[stageClass]}</i>
                <div>
                  <b>{stage}</b>
                  <small>{stageLabels[stageClass]}</small>
                </div>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}

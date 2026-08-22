/**
 * نوافذ الاكتشاف — S3.
 *
 * تغطي حاليًا تأكيد الإلغاء ومعاينة نتيجة. أنواع قرار Scraper/CRM تنتمي
 * إلى سطح النتائج (S4) وتُضاف مع تحويله.
 *
 * سلوك محفوظ من SCRAPER-OR-CRM: الخلفية تُغلق فقط عند النقر عليها هي،
 * لا عند فقاعة حدث من زر بداخل النافذة.
 */
import type { MouseEvent } from "react";
import { businesses, convertBusinessToLead, getDiscoveryJob, scraperCrmPackages, state } from "@domain/data.js";
import { notifyStateChanged } from "../../shared/store/appStore";
import { useToast } from "../../shared/store/toast";
import { stopDiscoverySimulation } from "./simulation";
import { Mono, fmt, sourceName } from "./shared";
import { downloadScraperCsv } from "../intelligence/export";
import { go } from "../../shared/router/useHashRoute";
import { cancelDiscoveryJob } from "@domain/data.js";
import type { DiscoveryModalState } from "../../domain/types";
import { useModalDismiss } from "../../shared/components/useModalDismiss";

export function DiscoveryModal() {
  const toast = useToast();
  const modal = state.discoveryModal as DiscoveryModalState;
  if (!modal) return null;

  const close = () => {
    (state as { discoveryModal: DiscoveryModalState }).discoveryModal = null;
    notifyStateChanged();
  };

  /** الخلفية تُغلق عند النقر عليها فقط. */
  const panelRef = useModalDismiss(close);

  const onBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) close();
  };

  if (modal.type === "cancel") {
    const job = getDiscoveryJob(modal.jobId);
    return (
      <div className="modal-backdrop" onClick={onBackdrop}>
        <section ref={panelRef as never} tabIndex={-1} className="modal" role="dialog" aria-modal="true" aria-labelledby="cancelDiscoveryTitle">
          <header className="modal-head">
            <div>
              <h2 id="cancelDiscoveryTitle">هل تريد إلغاء عملية الاكتشاف؟</h2>
              <p>
                ستبقى العملية {job ? <Mono>{job.id}</Mono> : null} في السجل بحالة «ملغي» ولن تُحذف.
              </p>
            </div>
            <button className="modal-close" type="button" aria-label="إغلاق" onClick={close}>
              ×
            </button>
          </header>
          <div className="modal-footer">
            <button className="button" type="button" onClick={close}>
              العودة
            </button>
            <button
              className="button danger"
              type="button"
              onClick={() => {
                cancelDiscoveryJob(modal.jobId);
                stopDiscoverySimulation(modal.jobId);
                close();
                toast("تم إلغاء عملية الاكتشاف مع الاحتفاظ بها في السجل.", "info");
              }}
            >
              تأكيد الإلغاء
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (modal.type === "business") {
    const business = businesses.find((item: { id: string }) => item.id === modal.businessId);
    if (!business) return null;
    const job = getDiscoveryJob(business.discoveryJobId);

    return (
      <div className="modal-backdrop" onClick={onBackdrop}>
        <section className="modal" role="dialog" aria-modal="true" aria-labelledby="previewBusinessTitle">
          <header className="modal-head">
            <div>
              <p className="eyebrow">معاينة نتيجة اكتشاف</p>
              <h2 id="previewBusinessTitle">{business.name}</h2>
              <p className="mono ltr">{business.id}</p>
            </div>
            <button className="modal-close" type="button" aria-label="إغلاق" onClick={close}>
              ×
            </button>
          </header>
          <dl className="business-preview-detail">
            <div><dt>النشاط</dt><dd>{business.category}</dd></div>
            <div><dt>العنوان</dt><dd>{business.address || `${business.city}، ${business.country}`}</dd></div>
            <div><dt>الهاتف</dt><dd className="mono ltr">{business.phone || "—"}</dd></div>
            <div><dt>الموقع</dt><dd className="mono ltr">{business.website || "—"}</dd></div>
            <div><dt>التقييم</dt><dd>★ {business.rating} · {fmt(business.reviews ?? 0)} مراجعة</dd></div>
            <div><dt>مصدر الاكتشاف</dt><dd>{job ? sourceName(job.sourceId) : "—"}</dd></div>
            <div><dt>عملية الاكتشاف</dt><dd className="mono ltr">{job?.id || "—"}</dd></div>
          </dl>
          <div className="future-action-note">
            <b>تحليل الفرصة بالذكاء الاصطناعي</b>
            <span>متاح في المرحلة التالية (S4)</span>
            <button type="button" className="button" disabled>
              متاح لاحقًا
            </button>
          </div>
        </section>
      </div>
    );
  }

  if (modal.type === "scraper-crm-decision") {
    const job = getDiscoveryJob(modal.jobId || state.selectedJobId);
    const ids = modal.businessIds || [];
    return (
      <div className="modal-backdrop" onClick={onBackdrop}>
        <section className="modal scraper-crm-modal" role="dialog" aria-modal="true" aria-labelledby="scraperCrmDecisionTitle">
          <header className="modal-head">
            <div>
              <p className="eyebrow">بعد الاستخراج</p>
              <h2 id="scraperCrmDecisionTitle">ماذا تريد أن تفعل بـ{fmt(ids.length)} نتيجة؟</h2>
              <p>اختر مسارًا واحدًا؛ باقة الاستخراج مستقلة عن باقة CRM نمو.</p>
            </div>
            <button className="modal-close" type="button" aria-label="إغلاق" onClick={close}>
              ×
            </button>
          </header>

          <div className="scraper-crm-choice-grid">
            <article className="journey-choice scraper-choice">
              <span className="choice-step">01</span>
              <p className="eyebrow">{scraperCrmPackages.scraper.label}</p>
              <h3>نزّل Excel وانتهى</h3>
              <p>{scraperCrmPackages.scraper.purpose}. لا تحتاج إلى CRM أو إعداد مبيعات.</p>
              <ul>
                {scraperCrmPackages.scraper.features.map((item: string) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <strong>{scraperCrmPackages.scraper.price}</strong>
              <button
                className="button primary"
                type="button"
                onClick={() => {
                  const count = downloadScraperCsv(modal.jobId || state.selectedJobId, ids);
                  state.scraperCrmUi = { ...state.scraperCrmUi, exportCount: count };
                  (state as { discoveryModal: DiscoveryModalState }).discoveryModal = {
                    type: "scraper-export-success",
                    jobId: modal.jobId,
                    businessIds: ids,
                  };
                  notifyStateChanged();
                  toast(`تم تنزيل ${count} صفًا بصيغة CSV متوافقة مع Excel محليًا.`, "success");
                }}
              >
                تنزيل Excel تجريبي
              </button>
            </article>

            <article className="journey-choice crm-choice">
              <span className="choice-step">02</span>
              <p className="eyebrow">{scraperCrmPackages.crm.label}</p>
              <h3>إدارة النتائج داخل نمو</h3>
              <p>{scraperCrmPackages.crm.purpose}. ستتحول النتائج إلى Leads مع مصدر الاكتشاف.</p>
              <ul>
                {scraperCrmPackages.crm.features.map((item: string) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <strong>{scraperCrmPackages.crm.price}</strong>
              <button
                className="button"
                type="button"
                onClick={() => {
                  const outcomes = ids.map((businessId) =>
                    convertBusinessToLead(businessId, {
                      status: "new",
                      priority: "medium",
                      tags: ["من باقة Scraper", "ترقية CRM تجريبية"],
                    }),
                  );
                  const created = outcomes.filter((result: { kind: string }) => result.kind === "created").length;
                  const duplicates = outcomes.filter((result: { kind: string }) => result.kind === "duplicate").length;
                  state.scraperCrmUi = {
                    ...state.scraperCrmUi,
                    convertedLeadIds: outcomes.map((result: any) => result.lead?.id).filter(Boolean) as never[],
                  };
                  (state as { selectedResultIds: string[] }).selectedResultIds = [];
                  close();
                  toast(
                    `تمت ترقية CRM محليًا: ${created} Lead جديدة${duplicates ? `، و${duplicates} موجودة مسبقًا لم تتكرر` : ""}. لا توجد دفعة أو اتصال خارجي.`,
                    "success",
                  );
                  go("crm");
                }}
              >
                ترقية CRM نمو
              </button>
            </article>
          </div>

          <footer className="modal-footer">
            <small>عملية {job?.id || "—"} · كل الخيارات محلية وتجريبية فقط.</small>
            <button className="button ghost" type="button" onClick={close}>
              العودة للنتائج
            </button>
          </footer>
        </section>
      </div>
    );
  }

  if (modal.type === "scraper-export-success") {
    return (
      <div className="modal-backdrop" onClick={onBackdrop}>
        <section className="modal export-success-modal" role="dialog" aria-modal="true" aria-labelledby="exportSuccessTitle">
          <header className="modal-head">
            <div>
              <p className="eyebrow">اكتمل التصدير</p>
              <h2 id="exportSuccessTitle">تم تنزيل ملف Excel محليًا</h2>
              <p>
                {fmt(state.scraperCrmUi.exportCount || 0)} صفًا بالأعمدة التي اخترتها. لم يُنشأ Lead أو Deal، ولم يحدث أي
                اتصال خارجي.
              </p>
            </div>
            <button className="modal-close" type="button" aria-label="إغلاق" onClick={close}>
              ×
            </button>
          </header>
          <div className="modal-footer">
            <button className="button" type="button" onClick={close}>
              العودة للنتائج
            </button>
          </div>
        </section>
      </div>
    );
  }

  return null;
}

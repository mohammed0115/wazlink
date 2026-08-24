/**
 * نافذة تحويل Business إلى Lead — S5 Conversion Preview.
 *
 * لا تُنشأ Lead إلا بعد تأكيد صريح. `businessId` المكرر يمنع النسخة الثانية
 * ويعيد المستخدم إلى Lead القائمة، وفق قاعدة «Lead واحدة لكل Business».
 */
import type { MouseEvent } from "react";
import { listBusinesses, convertBusinessToLead, getDiscoveryJob, getLeadByBusinessId } from "@services";
import { getBusinessIntelligence } from "@domain/intelligence.js";
import { go, useHashRoute } from "../../shared/router/useHashRoute";
import { useToast } from "../../shared/store/toast";
import { Mono, ScoreBadge } from "./shared";
import { useModalDismiss } from "../../shared/components/useModalDismiss";

type CrmModalState = { type: "conversion"; businessId: string } | null;

export function CrmModal() {
  const toast = useToast();
  const { path, query } = useHashRoute();
  const businessId = query.get("businessId") || query.get("business");
  const modal = query.get("modal") === "conversion" && businessId ? { type: "conversion" as const, businessId } : null;
  if (!modal) return null;

  const close = () => {
    go(path === "intelligence" && businessId ? `intelligence?business=${encodeURIComponent(businessId)}` : path);
  };
  const panelRef = useModalDismiss(close);

  const onBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) close();
  };

  const business = listBusinesses().find((item: any) => item.id === modal.businessId);
  if (!business) return null;

  const record = getBusinessIntelligence(business.id) as any;
  const job = getDiscoveryJob(business.discoveryJobId);
  const existing = getLeadByBusinessId(business.id);

  if (existing) {
    return (
      <div className="modal-backdrop" onClick={onBackdrop}>
        <section ref={panelRef as never} tabIndex={-1} className="modal crm-conversion-modal" role="dialog" aria-modal="true">
          <header className="modal-head">
            <div>
              <p className="eyebrow">CRM</p>
              <h2>هذه Business موجودة في CRM بالفعل</h2>
              <p>
                {business.name} مرتبطة بـ<Mono>{existing.id}</Mono>؛ لا يمكن إنشاء Lead ثانية للسجل نفسه.
              </p>
            </div>
            <button className="modal-close" type="button" aria-label="إغلاق" onClick={close}>×</button>
          </header>
          <div className="modal-footer">
            <button className="button" type="button" onClick={close}>إلغاء</button>
            <button
              className="button primary"
              type="button"
              onClick={() => {
                close();
                go(`crm/leads/${encodeURIComponent(existing.id)}`);
              }}
            >
              فتح Lead الحالية
            </button>
          </div>
        </section>
      </div>
    );
  }

  const canConvert = record?.status !== "analysis_error" && record?.status !== "not_analyzed";
  const contactLine =
    business.phone || business.email
      ? `${business.phone || "—"}${business.email ? ` · ${business.email}` : ""}`
      : "لا توجد جهة اتصال جاهزة";

  return (
    <div className="modal-backdrop" onClick={onBackdrop}>
      <section className="modal crm-conversion-modal" role="dialog" aria-modal="true" aria-labelledby="conversionTitle">
        <header className="modal-head">
          <div>
            <p className="eyebrow">معاينة التحويل إلى CRM</p>
            <h2 id="conversionTitle">{business.name}</h2>
            <p>
              <Mono>{business.id}</Mono> · {business.category} · {business.city}
            </p>
          </div>
          <button className="modal-close" type="button" aria-label="إغلاق" onClick={close}>×</button>
        </header>

        <dl className="business-preview-detail">
          <div><dt>درجة الفرصة</dt><dd><ScoreBadge record={record} /></dd></div>
          <div><dt>جهة الاتصال</dt><dd className="ltr">{contactLine}</dd></div>
          <div><dt>مصدر الاكتشاف</dt><dd><Mono>{job?.id || "—"}</Mono></dd></div>
          <div><dt>حالة التحليل</dt><dd>{record?.status || "—"}</dd></div>
        </dl>

        <p className="muted">
          ينشئ التحويل Lead وCompany ومرجع Contact عند توفره، ويحفظ `businessId` و`sourceJobId`. لا يُنشأ Deal ولا
          رسالة ولا أي اتصال خارجي.
        </p>

        <div className="modal-footer">
          <button className="button" type="button" onClick={close}>إلغاء</button>
          <button
            className="button primary"
            type="button"
            disabled={!canConvert}
            onClick={() => {
              const result = convertBusinessToLead(business.id, { status: "new", priority: "medium" });
              close();
              if (result.kind === "duplicate") {
                toast("هذه Business مرتبطة بـLead قائمة؛ لم تُنشأ نسخة ثانية.", "info");
              } else {
                toast("أُنشئت Lead محليًا مع حفظ مصدر الاكتشاف وسياق Intelligence.", "success");
              }
              if (result.lead?.id) {
                go(`crm/leads/${encodeURIComponent(result.lead.id)}`);
              }
            }}
          >
            تأكيد الإضافة إلى CRM
          </button>
        </div>
      </section>
    </div>
  );
}

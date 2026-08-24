/**
 * نوافذ الذكاء — S4: تفسير الدرجة ودليل الإشارة.
 * كلاهما عرض تفسيري فقط ولا يغيّر أي كيان.
 */
import type { MouseEvent } from "react";
import { businesses, listSignals } from "@services";
import { getBusinessIntelligence } from "@domain/intelligence.js";
import { DimensionRows } from "./shared";
import { go, useHashRoute } from "../../shared/router/useHashRoute";
import { useModalDismiss } from "../../shared/components/useModalDismiss";

export function IntelligenceModal() {
  const { path, query } = useHashRoute();
  const modalType = query.get("modal");
  const businessId = query.get("business") || query.get("businessId") || "";
  const signalId = query.get("signalId") || "";
  const modal = modalType && ["breakdown", "evidence"].includes(modalType)
    ? { type: modalType, businessId, signalId }
    : null;
  if (!modal) return null;

  const close = () => {
    go(path === "intelligence" && businessId ? `intelligence?business=${encodeURIComponent(businessId)}` : path);
  };
  const panelRef = useModalDismiss(close);

  const onBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) close();
  };

  if (modal.type === "breakdown") {
    const record = getBusinessIntelligence(businessId);
    if (!record) return null;
    return (
      <div className="modal-backdrop" onClick={onBackdrop}>
        <section ref={panelRef as never} tabIndex={-1} className="modal s4-explain-modal" role="dialog" aria-modal="true" aria-labelledby="scoreExplainTitle">
          <header className="modal-head">
            <div>
              <p className="eyebrow">تفسير الدرجة</p>
              <h2 id="scoreExplainTitle">كيف حُسبت درجة {record.business.name}؟</h2>
            </div>
            <button className="modal-close" type="button" aria-label="إغلاق" onClick={close}>
              ×
            </button>
          </header>
          <div className="s4-dimension-list">
            <DimensionRows record={record} />
          </div>
          <footer className="modal-footer">
            <span>
              الإجمالي: <b>{record.score} / 100</b>
            </span>
            <button type="button" className="button" onClick={close}>
              إغلاق
            </button>
          </footer>
        </section>
      </div>
    );
  }

  const signal = listSignals().find((item: { id: string }) => item.id === signalId);
  if (!signal) return null;
  const business = businesses.find((item: { id: string }) => item.id === signal.businessId);

  return (
    <div className="modal-backdrop" onClick={onBackdrop}>
      <section className="modal s4-evidence-modal" role="dialog" aria-modal="true" aria-labelledby="evidenceTitle">
        <header className="modal-head">
          <div>
            <p className="eyebrow">دليل الإشارة</p>
            <h2 id="evidenceTitle">{business?.name || signal.businessId}</h2>
          </div>
          <button className="modal-close" type="button" aria-label="إغلاق" onClick={close}>
            ×
          </button>
        </header>
        <dl className="business-preview-detail">
          <div><dt>الإشارة</dt><dd>{signal.value}</dd></div>
          <div><dt>النوع</dt><dd>{signal.polarity}</dd></div>
          <div><dt>المعرف</dt><dd className="mono ltr">{signal.id}</dd></div>
          <div><dt>المصدر</dt><dd>Business fixture محلي</dd></div>
        </dl>
        <p className="s4-evidence-copy">{signal.evidence}</p>
        <div className="modal-footer">
          <button type="button" className="button" onClick={close}>
            إغلاق
          </button>
        </div>
      </section>
    </div>
  );
}

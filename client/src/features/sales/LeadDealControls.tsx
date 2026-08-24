/**
 * لوحة الصفقات داخل Lead 360 — S6.
 * تسمح S6 بصفقات متعددة لنفس Lead عند اختلاف الخدمة أو العنوان.
 */
import { getDealProbability, getDealStage, getLeadDeals, getOpenDealsForLead } from "@services";
import { go } from "../../shared/router/useHashRoute";
import { fmt } from "./shared";

export function LeadDealControls({ leadId }: { leadId: string }) {
  const deals = getLeadDeals(leadId);
  const openDeals = getOpenDealsForLead(leadId);

  const openForm = () => {
    go(`deals?modal=create&leadId=${encodeURIComponent(leadId)}`);
  };

  if (openDeals.length) {
    return (
      <div className="lead-deal-link">
        <b>{fmt(openDeals.length)} صفقات مفتوحة</b>
        {openDeals.map((deal: any) => {
          const stage = getDealStage(deal);
          return (
            <div className="lead-deal-item" key={deal.id}>
              <span className="status info">{stage?.name || "مفتوحة"}</span>
              <strong>{deal.title}</strong>
              <small>
                {fmt(deal.value)} ر.س · احتمال {getDealProbability(deal)}%
              </small>
              <button
                type="button"
                className="button primary compact"
                onClick={() => {
                  go(`deals/${encodeURIComponent(deal.id)}`);
                }}
              >
                فتح الصفقة
              </button>
            </div>
          );
        })}
        <button type="button" className="button ghost" onClick={openForm}>
          إضافة صفقة مختلفة
        </button>
      </div>
    );
  }

  return (
    <div className="future-action-note s6-lead-deal-create">
      <b>إنشاء صفقة من Lead</b>
      <span>
        {fmt(deals.length)} صفقة في السجل، ولا توجد صفقة مفتوحة حاليًا. تسمح S6 بصفقات متعددة عندما تختلف الخدمة أو
        العنوان.
      </span>
      <button type="button" className="button primary" onClick={openForm}>
        إنشاء صفقة جديدة
      </button>
    </div>
  );
}

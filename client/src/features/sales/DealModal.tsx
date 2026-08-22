/**
 * نوافذ الصفقة — S6: إنشاء، إغلاق كرابحة، إغلاق كخاسرة.
 *
 * حد S6 محفوظ: الإغلاق كرابحة لا ينشئ `RevenueEvent` ولا `AttributionTouchpoint`.
 * الإغلاق كخاسرة يتطلب سببًا صريحًا.
 */
import type { FormEvent, MouseEvent } from "react";
import {
  businesses,
  closeDealAsLost,
  closeDealAsWon,
  createDeal,
  getDeal,
  getDealLead,
  getPipelineStageSummary,
  mockModel,
  state,
} from "@domain/data.js";
import { go } from "../../shared/router/useHashRoute";
import { mutate, notifyStateChanged } from "../../shared/store/appStore";
import { useToast } from "../../shared/store/toast";
import { money } from "./shared";
import { useModalDismiss } from "../../shared/components/useModalDismiss";

type DealModalState = { type: "create"; leadId?: string } | { type: "won" | "lost"; dealId: string } | null;

export function DealModal() {
  const toast = useToast();
  const modal = state.dealModal as DealModalState;
  if (!modal) return null;

  const close = () => {
    (state as { dealModal: DealModalState }).dealModal = null;
    notifyStateChanged();
  };
  const panelRef = useModalDismiss(close);

  const onBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) close();
  };

  if (modal.type === "create") {
    const selectedLead = modal.leadId || mockModel.leads[0]?.id || "";
    const lead = getDealLead({ leadId: selectedLead });
    const business = lead && businesses.find((item: any) => item.id === lead.businessId);
    const openStages = getPipelineStageSummary("PIPE-1001")
      .filter(({ stage }: any) => stage.kind === "open")
      .map(({ stage }: any) => stage);

    function submit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const probability = String(data.get("probability") || "default");
      const result = mutate(() =>
        createDeal(String(data.get("leadId")), {
          title: String(data.get("title") || ""),
          serviceId: String(data.get("serviceId") || "") || null,
          value: Number(data.get("value") || 0),
          stageId: String(data.get("stageId") || ""),
          probability: probability === "default" ? null : Number(probability),
          ownerId: String(data.get("ownerId") || ""),
          expectedCloseAt: String(data.get("expectedCloseAt") || ""),
        }),
      );
      close();
      if (result?.kind === "duplicate") {
        toast("توجد صفقة مفتوحة مطابقة لنفس Lead والخدمة؛ لم تُنشأ نسخة ثانية.", "info");
      } else if (result?.deal) {
        toast("أُنشئت الصفقة محليًا وسُجل الأثر.", "success");
        state.selectedDealId = result.deal.id;
        go(`deals/${result.deal.id}`);
      } else {
        toast("تعذر إنشاء الصفقة؛ راجع القيمة والمرحلة.", "error");
      }
    }

    return (
      <div className="modal-backdrop" onClick={onBackdrop}>
        <section ref={panelRef as never} tabIndex={-1} className="modal s6-modal" role="dialog" aria-modal="true" aria-labelledby="newDealTitle">
          <header className="modal-head">
            <div>
              <p className="eyebrow">S6 · Pipeline</p>
              <h2 id="newDealTitle">إنشاء صفقة من Lead</h2>
              <p>
                يمكن إنشاء أكثر من صفقة مفتوحة لنفس Lead عند اختلاف الخدمة أو عنوان الصفقة؛ يمنع التكرار النشط المطابق
                فقط.
              </p>
            </div>
            <button className="modal-close" type="button" aria-label="إغلاق" onClick={close}>×</button>
          </header>

          <form className="s6-deal-form" onSubmit={submit}>
            <label className="form-field wide">
              <span>Lead</span>
              <select name="leadId" defaultValue={selectedLead} required>
                {mockModel.leads.map((item: any) => {
                  const itemBusiness = businesses.find((b: any) => b.id === item.businessId);
                  return (
                    <option value={item.id} key={item.id}>
                      {itemBusiness?.name || item.id} · {item.id}
                    </option>
                  );
                })}
              </select>
            </label>
            <label className="form-field wide">
              <span>عنوان الصفقة</span>
              <input name="title" defaultValue={business ? `فرصة ${business.name}` : ""} placeholder="مثال: تطوير موقع وحجز" required />
            </label>
            <label className="form-field">
              <span>الخدمة المرجعية</span>
              <select name="serviceId">
                <option value="">عنوان مخصص</option>
                {mockModel.serviceCatalog.map((service: any) => (
                  <option value={service.id} key={service.id}>{service.name}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>القيمة (ر.س)</span>
              <input name="value" type="number" min="1" step="1" placeholder="85000" required />
            </label>
            <label className="form-field">
              <span>المرحلة الأولى</span>
              <select name="stageId">
                {openStages.map((stage: any) => (
                  <option value={stage.id} key={stage.id}>
                    {stage.name} · {stage.defaultProbability}%
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>الاحتمال</span>
              <select name="probability">
                <option value="default">افتراضي المرحلة</option>
                {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((value) => (
                  <option value={value} key={value}>{value}%</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>المالك</span>
              <select name="ownerId" defaultValue={lead?.ownerId}>
                {mockModel.users.map((user: any) => (
                  <option value={user.id} key={user.id}>{user.name}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>الإغلاق المتوقع</span>
              <input name="expectedCloseAt" type="date" defaultValue="2026-08-31" required />
            </label>

            <div className="s6-modal-boundary">
              <b>بيانات تجريبية محلية</b>
              <span>
                القيمة يجب أن تكون موجبة وبالريال السعودي؛ الاحتمال بين 0 و100. لن يتم إنشاء Revenue أو Attribution.
              </span>
            </div>
            <div className="modal-footer">
              <button className="button" type="button" onClick={close}>إلغاء</button>
              <button type="submit" className="button primary">إنشاء صفقة</button>
            </div>
          </form>
        </section>
      </div>
    );
  }

  const deal = getDeal(modal.dealId);
  if (!deal) return null;

  if (modal.type === "won") {
    return (
      <div className="modal-backdrop" onClick={onBackdrop}>
        <section className="modal s6-modal" role="dialog" aria-modal="true" aria-labelledby="wonDealTitle">
          <header className="modal-head">
            <div>
              <p className="eyebrow">تأكيد الإغلاق</p>
              <h2 id="wonDealTitle">إغلاق «{deal.title}» كرابحة؟</h2>
              <p>سيُثبَّت الاحتمال عند 100% ويُسجَّل تاريخ الإغلاق. لا يمكن إعادة فتح الصفقة في هذا النموذج.</p>
            </div>
            <button className="modal-close" type="button" aria-label="إغلاق" onClick={close}>×</button>
          </header>
          <div className="s6-modal-boundary">
            <b>الإغلاق ≠ إيراد</b>
            <span>لن يُنشأ RevenueEvent ولا AttributionTouchpoint؛ مصدرهما S2 وحده.</span>
          </div>
          <div className="modal-footer">
            <button className="button" type="button" onClick={close}>إلغاء</button>
            <button
              className="button primary"
              type="button"
              onClick={() => {
                mutate(() => closeDealAsWon(deal.id, true));
                close();
                toast(`أُغلقت ${deal.title} كرابحة بقيمة ${money(deal.value)} — بلا إيراد جديد.`, "success");
              }}
            >
              تأكيد الإغلاق كرابحة
            </button>
          </div>
        </section>
      </div>
    );
  }

  function submitLost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = String(new FormData(event.currentTarget).get("lossReason") || "").trim();
    if (!reason) {
      toast("أدخل سبب الخسارة قبل الإغلاق.", "error");
      return;
    }
    mutate(() => closeDealAsLost(deal.id, reason, true));
    close();
    toast("أُغلقت الصفقة كخاسرة مع تسجيل السبب.", "info");
  }

  return (
    <div className="modal-backdrop" onClick={onBackdrop}>
      <section className="modal s6-modal" role="dialog" aria-modal="true" aria-labelledby="lostDealTitle">
        <header className="modal-head">
          <div>
            <p className="eyebrow">تأكيد الإغلاق</p>
            <h2 id="lostDealTitle">إغلاق «{deal.title}» كخاسرة؟</h2>
            <p>سيُضبط الاحتمال على 0% ويُطلب سبب صريح للخسارة.</p>
          </div>
          <button className="modal-close" type="button" aria-label="إغلاق" onClick={close}>×</button>
        </header>
        <form className="s6-deal-form" onSubmit={submitLost}>
          <label className="form-field wide">
            <span>سبب الخسارة</span>
            <input name="lossReason" placeholder="مثال: اختار مزودًا آخر" required />
          </label>
          <div className="modal-footer">
            <button className="button" type="button" onClick={close}>إلغاء</button>
            <button type="submit" className="button danger">تأكيد الإغلاق كخاسرة</button>
          </div>
        </form>
      </section>
    </div>
  );
}

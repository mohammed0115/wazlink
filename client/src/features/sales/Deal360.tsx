/**
 * تفاصيل الصفقة — S6.
 *
 * منقول عن `renderDeal360()`. حد S6 محفوظ صراحة: تغيير حالة Deal هنا
 * **لا** يضيف `RevenueEvent` ولا `AttributionTouchpoint`.
 */
import type { FormEvent } from "react";
import {
  getDeal,
  getDealActivities,
  getDealBusiness,
  getDealLead,
  getDealProbability,
  getDealStage,
  getLeadActivitySummary,
  isDealProbabilityManual,
  mockModel,
  state,
  updateDeal,
} from "@services/data";
import { getBusinessIntelligence, tierLabels as rawTiers } from "@domain/intelligence.js";
import { go } from "../../shared/router/useHashRoute";
import { mutate, notifyStateChanged } from "../../shared/store/appStore";
import { useToast } from "../../shared/store/toast";
import { PageHead } from "../../shared/components/PageHead";
import { DecisionRail, Mono, dateTimeLabel, dealStatusLabels, fmt, money, ownerName, statusTone } from "./shared";

const tierLabels = rawTiers as Record<string, string>;

const timelineIcons: Record<string, string> = {
  deal_created: "↗", stage_changed: "⇄", value_changed: "ر.س", probability_changed: "%",
  close_date_changed: "◷", title_changed: "✎", owner_changed: "◉", service_changed: "◇",
  deal_won: "✓", deal_lost: "×",
};

export function Deal360({ dealId }: { dealId: string }) {
  const toast = useToast();
  const deal = getDeal(dealId);

  if (!deal) {
    return (
      <PageHead
        kicker="الصفقات"
        title="لم نجد الصفقة"
        description="قد يكون الرابط غير صحيح أو أزيلت الصفقة من الذاكرة المحلية."
        actions={
          <button className="button primary" type="button" onClick={() => go("deals")}>
            العودة إلى الصفقات
          </button>
        }
      />
    );
  }

  const lead = getDealLead(deal);
  const business = getDealBusiness(deal);
  const stage = getDealStage(deal);
  const intelligence = business ? (getBusinessIntelligence(business.id) as any) : null;
  const activity = lead ? getLeadActivitySummary(lead.id) : null;
  const activities = getDealActivities(deal.id);
  const open = deal.status === "open";
  const manualProbability = isDealProbabilityManual(deal);
  const gaps = intelligence?.reasons?.map((reason: any) => reason.value).join(" · ") || "لا توجد فجوة مثبتة";

  function saveDeal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const probabilityValue = String(data.get("probability") || "default");
    const result = mutate(() =>
      updateDeal(deal.id, {
        title: String(data.get("title") || deal.title),
        value: Number(data.get("value") || deal.value),
        probability: probabilityValue === "default" ? null : Number(probabilityValue),
        ownerId: String(data.get("ownerId") || deal.ownerId),
        expectedCloseAt: String(data.get("expectedCloseAt") || deal.expectedCloseAt),
      }),
    );
    toast(result ? "حُفظت تغييرات الصفقة محليًا مع سجل تدقيق." : "تعذر حفظ التغييرات.", result ? "success" : "error");
  }

  const openModal = (type: string) => {
    (state as { dealModal: unknown }).dealModal = { type, dealId: deal.id };
    notifyStateChanged();
  };

  return (
    <>
      <PageHead
        kicker="تفاصيل الصفقة"
        title={deal.title}
        description="بطاقة بيع مالية مرتبطة بـLead واحدة، وتحافظ على Intelligence والمصدر كمراجع قراءة فقط."
        actions={
          <>
            <button className="button" type="button" onClick={() => go("deals")}>العودة إلى الصفقات</button>
            {open && (
              <>
                <button className="button primary" type="button" onClick={() => openModal("won")}>إغلاق كرابحة</button>
                <button className="button danger" type="button" onClick={() => openModal("lost")}>إغلاق كخاسرة</button>
              </>
            )}
          </>
        }
      />

      <DecisionRail
        label={open ? "صفقة مفتوحة تتطلب قرار مرحلة أو إغلاق" : `صفقة ${dealStatusLabels[deal.status]} — سجل CRM محلي`}
      />

      <section className="s6-deal-hero card">
        <div className="s6-deal-hero-title">
          <span className={`status ${statusTone(deal.status)}`}>{dealStatusLabels[deal.status]}</span>
          <h2>{deal.title}</h2>
          <p>
            <Mono>{deal.id}</Mono> · {business?.name || "Lead غير متاحة"}
          </p>
        </div>
        <div className="s6-deal-hero-metrics">
          <div><span>القيمة</span><b>{money(deal.value)}</b><small>SAR</small></div>
          <div>
            <span>الاحتمال</span>
            <b>{getDealProbability(deal)}%</b>
            <small>{manualProbability ? "تعديل يدوي" : `افتراضي ${stage?.name || "—"}`}</small>
          </div>
          <div>
            <span>القيمة المرجحة</span>
            <b>{money((deal.value * getDealProbability(deal)) / 100)}</b>
            <small>قيمة × احتمال</small>
          </div>
          <div>
            <span>آخر نشاط</span>
            <b>{dateTimeLabel(deal.lastActivityAt)}</b>
            <small>{ownerName(deal.ownerId)}</small>
          </div>
        </div>
      </section>

      <section className="s6-deal-grid">
        <div className="s6-deal-main">
          <article className="card">
            <header className="card-head">
              <div>
                <h2>ضبط الصفقة</h2>
                <p>القيمة والاحتمال والمالك محفوظة في Deal ولا تؤثر على Revenue أو Attribution.</p>
              </div>
            </header>
            {open ? (
              <form className="s6-deal-form" onSubmit={saveDeal}>
                <label className="form-field wide">
                  <span>عنوان الصفقة</span>
                  <input name="title" defaultValue={deal.title} required />
                </label>
                <label className="form-field">
                  <span>القيمة (ر.س)</span>
                  <input name="value" type="number" min="1" step="1" defaultValue={deal.value} required />
                </label>
                <label className="form-field">
                  <span>الاحتمال</span>
                  <select name="probability" defaultValue={manualProbability ? String(getDealProbability(deal)) : "default"}>
                    <option value="default">افتراضي المرحلة ({stage?.defaultProbability ?? 0}%)</option>
                    {[10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((value) => (
                      <option value={value} key={value}>{value}%</option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>المالك</span>
                  <select name="ownerId" defaultValue={deal.ownerId}>
                    {mockModel.users.map((user: any) => (
                      <option value={user.id} key={user.id}>{user.name}</option>
                    ))}
                  </select>
                </label>
                <label className="form-field">
                  <span>الإغلاق المتوقع</span>
                  <input name="expectedCloseAt" type="date" defaultValue={deal.expectedCloseAt || ""} required />
                </label>
                <div className="s6-form-actions">
                  <span>تُطبق التغييرات محليًا مع سجل تدقيق للقيمة والاحتمال وتاريخ الإغلاق.</span>
                  <button type="submit" className="button primary">حفظ التغييرات</button>
                </div>
              </form>
            ) : (
              <div className="s6-closed-note">
                <b>هذه الصفقة مغلقة {dealStatusLabels[deal.status]}.</b>
                <p>
                  {deal.status === "lost"
                    ? `سبب الخسارة: ${deal.lossReason || "—"}.`
                    : `تم الإغلاق في ${dateTimeLabel(deal.wonAt)} من دون إنشاء إيراد أو إسناد جديد ضمن S6.`}
                </p>
              </div>
            )}
          </article>

          <article className="card">
            <header className="card-head">
              <div>
                <h2>سجل الصفقة</h2>
                <p>سجل محلي يخص الصفقة فقط.</p>
              </div>
            </header>
            <ol className="s6-deal-timeline">
              {activities.length ? (
                activities.map((item: any) => (
                  <li key={item.id}>
                    <i>{timelineIcons[item.type] || "•"}</i>
                    <div>
                      <b>{item.title}</b>
                      <p>{item.detail}</p>
                      <small>
                        {dateTimeLabel(item.createdAt)} · {ownerName(item.actorId)}
                      </small>
                    </div>
                  </li>
                ))
              ) : (
                <li className="empty">
                  <div>
                    <b>لا توجد أحداث Deal مولّدة بعد.</b>
                    <p>ستظهر هنا تعديلات القيمة والاحتمال ونقل المرحلة والإغلاق منذ تشغيل S6.</p>
                  </div>
                </li>
              )}
            </ol>
          </article>
        </div>

        <aside className="s6-deal-side">
          <article className="card">
            <header className="card-head">
              <div>
                <h2>Lead والسياق</h2>
                <p>مراجع حية، لا نسخ للبيانات.</p>
              </div>
            </header>
            <dl className="s6-reference-list">
              <div>
                <dt>Lead</dt>
                <dd>
                  <button
                    type="button"
                    onClick={() => {
                      if (lead?.id) {
                        state.selectedLeadId = lead.id;
                        go(`crm/leads/${lead.id}`);
                      }
                    }}
                  >
                    {business?.name || lead?.id || "—"}
                  </button>
                  <small><Mono>{lead?.id || "—"}</Mono></small>
                </dd>
              </div>
              <div>
                <dt>المرحلة</dt>
                <dd>
                  <span className={`status ${statusTone(deal.status)}`}>{stage?.name || "—"}</span>
                  <small>احتمال افتراضي {stage?.defaultProbability ?? 0}%</small>
                </dd>
              </div>
              <div>
                <dt>المتابعة التالية</dt>
                <dd>
                  {activity?.nextTask?.title || "لا توجد"}
                  <small>{activity?.nextTask ? dateTimeLabel(activity.nextTask.dueAt) : "أضف مهمة من Lead 360"}</small>
                </dd>
              </div>
              <div>
                <dt>مصدر الاكتشاف</dt>
                <dd><Mono>{lead?.sourceJobId || "—"}</Mono></dd>
              </div>
            </dl>
          </article>

          <article className="card">
            <header className="card-head">
              <div>
                <h2>ذكاء الفرص</h2>
                <p>قراءة فقط من Business الأصلية.</p>
              </div>
              <button
                type="button"
                className="button ghost compact"
                onClick={() => go(`intelligence?business=${business?.id}`)}
              >
                فتح
              </button>
            </header>
            <div className="s6-intelligence-card">
              <b>
                {intelligence?.score ?? "—"}
                {intelligence?.score !== null && intelligence?.score !== undefined ? "/100" : ""}
              </b>
              <span>{intelligence?.tier ? tierLabels[intelligence.tier] : "بيانات غير كافية"}</span>
              <p><strong>الثقة:</strong> {fmt(Math.round((intelligence?.confidence || 0) * 100))}%</p>
              <p><strong>الفجوات:</strong> {gaps}</p>
              <p>
                <strong>الخدمات:</strong>{" "}
                {intelligence?.services?.map((service: any) => service.name).join(" · ") || "لا توجد خدمة مقترحة"}
              </p>
              <small><strong>النهج:</strong> {intelligence?.salesApproach || "لا يوجد نهج مقترح"}</small>
            </div>
          </article>

          <article className="card">
            <header className="card-head">
              <div>
                <h2>حدود الإيراد</h2>
                <p>حماية سلسلة S2.</p>
              </div>
            </header>
            <div className="s6-boundary-note">
              <b>الإغلاق ≠ إيراد</b>
              <span>تغيير حالة Deal هنا لا يضيف RevenueEvent ولا AttributionTouchpoint.</span>
            </div>
          </article>
        </aside>
      </section>
    </>
  );
}

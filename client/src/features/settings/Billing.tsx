/**
 * الفوترة — S11.
 *
 * اشتراك المنصة منفصل تمامًا عن مبيعات العملاء: **لا** يؤدي Plan أو Invoice
 * أو BillingActivity إلى `RevenueEvent` أو `AttributionTouchpoint`.
 * لا بوابة دفع ولا معالجة بطاقات؛ وسيلة الدفع مرجع عرض مقنّع فقط.
 */
import { useState } from "react";
import { billingService, entitlementService } from "@services";
import { mutate } from "../../shared/store/appStore";
import { useToast } from "../../shared/store/toast";
import { go } from "../../shared/router/useHashRoute";
import { PageHead } from "../../shared/components/PageHead";
import { AuditList, GovernanceRail, fmtDate, sar } from "./shared";

type Row = Record<string, any>;
const { activities, changePlan, currentSubscription, invoices, paymentMethods, plans, previewPlanChange, setCancelAtPeriodEnd, usage } = billingService;

const usageLabels: Record<string, string> = {
  leads: "العملاء المحتملون", discoveryRuns: "عمليات الاكتشاف", seats: "المقاعد النشطة",
  automationRuns: "تشغيلات الأتمتة", aiAnalyses: "تحليلات الذكاء",
};
const billingStatusLabel: Record<string, string> = {
  trial: "تجربة", active_mock: "نشط تجريبيًا", past_due_mock: "استحقاق تجريبي", cancelled: "ملغي",
};
const invoiceStatusLabel: Record<string, string> = {
  paid_mock: "مدفوعة تجريبيًا", open_mock: "مفتوحة تجريبيًا", void: "ملغاة",
};

export function Billing() {
  const toast = useToast();
  const [previewPlanId, setPreviewPlanId] = useState<string | null>(null);
  const subscription = currentSubscription() as Row;
  const planRows = entitlementService.planCatalog();
  const plan = entitlementService.currentPlan();
  const usageRows = entitlementService.usage().metrics.map((metric) => ({
    key: metric.metric,
    used: metric.used,
    limit: metric.limit.kind === "finite" ? metric.limit.value : null,
    remaining: metric.remaining,
    over: metric.status === "EXHAUSTED" && metric.limit.kind === "finite" && metric.used > metric.limit.value,
  }));
  const paymentRows = paymentMethods() as Row[];
  const payment = paymentRows[0] as Row;
  const invoiceRows = invoices() as Row[];
  const preview = previewPlanId ? (previewPlanChange({ planId: previewPlanId }) as Row) : null;

  return (
    <div className="s11-workspace">
      <GovernanceRail note="S11 · فوترة تجريبية" />
      <PageHead
        kicker="S11 · اشتراك المنصة"
        title="الفوترة والاستخدام"
        description="اشتراك وخطط وفواتير تجريبية محلية. منفصلة تمامًا عن إيراد العملاء وإسناده في S10."
      />

      <section className="s11-billing-section">
        <header>
          <div>
            <p className="eyebrow">الاشتراك الحالي</p>
            <h2>
              {plan?.name} · {sar(plan?.price || 0)} / شهر
            </h2>
            <p>
              الحالة: {billingStatusLabel[subscription.status] || subscription.status} · التجديد التجريبي{" "}
              {fmtDate(subscription.renewsAt)}
            </p>
          </div>
          <div className="s11-cancel-control">
            <button className="button primary" type="button" onClick={() => go("settings/billing/checkout")}>فتح Checkout التجريبي</button>
            {subscription.cancelAtPeriodEnd ? (
              <button
                className="button"
                type="button"
                onClick={() => {
                  mutate(() => setCancelAtPeriodEnd(false));
                  toast("أُلغيت جدولة الإنهاء؛ لم يُحذف أي سجل.", "info");
                }}
              >
                إلغاء الإنهاء المجدول
              </button>
            ) : (
              <button
                className="button ghost"
                type="button"
                onClick={() => {
                  mutate(() => setCancelAtPeriodEnd(true));
                  toast("جُدول إلغاء تجريبي في نهاية الدورة؛ لن يُحذف أي سجل.", "info");
                }}
              >
                جدولة إلغاء تجريبي
              </button>
            )}
            <small>لن يُحذف أي سجل في المنتج.</small>
          </div>
        </header>
      </section>

      {preview && (
        <section className="s11-billing-preview">
          <header>
            <div>
              <p className="eyebrow">محاكاة تغيير خطة</p>
              <h2>
                {preview.current.name} ← {preview.target.name}
              </h2>
              <p>
                موعد الأثر: {preview.effectiveDate}. لا يوجد دفع أو حذف بيانات أو تغيير لتوافر الميزات في S11.
              </p>
            </div>
            <button
              className="top-icon"
              type="button"
              aria-label="إغلاق المعاينة"
              onClick={() => {
                setPreviewPlanId(null);
              }}
            >
              ×
            </button>
          </header>
          <div className="s11-price-difference">
            <span>
              {sar(preview.current.price)} ← <b>{sar(preview.target.price)}</b>
            </span>
            {preview.downgradeWarning && (
              <p className="s11-error-note">
                <b>تحذير تخفيض</b>
                <span>{preview.downgradeWarning}</span>
              </p>
            )}
          </div>
          <footer>
            <button
              className="button primary"
              type="button"
              onClick={() => {
                mutate(() => changePlan(preview.target.id));
                setPreviewPlanId(null);
                toast("غُيّرت الخطة محليًا؛ لا دفع ولا تغيير في توافر الميزات.", "success");
              }}
            >
              تأكيد التغيير التجريبي
            </button>
          </footer>
        </section>
      )}

      <section className="s11-billing-section">
        <header>
          <div>
            <p className="eyebrow">الاستخدام</p>
            <h2>استخدام الخطة الحالية</h2>
          </div>
          <small>المستخدم · الحد · المتبقي</small>
        </header>
        <div className="s11-usage-grid">
          {usageRows.map((item) => (
            <article className={item.over ? "over" : ""} key={item.key}>
              <span>{usageLabels[item.key] || item.key}</span>
              <b>
                {item.used} <small>من {item.limit ?? "—"}</small>
              </b>
              <i>
                <em style={{ width: `${item.limit ? Math.min(100, (item.used / item.limit) * 100) : 0}%` }} />
              </i>
              <small>
                {item.limit === null
                  ? "لا يوجد حد معلن"
                  : item.over
                    ? `تجاوز الحد التجريبي بـ${item.used - item.limit}`
                    : `المتبقي ${item.remaining}`}
              </small>
            </article>
          ))}
        </div>
      </section>

      <section className="s11-billing-section">
        <header>
          <div>
            <p className="eyebrow">الخطط</p>
            <h2>تغيير تجريبي فقط</h2>
          </div>
          <small>لا تتغير ميزات S3–S10 فعليًا عند التبديل.</small>
        </header>
        <div className="s11-plan-grid">
          {planRows.map((item) => (
            <article className={item.id === plan?.id ? "current" : ""} key={item.id}>
              <div>
                <p>{item.id === plan?.id ? "الخطة الحالية" : "تسعير تجريبي"}</p>
                <h3>{item.name}</h3>
                <b>
                  {sar(item.price)} <small>/ شهر</small>
                </b>
              </div>
              <ul>
                {item.features.slice(0, 3).map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <button
                className={`button ${item.id === plan?.id ? "ghost" : ""}`}
                type="button"
                disabled={item.id === plan?.id}
                onClick={() => {
                  previewPlanChange({ planId: item.id });
                setPreviewPlanId(item.id);
                }}
              >
                {item.id === plan?.id ? "الخطة الحالية" : "معاينة التغيير"}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="s11-billing-section s11-billing-history">
        <header>
          <div>
            <p className="eyebrow">الفواتير ووسيلة الدفع</p>
            <h2>سجل تجريبي قابل للمراجعة</h2>
          </div>
          <span className="s11-payment">
            {payment?.brand} ·•••• {payment?.last4}
            <small>{payment?.label}</small>
          </span>
        </header>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>الفاتورة</th><th>الفترة</th><th>المبلغ</th><th>الحالة</th><th>تاريخ الإصدار</th><th />
              </tr>
            </thead>
            <tbody>
              {invoiceRows.map((invoice: Row) => (
                <tr key={invoice.id}>
                  <td className="mono">{invoice.id}</td>
                  <td>
                    {invoice.periodStart} — {invoice.periodEnd}
                  </td>
                  <td>{sar(invoice.amount)}</td>
                  <td>
                    <span className={`s11-status ${invoice.status === "paid_mock" ? "success" : "warning"}`}>
                      {invoiceStatusLabel[invoice.status]}
                    </span>
                  </td>
                  <td>{fmtDate(invoice.issuedAt)}</td>
                  <td>
                    <button className="button ghost" type="button" disabled title="غير متاح في S11">
                      قريبًا
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <section className="s11-subsection">
          <h3>سجل الفوترة</h3>
          <AuditList rows={activities() as Row[]} />
        </section>
      </section>
    </div>
  );
}

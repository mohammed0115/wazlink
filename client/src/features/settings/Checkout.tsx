/**
 * Checkout التجريبي — PAYMENT-CHECKOUT-SCENARIO.
 *
 * أربع خطوات محلية: بيانات الفاتورة، وسيلة دفع مقنّعة، مراجعة، إيصال.
 * **لا Stripe ولا Payment Intent ولا Gateway ولا webhook ولا تحصيل.**
 * لا يُدخل رقم بطاقة أو CVV، ولا يُنشئ نجاحُ الدفع `RevenueEvent` ولا
 * `AttributionTouchpoint` — الفوترة منفصلة عن إيراد العملاء في S10.
 */
import type { FormEvent } from "react";
import { closeMockCheckout, completeMockCheckout, continueMockCheckoutPayment, failMockCheckout, finishMockCheckoutJourney, getMockCheckoutPreview, updateMockCheckoutInvoice } from "@services";
import { go } from "../../shared/router/useHashRoute";
import { mutate, notifyStateChanged } from "../../shared/store/appStore";
import { useToast } from "../../shared/store/toast";
import { sar } from "./shared";

type Row = Record<string, any>;

const stepNames = ["بيانات الفاتورة", "وسيلة الدفع", "مراجعة الطلب", "الإيصال"];
const stepIndex: Record<string, number> = { invoice: 0, payment: 1, review: 2, success: 3, failed: 2 };

const contextNextLabel = (checkout: Row) =>
  checkout.context === "scraper_export" ? "العودة لتنزيل Excel" : checkout.context === "crm_results" ? "فتح CRM wazlink" : "إدارة الاشتراك";

function Steps({ step }: { step: string }) {
  const active = stepIndex[step] ?? 0;
  return (
    <ol className="checkout-steps" aria-label="مراحل Checkout">
      {stepNames.map((label, index) => (
        <li className={index < active ? "done" : index === active ? "active" : ""} key={label}>
          <i>{index < active ? "✓" : index + 1}</i>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

export function Checkout() {
  const toast = useToast();
  const preview = getMockCheckoutPreview() as Row | null;
  if (!preview?.checkout?.open) return null;

  const { checkout, plan, offer, subtotal, tax, total, payment } = preview;
  const invoice = checkout.invoice || {};

  const close = () => {
    mutate(() => closeMockCheckout());
  };

  const Shell = ({ title, description, children }: { title: string; description: string; children: React.ReactNode }) => (
    <div className="checkout-backdrop" role="presentation">
      <section className="checkout-modal" role="dialog" aria-modal="true" aria-labelledby="checkoutTitle">
        <header>
          <div>
            <p className="eyebrow">دفع تجريبي آمن</p>
            <h2 id="checkoutTitle">{title}</h2>
            <p>{description}</p>
          </div>
          <button type="button" className="top-icon" aria-label="إغلاق Checkout" onClick={close}>×</button>
        </header>
        <Steps step={checkout.step} />
        {children}
        <footer className="checkout-disclosure">
          <b>محاكاة محلية</b>
          <span>لا تدخل أي رقم بطاقة أو CVV، ولا يتم تحصيل أي مبلغ أو إرسال بيانات إلى مزود دفع.</span>
        </footer>
      </section>
    </div>
  );

  if (checkout.step === "invoice") {
    const submit = (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const result = mutate(() =>
        updateMockCheckoutInvoice({
          companyName: String(data.get("companyName") || ""),
          email: String(data.get("email") || ""),
          vatNumber: String(data.get("vatNumber") || ""),
        }),
      );
      if (!result) toast("أكمل اسم الجهة وبريدًا تجريبيًا صالحًا.", "error");
    };

    return (
      <Shell
        title="أكمل بيانات الفاتورة"
        description={`اخترت ${offer.label}. هذه البيانات محفوظة داخل الجلسة الحالية فقط.`}
      >
        <form className="checkout-form" onSubmit={submit}>
          <section className="checkout-plan-summary">
            <span>{offer.label}</span>
            <b>
              {plan.name} · {sar(plan.price)} / شهر
            </b>
            <small>{offer.description}</small>
          </section>
          <div className="checkout-form-grid">
            <label className="form-field wide">
              <span>اسم الجهة أو الشركة</span>
              <input name="companyName" defaultValue={invoice.companyName} required placeholder="اسم شركتك" autoComplete="organization" />
            </label>
            <label className="form-field wide">
              <span>بريد الفاتورة التجريبي</span>
              <input name="email" type="email" defaultValue={invoice.email} required placeholder="billing@example.test" autoComplete="email" />
            </label>
            <label className="form-field wide">
              <span>رقم ضريبي اختياري للعرض</span>
              <input name="vatNumber" defaultValue={invoice.vatNumber} inputMode="numeric" placeholder="اختياري — لا تحقق خارجي" />
            </label>
          </div>
          <div className="checkout-total">
            <span>إجمالي اليوم التجريبي</span>
            <b>{sar(total)}</b>
            <small>يشمل ضريبة عرض تجريبية {sar(tax)}</small>
          </div>
          <button className="button primary checkout-primary" type="submit">متابعة إلى وسيلة الدفع</button>
        </form>
      </Shell>
    );
  }

  if (checkout.step === "payment") {
    return (
      <Shell title="اختر وسيلة الدفع" description="استخدم وسيلة الدفع المقنّعة الظاهرة لتكملة السيناريو فقط.">
        <form
          className="checkout-form"
          onSubmit={(event) => {
            event.preventDefault();
            mutate(() => continueMockCheckoutPayment(payment?.id || ""));
          }}
        >
          <section className="checkout-payment-choice">
            <p className="eyebrow">وسيلة دفع تجريبية</p>
            <label>
              <input type="radio" name="paymentMethodId" value={payment?.id || ""} defaultChecked />
              <span>
                <b>
                  {payment?.brand || "Visa"} ·•••• {payment?.last4 || "4242"}
                </b>
                <small>بطاقة معروضة تجريبيًا فقط؛ لا يمكن إدخال أو تعديل رقم بطاقة.</small>
              </span>
            </label>
          </section>
          <aside className="checkout-safe-note">
            <b>لماذا لا نطلب بيانات بطاقتك؟</b>
            <span>هذه رحلة Prototype لشرح الدفع، وليست بوابة تحصيل حقيقية.</span>
          </aside>
          <div className="checkout-actions">
            <button
              type="button"
              className="button ghost"
              onClick={() => {
                checkout.step = "invoice";
                notifyStateChanged();
              }}
            >
              العودة
            </button>
            <button type="submit" className="button primary checkout-primary">مراجعة الطلب</button>
          </div>
        </form>
      </Shell>
    );
  }

  if (checkout.step === "review") {
    return (
      <Shell title="راجع طلبك" description="هذه آخر خطوة قبل إنشاء فاتورة وإيصال تجريبيين.">
        <section className="checkout-review">
          <div className="checkout-plan-summary">
            <span>{offer.label}</span>
            <b>{plan.name}</b>
            <small>
              {invoice.companyName} · {invoice.email}
            </small>
          </div>
          <dl>
            <div><dt>الاشتراك الشهري</dt><dd>{sar(subtotal)}</dd></div>
            <div><dt>ضريبة عرض تجريبية</dt><dd>{sar(tax)}</dd></div>
            <div className="total"><dt>إجمالي التجربة</dt><dd>{sar(total)}</dd></div>
          </dl>
          <p className="checkout-payment-line">
            سيُستخدم {payment?.brand || "Visa"} ·•••• {payment?.last4 || "4242"} كمرجع بصري فقط.
          </p>
          <div className="checkout-actions">
            <button
              type="button"
              className="button ghost"
              onClick={() => {
                checkout.step = "payment";
                notifyStateChanged();
              }}
            >
              العودة
            </button>
            <button type="button" className="button" onClick={() => mutate(() => failMockCheckout("فشل تجريبي مقصود"))}>
              محاكاة فشل
            </button>
            <button
              type="button"
              className="button primary checkout-primary"
              onClick={() => {
                mutate(() => completeMockCheckout());
                toast("اكتمل الدفع التجريبي محليًا؛ لم يُنشأ إيراد عملاء أو إسناد.", "success");
              }}
            >
              تأكيد الدفع التجريبي
            </button>
          </div>
        </section>
      </Shell>
    );
  }

  if (checkout.step === "failed") {
    return (
      <Shell title="حالة دفع تجريبية" description="يمكنك مراجعة وسيلة الدفع أو إعادة المحاولة داخل النموذج فقط.">
        <section className="checkout-result failed">
          <i>!</i>
          <h3>لم تكتمل عملية الدفع التجريبية</h3>
          <p>{checkout.failureReason || "فشل تجريبي"}</p>
          <span>لم يُنشأ اشتراك جديد أو فاتورة مدفوعة، ولم تُرسل أي بيانات خارجية.</span>
          <button
            type="button"
            className="button primary checkout-primary"
            onClick={() => {
              checkout.step = "review";
              notifyStateChanged();
            }}
          >
            حاول مجددًا
          </button>
        </section>
      </Shell>
    );
  }

  return (
    <Shell
      title="تم الدفع التجريبي بنجاح"
      description="يمكنك الآن إكمال الخطوة التي اخترتها من دون أي تحصيل أو اتصال خارجي."
    >
      <section className="checkout-result success">
        <i>✓</i>
        <h3>تم تفعيل الباقة تجريبيًا</h3>
        <p>
          أنشئ الإيصال <b className="mono">{checkout.completedInvoiceId || "INV-BILL"}</b> داخل الذاكرة المحلية.
        </p>
        <div className="checkout-receipt">
          <span>الإجمالي التجريبي</span>
          <b>{sar(total)}</b>
          <small>
            {plan.name} · {payment?.brand || "Visa"} ·•••• {payment?.last4 || "4242"}
          </small>
        </div>
        <div className="checkout-actions">
          <button
            type="button"
            className="button ghost"
            onClick={() => toast("الإيصال تجريبي محلي فقط داخل هذه الجلسة.", "info")}
          >
            تنزيل إيصال تجريبي
          </button>
          <button
            type="button"
            className="button primary checkout-primary"
            onClick={() => {
              const result = mutate(() => finishMockCheckoutJourney()) as Row | null;
              if (result?.context === "scraper_export") go(`discovery/results?job=${result.jobId}`);
              else if (result?.context === "crm_results") go("crm");
              else go("settings/billing");
            }}
          >
            {contextNextLabel(checkout)}
          </button>
        </div>
      </section>
    </Shell>
  );
}

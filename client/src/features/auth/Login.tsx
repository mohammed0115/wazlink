/**
 * تسجيل الدخول — دخول تجريبي محلي فقط.
 * لا مصادقة ولا حساب ولا جلسة دائمة؛ التحقق داخل الصفحة وفق قاعدة S1:
 * رسالة الخطأ مرتبطة بالحقل ولا تُستخدم تنبيهات المتصفح.
 */
import { useState, type FormEvent } from "react";
import { go } from "../../shared/router/useHashRoute";
import { useSession } from "../../shared/context/AppProviders";
import { useToast } from "../../shared/store/toast";
import { Brand } from "../../shared/shell/Brand";

export function Login() {
  const toast = useToast();
  const { onboardingDone, signInMock } = useSession();
  const [errors, setErrors] = useState<Record<string, string>>({});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "").trim();

    const nextErrors: Record<string, string> = {};
    if (!email) nextErrors.email = "أدخل البريد الإلكتروني.";
    else if (!/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = "أدخل بريدًا إلكترونيًا صحيحًا.";
    if (!password) nextErrors.password = "أدخل كلمة المرور.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    signInMock();
    toast("تم التحقق محليًا من بيانات الدخول التجريبية.", "success");
    go(onboardingDone ? "dashboard" : "onboarding");
  }

  return (
    <div className="auth-shell">
      <section className="auth-panel">
        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          <Brand />
          <p className="eyebrow">دخول تجريبي</p>
          <h1>مرحبًا بعودتك</h1>
          <p>ادخل إلى مساحة العمل لمتابعة العملاء والصفقات. لا توجد مصادقة أو حسابات حقيقية في هذا النموذج.</p>

          <div className="form-grid">
            <div className={`form-field wide ${errors.email ? "has-error" : ""}`}>
              <label htmlFor="loginEmail">البريد الإلكتروني</label>
              <input
                id="loginEmail"
                name="email"
                className="ltr"
                type="email"
                aria-invalid={Boolean(errors.email)}
                aria-describedby="loginEmailError"
                placeholder="name@company.sa"
              />
              <small id="loginEmailError" className="field-error">
                {errors.email || ""}
              </small>
            </div>
            <div className={`form-field wide ${errors.password ? "has-error" : ""}`}>
              <label htmlFor="loginPassword">كلمة المرور</label>
              <input
                id="loginPassword"
                name="password"
                className="ltr"
                type="password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby="loginPasswordError"
                placeholder="••••••••"
              />
              <small id="loginPasswordError" className="field-error">
                {errors.password || ""}
              </small>
            </div>
          </div>

          <div className="auth-row">
            <label className="check">
              <input name="remember" type="checkbox" /> تذكرني في هذه الجلسة
            </label>
            <button
              className="button ghost"
              type="button"
              onClick={() => toast("النموذج تجريبي محلي؛ لا توجد استعادة كلمة مرور حقيقية.", "info")}
            >
              نسيت كلمة المرور؟
            </button>
          </div>

          <button className="button primary auth-submit" type="submit">
            تسجيل الدخول
          </button>

          <p className="auth-helper">
            ليس لديك إعداد تجريبي؟{" "}
            <button className="button ghost inline-button" type="button" onClick={() => go("onboarding")}>
              ابدأ الإعداد الآن
            </button>
          </p>
        </form>
      </section>

      <aside className="auth-visual">
        <div className="auth-story">
          <p className="eyebrow">منصة مبيعات ذكية</p>
          <h2>اكتشاف أذكى. متابعة أوضح. إيراد قابل للقياس.</h2>
          <p>لا تبدأ من جدول معزول؛ ابدأ من فهم الشركة، ثم أبنِ سياق البيع حولها.</p>
          <ul>
            <li>
              <i />
              اكتشاف وإثراء العملاء المحتملين
            </li>
            <li>
              <i />
              مساعد مبيعات ذكي داخل المحادثة
            </li>
            <li>
              <i />
              نسبة الإيراد إلى مصدر الاكتشاف
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

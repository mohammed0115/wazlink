/**
 * Sign in — real Django session authentication.
 *
 * The credential goes to `POST /api/v1/auth/login`, which sets an HttpOnly
 * `wazlink_session` cookie. The browser never sees the token, this component
 * stores nothing, and "am I signed in?" is answered afterwards by asking the
 * server. That is what makes a page refresh restore the true session rather
 * than a remembered flag.
 *
 * Authorization is never decided here. A wrong password, a locked account, an
 * unverified email and a rate limit all come back as the frozen error envelope
 * and are rendered as-is.
 */
import { useState, type FormEvent } from "react";
import { go } from "../../shared/router/useHashRoute";
import { useAuth } from "../../shared/context/AuthProvider";
import { useApiAction } from "../../api/hooks";
import { FormError } from "../../shared/components/ApiStates";
import { useToast } from "../../shared/store/toast";
import { Brand } from "../../shared/shell/Brand";

export function Login() {
  const toast = useToast();
  const { login } = useAuth();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = useApiAction((email: string, password: string) => login(email, password));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") || "").trim();
    const password = String(data.get("password") || "");

    // Shape checks only. Whether the credential is VALID is the server's call.
    const nextErrors: Record<string, string> = {};
    if (!email) nextErrors.email = "أدخل البريد الإلكتروني.";
    else if (!/^\S+@\S+\.\S+$/.test(email)) nextErrors.email = "أدخل بريدًا إلكترونيًا صحيحًا.";
    if (!password) nextErrors.password = "أدخل كلمة المرور.";

    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const result = await submit.run(email, password);
    if (result === null) return;
    toast("تم تسجيل الدخول.", "success");
    go("dashboard");
  }

  return (
    <div className="auth-shell">
      <section className="auth-panel">
        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          <Brand />
          <p className="eyebrow">تسجيل الدخول</p>
          <h1>مرحبًا بعودتك</h1>
          <p>ادخل إلى مساحة العمل لمتابعة العملاء والصفقات.</p>

          <div className="form-grid">
            <div className={`form-field wide ${errors.email ? "has-error" : ""}`}>
              <label htmlFor="loginEmail">البريد الإلكتروني</label>
              <input
                id="loginEmail"
                name="email"
                className="ltr"
                type="email"
                autoComplete="username"
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
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                aria-describedby="loginPasswordError"
                placeholder="••••••••"
              />
              <small id="loginPasswordError" className="field-error">
                {errors.password || ""}
              </small>
            </div>
          </div>

          <FormError error={submit.error} />

          <button className="button primary auth-submit" type="submit" disabled={submit.pending}>
            {submit.pending ? "جارٍ التحقق…" : "تسجيل الدخول"}
          </button>
        </form>
      </section>

      <aside className="auth-visual">
        <div className="auth-story">
          <p className="eyebrow">منصة مبيعات ذكية</p>
          <h2>اكتشاف أذكى. متابعة أوضح. إيراد قابل للقياس.</h2>
          <p>لا تبدأ من جدول معزول؛ ابدأ من فهم العميل، ثم أبنِ سياق البيع حوله.</p>
          <ul>
            <li>
              <i />
              إدارة عملاء كاملة دون الحاجة إلى الاكتشاف
            </li>
            <li>
              <i />
              مساعد مبيعات يقترح ولا يرسل نيابة عنك
            </li>
            <li>
              <i />
              سجل زمني موحد مبني في الخادم
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

/**
 * إعداد مساحة العمل — Wizard من خمس خطوات.
 *
 * منقول عن `renderOnboarding()` و`renderOnboardingStep()` في V1 مع نفس
 * قواعد التحقق والنصوص. المدخلات تبقى في ذاكرة الجلسة فقط: لا حساب،
 * ولا تخزين دائم، ولا اتصال خارجي.
 */
import type { FormEvent } from "react";
import { state } from "@services/data";
import { go } from "../../shared/router/useHashRoute";
import { notifyStateChanged } from "../../shared/store/appStore";
import { useToast } from "../../shared/store/toast";
import { Brand } from "../../shared/shell/Brand";
import type { OnboardingCollection, OnboardingWorkspace } from "../../domain/types";

const stepNames = ["الشركة", "الهدف", "المصادر", "الفريق", "الذكاء الاصطناعي"];

const industries = ["وكالة تسويق", "مبيعات الشركات", "عيادة", "عقار", "شركة تقنية", "خدمات", "أخرى"];
const teamSizes = ["فردي", "٢–٥", "٦–١٠", "١١–٢٥", "أكثر من ٢٥"];

const goalChoices: [string, string][] = [
  ["discover", "اكتشاف عملاء جدد"],
  ["followup", "تحسين متابعة العملاء"],
  ["convert", "زيادة التحويل"],
  ["conversations", "إدارة المحادثات"],
  ["automation", "أتمتة المتابعة"],
  ["attribution", "قياس الإيراد من المصادر"],
];

const sourceChoices: [string, string][] = [
  ["business", "خرائط الأعمال ومصادر الشركات"],
  ["file", "ملفات البيانات والجداول"],
  ["website", "نماذج الموقع"],
  ["whatsapp", "واتساب"],
  ["manual", "إدخال يدوي"],
  ["external-crm", "نظام إدارة عملاء خارجي"],
];

const aiChoices: [string, string][] = [
  ["score", "تقييم فرص العملاء"],
  ["next-step", "اقتراح الخطوة التالية"],
  ["draft", "صياغة الردود"],
  ["summary", "تلخيص المحادثات"],
  ["qualify", "تأهيل العملاء"],
  ["follow", "متابعة العملاء"],
];

const textFields = ["companyName", "industry", "city", "teamSize", "salesTeam", "pipeline", "monthlyLeads", "averageDealValue"] as const;

/** `state.workspace` كما تصفه العقود؛ الحقول تُكتب ديناميكيًا في نسخة Vanilla. */
const workspace = () => state.workspace as OnboardingWorkspace;
const onboardingErrors = () => (state.onboardingErrors ?? {}) as Record<string, string>;

function syncOnboardingForm(form: HTMLFormElement): void {
  const data = new FormData(form);
  const target = workspace() as Record<string, unknown>;
  for (const key of textFields) {
    if (data.has(key)) target[key] = String(data.get(key)).trim();
  }
}

function validateOnboardingStep(step: number): boolean {
  const w = workspace();
  const errors: Record<string, string> = {};

  if (step === 1) {
    if (!w.companyName) errors.companyName = "أدخل اسم الشركة للمتابعة.";
    if (!w.industry) errors.industry = "اختر القطاع.";
    if (!w.city) errors.city = "أدخل المدينة.";
    if (!w.teamSize) errors.teamSize = "اختر حجم الفريق.";
  }
  if (step === 2 && !w.goals.length) errors.goals = "اختر هدفًا واحدًا على الأقل.";
  if (step === 3 && !w.sources.length) errors.sources = "اختر مصدرًا واحدًا على الأقل.";
  if (step === 4) {
    if (!w.salesTeam) errors.salesTeam = "أدخل عدد أعضاء الفريق.";
    if (!w.pipeline) errors.pipeline = "اختر حالة مسار المبيعات.";
    if (!w.monthlyLeads) errors.monthlyLeads = "أدخل متوسط العملاء الشهري.";
    if (!w.averageDealValue) errors.averageDealValue = "أدخل متوسط قيمة الصفقة.";
  }

  state.onboardingErrors = errors;
  return Object.keys(errors).length === 0;
}

function FieldError({ name }: { name: string }) {
  const message = onboardingErrors()[name];
  if (!message) return null;
  return (
    <p className="wizard-error" role="alert">
      {message}
    </p>
  );
}

function ChoiceGrid({ collection, choices }: { collection: OnboardingCollection; choices: [string, string][] }) {
  function toggle(value: string) {
    const current = workspace()[collection];
    workspace()[collection] = current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
    notifyStateChanged();
  }

  return (
    <div className="onboarding-choice-grid">
      {choices.map(([value, label]) => {
        const selected = workspace()[collection].includes(value);
        return (
          <button
            key={value}
            type="button"
            className={`onboarding-choice ${selected ? "selected" : ""}`}
            aria-pressed={selected}
            onClick={() => toggle(value)}
          >
            <i>{selected ? "✓" : ""}</i>
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function Onboarding() {
  const toast = useToast();
  const step: number = state.onboardingStep;
  const w = workspace();

  function back() {
    state.onboardingStep = Math.max(1, step - 1);
    state.onboardingErrors = {};
    notifyStateChanged();
  }

  function finish() {
    state.onboardingDone = true;
    state.signedIn = true;
    state.onboardingErrors = {};
    notifyStateChanged();
    go("dashboard");
    toast("تم تجهيز مساحة العمل التجريبية وفق اختياراتك.", "success");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    syncOnboardingForm(event.currentTarget);
    if (!validateOnboardingStep(step)) {
      notifyStateChanged();
      return;
    }
    if (step === 5) {
      finish();
      return;
    }
    state.onboardingErrors = {};
    state.onboardingStep = step + 1;
    notifyStateChanged();
  }

  return (
    <div className="onboarding-shell">
      <aside className="onboarding-aside">
        <Brand />
        <div>
          <p className="eyebrow">إعداد مساحة العمل</p>
          <h2>ابدأ خلال خمس خطوات قصيرة.</h2>
          <p>بعد الإعداد تدخل مباشرة إلى مساحة عمل تجريبية مبنية على اختياراتك.</p>
        </div>
        <ol className="onboarding-progress">
          {stepNames.map((name, index) => {
            const position = index + 1;
            const status = position < step ? "done" : position === step ? "active" : "";
            return (
              <li key={name} className={status} aria-current={position === step ? "step" : undefined}>
                <i>{position < step ? "✓" : position}</i>
                <span>{name}</span>
              </li>
            );
          })}
        </ol>
        <small>لا يتم حفظ أي معلومات خارج الذاكرة الحالية للنموذج.</small>
      </aside>

      <main className="onboarding-main">
        <div className="onboarding-card">
          <div className="onboarding-step-count">الخطوة {step} من ٥</div>

          <form className="wizard-form" noValidate onSubmit={handleSubmit}>
            {step === 1 && (
              <>
                <h1>أخبرنا عن شركتك</h1>
                <p>نستخدم هذه المعلومات لتهيئة مساحة العمل التجريبية فقط.</p>
                <div className="form-grid">
                  <div className="form-field wide">
                    <label htmlFor="workspaceName">اسم الشركة</label>
                    <input
                      id="workspaceName"
                      name="companyName"
                      defaultValue={w.companyName}
                      placeholder="مثال: وكالة نمو الرقمية"
                      aria-invalid={Boolean(onboardingErrors().companyName)}
                    />
                    <FieldError name="companyName" />
                  </div>
                  <div className="form-field">
                    <label htmlFor="workspaceIndustry">القطاع</label>
                    <select id="workspaceIndustry" name="industry" defaultValue={w.industry}>
                      <option value="">اختر القطاع</option>
                      {industries.map((entry) => (
                        <option key={entry}>{entry}</option>
                      ))}
                    </select>
                    <FieldError name="industry" />
                  </div>
                  <div className="form-field">
                    <label htmlFor="workspaceCity">المدينة</label>
                    <input id="workspaceCity" name="city" defaultValue={w.city} placeholder="مثال: الرياض" />
                    <FieldError name="city" />
                  </div>
                  <div className="form-field wide">
                    <label htmlFor="workspaceTeam">حجم الفريق</label>
                    <select id="workspaceTeam" name="teamSize" defaultValue={w.teamSize}>
                      <option value="">اختر حجم الفريق</option>
                      {teamSizes.map((entry) => (
                        <option key={entry}>{entry}</option>
                      ))}
                    </select>
                    <FieldError name="teamSize" />
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h1>ما الهدف الرئيسي من استخدام المنصة؟</h1>
                <p>يمكنك اختيار أكثر من هدف. يساعدنا ذلك على ترتيب لوحة التجربة الأولية.</p>
                <ChoiceGrid collection="goals" choices={goalChoices} />
                <FieldError name="goals" />
              </>
            )}

            {step === 3 && (
              <>
                <h1>من أين تحصل على العملاء الآن؟</h1>
                <p>اختر المصادر التي تستخدمها حاليًا. جميع الخيارات في هذا النموذج تجريبية فقط.</p>
                <ChoiceGrid collection="sources" choices={sourceChoices} />
                <FieldError name="sources" />
              </>
            )}

            {step === 4 && (
              <>
                <h1>كيف يعمل فريق المبيعات؟</h1>
                <p>تغذي هذه البيانات مؤشرات مساحة العمل التجريبية فقط.</p>
                <div className="form-grid">
                  <div className="form-field">
                    <label htmlFor="salesTeam">عدد أعضاء الفريق</label>
                    <input id="salesTeam" name="salesTeam" className="ltr" inputMode="numeric" defaultValue={w.salesTeam || ""} placeholder="مثال: ٦" />
                    <FieldError name="salesTeam" />
                  </div>
                  <div className="form-field">
                    <label htmlFor="hasPipeline">هل يوجد مسار مبيعات؟</label>
                    <select id="hasPipeline" name="pipeline" defaultValue={w.pipeline}>
                      <option value="">اختر الإجابة</option>
                      <option value="نعم">نعم</option>
                      <option value="لا">لا</option>
                    </select>
                    <FieldError name="pipeline" />
                  </div>
                  <div className="form-field">
                    <label htmlFor="monthlyLeads">متوسط العملاء شهريًا</label>
                    <input id="monthlyLeads" name="monthlyLeads" className="ltr" inputMode="numeric" defaultValue={w.monthlyLeads} placeholder="مثال: ٥٠٠" />
                    <FieldError name="monthlyLeads" />
                  </div>
                  <div className="form-field">
                    <label htmlFor="averageDealValue">متوسط قيمة الصفقة</label>
                    <input id="averageDealValue" name="averageDealValue" className="ltr" inputMode="numeric" defaultValue={w.averageDealValue} placeholder="مثال: ٢٥٠٠٠" />
                    <FieldError name="averageDealValue" />
                  </div>
                </div>
                <div className="wizard-preview-metrics">
                  <span>
                    الفريق: <b>{w.salesTeam || "—"}</b>
                  </span>
                  <span>
                    العملاء شهريًا: <b>{w.monthlyLeads || "—"}</b>
                  </span>
                  <span>
                    متوسط الصفقة: <b>{w.averageDealValue ? `${w.averageDealValue} ر.س` : "—"}</b>
                  </span>
                </div>
              </>
            )}

            {step === 5 && (
              <>
                <h1>كيف تريد أن يساعدك الذكاء الاصطناعي؟</h1>
                <p>اختر التفضيلات التي تريد ظهورها في التجربة. يمكنك تغييرها لاحقًا.</p>
                <ChoiceGrid collection="aiPreferences" choices={aiChoices} />
                <div className="prototype-notice">
                  <b>تنبيه تجريبي</b>
                  <span>جميع وظائف الذكاء الاصطناعي في هذا النموذج محاكاة لغرض اختبار تجربة المنتج فقط.</span>
                </div>
              </>
            )}

            <div className="wizard-actions">
              {step === 1 ? (
                <span />
              ) : (
                <button className="button" type="button" onClick={back}>
                  السابق
                </button>
              )}
              {step === 5 ? (
                <div>
                  <button className="button ghost" type="button" onClick={finish}>
                    تجاوز الآن
                  </button>
                  <button className="button primary" type="submit">
                    دخول مساحة العمل
                  </button>
                </div>
              ) : (
                <button className="button primary" type="submit">
                  التالي
                </button>
              )}
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}

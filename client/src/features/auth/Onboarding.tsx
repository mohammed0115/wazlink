/**
 * إعداد مساحة العمل — Wizard من خمس خطوات.
 *
 * منقول عن `renderOnboarding()` و`renderOnboardingStep()` في V1 مع نفس
 * قواعد التحقق والنصوص. المدخلات تبقى في ذاكرة الجلسة فقط: لا حساب،
 * ولا تخزين دائم، ولا اتصال خارجي.
 */
import { useState, type FormEvent } from "react";
import { onboardingService, workspaceService } from "@services";
import { go } from "../../shared/router/useHashRoute";
import { useSession, useWorkspace } from "../../shared/context/AppProviders";
import { useToast } from "../../shared/store/toast";
import { Brand } from "../../shared/shell/Brand";
import type { OnboardingCollection, OnboardingWorkspace } from "../../domain/types";
import { capabilityLabels, usageMetricLabels } from "../../services/contracts/entitlements";
import type { OnboardingRecommendation } from "../../services/contracts/onboarding";

const stepNames = ["الشركة", "الهدف", "المصادر", "الفريق", "الذكاء الاصطناعي", "ملخصك"];

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

function FieldError({ name, errors }: { name: string; errors: Record<string, string> }) {
  const message = errors[name];
  if (!message) return null;
  return (
    <p className="wizard-error" role="alert">
      {message}
    </p>
  );
}

function ChoiceGrid({ collection, choices, draft, setDraft }: { collection: OnboardingCollection; choices: [string, string][]; draft: OnboardingWorkspace; setDraft: (next: OnboardingWorkspace) => void }) {
  function toggle(value: string) {
    const current = draft[collection];
    setDraft({ ...draft, [collection]: current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value] });
  }

  return (
    <div className="onboarding-choice-grid">
      {choices.map(([value, label]) => {
        const selected = draft[collection].includes(value);
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
  const { updateWorkspace } = useWorkspace();
  const { completeOnboarding, onboardingDone } = useSession();
  const [step, setStep] = useState(1);
  const [recommendation, setRecommendation] = useState<OnboardingRecommendation | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [w, setDraft] = useState<OnboardingWorkspace>(() => ({ ...workspaceService.getCurrent() } as OnboardingWorkspace));

  function validate(current: OnboardingWorkspace, currentStep: number): Record<string, string> {
    const nextErrors: Record<string, string> = {};
    if (currentStep === 1) {
      if (!current.companyName) nextErrors.companyName = "أدخل اسم الشركة للمتابعة.";
      if (!current.industry) nextErrors.industry = "اختر القطاع.";
      if (!current.city) nextErrors.city = "أدخل المدينة.";
      if (!current.teamSize) nextErrors.teamSize = "اختر حجم الفريق.";
    }
    if (currentStep === 2 && !current.goals.length) nextErrors.goals = "اختر هدفًا واحدًا على الأقل.";
    if (currentStep === 3 && !current.sources.length) nextErrors.sources = "اختر مصدرًا واحدًا على الأقل.";
    if (currentStep === 4) {
      if (!current.salesTeam) nextErrors.salesTeam = "أدخل عدد أعضاء الفريق.";
      if (!current.pipeline) nextErrors.pipeline = "اختر حالة مسار المبيعات.";
      if (!current.monthlyLeads) nextErrors.monthlyLeads = "أدخل متوسط العملاء الشهري.";
      if (!current.averageDealValue) nextErrors.averageDealValue = "أدخل متوسط قيمة الصفقة.";
    }
    return nextErrors;
  }

  function back() {
    setStep((current) => Math.max(1, current - 1));
    setErrors({});
  }

  function finish() {
    if (isCompleting || onboardingDone) {
      go("dashboard");
      return;
    }
    setIsCompleting(true);
    updateWorkspace(w);
    completeOnboarding();
    setErrors({});
    go("dashboard");
    toast("تم تجهيز مساحة العمل التجريبية وفق اختياراتك.", "success");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextDraft = { ...w } as OnboardingWorkspace & Record<string, unknown>;
    for (const key of textFields) {
      if (data.has(key)) nextDraft[key] = String(data.get(key) || "").trim();
    }
    const normalizedDraft = nextDraft as OnboardingWorkspace;
    setDraft(normalizedDraft);
    const nextErrors = validate(normalizedDraft, step);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    if (step === 5) {
      const profile = onboardingService.profileFromWorkspace(normalizedDraft as unknown as Readonly<Record<string, unknown>>);
      setRecommendation(onboardingService.recommend(profile));
      setStep(6);
      return;
    }
    if (step === 6) {
      finish();
      return;
    }
    setStep((current) => current + 1);
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
          <div className="onboarding-step-count">{step <= 5 ? `الخطوة ${step} من ٥` : "ملخص التهيئة قبل الدخول"}</div>

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
                      aria-invalid={Boolean(errors.companyName)}
                    />
                    <FieldError errors={errors} name="companyName" />
                  </div>
                  <div className="form-field">
                    <label htmlFor="workspaceIndustry">القطاع</label>
                    <select id="workspaceIndustry" name="industry" defaultValue={w.industry}>
                      <option value="">اختر القطاع</option>
                      {industries.map((entry) => (
                        <option key={entry}>{entry}</option>
                      ))}
                    </select>
                    <FieldError errors={errors} name="industry" />
                  </div>
                  <div className="form-field">
                    <label htmlFor="workspaceCity">المدينة</label>
                    <input id="workspaceCity" name="city" defaultValue={w.city} placeholder="مثال: الرياض" />
                    <FieldError errors={errors} name="city" />
                  </div>
                  <div className="form-field wide">
                    <label htmlFor="workspaceTeam">حجم الفريق</label>
                    <select id="workspaceTeam" name="teamSize" defaultValue={w.teamSize}>
                      <option value="">اختر حجم الفريق</option>
                      {teamSizes.map((entry) => (
                        <option key={entry}>{entry}</option>
                      ))}
                    </select>
                    <FieldError errors={errors} name="teamSize" />
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <h1>ما الهدف الرئيسي من استخدام المنصة؟</h1>
                <p>يمكنك اختيار أكثر من هدف. يساعدنا ذلك على ترتيب لوحة التجربة الأولية.</p>
                <ChoiceGrid collection="goals" choices={goalChoices} draft={w} setDraft={setDraft} />
                <FieldError errors={errors} name="goals" />
              </>
            )}

            {step === 3 && (
              <>
                <h1>من أين تحصل على العملاء الآن؟</h1>
                <p>اختر المصادر التي تستخدمها حاليًا. جميع الخيارات في هذا النموذج تجريبية فقط.</p>
                <ChoiceGrid collection="sources" choices={sourceChoices} draft={w} setDraft={setDraft} />
                <FieldError errors={errors} name="sources" />
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
                    <FieldError errors={errors} name="salesTeam" />
                  </div>
                  <div className="form-field">
                    <label htmlFor="hasPipeline">هل يوجد مسار مبيعات؟</label>
                    <select id="hasPipeline" name="pipeline" defaultValue={w.pipeline}>
                      <option value="">اختر الإجابة</option>
                      <option value="نعم">نعم</option>
                      <option value="لا">لا</option>
                    </select>
                    <FieldError errors={errors} name="pipeline" />
                  </div>
                  <div className="form-field">
                    <label htmlFor="monthlyLeads">متوسط العملاء شهريًا</label>
                    <input id="monthlyLeads" name="monthlyLeads" className="ltr" inputMode="numeric" defaultValue={w.monthlyLeads} placeholder="مثال: ٥٠٠" />
                    <FieldError errors={errors} name="monthlyLeads" />
                  </div>
                  <div className="form-field">
                    <label htmlFor="averageDealValue">متوسط قيمة الصفقة</label>
                    <input id="averageDealValue" name="averageDealValue" className="ltr" inputMode="numeric" defaultValue={w.averageDealValue} placeholder="مثال: ٢٥٠٠٠" />
                    <FieldError errors={errors} name="averageDealValue" />
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
                <ChoiceGrid collection="aiPreferences" choices={aiChoices} draft={w} setDraft={setDraft} />
                <div className="prototype-notice">
                  <b>تنبيه تجريبي</b>
                  <span>جميع وظائف الذكاء الاصطناعي في هذا النموذج محاكاة لغرض اختبار تجربة المنتج فقط.</span>
                </div>
              </>
            )}

            {step === 6 && recommendation && (
              <section className="onboarding-recommendation" aria-labelledby="onboarding-recommendation-title">
                <p className="eyebrow">تهيئة ذكية محلية</p>
                <h1 id="onboarding-recommendation-title">خطة بداية مبنية على اختياراتك</h1>
                <div className="onboarding-recommendation-plans">
                  <div><span>خطتك الحالية</span><strong>{recommendation.currentPlan.name}</strong></div>
                  <div><span>اقتراحنا</span><strong>{recommendation.recommendedPlan?.name || "الخطة الحالية كافية"}</strong></div>
                </div>
                <div className="onboarding-recommendation-grid">
                  <div>
                    <b>القدرات الأقرب لأهدافك</b>
                    <ul>{recommendation.relevantCapabilities.slice(0, 4).map((capability) => <li key={capability}>{capabilityLabels[capability]}</li>)}</ul>
                  </div>
                  <div>
                    <b>لماذا؟</b>
                    <ul>{recommendation.reasons.slice(0, 3).map((item) => <li key={item.code}>{item.text}</li>)}</ul>
                  </div>
                </div>
                {recommendation.limitContext.length > 0 && (
                  <div className="onboarding-limit-context">
                    <b>سياق الاستخدام الحالي</b>
                    {recommendation.limitContext.slice(0, 3).map((metric) => <span key={metric.metric}>{usageMetricLabels[metric.metric]}: {metric.used}{metric.remaining === null ? " / ∞" : ` / ${(metric.limit.kind === "finite" ? metric.limit.value : 0)}`}</span>)}
                  </div>
                )}
                <div className="onboarding-first-action">
                  <span>الإجراء الأول المقترح</span>
                  <strong>{recommendation.firstAction.label}</strong>
                  <small>{recommendation.firstAction.reason}</small>
                </div>
                {recommendation.recommendedPlan && <button className="button ghost" type="button" onClick={() => go("settings/billing")}>إدارة خيارات الباقة</button>}
              </section>
            )}

            <div className="wizard-actions">
              {step === 1 ? (
                <span />
              ) : (
                <button className="button" type="button" onClick={back} disabled={isCompleting}>
                  السابق
                </button>
              )}
              {step === 5 ? (
                <div>
                  <button className="button ghost" type="button" onClick={finish} disabled={isCompleting}>
                    تجاوز الآن
                  </button>
                  <button className="button primary" type="submit" disabled={isCompleting}>
                    عرض ملخصي
                  </button>
                </div>
              ) : step === 6 ? (
                <button className="button primary" type="submit" disabled={isCompleting}>
                  دخول مساحة العمل
                </button>
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

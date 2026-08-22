/**
 * الصفحة التعريفية — V1-FINAL-FIX.
 *
 * كل رقم مالي هنا يقرأ من `getLandingTruth()` الذي يستهلك selectors S10
 * نفسها. لا يوجد أي حساب مالي محلي في هذه الشاشة ولا أرقام ثابتة،
 * ولا يغيّر فتحها أي كيان تشغيلي — العرض قراءة فقط.
 */
import { Fragment } from "react";
import { scraperCrmPackages } from "@services/data";
import { getLandingTruth } from "@domain/landing-truth.js";
import { go } from "../../shared/router/useHashRoute";
import { useToast } from "../../shared/store/toast";
import { Brand } from "../../shared/shell/Brand";
import { ScraperReferenceHero } from "./ScraperReference";

const arabicNumber = (value: unknown) => new Intl.NumberFormat("ar-SA").format(Number(value || 0));
const sarLabel = (value: unknown) => `${arabicNumber(value)} ر.س`;

const PERIOD = "كل الفترة التجريبية";

const heroStages: [string, string, string][] = [
  ["discovered", "شركة مكتشفة", "اكتشاف"],
  ["high", "فرصة عالية", "تحليل"],
  ["lead", "عميل محتمل", "تأهيل"],
  ["deal", "صفقة", "مبيعات"],
  ["won", "صفقة رابحة", "إيراد"],
];

const workflow: [string, string, string][] = [
  ["01", "استخرج", "أدخل النشاط والمدينة وشغّل عملية واحدة."],
  ["02", "راجع النتائج", "حدّد الشركات والحقول التي تحتاجها في ملفك."],
  ["03", "اختر مسارك", "نزّل Excel وانتهى، أو اختر CRM عند الحاجة للمبيعات."],
  ["04", "فعّل وتابع", "فعّل الباقة المناسبة محليًا ثم أكمل خطوتك التالية."],
];

const integrations: [string, string][] = [
  ["خرائط الأعمال", "محاكاة محلية"], ["واتساب", "محاكاة محلية"], ["إنستغرام", "قريبًا"], ["دردشة الموقع", "مخطط"],
  ["التقويم", "قريبًا"], ["نظام إدارة العملاء", "استيراد تجريبي"], ["الخطافات البرمجية", "معطّل تجريبيًا"], ["واجهة برمجية", "مخطط"],
];

const useCases = ["وكالات التسويق", "فرق مبيعات الشركات", "شركات الخدمات", "العقار", "العيادات", "شركات التقنية", "فرق توليد العملاء"];

const copilotActions = ["صياغة متابعة", "إنشاء مهمة", "تلخيص العميل", "اقتراح الخطوة التالية"];

export function Landing() {
  const toast = useToast();
  const { intelligence, funnel, metrics, business, reasons, services } = getLandingTruth();

  const stage = (id: string) => funnel.get(id) || { count: 0, label: id };
  const attributionStages = ["discovered", "high", "lead", "deal", "won"].map((id) => stage(id));

  const score = intelligence?.score ?? 0;
  const confidence = Math.round((intelligence?.confidence || 0) * 100);
  const serviceLabels: string[] = services.length ? services : ["خدمة مرتبطة بالفجوة المثبتة"];
  const reasonLabels: string[] = reasons.length ? reasons : ["تُعرض الأدلة عند اكتمال التحليل"];
  const businessName = business.name || "شركة تجريبية";
  const businessId = business.id || "";
  const city = business.city || "";

  const pipelineCards: [string, string | number, string][] = [
    ["الصفقات المفتوحة", metrics.openDeals.value, "من مصدر الصفقات الحالي"],
    ["قيمة مسار المبيعات", sarLabel(metrics.openPipeline.value), "لقطة حالية — لا يطبق عليها نطاق التاريخ"],
    ["مسار المبيعات المرجّح", sarLabel(metrics.weightedPipeline.value), "القيمة × احتمال الصفقة"],
  ];

  const showDemo = () => toast("هذه معاينة ببيانات تجريبية تشرح طبقة التحليل وسير المبيعات.");

  return (
    <div className="public-shell landing-shell">
      <nav className="public-nav landing-nav" aria-label="التنقل العام">
        <Brand />
        <div className="public-nav-links">
          <a href="#platform">المنصة</a>
          <a href="#workflow">كيف تعمل</a>
          <a href="#intelligence">الذكاء الاصطناعي</a>
          <a href="#uses">الاستخدامات</a>
          <a href="#/login">الدخول</a>
        </div>
        <div className="public-actions">
          <button className="button primary" type="button" onClick={() => go("onboarding")}>
            ابدأ الآن
          </button>
        </div>
      </nav>

      <main>
        <section className="hero landing-hero" id="platform">
          <div className="hero-copy">
            <p className="eyebrow">الخطوة ١ من ٤ · ابدأ بالاستخراج</p>
            <h1>ابحث عن الشركات أولًا، ولا تقرر الباقة الآن</h1>
            <p className="lead">
              أدخل القطاع والموقع، ثم راجع النتائج. بعد أن ترى البيانات، ستختار ببساطة: Excel فقط أو CRM نمو للمبيعات.
            </p>
            <div className="hero-actions">
              <button className="button primary" type="button" onClick={() => go("discovery")}>
                ابدأ استخراج الشركات
              </button>
            </div>
            <p className="hero-next">الخطوة التالية: راجع الشركات والحقول قبل اختيار مسارك.</p>
            <p className="hero-note">
              <i />
              نموذج تفاعلي ببيانات تجريبية؛ لا توجد عمليات بحث أو رسائل أو تكاملات حقيقية.
            </p>
          </div>

          <div className="hero-visual source-revenue-visual">
            <div className="source-revenue-head">
              <span>حقيقة تجريبية مشتركة</span>
              <b>{PERIOD}</b>
            </div>
            <div className="source-query">
              <span>قمع الاكتساب</span>
              <b>مشتق من محرك التحليلات</b>
              <small>لا يعاد احتسابه داخل Landing</small>
            </div>
            <div className="source-flow">
              {heroStages.map(([id, label, stageLabel], index) => (
                <div key={id} className={`source-flow-row ${id === "won" ? "revenue-row" : ""}`}>
                  <i>{index + 1}</i>
                  <div>
                    <span>{stageLabel}</span>
                    <b>{label}</b>
                  </div>
                  <strong>{arabicNumber(stage(id).count)}</strong>
                </div>
              ))}
            </div>
            <div className="source-revenue-footer">
              <span>الإيراد المنسوب</span>
              <b>{sarLabel(metrics.attributedRevenue.value)}</b>
              <small>{PERIOD} · يظهر عند اختيار CRM فقط ومشتق من S10</small>
            </div>
          </div>
        </section>

        <ScraperReferenceHero />

        <section className="landing-section package-path-section" aria-label="ما الذي سيحدث بعد النتائج">
          <div className="section-head">
            <div>
              <p className="eyebrow">القرار مؤجل إلى ما بعد النتائج</p>
              <h2>لا تحتاج إلى اختيار CRM قبل رؤية شركاتك</h2>
            </div>
            <p>ابدأ باستخراج واحد. سنطلب منك قرارًا واحدًا فقط بعد تحديد النتائج.</p>
          </div>
          <div className="landing-package-paths">
            <article className="landing-package-card scraper">
              <span>بعد النتائج</span>
              <p className="eyebrow">{scraperCrmPackages.scraper.label}</p>
              <h3>نزّل Excel وانتهى</h3>
              <p>{scraperCrmPackages.scraper.purpose}. هذا هو المسار الافتراضي إذا كان هدفك ملفًا منظمًا فقط.</p>
              <ul>
                {scraperCrmPackages.scraper.features.map((feature: string) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <strong>{scraperCrmPackages.scraper.price}</strong>
              <small>ستظهر خطوة التفعيل عند اختيار التنزيل.</small>
            </article>
            <article className="landing-package-card crm">
              <span>عند الحاجة فقط</span>
              <p className="eyebrow">{scraperCrmPackages.crm.label}</p>
              <h3>تابع المبيعات داخل نمو</h3>
              <p>{scraperCrmPackages.crm.purpose}. اخترها فقط إذا أردت Leads ومحادثات وصفقات.</p>
              <ul>
                {scraperCrmPackages.crm.features.map((feature: string) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
              <strong>{scraperCrmPackages.crm.price}</strong>
              <small>ستظهر خطوة التفعيل عند اختيار CRM.</small>
            </article>
          </div>
        </section>

        <section className="workflow-strip" id="workflow">
          <div className="landing-section-title">
            <p className="eyebrow">سير العمل</p>
            <h2>كيف تعمل المنصة؟</h2>
            <p>لا تبدأ من قائمة أسماء؛ بل من إشارة يمكن تتبعها حتى نتيجة بيع واضحة.</p>
          </div>
          <div className="workflow-steps product-workflow">
            {workflow.map(([number, title, detail]) => (
              <article className="workflow-step" key={number}>
                <span>{number}</span>
                <b>{title}</b>
                <small>{detail}</small>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section discovery-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">اكتشاف مدعوم بالبيانات</p>
              <h2>لا تبحث عن أسماء فقط — ابحث عن فرص بيع</h2>
            </div>
            <p>كل شركة تظهر كسجل قابل للفهم، وليس كسطر معزول في ملف.</p>
          </div>
          <div className="discovery-showcase">
            <article className="business-preview">
              <header>
                <div>
                  <span className="eyebrow">سجل شركة من الحقيقة التشغيلية</span>
                  <h3>{businessName}</h3>
                  <small className="mono">
                    {businessId}
                    {city ? ` · ${city}` : ""}
                  </small>
                </div>
                <span className="score high">{arabicNumber(score)}</span>
              </header>
              <div className="business-facts">
                <span>
                  <small>التقييم</small>
                  <b>{arabicNumber(business.rating)}</b>
                </span>
                <span>
                  <small>المراجعات</small>
                  <b>{arabicNumber(business.reviews)}</b>
                </span>
                <span>
                  <small>التحليل</small>
                  <b className="text-green">{intelligence?.status === "analyzed" ? "مكتمل" : "قيد المراجعة"}</b>
                </span>
                <span>
                  <small>الثقة</small>
                  <b>{arabicNumber(confidence)}%</b>
                </span>
                <span>
                  <small>درجة الفرصة</small>
                  <b>{arabicNumber(score)} / ١٠٠</b>
                </span>
              </div>
              <footer>
                <span>خدمات مرتبطة بأدلة</span>
                <div>
                  {serviceLabels.map((service) => (
                    <em key={service}>{service}</em>
                  ))}
                </div>
              </footer>
            </article>
            <aside className="discovery-copy">
              <p className="eyebrow">من مصدر أعمال إلى سياق بيع</p>
              <h3>تبدأ الرحلة بالمصدر، لكنها لا تنتهي عنده.</h3>
              <p>
                يُحفظ الأصل، ثم تُضاف إشارات النشاط والفجوات الرقمية والتوصية الخدمية بجانب الشركة لتوجيه الفريق إلى
                الخطوة التالية.
              </p>
              <button className="button" type="button" onClick={showDemo}>
                اكتشف كيف يتم تحليل الفرص
              </button>
            </aside>
          </div>
        </section>

        <section className="landing-section intelligence-section" id="intelligence">
          <div className="section-head">
            <div>
              <p className="eyebrow">ذكاء فرص العملاء</p>
              <h2>كل عميل يأتي مع سبب واضح لكونه فرصة</h2>
            </div>
            <p>الذكاء الاصطناعي هنا طبقة تحليل وقرار، وليس نافذة محادثة منفصلة.</p>
          </div>
          <div className="intelligence-showcase">
            <article className="intelligence-reason">
              <header>
                <span>لماذا هذا العميل مهم؟</span>
                <b>إشارات قابلة للمراجعة</b>
              </header>
              <p>تستند التوصية إلى الإشارات والفجوات المثبتة في ملف الشركة الحالي.</p>
              <div className="signal-list">
                {reasonLabels.map((reason) => (
                  <span key={reason}>
                    <i>!</i>
                    {reason}
                  </span>
                ))}
              </div>
              <footer>
                <small>الخدمات المقترحة</small>
                <b>{serviceLabels.join(" + ")}</b>
              </footer>
            </article>
            <article className="intelligence-meta">
              <span>درجة الفرصة</span>
              <b className="mono">{arabicNumber(score)}/100</b>
              <small>ثقة {arabicNumber(confidence)}% · مراجعة بشرية مطلوبة</small>
              <div>
                <em>الفجوات المثبتة</em>
                <em>أسلوب البيع المقترح</em>
                <em>الإجراء التالي</em>
              </div>
            </article>
          </div>
        </section>

        <section className="landing-section context-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">سياق متصل</p>
              <h2>لا تفقد سياق العميل بعد الاكتشاف</h2>
            </div>
            <p>
              تتحرك نفس الهوية من الشركة إلى العميل المحتمل والمحادثة والصفقة، بينما يظل الإيراد ملخصًا مستقلًا للفترة.
            </p>
          </div>
          <div className="record-chain">
            <article>
              <span className="mono">{businessId}</span>
              <b>شركة</b>
              <small>البيانات والإشارات</small>
            </article>
            <i>↓</i>
            <article>
              <span className="mono">LEAD-1042</span>
              <b>عميل محتمل</b>
              <small>المالك ودرجة الفرصة</small>
            </article>
            <i>↓</i>
            <article>
              <span className="mono">CONV-3042</span>
              <b>محادثة</b>
              <small>السياق والمتابعة</small>
            </article>
            <i>↓</i>
            <article>
              <span className="mono">DEAL-4042</span>
              <b>صفقة</b>
              <small>قيمة واحتمال مستقلان</small>
            </article>
            <i>↓</i>
            <article className="revenue">
              <span>{sarLabel(metrics.revenue.value)}</span>
              <b>إيراد معترف به</b>
              <small>{PERIOD} · ملخص S10 وليس قيمة صفقة واحدة</small>
            </article>
          </div>
        </section>

        <section className="landing-section copilot-section">
          <div className="copilot-landing">
            <div>
              <p className="eyebrow">مساعد المبيعات الذكي</p>
              <h2>الذكاء الاصطناعي يساعد فريق المبيعات على اتخاذ الخطوة التالية</h2>
              <p>
                يربط الإشارة والوقت والسياق ليقترح الإجراء التالي، بينما تبقى المراجعة البشرية جزءًا أساسيًا من القرار.
              </p>
            </div>
            <article>
              <span>تنبيه متابعة</span>
              <h3>راجع السياق قبل اتخاذ الخطوة التالية.</h3>
              <dl>
                <div>
                  <dt>الفرصة</dt>
                  <dd>تُراجع بشريًا</dd>
                </div>
                <div>
                  <dt>أفضل إجراء الآن</dt>
                  <dd>صياغة مسودة ومراجعتها</dd>
                </div>
                <div>
                  <dt>الإرسال</dt>
                  <dd>بشري ومحلي فقط</dd>
                </div>
              </dl>
              <div className="copilot-actions">
                {copilotActions.map((label) => (
                  <button className="button" type="button" key={label} onClick={showDemo}>
                    {label}
                  </button>
                ))}
              </div>
            </article>
          </div>
        </section>

        <section className="landing-section pipeline-section">
          <div className="section-head">
            <div>
              <p className="eyebrow">متابعة المبيعات</p>
              <h2>ملخص مسار المبيعات الحالي</h2>
            </div>
            <p>لقطة مشتقة من الصفقات الحالية؛ لا تمثل إيرادًا خلال الفترة.</p>
          </div>
          <div className="landing-kanban">
            {pipelineCards.map(([label, value, description]) => (
              <article key={label}>
                <header>
                  <b>{label}</b>
                </header>
                <div>
                  <span>س</span>
                  <b>{value}</b>
                  <small>{description}</small>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section attribution-section">
          <div className="attribution-landing">
            <header>
              <p className="eyebrow">نسبة الإيراد</p>
              <h2>اعرف أي مراحل اكتساب تؤدي إلى إيراد</h2>
              <p>القمع والإيراد يعتمدان محرك S10 نفسه وبنفس دلالة الفترة.</p>
            </header>
            <div className="attribution-landing-flow">
              {attributionStages.map((item) => (
                <Fragment key={item.label}>
                  <article>
                    <span>{item.label}</span>
                    <b>{arabicNumber(item.count)}</b>
                  </article>
                  <i>↓</i>
                </Fragment>
              ))}
              <article className="revenue">
                <span>الإيراد المعترف به</span>
                <b>{sarLabel(metrics.revenue.value)}</b>
                <small>{PERIOD}</small>
              </article>
            </div>
          </div>
        </section>

        <section className="landing-section uses-section" id="uses">
          <div className="section-head">
            <div>
              <p className="eyebrow">لمن صُممت</p>
              <h2>للفرق التي تريد تحويل الإشارات إلى قرارات بيع</h2>
            </div>
            <p>تركيز واضح على حالات الاستخدام التي تحتاج اكتسابًا منظمًا ومتابعة قابلة للقياس.</p>
          </div>
          <div className="uses-grid">
            {useCases.map((use, index) => (
              <article key={use}>
                <i>{String(index + 1).padStart(2, "0")}</i>
                <b>{use}</b>
                <span>اكتشاف، فهم، متابعة، وقياس.</span>
              </article>
            ))}
          </div>
        </section>

        <section className="landing-section integrations-preview">
          <div className="section-head">
            <div>
              <p className="eyebrow">طبقة تكامل</p>
              <h2>مصادر وقنوات ووجهات ضمن مسار واحد</h2>
            </div>
            <p>المعروض أدناه حالة تخطيطية داخل Prototype ولا يمثل تكاملات تشغيلية حقيقية.</p>
          </div>
          <div className="integration-preview-grid">
            {integrations.map(([name, status], index) => (
              <article key={name}>
                <i>{String(index + 1).padStart(2, "0")}</i>
                <div>
                  <b>{name}</b>
                  <small className={status.includes("محاكاة") ? "planned" : status === "قريبًا" ? "soon" : "available"}>
                    {status}
                  </small>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="final-cta">
          <div>
            <p className="eyebrow">ابدأ من مسار واضح</p>
            <h2>حوّل اكتشاف العملاء إلى عملية مبيعات قابلة للقياس</h2>
            <p>ابدأ بإعداد مساحة العمل، ثم اتبع رحلة تجريبية تشرح كيف تتصل البيانات والفرص والمبيعات.</p>
          </div>
          <div>
            <button className="button primary" type="button" onClick={() => go("onboarding")}>
              ابدأ الآن
            </button>
            <button className="button" type="button" onClick={() => go("login")}>
              استكشف المنصة
            </button>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div>
          <Brand />
          <p>نموذج تجريبي لعرض تجربة منتج اكتساب العملاء والمبيعات.</p>
        </div>
        <div>
          <b>المنتج</b>
          <a href="#platform">المنصة</a>
          <a href="#workflow">الاكتشاف</a>
          <a href="#workflow">إدارة العملاء</a>
          <a href="#intelligence">الذكاء الاصطناعي</a>
          <a href="#workflow">التحليلات</a>
        </div>
        <div>
          <b>الشركة</b>
          <a href="#platform">عن المنصة</a>
          <a href="#/login">التواصل</a>
          <a href="#/login">الخصوصية</a>
          <a href="#/login">الشروط</a>
        </div>
        <div>
          <b>تقني</b>
          <a href="#/login">واجهة برمجية</a>
          <a href="#/login">تكاملات</a>
          <a href="#/login">التوثيق</a>
        </div>
      </footer>
    </div>
  );
}

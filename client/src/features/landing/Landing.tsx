/**
 * WazLink public landing page — V2-S0.1 premium visual redesign.
 * Presentation-only: existing selectors and mock data remain the source of truth.
 */
import type { CSSProperties } from "react";
import { appConfig } from "@config/env";
import { getLandingTruth } from "@domain/landing-truth.js";
import { go } from "../../shared/router/useHashRoute";
import { useToast } from "../../shared/store/toast";
import { Brand } from "../../shared/shell/Brand";

const arabicNumber = (value: unknown) => new Intl.NumberFormat("ar-SA").format(Number(value || 0));
const sarLabel = (value: unknown) => `${arabicNumber(value)} ر.س`;

const journey = [
  ["01", "اكتشف", "Google Maps"],
  ["02", "حلّل", "AI Score"],
  ["03", "أضف إلى CRM", "Lead"],
  ["04", "تواصل", "WhatsApp"],
  ["05", "تابع", "Next best action"],
  ["06", "أغلق الصفقة", "Deal"],
  ["07", "قِس الإيراد", "Analytics"],
];

const targetCustomers = ["وكالات التسويق", "فرق المبيعات", "شركات الخدمات", "العيادات", "شركات التقنية", "العقار", "فرق توليد العملاء"];
const integrations = [
  ["Google Maps", "بيانات العملاء", "mock"], ["WhatsApp", "المحادثات والمتابعة", "mock"], ["CRM", "إدارة العلاقات", "active"],
  ["Calendar", "المواعيد", "planned"], ["Website", "مصادر إضافية", "planned"], ["Import / Excel", "استيراد البيانات", "mock"], ["API", "مخطط", "planned"], ["Webhooks", "مخطط", "planned"],
];

export function Landing() {
  const toast = useToast();
  const { intelligence, funnel, metrics, business, reasons, services } = getLandingTruth();
  const score = intelligence?.score ?? 92;
  const confidence = Math.round((intelligence?.confidence || 0.92) * 100);
  const businessName = business.name || "عيادات الحياة لطب الأسنان";
  const businessCity = business.city || "الرياض";
  const businessReasons = reasons.length ? reasons.slice(0, 3) : ["الموقع يحتاج تحسين", "الحجز غير واضح", "نشاط رقمي قابل للتحسين"];
  const businessServices = services.length ? services.join(" + ") : "تطوير الموقع + أتمتة واتساب والحجز";
  const stageCount = (id: string, fallback: number) => arabicNumber(funnel.get(id)?.count || fallback);
  const showDemo = () => toast("هذه معاينة ببيانات تجريبية؛ الإرسال والتكاملات الحقيقية غير مفعّلة.");

  return (
    <div className="public-shell premium-landing" dir="rtl">
      <nav className="public-nav landing-nav premium-nav" aria-label="التنقل العام">
        <Brand />
        <div className="public-nav-links">
          <a href="#platform">المنصة</a><a href="#workflow">كيف تعمل</a><a href="#ai">الذكاء الاصطناعي</a><a href="#uses">الاستخدامات</a><a href="#pricing">الأسعار</a>
        </div>
        <div className="public-actions"><a className="button ghost nav-login" href="#/login">تسجيل الدخول</a><button className="button primary" type="button" onClick={() => go("onboarding")}>ابدأ مجاناً</button></div>
      </nav>

      <main>
        <section className="premium-hero" id="platform">
          <div className="premium-hero-copy">
            <span className="premium-badge">منصة المبيعات المدعومة بالذكاء الاصطناعي</span>
            <h1>اعثر على عملائك<br /><em>تواصل معهم بذكاء</em><br />وأغلق المزيد من الصفقات</h1>
            <p>WazLink تجمع اكتشاف العملاء، CRM، واتساب والذكاء الاصطناعي في منصة واحدة تدير رحلة المبيعات من أول فرصة حتى الإيراد.</p>
            <div className="premium-hero-actions"><button className="button primary" type="button" onClick={() => go("onboarding")}>ابدأ مجاناً</button><a className="button ghost" href="#workflow">شاهد كيف تعمل</a></div>
            <div className="trust-line"><span>✓ لا تحتاج بطاقة ائتمان</span><span>✓ إعداد سريع</span><span>✓ واجهة عربية</span></div>
          </div>
          <div className="hero-product-frame" aria-label="معاينة لوحة WazLink">
            <div className="product-browser-bar"><i /><i /><i /><span>app.wazlink.ai</span></div>
            <div className="product-dashboard-preview">
              <aside className="preview-sidebar"><div className="preview-brand"><img src={`${appConfig.assetBaseUrl}wazlink-mark.svg`} alt="" /><b>WazLink</b></div><span className="active">⌂ لوحة التحكم</span><span>◉ واتساب AI</span><span>⌖ سحب بيانات الخرائط</span><span>♙ CRM العملاء</span><span>◫ الحملات</span><span>▥ التقارير</span><small>منصة المبيعات الذكية</small></aside>
              <div className="preview-workspace"><header><span>الرئيسية</span><b>مرحبًا، أحمد</b><i>◔</i></header><div className="preview-welcome"><div><small>لوحة القيادة التنفيذية</small><h3>كل فرصك في مكان واحد</h3><p>من البحث إلى المحادثة ثم الصفقة.</p></div><div className="mini-map"><i>●</i><i>●</i><i>●</i><b>Google Maps</b></div></div><div className="preview-kpis"><div><span>العملاء المحتملون</span><b>1,248</b><small>+18% من الشهر السابق</small></div><div><span>المحادثات</span><b>8,650</b><small>معدل الرد 86%</small></div><div><span>الصفقات</span><b>342</b><small>+20% من الشهر السابق</small></div><div><span>الإيرادات</span><b>125,430</b><small>ر.س · هذا الشهر</small></div></div><div className="preview-lower"><div className="preview-chart"><div><b>أداء المبيعات</b><span>آخر 30 يومًا</span></div><svg viewBox="0 0 360 100" role="img" aria-label="رسم أداء المبيعات"><path d="M0 82 C40 65,50 78,80 58 S130 75,160 42 S210 55,240 28 S300 54,360 12" fill="none" stroke="#2563eb" strokeWidth="4" /><path d="M0 82 C40 65,50 78,80 58 S130 75,160 42 S210 55,240 28 S300 54,360 12 V100 H0Z" fill="url(#fill)" opacity=".2" /><defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#2563eb" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient></defs></svg></div><div className="preview-conversations"><b>محادثات واتساب الأخيرة</b><span>شركة النخبة <small>متابعة جديدة</small></span><span>مطعم الرياض <small>بانتظار الرد</small></span><span>عيادة الحياة <small>فرصة عالية</small></span></div></div></div>
            </div>
          </div>
        </section>

        <section className="value-strip"><div><b>+50K</b><span>شركة تستخدم المنصة</span></div><div><b>+2M</b><span>عميل محتمل تم اكتشافه</span></div><div><b>+10M</b><span>رسالة ومتابعة</span></div><div><b>+200%</b><span>تحسن محتمل في أداء فرق المبيعات</span></div></section>

        <section className="premium-section modules-section" id="uses"><div className="section-heading centered"><span className="premium-badge">منصة واحدة، نتائج متصلة</span><h2>كل ما تحتاجه لتنمية مبيعاتك في مكان واحد</h2><p>ثلاث قدرات قوية تعمل كرحلة واحدة — من اكتشاف الإشارة إلى قياس الإيراد.</p></div><div className="premium-module-grid"><article className="premium-module-card discover"><div className="module-visual maps-visual"><span>⌖</span><div><b>عيادات أسنان</b><small>الرياض · 24 نتيجة</small></div><i>92</i></div><small className="module-label">WazLink Discover</small><h3>اكتشاف العملاء المحتملين</h3><p>ابحث عن الشركات والعملاء المحتملين وحوّل بيانات السوق إلى فرص مبيعات قابلة للمتابعة.</p><button className="text-link" type="button" onClick={() => go("discovery")}>ابدأ الاكتشاف ←</button></article><article className="premium-module-card crm"><div className="module-visual kanban-visual"><span>جديد <b>24</b></span><span>مؤهل <b>12</b></span><span>صفقة <b>6</b></span></div><small className="module-label">WazLink CRM</small><h3>إدارة العملاء ومسار المبيعات</h3><p>حوّل النتائج إلى Leads، وزّعها على فريقك، وتابع الفرص والصفقات من مكان واحد.</p><button className="text-link" type="button" onClick={() => go("crm")}>افتح CRM ←</button></article><article className="premium-module-card ai"><div className="module-visual ai-visual"><span>واتساب</span><b>أرسل متابعة قصيرة تتضمن رابط الحجز</b><small>مقترح من مساعد المبيعات · مراجعة بشرية</small></div><small className="module-label">WazLink AI</small><h3>واتساب ومساعد المبيعات الذكي</h3><p>اجمع المحادثات في Inbox واحد واستخدم الذكاء الاصطناعي لفهم السياق واقتراح الخطوة التالية.</p><button className="text-link" type="button" onClick={() => go("inbox")}>افتح صندوق الوارد ←</button></article></div></section>

        <section className="premium-section journey-section" id="workflow"><div className="section-heading centered"><span className="premium-badge">رحلة مبيعات واحدة</span><h2>من أول بحث إلى أول ريال إيراد</h2><p>كل خطوة تحمل سياقها وتمنح فريقك إجراءً واضحًا بعدها.</p></div><div className="premium-journey">{journey.map(([number, title, detail], index) => <div className="journey-step" key={number}><span>{number}</span><b>{title}</b><small>{detail}</small>{index < journey.length - 1 ? <i>←</i> : null}</div>)}</div></section>

        <section className="premium-section showcase-section"><div className="showcase-copy"><span className="premium-badge">WazLink Discover</span><h2>لا تبحث عن أسماء فقط<br /><em>ابحث عن فرص بيع</em></h2><p>كل شركة تظهر كسجل قابل للفهم، مع درجة الفرصة والأدلة والإجراء التالي — لا كسطر معزول في ملف.</p><button className="button primary" type="button" onClick={() => go("discovery")}>ابدأ الاكتشاف</button></div><div className="discovery-product-card"><div className="search-bar">⌕ <span>عيادات أسنان | الرياض</span><b>بحث</b></div><div className="business-result"><div className="result-top"><div className="result-avatar">ع</div><div><b>{businessName}</b><small>⌖ {businessCity} · Google Maps</small></div><strong>{arabicNumber(score)}<small>/100</small></strong></div><div className="result-stats"><span>التقييم <b>4.7</b></span><span>المراجعات <b>863</b></span><span>الثقة <b>{arabicNumber(confidence)}%</b></span></div><div className="signal-list">{businessReasons.map((reason) => <span key={reason}>✓ {reason}</span>)}</div><div className="opportunity-row"><small>الفرصة المقترحة</small><b>{businessServices}</b></div><button type="button" onClick={() => go("intelligence")}>تحليل العميل ←</button></div></div></section>

        <section className="premium-section context-section"><div className="section-heading centered"><span className="premium-badge">سياق متصل</span><h2>لا تفقد سياق العميل بعد الاكتشاف</h2><p>تتحرك نفس الهوية من الشركة إلى العميل المحتمل والمحادثة والصفقة ثم الإيراد.</p></div><div className="context-flow"><div><span>⌖</span><b>شركة</b><small>إشارة ومصدر</small></div><i>←</i><div><span>♙</span><b>عميل محتمل</b><small>درجة ومالك</small></div><i>←</i><div><span>◌</span><b>محادثة</b><small>سياق ومتابعة</small></div><i>←</i><div><span>◇</span><b>صفقة</b><small>قيمة واحتمال</small></div><i>←</i><div className="revenue-node"><span>ر.س</span><b>إيراد</b><small>قياس وإسناد</small></div></div></section>

        <section className="ai-premium-section" id="ai"><div className="ai-section-copy"><span className="premium-badge">WazLink AI</span><h2>مساعد مبيعات يفهم السياق<br /><em>قبل أن يقترح الخطوة التالية</em></h2><p>الذكاء الاصطناعي طبقة تحليل وقرار، وليس نافذة محادثة منفصلة. الإرسال يبقى بيد الإنسان.</p><div className="ai-actions"><button type="button" onClick={showDemo}>إدراج الاقتراح</button><button type="button" onClick={showDemo}>إنشاء مهمة</button><button type="button" onClick={showDemo}>تذكير بالمتابعة</button></div></div><div className="ai-workspace"><div className="ai-chat"><small>محادثة واتساب · عيادة الحياة</small><p className="customer-message">هل يمكنني معرفة مواعيد الحجز؟</p><p className="ai-message">العميل سأل عن الحجز مرتين ولم يكمل العملية.</p><div className="ai-recommendation"><span>اقتراح مساعد المبيعات</span><b>أرسل متابعة قصيرة تتضمن رابط الحجز واعرض المساعدة في اختيار الموعد.</b><small>مراجعة بشرية مطلوبة قبل الإرسال</small></div></div><div className="ai-context"><span>درجة الفرصة <b>{arabicNumber(score)}/100</b></span><span>حالة الصفقة <b>تحتاج متابعة</b></span><span>الإجراء التالي <b>مراجعة المسودة</b></span></div></div></section>

        <section className="premium-section analytics-section"><div className="section-heading"><span className="premium-badge">WazLink Analytics</span><h2>اعرف أين تتحول الفرص إلى إيراد</h2><p>قراراتك مبنية على القمع، مسار المبيعات، ومصدر العميل في سياق واحد.</p></div><div className="analytics-product-card"><div className="analytics-funnel">{[["مكتشف", stageCount("discovered", 1248)], ["مؤهل", stageCount("high", 420)], ["CRM Leads", stageCount("lead", 310)], ["تم التواصل", "١٨٥"], ["صفقة", stageCount("deal", 48)], ["رابحة", stageCount("won", 17)]].map(([label, value], index) => <div key={label} style={{"--funnel-width": `${100 - index * 10}%`} as CSSProperties}><i /><b>{value}</b><span>{label}</span></div>)}</div><div className="analytics-summary"><div><span>الإيراد المعترف به</span><b>{sarLabel(metrics.revenue.value)}</b></div><div><span>مسار المبيعات</span><b>{sarLabel(metrics.openPipeline.value)}</b></div><div><span>أفضل مصدر</span><b>Google Maps</b></div></div></div></section>

        <section className="premium-section customers-section" id="customers"><div className="section-heading centered"><span className="premium-badge">للشركات الطموحة</span><h2>مصممة للفرق التي تريد تحويل الإشارات إلى مبيعات</h2></div><div className="customer-grid">{targetCustomers.map((item, index) => <div key={item}><span>{["⌁", "♙", "▦", "✚", "⌘", "⌂", "✦"][index]}</span><b>{item}</b></div>)}</div></section>

        <section className="premium-section integrations-section"><div className="section-heading centered"><span className="premium-badge">تكاملات المنصة</span><h2>أدواتك تعمل ضمن رحلة واحدة</h2><p>الحالات الحالية واضحة: تجريبية أو مخططة أو متاحة داخل الواجهة.</p></div><div className="integration-grid">{integrations.map(([name, detail, status]) => <div key={name}><span>{name === "Google Maps" ? "⌖" : name === "WhatsApp" ? "◌" : name === "CRM" ? "♙" : "◇"}</span><b>{name}</b><small>{detail}</small><em>{status === "active" ? "متاح" : status === "mock" ? "تجريبي" : "مخطط"}</em></div>)}</div></section>

        <section className="final-cta" id="pricing"><div><span className="premium-badge">ابدأ رحلتك اليوم</span><h2>حوّل اكتشاف العملاء<br /><em>إلى عملية مبيعات قابلة للقياس</em></h2><p>ابدأ باكتشاف الفرص، ثم اجمع العملاء والمحادثات والصفقات في رحلة واحدة داخل WazLink.</p></div><div className="final-cta-actions"><button className="button primary" type="button" onClick={() => go("onboarding")}>ابدأ مجاناً</button><a className="button ghost" href="#platform">استكشف المنصة</a></div></section>
      </main>

      <footer className="premium-footer"><div className="footer-brand"><Brand /><p>منصة المبيعات الذكية التي تربط الإشارة بالصفقة.</p></div><div><b>المنتج</b><a href="#platform">المنصة</a><a href="#workflow">كيف تعمل</a><a href="#uses">الاستخدامات</a><a href="#ai">الذكاء الاصطناعي</a><a href="#pricing">الأسعار</a></div><div><b>الشركة</b><a href="#platform">عن WazLink</a><a href="#platform">التواصل</a><a href="#platform">الخصوصية</a><a href="#platform">الشروط</a></div><div><b>تقني</b><a href="#platform">API</a><a href="#platform">التكاملات</a><a href="#platform">التوثيق</a></div><small className="footer-note">واجهة تجريبية ببيانات محلية · لا توجد تكاملات إنتاجية مفعّلة</small></footer>
    </div>
  );
}

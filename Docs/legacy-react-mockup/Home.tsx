/**
 * Design reminder: "مدار سماوي" — calm editorial modernism, asymmetric work surface,
 * cyan only for flow/status, and non-coercive CRM choice after a usable Excel result.
 */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  CircleHelp,
  Clock3,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Filter,
  Globe2,
  Info,
  Link2,
  ListFilter,
  Loader2,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  UsersRound,
  X,
} from "lucide-react";

type Screen = "discover" | "results" | "choice" | "internal" | "external";
type JobStatus = "idle" | "running" | "complete";

type Lead = {
  id: number;
  company: string;
  category: string;
  city: string;
  phone: string;
  website: string;
  email: string;
  score: number;
  source: string;
};

const leads: Lead[] = [
  { id: 1, company: "آفاق للصيانة المنزلية", category: "صيانة منزلية", city: "الرياض", phone: "+966 11 240 8811", website: "afaq-service.sa", email: "hello@afaq-service.sa", score: 92, source: "موقع الشركة" },
  { id: 2, company: "دار التشغيل الذكي", category: "خدمات عقارية", city: "الرياض", phone: "+966 11 246 7312", website: "dar-smart.co", email: "info@dar-smart.co", score: 86, source: "دليل أعمال مرخّص" },
  { id: 3, company: "مدار الحلول التقنية", category: "تقنية معلومات", city: "الرياض", phone: "+966 55 318 0124", website: "madaar.io", email: "sales@madaar.io", score: 81, source: "موقع الشركة" },
  { id: 4, company: "أساس للنظافة المتكاملة", category: "خدمات منزلية", city: "الرياض", phone: "+966 11 256 9042", website: "asas-clean.sa", email: "contact@asas-clean.sa", score: 77, source: "دليل أعمال مرخّص" },
  { id: 5, company: "بداية للمقاولات", category: "مقاولات", city: "الرياض", phone: "+966 50 603 1901", website: "bedaya-build.com", email: "office@bedaya-build.com", score: 74, source: "موقع الشركة" },
  { id: 6, company: "وصل لخدمات الأعمال", category: "خدمات أعمال", city: "الرياض", phone: "+966 11 278 4220", website: "wasl-biz.sa", email: "team@wasl-biz.sa", score: 70, source: "دليل أعمال مرخّص" },
];

const steps = [
  { id: "discover", label: "بحث", detail: "حدد الشريحة" },
  { id: "results", label: "نتائج", detail: "راجع البيانات" },
  { id: "choice", label: "تسليم", detail: "اختر الوجهة" },
  { id: "internal", label: "متابعة", detail: "CRM اختياري" },
];

const screenOrder: Screen[] = ["discover", "results", "choice", "internal"];

export default function Home() {
  const [screen, setScreen] = useState<Screen>("discover");
  const [jobStatus, setJobStatus] = useState<JobStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [selected, setSelected] = useState<number[]>([1, 2, 3, 4]);
  const [query, setQuery] = useState("خدمات منزلية");
  const [location, setLocation] = useState("الرياض، السعودية");
  const [filterOpen, setFilterOpen] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [externalSystem, setExternalSystem] = useState("HubSpot");
  const [externalConnected, setExternalConnected] = useState(false);
  const [crmActivated, setCrmActivated] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const activeStep = useMemo(() => {
    if (screen === "external") return 2;
    return Math.max(0, screenOrder.indexOf(screen));
  }, [screen]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const runSearch = () => {
    setJobStatus("running");
    setProgress(10);
    setScreen("discover");
    const stages = [28, 49, 71, 92, 100];
    stages.forEach((value, index) => {
      window.setTimeout(() => {
        setProgress(value);
        if (value === 100) {
          setJobStatus("complete");
          setScreen("results");
          setToast("اكتمل تجهيز النتائج. يمكنك الآن مراجعتها أو تصديرها.");
        }
      }, (index + 1) * 520);
    });
  };

  const toggleLead = (id: number) => {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const selectAll = () => {
    setSelected(selected.length === leads.length ? [] : leads.map((lead) => lead.id));
  };

  const exportFile = () => {
    const csvRows = [
      ["اسم الشركة", "الفئة", "المدينة", "الهاتف", "الموقع", "البريد", "درجة التأهيل"],
      ...leads.filter((lead) => selected.includes(lead.id)).map((lead) => [lead.company, lead.category, lead.city, lead.phone, lead.website, lead.email, String(lead.score)]),
    ];
    const content = "\ufeff" + csvRows.map((row) => row.map((cell) => `\"${cell}\"`).join(",")).join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "leadflow-results-riyadh.csv";
    anchor.click();
    URL.revokeObjectURL(url);
    setShowExport(false);
    setToast(`تم تنزيل ملف منظم يحتوي على ${selected.length} سجلات مختارة.`);
  };

  const startInternalCrm = () => {
    setCrmActivated(true);
    setScreen("internal");
    setToast("تم تجهيز قائمتك داخل مساحة CRM التجريبية.");
  };

  const connectExternal = () => {
    setExternalConnected(true);
    setToast(`تم توصيل العرض التوضيحي مع ${externalSystem}. لم يتم إرسال بيانات فعلية.`);
  };

  return (
    <main dir="rtl" className="app-shell">
      <aside className="sidebar" aria-label="التنقل الرئيسي">
        <div className="brand-block">
          <img className="brand-mark" src="/manus-storage/leadflow-orbit-mark_f6c27956.png" alt="رمز نمو" />
          <div>
            <strong>نمو</strong>
            <span>lead flow</span>
          </div>
        </div>

        <nav className="side-nav">
          <button className={`nav-item ${screen === "discover" ? "active" : ""}`} onClick={() => setScreen("discover")}>
            <Search size={18} /> <span>اكتشاف العملاء</span>
          </button>
          <button className={`nav-item ${screen === "results" ? "active" : ""}`} onClick={() => setScreen("results")}>
            <FileSpreadsheet size={18} /> <span>النتائج والملفات</span>
            {jobStatus === "complete" && <i className="nav-dot" />}
          </button>
          <button className={`nav-item ${screen === "internal" ? "active" : ""}`} onClick={() => setScreen("internal")}>
            <UsersRound size={18} /> <span>CRM المنصة</span>
            <span className="nav-lock">اختياري</span>
          </button>
          <button className={`nav-item ${screen === "external" ? "active" : ""}`} onClick={() => setScreen("external")}>
            <Link2 size={18} /> <span>تكاملات CRM</span>
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="credit-card">
            <div className="credit-top"><span>رصيد الاستخراج</span><Sparkles size={16} /></div>
            <strong>1,240</strong>
            <small>نتيجة صالحة متاحة</small>
            <div className="credit-meter"><i /></div>
          </div>
          <button className="profile-row" onClick={() => setToast("إعدادات مساحة العمل قيد العرض.")}>
            <span className="avatar">م</span>
            <span><b>مكتب النمو</b><small>مساحة وكالة</small></span>
            <MoreHorizontal size={18} />
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="crumbs"><span>مساحة العمل</span><i>/</i><b>{screen === "discover" ? "اكتشاف العملاء" : screen === "results" ? "نتائج البحث" : screen === "choice" ? "تسليم النتائج" : screen === "internal" ? "CRM المنصة" : "CRM خارجي"}</b></div>
          <div className="top-actions">
            <button className="quiet-icon" aria-label="المساعدة" onClick={() => setToast("هذا نموذج تفاعلي لرحلة المنتج فقط.")}><CircleHelp size={19} /></button>
            <button className="quiet-icon" aria-label="إعدادات" onClick={() => setToast("إعدادات مصدر البيانات ستكون متاحة هنا.")}><Settings2 size={19} /></button>
            <button className="new-search" onClick={() => setScreen("discover")}><Plus size={17} /> بحث جديد</button>
            <div className="header-wordmark" aria-label="نمو">
              <img src="/manus-storage/leadflow-orbit-mark_f6c27956.png" alt="" />
              <span><b>نمو</b><small>lead flow</small></span>
            </div>
          </div>
        </header>

        <section className="journey-rail" aria-label="مراحل الرحلة">
          <div className="rail-copy">
            <span className="eyebrow">رحلة تشغيلية</span>
            <strong>بحث → نتائج → قرار</strong>
          </div>
          <div className="rail-orbit" aria-hidden="true"><i /><i /><i /></div>
          <div className="steps">
            {steps.map((step, index) => (
              <button key={step.id} className={`step ${index === activeStep ? "current" : ""} ${index < activeStep ? "done" : ""}`} onClick={() => {
                const target = index === 0 ? "discover" : index === 1 ? "results" : index === 2 ? "choice" : "internal";
                setScreen(target);
              }}>
                <span className="step-num">{index < activeStep ? <Check size={13} /> : index + 1}</span>
                <span><b>{step.label}</b><small>{step.detail}</small></span>
              </button>
            ))}
          </div>
        </section>

        {screen === "discover" && (
          <section className="page-content discover-page">
            <div className="discover-main">
              <div className="title-row">
                <div>
                  <span className="eyebrow">طلب استخراج جديد</span>
                  <h1>حدّد الشريحة. سنجهّز الملف للمراجعة.</h1>
                  <p>اختر الشركات والموقع. نرتب الحقول ونستبعد التكرار، ثم تقرر كيف وأين ستسلّم النتائج.</p>
                </div>
                <span className="policy-chip"><ShieldCheck size={16} /> مصدر معتمد</span>
              </div>

              <div className="search-composer">
                <div className="composer-head">
                  <div><span className="tiny-dot" /> بحث دليل الأعمال</div>
                  <button className="link-button" onClick={() => setToast("يمكنك رفع قائمة نطاقات في الإصدار الكامل.")}>لدي قائمة مواقع أصلًا <ArrowLeft size={15} /></button>
                </div>
                <label className="field-label">ما نوع الشركات التي تبحث عنها؟</label>
                <div className="query-input"><Search size={20} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="مثال: مكاتب محاماة أو خدمات منزلية" /><kbd>⌘ K</kbd></div>
                <div className="form-grid">
                  <div>
                    <label className="field-label">الموقع المستهدف</label>
                    <button className="select-button" onClick={() => setToast("اختيار مواقع متعددة متاح في النسخة الكاملة.")}><MapPin size={18} /><span>{location}</span><ChevronDown size={17} /></button>
                  </div>
                  <div>
                    <label className="field-label">حجم النتيجة</label>
                    <button className="select-button" onClick={() => setToast("الحد الحالي مضبوط على 100 نتيجة في هذا العرض.")}><UsersRound size={18} /><span>حتى 100 شركة</span><ChevronDown size={17} /></button>
                  </div>
                </div>
                <div className="field-label field-label-row"><span>الحقول المطلوبة</span><button onClick={() => setToast("إدارة الحقول ستكون متاحة ضمن إعدادات الطلب.")}>تعديل الحقول</button></div>
                <div className="field-chips">
                  {["اسم الشركة", "الهاتف", "الموقع الإلكتروني", "البريد المعلن", "المدينة", "درجة التأهيل"].map((field) => <span key={field}><Check size={13} />{field}</span>)}
                </div>
                <div className="metadata-line">
                  <span><ShieldCheck size={14} /> سياسة مصدر واضحة</span>
                  <span><BadgeCheck size={14} /> إثبات لكل حقل مهم</span>
                  <span><FileSpreadsheet size={14} /> تسليم Excel منظم</span>
                </div>
                <div className="composer-footer">
                  <span><Info size={16} /> يستهلك الرصيد من النتائج الصالحة فقط.</span>
                  <button className="primary-button" onClick={runSearch} disabled={jobStatus === "running"}>{jobStatus === "running" ? <><Loader2 className="spin" size={18} /> جارٍ التجهيز</> : <><Sparkles size={18} /> بدء البحث</>}</button>
                </div>
              </div>

              {jobStatus !== "idle" && (
                <div className={`job-progress ${jobStatus}`}>
                  <div className="job-icon">{jobStatus === "complete" ? <CheckCircle2 size={22} /> : <Loader2 className="spin" size={22} />}</div>
                  <div className="job-copy"><b>{jobStatus === "complete" ? "نتائجك جاهزة للمراجعة" : "نجمع وننظّم بيانات الشركات"}</b><span>{jobStatus === "complete" ? "تم تجهيز 84 نتيجة قابلة للاستخدام." : "نتحقق من المصدر، نطبع الحقول، ونزيل التكرار."}</span></div>
                  <div className="progress-numbers"><b>{progress}%</b><div><i style={{ width: `${progress}%` }} /></div></div>
                </div>
              )}
            </div>

            <aside className="discover-aside">
              <div className="visual-card hero-visual">
                <img src="/manus-storage/leadflow-hero-orbit_9b9fd8ca.jpg" alt="مسار بصري لبيانات الأعمال" />
                <div className="visual-overlay"><span>مسار منظم</span><b>ابحث. راجع. قرر.</b></div>
              </div>
              <div className="aside-note">
                <span className="note-icon"><FileSpreadsheet size={19} /></span>
                <div><b>ملف Excel قبل أي التزام</b><p>يمكنك تنزيل النتائج التي دفعت لاستخراجها، أو تختار بعدها طريقة المتابعة المناسبة.</p></div>
              </div>
              <div className="source-note"><ShieldCheck size={17} /><span>تعمل المنصة عبر مصادر معتمدة ومواقع عامة مسموح بها.</span></div>
            </aside>
          </section>
        )}

        {screen === "results" && (
          <section className="page-content results-page">
            <div className="title-row results-title">
              <div>
                <span className="eyebrow">اكتملت المهمة 24-2026</span>
                <h1>84 نتيجة جاهزة للعمل.</h1>
                <p>نتائج توضيحية مرتبة حسب اكتمال الملف ومدى ملاءمة الشريحة التي اخترتها.</p>
              </div>
              <div className="result-metrics"><span><b>84</b> نتيجة صالحة</span><span><b>71%</b> ملفات مكتملة</span><span><b>6</b> مكررات مستبعدة</span></div>
            </div>

            <div className="results-layout">
              <div className="results-main">
                <div className="table-toolbar">
                  <div className="toolbar-left"><button className="filter-button" onClick={() => setFilterOpen(!filterOpen)}><ListFilter size={17} /> فلترة <ChevronDown size={15} /></button><span>{selected.length} محددة</span></div>
                  <div className="toolbar-right"><button className="icon-text" onClick={() => setToast("تم تحديث النتائج في هذا العرض.")}><Clock3 size={16} /> آخر تحديث الآن</button><button className="icon-text" onClick={() => setShowExport(true)}><Download size={16} /> تصدير</button></div>
                  {filterOpen && <div className="filter-popover"><b>تصفية سريعة</b><label><input type="checkbox" defaultChecked /> بريد معلن</label><label><input type="checkbox" defaultChecked /> موقع إلكتروني</label><label><input type="checkbox" /> درجة أعلى من 80</label></div>}
                </div>
                <div className="data-table-wrap">
                  <table className="data-table">
                    <thead><tr><th><input type="checkbox" checked={selected.length === leads.length} onChange={selectAll} aria-label="تحديد الكل" /></th><th>الشركة</th><th>الاتصال</th><th>الموقع</th><th>المصدر</th><th>الملاءمة</th><th /></tr></thead>
                    <tbody>
                      {leads.map((lead) => <tr key={lead.id} className={selected.includes(lead.id) ? "selected-row" : ""}>
                        <td><input type="checkbox" checked={selected.includes(lead.id)} onChange={() => toggleLead(lead.id)} aria-label={`تحديد ${lead.company}`} /></td>
                        <td><div className="company-cell"><span className="company-icon">{lead.company.charAt(0)}</span><span><b>{lead.company}</b><small>{lead.category} · {lead.city}</small></span></div></td>
                        <td><span className="contact-cell"><b>{lead.phone}</b><small>{lead.email}</small></span></td>
                        <td><a href="#site" onClick={(event) => { event.preventDefault(); setToast(`رابط ${lead.website} توضيحي في هذا النموذج.`); }}><Globe2 size={14} />{lead.website}</a></td>
                        <td><span className="source-label"><CircleDot size={11} />{lead.source}</span></td>
                        <td><span className={`score score-${lead.score >= 85 ? "high" : lead.score >= 75 ? "mid" : "low"}`}>{lead.score}</span></td>
                        <td><button className="row-more" onClick={() => setToast(`تفاصيل ${lead.company} تظهر في بطاقة الإثبات.`)}><MoreHorizontal size={18} /></button></td>
                      </tr>)}
                    </tbody>
                  </table>
                </div>
              </div>
              <aside className="result-aside">
                <div className="proof-card">
                  <div className="proof-top"><span className="proof-icon"><BadgeCheck size={18} /></span><span>بطاقة إثبات الحقل</span></div>
                  <b>بيانات قابلة للمراجعة</b>
                  <p>لكل حقل مهم رابط مصدر وتاريخ جمع وحالة تحقق، قبل أن ينتقل إلى ملفك أو CRM.</p>
                  <div className="proof-meta"><span>المصدر <b>موقع الشركة</b></span><span>الجمع <b>اليوم، 10:42</b></span><span>الثقة <b className="cyan-text">مرتفعة</b></span></div>
                </div>
                <div className="mini-visual"><img src="/manus-storage/leadflow-extract-visual_0020f86c.jpg" alt="رسم تجريدي لاستخراج البيانات" /></div>
                <button className="wide-primary" onClick={() => setScreen("choice")}><ArrowLeft size={18} /> متابعة مع النتائج المحددة</button>
                <button className="wide-quiet" onClick={() => setShowExport(true)}><FileSpreadsheet size={18} /> تنزيل Excel مباشرة</button>
              </aside>
            </div>
          </section>
        )}

        {screen === "choice" && (
          <section className="page-content choice-page">
            <div className="choice-hero">
              <div><span className="eyebrow">اختيارك بعد النتيجة</span><h1>أين تريد أن تعمل بهذه السجلات؟</h1><p>جهّزنا {selected.length || 4} سجلات مختارة. تنزيل الملف متاح دائمًا، واختر CRMك عندما تحتاج للمتابعة.</p></div>
              <div className="choice-stats"><FileSpreadsheet size={22} /><span><b>{selected.length || 4}</b> سجلات جاهزة</span></div>
            </div>
            <div className="choice-grid">
              <article className="choice-card excel-card">
                <div className="choice-icon"><FileSpreadsheet size={25} /></div>
                <span className="choice-kicker">الخيار الأول</span><h2>تنزيل ملف Excel</h2><p>احصل على ملف نظيف ومنظم، واختر الأعمدة التي تريد تضمينها قبل التنزيل.</p>
                <ul><li><Check size={15} /> ملف متوافق مع Excel وCSV</li><li><Check size={15} /> لا يتطلب اشتراك CRM</li><li><Check size={15} /> يحتفظ بمصدر الحقل عند الحاجة</li></ul>
                <button className="choice-button dark" onClick={() => setShowExport(true)}>تنزيل الملف <ArrowDownToLine size={18} /></button>
              </article>
              <article className="choice-card crm-card">
                <img src="/manus-storage/leadflow-crm-visual_94c840c7.jpg" alt="رسم تجريدي لمساحة CRM" />
                <div className="choice-card-content"><div className="choice-icon cyan"><UsersRound size={25} /></div><span className="choice-kicker">ترقية اختيارية</span><h2>ابدأ CRM المنصة</h2><p>انقل السجلات إلى قائمة وقمع ومهام متابعة، من دون إعادة رفع ملف أو دفع تكلفة الاستخراج مرة أخرى.</p><ul><li><Check size={15} /> قوائم ومراحل متابعة</li><li><Check size={15} /> توزيع المهام على الفريق</li><li><Check size={15} /> تجربة توضيحية للـCRM</li></ul><button className="choice-button cyan-button" onClick={startInternalCrm}>استخدم CRM المنصة <ArrowLeft size={18} /></button></div>
              </article>
              <article className="choice-card external-card">
                <div className="choice-icon outline"><Link2 size={25} /></div>
                <span className="choice-kicker">لنظامك الحالي</span><h2>إرسال إلى CRM خارجي</h2><p>ابدأ بقالب ملف متوافق أو جهّز ربطًا مباشرًا مع النظام الذي تستخدمه.</p>
                <ul><li><Check size={15} /> قوالب استيراد مخصصة</li><li><Check size={15} /> مطابقة الحقول قبل الإرسال</li><li><Check size={15} /> تقرير حالة لكل دفعة</li></ul>
                <button className="choice-button outline-button" onClick={() => setScreen("external")}>اختر CRM خارجيًا <ArrowLeft size={18} /></button>
              </article>
            </div>
            <div className="decision-note"><img src="/manus-storage/leadflow-decision-visual_e23453d1.jpg" alt="رسم تجريدي لتفرع قرار وجهة البيانات" /><div><b>البيانات لك، والاختيار لك.</b><p>لا نحجب الملف خلف اشتراك. CRM المنصة يظهر فقط حين تريد تحويل النتائج إلى متابعة مستمرة.</p></div></div>
          </section>
        )}

        {screen === "internal" && (
          <section className="page-content crm-page">
            <div className="crm-heading"><div><span className="eyebrow">CRM المنصة · تجربة توضيحية</span><h1>{crmActivated ? "قائمتك جاهزة للفريق." : "حوّل النتائج إلى متابعة منظمة."}</h1><p>{crmActivated ? "تم وضع السجلات المختارة في قائمة متابعة الرياض مع توزيع أولي للمهام." : "يمكنك الترقية عند الحاجة فقط. لن تعيد رفع ملفك أو تدفع تكلفة الاستخراج مرة أخرى."}</p></div><button className="secondary-button" onClick={() => setScreen("choice")}><ArrowUpRight size={17} /> الرجوع لخيارات التسليم</button></div>
            <div className="crm-overview">
              <div className="crm-launch-card"><span className="launch-orbit"><UsersRound size={28} /></span><div><b>{crmActivated ? "قائمة: خدمات الرياض — مارس" : "الـCRM اختياري، لا يوقف تنزيل Excel"}</b><p>{crmActivated ? `${selected.length || 4} سجلات نُقلت من نتائج البحث مع المصدر والدرجة.` : "ابدأ تجربة مساحة العمل عند رغبتك في تشغيل المتابعة داخل المنصة."}</p></div>{!crmActivated && <button className="primary-button" onClick={startInternalCrm}>تفعيل التجربة <ArrowLeft size={17} /></button>}</div>
              <div className="pipeline-card"><div className="pipeline-head"><b>قمع المتابعة</b><span>هذا الأسبوع</span></div><div className="pipeline-columns"><div><span>جديد</span><b>{crmActivated ? selected.length || 4 : 0}</b><i className="bar one" /></div><div><span>قيد المراجعة</span><b>2</b><i className="bar two" /></div><div><span>تم التواصل</span><b>0</b><i className="bar three" /></div></div></div>
            </div>
            <div className="crm-workspace">
              <div className="crm-list"><div className="list-head"><b>قائمة العملاء المحتملين</b><span><CircleDot size={12} /> مزامنة من نتيجة البحث</span></div>{leads.slice(0, 4).map((lead) => <div className="crm-lead" key={`crm-${lead.id}`}><span className="company-icon">{lead.company.charAt(0)}</span><span><b>{lead.company}</b><small>{lead.category} · {lead.city}</small></span><span className="lead-stage">جديد</span><button onClick={() => setToast(`تم فتح ملف ${lead.company} في العرض التوضيحي.`)}><ArrowLeft size={16} /></button></div>)}</div>
              <div className="tasks-card"><div className="list-head"><b>مهمة المتابعة التالية</b><span className="task-date">اليوم</span></div><div className="task-feature"><span className="task-check"><Check /></span><div><b>راجع الشركة الأولى قبل التواصل</b><p>تأكد من ملاءمة العرض وسياق الاتصال.</p></div></div><button className="wide-quiet" onClick={() => setToast("تم إنشاء مهمة متابعة توضيحية.")}><Plus size={17} /> إضافة مهمة</button></div>
            </div>
          </section>
        )}

        {screen === "external" && (
          <section className="page-content external-page">
            <div className="crm-heading"><div><span className="eyebrow">وجهة خارجية</span><h1>استخدم CRM الذي تعرفه بالفعل.</h1><p>ابدأ بملف متوافق، أو جرّب الربط المباشر عندما يكون الموصل متاحًا.</p></div><button className="secondary-button" onClick={() => setShowExport(true)}><Download size={17} /> تنزيل قالب Excel</button></div>
            <div className="external-layout">
              <div className="connector-card">
                <div className="connector-top"><span className="choice-icon outline"><Link2 size={22} /></span><span className={`connection-status ${externalConnected ? "on" : ""}`}>{externalConnected ? <><CheckCircle2 size={15} /> متصل للعرض</> : <><CircleDot size={15} /> غير متصل</>}</span></div>
                <h2>اختر وجهة السجلات</h2><p>تظهر هنا موصلات CRM المتاحة لمساحة العمل. لا يجري إرسال فعلي في هذا النموذج.</p>
                <label className="field-label">نظام CRM</label>
                <select value={externalSystem} onChange={(event) => { setExternalSystem(event.target.value); setExternalConnected(false); }}><option>HubSpot</option><option>Zoho CRM</option><option>Salesforce</option><option>قالب CSV عام</option></select>
                <div className="mapping-preview"><div><b>مطابقة الحقول</b><span>6 حقول جاهزة</span></div><p>اسم الشركة → Company<br />البريد → Email<br />الهاتف → Phone<br />المصدر → Lead source</p></div>
                <button className="primary-button wide" onClick={connectExternal}>{externalConnected ? <><Check size={18} /> جاهز لإرسال المحدد</> : <><Link2 size={18} /> توصيل {externalSystem}</>}</button>
              </div>
              <div className="delivery-card">
                <img src="/manus-storage/leadflow-decision-visual_e23453d1.jpg" alt="تصور مسار إرسال البيانات" />
                <div className="delivery-content"><span className="eyebrow">تسليم مضبوط</span><h2>راجع قبل أن ترسل.</h2><p>يُظهر التقرير ما نُقل، وما يحتاج مراجعة، وما تم استبعاده بسبب التكرار.</p><div className="delivery-rows"><span><CheckCircle2 size={16} /> {selected.length || 4} سجلات جاهزة</span><span><ShieldCheck size={16} /> المصدر محفوظ</span><span><Filter size={16} /> مطابقة حقول مسبقة</span></div>{externalConnected && <button className="wide-quiet" onClick={() => setToast(`تمت محاكاة إرسال ${selected.length || 4} سجلات إلى ${externalSystem}.`)}><Send size={17} /> إرسال الدفعة التوضيحية</button>}</div>
              </div>
            </div>
          </section>
        )}
      </section>

      {showExport && <div className="modal-backdrop" role="presentation" onMouseDown={() => setShowExport(false)}><section className="export-modal" role="dialog" aria-modal="true" aria-label="تصدير النتائج" onMouseDown={(event) => event.stopPropagation()}><button className="modal-close" onClick={() => setShowExport(false)} aria-label="إغلاق"><X size={19} /></button><span className="modal-icon"><FileSpreadsheet size={24} /></span><span className="eyebrow">تصدير منظم</span><h2>حمّل ملف نتائجك</h2><p>سيتضمن الملف {selected.length || 0} سجلات محددة مع حقول الاتصال والموقع والدرجة والمصدر.</p><div className="export-fields"><span><Check size={14} /> اسم الشركة</span><span><Check size={14} /> بيانات الاتصال</span><span><Check size={14} /> الموقع والمدينة</span><span><Check size={14} /> مصدر الحقل</span></div><button className="primary-button wide" onClick={exportFile}><Download size={18} /> تنزيل ملف CSV المتوافق مع Excel</button><button className="modal-secondary" onClick={() => { setShowExport(false); setScreen("choice"); }}>أريد اختيار وجهة CRM بدلًا من ذلك</button></section></div>}
      {toast && <div className="toast"><CheckCircle2 size={18} /><span>{toast}</span><button onClick={() => setToast(null)}><X size={16} /></button></div>}
    </main>
  );
}

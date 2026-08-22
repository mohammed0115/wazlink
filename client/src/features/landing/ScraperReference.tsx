/**
 * سيناريو الاستخراج المرجعي — REFERENCE-ALIGNMENT.
 *
 * يستلهم تسلسل تجربة أدوات استخراج الشركات (استعلام → تشغيل → نتائج → تصدير)
 * بلغة «نمو» ونظام تصميمها. لا Google Maps API ولا scraping ولا credits حقيقية.
 */
import { useState } from "react";
import { state } from "@domain/data.js";
import { go } from "../../shared/router/useHashRoute";
import { notifyStateChanged } from "../../shared/store/appStore";
import { useToast } from "../../shared/store/toast";

const sampleLines = "عيادات أسنان | الرياض\nمراكز علاج طبيعي | جدة\nمراكز عناية | الخبر";

export function ScraperReferenceHero() {
  return (
    <section className="reference-scraper-hero" aria-label="سيناريو استخراج الشركات">
      <div className="reference-scraper-copy">
        <p className="eyebrow">الخطوة ١ · باقة Scraper</p>
        <h2>اكتب ما تبحث عنه، سطر لكل بحث</h2>
        <p>ابدأ هنا فقط: جهّز استعلاماتك. قرار Excel أو CRM سيأتي لاحقًا بعد أن ترى النتائج.</p>
        <ul>
          <li>استعلامات متعددة في عملية واحدة</li>
          <li>تقدم ونتائج قابلة للتتبع</li>
          <li>هاتف وبريد وموقع وروابط اجتماعية عند التوفر</li>
        </ul>
      </div>
      <div className="reference-query-console">
        <div className="reference-console-head">
          <span>استعلامات الاستخراج</span>
          <b>3 / 100</b>
        </div>
        <textarea dir="rtl" readOnly value={sampleLines} aria-label="أمثلة الاستعلامات" />
        <div className="reference-console-footer">
          <span>
            <i />
            رصيد تجريبي متاح
          </span>
          <button type="button" className="button primary" onClick={() => go("discovery")}>
            التالي: ابدأ الاستخراج
          </button>
        </div>
        <small>بعد النتائج فقط ستختار تنزيل Excel أو تفعيل CRM نمو.</small>
      </div>
    </section>
  );
}

/** نسخة مساحة الاكتشاف — تحوّل الأسطر إلى كلمات ومواقع داخل مسودة العملية. */
export function ScraperReferenceImport() {
  const toast = useToast();
  const [value, setValue] = useState(sampleLines);

  function importQueries() {
    const lines = value.split(/\n+/).map((line) => line.trim()).filter(Boolean);
    const parsed = lines
      .map((line) => line.split("|").map((piece) => piece.trim()))
      .filter(([keyword, location]) => keyword && location);

    if (!parsed.length) {
      toast("اكتب استعلامًا واحدًا على الأقل بالشكل: نشاط | مدينة.", "error");
      return;
    }

    for (const [keyword, location] of parsed) {
      if (!state.discoveryDraft.keywords.includes(keyword)) state.discoveryDraft.keywords.push(keyword);
      if (!state.discoveryDraft.locations.includes(location)) state.discoveryDraft.locations.push(location);
    }

    toast(`أُضيفت ${parsed.length} استعلامات محلية إلى عملية الاكتشاف.`, "success");
    notifyStateChanged();
  }

  return (
    <section className="reference-discovery-import" aria-label="إدخال استعلامات الاستخراج">
      <header>
        <div>
          <p className="eyebrow">الخطوة ١ من ٤ · الاستخراج</p>
          <h3>أضف استعلاماتك ثم شغّل عملية واحدة</h3>
          <p>
            اكتب النشاط والمدينة بينهما <b>|</b>؛ ستتحول إلى كلمات ومواقع ضمن عملية واحدة قابلة للمتابعة.
          </p>
        </div>
        <span className="reference-flow-badge">١ استخراج · ٢ نتائج · ٣ اختيار · ٤ تفعيل</span>
      </header>
      <textarea dir="rtl" aria-label="استعلامات متعددة" value={value} onChange={(event) => setValue(event.target.value)} />
      <footer>
        <small>الخطوة التالية بعد الإضافة: شغّل الاكتشاف، ثم راجع النتائج قبل أي قرار باقة.</small>
        <button type="button" className="button primary" onClick={importQueries}>
          إضافة الاستعلامات ثم التشغيل
        </button>
      </footer>
    </section>
  );
}

import { discoveryService } from "@services";
/**
 * اكتشاف العملاء — S3.
 *
 * منقولة عن `renderDiscovery()` بنفس الترميز والنصوص. تنشئ Job محليًا
 * من الكلمات والمواقع والفلاتر. لا Google Maps ولا Scraping ولا مصدر خارجي،
 * ولا تنشئ Lead أو Score أو CRM.
 */
import { useRef, useState, type FormEvent } from "react";
import { createDiscoveryJob, discoverySourceOptions, getDiscoveryDraftSnapshot } from "@services";
import { go } from "../../shared/router/useHashRoute";
import { useToast } from "../../shared/store/toast";
import { runDiscoverySimulation } from "./simulation";
import { PageHead } from "../../shared/components/PageHead";
import { ScraperReferenceImport } from "../landing/ScraperReference";
import { fmt } from "./shared";

type ChipType = "keyword" | "location";

function ChipList({ items, type, onRemove }: { items: string[]; type: ChipType; onRemove: (item: string) => void }) {
  const key = type === "keyword" ? "keywords" : "locations";
  return (
    <div className="discovery-chip-list" aria-label={type === "keyword" ? "الكلمات المختارة" : "المواقع المختارة"}>
      {items.map((item) => (
        <span className="chip selected" key={item}>
          <span>{item}</span>
          <button
            type="button"
            aria-label={`حذف ${item}`}
            onClick={() => onRemove(item)}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}

type DiscoveryDraft = ReturnType<typeof getDiscoveryDraftSnapshot>;

function CombinationsPreview({ draft, onToggle }: { draft: DiscoveryDraft; onToggle: () => void }) {
  const combinations = discoveryService.getDiscoveryCombinations(draft.keywords, draft.locations);
  const visible = draft.showCombinations ? combinations : combinations.slice(0, 4);

  return (
    <section className="discovery-combinations" aria-live="polite">
      <div>
        <span>معاينة مجموعات البحث</span>
        <b>{fmt(combinations.length)} مجموعة بحث</b>
      </div>
      {combinations.length ? (
        <ul>
          {visible.map((item: { keyword: string; location: string }) => (
            <li key={`${item.keyword}|${item.location}`}>
              <span>{item.keyword}</span>
              <i>×</i>
              <span>{item.location}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>أضف كلمة وموقعًا واحدًا على الأقل لعرض مجموعات البحث.</p>
      )}
      {combinations.length > 4 && (
        <button
          type="button"
          className="button ghost inline-button"
          onClick={onToggle}
        >
          {draft.showCombinations ? "إخفاء التفاصيل" : "عرض التفاصيل"}
        </button>
      )}
    </section>
  );
}

const availabilityFields: [string, string][] = [
  ["phone", "لديه رقم هاتف"],
  ["email", "لديه بريد إلكتروني"],
  ["whatsapp", "لديه WhatsApp"],
  ["instagram", "لديه Instagram"],
];

function AdvancedFilters({ filters }: { filters: Record<string, string | boolean> }) {
  return (
    <details className="advanced-filters">
      <summary>
        <span>
          <b>فلاتر متقدمة</b>
          <small>اختيارية وتطبق محليًا على سيناريو العرض</small>
        </span>
        <i>⌄</i>
      </summary>
      <div className="advanced-filter-grid">
        <div className="form-field">
          <label htmlFor="minRating">التقييم الأدنى</label>
          <select id="minRating" name="minRating" defaultValue={String(filters.minRating)}>
            <option value="any">أي تقييم</option>
            <option value="4">4.0+</option>
            <option value="4.5">4.5+</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="minReviews">عدد المراجعات</label>
          <select id="minReviews" name="minReviews" defaultValue={String(filters.minReviews)}>
            <option value="any">أي عدد</option>
            <option value="50">50+</option>
            <option value="100">100+</option>
            <option value="500">500+</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="website">الموقع الإلكتروني</label>
          <select id="website" name="website" defaultValue={String(filters.website)}>
            <option value="any">أي حالة</option>
            <option value="yes">لديه موقع</option>
            <option value="no">بدون موقع</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="activity">حالة النشاط</label>
          <select id="activity" name="activity" defaultValue={String(filters.activity)}>
            <option value="any">أي حالة</option>
            <option value="active">نشط</option>
            <option value="open">مفتوح الآن</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="limit">الحد الأقصى للنتائج</label>
          <select id="limit" name="limit" defaultValue={String(filters.limit)}>
            <option value="500">500 نتيجة</option>
            <option value="1000">1,000 نتيجة</option>
            <option value="2000">2,000 نتيجة</option>
          </select>
        </div>
        <fieldset className="discovery-availability">
          <legend>معلومات متاحة</legend>
          {availabilityFields.map(([key, label]) => (
            <label className="check" key={key}>
              <input type="checkbox" name={key} defaultChecked={Boolean(filters[key])} /> {label}
            </label>
          ))}
        </fieldset>
      </div>
    </details>
  );
}

export function Discovery() {
  const toast = useToast();
  const keywordInput = useRef<HTMLInputElement>(null);
  const locationInput = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<DiscoveryDraft>(() => getDiscoveryDraftSnapshot());
  const hasValues = Boolean(draft.keywords.length && draft.locations.length);

  function addItem(type: ChipType) {
    const input = type === "keyword" ? keywordInput.current : locationInput.current;
    const value = input?.value.trim();
    const key = type === "keyword" ? "keywords" : "locations";
    if (!value) {
      toast(`أدخل ${type === "keyword" ? "كلمة مفتاحية" : "موقعًا"} لإضافته.`, "error");
      return;
    }
    if (!draft[key].includes(value)) {
      setDraft((current) => ({ ...current, [key]: [...current[key], value] }));
    }
    if (input) input.value = "";
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const filters = {
      ...draft.filters,
      minRating: String(data.get("minRating") || "any"),
      minReviews: String(data.get("minReviews") || "any"),
      website: String(data.get("website") || "any"),
      activity: String(data.get("activity") || "any"),
      limit: String(data.get("limit") || "2000"),
      phone: data.get("phone") === "on",
      email: data.get("email") === "on",
      whatsapp: data.get("whatsapp") === "on",
      instagram: data.get("instagram") === "on",
    };
    const nextDraft = {
      ...draft,
      filters,
      sourceId: String(data.get("sourceId") || draft.sourceId),
    };
    setDraft(nextDraft);

    if (!draft.keywords.length || !draft.locations.length) {
      toast("أضف كلمة مفتاحية وموقعًا واحدًا على الأقل قبل بدء الاكتشاف.", "error");
      return;
    }

    const job = discoveryService.createDiscoveryJob({ keywords: draft.keywords, locations: draft.locations, sourceId: draft.sourceId, filters });
    runDiscoverySimulation(job.id, (id) => toast(`اكتملت العملية ${id} ببيانات تجريبية ثابتة.`, "success"));
    go(`discovery/jobs/${job.id}`);
  }

  return (
    <>
      <PageHead
        kicker="مساحة الاكتشاف"
        title="اكتشاف العملاء"
        description="حدد نوع الشركات والمواقع والمعايير التي تبحث عنها، وسننشئ عملية اكتشاف قابلة للمتابعة."
        actions={
          <button className="button" type="button" onClick={() => go("discovery/jobs")}>
            عمليات الاكتشاف
          </button>
        }
      />

      <div className="prototype-notice discovery-notice">
        <b>محاكاة بيانات</b>
        <span>
          لا تتصل هذه التجربة بـGoogle Maps أو أي مصدر خارجي. تُنشئ العملية بيانات ثابتة لغرض تجربة المنتج فقط.
        </span>
      </div>

      <section className="discovery-workspace">
        <article className="card discovery-form-card">
          <header className="card-head">
            <div>
              <h2>إعداد عملية اكتشاف</h2>
              <p>اجمع كلمات ومواقع متعددة في عملية واحدة قابلة للتتبع.</p>
            </div>
            <span className="pill">
              <i />
              Prototype محلي
            </span>
          </header>

          <ScraperReferenceImport />

          <form noValidate onSubmit={handleSubmit}>
            <div className="discovery-field-stack">
              <div className="form-field">
                <label htmlFor="discoveryKeywordInput">الكلمة المفتاحية أو النشاط</label>
                <div className="discovery-entry-row">
                  <input
                    id="discoveryKeywordInput"
                    ref={keywordInput}
                    placeholder="مثال: عيادات أسنان"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addItem("keyword");
                      }
                    }}
                  />
                  <button className="button" type="button" onClick={() => addItem("keyword")}>
                    إضافة
                  </button>
                </div>
                <ChipList
                  items={draft.keywords}
                  type="keyword"
                  onRemove={(item) => setDraft((current) => ({ ...current, keywords: current.keywords.filter((value) => value !== item) }))}
                />
                <small className="field-helper">يمكنك إضافة أكثر من كلمة؛ كل كلمة ستقترن بكل موقع محدد.</small>
              </div>

              <div className="form-field">
                <label htmlFor="discoveryLocationInput">الموقع</label>
                <div className="discovery-entry-row">
                  <input
                    id="discoveryLocationInput"
                    ref={locationInput}
                    placeholder="مثال: الرياض"
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addItem("location");
                      }
                    }}
                  />
                  <button className="button" type="button" onClick={() => addItem("location")}>
                    إضافة
                  </button>
                </div>
                <ChipList
                  items={draft.locations}
                  type="location"
                  onRemove={(item) => setDraft((current) => ({ ...current, locations: current.locations.filter((value) => value !== item) }))}
                />
                <small className="field-helper">يمكنك إضافة مدينة أو نطاق جغرافي واحد في كل مرة.</small>
              </div>

              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="discoverySource">المصدر</label>
                  <select id="discoverySource" name="sourceId" defaultValue={draft.sourceId}>
                    {discoverySourceOptions.map((source: { id: string; name: string; status: string }) => (
                      <option value={source.id} key={source.id}>
                        {source.name}
                        {source.status === "mock" ? " — محاكاة" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>نطاق التنفيذ</label>
                  <div className="discovery-readonly">
                    <b>{fmt(draft.keywords.length)} كلمات</b>
                    <i>×</i>
                    <b>{fmt(draft.locations.length)} مواقع</b>
                    <span>= {fmt(draft.keywords.length * draft.locations.length)} مجموعات</span>
                  </div>
                </div>
              </div>
            </div>

            <CombinationsPreview
              draft={draft}
              onToggle={() => setDraft((current) => ({ ...current, showCombinations: !current.showCombinations }))}
            />
            <AdvancedFilters filters={draft.filters} />

            <footer className="discovery-form-footer">
              <p>
                {hasValues ? (
                  <>
                    سيتم إنشاء <b>{fmt(draft.keywords.length * draft.locations.length)} مجموعة بحث</b> ضمن عملية واحدة.
                  </>
                ) : (
                  "أضف كلمة وموقعًا واحدًا على الأقل لبدء العملية."
                )}
              </p>
              <button className="button primary" type="submit">
                بدء الاكتشاف
              </button>
            </footer>
          </form>
        </article>

        <aside className="discovery-context">
          <article className="card pad">
            <p className="eyebrow">مسار S3</p>
            <h2>من الطلب إلى النتائج</h2>
            <ol className="discovery-flow-list">
              <li>
                <i>1</i>
                <div>
                  <b>إعداد البحث</b>
                  <small>الكلمات والمواقع والفلاتر</small>
                </div>
              </li>
              <li>
                <i>2</i>
                <div>
                  <b>عملية اكتشاف</b>
                  <small>حالة وتقدم يمكن متابعتهما</small>
                </div>
              </li>
              <li>
                <i>3</i>
                <div>
                  <b>شركات مكتشفة</b>
                  <small>نتائج مرتبطة بالعملية والمصدر</small>
                </div>
              </li>
            </ol>
          </article>
          <article className="card pad">
            <p className="eyebrow">ماذا لا يحدث الآن؟</p>
            <p className="muted">لا يتم تشغيل Scraping أو Enrichment أو AI أو CRM. هذه الوظائف خارج نطاق S3.</p>
          </article>
        </aside>
      </section>
    </>
  );
}

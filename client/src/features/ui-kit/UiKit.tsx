/**
 * مكتبة الواجهة الداخلية — S0.
 * منقولة حرفيًا عن `renderUiKit()` بنفس الأصناف والنصوص والحالات.
 */
import { go } from "../../shared/router/useHashRoute";
import { useToast } from "../../shared/store/toast";
import { PageHead } from "../../shared/components/PageHead";

export function UiKit() {
  const toast = useToast();
  const demo = () => toast("هذا عنصر مرجعي داخل مكتبة الواجهة.");

  return (
    <>
      <PageHead
        kicker="نظام التصميم"
        title="مكتبة الواجهة الداخلية"
        description="مرجع S0 لمراجعة المكونات والحالات قبل تنفيذ الشحنات اللاحقة."
        actions={
          <button className="button" type="button" onClick={() => go("dashboard")}>
            العودة للرئيسية
          </button>
        }
      />

      <section className="ui-kit-grid">
        <article className="card pad">
          <p className="eyebrow">الأزرار</p>
          <h2>إجراءات متسقة</h2>
          <div className="component-row">
            <button className="button primary" type="button" onClick={demo}>إجراء رئيسي</button>
            <button className="button" type="button" onClick={demo}>إجراء ثانوي</button>
            <button className="button ghost" type="button" onClick={demo}>إجراء نصي</button>
          </div>
        </article>

        <article className="card pad">
          <p className="eyebrow">الحالة</p>
          <h2>ألوان دلالية فقط</h2>
          <div className="component-row">
            <span className="status qualified">مكتمل</span>
            <span className="status contact">قيد المتابعة</span>
            <span className="status pending">بانتظار</span>
            <span className="status danger">متأخر</span>
          </div>
        </article>

        <article className="card pad">
          <p className="eyebrow">الإدخال</p>
          <h2>حقول ومرشحات</h2>
          <div className="ui-form">
            <label>
              اسم الشركة
              <input defaultValue="عيادات الحياة لطب الأسنان" />
            </label>
            <label>
              القطاع
              <select defaultValue="عيادات أسنان">
                <option>عيادات أسنان</option>
                <option>خدمات أعمال</option>
              </select>
            </label>
          </div>
        </article>

        <article className="card pad">
          <p className="eyebrow">البيانات</p>
          <h2>مؤشر العميل</h2>
          <div className="entity-sample">
            <span className="avatar">ح</span>
            <div>
              <b>عيادات الحياة لطب الأسنان</b>
              <small className="mono">BUS-1042</small>
            </div>
            <span className="score high">92</span>
          </div>
        </article>

        <article className="card pad">
          <p className="eyebrow">التحميل</p>
          <h2>حالة معالجة</h2>
          <div className="progress-sample">
            <div>
              <span>تجهيز قائمة النتائج</span>
              <b>68%</b>
            </div>
            <i>
              <b />
            </i>
          </div>
        </article>

        <article className="card pad">
          <p className="eyebrow">توصية ذكية</p>
          <h2>خطوة مقترحة</h2>
          <div className="recommendation">
            <span>توصية</span>
            <b>راجع سجل الحجز قبل إرسال المتابعة.</b>
            <small>الثقة: 92% · مراجعة بشرية مطلوبة</small>
          </div>
        </article>
      </section>
    </>
  );
}

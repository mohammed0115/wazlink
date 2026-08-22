/**
 * لوحة محاكاة التحليل — S4-UX.
 * منقولة عن `renderIntelligenceProcessing()`: مراحل، دفعة، ثم كشف تدريجي.
 * تُفصح صراحة أنها محاكاة ولا تتصل بنموذج AI خارجي.
 */
import { state } from "@services/data";
import { getBusinessIntelligence, tierLabels as rawTierLabels } from "@domain/intelligence.js";
import type { ProcessingState } from "./simulation";
import { fmt } from "./shared";

const tierLabels = rawTierLabels as Record<string, string>;

function StageList({ processing }: { processing: ProcessingState }) {
  return (
    <ol className="s4-processing-stage-list">
      {processing.stages.map((label, index) => {
        const phase =
          index < processing.stageIndex
            ? "completed"
            : index === processing.stageIndex && processing.phase === "stages"
              ? "processing"
              : "pending";
        const mark = phase === "completed" ? "✓" : phase === "processing" ? "◉" : "○";
        return (
          <li className={phase} key={label}>
            <i>{mark}</i>
            <span>{label}</span>
            <small>{phase === "completed" ? "مكتملة" : phase === "processing" ? "جارٍ التحليل" : "بانتظار الدور"}</small>
          </li>
        );
      })}
    </ol>
  );
}

function BatchList({ processing }: { processing: ProcessingState }) {
  if (processing.mode !== "batch") return null;
  return (
    <section className="s4-batch-list">
      <header>
        <b>تحليل {fmt(processing.ids.length)} شركات</b>
        <span>
          {fmt(processing.completedIds.length)} / {fmt(processing.ids.length)} مكتملة
        </span>
      </header>
      <div>
        {processing.ids.map((id) => {
          const record = getBusinessIntelligence(id);
          const phase = processing.insufficientIds.includes(id)
            ? "insufficient"
            : processing.completedIds.includes(id)
              ? "completed"
              : processing.currentId === id
                ? "processing"
                : "pending";
          const label =
            phase === "completed"
              ? "مكتملة"
              : phase === "processing"
                ? "جارٍ التحليل"
                : phase === "insufficient"
                  ? "بيانات غير كافية"
                  : "بانتظار الدور";
          const mark = phase === "completed" ? "✓" : phase === "processing" ? "◉" : phase === "insufficient" ? "?" : "○";
          return (
            <article className={phase} key={id}>
              <i>{mark}</i>
              <span>{record?.business.name || id}</span>
              <small>{label}</small>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function Reveal({ processing }: { processing: ProcessingState }) {
  const record = getBusinessIntelligence(processing.primaryId);

  if (processing.mode === "batch" && ["recommendations", "complete"].includes(processing.phase)) {
    const records = processing.ids.map(getBusinessIntelligence).filter(Boolean) as any[];
    const count = (predicate: (item: any) => boolean) => records.filter(predicate).length;
    return (
      <section className="s4-processing-outcome batch-complete">
        <span className="status success">اكتمل التحليل</span>
        <h3>{fmt(processing.ids.length)} شركات تم تحليلها أو فحصها ضمن الدفعة.</h3>
        <div className="s4-batch-summary">
          <span><b>{fmt(count((item) => item.tier === "high"))}</b> فرص عالية</span>
          <span><b>{fmt(count((item) => item.tier === "good"))}</b> فرص جيدة</span>
          <span><b>{fmt(count((item) => item.tier === "medium"))}</b> فرص متوسطة</span>
          <span><b>{fmt(count((item) => item.tier === "low"))}</b> فرص منخفضة</span>
          <span><b>{fmt(count((item) => item.status === "insufficient_data"))}</b> بيانات غير كافية</span>
        </div>
        <p>جميع الأعداد مشتقة من Business الظاهرة ونتائج Intelligence الحالية، وليست أرقام عرض مستقلة.</p>
      </section>
    );
  }

  if (!record || processing.outcome === "insufficient") {
    return (
      <section className="s4-processing-outcome insufficient">
        <span className="status warning">بيانات غير كافية</span>
        <h3>فحص اكتمال البيانات لم يجد أدلة كافية لمنح درجة.</h3>
        <p>لم تتغير Signals أو Score؛ تظهر البيانات غير المعروفة بصفتها غير معروفة فقط.</p>
      </section>
    );
  }

  if (processing.phase === "stages") return null;

  const score = Math.round((record.score || 0) * (processing.revealScore ?? 0));
  const confidence = Math.round((record.confidence || 0) * 100 * (processing.revealConfidence ?? 0));
  const showTier = ["tier", "confidence", "signals", "recommendations", "complete"].includes(processing.phase);
  const showConfidence = ["confidence", "signals", "recommendations", "complete"].includes(processing.phase);

  return (
    <section className="s4-processing-reveal" aria-label="كشف نتيجة التحليل">
      <div className="s4-processing-score">
        <b>{score}</b>
        <span>من 100</span>
      </div>
      <div className="s4-processing-result-copy">
        <strong>{showTier ? tierLabels[record.tier as string] : "حساب الدرجة من الإشارات"}</strong>
        <span>{showConfidence ? `الثقة ${confidence}%` : "النتيجة مشتقة من Intelligence Engine"}</span>
      </div>
    </section>
  );
}

export function IntelligenceProcessing() {
  const processing = state.intelligenceProcessing as ProcessingState | null;
  if (!processing) return null;

  const stageLabel =
    processing.phase === "stages"
      ? processing.stages[processing.stageIndex]
      : processing.outcome === "insufficient"
        ? "فحص اكتمال البيانات"
        : "كشف النتيجة التفسيرية";

  const percentValue =
    processing.phase === "stages"
      ? Math.round(((processing.stageIndex + 1) / processing.stages.length) * 72)
      : processing.phase === "complete"
        ? 100
        : 86;

  const title = processing.mode === "batch" ? "تحليل فرص متعددة" : "تحليل فرصة Business";

  return (
    <div className="modal-backdrop s4-processing-backdrop">
      <section className="modal s4-processing-panel" role="dialog" aria-modal="true" aria-labelledby="processingTitle">
        <header className="modal-head">
          <div>
            <p className="eyebrow">محاكاة Intelligence</p>
            <h2 id="processingTitle">{title}</h2>
            <p className="s4-processing-disclosure">
              محاكاة تحليل لأغراض تجربة المنتج؛ لا يوجد اتصال بنموذج AI خارجي.
            </p>
          </div>
          <span className="status info">{percentValue}%</span>
        </header>

        <div className="s4-processing-live" aria-live="polite" aria-atomic="true">
          {processing.phase === "stages"
            ? `جارٍ التنفيذ: ${stageLabel}`
            : processing.phase === "complete"
              ? "اكتمل التحليل"
              : `جارٍ كشف النتيجة: ${stageLabel}`}
        </div>

        <div
          className="s4-processing-progress"
          role="progressbar"
          aria-label="تقدم معالجة Intelligence"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percentValue}
        >
          <i style={{ width: `${percentValue}%` }} />
        </div>

        {processing.mode === "batch" && <BatchList processing={processing} />}
        <StageList processing={processing} />
        <Reveal processing={processing} />
      </section>
    </div>
  );
}

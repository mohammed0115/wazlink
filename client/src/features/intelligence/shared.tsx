/** مساعدات مشتركة لشاشات الذكاء — منقولة عن رؤوس عرض `intelligence.js`. */
import { analysisStatusLabels as rawAnalysisLabels, tierLabels as rawTierLabels } from "@domain/intelligence.js";

const analysisStatusLabels = rawAnalysisLabels as Record<string, string>;
const tierLabels = rawTierLabels as Record<string, string>;

export const fmt = (value: number | null | undefined) => new Intl.NumberFormat("ar-SA").format(value ?? 0);
export const percent = (value: number | null | undefined) => `${Math.round((value || 0) * 100)}%`;

export const statusTone = (status: string) =>
  ({ analyzed: "success", analyzing: "info", not_analyzed: "neutral", analysis_error: "danger", insufficient_data: "warning" } as Record<string, string>)[
    status
  ] || "neutral";

export const tierTone = (tier: string) =>
  ({ high: "success", good: "info", medium: "warning", low: "neutral" } as Record<string, string>)[tier] || "neutral";

export function Mono({ children }: { children: React.ReactNode }) {
  return <span className="mono ltr">{children}</span>;
}

export function AnalysisStatusBadge({ status }: { status: string }) {
  return <span className={`status s4-analysis-status ${statusTone(status)}`}>{analysisStatusLabels[status] || status}</span>;
}

export function ScoreDisplay({ record }: { record: any }) {
  if (record.score === null) {
    return (
      <span className="score-missing">
        —<small>غير متاح</small>
      </span>
    );
  }
  return (
    <span className={`score-cell ${record.tier}`}>
      <b>{record.score}</b>
      <small>{tierLabels[record.tier]}</small>
    </span>
  );
}

const railSteps = [
  { label: "بحث", detail: "طلب ومصدر" },
  { label: "نتائج", detail: "سجلات مكتشفة" },
  { label: "ذكاء", detail: "دليل وقرار" },
  { label: "وجهة", detail: "Excel أو CRM" },
];

/** سكة القرار — العنصر المميز للمنتج وفق `ideas.md`. */
export function DecisionRail({ stage, job, source }: { stage: "results" | "intelligence"; job?: any; source?: any }) {
  const current = stage === "results" ? 1 : 2;
  return (
    <section className="s4-decision-rail" aria-label="سكة قرار نمو">
      <div className="s4-rail-brand">
        <span className="s4-orbit-mark">
          <i />
          <i />
          <i />
        </span>
        <span>
          <b>نمو</b>
          <small>سكة القرار</small>
        </span>
      </div>
      <ol>
        {railSteps.map((item, index) => (
          <li className={`${index < current ? "done" : ""} ${index === current ? "active" : ""}`} key={item.label}>
            <i>{String(index + 1).padStart(2, "0")}</i>
            <span>
              <b>{item.label}</b>
              <small>{item.detail}</small>
            </span>
          </li>
        ))}
      </ol>
      <div className="s4-rail-context">
        <span>السجل الحالي</span>
        <b>
          <Mono>{job?.id || "—"}</Mono>
          {source ? ` · ${source.name}` : ""}
        </b>
      </div>
    </section>
  );
}

export function DimensionRows({ record }: { record: any }) {
  return (
    <>
      {record.dimensions.map((dimension: any) => (
        <div key={dimension.label}>
          <span>{dimension.label}</span>
          <b>
            {dimension.score} <small>/ {dimension.max}</small>
          </b>
        </div>
      ))}
    </>
  );
}

const signalHeadings: Record<string, string> = {
  gap: "فجوة مثبتة",
  positive: "إشارة داعمة",
  unknown: "بيانات غير معروفة",
  neutral: "سياق محايد",
};

export function SignalCard({ signal, onEvidence }: { signal: any; onEvidence: (signalId: string) => void }) {
  const tone = ["gap", "positive", "unknown"].includes(signal.polarity) ? signal.polarity : "neutral";
  return (
    <article className={`s4-signal-card ${tone}`}>
      <header>
        <span>{signalHeadings[tone]}</span>
        <b>{signal.value}</b>
      </header>
      <p>{signal.key.replaceAll("_", " ")}</p>
      <button type="button" className="button ghost compact" onClick={() => onEvidence(signal.id)}>
        عرض الدليل
      </button>
    </article>
  );
}

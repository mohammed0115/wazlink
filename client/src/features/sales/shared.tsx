/** مساعدات مشتركة لشاشات المبيعات — منقولة عن رؤوس عرض `pipeline.js`. */
import { appConfig } from "@config/env";
import { dealStatusLabels as rawDealStatus, mockModel } from "@services/data";

export const dealStatusLabels = rawDealStatus as Record<string, string>;

export const fmt = (value: number | null | undefined) => new Intl.NumberFormat("ar-SA").format(value ?? 0);
export const money = (value: number | null | undefined) => `${fmt(value)} ر.س`;

export const dateLabel = (value?: string | null) =>
  value ? new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value)) : "—";

export const dateTimeLabel = (value?: string | null) =>
  value ? new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";

export const ownerName = (ownerId: string) =>
  mockModel.users.find((user: { id: string }) => user.id === ownerId)?.name || "غير مسند";

export const statusTone = (status: string) => (status === "won" ? "success" : status === "lost" ? "danger" : "info");

export const stageTone = (stage?: { id?: string }) =>
  stage?.id === "STG-1006" ? "negotiation" : stage?.id === "STG-1005" ? "proposal" : "";

export function Mono({ children }: { children: React.ReactNode }) {
  return <span className="mono ltr">{children}</span>;
}

/** سكة القرار في سطوح S6. */
export function DecisionRail({ label = "متابعة القيمة" }: { label?: string }) {
  return (
    <section className="s6-decision-rail" aria-label="wazlink — سكة القرار">
      <div className="s6-brand-mark">
        <img src={`${appConfig.assetBaseUrl}wazlink-mark.svg`} alt="wazlink" />
        <span>
          <b>wazlink</b>
          <small>سكة القرار</small>
        </span>
      </div>
      <div className="s6-rail-steps">
        <span className="done"><i>١</i><b>بحث</b></span>
        <em />
        <span className="done"><i>٢</i><b>نتائج</b></span>
        <em />
        <span className="done"><i>٣</i><b>ذكاء</b></span>
        <em />
        <span className="active"><i>٤</i><b>CRM ومتابعة</b></span>
      </div>
      <p>{label}</p>
    </section>
  );
}

export function MetricStrip({ metrics }: { metrics: any }) {
  return (
    <section className="s6-metric-strip" aria-label="ملخص مسار المبيعات">
      <article><span>الصفقات المفتوحة</span><b>{fmt(metrics.dealCount)}</b><small>من مصدر الصفقات</small></article>
      <article><span>القيمة الإجمالية</span><b>{money(metrics.totalValue)}</b><small>دون ترجيح الاحتمال</small></article>
      <article><span>القيمة المرجحة</span><b>{money(metrics.weightedValue)}</b><small>قيمة × احتمال الصفقة</small></article>
      <article><span>متوسط الاحتمال</span><b>{fmt(metrics.averageProbability)}%</b><small>افتراضي أو معدل</small></article>
    </section>
  );
}

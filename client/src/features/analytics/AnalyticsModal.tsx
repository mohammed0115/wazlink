/**
 * نوافذ التحليلات — S10: تفسير المقياس، Drill-down للقمع، وتتبع الإسناد.
 * كلها عرض تفسيري فقط ولا تغيّر أي كيان.
 */
import type { MouseEvent } from "react";
import { useHashRoute, go } from "../../shared/router/useHashRoute";
import { analyticsService } from "@services";

const {
  getFunnel: getAnalyticsFunnel,
  getAttributionTraces,
  getMetricDrilldown,
  normalizeContext: normalizeAnalyticsContext,
} = analyticsService as typeof analyticsService & Record<string, any>;
import { useModalDismiss } from "../../shared/components/useModalDismiss";

type Row = Record<string, any>;
type DrilldownState =
  | { type: "metric"; metricId: string }
  | { type: "funnel"; stageId: string }
  | { type: "trace"; revenueId: string }
  | null;

const fmt = (value: unknown) =>
  value === null || value === undefined ? "—" : new Intl.NumberFormat("ar-SA").format(Number(value));
const money = (value: unknown) => (value === null || value === undefined ? "—" : `${fmt(value)} ر.س`);

function IdsList({ ids }: { ids: string[] }) {
  if (!ids.length) return <p>لا توجد سجلات ضمن هذا القياس والفلاتر الحالية.</p>;
  return (
    <div className="analytics-id-list">
      {ids.map((id) => (
        <span className="mono" key={id}>{id}</span>
      ))}
    </div>
  );
}

export function AnalyticsModal() {
  const { path, query } = useHashRoute();
  const modalType = query.get("modal");
  const modal: DrilldownState = modalType === "metric" && query.get("metricId")
    ? { type: "metric", metricId: query.get("metricId") as string }
    : modalType === "funnel" && query.get("stageId")
      ? { type: "funnel", stageId: query.get("stageId") as string }
      : modalType === "trace" && query.get("revenueId")
        ? { type: "trace", revenueId: query.get("revenueId") as string }
        : null;

  const close = () => go(path.replace(/\\?.*$/, ""));
  const panelRef = useModalDismiss(close);
  if (!modal) return null;

  let ctx: Row = normalizeAnalyticsContext({});
  const encodedFilters = query.get("filters");
  if (encodedFilters) {
    try {
      ctx = normalizeAnalyticsContext(JSON.parse(encodedFilters)) as Row;
    } catch {
      ctx = normalizeAnalyticsContext({}) as Row;
    }
  }

  const onBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) close();
  };

  if (modal.type === "metric") {
    const data = getMetricDrilldown(modal.metricId, ctx) as Row;
    return (
      <div className="analytics-modal-backdrop" onClick={onBackdrop}>
        <section ref={panelRef as never} tabIndex={-1} className="analytics-modal" role="dialog" aria-modal="true" aria-labelledby="analytics-modal-title">
          <button className="modal-close" type="button" onClick={close} aria-label="إغلاق">×</button>
          <span className="eyebrow">Metric explainability</span>
          <h2 id="analytics-modal-title">{data.definition?.label || modal.metricId}</h2>
          <p>{data.definition?.definition || ""}</p>
          <dl className="analytics-explainer">
            <div><dt>الكيان</dt><dd>{data.definition?.entity || "—"}</dd></div>
            <div><dt>التجميع</dt><dd>{data.definition?.aggregation || "—"}</dd></div>
            <div>
              <dt>دلالة الوقت</dt>
              <dd>{data.definition?.timeMode === "snapshot" ? "لقطة حالية — لا يطبق نطاق التاريخ" : "حدث داخل الفترة"}</dd>
            </div>
            <div><dt>المالك</dt><dd>{data.definition?.ownerDimension || "—"}</dd></div>
            <div><dt>الطابع الزمني</dt><dd>{data.definition?.timestampField || "—"}</dd></div>
            <div><dt>الفترة</dt><dd>{data.period}</dd></div>
          </dl>
          <h3>السجلات الداخلة ({data.ids.length})</h3>
          <IdsList ids={data.ids} />
          <small>
            الفلاتر:{" "}
            {data.filters.length
              ? data.filters.map((item: Row) => `${item.label}: ${item.value}`).join(" · ")
              : "لا توجد فلاتر أبعاد فعّالة"}
          </small>
        </section>
      </div>
    );
  }

  if (modal.type === "funnel") {
    const funnel = getAnalyticsFunnel(ctx) as Row;
    const stage = funnel.stages.find((item: Row) => item.id === modal.stageId);
    return (
      <div className="analytics-modal-backdrop" onClick={onBackdrop}>
        <section className="analytics-modal" role="dialog" aria-modal="true" aria-labelledby="analytics-modal-title">
          <button className="modal-close" type="button" onClick={close} aria-label="إغلاق">×</button>
          <span className="eyebrow">Funnel drill-down</span>
          <h2 id="analytics-modal-title">{stage?.label || "مرحلة القمع"}</h2>
          <p>{stage?.definition || ""}</p>
          <b>{fmt(stage?.count || 0)} Business فريدة</b>
          <IdsList ids={stage?.entityIds || []} />
        </section>
      </div>
    );
  }

  const trace = (getAttributionTraces(ctx) as Row[]).find((item) => item.event.id === modal.revenueId);
  if (!trace) return null;

  return (
    <div className="analytics-modal-backdrop" onClick={onBackdrop}>
      <section className="analytics-modal wide" role="dialog" aria-modal="true" aria-labelledby="analytics-modal-title">
        <button className="modal-close" type="button" onClick={close} aria-label="إغلاق">×</button>
        <span className="eyebrow">Attribution trace</span>
        <h2 id="analytics-modal-title">
          {trace.event.id} · {money(trace.event.amount)}
        </h2>
        <p>
          المالك: {trace.owner?.name || "—"} · النموذج: multi-touch weighted · نقاط اللمس: {fmt(trace.touchpointCount)}
        </p>
        {trace.touchpoints.map((touch: Row, index: number) => (
          <article className={`trace-chain ${touch.complete ? "" : "broken"}`} key={touch.touchpoint?.id ?? index}>
            <b className="mono">{trace.event.id}</b>
            <i>←</i>
            <b className="mono">{touch.touchpoint?.id || "غير منسوب"}</b>
            <i>←</i>
            <b className="mono">{touch.deal?.id || "—"}</b>
            <i>←</i>
            <b className="mono">{touch.lead?.id || "—"}</b>
            <i>←</i>
            <b className="mono">{touch.business?.id || "—"}</b>
            <i>←</i>
            <b className="mono">{touch.job?.id || "—"}</b>
            <i>←</i>
            <b className="mono">{touch.source?.id || "—"}</b>
            <span>{money(touch.amount)}</span>
          </article>
        ))}
        <small>
          المنسوب {money(trace.attributed)} · غير المنسوب {money(trace.unattributed)} — مجموع الإسناد لا يتجاوز مبلغ
          RevenueEvent.
        </small>
      </section>
    </div>
  );
}

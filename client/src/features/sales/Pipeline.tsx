/**
 * مسار المبيعات — S6.
 *
 * منقول عن `renderPipeline()`. السحب والإفلات يحدّث `stageId` عبر
 * `moveDealStage` فقط، ولا يسمح بالإسقاط على مراحل الإغلاق.
 * أزرار النقل تبقى بديلًا كاملًا للوحة المفاتيح.
 */
import { useState } from "react";
import { getDealBusiness, getDealLead, getDealProbability, getDealStage, getLeadActivitySummary, getPipeline, getPipelineMetrics, getPipelineStageSummary, moveDealStage } from "@services";
import { go } from "../../shared/router/useHashRoute";
import { mutate } from "../../shared/store/appStore";
import { useToast } from "../../shared/store/toast";
import { PageHead } from "../../shared/components/PageHead";
import { DecisionRail, MetricStrip, Mono, fmt, money, ownerName, stageTone } from "./shared";

type Row = Record<string, any>;

function dealRecord(deal: Row): Row {
  const lead = getDealLead(deal);
  return {
    deal,
    lead,
    business: getDealBusiness(deal),
    stage: getDealStage(deal),
    activity: lead ? getLeadActivitySummary(lead.id) : null,
  };
}

function DealCard({ row, stages, onMove }: { row: Row; stages: Row[]; onMove: (dealId: string, stageId: string) => void }) {
  const { deal, lead, business, stage, activity } = row;
  const stageIndex = stages.findIndex((item) => item.id === stage.id);
  const previous = stages[stageIndex - 1];
  const next = stages[stageIndex + 1];

  return (
    <article
      className={`deal-card ${stageTone(stage)}`}
      draggable
      onDragStart={(event) => event.dataTransfer.setData("text/plain", deal.id)}
      aria-label={`صفقة ${deal.title} قابلة للسحب إلى مرحلة مفتوحة`}
    >
      <button
        type="button"
        className="deal-card-main"
        onClick={() => {
          go(`deals/${encodeURIComponent(deal.id)}`);
        }}
      >
        <header>
          <span className="deal-card-company">
            <i>{business?.short?.slice(0, 1) || "ع"}</i>
            <b>{business?.name || lead?.id || deal.id}</b>
          </span>
          <em>{getDealProbability(deal)}%</em>
        </header>
        <h3>{deal.title}</h3>
        <div className="deal-card-value">
          <b>{money(deal.value)}</b>
          <small><Mono>{deal.id}</Mono></small>
        </div>
        <footer>
          <span>{ownerName(deal.ownerId)}</span>
          <small>{activity?.nextTask ? activity.nextTask.title : "لا توجد متابعة مجدولة"}</small>
        </footer>
      </button>

      <div className="deal-card-actions">
        {previous ? (
          <button
            type="button"
            className="deal-move-button"
            aria-label={`إرجاع إلى ${previous.name}`}
            onClick={() => onMove(deal.id, previous.id)}
          >
            ‹
          </button>
        ) : (
          <span />
        )}
        {next ? (
          <button type="button" className="button ghost compact" onClick={() => onMove(deal.id, next.id)}>
            نقل إلى {next.name}
          </button>
        ) : (
          <button
            type="button"
            className="button primary compact"
            onClick={() => {
              go(`deals/${encodeURIComponent(deal.id)}?modal=won&dealId=${encodeURIComponent(deal.id)}`);
            }}
          >
            إغلاق كرابحة
          </button>
        )}
      </div>
    </article>
  );
}

export function Pipeline() {
  const toast = useToast();
  const [dragOver, setDragOver] = useState<string | null>(null);

  const pipeline = getPipeline();
  const metrics = getPipelineMetrics(pipeline?.id);
  const summary = getPipelineStageSummary(pipeline?.id).filter(({ stage }: Row) => stage.kind === "open");
  const openStages = summary.map(({ stage }: Row) => stage);

  const move = (dealId: string, stageId: string) => {
    const result = mutate(() => moveDealStage(dealId, stageId));
    if (result) toast("نُقلت الصفقة إلى المرحلة الجديدة وسُجل الأثر محليًا.", "success");
    else toast("تعذر نقل الصفقة إلى هذه المرحلة.", "error");
  };

  return (
    <>
      <PageHead
        kicker="مسار المبيعات"
        title={pipeline?.name || "Pipeline المبيعات"}
        description="اسحب الصفقة بين المراحل المفتوحة أو استخدم أزرار النقل المتاحة للكيبورد، ثم أغلقها بتأكيد صريح."
        actions={
          <>
            <button className="button" type="button" onClick={() => go("deals")}>كل الصفقات</button>
            <button
              className="button primary"
              type="button"
              onClick={() => {
                go("deals?modal=create");
              }}
            >
              إنشاء صفقة
            </button>
          </>
        }
      />

      <DecisionRail label="تحويل سياق Lead إلى قرار قيمة منضبط" />
      <MetricStrip metrics={metrics} />

      <div className="prototype-notice s6-notice">
        <b>محاكاة محلية</b>
        <span>
          السحب يحدّث معرّف المرحلة عبر mutation واحدة؛ لا يسمح بإسقاط صفقة على حالات الإغلاق. أزرار النقل تبقى بديلًا
          للوصول.
        </span>
      </div>

      <section className="s6-kanban" aria-label="لوحة Pipeline">
        {summary.map(({ stage, deals, count, value, weightedValue }: Row) => (
          <article
            className={`s6-stage-column ${stageTone(stage)} ${dragOver === stage.id ? "drag-over" : ""}`}
            key={stage.id}
            aria-label={`منطقة إسقاط مرحلة ${stage.name}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragOver(stage.id);
            }}
            onDragLeave={() => setDragOver(null)}
            onDrop={(event) => {
              event.preventDefault();
              setDragOver(null);
              const dealId = event.dataTransfer.getData("text/plain");
              if (dealId) move(dealId, stage.id);
            }}
          >
            <header>
              <div>
                <span>المرحلة {fmt(stage.order)}</span>
                <h2>{stage.name}</h2>
              </div>
              <b>{fmt(count)}</b>
            </header>
            <div className="s6-stage-totals">
              <span>{money(value)}</span>
              <small>
                مرجح {money(weightedValue)} · افتراضي {stage.defaultProbability}%
              </small>
            </div>
            <div className="s6-stage-cards">
              {deals.length ? (
                deals.map((deal: Row) => (
                  <DealCard row={dealRecord(deal)} stages={openStages} onMove={move} key={deal.id} />
                ))
              ) : (
                <div className="s6-empty-stage">
                  <i>○</i>
                  <b>لا توجد صفقات</b>
                  <span>اسحب صفقة هنا أو أنشئ فرصة من Lead.</span>
                </div>
              )}
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

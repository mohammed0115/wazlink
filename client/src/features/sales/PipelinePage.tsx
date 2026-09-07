/**
 * Pipeline board — deals grouped by their real stage.
 *
 * Stages come from `GET /pipelines`, so the columns are the workspace's own
 * configured stages rather than a hard-coded list. Moving a card calls
 * `POST /deals/{ref}/stage` with `If-Match`, which means a stale board loses
 * the race with a 409 instead of silently overwriting someone else's move.
 *
 * Stage probability is a forecast weighting. Reaching the final stage is not
 * revenue recognition — that stays an explicit finance command.
 */
import { dealsApi, pipelineApi, type DealPayload } from "../../api";
import { useApiAction, useApiResource } from "../../api/hooks";
import { useAuth } from "../../shared/context/AuthProvider";
import { PageHead } from "../../shared/components/PageHead";
import { ApiEmptyState, ApiErrorState, ApiLoadingState, FormError } from "../../shared/components/ApiStates";
import { useToast } from "../../shared/store/toast";
import { fmtNumber, formatMoney } from "../crm/components/primitives";

export function PipelinePage() {
  const toast = useToast();
  const { can } = useAuth();
  const pipelines = useApiResource((signal) => pipelineApi.list(signal), []);
  const deals = useApiResource((signal) => dealsApi.list({ status: "open", limit: 100 }, signal), []);

  const move = useApiAction((deal: DealPayload, stageRef: string) =>
    dealsApi.moveStage(deal.deal_ref, stageRef, deal.version),
  );

  const head = (
    <PageHead
      kicker="المبيعات"
      title="خط الأنابيب"
      description="المراحل مقروءة من إعدادات مساحة العمل، والصفقات من قاعدة البيانات مباشرة."
    />
  );

  if (pipelines.initialLoading || deals.initialLoading) {
    return (
      <>
        {head}
        <ApiLoadingState title="جارٍ تحميل خط الأنابيب" />
      </>
    );
  }

  const failure = pipelines.error || deals.error;
  if (failure) {
    return (
      <>
        {head}
        <ApiErrorState
          error={failure}
          onRetry={() => {
            pipelines.reload();
            deals.reload();
          }}
        />
      </>
    );
  }

  const board = pipelines.data?.items.find((row) => row.is_default) ?? pipelines.data?.items[0];
  if (!board) {
    return (
      <>
        {head}
        <ApiEmptyState title="لا يوجد خط أنابيب معرّف" />
      </>
    );
  }

  const openDeals = deals.data?.items ?? [];

  return (
    <>
      {head}
      <FormError error={move.error} />
      <section className="card crm-list-card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {board.stages.map((stage) => (
                  <th key={stage.stage_ref}>
                    {stage.name}
                    <br />
                    <small>
                      {fmtNumber(
                        openDeals.filter((deal) => deal.stage?.stage_ref === stage.stage_ref).length,
                      )}{" "}
                      صفقة
                    </small>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {board.stages.map((stage) => {
                  const column = openDeals.filter((deal) => deal.stage?.stage_ref === stage.stage_ref);
                  return (
                    <td key={stage.stage_ref} style={{ verticalAlign: "top", minWidth: "200px" }}>
                      {column.length === 0 ? (
                        <p className="party-empty">—</p>
                      ) : (
                        column.map((deal) => (
                          <div className="party-row" key={deal.deal_ref}>
                            <span className="grow">
                              <b>{deal.title}</b>
                              <small className="ltr">
                                {formatMoney(deal.value, deal.currency)}
                              </small>
                            </span>
                            {can("deal.update") ? (
                              <select
                                aria-label={`نقل ${deal.title}`}
                                value={stage.stage_ref}
                                disabled={move.pending}
                                onChange={async (event) => {
                                  const result = await move.run(deal, event.target.value);
                                  if (!result) return;
                                  toast("نُقلت الصفقة.", "success");
                                  deals.reload();
                                }}
                              >
                                {board.stages.map((option) => (
                                  <option value={option.stage_ref} key={option.stage_ref}>
                                    {option.name}
                                  </option>
                                ))}
                              </select>
                            ) : null}
                          </div>
                        ))
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="crm-pager">
          <p className="revenue-boundary-note">
            الوصول إلى المرحلة الأخيرة أو كسب الصفقة لا يُنشئ إيرادًا معترفًا به.
          </p>
        </div>
      </section>
    </>
  );
}

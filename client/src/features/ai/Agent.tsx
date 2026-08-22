/**
 * وكيل المبيعات الذكي — S8.
 *
 * لا يكون الإجراء تنفيذًا قبل موافقة بشرية. لا يوجد وضع استقلال ذاتي،
 * ويحظر مركزيًا إرسال رسالة أو تغيير قيمة Deal أو إنشاء Revenue/Attribution.
 */
import { state } from "@domain/data.js";
import {
  agentActionLabels as rawActionLabels,
  agentActionStatusLabels as rawStatusLabels,
  agentModeLabels as rawModes,
  approveAgentAction,
  getAgentActions,
  getAgentActivities,
  getAgentPolicyMatrix,
  rejectAgentAction,
} from "@domain/sales-ai.js";
import { mutate, notifyStateChanged } from "../../shared/store/appStore";
import { useToast } from "../../shared/store/toast";
import { PageHead } from "../../shared/components/PageHead";
import { EvidenceList, Mono, pct } from "./CopilotPanel";

const agentModeLabels = rawModes as Record<string, string>;
const agentActionLabels = rawActionLabels as Record<string, string>;
const agentActionStatusLabels = rawStatusLabels as Record<string, string>;

type Row = Record<string, any>;

export function Agent() {
  const toast = useToast();
  const actions = getAgentActions() as Row[];
  const matrix = getAgentPolicyMatrix() as Row[];

  return (
    <>
      <PageHead
        kicker="مساعد المبيعات"
        title="Agent محكوم بالموافقة"
        description="طبقة مقترحات حتمية محلية تمر عبر السياسة والموافقة والتدقيق؛ لا إرسال ذاتي ولا تغييرات مالية."
        actions={<span className={`s8-mode-badge ${state.agentMode}`}>Agent: {agentModeLabels[state.agentMode]}</span>}
      />

      <section className="s8-agent-workspace">
        <article className="s8-agent-mode">
          <header>
            <span>وضع Agent</span>
            <b>{agentModeLabels[state.agentMode]}</b>
          </header>
          <label>
            اختر الوضع
            <select
              value={state.agentMode}
              onChange={(event) => {
                state.agentMode = event.target.value;
                notifyStateChanged();
                toast(`وضع Agent الحالي: ${agentModeLabels[event.target.value]}.`, "info");
              }}
            >
              <option value="off">متوقف — لا اقتراحات قابلة للتنفيذ</option>
              <option value="assist">مساعدة فقط — تحليل واقتراح</option>
              <option value="approval_required">يتطلب الموافقة — اقتراح ثم تنفيذ محكوم</option>
            </select>
          </label>
          <p>لا يوجد وضع استقلال ذاتي في S8.</p>
        </article>

        <section className="s8-policy-table">
          <header>
            <div>
              <h2>سياسة الصلاحيات</h2>
              <p>قواعد مبرمجة مركزيًا وليست تعليمات واجهة فقط.</p>
            </div>
          </header>
          <div>
            {matrix.map((row) => (
              <article className={row.forbidden ? "forbidden" : ""} key={row.label}>
                <b>{row.label}</b>
                <span>{row.assist}</span>
                <span>{row.approval}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="s8-agent-log">
          <header>
            <div>
              <h2>سجل القرارات</h2>
              <p>Proposal → Approval/Reject → Execution مع evidence وconfidence.</p>
            </div>
            <span>{actions.filter((action) => action.status === "proposed").length} بانتظار الموافقة</span>
          </header>
          <div className="s8-agent-action-list">
            {actions.length ? (
              actions.map((action) => {
                const log = getAgentActivities(action.id) as Row[];
                return (
                  <article className={`s8-agent-action status-${action.status}`} key={action.id}>
                    <header>
                      <div>
                        <span>{agentActionLabels[action.type] || action.type}</span>
                        <b>{agentActionStatusLabels[action.status] || action.status}</b>
                      </div>
                      <small>
                        <Mono>{action.id}</Mono> · ثقة {pct(action.confidence)}
                      </small>
                    </header>
                    <p>{action.reason}</p>
                    <EvidenceList refs={action.evidenceRefs} />
                    <div className="s8-action-timeline">
                      {log.map((entry) => (
                        <span key={entry.id ?? `${entry.type}-${entry.createdAt}`}>
                          <i />
                          {entry.type} · {String(entry.createdAt).slice(11, 16)}
                        </span>
                      ))}
                    </div>
                    {action.status === "proposed" ? (
                      <footer>
                        <button
                          type="button"
                          className="button primary compact"
                          onClick={() => {
                            const result = mutate(() => approveAgentAction(action.id));
                            toast(
                              result.kind === "executed"
                                ? "نُفذ الإجراء الموافق عليه مرة واحدة عبر Domain Function محكومة."
                                : result.kind === "no_op"
                                  ? "هذا الإجراء منفذ مسبقًا؛ لم تتكرر أي mutation."
                                  : "تعذر التنفيذ قبل الموافقة أو بسبب سياسة Agent.",
                              result.kind === "executed" ? "success" : result.kind === "no_op" ? "info" : "error",
                            );
                          }}
                        >
                          موافقة وتنفيذ
                        </button>
                        <button
                          type="button"
                          className="button danger compact"
                          onClick={() => {
                            const result = mutate(() => rejectAgentAction(action.id));
                            toast(
                              result ? "رُفض اقتراح Agent؛ لم تُنفذ أي mutation." : "لا يمكن رفض هذا الاقتراح في حالته الحالية.",
                              result ? "info" : "error",
                            );
                          }}
                        >
                          رفض
                        </button>
                      </footer>
                    ) : action.failureReason ? (
                      <small className="s8-failure">{action.failureReason}</small>
                    ) : null}
                  </article>
                );
              })
            ) : (
              <div className="s8-empty">لا توجد مقترحات بعد.</div>
            )}
          </div>
        </section>
      </section>
    </>
  );
}

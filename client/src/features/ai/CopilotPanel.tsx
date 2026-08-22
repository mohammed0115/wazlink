/**
 * مساعد المبيعات — S8.
 *
 * محاكاة حتمية محلية: لا LLM ولا API ولا إرسال. «استخدام الرد» يملأ
 * Composer فقط ولا ينشئ رسالة، ويبقى `senderType` للرسالة البشرية `user`.
 */
import { getConversation, state } from "@services/data";
import {
  agentModeLabels as rawAgentModes,
  createAgentProposal,
  getCopilotSnapshot,
  getEvidence,
  qualificationLabels as rawQualification,
  runCopilotAnalysis,
  useSuggestedReply,
} from "@domain/sales-ai.js";
import { tierLabels as rawTiers } from "@domain/intelligence.js";
import { go } from "../../shared/router/useHashRoute";
import { mutate, notifyStateChanged } from "../../shared/store/appStore";
import { useToast } from "../../shared/store/toast";

const tierLabels = rawTiers as Record<string, string>;
const qualificationLabels = rawQualification as Record<string, string>;
export const agentModeLabels = rawAgentModes as Record<string, string>;

type Row = Record<string, any>;

export const pct = (value: unknown) =>
  new Intl.NumberFormat("ar-SA", { style: "percent", maximumFractionDigits: 0 }).format(Number(value || 0));

export function Mono({ children }: { children: React.ReactNode }) {
  return <span className="mono">{children || "—"}</span>;
}

export function EvidenceList({ refs }: { refs?: string[] }) {
  const items = (getEvidence(refs || []) as Row[]).filter(Boolean);
  return (
    <div className="s8-evidence">
      {items.length ? (
        items.map((item: Row) => (
          <span title={item.label} key={item.id}>
            <Mono>{item.id}</Mono>
            <b>{item.label}</b>
          </span>
        ))
      ) : (
        <small>لا توجد أدلة قابلة للعرض.</small>
      )}
    </div>
  );
}

const qualificationFields: [string, string][] = [
  ["need", "الاحتياج"],
  ["budget", "الميزانية"],
  ["authority", "صاحب القرار"],
  ["timeline", "موعد التنفيذ"],
];

function QualificationView({ record }: { record?: Row }) {
  const payload = record?.payload;
  if (!payload) return <div className="s8-empty">شغّل التحليل لعرض حالة التأهيل والمعلومات الناقصة.</div>;
  return (
    <>
      <div className="s8-qualification-grid">
        {qualificationFields.map(([key, label]) => (
          <article className={`state-${payload[key]?.state || "unknown"}`} key={key}>
            <span>{label}</span>
            <b>{qualificationLabels[payload[key]?.state] || "غير معروف"}</b>
            <small>{payload[key]?.value || "لا يوجد دليل كافٍ."}</small>
          </article>
        ))}
      </div>
      <div className="s8-question-list">
        <b>أسئلة مقترحة — لا تُرسل تلقائيًا</b>
        {payload.questions?.map((question: string) => (
          <span key={question}>{question}</span>
        ))}
      </div>
    </>
  );
}

export function CopilotPanel({ conversationId }: { conversationId?: string }) {
  const toast = useToast();
  const conversation = conversationId ? getConversation(conversationId) : null;
  const leadId = conversation?.leadId;
  if (!leadId) return null;

  const snapshot = getCopilotSnapshot(leadId, conversation?.id || null) as Row;
  const intelligence = snapshot.context?.intelligence;
  const { latestByType, stale } = snapshot;
  const context = snapshot.context as Row | null;
  const summary = latestByType?.conversation_summary;
  const nba = latestByType?.next_best_action;
  const reply = latestByType?.suggested_reply;

  const analyze = () => {
    mutate(() => runCopilotAnalysis(leadId, conversation?.id || null));
    toast("اكتمل التحليل الحتمي المحلي؛ لا يوجد نموذج خارجي.", "success");
  };

  const setTab = (tab: string) => {
    state.copilotTab = tab;
    notifyStateChanged();
  };

  let body: React.ReactNode;

  if (state.copilotTab === "qualification") {
    body = <QualificationView record={latestByType?.qualification} />;
  } else if (state.copilotTab === "evidence") {
    body = (
      <div className="s8-evidence-panel">
        <article>
          <span>الأصل والسياق</span>
          <EvidenceList refs={snapshot.records.flatMap((record: Row) => record.evidenceRefs || [])} />
        </article>
        <article>
          <span>ذكاء الفرص — قراءة فقط</span>
          <b>
            {intelligence?.score ?? "غير متاح"}
            {intelligence?.score !== null && intelligence?.score !== undefined ? "/100" : ""}
          </b>
          <p>
            {intelligence?.status === "analysis_error"
              ? "تعذر تحليل Intelligence؛ لا توجد درجة بديلة."
              : intelligence?.status === "insufficient_data"
                ? "بيانات Intelligence غير كافية."
                : `${tierLabels[intelligence?.tier] || "—"} · ثقة Intelligence ${pct(intelligence?.confidence)}`}
          </p>
        </article>
      </div>
    );
  } else if (!summary) {
    body = (
      <div className="s8-empty">
        <i>✧</i>
        <b>لم يُحلّل هذا السياق بعد</b>
        <p>المحاكاة الحتمية تقرأ CRM والمحادثة وIntelligence وDeals لتنتج توصية قابلة للمراجعة.</p>
        <button type="button" className="button primary" onClick={analyze}>تحليل العميل</button>
      </div>
    );
  } else {
    body = (
      <div className={`s8-output-stack ${stale ? "is-stale" : ""}`}>
        {stale && (
          <div className="s8-stale" role="status">
            <b>التوصية قديمة</b>
            <span>تغيرت المحادثة بعد التحليل؛ أعد التحليل قبل استخدام الرد.</span>
          </div>
        )}

        <article className="s8-recommendation">
          <header>
            <span>ملخص المحادثة</span>
            <b>ثقة {pct(summary.confidence)}</b>
          </header>
          <p>{summary.payload.text}</p>
          <EvidenceList refs={summary.evidenceRefs} />
        </article>

        {nba && (
          <article className="s8-recommendation action">
            <header>
              <span>الإجراء التالي</span>
              <b>ثقة {pct(nba.confidence)}</b>
            </header>
            <h3>{nba.payload.label}</h3>
            <p>{nba.payload.reason}</p>
            <EvidenceList refs={nba.evidenceRefs} />
            {state.agentMode === "approval_required" ? (
              <button
                type="button"
                className="button compact"
                onClick={() => {
                  const result = mutate(() =>
                    (createAgentProposal as (input: Row) => Row)({
                      leadId: context?.lead?.id || "",
                      conversationId: context?.conversation?.id || "",
                      type: "create_task",
                      payload: { title: "متابعة بعد توصية Copilot", type: "متابعة", dueAt: "2026-08-16T10:00:00" },
                      decisionId: nba.id,
                    }),
                  );
                  toast(
                    result.kind === "blocked"
                      ? "لا يمكن إنشاء الاقتراح: راجع سياسة Agent."
                      : result.kind === "duplicate"
                        ? "يوجد اقتراح معلق مطابق بالفعل."
                        : "أُنشئ اقتراح Agent بانتظار الموافقة البشرية.",
                    result.kind === "blocked" ? "error" : "success",
                  );
                }}
              >
                إنشاء اقتراح Agent
              </button>
            ) : (
              <small className="s8-policy-note">فعّل وضع «يتطلب الموافقة» لإنشاء اقتراح قابل للمراجعة.</small>
            )}
          </article>
        )}

        {reply ? (
          <article className="s8-recommendation reply">
            <header>
              <span>رد مقترح</span>
              <b>ثقة {pct(reply.confidence)}</b>
            </header>
            <p>{reply.payload.text}</p>
            <EvidenceList refs={reply.evidenceRefs} />
            <button
              type="button"
              className="button primary"
              disabled={Boolean(stale)}
              onClick={() => {
                mutate(() => useSuggestedReply(reply.id));
                toast("أُدرج الرد المقترح في Composer فقط؛ لم تُنشأ أي رسالة.", "success");
              }}
            >
              {stale ? "أعد التحليل أولًا" : "استخدام الرد في Composer"}
            </button>
          </article>
        ) : (
          <article className="s8-recommendation muted">
            <b>لا توجد محادثة متاحة لإنشاء رد</b>
            <p>يمكن عرض الإجراء التالي من CRM عندما يكون السياق كافيًا.</p>
          </article>
        )}
      </div>
    );
  }

  return (
    <section className="s8-copilot" aria-label="مساعد المبيعات — محاكاة ذكاء اصطناعي">
      <header className="s8-panel-head">
        <div>
          <span className="s8-kicker">مساعد المبيعات — محاكاة حتمية</span>
          <h2>Copilot لا ينفّذ أي إجراء</h2>
          <p>توصية بشرية قابلة للمراجعة، وليست نموذجًا خارجيًا أو إرسالًا تلقائيًا.</p>
        </div>
      </header>

      <div className="s8-tabs" role="tablist">
        {([["summary", "المساعد"], ["qualification", "التأهيل"], ["evidence", "الأدلة"]] as [string, string][]).map(
          ([id, label]) => (
            <button
              type="button"
              key={id}
              className={`s8-tab ${state.copilotTab === id ? "active" : ""}`}
              aria-pressed={state.copilotTab === id}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ),
        )}
      </div>

      {body}

      <footer className="s8-panel-footer">
        <button type="button" className="button ghost compact" onClick={analyze}>تحليل العميل</button>
        <button type="button" className="button ghost compact" onClick={() => go("agent")}>فتح Agent</button>
      </footer>
    </section>
  );
}

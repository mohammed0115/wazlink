/**
 * الأتمتة — S9.
 *
 * محاكاة حتمية داخل الجلسة وليست Scheduler أو Worker أو Queue.
 * لا يبدأ تقييم Rule إلا بفعل مستخدم صريح، والإجراءات الحساسة تمر
 * بقائمة انتظار موافقة قبل أي mutation.
 */
import {
  approveAutomationAction,
  automationActionCatalog as rawActionCatalog,
  automationActionStatusLabels as rawExecStatus,
  automationRuleStatusLabels as rawRuleStatus,
  automationRunStatusLabels as rawRunStatus,
  automationTriggerCatalog as rawTriggerCatalog,
  formatAutomationCondition,
  getAutomationApprovalQueue,
  getAutomationMetrics,
  getAutomationRule,
  getAutomationRules,
  getAutomationRunActionExecutions,
  getAutomationRuns,
  mockModel,
  rejectAutomationAction,
  runAutomationNow,
  setAutomationRuleStatus,
  state,
  testAutomationRule,
} from "@services/data";
import { go } from "../../shared/router/useHashRoute";
import { mutate, notifyStateChanged } from "../../shared/store/appStore";
import { useToast } from "../../shared/store/toast";
import { PageHead } from "../../shared/components/PageHead";

const automationRuleStatusLabels = rawRuleStatus as Record<string, string>;
const automationRunStatusLabels = rawRunStatus as Record<string, string>;
const automationActionStatusLabels = rawExecStatus as Record<string, string>;
type Row = Record<string, any>;

/** بعض مجموعات الأتمتة تبدأ فارغة في الـfixture فيستنتجها TS ناقصة. */
const model = mockModel as unknown as Record<string, Row[]>;

/** التوقيع المستنتج من JS يضيّق المعامل؛ العقد الفعلي يقبل معرّف قاعدة. */
const runsForRule = getAutomationRuns as unknown as (ruleId?: string | null) => Row[];

const actionCatalog = rawActionCatalog as Row[];
const triggerCatalog = rawTriggerCatalog as Row[];

const formatDateTime = (value?: string) =>
  value ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const actionLabel = (type: string) => actionCatalog.find((item) => item.type === type)?.label || type;
const triggerLabel = (type: string) => triggerCatalog.find((item) => item.id === type)?.label || type;
const userLabel = (id: string) => mockModel.users.find((user: Row) => user.id === id)?.name || "—";

function StatusPill({ status, labels }: { status: string; labels: Record<string, string> }) {
  return <span className={`s9-status ${status}`}>{labels[status] || status}</span>;
}

const railSteps: [string, string][] = [
  ["1", "الحدث"], ["2", "الشروط"], ["3", "القاعدة"], ["4", "الإجراء"], ["5", "الموافقة"], ["6", "التدقيق"],
];

function DecisionRail({ current = "القواعد" }: { current?: string }) {
  return (
    <div className="s9-decision-rail" aria-label="سكة قرار الأتمتة">
      {railSteps.map(([num, label], index) => (
        <span key={label} className={label === current ? "active" : ""}>
          <i>{num}</i>
          {label}
          {index < railSteps.length - 1 && <b />}
        </span>
      ))}
    </div>
  );
}

function ruleSentence(rule: Row) {
  const group = model.automationConditionGroups.find((item: Row) => item.id === rule.conditionGroupId);
  const condition = group?.conditions?.[0];
  const conditionText = condition ? `إذا كان ${formatAutomationCondition(condition)}` : "من دون شرط إضافي";
  const actions = rule.actionIds
    .map((id: string) => actionLabel(model.automationActions.find((item: Row) => item.id === id)?.type))
    .join("، ");
  return `عندما ${triggerLabel(rule.triggerType)}، ${conditionText}، ${actions}.`;
}

export function Automation({ ruleId }: { ruleId?: string }) {
  const toast = useToast();
  const metrics = getAutomationMetrics();
  const rules = getAutomationRules() as Row[];
  const selected = ruleId ? getAutomationRule(ruleId) : getAutomationRule(state.selectedAutomationId);
  const queue = getAutomationApprovalQueue() as Row[];
  const runs = runsForRule(ruleId);
  const allRuns = runsForRule();

  const metricCards: [number, string, string][] = [
    [metrics.totalRules, "إجمالي القواعد", "قواعد محلية"],
    [metrics.enabled, "قواعد مفعلة", "تُقيّم عند التشغيل"],
    [metrics.runsToday, "تشغيلات اليوم", "من سجل Runs"],
    [metrics.awaitingApproval, "تحتاج موافقة", "لا mutation قبل القرار"],
    [metrics.failed, "فشل مضبوط", "مكشوف في السجل"],
  ];

  return (
    <>
      <PageHead
        kicker="S9 · محاكاة محلية"
        title="الأتمتة"
        description="حوّل حدثًا معروفًا إلى مهمة أو اقتراح خاضع للسياسة. لا توجد جدولة خلفية أو إرسال خارجي."
        actions={
          <button
            className="button"
            type="button"
            onClick={() => {
              (state as { automationModal: unknown }).automationModal = { type: "create-rule" };
              notifyStateChanged();
            }}
          >
            قاعدة جديدة
          </button>
        }
      />

      <DecisionRail />

      <section className="s9-metrics">
        {metricCards.map(([value, label, note]) => (
          <article key={label}>
            <b>{value}</b>
            <span>{label}</span>
            <small>{note}</small>
          </article>
        ))}
      </section>

      <section className="s9-builder-strip">
        <div>
          <p className="eyebrow">No-code workflow</p>
          <h2>عندما يحدث… إذا… افعل…</h2>
          <p>تقرأ القاعدة سياق الحدث فقط، ثم تطبق سياسة تنفيذ مركزية قبل أي إجراء.</p>
        </div>
        <button
          className="button primary"
          type="button"
          onClick={() => {
            (state as { automationModal: unknown }).automationModal = { type: "create-rule" };
            notifyStateChanged();
          }}
        >
          إنشاء قاعدة
        </button>
      </section>

      <section className="s9-rule-layout">
        <div className="s9-rule-list">
          <header>
            <h2>القواعد</h2>
            <div className="s9-filter-row">
              <input
                value={state.automationFilters.search}
                placeholder="ابحث في القواعد"
                onChange={(event) => {
                  state.automationFilters.search = event.target.value;
                  notifyStateChanged();
                }}
              />
              <select
                value={state.automationFilters.status}
                onChange={(event) => {
                  state.automationFilters.status = event.target.value;
                  notifyStateChanged();
                }}
              >
                <option value="all">كل الحالات</option>
                {Object.entries(automationRuleStatusLabels).map(([id, label]) => (
                  <option value={id} key={id}>{label}</option>
                ))}
              </select>
            </div>
          </header>

          {rules.map((rule) => {
            const ruleRuns = runsForRule(rule.id);
            const lastRun = ruleRuns[0];
            return (
              <article className="s9-rule-card" key={rule.id}>
                <header>
                  <div>
                    <span className="mono">{rule.id}</span>
                    <h3>{rule.name}</h3>
                  </div>
                  <StatusPill status={rule.status} labels={automationRuleStatusLabels} />
                </header>
                <p className="s9-rule-sentence">{ruleSentence(rule)}</p>
                <dl>
                  <div><dt>المشغّل</dt><dd>{triggerLabel(rule.triggerType)}</dd></div>
                  <div>
                    <dt>السياسة</dt>
                    <dd>
                      {rule.approvalPolicy === "auto_safe"
                        ? "آمن تلقائيًا"
                        : rule.approvalPolicy === "approval_required"
                          ? "تحتاج موافقة"
                          : "يدوي فقط"}
                    </dd>
                  </div>
                  <div>
                    <dt>آخر تشغيل</dt>
                    <dd>
                      {lastRun ? (
                        <>
                          <StatusPill status={lastRun.status} labels={automationRunStatusLabels} />{" "}
                          {formatDateTime(lastRun.createdAt)}
                        </>
                      ) : (
                        "لم تشغّل بعد"
                      )}
                    </dd>
                  </div>
                </dl>
                <footer>
                  <span>{rule.actionIds.length} إجراء</span>
                  <div>
                    <button
                      className="button compact"
                      type="button"
                      onClick={() => {
                        const result = testAutomationRule(rule.id, {
                          entityType: "lead",
                          entityId: "LEAD-1042",
                          eventId: "EVT-DRY-RUN",
                        });
                        toast(
                          result?.conditionResult?.matched
                            ? "نجح الاختبار الجاف: ستطابق القاعدة دون أي mutation."
                            : "نتيجة الاختبار الجاف: الشروط لا تطابق الـfixture.",
                          result?.conditionResult?.matched ? "success" : "info",
                        );
                      }}
                    >
                      اختبار القاعدة
                    </button>
                    <button
                      className="button compact"
                      type="button"
                      onClick={() => {
                        state.selectedAutomationId = rule.id;
                        go(`automation/rules/${rule.id}`);
                      }}
                    >
                      التفاصيل
                    </button>
                    <button
                      className="button compact"
                      type="button"
                      onClick={() => {
                        const updated = mutate(() =>
                          setAutomationRuleStatus(rule.id, rule.status === "enabled" ? "disabled" : "enabled"),
                        );
                        toast(
                          updated?.status === "enabled"
                            ? "تم تفعيل القاعدة محليًا."
                            : "تم تعطيل القاعدة؛ لن تنتج أي تشغيل.",
                          "info",
                        );
                      }}
                    >
                      {rule.status === "enabled" ? "تعطيل" : "تفعيل"}
                    </button>
                  </div>
                </footer>
              </article>
            );
          })}
        </div>

        <aside className="s9-rule-detail">
          {selected ? (
            <>
              <p className="eyebrow">تفاصيل القاعدة</p>
              <h2>{selected.name}</h2>
              <p>{ruleSentence(selected)}</p>
              <dl>
                <div><dt>المعرّف</dt><dd className="mono">{selected.id}</dd></div>
                <div><dt>الإصدار</dt><dd>{selected.version}</dd></div>
                <div><dt>آخر تعديل</dt><dd>{formatDateTime(selected.updatedAt)}</dd></div>
              </dl>
              <div className="s9-detail-actions">
                <button
                  className="button"
                  type="button"
                  onClick={() => {
                    const result = testAutomationRule(selected.id, {
                      entityType: "lead",
                      entityId: "LEAD-1042",
                      eventId: "EVT-DRY-RUN",
                    });
                    toast(
                      result?.conditionResult?.matched
                        ? "نجح الاختبار الجاف: ستطابق القاعدة دون أي mutation."
                        : "نتيجة الاختبار الجاف: الشروط لا تطابق الـfixture.",
                      result?.conditionResult?.matched ? "success" : "info",
                    );
                  }}
                >
                  اختبار جاف
                </button>
                {(selected.triggerType === "manual" || selected.approvalPolicy === "manual_only") && (
                  <button
                    className="button primary"
                    type="button"
                    onClick={() => {
                      const result = mutate(() => runAutomationNow(selected.id));
                      toast(
                        result.kind === "executed"
                          ? "تم تشغيل القاعدة اليدوية محليًا وتسجيل الأثر."
                          : result.kind === "awaiting_approval"
                            ? "تم إنشاء إجراء يحتاج إلى موافقة."
                            : "لا تدعم هذه القاعدة التشغيل اليدوي.",
                        result.kind === "executed" ? "success" : result.kind === "awaiting_approval" ? "info" : "error",
                      );
                    }}
                  >
                    تشغيل الآن
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="s9-empty">اختر قاعدة لعرض تفاصيلها.</div>
          )}
        </aside>
      </section>

      <section className="s9-panel s9-approval-panel">
        <header className="s9-panel-head">
          <div>
            <p className="eyebrow">طابور الموافقات</p>
            <h2>إجراءات تنتظر قرارًا بشريًا</h2>
          </div>
          <span className="s9-count">{queue.length}</span>
        </header>
        {queue.length ? (
          <div className="s9-approval-list">
            {queue.map((execution) => {
              const run = allRuns.find((item) => item.id === execution.automationRunId);
              return (
                <article key={execution.id}>
                  <div>
                    <span className="mono">{execution.id}</span>
                    <h3>{actionLabel(execution.actionType)}</h3>
                    <p>
                      {run?.ruleNameSnapshot || "قاعدة غير متاحة"} · الإصدار {run?.automationRuleVersion || "—"}
                    </p>
                    <dl className="s9-trace-meta">
                      <div><dt>المشغّل</dt><dd>{triggerLabel(run?.triggerEventType)}</dd></div>
                      <div>
                        <dt>سياق الحدث</dt>
                        <dd className="mono">
                          {run?.triggerEntityType || "—"} · {run?.triggerEntityId || "—"}
                        </dd>
                      </div>
                      <div><dt>السبب</dt><dd>{execution.requestReason || "تحققت شروط القاعدة."}</dd></div>
                      <div><dt>الموافقة</dt><dd>{execution.requiresApproval ? "مطلوبة قبل التنفيذ" : "غير مطلوبة"}</dd></div>
                      <div><dt>طُلب في</dt><dd>{formatDateTime(execution.requestedAt || run?.createdAt)}</dd></div>
                    </dl>
                    <small>البيانات المقترحة: {JSON.stringify(execution.payload)}</small>
                  </div>
                  <div className="s9-approval-actions">
                    <button
                      className="button compact"
                      type="button"
                      onClick={() => {
                        const result = mutate(() => rejectAutomationAction(execution.id));
                        toast(
                          result.kind === "rejected" ? "رُفض الإجراء؛ لم تُنفذ أي mutation." : "تعذر رفض الإجراء.",
                          result.kind === "rejected" ? "info" : "error",
                        );
                      }}
                    >
                      رفض
                    </button>
                    <button
                      className="button primary compact"
                      type="button"
                      onClick={() => {
                        const result = mutate(() => approveAutomationAction(execution.id));
                        toast(
                          result.kind === "executed"
                            ? "تمت الموافقة والتنفيذ المحلي مرة واحدة."
                            : result.kind === "no_op"
                              ? "هذا الإجراء عولج مسبقًا؛ لم تتكرر mutation."
                              : "تعذر التنفيذ بعد الموافقة.",
                          result.kind === "executed" ? "success" : "info",
                        );
                      }}
                    >
                      موافقة وتنفيذ
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="s9-empty">
            <b>لا توجد إجراءات معلقة</b>
            <p>الإجراءات الحساسة تظهر هنا قبل أي mutation محلية.</p>
          </div>
        )}
      </section>

      <section className="s9-panel s9-audit">
        <header className="s9-panel-head">
          <div>
            <p className="eyebrow">سجل التدقيق</p>
            <h2>من الحدث إلى النتيجة</h2>
          </div>
          <span>{runs.length} تشغيل</span>
        </header>
        <div className="s9-audit-list">
          {runs.map((run) => {
            const executions = getAutomationRunActionExecutions(run.id) as Row[];
            const conditionText = run.matchedConditionDetails?.length
              ? run.matchedConditionDetails.map(formatAutomationCondition).join(run.matchedConditionDetails.length > 1 ? " و " : "")
              : "من دون شرط إضافي";
            return (
              <article className="s9-audit-run" key={run.id}>
                <div className="s9-audit-trace">
                  <span className="mono">{run.id}</span>
                  <StatusPill status={run.status} labels={automationRunStatusLabels} />
                  <b>{run.ruleNameSnapshot}</b>
                  <small>
                    {triggerLabel(run.triggerEventType)} → {run.triggerEntityId} · {run.triggerEventId || "حدث قديم"}
                  </small>
                </div>
                <div className="s9-audit-flow">
                  <span>
                    الحدث: {formatDateTime(run.triggeredAt)}
                    {run.triggerMode === "manual" ? ` · تشغيل يدوي بواسطة ${userLabel(run.triggeredBy)}` : ""}
                  </span>
                  <span>الشروط: {run.matchedConditions ? `مطابقة — ${conditionText}` : "غير مطابقة"}</span>
                  {run.triggerTransition && (
                    <span>
                      الانتقال: {run.triggerTransition.from || "—"} ← {run.triggerTransition.to || "—"}
                    </span>
                  )}
                  {executions.map((execution) => (
                    <div className="s9-audit-action" key={execution.id}>
                      <span>
                        {actionLabel(execution.actionType)}:{" "}
                        <StatusPill status={execution.status} labels={automationActionStatusLabels} />
                      </span>
                      <small>
                        الموافقة: {execution.requiresApproval ? "مطلوبة" : "غير مطلوبة"} · السبب:{" "}
                        {execution.requestReason || "تحققت شروط القاعدة."}
                      </small>
                    </div>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </>
  );
}

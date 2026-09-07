/**
 * Tasks and follow-ups.
 *
 * Completion carries `If-Match`, so a second click on a task another tab has
 * already completed is a 409 the user can see, not a silent double-write. The
 * endpoint accepts completion only; nothing else is offered here because
 * nothing else is contracted.
 */
import { useState } from "react";
import { tasksApi, type TaskItem } from "../../api";
import { useApiAction, useApiResource } from "../../api/hooks";
import { useAuth } from "../../shared/context/AuthProvider";
import { go } from "../../shared/router/useHashRoute";
import { PageHead } from "../../shared/components/PageHead";
import { CrmNav } from "./components/CrmNav";
import {
  ApiEmptyState,
  ApiErrorState,
  ApiLoadingState,
  FormError,
} from "../../shared/components/ApiStates";
import { useToast } from "../../shared/store/toast";
import { Mono, fmtNumber, formatIso } from "./components/primitives";

export function TasksPage() {
  const toast = useToast();
  const { can } = useAuth();
  const [status, setStatus] = useState("");

  const tasks = useApiResource(
    (signal) => tasksApi.list({ status: status || undefined, limit: 50 }, signal),
    [status],
  );

  const complete = useApiAction((task: TaskItem) => tasksApi.complete(task.task_ref, task.version));

  const head = (
    <PageHead
      kicker="المتابعة"
      title="المهام"
      description="مهام حقيقية مرتبطة بالعملاء المحتملين، مع حماية من التنفيذ المزدوج."
    />
  );

  if (tasks.initialLoading) {
    return (
      <>
        {head}
        <ApiLoadingState title="جارٍ تحميل المهام" />
      </>
    );
  }
  if (tasks.state === "error" && tasks.error) {
    return (
      <>
        {head}
        <ApiErrorState error={tasks.error} onRetry={tasks.reload} />
      </>
    );
  }

  const rows = tasks.data?.items ?? [];

  return (
    <>
      {head}
      <CrmNav />
      <section className="card crm-filter-card">
        <div className="crm-filter-grid">
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">كل الحالات</option>
            <option value="open">مفتوحة</option>
            <option value="completed">مكتملة</option>
          </select>
        </div>
      </section>

      <FormError error={complete.error} />

      {rows.length === 0 ? (
        <ApiEmptyState
          title="لا توجد مهام"
          description="أضف مهمة متابعة من صفحة أي عميل محتمل."
        />
      ) : (
        <section className="card crm-list-card">
          <div className="table-wrap">
            <table className="data-table crm-leads-table">
              <thead>
                <tr>
                  <th>المهمة</th>
                  <th>الاستحقاق</th>
                  <th>الحالة</th>
                  <th>العميل المحتمل</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((task) => (
                  <tr key={task.task_ref}>
                    <td>
                      <b>{task.title}</b>
                    </td>
                    <td>
                      <small>{formatIso(task.due_at)}</small>
                    </td>
                    <td>
                      {task.status === "completed" ? (
                        <span className="status success">مكتملة</span>
                      ) : task.overdue ? (
                        <span className="status danger">متأخرة</span>
                      ) : (
                        <span className="status info">مفتوحة</span>
                      )}
                    </td>
                    <td>
                      {task.lead_ref ? (
                        <button
                          type="button"
                          className="row-link"
                          onClick={() => go(`crm/leads/${encodeURIComponent(task.lead_ref!)}`)}
                        >
                          <Mono>{task.lead_ref}</Mono>
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {can("task.manage") && task.status !== "completed" ? (
                        <button
                          className="button ghost compact"
                          type="button"
                          disabled={complete.pending}
                          onClick={async () => {
                            const done = await complete.run(task);
                            if (!done) return;
                            toast("أُنجزت المهمة.", "success");
                            tasks.reload();
                          }}
                        >
                          إنجاز
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="crm-pager">
            <span>{fmtNumber(rows.length)} مهمة</span>
          </div>
        </section>
      )}
    </>
  );
}

/** المهام — S9. سجل واحد للمهام اليدوية والآلية بنفس عقد S5، مع provenance للأتمتة. */
import { completeLeadTask, getLead, getTasksWorkspace, mockModel, state } from "@services/data";
import { mutate, notifyStateChanged } from "../../shared/store/appStore";
import { PageHead } from "../../shared/components/PageHead";

type Row = Record<string, any>;

const formatDateTime = (value?: string) =>
  value ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const userLabel = (id: string) => mockModel.users.find((user: Row) => user.id === id)?.name || "—";
const taskOrigin = (task: Row) => (task.createdByAutomationRunId ? "automation" : "manual");

export function Tasks() {
  const rows = getTasksWorkspace() as Row[];
  const filters = state.taskFilters;

  const setFilter = (key: string, value: string) => {
    (state.taskFilters as Record<string, string>)[key] = value;
    notifyStateChanged();
  };

  return (
    <>
      <PageHead
        kicker="S9 · Tasks"
        title="المهام"
        description="سجل واحد للمهام اليدوية والآلية. تعتمد كل مهمة على عقد S5 نفسه."
      />
      <section className="s9-panel">
        <div className="s9-filter-row">
          <input
            value={filters.search}
            placeholder="ابحث بعنوان المهمة أو المعرّف"
            onChange={(e) => setFilter("search", e.target.value)}
          />
          <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="all">كل الحالات</option>
            <option value="pending">قيد الانتظار</option>
            <option value="overdue">متأخرة</option>
            <option value="completed">مكتملة</option>
          </select>
          <select value={filters.origin} onChange={(e) => setFilter("origin", e.target.value)}>
            <option value="all">كل المصادر</option>
            <option value="automation">أنشأتها أتمتة</option>
            <option value="manual">يدوية</option>
          </select>
          <select value={filters.due} onChange={(e) => setFilter("due", e.target.value)}>
            <option value="all">كل المواعيد</option>
            <option value="overdue">متأخرة</option>
            <option value="today">اليوم</option>
            <option value="upcoming">قادمة</option>
          </select>
        </div>

        <div className="s9-table-wrap">
          <table className="s9-table">
            <thead>
              <tr>
                <th>المهمة</th><th>العميل</th><th>المالك</th><th>الحالة</th>
                <th>الاستحقاق</th><th>المصدر</th><th />
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((task) => {
                  const lead = getLead(task.leadId);
                  return (
                    <tr key={task.id}>
                      <td>
                        <b>{task.title}</b>
                        <small className="mono">{task.id}</small>
                      </td>
                      <td>{lead?.id || "—"}</td>
                      <td>{userLabel(task.ownerId)}</td>
                      <td>{task.status}</td>
                      <td>{formatDateTime(task.dueAt)}</td>
                      <td>
                        {taskOrigin(task) === "automation" ? (
                          <span className="s9-origin">أتمتة {task.createdByAutomationRunId}</span>
                        ) : (
                          "يدوي"
                        )}
                      </td>
                      <td>
                        {task.status !== "completed" && (
                          <button className="button compact" type="button" onClick={() => mutate(() => completeLeadTask(task.id))}>
                            إكمال
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7}>لا توجد مهام مطابقة.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

import { appointmentService, crmService } from "@services";
/** المواعيد — S9. مواعيد محلية قابلة للمراجعة؛ لا تقويم خارجي ولا مزامنة. */
import { useState } from "react";
import { appointmentLocationLabels as rawLocation, appointmentStatusLabels as rawStatus, appointmentTypeLabels as rawType, listUsers } from "@services";
import { go } from "../../shared/router/useHashRoute";
import { PageHead } from "../../shared/components/PageHead";

type Row = Record<string, any>;

const appointmentStatusLabels = rawStatus as Record<string, string>;
const appointmentTypeLabels = rawType as Record<string, string>;
const appointmentLocationLabels = rawLocation as Record<string, string>;

const formatDateTime = (value?: string) =>
  value ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
const userLabel = (id: string) => listUsers().find((user: Row) => user.id === id)?.name || "—";

export function Appointments() {
  const appointments = appointmentService.getAppointments() as Row[];
  const [filters, setFilters] = useState({ status: "all", ownerId: "all", type: "all" });

  const setFilter = (key: string, value: string) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  return (
    <>
      <PageHead
        kicker="S9 · Appointments"
        title="المواعيد"
        description="مواعيد محلية قابلة للمراجعة؛ لا يوجد تقويم خارجي أو مزامنة."
        actions={
          <button
            className="button primary"
            type="button"
            onClick={() => {
              go("appointments?modal=create-appointment");
            }}
          >
            موعد جديد
          </button>
        }
      />
      <section className="s9-panel">
        <div className="s9-filter-row">
          <select value={filters.status} onChange={(e) => setFilter("status", e.target.value)}>
            <option value="all">كل الحالات</option>
            {Object.entries(appointmentStatusLabels).map(([id, label]) => (
              <option value={id} key={id}>{label}</option>
            ))}
          </select>
          <select value={filters.ownerId} onChange={(e) => setFilter("ownerId", e.target.value)}>
            <option value="all">كل المالكين</option>
            {listUsers().map((user: Row) => (
              <option value={user.id} key={user.id}>{user.name}</option>
            ))}
          </select>
          <select value={filters.type} onChange={(e) => setFilter("type", e.target.value)}>
            <option value="all">كل الأنواع</option>
            {Object.entries(appointmentTypeLabels).map(([id, label]) => (
              <option value={id} key={id}>{label}</option>
            ))}
          </select>
        </div>

        <div className="s9-appointment-list">
          {appointments.length ? (
            appointments.map((appointment) => {
              const lead = crmService.getLead(appointment.leadId);
              return (
                <article key={appointment.id}>
                  <div className="s9-appointment-time">
                    <b>{formatDateTime(appointment.startsAt)}</b>
                    <small>حتى {formatDateTime(appointment.endsAt)}</small>
                  </div>
                  <div>
                    <h3>{appointment.title}</h3>
                    <p>
                      {lead?.id || "—"} · {userLabel(appointment.ownerId)} · {appointmentTypeLabels[appointment.type]}
                    </p>
                    <small>
                      {appointmentLocationLabels[appointment.locationType]} · {appointment.location}
                    </small>
                  </div>
                  <aside>
                    <span className={`s9-status ${appointment.status}`}>
                      {appointmentStatusLabels[appointment.status] || appointment.status}
                    </span>
                    {appointment.createdByAutomationRunId && (
                      <span className="s9-origin">أتمتة {appointment.createdByAutomationRunId}</span>
                    )}
                    {appointment.overlapWarning && <span className="s9-warning">تداخل محتمل</span>}
                  </aside>
                </article>
              );
            })
          ) : (
            <div className="s9-empty">لا توجد مواعيد مطابقة.</div>
          )}
        </div>
      </section>
    </>
  );
}

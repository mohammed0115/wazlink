/** نافذة إنشاء موعد — S9. موعد محلي فقط؛ لا تقويم خارجي، وينبه عند التداخل. */
import type { FormEvent, MouseEvent } from "react";
import {
  appointmentLocationLabels as rawLocation,
  appointmentTypeLabels as rawType,
  createAppointment,
  mockModel,
  state,
} from "@services/data";
import { mutate, notifyStateChanged } from "../../shared/store/appStore";
import { useToast } from "../../shared/store/toast";
import { useModalDismiss } from "../../shared/components/useModalDismiss";

type Row = Record<string, any>;
const appointmentTypeLabels = rawType as Record<string, string>;
const appointmentLocationLabels = rawLocation as Record<string, string>;

export function AppointmentModal() {
  const toast = useToast();
  const modal = state.appointmentModal as { type?: string } | null;
  if (modal?.type !== "create-appointment") return null;

  const close = () => {
    (state as { appointmentModal: unknown }).appointmentModal = null;
    notifyStateChanged();
  };
  const panelRef = useModalDismiss(close);

  const onBackdrop = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) close();
  };

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const result = mutate(() =>
      createAppointment({
        title: String(data.get("title") || ""),
        leadId: String(data.get("leadId") || ""),
        ownerId: String(data.get("ownerId") || ""),
        startsAt: String(data.get("startsAt") || ""),
        endsAt: String(data.get("endsAt") || ""),
        type: String(data.get("type") || "meeting"),
        locationType: String(data.get("locationType") || "online"),
        location: String(data.get("location") || ""),
      }),
    );
    close();
    const created = result as { kind?: string; appointment?: Record<string, any> } | null;
    if (created?.kind === "created") {
      toast(
        created.appointment?.overlapWarning
          ? "أُنشئ الموعد محليًا مع تنبيه تداخل محتمل."
          : "أُنشئ الموعد المحلي بنجاح.",
        created.appointment?.overlapWarning ? "warning" : "success",
      );
    } else {
      toast("تعذر إنشاء الموعد؛ راجع التواريخ والمالك.", "error");
    }
  }

  return (
    <div className="s9-modal-backdrop" onClick={onBackdrop}>
      <section ref={panelRef as never} tabIndex={-1} className="s9-modal" role="dialog" aria-modal="true" aria-labelledby="s9AppointmentTitle">
        <header>
          <div>
            <p className="eyebrow">موعد محلي</p>
            <h2 id="s9AppointmentTitle">إنشاء موعد</h2>
          </div>
          <button className="modal-close" type="button" onClick={close} aria-label="إغلاق">×</button>
        </header>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label className="form-field wide">
              العنوان
              <input name="title" required placeholder="مثال: مراجعة العرض" />
            </label>
            <label className="form-field">
              <span>العميل</span>
              <select name="leadId">
                {mockModel.leads.map((lead: Row) => (
                  <option value={lead.id} key={lead.id}>{lead.id}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>المالك</span>
              <select name="ownerId">
                {mockModel.users.map((user: Row) => (
                  <option value={user.id} key={user.id}>{user.name}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>يبدأ</span>
              <input name="startsAt" type="datetime-local" required defaultValue="2026-08-16T11:00" />
            </label>
            <label className="form-field">
              <span>ينتهي</span>
              <input name="endsAt" type="datetime-local" required defaultValue="2026-08-16T11:30" />
            </label>
            <label className="form-field">
              <span>النوع</span>
              <select name="type">
                {Object.entries(appointmentTypeLabels).map(([id, label]) => (
                  <option value={id} key={id}>{label}</option>
                ))}
              </select>
            </label>
            <label className="form-field">
              <span>المكان</span>
              <select name="locationType">
                {Object.entries(appointmentLocationLabels).map(([id, label]) => (
                  <option value={id} key={id}>{label}</option>
                ))}
              </select>
            </label>
            <label className="form-field wide">
              الوصف المحلي
              <input name="location" defaultValue="رابط تجريبي محلي" />
            </label>
          </div>
          <footer>
            <button className="button" type="button" onClick={close}>إلغاء</button>
            <button className="button primary" type="submit">إنشاء الموعد</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

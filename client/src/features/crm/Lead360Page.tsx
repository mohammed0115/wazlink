/**
 * Lead 360 — composed by the backend, rendered here.
 *
 * The whole page is ONE read: `GET /leads/{ref}` returns every section the
 * actor may see plus the first page of the merged timeline. Two consequences
 * are deliberate:
 *
 *  - The frontend never assembles a timeline. Ordering, de-duplication and
 *    per-source permission are the composer's job, and re-doing any of it here
 *    would produce a second, divergent history.
 *  - A missing section means "not permitted / not shipped", not "empty". Each
 *    section renders that distinction instead of flattening it.
 *
 * A Lead created manually has no Business and no Discovery provenance, and the
 * page is fully usable in that state — which is the point of the whole slice.
 */
import { useState } from "react";
import {
  leadsApi,
  newIdempotencyKey,
  tasksApi,
  type LeadPriority,
  type LeadStatus,
  type Party360,
} from "../../api";
import { useApiAction, useApiResource } from "../../api/hooks";
import { useAuth } from "../../shared/context/AuthProvider";
import { go } from "../../shared/router/useHashRoute";
import { PageHead } from "../../shared/components/PageHead";
import { ApiErrorState, ApiLoadingState, FormError } from "../../shared/components/ApiStates";
import { useToast } from "../../shared/store/toast";
import {
  ContactRow,
  LeadStatusBadge,
  Mono,
  OriginChip,
  PartySection,
  PriorityBadge,
  formatIso,
  leadPriorityLabels,
  leadStatusLabels,
} from "./components/primitives";
import { PartyTimeline } from "./components/PartyTimeline";
import { CustomFieldsSection } from "./components/CustomFieldsSection";
import { PartyFilesSection } from "./components/PartyFilesSection";

export function Lead360Page({ leadRef }: { leadRef: string }) {
  const toast = useToast();
  const { can } = useAuth();
  const view = useApiResource<Party360>((signal) => leadsApi.get360(leadRef, signal), [leadRef]);

  const [noteBody, setNoteBody] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDue, setTaskDue] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const lead = view.data?.lead;
  const version = lead?.version ?? 0;

  const setStatus = useApiAction((status: LeadStatus) =>
    leadsApi.setStatus(leadRef, status, version),
  );
  const setPriority = useApiAction((priority: LeadPriority) =>
    leadsApi.setPriority(leadRef, priority, version),
  );
  const addNote = useApiAction(() => leadsApi.addNote(leadRef, noteBody));
  const addTask = useApiAction(() =>
    tasksApi.create({
      title: taskTitle,
      lead_ref: leadRef,
      due_at: taskDue ? new Date(taskDue).toISOString() : null,
    }),
  );
  const addContact = useApiAction(() =>
    leadsApi.addContact(leadRef, { name: contactName, phone: contactPhone }),
  );
  const convert = useApiAction((partyKind: "organization" | "person") =>
    leadsApi.convertToCustomer(leadRef, partyKind, version, newIdempotencyKey()),
  );

  if (view.initialLoading) return <ApiLoadingState title="جارٍ تحميل ملف العميل المحتمل" />;
  if (view.state === "error" && view.error) {
    return (
      <ApiErrorState
        error={view.error}
        onRetry={view.reload}
        actions={
          <button className="button ghost" type="button" onClick={() => go("crm")}>
            العودة إلى القائمة
          </button>
        }
      />
    );
  }
  if (!view.data) return null;

  const sections = view.data;
  const displayName = lead?.display_name || leadRef;

  const runAndReload = async (promise: Promise<unknown>, message: string) => {
    const result = await promise;
    if (result === null) return;
    toast(message, "success");
    view.reload();
  };

  return (
    <>
      <PageHead
        kicker="ملف 360"
        title={displayName}
        description="كل الأقسام مركّبة في الخادم مع احترام الصلاحيات؛ لا يُبنى أي سجل زمني في المتصفح."
        actions={
          <button className="button ghost" type="button" onClick={() => go("crm")}>
            العودة إلى القائمة
          </button>
        }
      />

      <section className="card lead-360-hero">
        <div className="lead-identity">
          <i className="company-mark">{displayName.slice(0, 1)}</i>
          <div>
            <h2>{displayName}</h2>
            <p>{lead?.display_subtitle || "بدون وصف"}</p>
            <span>
              <Mono>{leadRef}</Mono> · <OriginChip origin={lead?.origin_type || "manual"} />
            </span>
          </div>
        </div>

        <div className="lead-quick-state">
          <div>
            <span>الحالة</span>
            {can("lead.update") ? (
              <select
                value={lead?.status || "new"}
                disabled={setStatus.pending}
                onChange={(event) =>
                  runAndReload(setStatus.run(event.target.value as LeadStatus), "تم تحديث الحالة.")
                }
              >
                {Object.entries(leadStatusLabels).map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
              </select>
            ) : (
              <LeadStatusBadge status={lead?.status || "new"} />
            )}
          </div>
          <div>
            <span>الأولوية</span>
            {can("lead.update") ? (
              <select
                value={lead?.priority || "medium"}
                disabled={setPriority.pending}
                onChange={(event) =>
                  runAndReload(
                    setPriority.run(event.target.value as LeadPriority),
                    "تم تحديث الأولوية.",
                  )
                }
              >
                {Object.entries(leadPriorityLabels).map(([key, label]) => (
                  <option value={key} key={key}>
                    {label}
                  </option>
                ))}
              </select>
            ) : (
              <PriorityBadge priority={lead?.priority || "medium"} />
            )}
          </div>
          <div>
            <span>آخر نشاط</span>
            <b>{formatIso(lead?.last_activity_at)}</b>
          </div>
        </div>
      </section>

      <FormError error={setStatus.error || setPriority.error || convert.error} />

      {can("customer.create") && lead && !lead.converted_at ? (
        <section className="card crm-create-panel">
          <div>
            <b>تحويل إلى عميل</b>
            <p className="crm-create-hint">
              التحويل صريح ومحمي ضد التكرار. إعادة المحاولة على نفس العميل المحتمل تعيد تعارضًا
              واضحًا بدل إنشاء عميل مكرر.
            </p>
          </div>
          <div className="crm-create-actions">
            <button
              className="button primary"
              type="button"
              disabled={convert.pending}
              onClick={async () => {
                const created = await convert.run("organization");
                if (!created) return;
                toast("تم التحويل إلى عميل.", "success");
                go(`crm/customers/${encodeURIComponent(created.customer_ref)}`);
              }}
            >
              {convert.pending ? "جارٍ التحويل…" : "تحويل كمنشأة"}
            </button>
            <button
              className="button ghost"
              type="button"
              disabled={convert.pending}
              onClick={async () => {
                const created = await convert.run("person");
                if (!created) return;
                toast("تم التحويل إلى عميل.", "success");
                go(`crm/customers/${encodeURIComponent(created.customer_ref)}`);
              }}
            >
              تحويل كفرد
            </button>
          </div>
        </section>
      ) : null}

      <div className="party-360-grid">
        <div className="party-column">
          <PartySection
            title="جهات الاتصال"
            present={sections.contacts !== undefined}
            isEmpty={(sections.contacts ?? []).length === 0}
            emptyText="لا توجد جهات اتصال."
          >
            {(sections.contacts ?? []).map((contact) => (
              <ContactRow key={contact.contact_ref} contact={contact} />
            ))}
          </PartySection>

          {can("contact.manage") ? (
            <section className="card crm-create-panel">
              <b>إضافة جهة اتصال</b>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="newContactName">الاسم</label>
                  <input
                    id="newContactName"
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="newContactPhone">الجوال</label>
                  <input
                    id="newContactPhone"
                    className="ltr"
                    value={contactPhone}
                    onChange={(event) => setContactPhone(event.target.value)}
                  />
                </div>
              </div>
              <FormError error={addContact.error} />
              <div className="crm-create-actions">
                <button
                  className="button primary compact"
                  type="button"
                  disabled={addContact.pending || !contactName.trim()}
                  onClick={async () => {
                    const created = await addContact.run();
                    if (!created) return;
                    setContactName("");
                    setContactPhone("");
                    toast("أُضيفت جهة الاتصال.", "success");
                    view.reload();
                  }}
                >
                  إضافة
                </button>
              </div>
            </section>
          ) : null}

          <PartySection
            title="السجل الزمني"
            present={true}
            isEmpty={sections.activities.length === 0}
            emptyText="لا توجد أنشطة بعد."
          >
            <PartyTimeline entries={sections.activities} />
          </PartySection>
        </div>

        <div className="party-column">
          <PartySection
            title="المهام"
            present={sections.tasks !== undefined}
            isEmpty={(sections.tasks ?? []).length === 0}
            emptyText="لا توجد مهام."
          >
            {(sections.tasks ?? []).map((task) => (
              <div className="party-row" key={task.task_ref}>
                <span className="grow">
                  <b>{task.title}</b>
                  <small>
                    {task.status === "completed" ? "مكتملة" : "مفتوحة"} · {formatIso(task.due_at)}
                  </small>
                </span>
                {task.overdue && task.status !== "completed" ? (
                  <span className="status danger">متأخرة</span>
                ) : null}
              </div>
            ))}
          </PartySection>

          {can("task.manage") ? (
            <section className="card crm-create-panel">
              <b>إضافة مهمة متابعة</b>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="newTaskTitle">العنوان</label>
                  <input
                    id="newTaskTitle"
                    value={taskTitle}
                    onChange={(event) => setTaskTitle(event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="newTaskDue">تاريخ الاستحقاق</label>
                  <input
                    id="newTaskDue"
                    type="datetime-local"
                    className="ltr"
                    value={taskDue}
                    onChange={(event) => setTaskDue(event.target.value)}
                  />
                </div>
              </div>
              <FormError error={addTask.error} />
              <div className="crm-create-actions">
                <button
                  className="button primary compact"
                  type="button"
                  disabled={addTask.pending || !taskTitle.trim()}
                  onClick={async () => {
                    const created = await addTask.run();
                    if (!created) return;
                    setTaskTitle("");
                    setTaskDue("");
                    toast("أُضيفت المهمة.", "success");
                    view.reload();
                  }}
                >
                  إضافة مهمة
                </button>
              </div>
            </section>
          ) : null}

          <PartySection
            title="الملاحظات"
            present={sections.notes !== undefined}
            isEmpty={(sections.notes ?? []).length === 0}
            emptyText="لا توجد ملاحظات."
          >
            {(sections.notes ?? []).map((note) => (
              <article key={note.note_ref}>
                <p>{note.body}</p>
                <small>{formatIso(note.created_at)}</small>
              </article>
            ))}
          </PartySection>

          {can("lead.update") ? (
            <section className="card crm-create-panel">
              <b>إضافة ملاحظة</b>
              <textarea
                aria-label="نص الملاحظة"
                value={noteBody}
                onChange={(event) => setNoteBody(event.target.value)}
                placeholder="سجل ما دار في المكالمة…"
              />
              <FormError error={addNote.error} />
              <div className="crm-create-actions">
                <button
                  className="button primary compact"
                  type="button"
                  disabled={addNote.pending || !noteBody.trim()}
                  onClick={async () => {
                    const created = await addNote.run();
                    if (!created) return;
                    setNoteBody("");
                    toast("أُضيفت الملاحظة.", "success");
                    view.reload();
                  }}
                >
                  حفظ الملاحظة
                </button>
              </div>
            </section>
          ) : null}

          <PartySection
            title="الصفقات"
            present={sections.deals !== undefined}
            isEmpty={(sections.deals ?? []).length === 0}
            emptyText="لا توجد صفقات مرتبطة."
          >
            {(sections.deals ?? []).map((deal) => (
              <div className="party-row" key={deal.deal_ref}>
                <span className="grow">
                  <b>{deal.title}</b>
                  <small>
                    <Mono>{deal.deal_ref}</Mono>
                  </small>
                </span>
                <button
                  className="button ghost compact"
                  type="button"
                  onClick={() => go(`deals/${encodeURIComponent(deal.deal_ref)}`)}
                >
                  فتح
                </button>
              </div>
            ))}
          </PartySection>

          <CustomFieldsSection
            subjectType="lead"
            values={sections.custom_fields}
            onSave={(values) => leadsApi.setCustomFields(leadRef, values)}
            onSaved={view.reload}
          />

          <PartyFilesSection
            subjectType="lead"
            subjectRef={leadRef}
            files={sections.files}
            onChanged={view.reload}
          />
        </div>
      </div>
    </>
  );
}

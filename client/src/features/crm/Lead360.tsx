/**
 * ملف العميل 360 — S5.
 *
 * منقول عن `renderLead360()`. يقرأ Business وIntelligence والمصدر **بالمرجع**
 * ولا ينسخ Score أو Opportunity داخل Lead. الصفقات والمحادثات عرض سياقي فقط.
 */
import type { FormEvent } from "react";
import {
  addLeadNote,
  addLeadTask,
  assignLeadOwner,
  businesses,
  completeLeadTask,
  getDiscoveryJob,
  getDiscoverySource,
  getLead,
  getLeadActivities,
  getLeadContacts,
  getLeadConversations,
  getLeadDeals,
  getLeadNotes,
  getLeadOwner,
  getLeadTasks,
  mockModel,
  state,
  updateLeadPriority,
  updateLeadStatus,
} from "@domain/data.js";
import { getBusinessIntelligence } from "@domain/intelligence.js";
import { go } from "../../shared/router/useHashRoute";
import { mutate } from "../../shared/store/appStore";
import { PageHead } from "../../shared/components/PageHead";
import { LeadDealControls } from "../sales/LeadDealControls";
import {
  LeadAiControls,
  LeadAutomationControls,
  LeadConversationControls,
} from "./LeadControlPanels";
import {
  LeadRail,
  Mono,
  ScoreBadge,
  fmt,
  formatIso,
  leadPriorityLabels,
  leadStatusLabels,
  tierLabels,
  userName,
} from "./shared";

const timelineIcons: Record<string, string> = {
  conversion: "↗", intelligence_reviewed: "◌", owner_changed: "⇄", status_changed: "•",
  priority_changed: "!", note_added: "✎", task_created: "○", task_completed: "✓",
  message_sent: "✉", message_retry: "↻",
};

function scoreReference(record: any) {
  return record.score === null
    ? "لا توجد درجة بسبب نقص الأدلة"
    : `${record.score}/100 · ${tierLabels[record.tier]} · ثقة ${Math.round(record.confidence * 100)}%`;
}

export function Lead360({ leadId }: { leadId: string }) {
  const lead = getLead(leadId);

  if (!lead) {
    return (
      <PageHead
        kicker="CRM"
        title="لم نجد Lead"
        description="قد يكون الرابط غير صحيح أو لم تُنشأ Lead في هذه الجلسة."
        actions={
          <button className="button primary" type="button" onClick={() => go("crm")}>
            العودة إلى CRM
          </button>
        }
      />
    );
  }

  const business = businesses.find((item: any) => item.id === lead.businessId);
  const owner = getLeadOwner(lead);
  const contacts = getLeadContacts(lead.id);
  const tasks = getLeadTasks(lead.id);
  const notes = getLeadNotes(lead.id);
  const activities = getLeadActivities(lead.id);
  const deals = getLeadDeals(lead.id);
  const conversations = getLeadConversations(lead.id);
  const record = getBusinessIntelligence(lead.businessId) as any;
  const job = getDiscoveryJob(lead.sourceJobId);
  const source = job && getDiscoverySource(job.sourceId);

  function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = String(new FormData(form).get("body") || "").trim();
    if (!body) return;
    mutate(() => addLeadNote(lead.id, { body }));
    form.reset();
  }

  function submitTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    mutate(() =>
      addLeadTask(lead.id, {
        title: String(data.get("title") || ""),
        type: String(data.get("type") || "متابعة"),
        ownerId: String(data.get("ownerId") || lead.ownerId),
        priority: String(data.get("priority") || lead.priority),
        dueAt: String(data.get("dueAt") || ""),
      }),
    );
    form.reset();
  }

  return (
    <>
      <PageHead
        kicker="Lead 360"
        title={business?.name || lead.id}
        description="ملف CRM موحد يقرأ Business وIntelligence والمصدر مباشرة بدل نسخ سياقها داخل Lead."
        actions={
          <>
            <button className="button" type="button" onClick={() => go("crm")}>العودة إلى CRM</button>
            <button
              className="button primary"
              type="button"
              onClick={() => {
                if (business?.id) state.selectedBusinessId = business.id;
                go(`intelligence?business=${business?.id}`);
              }}
            >
              فتح ذكاء Business
            </button>
          </>
        }
      />

      <LeadRail lead={lead} business={business} job={job} source={source} />

      <section className="lead-360-hero card">
        <div className="lead-identity">
          <i className="company-mark">{business?.short?.slice(0, 1) || "ع"}</i>
          <div>
            <span>
              <Mono>{lead.id}</Mono> · أضيفت {formatIso(lead.convertedAt)}
            </span>
            <h2>{business?.name || "Business غير متاحة"}</h2>
            <p>
              {business?.category || "—"} · {business?.city || "—"}
            </p>
          </div>
        </div>
        <div className="lead-quick-state">
          <div>
            <span>الحالة</span>
            <select value={lead.status} onChange={(e) => mutate(() => updateLeadStatus(lead.id, e.target.value))}>
              {Object.entries(leadStatusLabels).map(([key, label]) => (
                <option value={key} key={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <span>الأولوية</span>
            <select value={lead.priority} onChange={(e) => mutate(() => updateLeadPriority(lead.id, e.target.value))}>
              {Object.entries(leadPriorityLabels).map(([key, label]) => (
                <option value={key} key={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <span>المالك</span>
            <select value={lead.ownerId} onChange={(e) => mutate(() => assignLeadOwner(lead.id, e.target.value))}>
              {mockModel.users.map((user: any) => (
                <option value={user.id} key={user.id}>{user.name}</option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="lead-360-grid">
        <div className="lead-main-column">
          <article className="card">
            <header className="card-head">
              <div>
                <h2>سياق Intelligence</h2>
                <p>مرجع حي من S4، ولا تنسخ Lead Score أو Opportunity.</p>
              </div>
              <button type="button" className="button ghost" onClick={() => go(`intelligence?business=${business?.id}`)}>
                فتح التحليل
              </button>
            </header>
            <div className="lead-intelligence-strip">
              <div>
                <ScoreBadge record={record} />
                <span>{scoreReference(record)}</span>
              </div>
              <div>
                <b>الأسباب</b>
                <span>{record.reasons.slice(0, 2).map((reason: any) => reason.value).join(" · ") || "لا توجد فجوة مثبتة"}</span>
              </div>
              <div>
                <b>الخدمات</b>
                <span>{record.services.map((service: any) => service.name).join(" · ") || "لا توجد خدمة مقترحة"}</span>
              </div>
              <div>
                <b>أسلوب التواصل</b>
                <span>{record.salesApproach || "لا يوجد أسلوب مقترح دون فجوة مثبتة"}</span>
              </div>
            </div>
          </article>

          <article className="card">
            <header className="card-head">
              <div>
                <h2>جهات الاتصال</h2>
                <p>مرتبطة بـLead الحالية فقط.</p>
              </div>
            </header>
            <div className="lead-contact-list">
              {contacts.length ? (
                contacts.map((contact: any) => (
                  <div key={contact.id}>
                    <i>◉</i>
                    <span>
                      <b>{contact.name}</b>
                      <small>{contact.title || "جهة اتصال"}</small>
                    </span>
                    <em className="ltr">{contact.phone || contact.email || "—"}</em>
                  </div>
                ))
              ) : (
                <div className="crm-empty-inline">لا توجد جهة اتصال قابلة للتواصل في Business الحالية.</div>
              )}
            </div>
          </article>

          <article className="card">
            <header className="card-head">
              <div>
                <h2>الملاحظات</h2>
                <p>ملاحظات تشغيلية محلية مع الطابع الزمني.</p>
              </div>
            </header>
            <form className="lead-note-form" onSubmit={submitNote}>
              <textarea name="body" placeholder="أضف ملاحظة للفريق..." />
              <button className="button" type="submit">حفظ الملاحظة</button>
            </form>
            <div className="lead-note-list">
              {notes.length ? (
                notes.map((note: any) => (
                  <article key={note.id}>
                    <p>{note.body}</p>
                    <small>
                      {formatIso(note.createdAt)} · {userName(note.authorId)}
                    </small>
                  </article>
                ))
              ) : (
                <p className="muted">لا توجد ملاحظات بعد.</p>
              )}
            </div>
          </article>

          <article className="card">
            <header className="card-head">
              <div>
                <h2>سجل النشاط</h2>
                <p>أحداث متسقة زمنيًا من التحويل والعمل داخل CRM.</p>
              </div>
            </header>
            <ol className="lead-timeline">
              {activities.length ? (
                activities.map((item: any) => (
                  <li key={item.id}>
                    <i>{timelineIcons[item.type] || "•"}</i>
                    <div>
                      <b>{item.title}</b>
                      <p>{item.detail}</p>
                      <small>
                        {formatIso(item.createdAt)} · {userName(item.actorId)}
                      </small>
                    </div>
                  </li>
                ))
              ) : (
                <li className="empty">
                  <div>
                    <b>لا توجد أحداث بعد.</b>
                    <p>ستظهر التحويلات والمهام والملاحظات وتغييرات Lead هنا.</p>
                  </div>
                </li>
              )}
            </ol>
          </article>
        </div>

        <aside className="lead-side-column">
          <article className="card">
            <header className="card-head">
              <div>
                <h2>المتابعات والمهام</h2>
                <p>تغلق المهمة داخل CRM محليًا.</p>
              </div>
            </header>
            <div className="lead-task-list">
              {tasks.length ? (
                tasks.map((task: any) => (
                  <div className={task.status === "completed" ? "completed" : ""} key={task.id}>
                    <span>{task.status === "completed" ? "✓" : "○"}</span>
                    <div>
                      <b>{task.title}</b>
                      <small>
                        {task.type} · {formatIso(task.dueAt)} · {userName(task.ownerId)}
                      </small>
                    </div>
                    {task.status === "completed" ? (
                      <em>مكتملة</em>
                    ) : (
                      <button
                        type="button"
                        className="button ghost compact"
                        onClick={() => mutate(() => completeLeadTask(task.id))}
                      >
                        إكمال
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p className="muted">لا توجد مهام بعد.</p>
              )}
            </div>
            <form className="lead-task-form" onSubmit={submitTask}>
              <input name="title" placeholder="عنوان متابعة" required />
              <select name="type">
                <option>متابعة</option>
                <option>اتصال</option>
                <option>اجتماع</option>
              </select>
              <select name="ownerId" defaultValue={lead.ownerId}>
                {mockModel.users.map((user: any) => (
                  <option value={user.id} key={user.id}>{user.name}</option>
                ))}
              </select>
              <select name="priority" defaultValue={lead.priority}>
                {Object.entries(leadPriorityLabels).map(([key, label]) => (
                  <option value={key} key={key}>{label}</option>
                ))}
              </select>
              <input name="dueAt" type="datetime-local" defaultValue="2026-08-16T10:00" required />
              <button className="button" type="submit">إضافة مهمة</button>
            </form>
          </article>

          <article className="card">
            <header className="card-head">
              <div>
                <h2>المصدر والسياق</h2>
                <p>سلسلة التحويل محفوظة.</p>
              </div>
            </header>
            <dl className="lead-provenance">
              <div><dt>Source</dt><dd>{source?.name || "—"} <Mono>{source?.id || "—"}</Mono></dd></div>
              <div><dt>Discovery Job</dt><dd><Mono>{job?.id || "—"}</Mono></dd></div>
              <div><dt>Business</dt><dd><Mono>{business?.id || "—"}</Mono></dd></div>
              <div><dt>Analysis</dt><dd><Mono>{record.analysis?.id || "—"}</Mono></dd></div>
              <div><dt>Opportunity</dt><dd><Mono>{record.opportunity?.id || "—"}</Mono></dd></div>
            </dl>
          </article>

          <article className="card">
            <header className="card-head">
              <div>
                <h2>المحادثات والصفقات</h2>
                <p>عرض سياقي مرتبط بالسجل نفسه.</p>
              </div>
            </header>
            <p className="lead-readonly">
              <b>{fmt(conversations.length)}</b> محادثة مرتبطة · <b>{fmt(deals.length)}</b> Deal مرتبطة.
            </p>
            <LeadDealControls leadId={lead.id} />
            <LeadConversationControls leadId={lead.id} />
            <LeadAiControls leadId={lead.id} />
            <LeadAutomationControls leadId={lead.id} />
          </article>
        </aside>
      </section>
    </>
  );
}

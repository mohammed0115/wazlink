/**
 * صندوق الوارد — S7.
 *
 * منقول عن `renderInbox()`. رسائل واتساب **محلية تجريبية فقط**: لا API ولا
 * Webhook ولا Meta/Twilio ولا رد آلي. كل رسالة صادرة `senderType = user`
 * وتبدأ `queued` ثم تنتقل محليًا إلى `sent` فـ`delivered`.
 */
import { useEffect, useState } from "react";
import { appConfig } from "@config/env";
import { advanceMockMessageStatus, assignConversation, closeConversation, conversationStatusLabels as rawConvStatus, getConversation, getConversationBusiness, getConversationContact, getConversationContext, getConversationMessages, getConversationNeedsReply, getDealProbability, getDealStage, getInboxConversations, getInboxSummary, getLeadActivitySummary, getLeadOwner, leadPriorityLabels as rawPriority, leadStatusLabels as rawLeadStatus, messageDeliveryLabels as rawDelivery, reopenConversation, retryMockMessage, sendMockMessage, listUsers, listQuickReplyTemplates, getUiState } from "@services";
import { getBusinessIntelligence, tierLabels as rawTiers } from "@domain/intelligence.js";
import { go } from "../../shared/router/useHashRoute";
import { mutate, notifyStateChanged } from "../../shared/store/appStore";
import { useToast } from "../../shared/store/toast";
import { PageHead } from "../../shared/components/PageHead";
import { CopilotPanel } from "../ai/CopilotPanel";

const conversationStatusLabels = rawConvStatus as Record<string, string>;
const messageDeliveryLabels = rawDelivery as Record<string, string>;
const leadStatusLabels = rawLeadStatus as Record<string, string>;
const leadPriorityLabels = rawPriority as Record<string, string>;
const tierLabels = rawTiers as Record<string, string>;

type Row = Record<string, any>;
type Attachment = { name: string; size: string } | null;

/** حالة واجهة الوارد: مسودات ومرفق تجريبي — تبدأ فارغة في الـfixture. */
const drafts = () => getUiState().inboxDrafts as Record<string, string>;
const attachmentState = () => getUiState().inboxAttachment as Attachment;
const setAttachment = (value: Attachment) => {
  (getUiState() as { inboxAttachment: Attachment }).inboxAttachment = value;
};

const fmt = (value: number | null | undefined) => new Intl.NumberFormat("ar-SA").format(value || 0);
const money = (value: number) => `${fmt(value)} ر.س`;
const timeLabel = (value?: string) =>
  value ? new Intl.DateTimeFormat("ar-SA", { hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "—";

function dayLabel(value?: string) {
  const date = String(value || "").slice(0, 10);
  if (date === "2026-08-15") return "اليوم";
  if (date === "2026-08-14") return "أمس";
  return new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "long" }).format(new Date(value || ""));
}

const ownerName = (ownerId: string) =>
  listUsers().find((user: Row) => user.id === ownerId)?.name || "غير مسند";

function messagePreview(message?: Row) {
  if (!message) return "لا توجد رسائل بعد";
  if (message.type === "image") return "صورة تجريبية";
  if (message.type === "document") return "مستند تجريبي";
  return message.body || "رسالة تجريبية";
}

function Mono({ children }: { children: React.ReactNode }) {
  return <span className="mono">{children || "—"}</span>;
}

export function Inbox({ conversationId }: { conversationId?: string }) {
  const toast = useToast();
  const [isMobile] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches);

  const rows = getInboxConversations();
  const summary = getInboxSummary();
  const filters = getUiState().inboxFilters;

  const explicit = Boolean(conversationId);
  const selectedId = explicit ? conversationId : isMobile ? null : getUiState().selectedConversationId;
  const conversation = selectedId ? getConversation(selectedId) : null;
  const visibleSelected = rows.some((row: Row) => row.conversation.id === conversation?.id) ? conversation : null;

  // انتقال حالة الرسالة محليًا: queued → sent → delivered
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (advanceMockMessageStatus()) notifyStateChanged();
    }, 800);
    return () => window.clearInterval(timer);
  }, []);

  const setFilter = (key: string, value: string) => {
    (getUiState().inboxFilters as Record<string, string>)[key] = value;
    notifyStateChanged();
  };

  if (explicit && !conversation) {
    return (
      <>
        <PageHead
          kicker="صندوق الوارد"
          title="لم نجد المحادثة"
          description="قد يكون رابط المحادثة غير صحيح أو لا يوجد ضمن بيانات الجلسة التجريبية."
          actions={
            <button className="button primary" type="button" onClick={() => go("inbox")}>
              العودة إلى صندوق الوارد
            </button>
          }
        />
        <section className="s7-not-found">
          <i>!</i>
          <h2>المحادثة غير متاحة</h2>
          <p>تحقق من المعرّف أو افتح محادثة من القائمة المحلية.</p>
        </section>
      </>
    );
  }

  return (
    <>
      <PageHead
        kicker="التواصل"
        title="صندوق الوارد"
        description="إدارة رسائل بشرية داخل قناة واتساب تجريبية محلية؛ لا توجد API أو رسالة خارجية أو رد آلي."
        actions={<span className="s7-wa-label large">واتساب — وضع تجريبي</span>}
      />

      <section className="decision-rail s7-decision-rail" aria-label="سكة قرار التواصل">
        <div className="decision-brand">
          <img src={`${appConfig.assetBaseUrl}wazlink-mark.svg`} alt="wazlink" />
          سكة القرار
        </div>
        <div className="decision-steps">
          <span className="done"><i>١</i><b>اكتشاف</b></span>
          <span className="done"><i>٢</i><b>فهم</b></span>
          <span className="done"><i>٣</i><b>CRM</b></span>
          <span className="active"><i>٤</i><b>تواصل</b></span>
          <span><i>٥</i><b>صفقة</b></span>
        </div>
        <small>رسائل بشرية محلية فقط</small>
      </section>

      <section className="s7-summary" aria-label="ملخص صندوق الوارد">
        <article><span>مفتوحة</span><b>{fmt(summary.open)}</b><small>من مصدر المحادثات</small></article>
        <article><span>غير مقروءة</span><b>{fmt(summary.unread)}</b><small>رسائل واردة فقط</small></article>
        <article><span>تحتاج ردًا</span><b>{fmt(summary.needsReply)}</b><small>آخر رسالة واردة</small></article>
        <article><span>مغلقة</span><b>{fmt(summary.closed)}</b><small>سجل محفوظ محليًا</small></article>
      </section>

      <section className="s7-filters" aria-label="فلاتر صندوق الوارد">
        <label className="s7-search">
          <span>⌕</span>
          <input
            value={filters.search}
            placeholder="ابحث بالشركة أو جهة الاتصال أو الهاتف أو معرف العميل أو المحادثة"
            onChange={(e) => setFilter("search", e.target.value)}
          />
        </label>
        <label>
          <span>الحالة</span>
          <select value={filters.filter} onChange={(e) => setFilter("filter", e.target.value)}>
            <option value="all">كل المحادثات</option>
            <option value="unread">غير المقروءة</option>
            <option value="needs_reply">تحتاج ردًا</option>
            <option value="open">مفتوحة</option>
            <option value="closed">مغلقة</option>
          </select>
        </label>
        <label>
          <span>المسؤول</span>
          <select value={filters.ownerId} onChange={(e) => setFilter("ownerId", e.target.value)}>
            <option value="all">كل المسؤولين</option>
            {listUsers().map((user: Row) => (
              <option value={user.id} key={user.id}>{user.name}</option>
            ))}
          </select>
        </label>
        <label>
          <span>الترتيب</span>
          <select value={filters.sort} onChange={(e) => setFilter("sort", e.target.value)}>
            <option value="latest">الأحدث نشاطًا</option>
            <option value="oldest_waiting">الأطول انتظارًا</option>
            <option value="unread">غير المقروءة أولًا</option>
          </select>
        </label>
      </section>

      <section className={`s7-inbox-layout ${visibleSelected ? "has-selected" : ""}`}>
        <aside className="s7-list-panel">
          <header>
            <div>
              <b>{fmt(rows.length)} محادثات</b>
              <small>القائمة مشتقة من Conversations</small>
            </div>
          </header>
          <div className="s7-conversation-list">
            {rows.length ? (
              rows.map((row: Row) => {
                const { conversation: item, business, contact, latest, needsReply } = row;
                const selected = item.id === visibleSelected?.id;
                const displayName = contact?.name || business?.name || "جهة اتصال غير محددة";
                return (
                  <button
                    type="button"
                    className={`s7-conversation-row ${selected ? "selected" : ""}`}
                    aria-current={selected ? "true" : "false"}
                    key={item.id}
                    onClick={() => {
                      getUiState().selectedConversationId = item.id;
                      go(`inbox/${item.id}`);
                    }}
                  >
                    <div className="s7-row-avatar">{displayName.slice(0, 1)}</div>
                    <div className="s7-row-copy">
                      <div>
                        <b>{displayName}</b>
                        <small>{business?.short || business?.name || "شركة غير معروفة"}</small>
                      </div>
                      <p>{messagePreview(latest)}</p>
                      <footer>
                        <span className="s7-channel">واتساب</span>
                        {needsReply && <span className="s7-needs-reply">تحتاج ردًا</span>}
                        <time>{timeLabel(item.lastMessageAt)}</time>
                      </footer>
                    </div>
                    <div className="s7-row-meta">
                      <span className="s7-assignee">{ownerName(item.assignedTo).split(" ")[0]}</span>
                      {Boolean(item.unreadCount) && (
                        <b className="s7-unread" aria-label={`${item.unreadCount} رسائل غير مقروءة`}>
                          {fmt(item.unreadCount)}
                        </b>
                      )}
                      <small>{conversationStatusLabels[item.status]}</small>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="s7-list-empty">
                <b>لا توجد محادثات بعد</b>
                <p>غيّر البحث أو الفلاتر؛ لا ينشئ S7 محادثة وهمية تلقائيًا.</p>
              </div>
            )}
          </div>
        </aside>

        <main className="s7-thread-panel">
          {visibleSelected ? (
            <ConversationThread conversation={visibleSelected} toast={toast} />
          ) : (
            <section className="s7-thread-empty">
              <i>⌕</i>
              <b>اختر محادثة لعرض التفاصيل</b>
              <p>يعرض الجزء الأيمن سياق العميل والفرصة عند اختيار محادثة.</p>
            </section>
          )}
        </main>

        {visibleSelected && <ContextPanel conversation={visibleSelected} />}
      </section>
    </>
  );
}

function ConversationThread({ conversation, toast }: { conversation: Row; toast: (m: string, t?: any) => void }) {
  const contact = getConversationContact(conversation);
  const business = getConversationBusiness(conversation);
  const needsReply = getConversationNeedsReply(conversation);
  const messages = getConversationMessages(conversation.id);
  const draft = drafts()[conversation.id] || "";
  const attachment = attachmentState();

  let lastDay = "";

  return (
    <>
      <header className="s7-thread-head">
        <div>
          <span className="s7-wa-label">واتساب — وضع تجريبي</span>
          <h2>{contact?.name || business?.name || "جهة اتصال غير محددة"}</h2>
          <p>
            <Mono>{conversation.id}</Mono> · {conversationStatusLabels[conversation.status]}
            {needsReply ? " · تحتاج ردًا" : ""}
          </p>
        </div>
        <div className="s7-thread-head-controls">
          <button type="button" className="button ghost compact s7-mobile-back" onClick={() => go("inbox")}>
            كل المحادثات
          </button>
          <div className="s7-thread-actions">
            {conversation.status === "open" ? (
              <button
                type="button"
                className="button ghost compact"
                onClick={() => {
                  const result = mutate(() => closeConversation(conversation.id));
                  toast(result ? "أُغلقت المحادثة محليًا." : "لا يمكن الإغلاق مع وجود رسائل واردة غير مقروءة.", result ? "info" : "error");
                }}
              >
                إغلاق المحادثة
              </button>
            ) : (
              <button
                type="button"
                className="button primary compact"
                onClick={() => {
                  mutate(() => reopenConversation(conversation.id));
                  toast("أُعيد فتح المحادثة محليًا.", "info");
                }}
              >
                إعادة فتح
              </button>
            )}
            <button
              type="button"
              className="button ghost compact"
              onClick={() => {
                getUiState().inboxContextOpen = !getUiState().inboxContextOpen;
                notifyStateChanged();
              }}
            >
              السياق
            </button>
          </div>
        </div>
      </header>

      {messages.length ? (
        <div className="s7-messages" aria-label="رسائل المحادثة">
          {messages.map((message: Row) => {
            const currentDay = String(message.createdAt).slice(0, 10);
            const separator = currentDay !== lastDay ? dayLabel(message.createdAt) : null;
            lastDay = currentDay;
            const outgoing = message.direction === "outbound";
            return (
              <div key={message.id}>
                {separator && (
                  <div className="s7-day-separator">
                    <span>{separator}</span>
                  </div>
                )}
                <article className={`s7-message ${outgoing ? "outgoing" : "incoming"}`}>
                  <div className="s7-message-body">
                    {message.body && <p>{message.body}</p>}
                    {message.attachment && (
                      <div className="s7-attachment">
                        <i>{message.type === "image" ? "▧" : "▤"}</i>
                        <span>
                          <b>{message.attachment.name}</b>
                          <small>{message.attachment.size} · تجريبي</small>
                        </span>
                      </div>
                    )}
                  </div>
                  <footer>
                    <time>{timeLabel(message.createdAt)}</time>
                    {outgoing && (
                      <span className={`s7-delivery ${message.status}`}>
                        {messageDeliveryLabels[message.status] || "حالة تجريبية"}
                      </span>
                    )}
                    {outgoing && message.status === "failed" && (
                      <button
                        type="button"
                        className="button danger compact"
                        onClick={() => {
                          mutate(() => retryMockMessage(message.id));
                          toast("أُعيدت المحاولة على الرسالة نفسها بلا نسخة جديدة.", "info");
                        }}
                      >
                        إعادة المحاولة
                      </button>
                    )}
                  </footer>
                </article>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="s7-thread-empty">
          <i>◌</i>
          <b>لا توجد رسائل بعد</b>
          <p>يمكن كتابة رد بشري تجريبي عند الحاجة.</p>
        </div>
      )}

      <section className="s7-composer-shell">
        <div className="s7-templates" aria-label="ردود سريعة ثابتة">
          {listQuickReplyTemplates().map((template: Row) => (
            <button
              type="button"
              className="button ghost compact"
              key={template.id}
              onClick={() => {
                drafts()[conversation.id] = template.body;
                notifyStateChanged();
              }}
            >
              {template.title}
            </button>
          ))}
        </div>
        <form
          className="s7-composer"
          onSubmit={(event) => {
            event.preventDefault();
            const body = String(new FormData(event.currentTarget).get("body") || "").trim();
            if (!body) {
              toast("اكتب نص الرسالة قبل الإرسال.", "error");
              return;
            }
            const result = mutate(() => sendMockMessage(conversation.id, { body, attachment }));
            if (result) {
              drafts()[conversation.id] = "";
              setAttachment(null);
              notifyStateChanged();
              toast("أُرسلت رسالة بشرية محلية؛ لا يوجد إرسال خارجي.", "success");
            } else {
              toast("تعذر الإرسال في حالة المحادثة الحالية.", "error");
            }
          }}
        >
          <label htmlFor="messageComposer" className="sr-only">اكتب ردًا بشريًا</label>
          <textarea
            id="messageComposer"
            name="body"
            rows={3}
            placeholder="اكتب ردًا بشريًا…"
            disabled={conversation.status !== "open"}
            value={draft}
            onChange={(event) => {
              drafts()[conversation.id] = event.target.value;
              notifyStateChanged();
            }}
          />
          <div className="s7-composer-actions">
            <div>
              <button
                type="button"
                className="button ghost compact"
                onClick={() => {
                  setAttachment(attachment ? null : { name: "عرض-تجريبي.pdf", size: "240KB" });
                  notifyStateChanged();
                }}
              >
                إرفاق وصف تجريبي
              </button>
              {attachment && (
                <span className="s7-attachment-chip">
                  {attachment.name}
                  <button
                    type="button"
                    aria-label="إزالة المرفق"
                    onClick={() => {
                      setAttachment(null);
                      notifyStateChanged();
                    }}
                  >
                    ×
                  </button>
                </span>
              )}
            </div>
            <div>
              <small>إرسال محلي تجريبي فقط</small>
              <button type="submit" className="button primary" disabled={conversation.status !== "open"}>
                إرسال بشري
              </button>
            </div>
          </div>
        </form>
      </section>
    </>
  );
}

function ContextPanel({ conversation }: { conversation: Row }) {
  const { lead, business, contact, deals, job, source } = getConversationContext(conversation.id);
  const leadActivity = lead ? getLeadActivitySummary(lead.id) : null;
  const intelligence = business ? (getBusinessIntelligence(business.id) as any) : null;

  return (
    <aside className={`s7-context ${getUiState().inboxContextOpen ? "open" : ""}`} aria-label="سياق العميل ومساعد المبيعات">
      <header>
        <div>
          <p className="eyebrow">سياق CRM</p>
          <h2>العميل والفرصة</h2>
        </div>
        <button
          type="button"
          className="button ghost compact"
          onClick={() => {
            getUiState().inboxContextOpen = false;
            notifyStateChanged();
          }}
        >
          إغلاق السياق
        </button>
      </header>

      <article className="s7-context-card">
        <span>جهة الاتصال</span>
        <b>{contact?.name || "جهة اتصال غير محددة"}</b>
        <p>{contact?.title || "لا يوجد منصب مسجل"}</p>
        <small dir="ltr">{contact?.phone || business?.phone || "لا يوجد هاتف"}</small>
        <small>{contact?.email || business?.email || "لا يوجد بريد"}</small>
      </article>

      <article className="s7-context-card">
        <span>Lead</span>
        <b>{business?.name || lead?.id || "—"}</b>
        <dl>
          <div><dt>المعرف</dt><dd><Mono>{lead?.id}</Mono></dd></div>
          <div><dt>الحالة</dt><dd>{leadStatusLabels[lead?.status] || "—"}</dd></div>
          <div><dt>الأولوية</dt><dd>{leadPriorityLabels[lead?.priority] || "—"}</dd></div>
          <div><dt>المالك</dt><dd>{getLeadOwner(lead)?.name || "—"}</dd></div>
          <div><dt>آخر نشاط</dt><dd>{leadActivity?.lastActivityAt ? timeLabel(leadActivity.lastActivityAt) : "—"}</dd></div>
          <div><dt>التالي</dt><dd>{leadActivity?.nextTask?.title || "لا توجد مهمة"}</dd></div>
        </dl>
        <button type="button" className="button ghost compact" onClick={() => lead?.id && go(`crm/leads/${lead.id}`)}>
          فتح Lead 360
        </button>
      </article>

      <article className="s7-context-card">
        <span>مسؤول المحادثة</span>
        <label className="s7-owner-select">
          <span>يختلف عن مالك Lead عند الحاجة</span>
          <select
            aria-label="مسؤول المحادثة"
            value={conversation.assignedTo}
            onChange={(event) => mutate(() => assignConversation(conversation.id, event.target.value))}
          >
            {listUsers().map((user: Row) => (
              <option value={user.id} key={user.id}>{user.name}</option>
            ))}
          </select>
        </label>
      </article>

      <article className="s7-context-card">
        <span>ذكاء الفرص — قراءة فقط</span>
        <b>
          {intelligence?.score ?? "—"}
          {intelligence?.score !== undefined && intelligence?.score !== null ? "/100" : ""}
        </b>
        <p>
          {intelligence?.tier ? tierLabels[intelligence.tier] : "بيانات غير كافية"} · ثقة{" "}
          {fmt(Math.round((intelligence?.confidence || 0) * 100))}%
        </p>
        <small><strong>الفجوة:</strong> {intelligence?.reasons?.[0]?.value || "لا توجد فجوة مثبتة"}</small>
        <small><strong>الخدمة:</strong> {intelligence?.services?.[0]?.name || "لا توجد خدمة مقترحة"}</small>
        <small><strong>النهج:</strong> {intelligence?.salesApproach || "لا يوجد نهج مقترح"}</small>
      </article>

      <article className="s7-context-card">
        <span>الصفقات المرتبطة — قراءة فقط</span>
        {deals.length ? (
          <div className="s7-deal-context-list">
            {deals.map((deal: Row) => {
              const stage = getDealStage(deal);
              return (
                <button type="button" key={deal.id} onClick={() => go(`deals/${deal.id}`)}>
                  <b>{deal.title}</b>
                  <small>
                    {stage?.name || "—"} · {money(deal.value)} · {getDealProbability(deal)}% · {deal.expectedCloseAt || "—"}
                  </small>
                </button>
              );
            })}
          </div>
        ) : (
          <p>لا توجد صفقات مرتبطة.</p>
        )}
      </article>

      <CopilotPanel conversationId={conversation.id} />

      <article className="s7-context-card s7-provenance">
        <span>الأصل والسياق</span>
        <p>
          <Mono>{source?.id}</Mono> ← <Mono>{job?.id}</Mono> ← <Mono>{business?.id}</Mono> ← <Mono>{lead?.id}</Mono> ←{" "}
          <Mono>{conversation.id}</Mono>
        </p>
        <small>سلسلة مرجعية للعرض فقط.</small>
      </article>
    </aside>
  );
}

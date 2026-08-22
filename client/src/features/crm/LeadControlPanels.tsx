/**
 * لوحات Lead 360 التابعة للشحنات اللاحقة.
 *
 * - المحادثات (S7): عرض مرجعي؛ لا ينشئ رسالة.
 * - مساعد المبيعات (S8): قراءة فقط؛ لا mutation تلقائية.
 * - الأتمتة والمواعيد (S9): قراءة مرجعية؛ لا جدولة ولا إرسال.
 */
import {
  conversationStatusLabels as rawConvStatus,
  getAutomationRuns,
  getConversationLatestMessage,
  getConversationNeedsReply,
  getConversationUnreadCount,
  getLeadAppointments,
  getLeadContacts,
  getLeadConversations,
  mockModel,
} from "@domain/data.js";
import { getAiSalesInsights } from "@domain/sales-ai.js";
import { go } from "../../shared/router/useHashRoute";
import { fmt, formatIso } from "./shared";

type Row = Record<string, any>;
const conversationStatusLabels = rawConvStatus as Record<string, string>;

export function LeadConversationControls({ leadId }: { leadId: string }) {
  const contacts = getLeadContacts(leadId) as Row[];
  const conversations = getLeadConversations(leadId) as Row[];

  if (!conversations.length) {
    return (
      <div className="s7-lead-conversations-empty">
        <b>لا توجد محادثات مرتبطة</b>
        <span>ستظهر محادثات WhatsApp التجريبية المرتبطة بهذه Lead هنا.</span>
      </div>
    );
  }

  return (
    <div className="s7-lead-conversation-list">
      <div className="s7-lead-conversation-head">
        <b>محادثات WhatsApp التجريبية</b>
        <button type="button" className="button ghost compact" onClick={() => go("inbox")}>فتح Inbox</button>
      </div>
      {conversations.map((conversation) => {
        const contact = conversation.contactId ? contacts.find((item) => item.id === conversation.contactId) : null;
        const latest = getConversationLatestMessage(conversation);
        const unread = conversation.unreadCount || getConversationUnreadCount(conversation);
        return (
          <button
            type="button"
            className="s7-lead-conversation"
            key={conversation.id}
            onClick={() => go(`inbox/${conversation.id}`)}
          >
            <span>واتساب</span>
            <div>
              <b>{contact?.name || "جهة اتصال غير محددة"}</b>
              <small>{latest?.body || "لا توجد رسالة نصية"}</small>
            </div>
            <em>
              {unread ? `${fmt(unread)} غير مقروء` : conversationStatusLabels[conversation.status]}
              {getConversationNeedsReply(conversation) ? " · تحتاج ردًا" : ""}
            </em>
          </button>
        );
      })}
    </div>
  );
}

export function LeadAiControls({ leadId }: { leadId: string }) {
  const insights = getAiSalesInsights(leadId) as Row;
  const nba = insights.nba;
  const pending = insights.pendingAction;

  if (!nba && !pending) {
    return (
      <div className="s8-lead-insights">
        <div>
          <b>مساعد المبيعات</b>
          <span>لا توجد توصية محفوظة بعد. افتح محادثة مرتبطة وشغّل التحليل المحلي.</span>
        </div>
        <button type="button" className="button ghost compact" onClick={() => go("inbox")}>فتح Inbox</button>
      </div>
    );
  }

  return (
    <div className="s8-lead-insights">
      <div>
        <b>مساعد المبيعات — قراءة فقط</b>
        <span>
          {nba?.payload?.label || "لا يوجد إجراء تالٍ"} · ثقة {Math.round((nba?.confidence || 0) * 100)}%
        </span>
        <small>
          {pending
            ? `يوجد اقتراح Agent ${pending.status === "proposed" ? "بانتظار الموافقة" : "في السجل"}.`
            : "لا توجد mutation تلقائية."}
        </small>
      </div>
      <button
        type="button"
        className="button ghost compact"
        onClick={() => go(`inbox/${nba?.conversationId || "CONV-3042"}`)}
      >
        فتح Copilot
      </button>
    </div>
  );
}

export function LeadAutomationControls({ leadId }: { leadId: string }) {
  const appointments = getLeadAppointments(leadId) as Row[];
  const runsForRule = getAutomationRuns as unknown as (ruleId?: string | null) => Row[];
  const runs = runsForRule().filter(
    (run) =>
      run.triggerEntityId === leadId ||
      mockModel.conversations.find((conversation: Row) => conversation.id === run.triggerEntityId)?.leadId === leadId ||
      mockModel.deals.find((deal: Row) => deal.id === run.triggerEntityId)?.leadId === leadId,
  );

  return (
    <div className="s9-lead-automation">
      <div className="s9-lead-automation-head">
        <div>
          <b>الأتمتة والمواعيد — قراءة مرجعية</b>
          <span>تشغيلات محلية محكومة؛ لا توجد جدولة أو إرسال.</span>
        </div>
        <button type="button" className="button ghost compact" onClick={() => go("automation")}>فتح الأتمتة</button>
      </div>
      <div className="s9-lead-automation-grid">
        <div>
          <small>المواعيد</small>
          <b>{fmt(appointments.length)}</b>
          <span>
            {appointments[0] ? `${appointments[0].title} · ${formatIso(appointments[0].startsAt)}` : "لا يوجد موعد"}
          </span>
        </div>
        <div>
          <small>تشغيلات مرتبطة</small>
          <b>{fmt(runs.length)}</b>
          <span>{runs[0]?.status || "لا توجد تشغيلات"}</span>
        </div>
      </div>
    </div>
  );
}

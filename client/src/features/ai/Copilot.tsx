/** مساحة مساعد المبيعات — S8. لا ينشئ فتح المسار رسالة أو Task أو تعديلًا. */
import { getConversation, state } from "@domain/data.js";
import { go } from "../../shared/router/useHashRoute";
import { PageHead } from "../../shared/components/PageHead";
import { CopilotPanel } from "./CopilotPanel";

export function Copilot() {
  const conversation = getConversation(state.selectedConversationId);
  return (
    <>
      <PageHead
        kicker="مساعد المبيعات"
        title="Copilot داخل المحادثة"
        description="التحليل الحتمي يعرض توصيات وأدلة فقط؛ استخدم Inbox لمراجعة المحادثة ثم إدراج الرد يدويًا."
        actions={
          <button className="button primary" type="button" onClick={() => go("inbox")}>
            فتح Inbox
          </button>
        }
      />
      <section className="s8-copilot-workspace">
        {conversation ? (
          <CopilotPanel conversationId={conversation.id} />
        ) : (
          <div className="s8-empty">
            <i>✧</i>
            <b>اختر محادثة أولًا</b>
            <p>الرد المقترح لا يتوفر دون Conversation محددة، ولا ينشئ النظام محادثة تلقائيًا.</p>
            <button className="button primary" type="button" onClick={() => go("inbox")}>فتح Inbox</button>
          </div>
        )}
      </section>
    </>
  );
}

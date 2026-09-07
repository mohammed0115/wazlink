/**
 * Team Inbox — conversations, messages, AI assistance and the human send.
 *
 * THE SAFETY INVARIANT THIS SCREEN EXISTS TO PRESERVE:
 * AI may draft, summarise and suggest. A customer-visible WhatsApp message is
 * sent ONLY when a person presses Send.
 *
 * How that is enforced here, not merely promised:
 *  - `agentApi.accept()` puts the drafted text into the composer and does
 *    nothing else. It is not chained to a send, and there is no effect, timer,
 *    or callback in this file that calls `messagesApi.send` on its own.
 *  - `messagesApi.send` is reached from exactly ONE place: the click handler
 *    of the Send button below.
 *  - The draft sits in a visually distinct panel labelled as unsent, so the
 *    difference between "the assistant wrote this" and "the customer received
 *    this" is legible at a glance.
 *
 * The backend enforces the same boundary independently — `message.send` is a
 * human membership permission and the agent API has no send endpoint at all —
 * so this UI is the second lock, not the only one.
 */
import { useEffect, useMemo, useState } from "react";
import {
  agentApi,
  authApi,
  conversationsApi,
  isApiError,
  messagesApi,
  type AgentProposalPayload,
  type ConversationPayload,
  type HandlingMode,
} from "../../api";
import { useApiAction, useApiResource } from "../../api/hooks";
import { useAuth } from "../../shared/context/AuthProvider";
import { go } from "../../shared/router/useHashRoute";
import { PageHead } from "../../shared/components/PageHead";
import {
  ApiEmptyState,
  ApiErrorState,
  ApiLoadingState,
  FormError,
} from "../../shared/components/ApiStates";
import { useToast } from "../../shared/store/toast";
import { Mono, formatIso } from "../crm/components/primitives";

const MODE_LABELS: Record<HandlingMode, string> = { ai: "مساعدة آلية", human: "متابعة بشرية" };

function ConversationList({
  items,
  activeRef,
  onSelect,
}: {
  items: ConversationPayload[];
  activeRef: string;
  onSelect: (ref: string) => void;
}) {
  return (
    <article className="card party-section">
      <header>
        <h3>المحادثات</h3>
      </header>
      <div className="party-body">
        {items.length === 0 ? (
          <p className="party-empty">لا توجد محادثات.</p>
        ) : (
          items.map((conversation) => (
            <div
              className="party-row"
              key={conversation.conversation_ref}
              data-active={conversation.conversation_ref === activeRef}
            >
              <button
                type="button"
                className="row-link grow"
                onClick={() => onSelect(conversation.conversation_ref)}
              >
                <span className="grow">
                  <b className="ltr">{conversation.peer_address || conversation.conversation_ref}</b>
                  <small>
                    {MODE_LABELS[conversation.handling_mode] || conversation.handling_mode} ·{" "}
                    {formatIso(conversation.last_message_at)}
                  </small>
                </span>
              </button>
              {conversation.unread_count > 0 ? (
                <span className="status info">{conversation.unread_count}</span>
              ) : null}
            </div>
          ))
        )}
      </div>
    </article>
  );
}

/**
 * AI assistance panel.
 *
 * Generation is asynchronous (202 + slow queue), so this polls for the
 * proposal a bounded number of times and then stops with an honest message
 * rather than spinning forever. Accepting only fills the composer.
 */
function AssistancePanel({
  conversationRef,
  onDraft,
}: {
  conversationRef: string;
  onDraft: (text: string) => void;
}) {
  const toast = useToast();
  const { can } = useAuth();
  const [sessionRef, setSessionRef] = useState("");
  const [proposal, setProposal] = useState<AgentProposalPayload | null>(null);
  const [waiting, setWaiting] = useState(false);

  const request = useApiAction(async () => {
    const session = await agentApi.startSession(conversationRef);
    setSessionRef(session.session_ref);
    await agentApi.requestProposal(session.session_ref, "draft_reply");
    return session;
  });

  const accept = useApiAction((row: AgentProposalPayload) =>
    agentApi.accept(row.proposal_ref, row.version),
  );

  useEffect(() => {
    if (!sessionRef || !waiting) return;
    let attempts = 0;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;
      try {
        const page = await agentApi.list({ status: "proposed", limit: 20 });
        const match = page.items.find((row) => row.session_ref === sessionRef);
        if (match) {
          setProposal(match);
          setWaiting(false);
          return;
        }
      } catch (cause) {
        // NOT_CONFIGURED / provider unavailable are normal outcomes here.
        setWaiting(false);
        if (isApiError(cause)) toast(cause.message, "info");
        return;
      }
      if (attempts >= 10) {
        setWaiting(false);
        toast("لم يصل اقتراح من المساعد. يمكنك الكتابة يدويًا.", "info");
        return;
      }
      window.setTimeout(poll, 1200);
    };

    const timer = window.setTimeout(poll, 800);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [sessionRef, waiting, toast]);

  if (!can("ai.use")) return null;

  return (
    <div className="ai-draft-panel">
      <span className="ai-draft-label">مساعدة الذكاء الاصطناعي — مسودة غير مُرسَلة</span>
      <FormError error={request.error || accept.error} />
      <div className="crm-state-actions">
        <button
          className="button ghost compact"
          type="button"
          disabled={request.pending || waiting}
          onClick={async () => {
            setProposal(null);
            const started = await request.run();
            if (!started) return;
            setWaiting(true);
          }}
        >
          {request.pending || waiting ? "جارٍ إعداد المسودة…" : "اقترح ردًا"}
        </button>
        {proposal ? (
          <button
            className="button ghost compact"
            type="button"
            disabled={accept.pending}
            onClick={async () => {
              const accepted = await accept.run(proposal);
              if (!accepted) return;
              // The ONLY effect: the text lands in the composer. Nothing is sent.
              onDraft(accepted.text || proposal.text);
              setProposal(null);
              toast("نُقلت المسودة إلى صندوق الكتابة. لم تُرسَل بعد.", "info");
            }}
          >
            استخدام المسودة
          </button>
        ) : null}
      </div>
      {proposal ? <p className="ai-send-notice">{proposal.text}</p> : null}
      <p className="ai-send-notice">
        <b>لا يُرسل المساعد أي رسالة إلى العميل.</b> الإرسال يتم فقط عند ضغطك على زر «إرسال».
      </p>
    </div>
  );
}

export function InboxPage({ conversationId }: { conversationId?: string }) {
  const toast = useToast();
  const { can } = useAuth();
  const [activeRef, setActiveRef] = useState(conversationId || "");
  const [composer, setComposer] = useState("");
  const [aiAssisted, setAiAssisted] = useState(false);
  const [filter, setFilter] = useState<"all" | "unassigned" | "unread">("all");

  const list = useApiResource(
    (signal) =>
      conversationsApi.list(
        {
          status: "open",
          ...(filter === "unassigned" ? { unassigned: "true" as const } : {}),
          ...(filter === "unread" ? { unread: "true" as const } : {}),
          limit: 50,
        },
        signal,
      ),
    [filter],
  );

  const detail = useApiResource(
    (signal) => conversationsApi.get(activeRef, { limit: 50 }, signal),
    [activeRef],
    { enabled: Boolean(activeRef) },
  );

  const send = useApiAction(() =>
    messagesApi.send({ conversation_ref: activeRef, body: composer, ai_assisted: aiAssisted }),
  );
  const setMode = useApiAction((mode: HandlingMode, version: number) =>
    conversationsApi.setHandlingMode(activeRef, mode, version),
  );
  const takeover = useApiAction((version: number) =>
    conversationsApi.startTakeover(activeRef, version),
  );
  // Ownership is a server-side change with its own audit trail. The UI sends
  // the intent and re-reads the result; it never mutates an owner locally.
  const assign = useApiAction((membershipRef: string, version: number) =>
    conversationsApi.assign(activeRef, membershipRef, version),
  );
  const members = useApiResource((signal) => authApi.members(signal), [], {
    enabled: can("member.view"),
  });
  const releaseTakeover = useApiAction((version: number) =>
    conversationsApi.endTakeover(activeRef, version),
  );

  const items = useMemo(() => list.data?.items ?? [], [list.data]);

  useEffect(() => {
    if (!activeRef && items.length > 0) setActiveRef(items[0].conversation_ref);
  }, [activeRef, items]);

  const head = (
    <PageHead
      kicker="المحادثات"
      title="صندوق الوارد الموحد"
      description="محادثات حقيقية من قاعدة البيانات. الإرسال إلى العميل فعل بشري صريح دائمًا."
    />
  );

  if (list.initialLoading) {
    return (
      <>
        {head}
        <ApiLoadingState title="جارٍ تحميل المحادثات" />
      </>
    );
  }
  if (list.state === "error" && list.error) {
    return (
      <>
        {head}
        <ApiErrorState error={list.error} onRetry={list.reload} />
      </>
    );
  }
  if (items.length === 0) {
    return (
      <>
        {head}
        <ApiEmptyState
          title="لا توجد محادثات"
          description="تظهر المحادثات هنا عند وصول رسالة عبر القناة المرتبطة."
        />
      </>
    );
  }

  const conversation = detail.data;

  return (
    <>
      {head}
      <section className="card crm-filter-card">
        <div className="crm-filter-grid">
          <select value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
            <option value="all">كل المحادثات المفتوحة</option>
            <option value="unassigned">غير المسندة</option>
            <option value="unread">غير المقروءة</option>
          </select>
        </div>
      </section>

      <div className="party-360-grid">
        <div className="party-column">
          <article className="card party-section">
            <header>
              <h3>
                {conversation ? (
                  <span className="ltr">{conversation.peer_address}</span>
                ) : (
                  "اختر محادثة"
                )}
              </h3>
              {conversation ? (
                <div className="crm-state-actions">
                  {can("conversation.view") ? (
                    <select
                      aria-label="وضع المعالجة"
                      value={conversation.handling_mode}
                      disabled={setMode.pending}
                      onChange={async (event) => {
                        const result = await setMode.run(
                          event.target.value as HandlingMode,
                          conversation.version,
                        );
                        if (!result) return;
                        toast("تم تحديث وضع المعالجة.", "success");
                        detail.reload();
                      }}
                    >
                      {Object.entries(MODE_LABELS).map(([key, label]) => (
                        <option value={key} key={key}>
                          {label}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {can("member.view") ? (
                    <select
                      aria-label="إسناد المحادثة"
                      value={conversation.assigned_to_ref || ""}
                      disabled={assign.pending}
                      onChange={async (event) => {
                        if (!event.target.value) return;
                        const result = await assign.run(event.target.value, conversation.version);
                        if (!result) return;
                        toast("أُسندت المحادثة.", "success");
                        detail.reload();
                        list.reload();
                      }}
                    >
                      <option value="">غير مسندة</option>
                      {(members.data?.items ?? []).map((member) => (
                        <option value={member.membership_ref} key={member.membership_ref}>
                          {member.email || member.membership_ref}
                        </option>
                      ))}
                    </select>
                  ) : null}
                  {conversation.takeover_by_ref ? (
                    <button
                      className="button ghost compact"
                      type="button"
                      disabled={releaseTakeover.pending}
                      onClick={async () => {
                        const result = await releaseTakeover.run(conversation.version);
                        if (!result) return;
                        toast("أُنهي الاستلام البشري.", "info");
                        detail.reload();
                      }}
                    >
                      إنهاء الاستلام
                    </button>
                  ) : (
                    <button
                      className="button ghost compact"
                      type="button"
                      disabled={takeover.pending}
                      onClick={async () => {
                        const result = await takeover.run(conversation.version);
                        if (!result) return;
                        toast("تم الاستلام البشري.", "success");
                        detail.reload();
                      }}
                    >
                      استلام بشري
                    </button>
                  )}
                </div>
              ) : null}
            </header>

            <div className="party-body">
              {detail.initialLoading ? (
                <p className="party-empty">جارٍ تحميل الرسائل…</p>
              ) : detail.error ? (
                <ApiErrorState error={detail.error} onRetry={detail.reload} />
              ) : conversation ? (
                <>
                  {conversation.contact_ref || conversation.customer_ref ? (
                    <p className="party-restricted">
                      مرتبطة بـ{" "}
                      <Mono>{conversation.customer_ref || conversation.contact_ref}</Mono> — الربط
                      يقرره الخادم ولا تُنشأ أطراف جديدة تلقائيًا.
                    </p>
                  ) : (
                    <p className="party-restricted">
                      لم يربط الخادم هذه المحادثة بطرف بعد. لا يُنشئ الواجهة طرفًا جديدًا من تلقائه.
                    </p>
                  )}

                  {[...conversation.messages]
                    .slice()
                    .reverse()
                    .map((message) => (
                      <div className="party-row" key={message.message_ref}>
                        <span className="grow">
                          <b>{message.direction === "inbound" ? "العميل" : "الفريق"}</b>
                          <small>{message.body}</small>
                          <small>
                            {formatIso(message.occurred_at)} · {message.status}
                            {message.ai_assisted ? " · بمساعدة الذكاء الاصطناعي" : ""}
                          </small>
                        </span>
                      </div>
                    ))}

                  <AssistancePanel
                    conversationRef={conversation.conversation_ref}
                    onDraft={(text) => {
                      setComposer(text);
                      setAiAssisted(true);
                    }}
                  />

                  {can("message.send") ? (
                    <>
                      <textarea
                        aria-label="نص الرسالة"
                        value={composer}
                        onChange={(event) => setComposer(event.target.value)}
                        placeholder="اكتب رسالتك…"
                        style={{
                          minHeight: "88px",
                          padding: "9px",
                          font: "inherit",
                          borderRadius: "6px",
                        }}
                      />
                      <FormError error={send.error} />
                      <div className="crm-state-actions">
                        <button
                          className="button primary"
                          type="button"
                          disabled={send.pending || !composer.trim()}
                          onClick={async () => {
                            const sent = await send.run();
                            if (!sent) return;
                            setComposer("");
                            setAiAssisted(false);
                            toast("أُرسلت الرسالة.", "success");
                            detail.reload();
                            list.reload();
                          }}
                        >
                          {send.pending ? "جارٍ الإرسال…" : "إرسال"}
                        </button>
                        {aiAssisted ? (
                          <span className="crm-create-hint">
                            ستُوسم الرسالة بأنها كُتبت بمساعدة الذكاء الاصطناعي، والمُرسِل أنت.
                          </span>
                        ) : null}
                      </div>
                    </>
                  ) : (
                    <p className="party-restricted">لا تملك صلاحية الإرسال في هذه المحادثة.</p>
                  )}
                </>
              ) : (
                <p className="party-empty">اختر محادثة من القائمة.</p>
              )}
            </div>
          </article>
        </div>

        <div className="party-column">
          <ConversationList
            items={items}
            activeRef={activeRef}
            onSelect={(ref) => {
              setActiveRef(ref);
              setComposer("");
              setAiAssisted(false);
              go(`inbox/${encodeURIComponent(ref)}`);
            }}
          />
        </div>
      </div>
    </>
  );
}

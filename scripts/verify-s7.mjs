import { readFileSync } from "node:fs";
import { stripComments } from "./lib/ui-sources.mjs";
import {
  advanceMockMessageStatus,
  assignConversation,
  closeConversation,
  conversations,
  getConversation,
  getConversationActivities,
  getConversationMessages,
  getConversationUnreadCount,
  getInboxConversations,
  getLead,
  getLeadActivities,
  getLeadConversations,
  markConversationRead,
  mockModel,
  reopenConversation,
  retryMockMessage,
  sendMockMessage,
} from "../client/src/domain/data.js";

const checks = [];
const check = (name, pass, detail = "") => checks.push({ name, pass:Boolean(pass), detail });
const unique = (items) => new Set(items.map((item) => item.id)).size === items.length;
const beforeRevenue = mockModel.revenueEvents.length;
const beforeAttribution = mockModel.attributionTouchpoints.length;
const beforeDealSnapshot = JSON.stringify(mockModel.deals.map((deal) => ({ id:deal.id, status:deal.status, stageId:deal.stageId, value:deal.value, probability:deal.probability })));

// A–F: fixture matrix and independent contracts.
check("A — CONV-3042 موجودة ومربوطة بـ LEAD-1042", getConversation("CONV-3042")?.leadId === "LEAD-1042", "High opportunity + Deal open");
check("B — CONV-3043 تتضمن وسائط تجريبية", getConversationMessages("CONV-3043").some((message) => message.type === "image" && message.attachment?.mime === "image/png"), "image fixture");
check("C — CONV-3044 مغلقة وجهة الاتصال غير محددة", getConversation("CONV-3044")?.status === "closed" && getConversation("CONV-3044")?.contactId === null, "unknown contact semantics");
check("D — CONV-3045 تتضمن رسالة failed قابلة لإعادة المحاولة", getConversationMessages("CONV-3045").some((message) => message.status === "failed"), "failed fixture");
check("E — LEAD-1375 بلا محادثات", getLeadConversations("LEAD-1375").length === 0, "empty state fixture");
check("F — أربعة ردود سريعة ثابتة", mockModel.quickReplyTemplates.length === 4, "quick replies");

check("G — معرفات Conversation فريدة", unique(conversations), "CONV ids");
check("H — معرفات Message فريدة", unique(mockModel.messages), "MSG ids");
check("I — كل Conversation تشير إلى Lead صحيحة", conversations.every((conversation) => Boolean(getLead(conversation.leadId))), "lead references");
check("J — كل Contact مرجعية توافق Lead المحادثة", conversations.filter((conversation) => conversation.contactId).every((conversation) => mockModel.contacts.find((contact) => contact.id === conversation.contactId && contact.leadId === conversation.leadId)), "contact references");
check("K — كل Message تشير إلى Conversation صحيحة", mockModel.messages.every((message) => Boolean(getConversation(message.conversationId))), "message references");
check("L — ترتيب الرسائل زمني تصاعدي", conversations.every((conversation) => getConversationMessages(conversation.id).every((message, index, items) => !index || items[index - 1].createdAt <= message.createdAt)), "message order");

// M–Q: read, close/reopen, owner assignment, and list selectors.
const initialUnread = getConversationUnreadCount(getConversation("CONV-3042"));
const blockedClose = closeConversation("CONV-3042");
check("M — يمنع الإغلاق قبل قراءة الرسائل الواردة", blockedClose?.kind === "unread" && initialUnread > 0, `unread=${initialUnread}`);
markConversationRead("CONV-3042");
check("N — فتح أو قراءة المحادثة يصفر غير المقروء", getConversationUnreadCount(getConversation("CONV-3042")) === 0, "read state");
const closed = closeConversation("CONV-3042");
check("O — إغلاق المحادثة يسجل ConversationActivity", closed?.kind === "closed" && getConversationActivities("CONV-3042").some((activity) => activity.type === "conversation_closed"), "closed event");
check("P — إعادة الفتح تسجل ConversationActivity", Boolean(reopenConversation("CONV-3042")) && getConversationActivities("CONV-3042").some((activity) => activity.type === "conversation_reopened"), "reopened event");
const leadOwnerBeforeAssign = getLead("LEAD-1042").ownerId;
const assigned = assignConversation("CONV-3042", "USR-1002");
check("Q — مسؤول المحادثة مستقل عن مالك Lead", assigned?.assignedTo === "USR-1002" && getLead("LEAD-1042").ownerId === leadOwnerBeforeAssign, "assignment isolation");
check("R — البحث والفلاتر والفرز تعمل على مصدر Inbox", getInboxConversations({ search:"LEAD-1042", filter:"all", ownerId:"all", channel:"whatsapp", sort:"latest" }).length === 2 && getInboxConversations({ search:"", filter:"needs_reply", ownerId:"all", channel:"whatsapp", sort:"oldest_waiting" }).every((row) => row.needsReply), "selectors");

// S–V: explicitly human local message lifecycle and hard boundaries.
const message = sendMockMessage("CONV-3043", "رسالة اختبار بشرية محلية");
const leadActivity = getLeadActivities("LEAD-1137").find((activity) => activity.metadata?.messageId === message?.id);
const conversationActivity = getConversationActivities("CONV-3043").find((activity) => activity.metadata?.messageId === message?.id && activity.type === "message_sent");
check("S — الإرسال ينشئ Message صادرة queued فقط", message?.direction === "outbound" && message?.senderType === "user" && message?.status === "queued", message?.id || "");
check("T — الإرسال يسجل ConversationActivity وLead Activity بالطابع نفسه", Boolean(conversationActivity && leadActivity && conversationActivity.createdAt === message.createdAt && leadActivity.createdAt === message.createdAt), "audit timestamps");
advanceMockMessageStatus(message?.id); advanceMockMessageStatus(message?.id);
check("U — التسليم التجريبي ينتقل queued ثم sent ثم delivered", mockModel.messages.find((item) => item.id === message?.id)?.status === "delivered", "local delivery only");
const beforeRetryCount = mockModel.messages.length;
const retried = retryMockMessage("MSG-3045-2");
check("V — إعادة المحاولة تعيد استخدام Message نفسها بلا نسخة", retried?.id === "MSG-3045-2" && retried.status === "queued" && mockModel.messages.length === beforeRetryCount, "retry same id");

// Guardrails: no real transport, no S6 financial mutation, and no AI sender.
const s7Sources = stripComments(["../client/src/domain/data.js", "../.ui-sources/inbox.txt", "../.ui-sources/all.txt"].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n"));
check("W — لا توجد نداءات نقل خارجية في مسار S7", !/fetch\s*\(|XMLHttpRequest|WebSocket|whatsapp.*api|twilio|meta.*api/i.test(s7Sources), "static transport scan");
check("X — S7 لا تغير Revenue أو Attribution أو Deal", mockModel.revenueEvents.length === beforeRevenue && mockModel.attributionTouchpoints.length === beforeAttribution && JSON.stringify(mockModel.deals.map((deal) => ({ id:deal.id, status:deal.status, stageId:deal.stageId, value:deal.value, probability:deal.probability }))) === beforeDealSnapshot, "S2/S6 boundaries");
check("Y — لا يوجد مرسل AI أو automation في Message", mockModel.messages.every((item) => item.senderType === "contact" || item.senderType === "user" || item.senderType === "unknown_contact"), "human-only sender types");

const failed = checks.filter((item) => !item.pass);
console.log(`S7 verification: ${checks.length - failed.length}/${checks.length} PASS`);
checks.forEach((item) => console.log(`${item.pass ? "PASS" : "FAIL"} — ${item.name}${item.detail ? ` · ${item.detail}` : ""}`));
if (failed.length) process.exitCode = 1;

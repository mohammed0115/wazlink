/* S8 design reminder: «نمو» يعرض مساعد مبيعات حتميًا محليًا. Copilot يوصي فقط؛ Agent يمر دائمًا عبر policy → approval → execution → evidence، ولا توجد LLM أو API أو رسالة ذاتية. */
import {
  addLeadTask, assignLeadOwner, businesses, getConversation, getConversationLatestMessage,
  getConversationMessages, getDealProbability, getDealStage, getDiscoveryJob, getDiscoverySource,
  getLead, getLeadActivities, getLeadContacts, getLeadDeals, getLeadOwner, getLeadTasks,
  getOpenDealsForLead, jobs, mockModel, state, updateLeadPriority, updateLeadStatus,
} from "./data.js";
import { analysisStatusLabels, getBusinessIntelligence, tierLabels } from "./intelligence.js";

export const S8_ENGINE_VERSION = "S8-DETERMINISTIC-v1";
export const agentModeLabels = { off:"متوقف", assist:"مساعدة فقط", approval_required:"يتطلب الموافقة" };
export const agentActionLabels = {
  draft_reply:"إعداد رد مسودة", create_task:"إنشاء مهمة متابعة", update_lead_status:"تحديث حالة العميل", update_lead_priority:"تحديث أولوية العميل", assign_lead:"إسناد العميل", create_deal_draft:"فتح مسودة صفقة", escalate_to_human:"تصعيد لبشر"
};
export const agentActionStatusLabels = { proposed:"بانتظار الموافقة", approved:"تمت الموافقة", rejected:"مرفوض", executed:"نُفذ", failed:"فشل", cancelled:"ملغي" };
export const qualificationLabels = { known:"معلوم", unknown:"غير معروف", needs_confirmation:"يحتاج تأكيد" };
export const forbiddenAgentActions = ["send_message", "close_won_deal", "close_lost_deal", "create_revenue", "create_attribution", "change_deal_value", "change_deal_probability", "delete_lead"];
const executableAgentActions = ["draft_reply", "create_task", "update_lead_status", "update_lead_priority", "assign_lead", "create_deal_draft", "escalate_to_human"];
let aiTick = 0;
let aiIdTick = 0;

function nextAiTimestamp() { aiTick += 1; return `2026-08-15T13:${String(Math.floor(aiTick / 60)).padStart(2, "0")}:${String(aiTick % 60).padStart(2, "0")}`; }
function nextId(prefix, items) { aiIdTick += 1; return `${prefix}-${Math.max(8000, ...items.map((item) => Number(String(item.id).split("-").at(-1)) || 0)) + aiIdTick}`; }
function unique(values) { return [...new Set(values.filter(Boolean))]; }
function byId(items, id) { return items.find((item) => item.id === id); }
function evidenceText(ref) {
  const pools = [businesses, jobs, mockModel.signals, mockModel.opportunityAnalyses, mockModel.opportunities, mockModel.leads, mockModel.conversations, mockModel.messages, mockModel.deals, mockModel.tasks, mockModel.activities, mockModel.revenueEvents, mockModel.attributionTouchpoints, mockModel.discoverySources];
  const item = pools.map((items) => byId(items, ref)).find(Boolean);
  if (!item) return null;
  return { id:ref, label:item.name || item.title || item.body || item.value || item.status || ref, type:ref.split("-")[0] };
}

export function buildSalesContext(leadId, conversationId = null, options = {}) {
  const lead = getLead(leadId);
  const business = options.businessId ? businesses.find((item) => item.id === options.businessId) : (lead ? businesses.find((item) => item.id === lead.businessId) : null);
  const conversation = conversationId ? getConversation(conversationId) : null;
  if (conversation && lead && conversation.leadId !== lead.id) return null;
  const intelligence = business ? getBusinessIntelligence(business.id) : null;
  const messages = conversation ? getConversationMessages(conversation.id) : [];
  const deals = lead ? getLeadDeals(lead.id) : [];
  const openDeals = lead ? getOpenDealsForLead(lead.id) : [];
  const tasks = lead ? getLeadTasks(lead.id) : [];
  const activities = lead ? getLeadActivities(lead.id) : [];
  const job = business ? getDiscoveryJob(business.discoveryJobId) : null;
  const source = job ? getDiscoverySource(job.sourceId) : null;
  const latestMessage = conversation ? getConversationLatestMessage(conversation) : null;
  const provenance = unique([source?.id, job?.id, business?.id, lead?.id, conversation?.id, intelligence?.analysis?.id, intelligence?.opportunity?.id]);
  const contextVersion = `${conversation?.id || "crm"}:${latestMessage?.id || lead?.lastActivityAt || "none"}:${lead?.lastActivityAt || "none"}`;
  return { lead, business, intelligence, conversation, messages, latestMessage, deals, openDeals, tasks, activities, contacts:lead ? getLeadContacts(lead.id) : [], job, source, provenance, contextVersion };
}

function qualificationFor(context) {
  const messageText = context.messages.map((message) => message.body || "").join(" ");
  const hasNeed = /حجز|حل|نطاق العمل|تفاصيل/.test(messageText) || Boolean(context.intelligence?.reasons?.length);
  const authority = context.contacts[0]?.title ? "needs_confirmation" : "unknown";
  const timeline = /موعد|الأسبوع|غد|اليوم|تنفيذ/.test(messageText) ? "needs_confirmation" : "unknown";
  return {
    need:{ state:hasNeed ? "known" : "unknown", value:hasNeed ? "يوجد اهتمام أو احتياج تشغيلي مثبت." : "لا يوجد دليل كافٍ." },
    budget:{ state:"unknown", value:"لا يوجد دليل في المحادثة أو CRM على ميزانية." },
    authority:{ state:authority, value:authority === "needs_confirmation" ? `الجهة المسجلة ${context.contacts[0]?.title}؛ الصلاحية تحتاج تأكيدًا.` : "لا يوجد صاحب قرار مسجل." },
    timeline:{ state:timeline, value:timeline === "needs_confirmation" ? "وردت إشارة زمنية وتحتاج تأكيدًا." : "لا يوجد موعد تنفيذ مثبت." },
    questions:[
      "ما النتيجة التي تريدون تحسينها في مسار الحجز؟",
      "ما الإطار الزمني المناسب لبدء التنفيذ؟",
      "من يشارك في اعتماد نطاق الحل؟"
    ]
  };
}

function makeDecision(context, outputType, payload, confidence, evidenceRefs) {
  return { id:nextId("AID", mockModel.aiDecisionRecords), leadId:context.lead?.id || null, conversationId:context.conversation?.id || null, outputType, payload, confidence, evidenceRefs:unique(evidenceRefs), contextVersion:context.contextVersion, generatedFromLastMessageId:context.latestMessage?.id || null, createdAt:nextAiTimestamp(), engine:S8_ENGINE_VERSION };
}

function recommendationFor(context, qualification) {
  const intelligence = context.intelligence;
  const evidence = unique([context.latestMessage?.id, intelligence?.analysis?.id, ...(intelligence?.reasons?.map((item) => item.id) || []), ...context.openDeals.map((deal) => deal.id), ...context.tasks.slice(0, 1).map((task) => task.id), ...context.provenance]);
  const status = intelligence?.status || "not_analyzed";
  if (status === "analysis_error") return { summary:"ذكاء الفرص غير متاح لهذه الحالة؛ لا يمكن بناء توصية مبيعات موثوقة.", reply:null, nba:{ actionType:"escalate_to_human", label:"تصعيد لمراجعة بشرية", reason:"تعذر تحليل Intelligence، ولا توجد درجة بديلة مصطنعة.", confidence:0.32, evidenceRefs:evidence }, confidence:0.32, evidence };
  if (status === "insufficient_data") return { summary:"بيانات العميل غير كافية لبناء اقتراح خدمة أو تقدير تجاري.", reply:null, nba:{ actionType:"ask_for_information", label:"طلب معلومات أساسية", reason:"بيانات الاتصال والنشاط الأساسية غير متاحة؛ يلزم جمعها قبل أي توصية.", confidence:0.38, evidenceRefs:evidence }, confidence:0.38, evidence };
  if (intelligence?.tier !== "high") return { summary:"السجل لا يحمل فجوة مبيعات عالية مثبتة؛ يوصى بالاستيضاح قبل تقديم عرض خدمة.", reply:context.conversation ? "شكرًا لمشاركتكم التفاصيل. قبل اقتراح خطوة مناسبة، هل يمكن توضيح الأثر الحالي والتوقيت المفضل للمراجعة؟" : null, nba:{ actionType:"ask_qualification_question", label:"تأكيد المعلومات الناقصة", reason:"لا توجد فجوة عالية مثبتة أو أن ثقة التوصية منخفضة؛ الاستيضاح البشري أولى من عرض خدمة مباشر.", confidence:0.48, evidenceRefs:evidence }, confidence:0.48, evidence };
  const question = context.latestMessage?.body || "لا توجد رسالة حديثة";
  const reply = context.conversation ? "شكرًا لاهتمامكم. نرى فرصة لتحسين مسار الحجز وتحويل الاستفسارات إلى متابعة أوضح. يمكننا مشاركة نطاق الحل المقترح أولًا، ثم تأكيد الأولوية والتوقيت المناسبين قبل أي تقدير." : null;
  return { summary:`آخر رسالة تشير إلى: «${question}». توجد فجوتان مثبتتان في الموقع ومسار الحجز وتحتاجان متابعة بشرية.`, reply, nba:{ actionType:"review_solution", label:"مراجعة نطاق الحل والرد الآن", reason:"العميل طلب تفاصيل الحل، بينما Intelligence تثبت فجوتي الموقع والحجز وتوجد صفقة مفتوحة مرتبطة.", confidence:0.87, evidenceRefs:evidence }, confidence:0.87, evidence };
}

export function runCopilotAnalysis(leadId, conversationId = null, options = {}) {
  const context = buildSalesContext(leadId, conversationId, options);
  if (!context?.business) return null;
  const qualification = qualificationFor(context);
  const recommendation = recommendationFor(context, qualification);
  const records = [
    makeDecision(context, "conversation_summary", { text:recommendation.summary }, recommendation.confidence, recommendation.evidence),
    makeDecision(context, "qualification", qualification, Math.min(0.78, Math.max(0.35, recommendation.confidence)), recommendation.evidence),
    makeDecision(context, "next_best_action", recommendation.nba, recommendation.nba.confidence, recommendation.nba.evidenceRefs),
  ];
  if (recommendation.reply) records.push(makeDecision(context, "suggested_reply", { text:recommendation.reply }, recommendation.confidence, recommendation.evidence));
  if (recommendation.nba.actionType === "escalate_to_human") records.push(makeDecision(context, "escalation", { reason:recommendation.nba.reason }, recommendation.nba.confidence, recommendation.evidence));
  mockModel.aiDecisionRecords.push(...records);
  return { context, qualification, recommendation, records };
}

export function getCopilotSnapshot(leadId, conversationId = null) {
  const context = buildSalesContext(leadId, conversationId);
  if (!context) return { context:null, records:[], stale:false };
  const records = mockModel.aiDecisionRecords.filter((record) => record.leadId === leadId && record.conversationId === conversationId).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  const latestByType = Object.fromEntries(["conversation_summary","qualification","suggested_reply","next_best_action","escalation"].map((type) => [type, records.find((record) => record.outputType === type) || null]));
  const stale = records.some((record) => record.contextVersion !== context.contextVersion);
  return { context, records, latestByType, stale };
}

export function isDecisionStale(record) { const context = buildSalesContext(record?.leadId, record?.conversationId); return Boolean(record && (!context || record.contextVersion !== context.contextVersion)); }
export function getEvidence(refs = []) { return refs.map(evidenceText).filter(Boolean); }
export function validateEvidenceRefs(refs = []) { return refs.every((ref) => Boolean(evidenceText(ref))); }

export function useSuggestedReply(decisionId) {
  const decision = byId(mockModel.aiDecisionRecords, decisionId);
  if (!decision || decision.outputType !== "suggested_reply" || !decision.conversationId || isDecisionStale(decision)) return null;
  state.inboxDrafts[decision.conversationId] = decision.payload.text;
  state.inboxAssistance = { assistedBy:"copilot", suggestionId:decision.id };
  return decision;
}

export function getAgentPolicyMatrix() {
  return [
    ["draft_reply", "اقتراح فقط", "موافقة ثم إدراج في Composer"], ["create_task", "اقتراح فقط", "موافقة ثم تنفيذ مرة واحدة"],
    ["update_lead_status", "اقتراح فقط", "موافقة ثم تنفيذ مرة واحدة"], ["update_lead_priority", "اقتراح فقط", "موافقة ثم تنفيذ مرة واحدة"],
    ["assign_lead", "اقتراح فقط", "موافقة ثم تنفيذ مرة واحدة"], ["create_deal_draft", "اقتراح فقط", "موافقة ثم فتح النموذج فقط"],
    ["send_message", "ممنوع", "ممنوع"], ["change_deal_value", "ممنوع", "ممنوع"], ["close_won_deal", "ممنوع", "ممنوع"], ["create_revenue", "ممنوع", "ممنوع"]
  ].map(([type, assist, approval]) => ({ type, label:agentActionLabels[type] || type, assist, approval, forbidden:forbiddenAgentActions.includes(type) }));
}

export function canAgentExecute(actionType, mode = state.agentMode) { return mode === "approval_required" && executableAgentActions.includes(actionType) && !forbiddenAgentActions.includes(actionType); }

function logAgentActivity(action, type, actorId, metadata = {}) {
  const item = { id:nextId("AGA-LOG", mockModel.agentActivities), actionId:action.id, leadId:action.leadId, conversationId:action.conversationId, type, actorId, createdAt:nextAiTimestamp(), metadata };
  mockModel.agentActivities.push(item); return item;
}

export function getAgentAction(actionId) { return byId(mockModel.agentActions, actionId); }
export function getAgentActions(leadId = null) { return mockModel.agentActions.filter((action) => !leadId || action.leadId === leadId).sort((a,b) => b.createdAt.localeCompare(a.createdAt)); }
export function getAgentActivities(actionId = null) { return mockModel.agentActivities.filter((activity) => !actionId || activity.actionId === actionId).sort((a,b) => a.createdAt.localeCompare(b.createdAt)); }

export function createAgentProposal({ leadId, conversationId = null, type, payload = {}, decisionId = null } = {}) {
  const context = buildSalesContext(leadId, conversationId);
  const decision = decisionId ? byId(mockModel.aiDecisionRecords, decisionId) : null;
  if (!context || state.agentMode !== "approval_required" || !canAgentExecute(type) || !agentActionLabels[type]) return { kind:"blocked", action:null };
  const duplicate = mockModel.agentActions.find((action) => action.leadId === leadId && action.conversationId === conversationId && action.type === type && action.status === "proposed");
  if (duplicate) return { kind:"duplicate", action:duplicate };
  const evidenceRefs = unique([...(decision?.evidenceRefs || []), context.latestMessage?.id, context.intelligence?.analysis?.id, ...context.openDeals.map((deal) => deal.id), context.lead?.id]);
  const action = { id:nextId("AGA", mockModel.agentActions), leadId, conversationId, type, status:"proposed", proposedBy:"agent", requiresApproval:true, payload, recommendationId:decision?.id || null, evidenceRefs, reason:decision?.payload?.reason || "اقتراح حتمي مبني على سياق CRM والمحادثة الحالي.", confidence:decision?.confidence ?? 0.62, contextVersion:context.contextVersion, createdAt:nextAiTimestamp(), approvedBy:null, approvedAt:null, executedAt:null, executedBy:null, failureReason:null };
  mockModel.agentActions.push(action); logAgentActivity(action, "proposal_created", "agent", { proposedBy:"agent", evidenceRefs:action.evidenceRefs }); return { kind:"created", action };
}

export function rejectAgentAction(actionId, userId = "USR-1001") {
  const action = getAgentAction(actionId); if (!action || action.status !== "proposed") return null;
  action.status="rejected"; action.rejectedBy=userId; action.rejectedAt=nextAiTimestamp(); action.approvedBy=null; action.approvedAt=null; action.executedAt=null;
  logAgentActivity(action, "rejected", userId, { rejectedBy:userId }); return action;
}

export function executeAgentAction(actionId) {
  const action = getAgentAction(actionId);
  if (!action || action.status === "executed") return action ? { kind:"no_op", action } : { kind:"missing", action:null };
  if (action.status !== "approved" || !action.approvedBy || !action.approvedAt || !canAgentExecute(action.type)) return { kind:"blocked", action };
  const audit = { agentActionId:action.id, proposedBy:"agent", approvedBy:action.approvedBy, executedBy:"governed_agent" };
  let result = null;
  if (action.payload?.simulateFailure) { action.status="failed"; action.failureReason="فشل تنفيذي تجريبي مقصود."; logAgentActivity(action, "failed", "governed_agent", { reason:action.failureReason }); return { kind:"failed", action }; }
  if (action.type === "create_task") result = addLeadTask(action.leadId, { title:action.payload.title || "متابعة اقترحها الوكيل", type:action.payload.type || "متابعة", dueAt:action.payload.dueAt || "2026-08-16T10:00:00", ownerId:action.payload.ownerId || getLead(action.leadId)?.ownerId, actorId:action.approvedBy, metadata:audit });
  if (action.type === "update_lead_status") result = updateLeadStatus(action.leadId, action.payload.status, { actorId:action.approvedBy, metadata:audit });
  if (action.type === "update_lead_priority") result = updateLeadPriority(action.leadId, action.payload.priority, { actorId:action.approvedBy, metadata:audit });
  if (action.type === "assign_lead") result = assignLeadOwner(action.leadId, action.payload.ownerId, { actorId:action.approvedBy, metadata:audit });
  if (action.type === "draft_reply") { state.inboxDrafts[action.conversationId] = action.payload.text || ""; state.inboxAssistance = { assistedBy:"copilot", suggestionId:action.recommendationId || action.id }; result = { inserted:true }; }
  if (action.type === "create_deal_draft") { state.dealModal = { type:"create", leadId:action.leadId, prefills:{ title:action.payload.title || "", serviceId:action.payload.serviceId || null, value:"" } }; result = { opened:true }; }
  if (action.type === "escalate_to_human") result = { escalated:true };
  if (!result) { action.status="failed"; action.failureReason="نوع الإجراء غير مدعوم في سياسة S8."; logAgentActivity(action, "failed", "governed_agent", { reason:action.failureReason }); return { kind:"failed", action }; }
  action.status="executed"; action.executedAt=nextAiTimestamp(); action.executedBy="governed_agent"; action.resultId=result.id || null;
  logAgentActivity(action, "executed", "governed_agent", { ...audit, resultId:action.resultId }); return { kind:"executed", action, result };
}

export function approveAgentAction(actionId, userId = "USR-1001") {
  const action = getAgentAction(actionId); if (!action || action.status === "executed") return action ? { kind:"no_op", action } : { kind:"missing", action:null };
  if (action.status !== "proposed" || !action.requiresApproval || !canAgentExecute(action.type)) return { kind:"blocked", action };
  action.status="approved"; action.approvedBy=userId; action.approvedAt=nextAiTimestamp(); logAgentActivity(action, "approved", userId, { approvedBy:userId }); return executeAgentAction(actionId);
}

export function getAiSalesInsights(leadId) {
  const records = mockModel.aiDecisionRecords.filter((record) => record.leadId === leadId).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  return { nba:records.find((record) => record.outputType === "next_best_action") || null, qualification:records.find((record) => record.outputType === "qualification") || null, pendingAction:getAgentActions(leadId).find((action) => action.status === "proposed") || null };
}

export function getS8IntegrityReport() {
  const checks=[]; const add=(id, pass, detail)=>checks.push({ id, pass, detail });
  add("A", mockModel.aiDecisionRecords.every((record) => record.confidence >= 0 && record.confidence <= 1 && validateEvidenceRefs(record.evidenceRefs)), "Decision confidence/evidence");
  add("B", mockModel.agentActions.every((action) => action.proposedBy === "agent" && action.confidence >= 0 && action.confidence <= 1 && validateEvidenceRefs(action.evidenceRefs)), "Agent contract");
  add("C", mockModel.agentActions.filter((action) => action.status === "executed").every((action) => action.approvedBy && action.approvedAt && action.executedAt), "Approval guard");
  add("D", state.agentMode !== "fully_autonomous", "No autonomous mode");
  return { pass:checks.every((check)=>check.pass), checks };
}

const pct = (value) => `${new Intl.NumberFormat("ar-SA", { style:"percent", maximumFractionDigits:0 }).format(Number(value || 0))}`;
const mono = (value) => `<span class="mono">${value || "—"}</span>`;

function evidenceList(refs = []) {
  const items = getEvidence(refs);
  return `<div class="s8-evidence">${items.length ? items.map((item) => `<span title="${item.label}">${mono(item.id)}<b>${item.label}</b></span>`).join("") : "<small>لا توجد أدلة قابلة للعرض.</small>"}</div>`;
}

function qualificationView(record) {
  const payload = record?.payload;
  if (!payload) return "<div class=\"s8-empty\">شغّل التحليل لعرض حالة التأهيل والمعلومات الناقصة.</div>";
  const fields = [["need","الاحتياج"],["budget","الميزانية"],["authority","صاحب القرار"],["timeline","موعد التنفيذ"]];
  return `<div class="s8-qualification-grid">${fields.map(([key,label]) => `<article class="state-${payload[key]?.state || "unknown"}"><span>${label}</span><b>${qualificationLabels[payload[key]?.state] || "غير معروف"}</b><small>${payload[key]?.value || "لا يوجد دليل كافٍ."}</small></article>`).join("")}</div><div class="s8-question-list"><b>أسئلة مقترحة — لا تُرسل تلقائيًا</b>${payload.questions?.map((question) => `<span>${question}</span>`).join("") || ""}</div>`;
}

function summaryView(snapshot) {
  const { context, latestByType, stale } = snapshot;
  const summary = latestByType?.conversation_summary;
  const nba = latestByType?.next_best_action;
  const reply = latestByType?.suggested_reply;
  if (!summary) return `<div class="s8-empty"><i>✧</i><b>لم يُحلّل هذا السياق بعد</b><p>المحاكاة الحتمية تقرأ CRM والمحادثة وIntelligence وDeals لتنتج توصية قابلة للمراجعة.</p>${s8Action("تحليل العميل", "run-copilot", `data-lead="${context.lead?.id || ""}" data-conversation="${context.conversation?.id || ""}"`, "button primary")}</div>`;
  return `<div class="s8-output-stack ${stale ? "is-stale" : ""}">${stale ? `<div class="s8-stale" role="status"><b>التوصية قديمة</b><span>تغيرت المحادثة بعد التحليل؛ أعد التحليل قبل استخدام الرد.</span></div>` : ""}<article class="s8-recommendation"><header><span>ملخص المحادثة</span><b>ثقة ${pct(summary.confidence)}</b></header><p>${summary.payload.text}</p>${evidenceList(summary.evidenceRefs)}</article>${nba ? `<article class="s8-recommendation action"><header><span>الإجراء التالي</span><b>ثقة ${pct(nba.confidence)}</b></header><h3>${nba.payload.label}</h3><p>${nba.payload.reason}</p>${evidenceList(nba.evidenceRefs)}${state.agentMode === "approval_required" ? s8Action("إنشاء اقتراح Agent", "propose-from-nba", `data-lead="${context.lead?.id || ""}" data-conversation="${context.conversation?.id || ""}" data-decision="${nba.id}"`, "button compact") : `<small class="s8-policy-note">فعّل وضع «يتطلب الموافقة» لإنشاء اقتراح قابل للمراجعة.</small>`}</article>` : ""}${reply ? `<article class="s8-recommendation reply"><header><span>رد مقترح</span><b>ثقة ${pct(reply.confidence)}</b></header><p>${reply.payload.text}</p>${evidenceList(reply.evidenceRefs)}${s8Action(stale ? "أعد التحليل أولًا" : "استخدام الرد في Composer", "use-suggested-reply", `data-decision="${reply.id}" ${stale ? "disabled" : ""}`, "button primary")}</article>` : "<article class=\"s8-recommendation muted\"><b>لا توجد محادثة متاحة لإنشاء رد</b><p>يمكن عرض الإجراء التالي من CRM عندما يكون السياق كافيًا.</p></article>"}</div>`;
}


function agentActionCard(action) {
  const log = getAgentActivities(action.id); const status = agentActionStatusLabels[action.status] || action.status;
  return `<article class="s8-agent-action status-${action.status}"><header><div><span>${agentActionLabels[action.type] || action.type}</span><b>${status}</b></div><small>${mono(action.id)} · ثقة ${pct(action.confidence)}</small></header><p>${action.reason}</p>${evidenceList(action.evidenceRefs)}<div class="s8-action-timeline">${log.map((entry) => `<span><i></i>${entry.type} · ${entry.createdAt.slice(11,16)}</span>`).join("")}</div>${action.status === "proposed" ? `<footer>${s8Action("موافقة وتنفيذ", "approve-agent-action", `data-agent-action="${action.id}"`, "button primary compact")}${s8Action("رفض", "reject-agent-action", `data-agent-action="${action.id}"`, "button danger compact")}</footer>` : action.failureReason ? `<small class="s8-failure">${action.failureReason}</small>` : ""}</article>`;
}





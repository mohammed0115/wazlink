import { readFileSync } from "node:fs";
import { stripComments } from "./lib/ui-sources.mjs";
import {
  getLead, getLeadActivities, mockModel, sendMockMessage, state,
} from "../client/src/domain/data.js";
import {
  approveAgentAction, buildSalesContext, createAgentProposal, forbiddenAgentActions,
  getAgentActivities, getAgentPolicyMatrix, isDecisionStale, rejectAgentAction,
  runCopilotAnalysis, useSuggestedReply,
} from "../client/src/domain/sales-ai.js";

const checks = [];
const check = (name, pass, detail = "") => checks.push({ name, pass:Boolean(pass), detail });
const snapshot = () => JSON.stringify({ revenue:mockModel.revenueEvents, attribution:mockModel.attributionTouchpoints, deals:mockModel.deals.map((deal) => ({ id:deal.id, value:deal.value, probability:deal.probability, status:deal.status, stageId:deal.stageId })) });
const beforeFinancial = snapshot();
const beforeTaskCount = mockModel.tasks.length;

// A–F: context provenance and deterministic Copilot output.
const context = buildSalesContext("LEAD-1042", "CONV-3042");
check("A — Context يعيد المصدر وBusiness وLead وConversation بالمرجع", context?.source?.id === "SRC-1001" && context?.job?.id === "JOB-1028" && context?.business?.id === "BUS-1042" && context?.lead?.id === "LEAD-1042" && context?.conversation?.id === "CONV-3042", "SRC → JOB → BUS → LEAD → CONV");
const analysis = runCopilotAnalysis("LEAD-1042", "CONV-3042");
const sameAnalysis = runCopilotAnalysis("LEAD-1042", "CONV-3042");
const reply = analysis?.records.find((record) => record.outputType === "suggested_reply");
const nba = analysis?.records.find((record) => record.outputType === "next_best_action");
check("B — Copilot حتمي ويولد ملخصًا وردًا وNBA", Boolean(analysis?.records.some((record) => record.outputType === "conversation_summary") && reply && nba && sameAnalysis?.recommendation?.reply === analysis?.recommendation?.reply), "deterministic rule output");
check("C — Confidence مستقلة عن Score وDeal Probability", reply?.confidence !== 0.92 && reply?.confidence !== 0.82 && reply?.confidence >= 0 && reply?.confidence <= 1, `confidence=${reply?.confidence}`);
check("D — كل Evidence في Copilot قابلة للتحقق", analysis?.records.every((record) => record.evidenceRefs.length && record.evidenceRefs.every((ref) => ["SRC","JOB","BUS","LEAD","CONV","MSG","SIG","ANL","OPP","DEAL","TSK"].includes(ref.split("-")[0]))), "traceable refs");
check("E — التأهيل يحفظ unknown ولا يخترع الميزانية", analysis?.qualification?.budget?.state === "unknown" && /لا يوجد دليل/.test(analysis?.qualification?.budget?.value || ""), "budget unknown");
check("F — اقتراح الرد لا ينشئ Message", mockModel.messages.every((message) => message.senderType !== "agent" && message.senderType !== "ai"), "no AI sender");

// G–J: insert-only behavior, staleness, non-happy intelligence fixtures.
const messagesBeforeInsert = mockModel.messages.length;
const inserted = useSuggestedReply(reply?.id);
check("G — استخدام الرد يملأ Composer فقط", Boolean(inserted && state.inboxDrafts["CONV-3042"] === reply.payload.text && mockModel.messages.length === messagesBeforeInsert), "draft only");
const assisted = sendMockMessage("CONV-3042", state.inboxDrafts["CONV-3042"], { assistance:state.inboxAssistance });
check("H — الإرسال بعد الإدراج يبقى Human sender مع metadata مساعدة", assisted?.senderType === "user" && assisted?.assistance?.assistedBy === "copilot", assisted?.id || "");
check("I — الاقتراح القديم يكتشف تغير المحادثة", isDecisionStale(reply) === true, "new outbound message changed context version");
const counter = runCopilotAnalysis(null, null, { businessId:"BUS-1402" });
const intelligenceError = runCopilotAnalysis(null, null, { businessId:"BUS-1403" });
const insufficient = runCopilotAnalysis(null, null, { businessId:"BUS-1404" });
check("J — Counterexample وError وInsufficient لا تنتج بيعًا عدوانيًا أو Score مصطنعًا", counter?.recommendation?.nba?.actionType === "ask_qualification_question" && intelligenceError?.recommendation?.nba?.actionType === "escalate_to_human" && insufficient?.recommendation?.reply === null, "safe fixtures");

// K–P: governed Agent policy, approval, idempotency, reject and activity trace.
check("K — Agent default OFF وسياسة التنفيذ المركزية تحظر المالي والإرسال", state.agentMode === "off" && forbiddenAgentActions.includes("send_message") && getAgentPolicyMatrix().some((row) => row.type === "send_message" && row.forbidden), "default/policy");
state.agentMode = "approval_required";
const proposal = createAgentProposal({ leadId:"LEAD-1042", conversationId:"CONV-3042", type:"create_task", payload:{ title:"متابعة اختبار Agent", dueAt:"2026-08-16T10:00:00" }, decisionId:nba?.id });
check("L — proposal لا تغير Task قبل approval", proposal.kind === "created" && mockModel.tasks.length === beforeTaskCount && proposal.action.requiresApproval, proposal.action?.id || "");
const executed = approveAgentAction(proposal.action?.id, "USR-1001");
check("M — Approval ينشئ Task واحدة عبر Domain Function", executed.kind === "executed" && mockModel.tasks.length === beforeTaskCount + 1 && executed.action.executedBy === "governed_agent", executed.action?.resultId || "");
const duplicateApprove = approveAgentAction(proposal.action?.id, "USR-1001");
check("N — Double approve idempotent", duplicateApprove.kind === "no_op" && mockModel.tasks.length === beforeTaskCount + 1, "task count stable");
const rejected = createAgentProposal({ leadId:"LEAD-1042", conversationId:"CONV-3042", type:"update_lead_priority", payload:{ priority:"low" } });
const priorityBeforeReject = getLead("LEAD-1042")?.priority;
rejectAgentAction(rejected.action?.id, "USR-1001");
check("O — Reject لا يغير Lead", rejected.action?.status === "rejected" && getLead("LEAD-1042")?.priority === priorityBeforeReject, "no mutation");
const statusProposal = createAgentProposal({ leadId:"LEAD-1042", conversationId:"CONV-3042", type:"update_lead_status", payload:{ status:"contacted" } });
const statusExecution = approveAgentAction(statusProposal.action?.id, "USR-1001");
const leadAudit = getLeadActivities("LEAD-1042").find((activity) => activity.metadata?.agentActionId === statusProposal.action?.id);
check("P — Lead mutation المعتمدة تحمل Agent audit trail", statusExecution.kind === "executed" && leadAudit?.metadata?.approvedBy === "USR-1001" && getAgentActivities(statusProposal.action?.id).some((item) => item.type === "executed"), "proposal → approval → execution → domain activity");

// Q–V: blocks and hard boundaries.
const blockedSend = createAgentProposal({ leadId:"LEAD-1042", conversationId:"CONV-3042", type:"send_message" });
const blockedFinancial = createAgentProposal({ leadId:"LEAD-1042", conversationId:"CONV-3042", type:"change_deal_value" });
const blockedRevenue = createAgentProposal({ leadId:"LEAD-1042", conversationId:"CONV-3042", type:"create_revenue" });
check("Q — Agent يحظر send_message", blockedSend.kind === "blocked", "policy block");
check("R — Agent يحظر تغيير قيمة Deal", blockedFinancial.kind === "blocked", "financial block");
check("S — Agent يحظر Revenue/Attribution", blockedRevenue.kind === "blocked" && snapshot() === beforeFinancial, "revenue boundary");
check("T — لا Action تنفذ قبل موافقة بشرية", mockModel.agentActions.filter((action) => action.status === "executed").every((action) => action.approvedBy && action.approvedAt && action.executedAt), "approval required");
check("U — لا توجد LLM/API أو WhatsApp transport في مسار S8", !/fetch\s*\(|XMLHttpRequest|WebSocket|openai|anthropic|gemini|whatsapp.*api|twilio|meta.*api/i.test(stripComments(["../client/src/domain/sales-ai.js","../.ui-sources/all.txt","../.ui-sources/inbox.txt"].map((path) => readFileSync(new URL(path, import.meta.url), "utf8")).join("\n"))), "static transport scan");
check("V — S8 لا تغير Revenue أو Attribution أو Deal ماليًا", snapshot() === beforeFinancial, "S2/S6 financial boundary");

const failed = checks.filter((item) => !item.pass);
console.log(`S8 verification: ${checks.length - failed.length}/${checks.length} PASS`);
checks.forEach((item) => console.log(`${item.pass ? "PASS" : "FAIL"} — ${item.name}${item.detail ? ` · ${item.detail}` : ""}`));
if (failed.length) process.exitCode = 1;

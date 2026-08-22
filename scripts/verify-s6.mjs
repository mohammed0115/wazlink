import {
  businesses,
  closeDealAsLost,
  closeDealAsWon,
  createDeal,
  getAttributionIntegrityReport,
  getDeal,
  getDealActivities,
  getDealBusiness,
  getDealLead,
  getDealProbability,
  getDealStage,
  getOpenPipelineMetrics,
  getPipeline,
  getRevenueSummary,
  getLead,
  mockModel,
  moveDealStage,
  updateDeal,
} from "../client/src/domain/data.js";
import { getBusinessIntelligence } from "../client/src/domain/intelligence.js";

const failures = [];
const matrix = [];
function verify(id, label, condition, detail = "") {
  matrix.push({ id, label, pass:Boolean(condition), detail });
  if (!condition) failures.push({ id, label, detail });
  console.log(`${condition ? "PASS" : "FAIL"} ${id} — ${label}${detail ? ` · ${detail}` : ""}`);
}
function isIso(value) { return /^\d{4}-\d{2}-\d{2}T/.test(String(value || "")); }
function weighted(deal) { return deal.value * getDealProbability(deal) / 100; }
function latestActivity(deal) { return getDealActivities(deal.id)[0] || null; }

const baselineRevenueEvents = mockModel.revenueEvents.length;
const baselineAttribution = JSON.stringify(mockModel.attributionTouchpoints);
const baselineLeadStatus = getLead("LEAD-1042")?.status;
const existingDeal = getDeal("DEAL-4042");

// Independent create/update/move scenario: different service from existing DEAL-4042 is permitted for the same Lead.
const created = createDeal("LEAD-1042", {
  title:"فحص S6 — تحسين الظهور", serviceId:"SVC-1002", value:42000,
  stageId:"STG-1001", probability:"20", ownerId:"USR-1001", expectedCloseAt:"2026-08-31"
});
const auditDeal = created.deal;
const duplicate = createDeal("LEAD-1042", {
  title:"فحص S6 — تحسين الظهور", serviceId:"SVC-1002", value:42000,
  stageId:"STG-1001", probability:"20", ownerId:"USR-1001", expectedCloseAt:"2026-08-31"
});

const invalidFixtures = [
  { label:"قيمة فارغة", values:{ title:"فحص فارغ", value:"", expectedCloseAt:"2026-08-31" } },
  { label:"قيمة صفر", values:{ title:"فحص صفر", value:0, expectedCloseAt:"2026-08-31" } },
  { label:"قيمة سالبة", values:{ title:"فحص سالب", value:-1, expectedCloseAt:"2026-08-31" } },
  { label:"احتمال سالب", values:{ title:"فحص احتمال", value:1, probability:-1, expectedCloseAt:"2026-08-31" } },
  { label:"احتمال أكبر من 100", values:{ title:"فحص احتمال", value:1, probability:101, expectedCloseAt:"2026-08-31" } },
  { label:"تاريخ غير صالح", values:{ title:"فحص تاريخ", value:1, expectedCloseAt:"2026-99-99" } },
];
const invalidBlocked = invalidFixtures.every(({ values }) => createDeal("LEAD-1375", values).kind === "invalid");

if (auditDeal) {
  updateDeal(auditDeal.id, { value:47000, probability:"70", expectedCloseAt:"2026-08-29", ownerId:"USR-1001", title:auditDeal.title });
  updateDeal(auditDeal.id, { probability:"default" });
  moveDealStage(auditDeal.id, "STG-1004");
  updateDeal(auditDeal.id, { title:"فحص S6 — تحسين الظهور المتقدم", ownerId:"USR-1002", serviceId:"SVC-1002" });
}

// Independent Lost scenario and atomic refusal when a reason is absent.
const lostCandidate = createDeal("LEAD-1042", {
  title:"فحص S6 — أتمتة الحجز", serviceId:"SVC-1003", value:33000,
  stageId:"STG-1003", ownerId:"USR-1001", expectedCloseAt:"2026-08-30"
}).deal;
const lostBefore = lostCandidate ? JSON.stringify({ status:lostCandidate.status, stageId:lostCandidate.stageId, probability:lostCandidate.probability, lostAt:lostCandidate.lostAt, lossReason:lostCandidate.lossReason }) : "";
const blockedLost = lostCandidate ? closeDealAsLost(lostCandidate.id, "", true) === null && JSON.stringify({ status:lostCandidate.status, stageId:lostCandidate.stageId, probability:lostCandidate.probability, lostAt:lostCandidate.lostAt, lossReason:lostCandidate.lossReason }) === lostBefore : false;
const lostDeal = lostCandidate ? closeDealAsLost(lostCandidate.id, "تأجيل القرار", true) : null;

// Independent Won scenario; counters must remain unchanged.
const wonCandidate = createDeal("LEAD-1042", {
  title:"فحص S6 — تطوير الموقع", serviceId:"SVC-1001", value:51000,
  stageId:"STG-1005", probability:"80", ownerId:"USR-1001", expectedCloseAt:"2026-08-28"
}).deal;
const wonDeal = wonCandidate ? closeDealAsWon(wonCandidate.id, true) : null;

const dealActivities = mockModel.deals.flatMap((deal) => getDealActivities(deal.id));
const stageActivity = auditDeal && getDealActivities(auditDeal.id).find((item) => item.type === "stage_changed");
const valueActivity = auditDeal && getDealActivities(auditDeal.id).find((item) => item.type === "value_changed");
const probabilityActivities = auditDeal ? getDealActivities(auditDeal.id).filter((item) => item.type === "probability_changed") : [];
const closeDateActivity = auditDeal && getDealActivities(auditDeal.id).find((item) => item.type === "close_date_changed");
const titleActivity = auditDeal && getDealActivities(auditDeal.id).find((item) => item.type === "title_changed");
const ownerActivity = auditDeal && getDealActivities(auditDeal.id).find((item) => item.type === "owner_changed");
const existingRevenueChain = getAttributionIntegrityReport();
const pipeline = getOpenPipelineMetrics();
const revenueSummary = getRevenueSummary();
const intelligence = existingDeal ? getBusinessIntelligence(getDealBusiness(existingDeal)?.id) : null;

verify("A", "Deal → Lead", mockModel.deals.every((deal) => getDealLead(deal)?.id === deal.leadId), "كل Deal تشير إلى Lead قائمة");
verify("B", "Lead → Business", mockModel.leads.every((lead) => businesses.some((business) => business.id === lead.businessId)), "كل Lead تشير إلى Business قائمة");
verify("C", "Pipeline/Stage refs", mockModel.deals.every((deal) => getPipeline(deal.pipelineId) && getDealStage(deal)?.pipelineId === deal.pipelineId), "Pipeline وStage متطابقتان");
verify("D", "Stage ↔ Status", mockModel.deals.every((deal) => { const stage = getDealStage(deal); return deal.status === "open" ? stage?.kind === "open" : stage?.kind === deal.status; }), "الحالة تطابق نوع المرحلة");
verify("E", "Probability bounds", mockModel.deals.every((deal) => Number.isFinite(getDealProbability(deal)) && getDealProbability(deal) >= 0 && getDealProbability(deal) <= 100), "0–100");
verify("F", "Won/Lost contract", Boolean(wonDeal?.status === "won" && wonDeal.stageId === "STG-1007" && wonDeal.probability === 100 && isIso(wonDeal.wonAt) && wonDeal.lostAt === null && wonDeal.lossReason === null && lostDeal?.status === "lost" && lostDeal.stageId === "STG-1008" && lostDeal.probability === 0 && isIso(lostDeal.lostAt) && lostDeal.wonAt === null && lostDeal.lossReason === "تأجيل القرار" && blockedLost), "الإغلاق النهائي والسبب الإلزامي صحيحان");
verify("G", "Weighted math", mockModel.deals.every((deal) => weighted(deal) === deal.value * deal.probability / 100), "القيمة × احتمال الصفقة");
verify("H", "Pipeline totals", pipeline.openPipelineValue === mockModel.deals.filter((deal) => deal.status === "open").reduce((sum, deal) => sum + deal.value, 0) && pipeline.weightedPipelineValue === mockModel.deals.filter((deal) => deal.status === "open").reduce((sum, deal) => sum + weighted(deal), 0), "تجمع الصفقات المفتوحة فقط");
verify("I", "Activity refs", dealActivities.every((activity) => getDeal(activity.metadata?.dealId) && getLead(activity.leadId)?.id === activity.leadId && mockModel.users.some((user) => user.id === activity.actorId) && isIso(activity.createdAt)), "Deal/Lead/Actor/timestamp موجودة");
verify("J", "Stage metadata from/to", Boolean(stageActivity?.metadata?.fromStageId && stageActivity?.metadata?.toStageId && stageActivity.actorId && isIso(stageActivity.createdAt)), "stage_changed مدقق");
verify("K", "Value metadata from/to/currency", Boolean(valueActivity && Number.isFinite(valueActivity.metadata?.from) && Number.isFinite(valueActivity.metadata?.to) && valueActivity.metadata?.currency === "SAR"), "value_changed مدقق");
verify("L", "Probability metadata from/to/reason", probabilityActivities.some((item) => Number.isFinite(item.metadata?.from) && Number.isFinite(item.metadata?.to) && ["manual_override", "stage_default"].includes(item.metadata?.reason)), "probability_changed مدقق");
verify("M", "Close-date metadata", Boolean(closeDateActivity?.metadata?.from && closeDateActivity?.metadata?.to && /^\d{4}-\d{2}-\d{2}$/.test(closeDateActivity.metadata.from) && /^\d{4}-\d{2}-\d{2}$/.test(closeDateActivity.metadata.to)), "close_date_changed مدقق");
verify("N", "Existing Revenue chain", existingRevenueChain.pass && existingRevenueChain.attributionTotal === 382000 && existingRevenueChain.revenueSummary === 382000, "382,000 = 382,000");
verify("O", "New Deal provenance", Boolean(auditDeal && getDealLead(auditDeal)?.id === "LEAD-1042" && getDealBusiness(auditDeal)?.id === "BUS-1042" && getLead("LEAD-1042")?.sourceJobId === "JOB-1028"), "Deal جديدة تحفظ مرجع Lead/Business/Job");
verify("P", "Intelligence provenance", Boolean(intelligence?.business?.id === "BUS-1042" && intelligence.analysis?.id === "ANL-1042" && intelligence.opportunity?.id === "OPP-1042" && !Object.hasOwn(auditDeal || {}, "score")), "Intelligence مرجعية فقط");
verify("Q", "Service reference", Boolean(auditDeal?.serviceId === "SVC-1002" && mockModel.serviceCatalog.some((service) => service.id === auditDeal.serviceId)), "serviceId اختياري ومرجعي");
verify("R", "No Auto Revenue", mockModel.revenueEvents.length === baselineRevenueEvents && JSON.stringify(mockModel.attributionTouchpoints) === baselineAttribution, "Won لا تكتب Revenue أو Attribution");
verify("S", "Dashboard consistency", revenueSummary.pipeline === pipeline.openPipelineValue && revenueSummary.weightedPipeline === pipeline.weightedPipelineValue, "Dashboard وS6 من selector واحد");
verify("T", "Unique IDs", new Set(mockModel.deals.map((deal) => deal.id)).size === mockModel.deals.length && new Set(mockModel.activities.map((activity) => activity.id)).size === mockModel.activities.length, "لا توجد IDs مكررة");
verify("U", "Opportunity Score and Deal Probability independent", Boolean(existingDeal && intelligence?.score === 92 && getDealProbability(existingDeal) === 82 && !Object.hasOwn(existingDeal, "score")), "BUS-1042 = 92 مقابل DEAL-4042 = 82%");
verify("V", "Financial validation", invalidBlocked && getLead("LEAD-1042")?.status === baselineLeadStatus && created.kind === "created" && duplicate.kind === "duplicate" && duplicate.deal?.id === auditDeal?.id, "قيمة/احتمال/تاريخ غير صالح محجوب، والتكرار الحقيقي فقط محجوب");

const lifecycleOk = [auditDeal, lostDeal, wonDeal].every((deal) => deal && deal.lastActivityAt === latestActivity(deal)?.createdAt);
console.log(`${lifecycleOk ? "PASS" : "FAIL"} Lifecycle — lastActivityAt يطابق أحدث DealActivity`);
if (!lifecycleOk) failures.push({ id:"Lifecycle", label:"lastActivityAt", detail:"لا يطابق أحدث activity" });
const mutationAuditOk = Boolean(titleActivity?.metadata?.from && titleActivity?.metadata?.to && ownerActivity?.metadata?.from && ownerActivity?.metadata?.to);
console.log(`${mutationAuditOk ? "PASS" : "FAIL"} Lifecycle — title/owner mutations تكتب DealActivity`);
if (!mutationAuditOk) failures.push({ id:"Lifecycle", label:"title/owner activity", detail:"تحديثات Deal غير مدققة" });

const passed = matrix.filter((item) => item.pass).length;
console.log(`\nS6 integrity: ${passed}/22 PASS`);
if (failures.length || passed !== 22) {
  console.error(`فشل ${failures.length} من فحوص S6.`);
  process.exit(1);
}
console.log("S6 integrity: 22/22 PASS — lifecycle, revenue boundary, provenance and pipeline consistency verified.");

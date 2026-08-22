import {
  addLeadNote, addLeadTask, assignLeadOwner, businesses, completeLeadTask, convertBusinessToLead,
  getAttributionIntegrityReport, getDiscoveryJob, getLead, getLeadActivities,
  getLeadActivitySummary, getLeadIntegrityReport, mockModel, updateLeadPriority,
  updateLeadStatus
} from "../client/src/domain/data.js";
import { getBusinessIntelligence } from "../client/src/domain/intelligence.js";

const checks = [];
const check = (id, title, pass, detail) => checks.push({ id, title, pass:Boolean(pass), detail });
const count = (items) => items.length;
const before = { leads:count(mockModel.leads), deals:count(mockModel.deals), activities:count(mockModel.activities), notes:count(mockModel.notes), tasks:count(mockModel.tasks) };

const lead1042 = getLead("LEAD-1042");
const business1042 = businesses.find((business) => business.id === "BUS-1042");
check("A", "Business → Lead", lead1042?.businessId === business1042?.id && !Object.hasOwn(lead1042, "score"), "Lead تشير إلى Business بلا نسخة Score");
check("B", "Lead → Opportunity", getBusinessIntelligence(lead1042.businessId).opportunity?.businessId === lead1042.businessId, "Opportunity تمر عبر Business المرجعية");
check("C", "Duplicate protection", mockModel.leads.filter((lead) => lead.businessId === "BUS-1042").length === 1, "BUS-1042 تملك Lead واحدة");

const beforeMutationActivities = count(mockModel.activities);
const ownerResult = assignLeadOwner("LEAD-1042", "USR-1002");
const ownerActivity = getLeadActivities("LEAD-1042")[0];
check("D", "Owner mutation", ownerResult?.ownerId === "USR-1002" && ownerActivity.type === "owner_changed" && ownerActivity.metadata?.fromOwnerId === "USR-1001" && ownerActivity.metadata?.toOwnerId === "USR-1002" && ownerActivity.actorId, "المالك وActivity metadata متطابقان");
const statusResult = updateLeadStatus("LEAD-1042", "contacted");
const statusActivity = getLeadActivities("LEAD-1042")[0];
check("E", "Status mutation", statusResult?.status === "contacted" && statusActivity.type === "status_changed" && statusActivity.metadata?.fromStatus === "qualified" && statusActivity.metadata?.toStatus === "contacted", "الحالة وfrom/to مسجلان");
const priorityResult = updateLeadPriority("LEAD-1042", "medium");
const priorityActivity = getLeadActivities("LEAD-1042")[0];
check("F", "Priority mutation", priorityResult?.priority === "medium" && priorityActivity.type === "priority_changed" && priorityActivity.metadata?.fromPriority === "high" && priorityActivity.metadata?.toPriority === "medium", "الأولوية وfrom/to مسجلان");

const note = addLeadNote("LEAD-1042", "ملاحظة اختبار دورة حياة CRM", "USR-1001");
const noteActivity = getLeadActivities("LEAD-1042")[0];
check("G", "Note integrity", note?.leadId === "LEAD-1042" && noteActivity.type === "note_added" && noteActivity.metadata?.noteId === note.id && noteActivity.actorId === "USR-1001", "الملاحظة وActivity ترتبطان بالـLead والفاعل");
const task = addLeadTask("LEAD-1042", { title:"متابعة اختبار S5-FIX", type:"اتصال", ownerId:"USR-1002", priority:"high", dueAt:"2026-08-16T09:00" });
const taskCreatedActivity = getLeadActivities("LEAD-1042")[0];
check("H", "Task integrity", task?.leadId === "LEAD-1042" && task.ownerId === "USR-1002" && task.dueAt === "2026-08-16T09:00" && taskCreatedActivity.type === "task_created" && taskCreatedActivity.metadata?.taskId === task.id, "المهمة تحفظ المالك والأولوية والاستحقاق");
completeLeadTask(task.id);
const taskCompletedActivity = getLeadActivities("LEAD-1042")[0];
check("I", "Task lifecycle", task.status === "completed" && task.completedAt && taskCompletedActivity.type === "task_completed" && taskCompletedActivity.metadata?.taskId === task.id, "إكمال المهمة يسجل event صريحًا");

const timeline = getLeadActivities("LEAD-1042");
check("J", "Timeline ordering", timeline.every((item, index) => !index || timeline[index - 1].createdAt >= item.createdAt) && timeline.every((item) => /^\d{4}-\d{2}-\d{2}T/.test(item.createdAt)), "Timeline مرتبة تنازليًا بطوابع ISO");
const summary = getLeadActivitySummary("LEAD-1042");
check("K", "Session consistency", lead1042.lastActivityAt === summary.lastActivityAt && lead1042.nextActivityAt === summary.nextActivityAt && count(mockModel.activities) > beforeMutationActivities, "Lead وCRM وTimeline تستخدم المصدر الحي نفسه");

const insufficient = businesses.find((business) => business.id === "BUS-1404");
const insufficientAnalysis = getBusinessIntelligence("BUS-1404");
check("L", "BUS-1404 warning conversion", insufficient && insufficientAnalysis.status === "insufficient_data" && insufficientAnalysis.score === null && !insufficientAnalysis.services.length, "البيانات غير الكافية لا تحصل على Score أو خدمة مصطنعة");

const revenue = getAttributionIntegrityReport();
check("M", "Existing revenue chain", revenue.pass && revenue.attributionTotal === revenue.revenueSummary, `${revenue.attributionTotal} = ${revenue.revenueSummary}`);
const convertedOnce = convertBusinessToLead("BUS-1402", { ownerId:"USR-1001", status:"new", priority:"medium" });
const convertedTwice = convertBusinessToLead("BUS-1402", { ownerId:"USR-1001", status:"new", priority:"medium" });
check("N", "Double conversion", convertedOnce.kind === "created" && convertedTwice.kind === "duplicate" && mockModel.leads.filter((lead) => lead.businessId === "BUS-1402").length === 1, "التحويل المتكرر يعيد Lead القائمة فقط");
check("O", "Double click protection", convertedTwice.lead?.id === convertedOnce.lead?.id && count(mockModel.leads) === before.leads + 1, "النقرة الثانية لا تنشئ Lead جديدة");

const fixtures = { "BUS-1042":"analyzed", "BUS-1402":"analyzed", "BUS-1403":"analysis_error", "BUS-1404":"insufficient_data" };
check("P", "S4 regression", Object.entries(fixtures).every(([id, status]) => getBusinessIntelligence(id).status === status), "Fixtures S4 مستقرة");
check("Q", "S3 regression", getDiscoveryJob("JOB-1028")?.status === "completed" && ["processing", "cancelled"].includes(getDiscoveryJob("JOB-1030")?.status), "بوابة نتائج S3 وحالات Jobs سليمة");
check("R", "S2 attribution regression", revenue.pass && revenue.attributionTotal === 382000 && revenue.revenueSummary === 382000, "فرق Attribution = 0");
check("S", "No S6 leakage", count(mockModel.deals) === before.deals, "لا Deal جديدة من S5-FIX");

const idGroups = [mockModel.leads, mockModel.companies, mockModel.contacts, mockModel.tasks, mockModel.notes, mockModel.activities];
check("T", "Unique IDs", idGroups.every((group) => new Set(group.map((item) => item.id)).size === group.length), "كل IDs CRM فريدة");
check("U", "Contact integrity", mockModel.contacts.every((contact) => { const lead = getLead(contact.leadId); return lead && contact.businessId === lead.businessId; }), "Contact تشير مباشرة إلى Business الصحيحة");
const report = getLeadIntegrityReport();
check("V", "Lead integrity report", report.pass && count(mockModel.notes) >= before.notes + 1 && count(mockModel.tasks) >= before.tasks + 1, "عقد Lead المركزي يمر بعد عمليات Lifecycle");

const passed = checks.filter((item) => item.pass).length;
console.log("S5-FIX Integrity Matrix");
checks.forEach((item) => console.log(`${item.pass ? "PASS" : "FAIL"} ${item.id} — ${item.title}: ${item.detail}`));
console.log(`${passed}/${checks.length} PASS`);
if (passed !== checks.length) process.exit(1);

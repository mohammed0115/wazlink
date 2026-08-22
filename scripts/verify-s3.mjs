import {
  cancelDiscoveryJob,
  completeDiscoveryJob,
  createDiscoveryJob,
  getDiscoveryIntegrityReport,
  getDiscoveryJob,
  getJobResults,
  isDiscoveryJobToday,
  isDiscoveryResultsAvailable,
  jobs,
  retryDiscoveryJob,
  startDiscoveryJob,
} from "../client/src/domain/data.js";

const results = [];
const check = (name, pass, detail) => {
  results.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} | ${name} | ${detail}`);
};

const integrity = getDiscoveryIntegrityReport();
check("A — Source → Job → Business integrity", integrity.checks.sourceIntegrity.every((item) => item.pass) && integrity.checks.businessIntegrity.every((item) => item.pass) && integrity.checks.resultsOwnership.every((item) => item.pass), "كل Source وBusiness وResult يملك مرجع Job صحيحًا");
check("B — Jobs list integrity", jobs.every((job) => job.name && job.status && job.createdAt && Array.isArray(job.keywords) && Array.isArray(job.locations)), `${jobs.length} عمليات تحمل الحقول الأساسية`);
check("C — Combination count", integrity.checks.combinationIntegrity.every((item) => item.pass), "keywords × locations = combinationCount" );
check("D — Completed count formula", integrity.checks.countIntegrity.every((item) => item.pass), "foundCount - duplicateCount = deduplicatedCount" );
check("E — Unique IDs", integrity.checks.uniqueIds.every((item) => item.pass), integrity.checks.uniqueIds[0]?.detail || "لا توجد تكرارات");
check("F — Status contract", integrity.checks.statusContract.every((item) => item.pass), "الحالات ضمن pending/processing/completed/failed/cancelled");

const baseJob = getDiscoveryJob("JOB-1028");
const baseResults = getJobResults("JOB-1028");
check("G — Results ownership", baseResults.length === baseJob.resultBusinessIds.length && baseResults.every((business) => business.discoveryJobId === baseJob.id), `${baseResults.length} نتائج تعود إلى ${baseJob.id}`);

const failed = getDiscoveryJob("JOB-1027");
retryDiscoveryJob(failed.id);
completeDiscoveryJob(failed.id);
check("H — Failure retry", failed.status === "completed" && failed.deduplicatedCount === 578, "فشل ثم إعادة تشغيل ثم اكتمل بالسيناريو التجريبي" );

const created = createDiscoveryJob({ keywords:["اختبار سلامة"], locations:["الرياض","جدة"], sourceId:"SRC-1004", filters:{ minRating:"4", minReviews:"50", website:"any", phone:true, email:false, whatsapp:false, instagram:false, activity:"any", limit:"500" } });
completeDiscoveryJob(created.id);
const createdResults = getJobResults(created.id);
check("I — New Job generation", created.combinationCount === 2 && created.status === "completed" && createdResults.every((business) => business.discoveryJobId === created.id), `${created.id} أنشأت 2 مجموعات و${createdResults.length} Business مرتبطة`);
cancelDiscoveryJob("JOB-1030");
check("J — Cancel state", getDiscoveryJob("JOB-1030").status === "cancelled", "الإلغاء يحفظ العملية ولا يحذفها" );

const lifecycleConfig = { keywords:["بوابة النتائج"], locations:["الرياض"], sourceId:"SRC-1004", filters:{ minRating:"4", minReviews:"50", website:"any", phone:true, email:false, whatsapp:false, instagram:false, activity:"any", limit:"500" } };
const pending = createDiscoveryJob(lifecycleConfig);
const processing = createDiscoveryJob(lifecycleConfig);
startDiscoveryJob(processing.id);
const completed = getDiscoveryJob("JOB-1028");
const failedForGate = createDiscoveryJob(lifecycleConfig);
failedForGate.status = "failed";
const cancelled = createDiscoveryJob(lifecycleConfig);
cancelDiscoveryJob(cancelled.id);
const lifecycleCases = [
  ["pending", pending],
  ["processing", processing],
  ["completed", completed],
  ["failed", failedForGate],
  ["cancelled", cancelled],
];
const lifecyclePass = lifecycleCases.every(([status, job]) => status === "completed" ? isDiscoveryResultsAvailable(job) && getJobResults(job.id).length > 0 : !isDiscoveryResultsAvailable(job) && getJobResults(job.id).length === 0);
check("K — Results lifecycle gate", lifecyclePass, "pending/processing/failed/cancelled محجوبة وcompleted فقط تعرض نتائج");

const todayJobs = jobs.filter(isDiscoveryJobToday);
check("L — Today filter integrity", todayJobs.length >= 2 && todayJobs.some((job) => job.id === "JOB-1028") && todayJobs.some((job) => job.id === "JOB-1030"), `${todayJobs.map((job) => job.id).join(", ")} ضمن عمليات اليوم`);

const failedChecks = results.filter((result) => !result.pass);
console.log(`\nS3 Integrity: ${failedChecks.length ? "FAIL" : "PASS"} — ${results.length - failedChecks.length}/${results.length} checks passed.`);
process.exitCode = failedChecks.length ? 1 : 0;

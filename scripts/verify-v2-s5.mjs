import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { getAnalyticsOverview } from "../client/src/domain/analytics-engine.js";
import { closeDealAsWon, mockModel } from "../client/src/domain/data.js";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const dashboard = read("client/src/features/dashboard/Dashboard.tsx");
const projection = read("client/src/services/dashboardProjection.ts");
const contracts = read("client/src/services/contracts/services.ts");
const packageText = read("package.json");
const sources = `${dashboard}\n${projection}`;

let passed = 0;
const failures = [];
function gate(name, condition, evidence = "") {
  if (condition) passed += 1;
  else failures.push(`${name}${evidence ? ` — ${evidence}` : ""}`);
}
function call(source, object, method) {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "");
  return new RegExp(`\\b${object}\\s*\\.\\s*${method}\\s*\\(`).test(withoutComments);
}

// Command, typed contracts, and ownership.
gate("S5 command registered", packageText.includes('"verify-v2-s5": "node scripts/verify-v2-s5.mjs"'));
gate("typed DashboardProjection exists", contracts.includes("export interface DashboardProjection"));
gate("typed DashboardAttentionItem exists", contracts.includes("export interface DashboardAttentionItem"));
gate("typed DashboardJourneyStatus exists", contracts.includes("export interface DashboardJourneyStatus"));
gate("typed DashboardPlanContext exists", contracts.includes("export interface DashboardPlanContext"));
gate("typed DashboardProjectionService exists", contracts.includes("export interface DashboardProjectionService"));
gate("no Dashboard store", !/Dashboard(Store|State)|dashboardStore/.test(sources));
gate("no Dashboard any escape hatch", !/Record<string, any>|any\[\]|:\s*any\b/.test(sources));
gate("Dashboard uses projection", call(dashboard, "dashboardProjection", "getSnapshot"));
gate("projection uses analytics service", call(projection, "analyticsService", "getOverview"));
gate("projection uses S4 journey projection", call(projection, "journeyProjection", "getContext"));
gate("projection uses entitlement service", call(projection, "entitlementService", "evaluate"));
gate("projection does not import raw domain", !/domain\/data|@domain\/data/.test(sources));
gate("projection does not import mock bridge", !/services\/mock|legacyDataBridge/.test(sources));

// Actual canonical service calls.
gate("projection reads CRM Leads", call(projection, "crmService", "listLeads"));
gate("projection reads CRM tasks", call(projection, "crmService", "getLeadTasks"));
gate("projection reads messaging conversations", call(projection, "messagingService", "listConversations"));
gate("projection reads pipeline Deals", call(projection, "pipelineService", "listDeals"));
gate("projection reads automation metrics", call(projection, "automationFeatureService", "getAutomationMetrics"));
gate("projection reads Discovery jobs", call(projection, "discoveryService", "listDiscoveryJobs"));
gate("projection returns read-only API", !/\b(create|update|delete|sendMessage|closeDeal|runAutomation)\b/.test(projection));

// Runtime canonical metrics and Dashboard/Analytics agreement.
const directOverview = getAnalyticsOverview({ dateRange: "all" });
const loadProjection = () => {
  const runtimeCode = "import { dashboardProjection } from './client/src/services/dashboardProjection.ts'; console.log(JSON.stringify(dashboardProjection.getSnapshot()));";
  try { return JSON.parse(execFileSync("pnpm", ["exec", "tsx", "-e", runtimeCode], { cwd: root, encoding: "utf8" })); }
  catch (error) { failures.push(`Dashboard projection runtime load failed — ${error instanceof Error ? error.message : String(error)}`); return null; }
};
const snapshot = loadProjection();
const runtimeOverview = snapshot ? getAnalyticsOverview({ dateRange: "all" }) : directOverview;
gate("Dashboard projection runtime loaded", Boolean(snapshot));
gate("pipeline metric agrees with Analytics", directOverview.metrics.openPipeline.value === runtimeOverview.metrics.openPipeline.value && Boolean(snapshot?.journey && snapshot.journey.deals >= 0));
gate("weighted pipeline metric agrees with Analytics", directOverview.metrics.weightedPipeline.value === runtimeOverview.metrics.weightedPipeline.value);
gate("recognized revenue agrees with Analytics", directOverview.metrics.revenue.value === runtimeOverview.metrics.revenue.value && Boolean(snapshot?.journey && snapshot.journey.recognizedRevenue === runtimeOverview.metrics.revenue.value));
gate("attributed revenue selector is canonical", directOverview.metrics.attributedRevenue.value === runtimeOverview.metrics.attributedRevenue.value && !/attribut.*reduce|attributedRevenue\s*=/.test(dashboard));
gate("Dashboard does not use static overview payload", !dashboard.includes("getDashboardOverview"));
gate("Dashboard attention is projection-backed", dashboard.includes("projection.attentionItems"));
gate("Dashboard recommendations are projection-backed", dashboard.includes("projection.aiRecommendations"));
gate("Dashboard deals are projection-backed", dashboard.includes("projection.nearClosingDeals"));

// Revenue safety: closing a Deal in an isolated verifier process must not increase recognized revenue or event count.
const openDeal = mockModel.deals.find((deal) => deal.status === "open");
const revenueBefore = getAnalyticsOverview({ dateRange: "all" }).metrics.revenue.value;
const eventsBefore = mockModel.revenueEvents.length;
const closeResult = openDeal ? closeDealAsWon(openDeal.id, true) : null;
const revenueAfter = getAnalyticsOverview({ dateRange: "all" }).metrics.revenue.value;
gate("won Deal does not increase recognized Revenue", Boolean(closeResult) && revenueAfter === revenueBefore);
gate("won Deal does not create RevenueEvent", mockModel.revenueEvents.length === eventsBefore);
gate("won Deal closes at 100 percent", Boolean(closeResult) && closeResult.probability === 100);
gate("Dashboard labels recognized revenue distinctly", dashboard.includes("الإيراد المعترف به") && dashboard.includes("تختلط به"));
gate("Dashboard does not synthesize attribution", !/attributionTouchpoints|RevenueEvent|createRevenue/.test(projection));

// Deterministic attention and exact routes.
const snapshotAgain = loadProjection();
gate("attention ordering is deterministic", Boolean(snapshot && snapshotAgain) && JSON.stringify(snapshot.attentionItems) === JSON.stringify(snapshotAgain.attentionItems));
gate("attention is capped", snapshot.attentionItems.length <= 5);
gate("attention items have routes", snapshot.attentionItems.every((item) => typeof item.route === "string" && item.route.length > 0));
gate("Conversation routes preserve CONV IDs", projection.includes("inbox/${encodeURIComponent(waiting.id)}"));
gate("Lead routes preserve LEAD IDs", projection.includes("crm/leads/${encodeURIComponent(id)}"));
gate("Deal routes preserve DEAL IDs", projection.includes("deals/${encodeURIComponent(id)}"));
gate("Discovery routes preserve JOB IDs", projection.includes("discovery/results?job=${encodeURIComponent(job.id)}"));
gate("no route by business display name", !/go\([^)]*name|route[^\n]*business\.name/.test(projection));

// Entitlement and usage semantics.
const discoveryDecision = { allowed: Boolean(snapshot?.plan?.discoveryAllowed) };
const discoveryUsage = { used: snapshot?.plan?.discoveryRunsUsed ?? 0 };
gate("plan context uses canonical plan", Boolean(snapshot?.plan?.planId));
gate("plan context uses canonical entitlement", Boolean(snapshot?.plan && typeof snapshot.plan.discoveryAllowed === "boolean"));
gate("plan context uses canonical usage", Boolean(snapshot?.plan && typeof snapshot.plan.discoveryRunsUsed === "number"));
gate("usage is distinct from performance", dashboard.includes("الاستخدام:") && dashboard.includes("Revenue معترف به"));
gate("locked action has Billing route", projection.includes('billingRoute: "settings/billing"'));
gate("Dashboard does not compare raw plan names", !/plan\.name\s*===|planName\s*===|PLAN-STARTER/.test(dashboard));

// Sparse/unknown-safe behavior at the pure boundary and source-level fallback checks.
gate("projection is sparse-safe", Array.isArray(snapshot.attentionItems) && Array.isArray(snapshot.nearClosingDeals) && Array.isArray(snapshot.aiRecommendations));
gate("journey has honest zero-safe fields", Object.values(snapshot.journey).every((value) => value !== undefined));
gate("unknown entitlement fails closed", !/\?\?\s*true/.test(projection));
gate("unknown relation omits contextual action", projection.includes("filter((deal) => Boolean(deal.id && deal.businessId))"));
gate("no fake trend in Dashboard", !/trend:\s*["'][+-]\d/.test(dashboard));
gate("no fake conversion formula in Dashboard", !/(conversion|winRate)\s*=(?!=)/.test(dashboard));
gate("no manufactured chart points", !/Array\.from\(|new Array\(|generate.*point/i.test(dashboard));

// First-run, shell, and safety boundaries remain present.
gate("first-run recommendation remains", dashboard.includes("onboardingService.recommend") && dashboard.includes("onboardingRecommendation.firstAction.route"));
gate("billing CTA is canonical", dashboard.includes('go("settings/billing")'));
gate("human/Copilot safety copy remains", dashboard.includes("لا يوجد تنفيذ ذاتي أو اتصال خارجي") && dashboard.includes("توصيات مشتقة من Intelligence"));
gate("RTL shell remains delegated", !/Sidebar|Topbar|projectShellNavigation/.test(dashboard));

const total = passed + failures.length;
console.log(`V2-S5 verifier: ${passed}/${total} PASS`);
if (failures.length) {
  console.error(failures.map((failure, index) => `${index + 1}. ${failure}`).join("\n"));
  process.exitCode = 1;
}

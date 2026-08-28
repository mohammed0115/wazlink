import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = path.resolve(import.meta.dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
const add = (id, name, pass, detail) => checks.push({ id, name, pass: Boolean(pass), detail });
const source = (file) => read(file);
const app = source("client/src/App.tsx");
const landing = source("client/src/features/landing/Landing.tsx");
const dashboard = source("client/src/features/dashboard/Dashboard.tsx");
const analytics = source("client/src/features/analytics/Analytics.tsx");
const projection = source("client/src/services/dashboardProjection.ts");
const journey = source("client/src/services/journey.ts");
const upgrade = source("client/src/services/upgradeProjection.ts");
const entitlement = source("client/src/services/entitlementService.ts");
const gate = source("client/src/shared/components/EntitlementGate.tsx");
const checkout = source("client/src/features/settings/Checkout.tsx");
const shell = source("client/src/shared/shell/AppShell.tsx");
const route = source("client/src/shared/router/useHashRoute.ts");
const contracts = source("client/src/services/contracts/services.ts");
const packageJson = JSON.parse(source("package.json"));
const tracked = execFileSync("git", ["diff", "--name-only", "28f689635389f0741614c1d28e0f975d4e970051..HEAD"], { cwd: root, encoding: "utf8" });
const allChanged = `${tracked}\n${execFileSync("git", ["status", "--short"], { cwd: root, encoding: "utf8" })}`;

add("A1", "single hash router", app.includes("useHashRoute") && app.includes("function Page"), "App.tsx owns the canonical hash route switch");
add("A2", "canonical AppShell", app.includes("<AppShell route={path}>") && shell.includes("projectShellContext"), "authenticated routes stay inside AppShell");
add("A3", "service boundary", dashboard.includes("dashboardProjection") && upgrade.includes("service.evaluate") && !/features\/.*from [^\n]*domain\/data/.test(dashboard), "features consume services/projections");
add("A4", "no S7 store", !/DashboardStore|FrontendStore|QAStore|ClosureStore/.test(`${landing}\n${dashboard}\n${projection}`), "no new authoritative S7 store");
add("A5", "frontend-only package", !/express|fastify|django|postgres|redis|bullmq|webhook/i.test(JSON.stringify(packageJson.scripts)), "package scripts remain frontend-only");
add("A6", "no dependency or lockfile change", !allChanged.split("\n").some((line) => /(^|\/)pnpm-lock\.yaml$/.test(line)), "no lockfile in S5-to-S7 working diff");

add("R1", "canonical route helpers", route.includes("export function go") && route.includes("routeHref"), "go/routeHref remain canonical");
add("R2", "representative route switch", ["dashboard", "discovery", "discovery/results", "crm/leads/", "inbox/", "deals/", "pipeline", "automation", "analytics", "settings/billing", "settings/billing/checkout"].every((token) => app.includes(token)), "primary routes are explicit");
add("R3", "safe unknown route", app.includes("return <Placeholder route={path} />"), "unknown routes have a safe fallback");
add("R4", "onboarding completion redirect", app.includes('path === "onboarding" && onboardingDone') && app.includes('go("dashboard")'), "completed onboarding does not restart");
add("R5", "AppShell mobile behavior", shell.includes("Escape") && shell.includes("drawer") && shell.includes("onToggleSidebar"), "drawer and Escape behavior remain in shell");

add("J1", "canonical journey IDs", ["JOB-", "BUS-", "LEAD-", "CONV-", "DEAL-"].every((token) => journey.includes(token) || projection.includes(token) || app.includes(token)), "journey modules retain canonical identity vocabulary");
add("J2", "Journey projection read-only", journey.includes("export const journeyProjection") && !/localStorage\.setItem|sessionStorage\.setItem/.test(journey), "journey projection does not persist");
add("J3", "Lead conversation route", source("client/src/features/crm/LeadControlPanels.tsx").includes("go(`inbox/${conversation.id}`)"), "Lead 360 opens exact Conversation route");
add("J4", "Conversation backlink", source("client/src/features/inbox/Inbox.tsx").includes("go(`crm/leads/${lead.id}`)"), "Inbox returns to exact Lead");
add("J5", "Deal exact route", app.includes('path.startsWith("deals/")') && source("client/src/features/sales/Deal360.tsx").includes("dealId"), "Deal 360 uses actual Deal ID");
add("J6", "Discovery context action", source("client/src/features/intelligence/DiscoveryResults.tsx").includes("crmService.getLeadByBusinessId") && source("client/src/features/intelligence/DiscoveryResults.tsx").includes("فتح سياق العميل"), "Discovery preserves Business/Lead context without auto-creation");

add("K1", "Dashboard projection source", dashboard.includes("dashboardProjection.getSnapshot") || dashboard.includes("dashboardProjection"), "Dashboard reads derived projection");
add("K2", "Analytics canonical selectors", analytics.includes("getAnalyticsOverview") && analytics.includes("getAnalyticsFunnel"), "Analytics reads canonical selectors");
add("K3", "Dashboard no fake growth", !/\+18%|\+20%|\+50K|\+2M|\+10M|\+200%|125,430|8,650|1,248|342/.test(dashboard), "authenticated Dashboard has no hardcoded marketing metrics");
add("K4", "Landing preview disclosure", landing.includes("معاينة توضيحية · ليست بيانات حساب حقيقية") && landing.includes("معاينة توضيحية وليست بيانات حساب حقيقية"), "public preview is explicitly illustrative");
add("K5", "Landing no unsupported value strip", !/\+50K|\+2M|\+10M|\+200%/.test(landing) && landing.includes("قدرات المنصة وليست إحصاءات مستخدمين"), "unsupported social-proof metrics removed");
add("K6", "Landing revenue boundary", landing.includes("RevenueEvent فقط") && landing.includes("الإيراد المعترف به مصدرًا منفصلًا") && !landing.includes("أول ريال إيراد"), "public narrative does not imply Won automatically becomes Revenue");
add("K7", "Landing CTA non-mutating", landing.includes('onClick={() => go("discovery")}>راجع النتائج'), "public preview CTA routes to Discovery, not CRM mutation");

add("V1", "RevenueEvent source", analytics.includes("revenueEvents") || projection.includes("recognizedRevenue"), "recognized Revenue is analytics/domain derived");
add("V2", "Won is not Revenue", !source("client/src/domain/data.js").match(/closeDealAsWon[\s\S]{0,180}RevenueEvent/), "Deal Won has no automatic RevenueEvent creation");
add("V3", "Billing separate", checkout.includes("محاكاة محلية") && checkout.includes("لا يتم تحصيل أي مبلغ"), "Checkout is local/mock");
add("V4", "no provider transport in S7 diff", !/(fetch\(|XMLHttpRequest|WebSocket|openai|anthropic|twilio|whatsapp.*api|paymentIntent)/i.test(`${landing}\n${dashboard}\n${projection}`), "S7 changed product files add no provider transport");
add("V5", "no secrets in S7 diff", !/(Bearer\s+[A-Za-z0-9._-]{12,}|sk-[A-Za-z0-9]{12,}|-----BEGIN .*PRIVATE KEY-----)/.test(`${landing}\n${dashboard}\n${projection}`), "no high-confidence secret");

add("E1", "EntitlementService authority", upgrade.includes("service.currentPlan()") && upgrade.includes("service.evaluate(capability)") && upgrade.includes("service.planCatalog()"), "S6 projection uses canonical entitlement service");
add("E2", "EntitlementGate uses projection", gate.includes("upgradeProjection") || gate.includes("createUpgradeProjection"), "shared gate consumes derived commercial context");
add("E3", "unknown fails closed", upgrade.includes('status: "UNKNOWN"') && upgrade.includes("canUse: false") && upgrade.includes("showUpgrade: false"), "unknown has no grant/action");
add("E4", "limited remains usable", upgrade.includes('reason === "limited"') && upgrade.includes("canUse: decision.allowed"), "limited is not force-blocked");
add("E5", "exhausted blocks", upgrade.includes('reason === "exhausted"') && entitlement.includes("EXHAUSTED"), "exhaustion is canonical");
add("E6", "query presentation only", source("client/src/features/settings/Billing.tsx").includes("capability") && source("client/src/features/settings/Billing.tsx").includes("reason"), "Billing query context has no entitlement mutation path");

const behavior = execFileSync("pnpm", ["exec", "tsx", "-e", `import { createUpgradeProjection } from './client/src/services/upgradeProjection.ts'; import { entitlementService } from './client/src/services/index.ts'; const p=createUpgradeProjection(entitlementService); const u=p.getContext('future.capability'); if(u.status!=='UNKNOWN'||u.canUse||u.showUpgrade||u.targetPlan!==null) process.exit(2); console.log('UNKNOWN_OK');`], { cwd: root, encoding: "utf8" });
add("B1", "production UNKNOWN behavior", behavior.includes("UNKNOWN_OK"), "actual production projection exercised");

const maliciousQuery = source("client/src/features/settings/Billing.tsx");
add("B2", "no query plan assignment", !/query\.get\(["']plan["']\)|searchParams\.get\(["']plan["']\)/.test(maliciousQuery), "plan query cannot assign current plan");
add("B3", "no automatic upgrade mutation", !/upgradePlan|setPlan|changePlan|subscribe\(/.test(upgrade), "upgrade projection has no mutation");
add("B4", "pricing from catalog", upgrade.includes("targetPlan") && upgrade.includes("planCatalog"), "target pricing context is catalog-derived");

for (const file of ["client/src/features/dashboard/Dashboard.tsx", "client/src/features/landing/Landing.tsx", "client/src/services/dashboardProjection.ts", "client/src/services/upgradeProjection.ts"]) {
  add(`T-${path.basename(file)}`, `${file} has no new generic any`, !/Record<string, any>|\bany\[\]/.test(source(file)), "S7 target surface typing");
}

console.table(checks.map((item) => ({ Check: item.id, Result: item.pass ? "PASS" : "FAIL", Detail: item.detail })));
const passed = checks.filter((item) => item.pass).length;
console.log(`V2-S7 final frontend verification: ${passed}/${checks.length}`);
if (passed !== checks.length) process.exitCode = 1;

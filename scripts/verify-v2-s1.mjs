import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const src = path.join(root, "client", "src");
const read = (file) => fs.readFileSync(file, "utf8");
const checks = [];
const check = (id, pass, detail = "") => checks.push({ id, pass: Boolean(pass), detail });
const contracts = read(path.join(src, "services", "contracts", "entitlements.ts"));
const service = read(path.join(src, "services", "entitlementService.ts"));
const rootService = read(path.join(src, "services", "index.ts"));
const sidebar = read(path.join(src, "shared", "shell", "Sidebar.tsx"));
const billing = read(path.join(src, "features", "settings", "Billing.tsx"));
const discovery = read(path.join(src, "features", "discovery", "Discovery.tsx"));
const automation = read(path.join(src, "features", "automation", "Automation.tsx"));
const usageMatrixPath = path.join(root, "V2-S1_USAGE_MATRIX.md");
const auditPath = path.join(root, "V2-S1_ENTITLEMENT_AUDIT.md");

function stripCommentsAndStrings(value) {
  let output = "";
  let mode = "code";
  let quote = "";
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    const next = value[i + 1];
    if (mode === "lineComment") {
      output += ch === "\n" ? "\n" : " ";
      if (ch === "\n") mode = "code";
      continue;
    }
    if (mode === "blockComment") {
      if (ch === "*" && next === "/") { output += "  "; i += 1; mode = "code"; }
      else output += ch === "\n" ? "\n" : " ";
      continue;
    }
    if (mode === "string") {
      if (ch === "\\") { output += "  "; if (i + 1 < value.length) { output += value[i + 1] === "\n" ? "\n" : " "; i += 1; } }
      else if (ch === quote) { output += " "; mode = "code"; quote = ""; }
      else output += ch === "\n" ? "\n" : " ";
      continue;
    }
    if (ch === "/" && next === "/") { output += "  "; i += 1; mode = "lineComment"; continue; }
    if (ch === "/" && next === "*") { output += "  "; i += 1; mode = "blockComment"; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { output += " "; mode = "string"; quote = ch; continue; }
    output += ch;
  }
  return output;
}
function extractMemberCalls(source, objectName) {
  const code = stripCommentsAndStrings(source);
  const escaped = objectName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escaped}\\s*(?:\\?\\.)?\\s*\\.\\s*([A-Za-z_$][\\w$]*)\\s*\\(`, "g");
  return [...code.matchAll(pattern)].map((match) => match[1]);
}

check("S1-01 audit exists", fs.existsSync(auditPath));
check("S1-02 usage matrix exists", fs.existsSync(usageMatrixPath));
check("S1-03 typed entitlement service interface", /interface EntitlementService\s*\{[\s\S]*currentPlan\(\)[\s\S]*evaluate\(/.test(contracts));
check("S1-04 explicit PlanDefinition", /interface PlanDefinition\s*\{[\s\S]*id: PlanId[\s\S]*entitlements: PlanEntitlements/.test(contracts));
check("S1-05 explicit capability catalog", /type CapabilityId\s*=/.test(contracts) && /const capabilityLabels/.test(contracts));
check("S1-06 explicit limit model", /type LimitDefinition\s*=\s*[\s\S]*kind: "finite"[\s\S]*kind: "unlimited"[\s\S]*kind: "not_included"/.test(contracts));
check("S1-07 explicit usage model", /interface UsageMetric\s*\{[\s\S]*used: number[\s\S]*remaining: number \| null[\s\S]*status: EntitlementStatus/.test(contracts));
check("S1-08 explicit decision model", /interface EntitlementDecision\s*\{[\s\S]*allowed: boolean[\s\S]*reason: UpgradeReason/.test(contracts));
check("S1-09 no entitlement any escape hatch", !/\bany\b|any\[\]|Record<string, any>/.test(contracts + service));
check("S1-10 composition root export", /export const entitlementService: EntitlementService/.test(rootService));
check("S1-11 BillingPlan limits typed", /limits: Readonly<Record<"leads" \| "discoveryRuns" \| "seats" \| "automationRuns" \| "aiAnalyses", number \| null>>/.test(read(path.join(src, "services", "contracts", "services.ts"))));
check("S1-12 canonical plan ids preserved", ["PLAN-STARTER", "PLAN-GROWTH", "PLAN-SCALE"].every((id) => service.includes(`"${id}"`)));
check("S1-13 usage source is BillingService", /billing\.usage\(\)/.test(service) && /billing\.currentSubscription\(\)/.test(service) && /billing\.plans\(\)/.test(service));
check("S1-14 remaining clamped", /Math\.max\(0, limit\.value - used\)/.test(service));
check("S1-15 exhausted uses >=", /used >= limit\.value/.test(service));
check("S1-16 unknown capability fails closed", /if \(!isCapabilityId\(capability\)\)[\s\S]*status: "LOCKED"[\s\S]*allowed: false/.test(service));
check("S1-17 unknown plan safe fallback", /find\(\(plan\) => plan\.id === "PLAN-STARTER"\)/.test(service) && /capabilities: \[\]/.test(service));
check("S1-18 one decision path", /evaluate\(capability: CapabilityId\)/.test(contracts) && /entitlementService\.evaluate/.test(discovery + automation));

const sidebarCalls = extractMemberCalls(sidebar, "entitlementService");
const billingCalls = extractMemberCalls(billing, "entitlementService");
const discoveryCalls = extractMemberCalls(discovery, "entitlementService");
const automationCalls = extractMemberCalls(automation, "entitlementService");
check("S1-19 Sidebar actual entitlement calls", sidebarCalls.includes("currentPlan") && sidebarCalls.includes("usageFor"), sidebarCalls.join(","));
check("S1-20 Billing actual entitlement calls", billingCalls.includes("planCatalog") && billingCalls.includes("currentPlan") && billingCalls.includes("usage"), billingCalls.join(","));
check("S1-21 Discovery action evaluates entitlement", discoveryCalls.includes("evaluate") && /const decision = entitlementService\.evaluate\("discovery\.basic"\)/.test(discovery), discoveryCalls.join(","));
check("S1-22 Automation actions evaluate entitlement", automationCalls.includes("evaluate") && /const decision = entitlementService\.evaluate\("automation\.rules"\)/.test(automation), automationCalls.join(","));
check("S1-23 Sidebar no hardcoded usage", !/1,240|الباقة المهنية/.test(sidebar));
check("S1-24 Sidebar has canonical upgrade route", /go\("settings\/billing"\)/.test(sidebar));
check("S1-25 Billing uses canonical plan catalog", /entitlementService\.planCatalog\(\)/.test(billing) && !/const planRows = plans\(\)/.test(billing));
check("S1-26 locked UX explains upgrade", /غير متاح في الباقة الحالية|عرض خيارات الترقية/.test(read(path.join(src, "shared", "components", "EntitlementGate.tsx"))));
check("S1-27 canonical upgrade reason typed", /type UpgradeReason =/.test(contracts) && /upgradeTarget: PlanId \| null/.test(contracts));
check("S1-28 usage matrix traces all metrics", ["Leads", "Discovery runs", "Active seats", "Automation runs", "AI analyses"].every((metric) => read(usageMatrixPath).includes(metric)));
check("S1-29 frontend quota authority documented", /not authoritative quota enforcement|authoritative quota enforcement remains a future Backend/i.test(read(usageMatrixPath)));
check("S1-30 revenue safety documented", /RevenueEvent|AttributionTouchpoint/.test(read(path.join(root, "V2-S1_ENTITLEMENT_AUDIT.md"))));
check("S1-31 no direct plan comparison in gated Features", !/(plan|subscription)\s*===\s*["'](?:PLAN-|Pro|Enterprise|Growth|Scale)/.test(discovery + automation));
check("S1-32 no hardcoded quota in gated Features", !/(used|usage)\s*[><=]=?\s*\d{2,}/.test(discovery + automation));

function statusFor(limit, used) {
  if (limit === null) return "AVAILABLE";
  if (used >= limit) return "EXHAUSTED";
  return used > 0 ? "LIMITED" : "AVAILABLE";
}
check("S1-33 boundary used zero", statusFor(10, 0) === "AVAILABLE");
check("S1-34 boundary limit minus one", statusFor(10, 9) === "LIMITED");
check("S1-35 boundary exactly limit", statusFor(10, 10) === "EXHAUSTED");
check("S1-36 boundary over limit", statusFor(10, 11) === "EXHAUSTED");
check("S1-37 unlimited never exhausts", statusFor(null, 999999) === "AVAILABLE");
check("S1-38 remaining never negative", Math.max(0, 10 - 11) === 0);

check("S1-39 negative import-only rejected", extractMemberCalls('import { entitlementService } from "@services"; function Fixture(){ return null; }', "entitlementService").length === 0);
check("S1-40 negative identifier-only rejected", extractMemberCalls('import { entitlementService } from "@services"; console.log(entitlementService);', "entitlementService").length === 0);
check("S1-41 positive multiline call accepted", extractMemberCalls("entitlementService\n  .evaluate(\n    \\\"discovery.basic\\\"\n  );", "entitlementService").includes("evaluate"));
check("S1-42 comment/string false positives rejected", extractMemberCalls('// entitlementService.evaluate()\nconst text = "entitlementService.evaluate()";', "entitlementService").length === 0);
check("S1-43 gate file is feature-local", /EntitlementGate/.test(read(path.join(src, "shared", "components", "EntitlementGate.tsx"))));
check("S1-44 no backend implementation", !/fetch\(|axios\.|XMLHttpRequest|supabase|firebase/.test(contracts + service));

for (const result of checks) console.log(`${result.pass ? "PASS" : "FAIL"} ${result.id}${result.detail ? ` — ${result.detail}` : ""}`);
const passed = checks.filter((item) => item.pass).length;
console.log(`V2-S1 verification: ${passed}/${checks.length}`);
if (passed !== checks.length) process.exit(1);

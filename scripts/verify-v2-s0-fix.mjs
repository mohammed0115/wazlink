import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const src = path.join(root, "client", "src");
const featureRoots = [path.join(src, "features"), path.join(src, "shared"), path.join(src, "App.tsx")];
const files = [];
function walk(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.statSync(target);
  if (stat.isFile()) { if (/\.(ts|tsx)$/.test(target)) files.push(target); return; }
  for (const entry of fs.readdirSync(target)) walk(path.join(target, entry));
}
featureRoots.forEach(walk);
const text = (file) => fs.readFileSync(file, "utf8");
const runtimeFiles = files.filter((file) => !file.endsWith(path.join("shared", "components", "ErrorBoundary.tsx")));
const stripComments = (value) => value.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\\s)\/\/.*$/gm, "$1");
function stripCommentsAndStrings(value) {
  let output = "";
  let mode = "code";
  let quote = "";
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    const next = value[i + 1];
    if (mode === "lineComment") {
      output += ch === "\\n" ? "\\n" : " ";
      if (ch === "\\n") mode = "code";
      continue;
    }
    if (mode === "blockComment") {
      if (ch === "*" && next === "/") { output += "  "; i += 1; mode = "code"; }
      else output += ch === "\\n" ? "\\n" : " ";
      continue;
    }
    if (mode === "string") {
      if (ch === "\\\\") { output += "  "; if (i + 1 < value.length) { output += value[i + 1] === "\\n" ? "\\n" : " "; i += 1; } }
      else if (ch === quote) { output += " "; mode = "code"; quote = ""; }
      else output += ch === "\\n" ? "\\n" : " ";
      continue;
    }
    if (ch === "/" && next === "/") { output += "  "; i += 1; mode = "lineComment"; continue; }
    if (ch === "/" && next === "*") { output += "  "; i += 1; mode = "blockComment"; continue; }
    if (ch === "\"" || ch === "'" || ch === "`") { output += " "; mode = "string"; quote = ch; continue; }
    output += ch;
  }
  return output;
}
const extractMemberCalls = (source, service) => {
  const code = stripCommentsAndStrings(source);
  const pattern = new RegExp(`\\b${service}\\s*(?:\\?\\.)?\\s*\\.\\s*([A-Za-z_$][\\w$]*)\\s*\\(`, "g");
  return [...code.matchAll(pattern)].map((match) => match[1]);
};
function interfaceBody(name) {
  const start = contracts.indexOf(`interface ${name}`);
  if (start < 0) return "";
  const open = contracts.indexOf("{", start);
  if (open < 0) return "";
  let depth = 0;
  for (let i = open; i < contracts.length; i += 1) {
    if (contracts[i] === "{") depth += 1;
    if (contracts[i] === "}") { depth -= 1; if (depth === 0) return contracts.slice(open + 1, i); }
  }
  return "";
}
const featureText = runtimeFiles.map((file) => stripComments(text(file))).join("\n");
const targetRoots = [
  path.join(src, "features", "inbox"),
  path.join(src, "features", "ai"),
  path.join(src, "features", "automation"),
];
const targetFiles = [];
targetRoots.forEach((target) => {
  const before = files.length;
  walk(target);
  targetFiles.push(...files.slice(before));
});
const targetText = targetFiles.map((file) => stripComments(text(file))).join("\n");
const scopedFiles = [
  path.join(src, "App.tsx"),
  ...files.filter((file) => file.includes(`${path.join(src, "shared", "shell")}${path.sep}`)),
  ...files.filter((file) => file.includes(`${path.join(src, "features", "auth")}${path.sep}`)),
];
const scopedText = scopedFiles.map((file) => stripComments(text(file))).join("\n");
const checks = [];
const check = (id, pass, detail = "") => checks.push({ id, pass: Boolean(pass), detail });

check("F1 Feature imports avoid domain/data.js", !featureText.includes("domain/data.js"));
const publicStateImport = /import\s*\{[^}]*\bstate\b[^}]*\}\s*from\s*["']@services["']/s;
check("F2 Feature imports avoid public state", !publicStateImport.test(featureText));
check("F3 Feature imports avoid public mockModel", !/\bmockModel\b/.test(featureText));
check("F3a Feature imports avoid raw uiState alias", !/\buiState\b/.test(featureText));
check("F3b Feature imports avoid raw mockRecords alias", !/\bmockRecords\b/.test(featureText));
check("F3c shell/session/App getUiState usage is zero", !/\bgetUiState\s*\(/.test(scopedText));
check("F3d no renamed mixed-state accessor", !/\b(getAppState|getLegacyState|getViewState|getRuntimeState|getStore|getSnapshot)\s*\(/.test(scopedText));
check("F3e global runtime getUiState is zero", !/\bgetUiState\s*\(/.test(featureText));
check("F3i global runtime uiState is zero", !/\buiState\b/.test(featureText));
check("F3j global runtime mockRecords is zero", !/\bmockRecords\b/.test(featureText));
check("F3k global runtime mockModel is zero", !/\bmockModel\b/.test(featureText));
check("F3l direct feature/shared/App domain import is zero", !/from\s+["']@domain\/data\.js["']/.test(featureText));
check("F3f FIX.2-C target getUiState usage is zero", !/\bgetUiState\s*\(/.test(targetText));
check("F3g FIX.2-C target raw aliases are zero", !/\b(uiState|mockRecords|mockModel)\b/.test(targetText));
check("F3h FIX.2-C target has no renamed mixed-state accessor", !/\b(getInboxState|getAutomationState|getAiState|getMessagingStore|getAgentStore)\s*\(/.test(targetText));
check("F4 data adapter has no broad domain export", !/export\s+\*\s+from\s+["'].*domain\/data\.js/.test(text(path.join(src, "services", "data.ts"))));
check("F5 only legacy bridge imports domain/data.js", fs.readdirSync(path.join(src, "services"), { recursive: true }).filter((item) => String(item).endsWith(".ts")).every((item) => !text(path.join(src, "services", item)).includes('"@domain/data.js"') || String(item).endsWith("legacyDataBridge.ts")));
check("F6 composition root exists", fs.existsSync(path.join(src, "services", "index.ts")));
const contracts = text(path.join(src, "services", "contracts", "services.ts"));
for (const name of ["BusinessService", "LeadService", "DealService", "ConversationService", "MessageService", "TaskService", "AppointmentService", "AnalyticsService", "AutomationService", "SettingsService", "IntegrationService", "BillingService", "AppServiceError"]) check(`C-${name}`, contracts.includes(`interface ${name}`));
check("F7 services expose async Promise methods", contracts.includes("Promise"));
const dataFacade = text(path.join(src, "services", "data.ts"));
const serviceRoot = text(path.join(src, "services", "index.ts"));
check("F8 public service API has no legacy state names", !/\b(state|mockModel|uiState|mockRecords|getUiState)\b/.test(dataFacade) && !/export\s*\{[^}]*\b(state|mockModel|uiState|mockRecords|getUiState)\b/s.test(serviceRoot));
check("F8a service root has no generic mixed-state export", !/export\s+(const|function)\s+(getAppSnapshot|getLegacyContext|getRuntimeState|getMixedState|getGlobalStore|appState|legacyState|runtimeState)\b/.test(serviceRoot));
check("F9 repository contracts are exported by root", /contracts\/repositories|contracts\/services/.test(text(path.join(src, "services", "index.ts"))));
const appSource = text(path.join(src, "App.tsx"));
const billingSource = text(path.join(src, "features", "settings", "Billing.tsx"));
const checkoutSource = text(path.join(src, "features", "settings", "Checkout.tsx"));
check("E2 Checkout canonical route dispatch exists", /path\s*===\s*["']settings\/billing\/checkout["']/.test(appSource) && /<Checkout\s+routeMode\s*\/>/.test(appSource));
check("E3 Billing CTA reaches Checkout", /go\(["']settings\/billing\/checkout["']\)/.test(billingSource));
check("E4 Checkout direct route initializes locally", /function Checkout\(\{ routeMode/.test(checkoutSource) && /useEffect\(/.test(checkoutSource) && /startCheckout/.test(checkoutSource));
check("E5 Checkout owns local transient step", /useState<string \| null>/.test(checkoutSource) && /setLocalStep/.test(checkoutSource));
check("F10 Features avoid mock implementation imports", !/from\s+["']@services\/mock\//.test(featureText));
check("F11 Features avoid legacy bridge imports", !/legacyDataBridge/.test(featureText));
check("F12 public facade does not expose legacy bridge", !/export\s+\*\s+from\s+["']\.\/mock\/legacyDataBridge/.test(dataFacade));
check("F13 service contracts expose typed checkout compatibility", /BillingService/.test(contracts) && /CheckoutSession/.test(contracts) && /startCheckout/.test(contracts) && /confirmCheckout/.test(contracts));
const forbiddenRawExports = /export const (businesses|jobs|dashboardData|conversations|activities|metrics)\b/;
const forbiddenMockCheckoutExports = /export const \w*MockCheckout\b/;
check("F14 public facade removes raw collection exports", !forbiddenRawExports.test(dataFacade));
check("F15 public facade removes mock-specific Checkout exports", !forbiddenMockCheckoutExports.test(dataFacade) && !forbiddenMockCheckoutExports.test(serviceRoot));
check("F16 Features remove raw collection imports", !/import\s*\{[^}]*\b(businesses|jobs|dashboardData|conversations|activities|metrics)\b[^}]*\}\s*from\s*[\"']@services[\"']/s.test(featureText));
check("F17 Features remove mock Checkout imports", !/import\s*\{[^}]*\b\w*MockCheckout\b[^}]*\}\s*from\s*[\"']@services[\"']/s.test(featureText));
check("F18 composition root uses explicit facade export", !/export\s+\*\s+from\s+[\"']\.\/data[\"']/.test(serviceRoot));
for (const name of ["activities", "invoices", "paymentMethods", "startCheckout", "getCheckout", "updateCheckoutInvoice", "continueCheckoutPayment", "confirmCheckout", "failCheckout", "cancelCheckout"]) check(`B-${name} Billing contract`, contracts.includes(`${name}`));
const targetServiceConsumers = [
  ["Dashboard", path.join(src, "features", "dashboard"), "dashboardService", "DashboardService"],
  ["Discovery", path.join(src, "features", "discovery"), "discoveryService", "DiscoveryService"],
  ["CRM", path.join(src, "features", "crm"), "crmService", "CrmService"],
  ["Pipeline", path.join(src, "features", "sales"), "pipelineService", "PipelineService"],
  ["Messaging", path.join(src, "features", "inbox"), "messagingService", "MessagingService"],
  ["Automation", path.join(src, "features", "automation"), "automationFeatureService", "AutomationFeatureService"],
  ["Settings", path.join(src, "features", "settings"), "settingsFeatureService", "SettingsFeatureService"],
  ["Integrations", path.join(src, "features", "settings"), "integrationFeatureService", "IntegrationFeatureService"],
];
const contractMethods = (name) => [...interfaceBody(name).matchAll(/\b([A-Za-z_$][\w$]*)\s*(?:\?|!)?\s*\(/g)].map((match) => match[1]);
for (const [name, root, service, interfaceName] of targetServiceConsumers) {
  const source = files.filter((file) => file.startsWith(`${root}${path.sep}`)).map((file) => text(file)).join("\\n");
  const calls = extractMemberCalls(source, service);
  const declared = new Set(contractMethods(interfaceName));
  const undeclared = calls.filter((method) => !declared.has(method));
  check(`G-${name} actual typed member call`, calls.length > 0, `methods=${[...new Set(calls)].join(",")}`);
  check(`I-${name} called methods explicitly declared`, undeclared.length === 0, undeclared.length ? `undeclared=${[...new Set(undeclared)].join(",")}` : "");
  check(`G-${name} Feature imports typed service instance`, source.includes(`from "@services"`) || source.includes("from '@services'"));
}
for (const service of ["dashboardService", "discoveryService", "crmService", "pipelineService", "messagingService", "automationFeatureService", "settingsFeatureService", "integrationFeatureService"]) {
  check(`G-${service} composition adapter contract-checked`, new RegExp(`export const ${service} = [\\s\\S]*?\\n\\};`).test(serviceRoot) && serviceRoot.includes("_typedFeatureServiceContracts"));
}
check("I-negative import-only rejected", extractMemberCalls('import { dashboardService } from "@services"; function Fixture(){ return null; }', "dashboardService").length === 0);
check("I-negative identifier-only rejected", extractMemberCalls('import { dashboardService } from "@services"; console.log(dashboardService);', "dashboardService").length === 0);
check("I-positive multiline member call accepted", extractMemberCalls("dashboardService\n  .getDashboardOverview(\n    {}\n  );", "dashboardService").includes("getDashboardOverview"));
check("I-comment/string false positives rejected", extractMemberCalls("// dashboardService.getDashboardOverview()\\nconst text = \\\"dashboardService.getDashboardOverview()\\\";", "dashboardService").length === 0);
const targetAdapterText = serviceRoot.slice(serviceRoot.indexOf("export const dashboardService"));
check("H1 target contracts contain no any escape hatch", !/\\bany\\b|any\\[\\]|Record<string, any>|\\.\\.\\.args: any/.test(contracts));
check("H2 target adapters contain no generic any escape hatch", !/Record<string, \\(\\.\\.\\.args: any\\[\\]\\) *=> *any|Record<string, any>|any\\[\\]/.test(targetAdapterText));
check("H3 target service results use named DTOs", !/ServiceResult<(?:FeatureRow|FeatureRows)(?:\\[\\])?/.test(contracts));
check("H4 target contract DTO vocabulary is explicit", ["DashboardOverviewView", "DiscoveryJobDetail", "CrmSummaryView", "DealDetailView", "ConversationView", "AutomationRuleView", "WorkspaceSettingsView", "IntegrationView"].every((name) => contracts.includes(`interface ${name}`)));
check("H5 adapter contract tuple is compile-time enforced", /_typedFeatureServiceContracts: \[DashboardService, DiscoveryService, CrmService, PipelineService, MessagingService, AutomationFeatureService, SettingsFeatureService, IntegrationFeatureService\]/.test(serviceRoot));
check("H6 bridge outputs pass through named normalizers", /normalizeRow|normalizeRows|normalizeSecuritySettings/.test(targetAdapterText));
check("H7 no target service structural widening remains", !/satisfies\\s+[A-Za-z]+Service\\s*&|Record<string, unknown>/.test(targetAdapterText));
check("H8 strict input models are declared", ["SendHumanMessageInput", "AutomationRuleInput", "UpdateWorkspaceSettingsInput", "ConnectIntegrationInput", "SecuritySettingsInput"].every((name) => contracts.includes(`interface ${name}`)));
for (const result of checks) console.log(`${result.pass ? "PASS" : "FAIL"} ${result.id}${result.detail ? ` — ${result.detail}` : ""}`);
const passed = checks.filter((item) => item.pass).length;
console.log(`V2-S0-FIX static verification: ${passed}/${checks.length}`);
if (passed !== checks.length) process.exit(1);

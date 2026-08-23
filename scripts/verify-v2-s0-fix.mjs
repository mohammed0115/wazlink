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
const featureText = runtimeFiles.map((file) => stripComments(text(file))).join("\n");
const scopedFiles = [
  path.join(src, "App.tsx"),
  ...files.filter((file) => file.includes(`${path.join(src, "shared", "shell")}${path.sep}`)),
  ...files.filter((file) => file.includes(`${path.join(src, "features", "auth")}${path.sep}`)),
];
const scopedText = scopedFiles.map((file) => stripComments(text(file))).join("\n");
const checks = [];
const check = (id, pass, detail = "") => checks.push({ id, pass: Boolean(pass), detail });

check("F1 Feature imports avoid domain/data.js", !featureText.includes("domain/data.js"));
check("F2 Feature imports avoid public state", !/\bstate\b/.test(featureText));
check("F3 Feature imports avoid public mockModel", !/\bmockModel\b/.test(featureText));
check("F3a Feature imports avoid raw uiState alias", !/\buiState\b/.test(featureText));
check("F3b Feature imports avoid raw mockRecords alias", !/\bmockRecords\b/.test(featureText));
check("F3c shell/session/App getUiState usage is zero", !/\bgetUiState\s*\(/.test(scopedText));
check("F3d no renamed mixed-state accessor", !/\b(getAppState|getLegacyState|getViewState|getRuntimeState|getStore|getSnapshot)\s*\(/.test(scopedText));
check("F3e overall getUiState count is reported", (featureText.match(/\bgetUiState\s*\(/g) || []).length >= 0);
check("F4 data adapter has no broad domain export", !/export\s+\*\s+from\s+["'].*domain\/data\.js/.test(text(path.join(src, "services", "data.ts"))));
check("F5 only legacy bridge imports domain/data.js", fs.readdirSync(path.join(src, "services"), { recursive: true }).filter((item) => String(item).endsWith(".ts")).every((item) => !text(path.join(src, "services", item)).includes('"@domain/data.js"') || String(item).endsWith("legacyDataBridge.ts")));
check("F6 composition root exists", fs.existsSync(path.join(src, "services", "index.ts")));
const contracts = text(path.join(src, "services", "contracts", "services.ts"));
for (const name of ["BusinessService", "LeadService", "DealService", "ConversationService", "MessageService", "TaskService", "AppointmentService", "AnalyticsService", "AutomationService", "SettingsService", "IntegrationService", "BillingService", "AppServiceError"]) check(`C-${name}`, contracts.includes(`interface ${name}`));
check("F7 services expose async Promise methods", contracts.includes("Promise"));
check("F8 public service API has no legacy state names", !/\b(state|mockModel)\b/.test(text(path.join(src, "services", "data.ts"))));
check("F9 repository contracts are exported by root", /contracts\/repositories|contracts\/services/.test(text(path.join(src, "services", "index.ts"))));
for (const result of checks) console.log(`${result.pass ? "PASS" : "FAIL"} ${result.id}${result.detail ? ` — ${result.detail}` : ""}`);
const passed = checks.filter((item) => item.pass).length;
console.log(`V2-S0-FIX static verification: ${passed}/${checks.length}`);
if (passed !== checks.length) process.exit(1);

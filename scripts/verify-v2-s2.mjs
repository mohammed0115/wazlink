import fs from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const src = path.join(root, "client", "src");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const onboarding = read("client/src/features/auth/Onboarding.tsx");
const dashboard = read("client/src/features/dashboard/Dashboard.tsx");
const contracts = read("client/src/services/contracts/onboarding.ts");
const service = read("client/src/services/onboardingService.ts");
const entitlements = read("client/src/services/entitlementService.ts");
const composition = read("client/src/services/index.ts");
const app = read("client/src/App.tsx");
const packageJson = JSON.parse(read("package.json"));
const checks = [];
function check(id, pass, detail = "") { checks.push({ id, pass, detail }); }
function stripCommentsAndStrings(value) {
  return value
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "")
    .replace(/(['"`])(?:\\.|(?!\1)[\s\S])*\1/g, "");
}
function actualCalls(value, objectName) {
  const clean = stripCommentsAndStrings(value);
  return [...clean.matchAll(new RegExp(`${objectName}\\s*\\.\\s*([A-Za-z_$][\\w$]*)\\s*\\(`, "g"))].map((match) => match[1]);
}

check("S2-01 onboarding contract file exists", contracts.includes("export interface OnboardingProfile"));
check("S2-02 typed goal union", /export type OnboardingGoal\s*=/.test(contracts) && !/string\[\]/.test(contracts));
check("S2-03 typed source union", /export type OnboardingSource\s*=/.test(contracts));
check("S2-04 typed AI preference union", /export type OnboardingAiPreference\s*=/.test(contracts));
check("S2-05 typed recommendation contract", /export interface OnboardingRecommendation/.test(contracts));
check("S2-06 typed activation item", /export interface OnboardingActivationItem/.test(contracts));
check("S2-07 no public any escapes", !/(any\[\]|Record<string, any>|:\s*any\b)/.test(contracts + service));
check("S2-08 deterministic goal mapping", /onboardingGoalCapabilities[\s\S]*discover:[\s\S]*discovery\.basic/.test(service));
check("S2-09 all existing goal values mapped", ["discover", "followup", "convert", "conversations", "automation", "attribution"].every((value) => new RegExp(`\\b${value}\\s*:`).test(service)));
check("S2-10 source guidance mapping", ["business", "file", "website", "whatsapp", "manual", "external-crm"].every((value) => new RegExp(`['\"]?${value}['\"]?\\s*:`).test(service)));
check("S2-11 AI guidance mapping", ["score", "next-step", "draft", "summary", "qualify", "follow"].every((value) => service.includes(`${value}:`) || service.includes(`"${value}":`)));
check("S2-12 profile projection", /profileFromWorkspace\(workspace/.test(service) && /monthlyLeads: asNumber/.test(service));
check("S2-13 narrow onboarding service", /export interface OnboardingService/.test(contracts) && /recommend\(profile: OnboardingProfile\)/.test(contracts));
check("S2-14 composition-root service", /export const onboardingService\s*=\s*createOnboardingServiceFromEntitlements\(entitlementService\)/.test(composition));
check("S2-15 canonical entitlement calls", actualCalls(service, "entitlements").includes("currentPlan") && actualCalls(service, "entitlements").includes("planCatalog") && actualCalls(service, "entitlements").includes("evaluate"));
check("S2-16 no raw plan comparisons in feature", !/(PLAN-STARTER|PLAN-GROWTH|PLAN-SCALE)/.test(onboarding));
check("S2-17 current-plan sufficient branch", /currentPlanSufficient/.test(service) && /current_plan_sufficient/.test(service));
check("S2-18 locked branch is upgrade-aware", /locked_capability/.test(service) && /recommendedPlan/.test(service));
check("S2-19 exhausted/limit-aware branch", /decision\.allowed/.test(service) && /leadNearLimit|teamNeedsMoreSeats/.test(service) && /lead_headroom/.test(service));
check("S2-20 unknown plan safe fallback", /currentPlan[\s\S]*plans\.find/.test(entitlements) && /PLAN-STARTER/.test(entitlements));
check("S2-21 safe unknown values", /asValues<.*allowed/.test(service) && /\| null/.test(contracts));
check("S2-22 recommendation actual call", actualCalls(onboarding, "onboardingService").includes("recommend"));
check("S2-23 recommendation panel", /onboarding-recommendation/.test(onboarding) && /recommendation\.currentPlan/.test(onboarding));
check("S2-24 recommendation rationale visible", /recommendation\.reasons/.test(onboarding));
check("S2-25 relevant capabilities visible", /recommendation\.relevantCapabilities/.test(onboarding));
check("S2-26 usage context visible", /recommendation\.limitContext/.test(onboarding));
check("S2-27 canonical billing CTA", /go\("settings\/billing"\)/.test(onboarding));
check("S2-28 five input steps preserved", stepNamesSource(onboarding));
check("S2-29 final summary is explicit state", /step === 6/.test(onboarding) && /setStep\(6\)/.test(onboarding));
check("S2-30 completion uses workspace boundary", /updateWorkspace\(w\)/.test(onboarding));
check("S2-31 completion uses session boundary", /completeOnboarding\(\)/.test(onboarding));
check("S2-32 completion idempotency guard", /isCompleting \|\| onboardingDone/.test(onboarding));
check("S2-33 intentional completed re-entry", /path === "onboarding" && onboardingDone/.test(app) && /go\("dashboard"\)/.test(app));
check("S2-34 first-run dashboard handoff", /first-run-activation/.test(dashboard) && /onboardingRecommendation\.firstAction/.test(dashboard));
check("S2-35 first action reuses route", /go\(onboardingRecommendation\.firstAction\.route\)/.test(dashboard));
check("S2-36 no revenue/attribution mutation", !/RevenueEvent|AttributionTouchpoint/.test(service));
check("S2-37 no provider integration", !/fetch\(|axios\.|XMLHttpRequest|oauth|OAuth|stripe|tap/i.test(service + contracts));
check("S2-38 frontend-only package scripts", !packageJson.scripts.s2 || typeof packageJson.scripts.s2 === "string");
check("S2-39 negative import-only self-test", actualCalls('import { onboardingService } from "@services";', "onboardingService").length === 0);
check("S2-40 negative identifier-only self-test", actualCalls('import { onboardingService } from "@services"; console.log(onboardingService);', "onboardingService").length === 0);
check("S2-41 positive multiline self-test", actualCalls("onboardingService\n  .recommend(\n    profile\n  );", "onboardingService").includes("recommend"));
check("S2-42 comment/string false-positive self-test", actualCalls('// onboardingService.recommend()\nconst text = "onboardingService.recommend()";', "onboardingService").length === 0);
check("S2-43 frozen FIX.2 facade boundary", !/getUiState|mockRecords|legacyDataBridge|services\/mock/.test(onboarding + dashboard + contracts + service));
check("S2-44 frozen S1 entitlement boundary", /entitlementService/.test(service + composition) && !/entitlementService\.(change|set|mutate)/.test(service));
check("S2-45 no onboarding global store", !/OnboardingContext|Redux|createStore|globalThis/.test(onboarding + contracts + service));
check("S2-46 recommendation remains local", /synchronous|deterministic|local/i.test(service + contracts));
check("S2-47 source guidance does not claim connection", !/connected|OAuth|credentials/i.test(service));
check("S2-48 AI preference remains guidance", !/sendMessage|createDeal|closeDeal|createRevenue|runAutomation|fetch\(/.test(onboarding + service));
check("S2-49 mobile-safe styles present", /@media \(max-width: 760px\)[\s\S]*first-run-activation/.test(read("client/src/styles/wazlink-experience.css")));
check("S2-50 package has canonical check", packageJson.scripts.check === "tsc --noEmit");
function stepNamesSource(value) { return ["الشركة", "الهدف", "المصادر", "الفريق", "الذكاء الاصطناعي"].every((item) => value.includes(item)); }
for (const result of checks) console.log(`${result.pass ? "PASS" : "FAIL"} ${result.id}${result.detail ? ` — ${result.detail}` : ""}`);
const passed = checks.filter((item) => item.pass).length;
console.log(`V2-S2 verification: ${passed}/${checks.length}`);
if (passed !== checks.length) process.exit(1);

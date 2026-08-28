import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const projection = read("client/src/services/upgradeProjection.ts");
const gateSource = read("client/src/shared/components/EntitlementGate.tsx");
const billingSource = read("client/src/features/settings/Billing.tsx");
const contracts = read("client/src/services/contracts/services.ts");
const entitlements = read("client/src/services/contracts/entitlements.ts");
const entitlementImplementation = read("client/src/services/entitlementService.ts");
const packageText = read("package.json");
const sources = `${projection}\n${gateSource}\n${billingSource}`;
const withoutComments = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "");
const call = (source, object, method) => new RegExp(`\\b${object}\\s*\\.\\s*${method}\\s*\\(`).test(withoutComments(source));

let passed = 0;
const failures = [];
function gate(name, condition, evidence = "") {
  if (condition) passed += 1;
  else failures.push(`${name}${evidence ? ` — ${evidence}` : ""}`);
}

const runtimeScript = `
import { createEntitlementService } from './client/src/services/entitlementService.ts';
import { createUpgradeProjection } from './client/src/services/upgradeProjection.ts';
const limits = (leads, discoveryRuns, seats, automationRuns, aiAnalyses) => ({ leads, discoveryRuns, seats, automationRuns, aiAnalyses });
const plans = [
  { id: 'PLAN-STARTER', name: 'البداية', price: 0, currency: 'SAR', limits: limits(100, 10, 1, null, null), features: ['CRM'] },
  { id: 'PLAN-GROWTH', name: 'النمو', price: 299, currency: 'SAR', limits: limits(5000, 100, 5, 500, 1000), features: ['CRM', 'Pipeline', 'Automation'] },
  { id: 'PLAN-SCALE', name: 'المقياس', price: 799, currency: 'SAR', limits: limits(null, null, null, null, null), features: ['All'] },
];
const make = (planId, rows) => {
  const billing = { plans: () => plans, currentSubscription: () => ({ planId }), usage: () => rows };
  return createUpgradeProjection(createEntitlementService(billing));
};
const starter = make('PLAN-STARTER', [
  { key: 'leads', label: 'Leads', used: 2, limit: 100, remaining: 98 },
  { key: 'discoveryRuns', label: 'Discovery', used: 10, limit: 10, remaining: 0 },
  { key: 'automationRuns', label: 'Automation', used: 0, limit: 0, remaining: 0 },
]);
const growth = make('PLAN-GROWTH', [
  { key: 'leads', label: 'Leads', used: 2, limit: 5000, remaining: 4998 },
  { key: 'discoveryRuns', label: 'Discovery', used: 10, limit: 100, remaining: 90 },
  { key: 'automationRuns', label: 'Automation', used: 1, limit: 500, remaining: 499 },
]);
const locked = starter.getContext('automation.rules');
const exhausted = starter.getContext('discovery.basic');
const limited = growth.getContext('discovery.basic');
const available = growth.getContext('export.csv');
const unknown = growth.getContext('future.capability');
console.log(JSON.stringify({ locked, exhausted, limited, available, unknown, targetPrice: locked.targetPlan?.price || null }));
`;
let runtime = null;
try {
  runtime = JSON.parse(execFileSync("pnpm", ["exec", "tsx", "-e", runtimeScript], { cwd: root, encoding: "utf8" }));
} catch (error) {
  failures.push(`S6 runtime projection failed — ${error instanceof Error ? error.message : String(error)}`);
}

// Registration, typed surface, and actual service-call integrity.
gate("S6 command registered", packageText.includes('"verify-v2-s6": "node scripts/verify-v2-s6.mjs"'));
gate("typed UpgradeContext exists", contracts.includes("export interface UpgradeContext"));
gate("typed UpgradeProjectionService exists", contracts.includes("export interface UpgradeProjectionService"));
gate("typed upgrade reason union exists", contracts.includes('"locked" | "limited" | "exhausted" | "available" | "unknown"'));
gate("typed usage pressure exists", contracts.includes("export type UsagePressure"));
gate("projection calls EntitlementService.evaluate", call(projection, "service", "evaluate"));
gate("projection calls canonical planCatalog", call(projection, "service", "planCatalog"));
gate("projection calls canonical currentPlan", call(projection, "service", "currentPlan"));
gate("Gate consumes upgrade projection", call(gateSource, "upgradeProjection", "getContext"));
gate("Billing consumes upgrade projection", call(billingSource, "upgradeProjection", "getContext"));
gate("no S6 Upgrade Store", !/Upgrade(Store|State)|upgradeStore/.test(sources));
gate("no new any escape hatch in S6 additions", !/Record<string, any>|:\s*any\b|any\[\]/.test(projection + gateSource));
gate("no raw plan-name access gating", !/(?:plan|currentPlan)\.(?:name|id)\s*===\s*["']/.test(projection + gateSource));
gate("no payment/provider integration", !/stripe|paypal|paymentIntent|webhook|api[_-]?key|secret/i.test(projection + gateSource));
gate("no customer revenue mutation", !/RevenueEvent|AttributionTouchpoint|createRevenue|recognizedRevenue\s*=/.test(projection + gateSource));

// Behavioral state matrix through the production factory and canonical entitlement engine.
gate("runtime loaded", Boolean(runtime));
gate("locked capability is blocked", runtime?.locked?.reason === "locked" && runtime.locked.canUse === false);
gate("locked capability has contextual Billing action", runtime?.locked?.showUpgrade === true && runtime.locked.action?.route.startsWith("settings/billing?capability=automation.rules"));
gate("exhausted capability is blocked", runtime?.exhausted?.reason === "exhausted" && runtime.exhausted.canUse === false);
gate("exhausted remaining clamps to zero", runtime?.exhausted?.usage?.remaining === 0 && runtime.exhausted.pressure === "exhausted");
gate("limited capability remains usable", runtime?.limited?.reason === "limited" && runtime.limited.canUse === true && runtime.limited.action === null);
gate("available capability remains usable", runtime?.available?.reason === "available" && runtime.available.canUse === true && runtime.available.showUpgrade === false);
gate("unknown capability fails closed", runtime?.unknown?.reason === "unknown" && runtime.unknown.canUse === false && runtime.unknown.action === null);
gate("unknown capability has no target plan", runtime?.unknown?.targetPlan === null);
gate("target price comes from canonical catalog", runtime?.targetPrice === 299 && runtime?.locked?.targetPlan?.id === "PLAN-GROWTH");
gate("Billing route is canonical", projection.includes('const BILLING_ROUTE = "settings/billing"'));
gate("upgrade query is contextual only", projection.includes("capability=") && projection.includes("reason="));
gate("query does not grant entitlement", !/query\.(get|set).*allowed|allowed.*query\.(get|set)|plan=.*grant/i.test(sources));

// Presentation and safety.
gate("limited state copy is non-blocking", gateSource.includes('context.reason === "limited"') && gateSource.includes("{children}"));
gate("locked/exhausted copy is reason-specific", gateSource.includes('context.reason === "exhausted"') && gateSource.includes('context.reason === "locked"'));
gate("unknown status is explicit", gateSource.includes("UNKNOWN") && projection.includes('status: "UNKNOWN"'));
gate("unlimited avoids Infinity display", !/Infinity|\/\s*Infinity/.test(projection + gateSource));
gate("over-limit presentation remains clamped", entitlementImplementation.includes("Math.max(0, limit.value - used)") && projection.includes("usage?.limit.kind === \"finite\""));
gate("no fake commercial claims", !/discount|limited-time|countdown|trial ending|scarcity|savings/i.test(projection + gateSource));
gate("Billing link uses canonical action route", gateSource.includes("context.action?.route") && billingSource.includes("upgradeContext"));
gate("Checkout remains existing local boundary", read("client/src/features/settings/Checkout.tsx").includes("لا Stripe") && read("client/src/features/settings/Checkout.tsx").includes("finishCheckoutJourney"));
gate("billing/customer revenue separation remains documented", read("client/src/features/settings/Billing.tsx").includes("RevenueEvent") && read("client/src/features/settings/Checkout.tsx").includes("RevenueEvent"));

// False-positive resistance: actual call must disappear for the verifier to fail.
const strippedCall = projection.replace(/service\.evaluate\(/g, "service.evaluate_removed(");
gate("actual-call gate is not identifier-only", !call(strippedCall, "service", "evaluate"));
gate("actual-call gate is not comment-only", call("// service.evaluate(capability)\\nservice.evaluate_removed(capability)", "service", "evaluate") === false);

gate("no duplicate plan numeric pricing in projection", !/PLAN-(STARTER|GROWTH|SCALE).*\d+|price\s*:\s*\d+/.test(projection));
gate("no feature mutation in projection", !/changePlan|startCheckout|confirmCheckout|\\b(create|update|delete|send)\\b/.test(projection));

const total = passed + failures.length;
console.log(`V2-S6 verifier: ${passed}/${total} PASS`);
if (failures.length) {
  console.error(failures.map((failure, index) => `${index + 1}. ${failure}`).join("\n"));
  process.exitCode = 1;
}

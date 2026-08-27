import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const files = {
  appShell: read("client/src/shared/shell/AppShell.tsx"),
  sidebar: read("client/src/shared/shell/Sidebar.tsx"),
  topbar: read("client/src/shared/shell/Topbar.tsx"),
  routeMeta: read("client/src/shared/shell/routeMeta.ts"),
  navigation: read("client/src/shared/shell/shellNavigation.ts"),
  responsive: read("client/src/styles/responsive.css"),
  experience: read("client/src/styles/wazlink-experience.css"),
  services: read("client/src/services/index.ts"),
};

let passed = 0;
const failures = [];
function gate(name, condition, evidence = "") {
  if (condition) passed += 1;
  else failures.push(`${name}${evidence ? ` — ${evidence}` : ""}`);
}
function includes(source, value) { return source.includes(value); }
function methodCall(source, object, method) {
  return new RegExp(`\\b${object}\\s*\\.\\s*${method}\\s*\\(`).test(source);
}
function functionCall(source, name) {
  return new RegExp(`\\b${name}\\s*\\(`).test(source);
}

// Repository-facing shell contract gates.
gate("typed shell navigation file exists", includes(files.navigation, "export type ShellNavigationItem"));
gate("typed shell context exists", includes(files.navigation, "export type ShellContext"));
gate("typed navigation state exists", includes(files.navigation, "export type ShellNavigationState"));
gate("typed plan projection exists", includes(files.navigation, "export type ShellPlanProjection"));
gate("typed usage projection exists", includes(files.navigation, "export type ShellUsageProjection"));
gate("navigation projects from EntitlementService", includes(files.navigation, "service: EntitlementService"));
gate("shell context has canonical workspace", includes(files.navigation, "workspace: WorkspaceSummary"));
gate("shell context has canonical plan", includes(files.navigation, "plan: ShellPlanProjection"));
gate("shell context has canonical usage", includes(files.navigation, "usage: ShellUsageProjection"));
gate("shell context has navigation projection", includes(files.navigation, "navigation: ShellNavigationState[]"));
gate("canonical source navigation is reused", includes(files.navigation, "navItems") && includes(files.navigation, "shellNavigationItems"));
gate("no competing router", !includes(files.navigation, "react-router") && !includes(files.appShell, "react-router"));
gate("single route matcher reused", includes(files.navigation, "routeNavId(route)") && includes(files.sidebar, "projectShellNavigation"));
gate("query-safe route parsing preserved", includes(files.routeMeta, "route.startsWith") && includes(read("client/src/shared/router/useHashRoute.ts"), "URLSearchParams"));
gate("deep CRM parent match", includes(files.navigation, 'crm: ["crm", "leads"]') || includes(files.routeMeta, 'route.startsWith("crm/leads/")'));
gate("deep pipeline parent match", includes(files.navigation, 'pipeline: ["pipeline", "deals"]') || includes(files.routeMeta, 'route.startsWith("deals/")'));
gate("deep settings parent match", includes(files.navigation, 'settings: ["settings"'));
gate("checkout parent match", includes(files.navigation, "settings/billing"));
gate("integrations parent match", includes(files.navigation, "settings/integrations"));

// Actual shell consumers, not import/name-only checks.
gate("AppShell calls projectShellContext", functionCall(files.appShell, "projectShellContext"), "actual projection call");
gate("Sidebar calls projectShellNavigation", functionCall(files.sidebar, "projectShellNavigation"), "actual navigation call");
gate("Sidebar calls entitlement currentPlan", methodCall(files.sidebar, "entitlementService", "currentPlan"));
gate("Sidebar calls entitlement usage", methodCall(files.sidebar, "entitlementService", "usageFor"));
gate("Sidebar routes available item", includes(files.sidebar, 'item.id)}'));
gate("Sidebar routes locked item to Billing", includes(files.sidebar, 'go(locked ? "settings/billing" : item.id)'));
gate("Sidebar exposes aria-current", includes(files.sidebar, "aria-current={item.active"));
gate("Sidebar exposes entitlement state", includes(files.sidebar, "data-entitlement-state={decision?.status"));
gate("Topbar calls entitlement currentPlan", methodCall(files.topbar, "entitlementService", "currentPlan"));
gate("Topbar exposes plan context", includes(files.topbar, "topbar-plan-context"));
gate("Topbar exposes expanded menu state", includes(files.topbar, "aria-expanded={drawerOpen}"));
gate("AppShell closes drawer on route change", includes(files.appShell, "setDrawerOpen(false)") && includes(files.appShell, "[route]"));
gate("AppShell closes drawer on Escape", includes(files.appShell, 'event.key === "Escape"'));
gate("AppShell renders dismissible backdrop", includes(files.appShell, "shell-backdrop") && includes(files.appShell, "إغلاق القائمة"));
gate("AppShell keeps Sidebar and workspace structure", includes(files.appShell, "<Sidebar") && includes(files.appShell, "<main className=\"workspace\">"));

// Entitlement-aware semantic behavior.
gate("discovery capability mapped", includes(files.navigation, '"discovery.basic"'));
gate("automation capability mapped", includes(files.navigation, '"automation.rules"'));
gate("copilot capability mapped", includes(files.navigation, '"inbox.copilot"'));
gate("locked state is explicit", includes(files.sidebar, 'decision?.status === "LOCKED"'));
gate("exhausted state is explicit", includes(files.sidebar, 'decision?.status === "EXHAUSTED"'));
gate("limited state is explicit", includes(files.sidebar, 'decision?.status === "LIMITED"'));
gate("unknown/no decision remains available only for non-gated items", includes(files.sidebar, 'decision?.status ?? "AVAILABLE"'));
gate("locked item is not disabled as dead control", includes(files.sidebar, "aria-disabled={locked ? true : undefined}") && !includes(files.sidebar, "disabled={locked}"));
gate("usage remaining is projected", includes(files.navigation, "remaining: usage.remaining"));
gate("usage percentage is projected", includes(files.navigation, "percentage: usage.percentage"));
gate("finite limit is projected", includes(files.navigation, 'usage.limit.kind === "finite"'));
gate("workspace metadata is rendered", includes(files.sidebar, "workspaceMeta"));

// Mobile, RTL, accessibility, and responsive protections.
gate("mobile drawer open CSS exists", includes(files.responsive, ".sidebar.open"));
gate("mobile drawer hidden by default", includes(files.responsive, ".sidebar,.sidebar.collapsed{display:none!important"));
gate("mobile drawer restored when open", includes(files.responsive, ".sidebar.open{display:flex!important"));
gate("desktop sidebar collapse preserved", includes(files.responsive, ".sidebar{width:82px"));
gate("horizontal overflow clamp preserved", includes(files.responsive, "overflow-x:hidden"));
gate("local wide scrollers preserved", includes(files.responsive, ".inbox-layout,.pipeline-board{overflow-x:auto}"));
gate("RTL logical positioning preserved", includes(files.experience, "inset-inline-end"));
gate("backdrop is scoped", includes(files.experience, ".app-shell .shell-backdrop"));
gate("locked styles are scoped", includes(files.experience, ".app-shell .side-link.is-locked"));
gate("plan context responsive hide", includes(files.experience, ".app-shell .topbar-plan-context { display:none"));
gate("button navigation semantics preserved", includes(files.sidebar, '<button') && includes(files.topbar, '<button'));
gate("active navigation accessibility preserved", includes(files.sidebar, "aria-current"));
gate("drawer dismissal accessibility preserved", includes(files.appShell, 'aria-label="إغلاق القائمة"'));

// Boundary and regression protections.
gate("legacy bridge remains below composition root", !includes(files.navigation, "legacyDataBridge") && includes(files.services, "legacyDataBridge"));
gate("shell does not import domain data", !includes(files.appShell, "domain/data") && !includes(files.sidebar, "domain/data") && !includes(files.topbar, "domain/data"));
gate("shell does not import mock services", !includes(files.appShell, "services/mock") && !includes(files.sidebar, "services/mock") && !includes(files.topbar, "services/mock"));
gate("shell uses public services alias", includes(files.sidebar, 'from "@services"') && includes(files.topbar, 'from "@services"'));
gate("S2 handoff class remains available", includes(files.experience, "dashboard-journey-card"));
gate("entitlement Sidebar remains available", includes(files.experience, "usage-card"));
gate("no payment/provider shell dependency", !includes(files.appShell, "stripe") && !includes(files.sidebar, "stripe") && !includes(files.topbar, "stripe"));
gate("no API shell dependency", !includes(files.navigation, "fetch(") && !includes(files.appShell, "fetch(") && !includes(files.sidebar, "fetch("));

// Verifier-level negative self-tests: import/name-only and fake strings must not qualify.
const positive = `const x = () => {\n  dashboardService\n    .open();\n};`;
const importOnly = `import { dashboardService } from "@services";`;
const identifierOnly = `const x = dashboardService;`;
const commentFake = `// dashboardService.open()\nconst x = "dashboardService.open()";`;
const scopedMemberCall = (source, object, method) => {
  const withoutComments = source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "")
    .replace(/(['\"]).*?\1/g, "");
  return new RegExp(`\\b${object}\\s*\\.\\s*${method}\\s*\\(`).test(withoutComments);
};
gate("negative import-only fixture rejected", !scopedMemberCall(importOnly, "dashboardService", "open"));
gate("negative identifier-only fixture rejected", !scopedMemberCall(identifierOnly, "dashboardService", "open"));
gate("negative comment/string fixture rejected", !scopedMemberCall(commentFake, "dashboardService", "open"));
gate("positive multiline member-call fixture accepted", scopedMemberCall(positive, "dashboardService", "open"));
gate("production shell call detector sees AppShell projection", functionCall(files.appShell, "projectShellContext"));
gate("production shell call detector sees Sidebar projection", functionCall(files.sidebar, "projectShellNavigation"));

const total = passed + failures.length;
console.log(`V2-S3 verifier: ${passed}/${total} PASS`);
if (failures.length) {
  console.error(failures.map((failure, index) => `${index + 1}. ${failure}`).join("\n"));
  process.exitCode = 1;
}

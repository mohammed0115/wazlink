import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const client = join(root, "client");
const src = join(client, "src");
const read = (path) => readFileSync(path, "utf8");
const checks = [];

function check(name, pass, detail = "") {
  checks.push({ name, pass, detail });
}

const indexHtml = read(join(client, "index.html"));
const main = read(join(src, "main.tsx"));
const app = read(join(src, "App.tsx"));
const sourceFiles = [];
function collect(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collect(path);
    else if (/\.(ts|tsx|js)$/.test(entry.name)) sourceFiles.push(path);
  }
}
collect(src);
const source = sourceFiles.map((path) => read(path)).join("\n");
const featureAndShared = sourceFiles
  .filter((path) => path.includes(`${join(src, "features")}${path.includes("\\") ? "\\" : "/"}`) || path.includes(`${join(src, "shared")}${path.includes("\\") ? "\\" : "/"}`) || path === join(src, "App.tsx"))
  .map((path) => read(path))
  .join("\n");

check("single React mount", (indexHtml.match(/<div id=["']app["']\s*><\/div>/g) ?? []).length === 1 && main.includes('getElementById("app")'));
check("single build entry", (indexHtml.match(/src=["']\/src\/main\.tsx["']/g) ?? []).length === 1);
check("centralized hash router", app.includes("useHashRoute") && app.includes("isPublicRoute"));
check("shared app shell", app.includes("<AppShell route={path}>") && existsSync(join(src, "shared/shell/AppShell.tsx")));
check("shared error boundary", app.includes("<ErrorBoundary") && existsSync(join(src, "shared/components/ErrorBoundary.tsx")));
check("shared loading state", app.includes("<LoadingState") && existsSync(join(src, "shared/components/States.tsx")));
check("service boundary", existsSync(join(src, "services/data.ts")) && featureAndShared.includes("@services/data"));
check("mock data isolated from consumers", !featureAndShared.includes("@domain/data.js"));
check("environment config centralized", existsSync(join(src, "config/env.ts")) && existsSync(join(root, ".env.example")) && !sourceFiles.filter((path) => !path.endsWith("config/env.ts")).some((path) => /import\.meta\.env/.test(read(path))));
check("central domain types", existsSync(join(src, "domain/types.ts")) && ["Business", "Lead", "Deal", "Conversation", "RevenueEvent", "AutomationRule", "Workspace", "Subscription"].every((name) => read(join(src, "domain/types.ts")).includes(`interface ${name}`)));
check("declarative sidebar state", !read(join(src, "shared/shell/AppShell.tsx")).includes("classList.toggle"));
check("legacy DOM isolation", !source.includes("innerHTML") && !source.includes("document.querySelector"));
check("lazy route chunks", app.includes("lazy(() => import(") && app.includes("<Suspense"));
check("smoke docs present", ["REACT_ARCHITECTURE_AUDIT.md", "DEAD_CODE_REPORT.md", "V2_ARCHITECTURE.md", "V2_FRONTEND_STRUCTURE.md", "V2_MIGRATION_STATUS.md", "V2_TECHNICAL_DECISIONS.md", "V2-S0_CTO_IMPLEMENTATION_REPORT.md"].every((name) => existsSync(join(root, name))));
check("production build output", existsSync(join(root, "dist/public/index.html")) && readdirSync(join(root, "dist/public/assets"), { withFileTypes: true }).some((entry) => entry.isFile() && entry.name.endsWith(".js")));

for (const result of checks) {
  console.log(`${result.pass ? "PASS" : "FAIL"} ${result.name}${result.detail ? ` — ${result.detail}` : ""}`);
}
const passed = checks.filter((result) => result.pass).length;
console.log(`\nV2-S0 smoke: ${passed}/${checks.length} gates passed`);
if (passed !== checks.length) process.exitCode = 1;

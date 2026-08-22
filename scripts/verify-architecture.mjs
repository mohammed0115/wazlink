/**
 * حارس معمارية الواجهة الأمامية.
 *
 * بعد اكتمال التحويل وحذف طبقة Vanilla، لم يعد الفحص يقيس نسبة تقدّم؛
 * صار يمنع الانزلاق المعماري: طبقة نطاق بلا DOM، وطبقة عرض بلا HTML نصي،
 * وميزات لا تستورد بعضها، ولا بقايا ميتة.
 */
import { readFile, readdir, stat } from "node:fs/promises";

const ROOT = new URL("../", import.meta.url);
const SRC = new URL("client/src/", ROOT);
const DOMAIN = new URL("domain/", SRC);
const FEATURES = new URL("features/", SRC);

const results = [];
const check = (id, pass, detail = "") => results.push({ id, pass: Boolean(pass), detail });

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? "/" : ""}`, dir);
    if (entry.isDirectory()) out.push(...(await walk(child)));
    else out.push(child);
  }
  return out;
}
const exists = async (url) => stat(url).then(() => true, () => false);

// ── 1. طبقة النطاق ────────────────────────────────────────────
const domainFiles = (await readdir(DOMAIN)).filter((f) => f.endsWith(".js"));
const domainSources = await Promise.all(domainFiles.map((f) => readFile(new URL(f, DOMAIN), "utf8")));
const domainText = domainSources.join("\n");

check("D1 طبقة النطاق موجودة", domainFiles.length > 0, `${domainFiles.length} وحدة`);
check("D2 طبقة النطاق بلا اعتماد على DOM", !/\bdocument\.|window\./.test(domainText));
check("D3 طبقة النطاق بلا دوال عرض", !/export function render/.test(domainText));
check("D4 طبقة النطاق بلا JSX", !domainFiles.some((f) => f.endsWith(".tsx")));
check(
  "D5 طبقة النطاق لا تستورد طبقة العرض",
  !/from "\.\.\/(features|shared|styles)/.test(domainText),
);

// ── 2. طبقة العرض ─────────────────────────────────────────────
const featureDirs = (await readdir(FEATURES, { withFileTypes: true })).filter((e) => e.isDirectory()).map((e) => e.name);
const uiFiles = (await walk(SRC)).filter((u) => !u.pathname.includes("/domain/") && /\.tsx?$/.test(u.pathname));
const uiSources = await Promise.all(uiFiles.map((u) => readFile(u, "utf8")));
const uiText = uiSources.join("\n");

check("U1 كل الميزات لها مجلد", featureDirs.length >= 12, `${featureDirs.length} ميزة`);
check("U2 طبقة العرض بلا قوالب HTML نصية", !/innerHTML\s*=/.test(uiText));
check(
  "U3 لا استخدام لـdangerouslySetInnerHTML خارج أيقونات SVG",
  uiSources.filter((s) => s.includes("dangerouslySetInnerHTML")).every((s) => s.includes("navIconPaths")),
);
check("U4 لا نداءات شبكة في الواجهة", !/fetch\s*\(|XMLHttpRequest|WebSocket/.test(uiText.replace(/\/\*[\s\S]*?\*\//g, " ")));
check("U5 لا تخزين دائم", !/localStorage|sessionStorage|indexedDB/.test(uiText));

// ── 3. عزل الميزات ────────────────────────────────────────────
const crossImports = [];
for (const [index, url] of uiFiles.entries()) {
  const match = url.pathname.match(/features\/([^/]+)\//);
  if (!match) continue;
  const own = match[1];
  for (const importMatch of uiSources[index].matchAll(/from "([^"]+)"/g)) {
    const other = importMatch[1].match(/features\/([^/]+)\//);
    if (other && other[1] !== own) crossImports.push(`${own} → ${other[1]}`);
  }
}
check(
  "F1 الميزات لا تستورد بعضها إلا عبر shared",
  crossImports.length === 0,
  crossImports.length ? [...new Set(crossImports)].join("، ") : `${featureDirs.length} ميزة معزولة`,
);

// ── 4. لا بقايا ميتة ──────────────────────────────────────────
check("C1 طبقة Vanilla محذوفة", !(await exists(new URL("client/js", ROOT))));
check("C2 مجلد الأنماط القديم محذوف", !(await exists(new URL("client/css", ROOT))));
check("C3 سكافولد shadcn محذوف", !(await exists(new URL("client/src/components/ui", ROOT))));
check("C4 لا مجلد routes قديم", !(await exists(new URL("client/src/routes", ROOT))));

// ── 5. نقطة الدخول ────────────────────────────────────────────
const indexHtml = await readFile(new URL("client/index.html", ROOT), "utf8");
check("E1 نقطة الدخول React", indexHtml.includes("/src/main.tsx"));
check("E2 لا مرجع لطبقة Vanilla", !indexHtml.includes("/js/app.js"));
check("E3 الأنماط تمر عبر الحزمة", !indexHtml.includes('<link rel="stylesheet"'));

for (const result of results) {
  console.log(`${result.pass ? "PASS" : "FAIL"}  ${result.id}${result.detail ? `  — ${result.detail}` : ""}`);
}
const passed = results.filter((r) => r.pass).length;
console.log(`\nverify-architecture: ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);

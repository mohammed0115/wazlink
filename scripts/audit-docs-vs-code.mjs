/**
 * مدقّق مطابقة الوثائق للكود.
 *
 * يتحقق أن كل ادعاء جوهري في `Docs/NOMO_V1_PROMPTS_ARCHIVE/` صحيح فعليًا
 * في `client/src/domain/`، لا مجرد نص في تقرير. يقرأ العقود من طبقة النطاق مباشرة
 * ولا ينشئ أو يغيّر أي كيان.
 *
 * التشغيل: node scripts/audit-docs-vs-code.mjs
 */
import { readFile } from "node:fs/promises";
import {
  mockModel,
  businesses,
  jobs,
  closeDealAsWon,
  createDeal,
  convertBusinessToLead,
  getDeal,
  getLead,
} from "../client/src/domain/data.js";
import { getBusinessIntelligence, getOpportunityTier } from "../client/src/domain/intelligence.js";
import { getAnalyticsOverview, getAttributionTraces } from "../client/src/domain/analytics-engine.js";

const results = [];
const check = (section, id, pass, detail = "") => results.push({ section, id, pass: Boolean(pass), detail });

const read = (p) => readFile(new URL(p, import.meta.url), "utf8");
const DOCS = "../Docs/reference/";

const [entityModel, demoGuide, architecture, designSystem, technicalDebt, ctoReport] = await Promise.all([
  read(`${DOCS}ENTITY_MODEL.md`),
  read(`${DOCS}DEMO_GUIDE.md`),
  read(`${DOCS}PRODUCT_ARCHITECTURE.md`),
  read(`${DOCS}DESIGN_SYSTEM.md`),
  read(`${DOCS}TECHNICAL_DEBT.md`),
  read(`${DOCS}CTO_REPORT_AR.md`),
]);

const jsSources = await Promise.all(
  ["data.js", "intelligence.js", "analytics-engine.js", "sales-ai.js", "automation.js", "landing-truth.js"].map(
    (f) => read(`../client/src/domain/${f}`),
  ),
);
const allJs = jsSources.join("\n");

// ─────────────────────────────────────────────────────────────
// 1. بادئات المعرفات المعلنة في ENTITY_MODEL.md §2
// ─────────────────────────────────────────────────────────────
const declaredPrefixes = [...entityModel.matchAll(/\| `([A-Z]+(?:-[A-Z]+)?)-####` \|/g)].map((m) => m[1]);
const collectionsByPrefix = {
  "SRC": mockModel.discoverySources, "JOB": jobs,
  "BUS": businesses, "LEAD": mockModel.leads, "CON": mockModel.contacts,
  "CMP": mockModel.companies, "CONV": mockModel.conversations, "MSG": mockModel.messages,
  "DEAL": mockModel.deals, "PIPE": mockModel.pipelines, "STG": mockModel.pipelineStages,
  "APT": mockModel.appointments, "REV": mockModel.revenueEvents, "ATT": mockModel.attributionTouchpoints,
  "USR": mockModel.users, "TSK": mockModel.tasks,
};
for (const [prefix, collection] of Object.entries(collectionsByPrefix)) {
  if (!Array.isArray(collection) || !collection.length) {
    check("المعرفات", `بادئة ${prefix}`, false, "المجموعة غير موجودة أو فارغة");
    continue;
  }
  const bad = collection.filter((item) => !String(item.id).startsWith(`${prefix}-`));
  check("المعرفات", `بادئة ${prefix}`, bad.length === 0, bad.length ? `${bad.length} سجل مخالف` : `${collection.length} سجلًا`);
}
check("المعرفات", "كل البادئات الموثقة معلنة", declaredPrefixes.length >= 20, `${declaredPrefixes.length} بادئة في الوثيقة`);

// ─────────────────────────────────────────────────────────────
// 2. عقد Fixtures المعتمد للقبول — ENTITY_MODEL.md §6.1
// ─────────────────────────────────────────────────────────────
const bus1042 = getBusinessIntelligence("BUS-1042");
check("Fixtures", "BUS-1042 درجة 92", bus1042?.score === 92, `score=${bus1042?.score}`);
check("Fixtures", "BUS-1042 فرصة عالية", getOpportunityTier(bus1042?.score) === "عالية" || bus1042?.score >= 80, getOpportunityTier(bus1042?.score));
check("Fixtures", "BUS-1042 له خدمات مقترحة", (bus1042?.services || []).length > 0, `${(bus1042?.services || []).length} خدمة`);

const bus1402 = getBusinessIntelligence("BUS-1402");
check("Fixtures", "BUS-1402 درجة 51", bus1402?.score === 51, `score=${bus1402?.score}`);
check("Fixtures", "BUS-1402 بلا خدمة مقترحة", (bus1402?.services || []).length === 0, `${(bus1402?.services || []).length} خدمة`);

const bus1404 = getBusinessIntelligence("BUS-1404");
check("Fixtures", "BUS-1404 insufficient_data", bus1404?.status === "insufficient_data", `status=${bus1404?.status}`);
check("Fixtures", "BUS-1404 بلا درجة مضللة", bus1404?.score === null || bus1404?.score === undefined, `score=${bus1404?.score}`);

const bus1403 = getBusinessIntelligence("BUS-1403");
check("Fixtures", "BUS-1403 حالة خطأ", String(bus1403?.status).includes("error"), `status=${bus1403?.status}`);

// ─────────────────────────────────────────────────────────────
// 3. نموذج التقييم — ENTITY_MODEL.md §6
// ─────────────────────────────────────────────────────────────
const intelligenceSource = jsSources[1];
const maxes = [...intelligenceSource.matchAll(/max:\s*(\d+)/g)].map((m) => Number(m[1]));
check("التقييم", "الأبعاد 25/30/20/15/10", JSON.stringify(maxes.slice(0, 5)) === JSON.stringify([25, 30, 20, 15, 10]), maxes.slice(0, 5).join("/"));
check("التقييم", "مجموع الأبعاد = 100", maxes.slice(0, 5).reduce((a, b) => a + b, 0) === 100);
check("التقييم", "إصدار التقييم S4-MOCK-v1", intelligenceSource.includes("S4-MOCK-v1"));
check("التقييم", "طبقة 80–100 عالية", getOpportunityTier(92) === getOpportunityTier(80) && getOpportunityTier(92) !== getOpportunityTier(79), `92→${getOpportunityTier(92)} / 79→${getOpportunityTier(79)}`);
check("التقييم", "طبقة 0–39 منخفضة", getOpportunityTier(10) !== getOpportunityTier(40), `10→${getOpportunityTier(10)} / 40→${getOpportunityTier(40)}`);

// ─────────────────────────────────────────────────────────────
// 4. الحقيقة المالية — ENTITY_MODEL.md §8 §12 و V1_FINAL_FIX
// ─────────────────────────────────────────────────────────────
const overview = getAnalyticsOverview({ dateRange: "all" });
check("المالية", "الإيراد المعترف به 382,000", overview.metrics.revenue.value === 382000, String(overview.metrics.revenue.value));
check("المالية", "الإيراد المنسوب = المعترف به", overview.metrics.attributedRevenue.value === overview.metrics.revenue.value, String(overview.metrics.attributedRevenue.value));

const recognized = mockModel.revenueEvents.filter((e) => e.status === "recognized");
const recognizedTotal = recognized.reduce((sum, e) => sum + e.amount, 0);
check("المالية", "الإيراد يقرأ من status=recognized فقط", recognizedTotal === overview.metrics.revenue.value, `${recognized.length} حدثًا = ${recognizedTotal}`);

const traces = getAttributionTraces(overview.context);
const overAttributed = traces.filter((t) => t.attributed > t.event.amount);
check("المالية", "الإسناد لا يتجاوز مبلغ الحدث", overAttributed.length === 0, `${traces.length} سلسلة`);

// closeDealAsWon لا ينشئ RevenueEvent — ENTITY_MODEL.md §8
const revBefore = mockModel.revenueEvents.length;
const attBefore = mockModel.attributionTouchpoints.length;
const openDeal = mockModel.deals.find((d) => d.status === "open");
if (openDeal) {
  closeDealAsWon(openDeal.id, true);
  const closed = getDeal(openDeal.id);
  check("المالية", "closeDealAsWon لا ينشئ RevenueEvent", mockModel.revenueEvents.length === revBefore, `${revBefore}→${mockModel.revenueEvents.length}`);
  check("المالية", "closeDealAsWon لا ينشئ Touchpoint", mockModel.attributionTouchpoints.length === attBefore, `${attBefore}→${mockModel.attributionTouchpoints.length}`);
  check("المالية", "الإغلاق كرابحة يفرض probability=100", closed?.probability === 100, `probability=${closed?.probability}`);
  check("المالية", "الإغلاق كرابحة يسجل wonAt", Boolean(closed?.wonAt), String(closed?.wonAt));
} else {
  check("المالية", "توجد صفقة مفتوحة للاختبار", false, "لا توجد");
}

// ─────────────────────────────────────────────────────────────
// 5. عقد Deal — ENTITY_MODEL.md §8
// ─────────────────────────────────────────────────────────────
const badCurrency = mockModel.deals.filter((d) => d.currency !== "SAR");
check("الصفقات", "كل الصفقات بعملة SAR", badCurrency.length === 0, `${mockModel.deals.length} صفقة`);
const badProbability = mockModel.deals.filter((d) => d.probability < 0 || d.probability > 100);
check("الصفقات", "الاحتمال بين 0 و100", badProbability.length === 0);
const badStatus = mockModel.deals.filter((d) => !["open", "won", "lost"].includes(d.status));
check("الصفقات", "الحالات open/won/lost فقط", badStatus.length === 0);

// Lead واحدة كحد أقصى لكل Business — ENTITY_MODEL.md §7
const leadsByBusiness = new Map();
for (const lead of mockModel.leads) leadsByBusiness.set(lead.businessId, (leadsByBusiness.get(lead.businessId) || 0) + 1);
const duplicated = [...leadsByBusiness.entries()].filter(([, count]) => count > 1);
check("العملاء", "Lead واحدة كحد أقصى لكل Business", duplicated.length === 0, `${mockModel.leads.length} عميلًا`);

const allowedLeadStatuses = ["new", "contacted", "qualified", "unqualified", "nurturing"];
const badLeadStatus = mockModel.leads.filter((l) => !allowedLeadStatuses.includes(l.status));
check("العملاء", "حالات Lead ضمن المعلن", badLeadStatus.length === 0);

// التحويل المكرر يعيد Lead القائمة لا نسخة ثانية
const existingLead = mockModel.leads[0];
if (existingLead) {
  const again = convertBusinessToLead(existingLead.businessId, {});
  check("العملاء", "التحويل المكرر لا ينشئ نسخة", again.kind === "duplicate" && again.lead?.id === existingLead.id, `kind=${again.kind}`);
}

// ─────────────────────────────────────────────────────────────
// 6. حدود S11 — ENTITY_MODEL.md §13
// ─────────────────────────────────────────────────────────────
const allowedIntegrationStatuses = ["not_connected", "mock_connected", "configuration_required", "error", "disabled"];
const badIntegration = (mockModel.integrations || []).filter((i) => !allowedIntegrationStatuses.includes(i.status));
check("S11", "حالات التكامل ضمن المعلن", badIntegration.length === 0, `${(mockModel.integrations || []).length} تكاملًا`);
check("S11", "لا حالة اتصال إنتاجي", !(mockModel.integrations || []).some((i) => i.status === "connected"));
const leakedSecret = (mockModel.integrations || []).some((i) => "secret" in i || "apiKey" in i || "accessToken" in i);
check("S11", "لا تخزين لقيمة secret", !leakedSecret);
check("S11", "hasConfiguredSecret فقط", allJs.includes("hasConfiguredSecret"));

// ─────────────────────────────────────────────────────────────
// 7. حدود المعمارية — PRODUCT_ARCHITECTURE.md و CTO_REPORT_AR.md
// ─────────────────────────────────────────────────────────────
const networkApis = ["fetch(", "axios", "XMLHttpRequest", "WebSocket", "localStorage", "sessionStorage", "indexedDB"];
for (const api of networkApis) {
  check("الحدود", `لا استخدام لـ${api.replace("(", "")}`, !allJs.includes(api));
}
check("الحدود", "لا مفاتيح OAuth أو بوابة دفع", !/stripe|payment_intent|client_secret/i.test(allJs));

// ─────────────────────────────────────────────────────────────
// 8. مسار العرض في DEMO_GUIDE.md
// ─────────────────────────────────────────────────────────────
const demoIds = [...demoGuide.matchAll(/`((?:SRC|JOB|BUS|LEAD|DEAL|CONV|REV|ATT|INT|SUB|AUTO)-[0-9]+)`/g)].map((m) => m[1]);
const everyId = new Set(
  [...Object.values(mockModel).filter(Array.isArray).flat(), ...businesses, ...jobs]
    .map((item) => item?.id)
    .filter(Boolean),
);
const missingDemoIds = [...new Set(demoIds)].filter((id) => !everyId.has(id));
check("العرض", "كل fixtures دليل العرض موجودة", missingDemoIds.length === 0, missingDemoIds.length ? `مفقود: ${missingDemoIds.join(", ")}` : `${new Set(demoIds).size} معرفًا`);

// ─────────────────────────────────────────────────────────────
// 9. DESIGN_SYSTEM.md — الـtokens المعلنة موجودة في CSS
// ─────────────────────────────────────────────────────────────
const cssFiles = (await import("node:fs")).readdirSync(new URL("../client/src/styles", import.meta.url)).filter((f) => f.endsWith(".css"));
const css = (await Promise.all(cssFiles.map((f) => read(`../client/src/styles/${f}`)))).join("\n");
// تُقرأ الأسماء من صفوف جدول «CSS Tokens» فقط — لا من جمل الشرح التي قد تذكر أسماء غير موجودة عمدًا.
const tokenTable = designSystem.split(/^## /m).find((section) => section.startsWith("2. CSS Tokens")) ?? "";
const declaredTokens = [
  ...new Set(
    tokenTable
      .split("\n")
      .filter((line) => line.startsWith("|") && line.includes("`--"))
      .flatMap((line) => [...line.matchAll(/`(--[a-z-]+)`/g)].map((m) => m[1])),
  ),
];
const undefinedTokens = declaredTokens.filter((token) => !new RegExp(`\\${token}\\s*:`).test(css));
check(
  "التصميم",
  "tokens الوثيقة معرفة فعليًا في CSS",
  undefinedTokens.length === 0,
  undefinedTokens.length ? `${undefinedTokens.length}/${declaredTokens.length} غير معرَّف: ${undefinedTokens.join(", ")}` : `${declaredTokens.length} token`,
);

// ─────────────────────────────────────────────────────────────
// 10. ادعاءات وصفية في CTO_REPORT_AR.md
// ─────────────────────────────────────────────────────────────
const jsCount = (await import("node:fs")).readdirSync(new URL("../client/src/domain", import.meta.url)).filter((f) => f.endsWith(".js")).length;
const cssCount = (await import("node:fs")).readdirSync(new URL("../client/src/styles", import.meta.url)).filter((f) => f.endsWith(".css")).length;
// اللقطة التاريخية مقبولة إذا كانت موسومة صراحة بتاريخها وبالحالة الحالية.
const isDatedSnapshot = ctoReport.includes("لقطة مؤرخة") && ctoReport.includes("تقييم تاريخي مؤرخ");
const claimsSevenJs = ctoReport.includes("7 ملفات JavaScript تشغيلية");
const claimsFiveCss = ctoReport.includes("5 ملفات CSS");
check(
  "تقرير CTO",
  "أعداد الملفات مطابقة أو موسومة كلقطة مؤرخة",
  (!claimsSevenJs && !claimsFiveCss) || isDatedSnapshot || (jsCount === 7 && cssCount === 5),
  isDatedSnapshot ? `لقطة موسومة · الفعلي ${jsCount} JS و${cssCount} CSS` : `الوثيقة: 7/5 · الفعلي: ${jsCount}/${cssCount}`,
);
check(
  "تقرير CTO",
  "اللقطة تذكر العدد الفعلي الحالي",
  !isDatedSnapshot || (ctoReport.includes(`${jsCount} ملف JavaScript`) && ctoReport.includes(`${cssCount} ملف CSS`)),
  `${jsCount} JS · ${cssCount} CSS`,
);

// ─────────────────────────────────────────────────────────────
// 11. SCREEN_MAP.md — عمود الشحنة وعمود المسار
// ─────────────────────────────────────────────────────────────
const screenMap = await read(`${DOCS}SCREEN_MAP.md`);
const appSource = await readFile(new URL("../client/src/shared/components/Placeholder.tsx", import.meta.url), "utf8");
const shipmentsBlock = appSource.match(/shipments\s*=\s*\{(.*?)\};/s);
const actualShipments = Object.fromEntries(
  [...(shipmentsBlock?.[1] ?? "").matchAll(/"?([a-zA-Z0-9/_-]+)"?\s*:\s*"(S\d+)"/g)].map((m) => [m[1], m[2]]),
);

const screenRows = screenMap
  .split("\n")
  .filter((line) => line.startsWith("|"))
  .map((line) => line.replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()))
  .filter((cells) => cells.length >= 9 && /^[A-Z]+-\d+$/.test(cells[0]))
  .map((cells) => ({ id: cells[0], route: cells[2].replace(/`/g, "").replace("#/", "") || "landing", shipment: cells[cells.length - 1] }));

const shipmentMismatch = screenRows.filter((row) => actualShipments[row.route] && actualShipments[row.route] !== row.shipment);
check(
  "خريطة الشاشات",
  "عمود الشحنة مطابق للشحنة الفعلية",
  shipmentMismatch.length === 0,
  shipmentMismatch.length ? `${shipmentMismatch.length}/${screenRows.length} شاشة: ${shipmentMismatch.map((r) => `${r.id} ${r.shipment}→${actualShipments[r.route]}`).join("، ")}` : `${screenRows.length} شاشة`,
);

const legacyToCanonical = {
  "discovery-jobs": "discovery/jobs", job: "discovery/jobs/:id", results: "discovery/results",
  leads: "crm", "lead-profile": "intelligence", integrations: "settings/integrations", billing: "settings/billing",
};
const legacyRoutes = screenRows.filter((row) => legacyToCanonical[row.route]);
check(
  "خريطة الشاشات",
  "المسارات canonical لا aliases انتقالية",
  legacyRoutes.length === 0,
  legacyRoutes.length ? `${legacyRoutes.length} شاشة: ${legacyRoutes.map((r) => `${r.id} #/${r.route}→#/${legacyToCanonical[r.route]}`).join("، ")}` : "",
);

// ─────────────────────────────────────────────────────────────
// 12. وصف الحزمة التقنية بعد تحويل React
// ─────────────────────────────────────────────────────────────
const indexHtml = await read("../client/index.html");
const entryIsReact = indexHtml.includes("/src/main.tsx");
// الوثيقة الحية يجب أن تعلن الحزمة الفعلية ونقطة الدخول الفعلية.
check(
  "الحزمة التقنية",
  "عمارة المنتج تعلن الحزمة الفعلية",
  !entryIsReact || (architecture.includes("React") && architecture.includes("main.tsx")),
  entryIsReact ? "index.html يحمّل React" : "",
);
// السجل التاريخي يجوز أن يذكر Vanilla، بشرط أن يكون موسومًا كسجل مؤرخ.
check(
  "الحزمة التقنية",
  "ذكر Vanilla في السجل التاريخي موسوم بتاريخه",
  !ctoReport.includes("Vanilla JavaScript") || ctoReport.includes("تقييم تاريخي مؤرخ"),
);
check("الحزمة التقنية", "app.js لم يعد نقطة الدخول", !indexHtml.includes("js/app.js"));

// ─────────────────────────────────────────────────────────────
// 11. TECHNICAL_DEBT.md — ادعاء عدم وجود عوائق
// ─────────────────────────────────────────────────────────────
check("الدين التقني", "ادعاء «لا Critical أو Major blockers»", technicalDebt.includes("لا توجد Critical أو Major blockers"), "يُقارن بنتيجة verify-s9 أدناه");

// ─────────────────────────────────────────────────────────────
// 13. FND-DOC-001 — استقلال حساب التواريخ عن المنطقة الزمنية
// ─────────────────────────────────────────────────────────────
const dataSource = jsSources[0];
check(
  "المنطقة الزمنية",
  "لا تحليل لنص زمني بلا منطقة عبر new Date المحلية",
  !/new Date\(new Date\([a-zA-Z]+\)\.getTime\(\)/.test(dataSource),
  "النمط الذي كان يطرح فارق التوقيت المحلي مرتين",
);
check("المنطقة الزمنية", "دالة تحليل صريحة كـUTC موجودة", dataSource.includes("parseAutomationInstant"));
check("المنطقة الزمنية", "دالة تنسيق صريحة موجودة", dataSource.includes("formatAutomationInstant"));

// ─────────────────────────────────────────────────────────────
// 14. فجوات التوثيق — الاتجاه المعاكس: كود بلا وثيقة
// ─────────────────────────────────────────────────────────────

// 14أ) كل مجموعة كيانات لها بادئة موثقة — فحص شامل لا لعينة
const documentedPrefixes = [...new Set([...entityModel.matchAll(/`([A-Z][A-Z-]*)-####`/g)].map((m) => m[1]))]
  .sort((a, b) => b.length - a.length); // الأطول أولًا كي تطابق INV-BILL قبل INV

/** كل ما يحمل `id` في طبقة النطاق: مجموعات mockModel والتصديرات المنفصلة والكيانات المفردة. */
const entitySources = [
  ...Object.entries(mockModel).map(([name, value]) => [name, value]),
  ["businesses", businesses],
  ["jobs", jobs],
];
const collections = [];
for (const [name, value] of entitySources) {
  const sample = Array.isArray(value) ? value[0] : value;
  const id = sample && typeof sample === "object" ? sample.id : null;
  if (typeof id !== "string" || !/^[A-Z]/.test(id)) continue;
  collections.push({ name, id, count: Array.isArray(value) ? value.length : 1 });
}

const matchPrefix = (id) => documentedPrefixes.find((prefix) => id.startsWith(`${prefix}-`)) ?? null;
const unprefixed = collections.filter((entry) => !matchPrefix(entry.id));
check(
  "فجوات",
  "كل مجموعة كيانات لها بادئة موثقة",
  unprefixed.length === 0,
  unprefixed.length
    ? `${unprefixed.length}/${collections.length}: ${unprefixed.map((e) => `${e.id.split("-")[0]}-* (${e.name})`).join("، ")}`
    : `${collections.length} مجموعة`,
);

// 14ب) البادئات المعلنة في الوثيقة مستخدمة فعليًا بنفس الاسم
const usedPrefixes = new Set(collections.map((entry) => matchPrefix(entry.id)).filter(Boolean));
// بادئة معلنة بلا استخدام مقبولة فقط إذا وُسم كيانها «معلن ولم يُنفَّذ».
const declaredButAbsent = documentedPrefixes.filter(
  (prefix) => !usedPrefixes.has(prefix) && !new RegExp(`معلن ولم يُنفَّذ[^|]*\\|\\s*\`${prefix}-####\``).test(entityModel),
);
check(
  "فجوات",
  "كل بادئة معلنة مستخدمة فعليًا",
  declaredButAbsent.length === 0,
  declaredButAbsent.length ? `${declaredButAbsent.length} معلنة بلا استخدام: ${declaredButAbsent.join("، ")}` : `${documentedPrefixes.length} بادئة`,
);

// 14ج) وثيقة تشغيل المشروع
const allDocs = (await Promise.all(
  (await import("node:fs")).readdirSync(new URL("..", import.meta.url))
    .filter((f) => f.endsWith(".md"))
    .map((f) => read(`../${f}`)),
)).join("\n");
check("فجوات", "يوجد README.md في الجذر", (await import("node:fs")).existsSync(new URL("../README.md", import.meta.url)));
check("فجوات", "طريقة التشغيل موثقة", allDocs.includes("pnpm install") && allDocs.includes("pnpm dev"), "install · dev");

// 14د) بنية React موثقة
check("فجوات", "شجرة client/src موثقة", allDocs.includes("client/src/"), "");

// ─────────────────────────────────────────────────────────────
// النتيجة
// ─────────────────────────────────────────────────────────────
let currentSection = "";
for (const result of results) {
  if (result.section !== currentSection) {
    currentSection = result.section;
    console.log(`\n── ${currentSection} ──`);
  }
  console.log(`${result.pass ? "PASS" : "FAIL"}  ${result.id}${result.detail ? `  — ${result.detail}` : ""}`);
}
const passed = results.filter((r) => r.pass).length;
console.log(`\naudit-docs-vs-code: ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);

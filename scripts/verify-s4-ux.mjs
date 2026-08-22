import fs from "node:fs";
import { getAttributionIntegrityReport, getDiscoveryIntegrityReport } from "../client/src/domain/data.js";
import { beginBusinessAnalysis, completeBusinessAnalysis, getBusinessIntelligence, getIntelligenceIntegrityReport, intelligenceProcessingStages } from "../client/src/domain/intelligence.js";

const checks = [];
const add = (id, name, pass, detail) => checks.push({ id, name, pass, detail });

const before = getBusinessIntelligence("BUS-1042");
const baseline = { score: before.score, confidence: before.confidence, tier: before.tier, reasons: before.reasons.map((item) => item.id), services: before.services.map((item) => item.id) };
beginBusinessAnalysis("BUS-1042");
const after = completeBusinessAnalysis("BUS-1042");

add("A", "Seven Deterministic Stages", intelligenceProcessingStages.length === 7, "توجد سبع مراحل معالجة صريحة ومحددة الترتيب");
add("B", "S4 Engine Result Stability", after.score === baseline.score && after.confidence === baseline.confidence && after.tier === baseline.tier, "إعادة التحليل تعيد Score وConfidence وTier نفسها");
add("C", "Reasons and Services Stability", JSON.stringify(after.reasons.map((item) => item.id)) === JSON.stringify(baseline.reasons) && JSON.stringify(after.services.map((item) => item.id)) === JSON.stringify(baseline.services), "الأسباب والخدمات تبقى مشتقة من Signals نفسها");
add("D", "Insufficient Data Protection", beginBusinessAnalysis("BUS-1404") === null && getBusinessIntelligence("BUS-1404").score === null, "لا يمنح سجل البيانات غير الكافية Score مصطنعة");
const counterexample = getBusinessIntelligence("BUS-1402");
add("K", "Explicit Counterexample Fixture", counterexample.score === 51 && counterexample.tier === "medium" && counterexample.services.length === 0 && counterexample.reasons.length === 0, "BUS-1402 قوية من حيث النشاط والجودة، لكنها ليست فرصة عالية بلا فجوة مثبتة");
add("E", "S4 Integrity Regression", getIntelligenceIntegrityReport().pass, "Integrity S4 محفوظة");
add("F", "S3 Lifecycle Regression", getDiscoveryIntegrityReport().pass, "بوابة نتائج S3 محفوظة");
const attribution = getAttributionIntegrityReport();
add("G", "S2 Attribution Regression", attribution.pass && attribution.attributionTotal === attribution.revenueSummary, "فرق إسناد الإيراد يساوي صفر");

const appSource = fs.readFileSync(new URL("../.ui-sources/all.txt", import.meta.url), "utf8");
const intelligenceSource = fs.readFileSync(new URL("../client/src/domain/intelligence.js", import.meta.url), "utf8");
const cssSource = fs.readFileSync(new URL("../client/src/styles/s4ux.css", import.meta.url), "utf8");
add("H", "Animation Uses Engine Output", intelligenceSource.includes("record.score") && intelligenceSource.includes("record.confidence") && appSource.includes("completeBusinessAnalysis"), "كشف Score وConfidence يعتمد على نتيجة Intelligence Engine");
add("I", "Reduced Motion Support", appSource.includes("prefers-reduced-motion") && cssSource.includes("prefers-reduced-motion: reduce"), "توجد معالجة JavaScript وCSS لتقليل الحركة");
add("J", "No External Intelligence Call", !/fetch\(|axios|openai|anthropic|gemini/i.test(`${appSource}\n${intelligenceSource}`), "لا توجد استدعاءات مزود ذكاء خارجي في S4-UX");

console.log("S4-UX Integrity Verification");
checks.forEach((check) => console.log(`${check.pass ? "PASS" : "FAIL"} ${check.id} — ${check.name}: ${check.detail}`));
console.log(`Summary: ${checks.filter((check) => check.pass).length}/${checks.length} PASS`);
if (!checks.every((check) => check.pass)) process.exit(1);

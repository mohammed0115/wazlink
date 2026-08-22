import { getAttributionIntegrityReport } from "../client/src/domain/data.js";

const report = getAttributionIntegrityReport();
const groups = [
  ["A — Attribution Chain", report.checks.attributionChains],
  ["B — Revenue Sum", report.checks.revenueReconciliation],
  ["C — Unique IDs", report.checks.uniqueIds],
  ["D — Reference Integrity", report.checks.referenceIntegrity],
  ["E — Task Integrity", report.checks.taskIntegrity]
];

console.log("S2-FIX Integrity Verification");
groups.forEach(([label, checks]) => {
  const passed = checks.every((check) => check.pass);
  console.log(`${passed ? "PASS" : "FAIL"} | ${label} | ${checks.length} checks`);
  checks.filter((check) => !check.pass).forEach((check) => console.log(`  - ${check.name}: ${check.detail}`));
});
console.log(`Revenue reconciliation: ${report.attributionTotal} = ${report.revenueSummary}`);
console.log(`Attribution cards: ${report.attribution.length}`);
console.log(report.pass ? "S2-FIX INTEGRITY: PASS" : "S2-FIX INTEGRITY: FAIL");

if (!report.pass) process.exitCode = 1;

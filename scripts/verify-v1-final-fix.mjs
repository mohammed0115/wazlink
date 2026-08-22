import fs from "node:fs";
import { mockModel } from "../client/src/domain/data.js";
import { getAnalyticsOverview } from "../client/src/domain/analytics-engine.js";
import { getBusinessIntelligence } from "../client/src/domain/intelligence.js";
import { getLandingTruth } from "../client/src/domain/landing-truth.js";

const checks = [];
const check = (name, condition, detail = "") => {
  checks.push({ name, passed: Boolean(condition), detail });
  if (!condition) throw new Error(`FAIL: ${name}${detail ? ` — ${detail}` : ""}`);
};
const snapshot = () => JSON.stringify({ revenueEvents:mockModel.revenueEvents, attributionTouchpoints:mockModel.attributionTouchpoints, leads:mockModel.leads, deals:mockModel.deals, messages:mockModel.messages, automationRuns:mockModel.automationRuns });

const before = snapshot();
const analytics = getAnalyticsOverview({ dateRange:"all" });
const landing = getLandingTruth({ dateRange:"all" });
// Landing صار مكوّن React؛ نرسمه عبر SSR للحصول على الترميز الفعلي.
const { createServer } = await import("vite");
const { renderToStaticMarkup } = await import("react-dom/server");
const { createElement } = await import("react");
const ssr = await createServer({
  configFile: false,
  root: new URL("../client", import.meta.url).pathname,
  logLevel: "error",
  resolve: { alias: {
    "@": new URL("../client/src", import.meta.url).pathname,
    "@domain": new URL("../client/src/domain", import.meta.url).pathname,
    "@services": new URL("../client/src/services", import.meta.url).pathname,
  } },
  plugins: [(await import("@vitejs/plugin-react")).default()],
});
const { Landing } = await ssr.ssrLoadModule("/src/features/landing/Landing.tsx");
const markup = renderToStaticMarkup(createElement(Landing));
await ssr.close();
const after = snapshot();
const business = getBusinessIntelligence("BUS-1042");
const appSource = fs.readFileSync(new URL("../.ui-sources/all.txt", import.meta.url), "utf8");
const adapterSource = fs.readFileSync(new URL("../client/src/domain/landing-truth.js", import.meta.url), "utf8");

check("Landing reads the shared S10 overview", landing.overview.metrics.revenue.value === analytics.metrics.revenue.value, "revenue selector equality");
check("Landing Revenue equals S10 Revenue", landing.metrics.revenue.value === 382000 && landing.metrics.revenue.value === analytics.metrics.revenue.value, `${landing.metrics.revenue.value}`);
check("Landing Attributed Revenue equals S10 Attribution", landing.metrics.attributedRevenue.value === 382000 && landing.metrics.attributedRevenue.value === analytics.metrics.attributedRevenue.value, `${landing.metrics.attributedRevenue.value}`);
check("Landing attribution reconciles to Revenue", landing.metrics.revenue.value - landing.metrics.attributedRevenue.value === 0, "difference must be zero");
check("Landing funnel shares S10 stage counts", ["discovered","high","lead","deal","won"].every((id)=>landing.funnel.get(id)?.count === analytics.funnel.stages.find((stage)=>stage.id === id)?.count), "same selector output");
check("Landing includes an explicit period label", markup.includes("كل الفترة التجريبية"), "period semantics");
check("Landing has no old 428k financial claim", !markup.includes("428") && !markup.includes("٤٢٨"), "active markup");
check("Landing removes ungrounded legacy funnel counts", !["١٬٢٤٠","٣٨٠","٨٤","٣٢","١١"].some((value)=>markup.includes(value)), "active markup");
check("Landing BUS-1042 identity equals operational truth", markup.includes(business.business.id) && markup.includes(business.business.name) && !markup.includes("عيادات ابتسامة الرياض"), business.business.name);
check("Landing uses a shared analytics selector rather than a local revenue reduction", adapterSource.includes('import { getAnalyticsOverview } from "./analytics-engine.js";') && !adapterSource.includes("revenueEvents.reduce"), "shared selector");
check("App route uses the Landing truth adapter", appSource.includes('from "@domain/landing-truth.js"') && appSource.includes("getLandingTruth()"), "active route");
check("Rendering Landing is operationally read-only", before === after, "no Lead, Deal, Revenue, Attribution, Message, or Automation mutation");

console.table(checks);
console.log(`V1-FINAL-FIX PASS — ${checks.filter((item)=>item.passed).length}/${checks.length}`);

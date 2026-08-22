/* S12 / V1-FINAL-FIX: Landing reads shared S10 selectors and BUS-1042 intelligence; no duplicated financial fixtures. */
import { mockModel, scraperCrmPackages } from "./data.js";
import { getAnalyticsOverview } from "./analytics-engine.js";
import { getBusinessIntelligence } from "./intelligence.js";

const arabicNumber = (value) => new Intl.NumberFormat("ar-SA").format(Number(value || 0));
const sar = (value) => `${arabicNumber(value)} ر.س`;
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"]/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;" })[char]);

export function getLandingTruth(context = { dateRange:"all" }) {
  const overview = getAnalyticsOverview(context);
  const intelligence = getBusinessIntelligence("BUS-1042");
  const funnel = new Map(overview.funnel.stages.map((stage) => [stage.id, stage]));
  const metrics = overview.metrics;
  const business = intelligence?.business || {};
  const reasons = (intelligence?.reasons || []).filter((reason) => reason.polarity === "gap").map((reason) => reason.text).slice(0, 3);
  const services = (intelligence?.services || []).map((service) => service.name).slice(0, 3);
  return { overview, intelligence, funnel, metrics, business, reasons, services };
}


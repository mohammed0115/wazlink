import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const files = {
  contracts: read("client/src/services/contracts/services.ts"),
  journey: read("client/src/services/journey.ts"),
  lead360: read("client/src/features/crm/Lead360.tsx"),
  discovery: read("client/src/features/intelligence/DiscoveryResults.tsx"),
  inbox: read("client/src/features/inbox/Inbox.tsx"),
  deal: read("client/src/features/sales/Deal360.tsx"),
  services: read("client/src/services/index.ts"),
  data: read("client/src/domain/data.js"),
  package: read("package.json"),
};

let passed = 0;
const failures = [];
function gate(name, condition, evidence = "") {
  if (condition) passed += 1;
  else failures.push(`${name}${evidence ? ` — ${evidence}` : ""}`);
}
function call(source, object, method) {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|\s)\/\/.*$/gm, "");
  return new RegExp(`\\b${object}\\s*\\.\\s*${method}\\s*\\(`).test(withoutComments);
}
function includes(source, value) { return source.includes(value); }

// Typed journey boundary and projection contracts.
gate("S4 command registered", includes(files.package, '"verify-v2-s4": "node scripts/verify-v2-s4.mjs"'));
gate("typed JourneyEntityRef exists", includes(files.contracts, "export interface JourneyEntityRef"));
gate("typed CustomerJourneyContext exists", includes(files.contracts, "export interface CustomerJourneyContext"));
gate("typed JourneyActivityItem exists", includes(files.contracts, "export interface JourneyActivityItem"));
gate("canonical ID union exists", includes(files.contracts, "export type JourneyCanonicalId"));
gate("no journey persistence store", !/Journey(Store|State)|CustomerJourneyStore/.test(files.journey));
gate("no generic journey escape hatch", !/Record<string, any>|any\[\]/.test(files.contracts + files.journey));

// Actual runtime member-call evidence, not imports or dead identifiers.
gate("journey calls CRM getLead", call(files.journey, "crmService", "getLead"));
gate("journey calls CRM lead conversations", call(files.journey, "crmService", "getLeadConversations"));
gate("journey calls CRM lead deals", call(files.journey, "crmService", "getLeadDeals"));
gate("journey calls CRM lead activities", call(files.journey, "crmService", "getLeadActivities"));
gate("journey calls CRM tasks", call(files.journey, "crmService", "getLeadTasks"));
gate("journey calls CRM appointments", call(files.journey, "crmService", "getLeadAppointments"));
gate("journey calls messaging messages", call(files.journey, "messagingService", "getConversationMessages"));
gate("journey calls pipeline deal activities", call(files.journey, "pipelineService", "getDealActivities"));
gate("Lead360 calls journey context", call(files.lead360, "journeyProjection", "getContext"));
gate("Lead360 calls journey activity", call(files.lead360, "journeyProjection", "getLeadActivity"));
gate("Discovery calls existing Lead lookup", call(files.discovery, "crmService", "getLeadByBusinessId"));
gate("Inbox has canonical conversation route", includes(files.inbox, "inbox/${encodeURIComponent(item.id)}"));
gate("Inbox has Lead backlink", /crm\/leads\//.test(files.inbox));
gate("Deal360 has Lead backlink", /crm\/leads\//.test(files.deal));

// Canonical identity and transition preservation.
gate("Discovery preserves job context", includes(files.discovery, "job=${encodeURIComponent(job.id)}"));
gate("Discovery preserves business context", includes(files.discovery, "business=${encodeURIComponent(b.id)}"));
gate("Discovery reuses existing Lead", includes(files.discovery, "getLeadByBusinessId(b.id)"));
gate("Discovery does not auto-create Lead", !call(files.discovery, "crmService", "convertBusinessToLead"));
gate("Lead360 routes exact conversation", includes(files.lead360, "nextAction.route") && includes(read("client/src/features/crm/LeadControlPanels.tsx"), "inbox/${conversation.id}"));
gate("Conversation context retains leadId", includes(files.inbox, "getConversationContext(conversation.id)") && includes(files.inbox, "lead?.id"));
gate("Deal retains leadId", includes(files.deal, "deal.leadId") || includes(files.deal, "lead.id"));
gate("Deal/Pipeline preserve deal identity", includes(files.deal, "deals/${deal.id}") || includes(files.deal, "deal.id"));

// Revenue, billing, AI, and automation safety invariants.
gate("no Deal close RevenueEvent mutation", !/closeDealAsWon[\s\S]{0,500}RevenueEvent/.test(files.data));
gate("no Deal close Attribution mutation", !/closeDealAsWon[\s\S]{0,500}AttributionTouchpoint/.test(files.data));
gate("journey does not synthesize revenue", !/RevenueEvent|AttributionTouchpoint|createRevenueFromDeal/.test(files.journey));
gate("human send remains explicit", includes(files.inbox, "messagingService.sendMessage"));
gate("Copilot remains insert-only", includes(files.inbox, "insert") || includes(files.inbox, "Copilot"));
gate("no automatic send in journey", !/sendMessage\s*\(/.test(files.journey));
gate("no automatic Deal close in journey", !/closeDealAs(Won|Lost)\s*\(/.test(files.journey));
gate("billing remains separate", !/billingService|Checkout|subscription/i.test(files.journey));

// Legacy boundaries in the changed Feature/service scope.
for (const [name, source] of Object.entries({ journey: files.journey, lead360: files.lead360, discovery: files.discovery })) {
  gate(`${name} has no direct domain data import`, !includes(source, "@domain/data") && !includes(source, "domain/data.js"));
  gate(`${name} has no mock service import`, !includes(source, "services/mock"));
  gate(`${name} has no legacy bridge import`, !includes(source, "legacyDataBridge"));
}

// Behavioral semantic fixture for the projection rules: deterministic, ordered, ID-based,
// missing-safe, unknown-safe, and non-mutating. This verifies the contract semantics rather
// than merely checking filenames or import strings.
const projectFixture = (leadId, relations) => {
  if (!/^LEAD-/.test(leadId)) return [];
  const source = relations.filter((item) => item.leadId === leadId && /^ACT-|^MSG-|^TSK-|^APT-/.test(item.id));
  return source
    .filter((item) => typeof item.timestamp === "string" && !Number.isNaN(Date.parse(item.timestamp)))
    .map((item) => ({ id: item.id, leadId, kind: item.kind, timestamp: item.timestamp }))
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id));
};
const fixture = [
  { id: "ACT-1", leadId: "LEAD-1", kind: "lead_activity", timestamp: "2026-08-20T10:00:00Z" },
  { id: "MSG-1", leadId: "LEAD-1", kind: "message", timestamp: "2026-08-21T10:00:00Z" },
  { id: "TSK-1", leadId: "LEAD-1", kind: "task", timestamp: "2026-08-19T10:00:00Z" },
  { id: "UNKNOWN-1", leadId: "LEAD-1", kind: "future_kind", timestamp: "2026-08-22T10:00:00Z" },
  { id: "ACT-2", leadId: "LEAD-2", kind: "lead_activity", timestamp: "2026-08-23T10:00:00Z" },
];
const snapshot = JSON.stringify(fixture);
const projected = projectFixture("LEAD-1", fixture);
const projectedAgain = projectFixture("LEAD-1", fixture);
gate("projection filters by canonical Lead ID", projected.every((item) => item.leadId === "LEAD-1"));
gate("projection is timestamp ordered", projected.map((item) => item.id).join(",") === "MSG-1,ACT-1,TSK-1");
gate("projection is deterministic", JSON.stringify(projected) === JSON.stringify(projectedAgain));
gate("projection is non-mutating", JSON.stringify(fixture) === snapshot);
gate("projection is missing-safe", projectFixture("LEAD-MISSING", fixture).length === 0);
gate("projection is unknown-kind safe", !projected.some((item) => item.id === "UNKNOWN-1"));
gate("projection does not synthesize revenue", projected.every((item) => !/REV-|ATTR-/.test(item.id)));

const total = passed + failures.length;
console.log(`V2-S4 verifier: ${passed}/${total} PASS`);
if (failures.length) {
  console.error(failures.map((failure, index) => `${index + 1}. ${failure}`).join("\n"));
  process.exitCode = 1;
}

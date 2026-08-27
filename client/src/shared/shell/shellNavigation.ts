import type { CapabilityId, EntitlementDecision, EntitlementService, UsageMetricKey } from "@services";
import { navItems } from "@services";
import type { WorkspaceSummary } from "../context/AppProviders";
import { routeNavId } from "./routeMeta";

type SourceNavItem = { id: string; label: string; icon: string; group: string };

export type ShellNavigationItem = {
  id: string;
  label: string;
  icon: string;
  group: string;
  activeMatch: string[];
  requiredCapability?: CapabilityId;
  usageKey?: UsageMetricKey;
};

export type ShellNavigationState = ShellNavigationItem & {
  active: boolean;
  decision: EntitlementDecision | null;
};

export type ShellPlanProjection = {
  id: string;
  name: string;
};

export type ShellUsageProjection = {
  used: number;
  limit: number | null;
  remaining: number | null;
  percentage: number | null;
};

export type ShellContext = {
  route: string;
  workspace: WorkspaceSummary;
  plan: ShellPlanProjection;
  usage: ShellUsageProjection;
  navigation: ShellNavigationState[];
};

const capabilityByRoute: Partial<Record<string, { capability: CapabilityId; usageKey?: UsageMetricKey }>> = {
  discovery: { capability: "discovery.basic", usageKey: "discoveryRuns" },
  automation: { capability: "automation.rules", usageKey: "automationRuns" },
  copilot: { capability: "inbox.copilot", usageKey: "aiAnalyses" },
};

const activeMatches: Record<string, string[]> = {
  dashboard: ["dashboard"],
  discovery: ["discovery", "discovery/jobs", "discovery/results"],
  crm: ["crm", "leads"],
  pipeline: ["pipeline", "deals"],
  inbox: ["inbox"],
  copilot: ["copilot"],
  automation: ["automation"],
  analytics: ["analytics"],
  integrations: ["integrations", "settings/integrations"],
  settings: ["settings", "settings/workspace", "settings/account", "settings/team", "settings/notifications", "settings/security", "settings/billing", "settings/integrations"],
};

function enrich(item: SourceNavItem): ShellNavigationItem {
  const metadata = capabilityByRoute[item.id];
  return {
    ...item,
    activeMatch: activeMatches[item.id] ?? [item.id],
    requiredCapability: metadata?.capability,
    usageKey: metadata?.usageKey,
  };
}

export const shellNavigationItems: ShellNavigationItem[] = (navItems as SourceNavItem[]).map(enrich);

export function projectShellNavigation(route: string, service: EntitlementService): ShellNavigationState[] {
  const activeId = routeNavId(route);
  return shellNavigationItems.map((item) => ({
    ...item,
    active: item.activeMatch.includes(activeId) || item.activeMatch.some((match) => route.startsWith(`${match}/`)),
    decision: item.requiredCapability ? service.evaluate(item.requiredCapability) : null,
  }));
}

export function projectShellContext(route: string, workspace: WorkspaceSummary, service: EntitlementService): ShellContext {
  const currentPlan = service.currentPlan();
  const usage = service.usageFor("discoveryRuns");
  return {
    route,
    workspace,
    plan: { id: currentPlan.id, name: currentPlan.name },
    usage: {
      used: usage.used,
      limit: usage.limit.kind === "finite" ? usage.limit.value : null,
      remaining: usage.remaining,
      percentage: usage.percentage,
    },
    navigation: projectShellNavigation(route, service),
  };
}

import type { BillingPlan, BillingService, BillingUsageItem } from "./contracts/services";
import type {
  CapabilityId,
  EntitlementDecision,
  EntitlementService,
  EntitlementStatus,
  LimitDefinition,
  PlanDefinition,
  PlanId,
  UsageMetric,
  UsageMetricKey,
  UsageSnapshot,
} from "./contracts/entitlements";

const PLAN_IDS: readonly PlanId[] = ["PLAN-STARTER", "PLAN-GROWTH", "PLAN-SCALE"];
const CAPABILITIES: readonly CapabilityId[] = [
  "discovery.basic",
  "crm.core",
  "export.csv",
  "pipeline.core",
  "inbox.copilot",
  "automation.rules",
];
const CAPABILITY_USAGE: Readonly<Partial<Record<CapabilityId, UsageMetricKey>>> = {
  "discovery.basic": "discoveryRuns",
  "crm.core": "leads",
  "pipeline.core": "leads",
  "automation.rules": "automationRuns",
};
const CAPABILITY_SETS: Readonly<Record<PlanId, readonly CapabilityId[]>> = {
  "PLAN-STARTER": ["discovery.basic", "crm.core", "export.csv"],
  "PLAN-GROWTH": ["discovery.basic", "crm.core", "export.csv", "pipeline.core", "inbox.copilot", "automation.rules"],
  "PLAN-SCALE": ["discovery.basic", "crm.core", "export.csv", "pipeline.core", "inbox.copilot", "automation.rules"],
};
const USAGE_KEYS: readonly UsageMetricKey[] = ["leads", "discoveryRuns", "seats", "automationRuns", "aiAnalyses"];
function syncValue<T>(value: T | Promise<T>): T {
  if (value instanceof Promise) throw new Error("EntitlementService requires the local synchronous Billing adapter");
  return value;
}
function finiteValue(limit: LimitDefinition): number | null {
  return limit.kind === "finite" ? limit.value : null;
}

function isPlanId(value: string): value is PlanId {
  return PLAN_IDS.includes(value as PlanId);
}
function isCapabilityId(value: string): value is CapabilityId {
  return CAPABILITIES.includes(value as CapabilityId);
}
function isUsageMetricKey(value: string): value is UsageMetricKey {
  return USAGE_KEYS.includes(value as UsageMetricKey);
}
function limitFrom(value: number | null | undefined): LimitDefinition {
  return value === null || value === undefined ? { kind: "unlimited" } : { kind: "finite", value: Math.max(0, value) };
}
function statusFor(limit: LimitDefinition, used: number): EntitlementStatus {
  if (limit.kind === "unlimited") return "AVAILABLE";
  if (limit.kind === "not_included") return "LOCKED";
  if (used >= limit.value) return "EXHAUSTED";
  return used > 0 ? "LIMITED" : "AVAILABLE";
}
function normalizePlan(plan: BillingPlan): PlanDefinition | null {
  if (!isPlanId(plan.id)) return null;
  const limits = Object.fromEntries(USAGE_KEYS.map((key) => [key, limitFrom(plan.limits[key])])) as Readonly<Record<UsageMetricKey, LimitDefinition>>;
  return {
    id: plan.id,
    name: plan.name,
    price: plan.price,
    currency: plan.currency || "SAR",
    interval: "monthly",
    tier: PLAN_IDS.indexOf(plan.id) + 1,
    features: plan.features,
    entitlements: { capabilities: CAPABILITY_SETS[plan.id], limits },
  };
}

function createMetric(key: UsageMetricKey, usageRows: readonly BillingUsageItem[], plan: PlanDefinition): UsageMetric {
  const row = usageRows.find((item) => item.key === key);
  const used = Math.max(0, row?.used || 0);
  const limit = plan.entitlements.limits[key];
  if (limit.kind === "unlimited") return { metric: key, used, limit, remaining: null, percentage: null, status: "AVAILABLE" };
  if (limit.kind === "not_included") return { metric: key, used, limit, remaining: 0, percentage: 100, status: "LOCKED" };
  const remaining = Math.max(0, limit.value - used);
  const percentage = Math.min(100, Math.max(0, (used / Math.max(1, limit.value)) * 100));
  return { metric: key, used, limit, remaining, percentage, status: statusFor(limit, used) };
}

export function createEntitlementService(billing: BillingService): EntitlementService {
  const planCatalog = (): readonly PlanDefinition[] => syncValue(billing.plans()).flatMap((plan: BillingPlan) => {
    const normalized = normalizePlan(plan);
    return normalized ? [normalized] : [];
  });
  const currentPlan = (): PlanDefinition => {
    const plans = planCatalog();
    const currentId = syncValue(billing.currentSubscription())?.planId;
    return plans.find((plan) => plan.id === currentId) || plans.find((plan) => plan.id === "PLAN-STARTER") || plans[0] || {
      id: "PLAN-STARTER",
      name: "البداية",
      price: 0,
      currency: "SAR",
      interval: "monthly",
      tier: 1,
      features: [],
      entitlements: { capabilities: [], limits: Object.fromEntries(USAGE_KEYS.map((key) => [key, { kind: "not_included" }])) as Readonly<Record<UsageMetricKey, LimitDefinition>> },
    };
  };
  const usage = (): UsageSnapshot => {
    const plan = currentPlan();
    const usageRows = syncValue(billing.usage());
    return { metrics: USAGE_KEYS.map((key) => createMetric(key, usageRows, plan)), capturedAt: new Date().toISOString() };
  };
  const usageFor = (metric: UsageMetricKey): UsageMetric => usage().metrics.find((item) => item.metric === metric) || createMetric(metric, [], currentPlan());
  const evaluate = (capability: CapabilityId): EntitlementDecision => {
    if (!isCapabilityId(capability)) return { capability, status: "LOCKED", allowed: false, usage: null, reason: "capability_locked", upgradeTarget: null };
    const plan = currentPlan();
    const included = plan.entitlements.capabilities.includes(capability);
    const metricKey = CAPABILITY_USAGE[capability];
    const metric = metricKey ? usageFor(metricKey) : null;
    if (!included) {
      const target = planCatalog().find((candidate) => candidate.tier > plan.tier && candidate.entitlements.capabilities.includes(capability));
      return { capability, status: "LOCKED", allowed: false, usage: metric, reason: "capability_locked", upgradeTarget: target?.id || null };
    }
    if (metric && metric.status === "EXHAUSTED") {
      const target = planCatalog().find((candidate) => candidate.tier > plan.tier && candidate.entitlements.capabilities.includes(capability) && (finiteValue(candidate.entitlements.limits[metric.metric]) || 0) > (finiteValue(plan.entitlements.limits[metric.metric]) || 0));
      return { capability, status: "EXHAUSTED", allowed: false, usage: metric, reason: "usage_exhausted", upgradeTarget: target?.id || null };
    }
    return { capability, status: metric?.status === "LIMITED" ? "LIMITED" : "AVAILABLE", allowed: true, usage: metric, reason: null, upgradeTarget: null };
  };
  return { currentPlan, planCatalog, usage, usageFor, evaluate };
}

export type PlanId = "PLAN-STARTER" | "PLAN-GROWTH" | "PLAN-SCALE";

export type CapabilityId =
  | "discovery.basic"
  | "crm.core"
  | "export.csv"
  | "pipeline.core"
  | "inbox.copilot"
  | "automation.rules";

export type EntitlementStatus = "AVAILABLE" | "LIMITED" | "EXHAUSTED" | "LOCKED";

export type UsageMetricKey = "leads" | "discoveryRuns" | "seats" | "automationRuns" | "aiAnalyses";

export type LimitDefinition =
  | { kind: "finite"; value: number }
  | { kind: "unlimited" }
  | { kind: "not_included" };

export interface PlanEntitlements {
  capabilities: readonly CapabilityId[];
  limits: Readonly<Record<UsageMetricKey, LimitDefinition>>;
}

export interface PlanDefinition {
  id: PlanId;
  name: string;
  price: number;
  currency: string;
  interval: "monthly";
  tier: number;
  features: readonly string[];
  entitlements: PlanEntitlements;
}

export interface UsageMetric {
  metric: UsageMetricKey;
  used: number;
  limit: LimitDefinition;
  remaining: number | null;
  percentage: number | null;
  status: EntitlementStatus;
}

export interface UsageSnapshot {
  metrics: readonly UsageMetric[];
  capturedAt: string;
}

export type UpgradeReason = "capability_locked" | "usage_exhausted" | "higher_limit";

export interface EntitlementDecision {
  capability: CapabilityId;
  status: EntitlementStatus;
  allowed: boolean;
  usage: UsageMetric | null;
  reason: UpgradeReason | null;
  upgradeTarget: PlanId | null;
}

export interface EntitlementService {
  currentPlan(): PlanDefinition;
  planCatalog(): readonly PlanDefinition[];
  usage(): UsageSnapshot;
  usageFor(metric: UsageMetricKey): UsageMetric;
  evaluate(capability: CapabilityId): EntitlementDecision;
}

export const capabilityLabels: Readonly<Record<CapabilityId, string>> = {
  "discovery.basic": "الاكتشاف الأساسي",
  "crm.core": "إدارة العملاء",
  "export.csv": "تصدير CSV",
  "pipeline.core": "مسار المبيعات",
  "inbox.copilot": "Inbox وCopilot",
  "automation.rules": "الأتمتة",
};

export const usageMetricLabels: Readonly<Record<UsageMetricKey, string>> = {
  leads: "العملاء المحتملون",
  discoveryRuns: "عمليات الاكتشاف",
  seats: "المقاعد النشطة",
  automationRuns: "تشغيلات الأتمتة",
  aiAnalyses: "تحليلات الذكاء",
};

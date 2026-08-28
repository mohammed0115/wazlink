import { entitlementService as canonicalEntitlementService } from "@services";
import { capabilityLabels, usageMetricLabels } from "./contracts/entitlements";
import type { CapabilityId, EntitlementDecision, EntitlementService, PlanDefinition } from "./contracts/entitlements";
import type { UpgradeContext, UpgradeProjectionService, UpgradeReasonKind, UsagePressure } from "./contracts/services";

const BILLING_ROUTE = "settings/billing";

function finiteLimit(plan: PlanDefinition, metric: EntitlementDecision["usage"]): number | null {
  if (!metric) return null;
  const definition = plan.entitlements.limits[metric.metric];
  return definition.kind === "finite" ? definition.value : null;
}

function pressureFor(decision: EntitlementDecision): UsagePressure {
  const usage = decision.usage;
  if (!usage) return "unknown";
  if (usage.limit.kind === "unlimited") return "unlimited";
  if (usage.limit.kind === "not_included") return "unknown";
  if (usage.status === "EXHAUSTED") return "exhausted";
  if (usage.percentage === null) return "unknown";
  if (usage.percentage >= 90) return "near_limit";
  if (usage.percentage >= 70) return "approaching_limit";
  return "normal";
}

function reasonFor(decision: EntitlementDecision): UpgradeReasonKind {
  if (decision.status === "LOCKED" || decision.reason === "capability_locked") return "locked";
  if (decision.status === "EXHAUSTED" || decision.reason === "usage_exhausted") return "exhausted";
  if (decision.status === "LIMITED") return "limited";
  if (decision.status === "AVAILABLE") return "available";
  return "unknown";
}

function reasonLabel(reason: UpgradeReasonKind): string {
  switch (reason) {
    case "locked": return "غير مشمول في الباقة الحالية";
    case "exhausted": return "اكتمل الحد الحالي";
    case "limited": return "متاح ضمن الاستخدام الحالي";
    case "available": return "متاح في الباقة الحالية";
    default: return "حالة التوفر غير معروفة";
  }
}

function explanationFor(
  reason: UpgradeReasonKind,
  capabilityLabel: string,
  currentPlan: PlanDefinition,
  targetPlan: PlanDefinition | null,
  usage: EntitlementDecision["usage"],
): string {
  const target = targetPlan ? ` ${targetPlan.name} تفتح هذا الاستخدام.` : "";
  if (reason === "locked") return `${capabilityLabel} غير مشمولة في ${currentPlan.name}.${target || " راجع الباقات المتاحة لمعرفة الخيارات."}`;
  if (reason === "exhausted") {
    const usageText = usage?.limit.kind === "finite" ? `${usage.used} من ${usage.limit.value}` : "الحد الحالي";
    return `وصل استخدام ${capabilityLabel} إلى ${usageText}.${target || " راجع الباقة الحالية أو انتظر دورة الاستخدام التالية."}`;
  }
  if (reason === "limited") {
    const usageText = usage?.limit.kind === "finite" ? `المتبقي ${usage.remaining}` : "الاستخدام متاح";
    return `${capabilityLabel} متاحة في ${currentPlan.name}؛ ${usageText}.`;
  }
  if (reason === "available") return `${capabilityLabel} متاحة ضمن ${currentPlan.name}، ويمكنك متابعة الإجراء المعتاد.`;
  return `تعذر تأكيد توفر ${capabilityLabel}؛ لم يتم منح صلاحية إضافية.`;
}

function usageMetricLabel(decision: EntitlementDecision): string | null {
  return decision.usage ? usageMetricLabels[decision.usage.metric] : null;
}

function routeFor(capability: CapabilityId, reason: UpgradeReasonKind): string {
  return `${BILLING_ROUTE}?capability=${encodeURIComponent(capability)}&reason=${encodeURIComponent(reason)}`;
}

export function createUpgradeProjection(service: EntitlementService): UpgradeProjectionService {
  function getContext(capability: CapabilityId): UpgradeContext {
    const currentPlan = service.currentPlan();
    if (!capabilityLabels[capability]) {
      return {
        capability,
        capabilityLabel: capability,
        status: "UNKNOWN",
        reason: "unknown",
        reasonLabel: reasonLabel("unknown"),
        explanation: `تعذر تأكيد توفر ${capability}؛ لم يتم منح صلاحية إضافية.`,
        currentPlan,
        targetPlan: null,
        usage: null,
        usageMetric: null,
        pressure: "unknown",
        canUse: false,
        showUpgrade: false,
        action: null,
        billingRoute: BILLING_ROUTE,
      };
    }
    const decision = service.evaluate(capability);
    const catalog = service.planCatalog();
  const targetPlan = decision.upgradeTarget ? catalog.find((plan) => plan.id === decision.upgradeTarget) || null : null;
  const reason = reasonFor(decision);
  const showUpgrade = (reason === "locked" || reason === "exhausted") && Boolean(targetPlan);
  const usage = decision.usage;
  const capabilityLabel = capabilityLabels[capability] || capability;
  const action = showUpgrade
    ? { label: "عرض خيارات الترقية", route: routeFor(capability, reason), kind: "billing" as const }
    : null;
    return {
      capability,
      capabilityLabel,
      status: decision.status,
      reason,
    reasonLabel: reasonLabel(reason),
    explanation: explanationFor(reason, capabilityLabel, currentPlan, targetPlan, usage),
    currentPlan,
    targetPlan,
    usage,
    usageMetric: usage?.metric || null,
    pressure: pressureFor(decision),
    canUse: decision.allowed,
    showUpgrade,
    action,
      billingRoute: BILLING_ROUTE,
    };
  }

  return {
    getContext,
    getCapabilityContexts(capabilities) {
      return capabilities.map(getContext);
    },
  };
}

export const upgradeProjection = createUpgradeProjection(canonicalEntitlementService);

export { finiteLimit };

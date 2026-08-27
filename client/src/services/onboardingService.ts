import type {
  CapabilityId,
  EntitlementDecision,
  EntitlementService,
  PlanDefinition,
  UsageMetric,
} from "./contracts/entitlements";
import type {
  OnboardingAiGuidance,
  OnboardingAiPreference,
  OnboardingEntitlementBoundary,
  OnboardingGoal,
  OnboardingGoalMapping,
  OnboardingProfile,
  OnboardingRecommendation,
  OnboardingRecommendationReasonView,
  OnboardingService,
  OnboardingSource,
  OnboardingSourceGuidance,
} from "./contracts/onboarding";

export const onboardingGoalCapabilities: OnboardingGoalMapping = {
  discover: ["discovery.basic"],
  followup: ["inbox.copilot"],
  convert: ["crm.core", "pipeline.core"],
  conversations: ["inbox.copilot"],
  automation: ["automation.rules"],
  attribution: ["pipeline.core"],
};

export const onboardingSourceGuidance: OnboardingSourceGuidance = {
  business: { capability: "discovery.basic", action: "ابدأ باكتشاف العملاء من مصادر الأعمال." },
  file: { capability: "export.csv", action: "راجع نتائج الملفات وجهّزها للتصدير المحلي." },
  website: { capability: "crm.core", action: "حوّل طلبات الموقع إلى سياق CRM قابل للمتابعة." },
  whatsapp: { capability: "inbox.copilot", action: "راجع المحادثات الواردة داخل Inbox التجريبي." },
  manual: { capability: "crm.core", action: "أضف أول Lead يدويًا إلى مساحة العمل." },
  "external-crm": { capability: "crm.core", action: "ابدأ بمراجعة CRM المحلي قبل أي تكامل خارجي." },
};

export const onboardingAiGuidance: OnboardingAiGuidance = {
  score: { capability: "inbox.copilot", label: "تقييم فرص العملاء" },
  "next-step": { capability: "inbox.copilot", label: "اقتراح الخطوة التالية" },
  draft: { capability: "inbox.copilot", label: "صياغة الردود" },
  summary: { capability: "inbox.copilot", label: "تلخيص المحادثات" },
  qualify: { capability: "crm.core", label: "تأهيل العملاء" },
  follow: { capability: "inbox.copilot", label: "متابعة العملاء" },
};

const capabilityLabels: Readonly<Record<CapabilityId, string>> = {
  "discovery.basic": "الاكتشاف",
  "crm.core": "إدارة العملاء",
  "export.csv": "تصدير النتائج",
  "pipeline.core": "مسار المبيعات",
  "inbox.copilot": "Inbox وCopilot",
  "automation.rules": "الأتمتة",
};

const goalValues: readonly OnboardingGoal[] = ["discover", "followup", "convert", "conversations", "automation", "attribution"];
const sourceValues: readonly OnboardingSource[] = ["business", "file", "website", "whatsapp", "manual", "external-crm"];
const aiValues: readonly OnboardingAiPreference[] = ["score", "next-step", "draft", "summary", "qualify", "follow"];

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
function asNumber(value: unknown): number | null {
  const parsed = Number(asString(value));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
function asValues<T extends string>(value: unknown, allowed: readonly T[]): readonly T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is T => typeof entry === "string" && allowed.includes(entry as T));
}
function unique<T>(values: readonly T[]): readonly T[] {
  return [...new Set(values)];
}
function parseTeamSize(value: string): number | null {
  const match = value.match(/\d+/);
  return match ? Number(match[0]) : value === "أكثر من ٢٥" ? 26 : value === "فردي" ? 1 : null;
}
function sync<T>(value: T | Promise<T>): T {
  if (value instanceof Promise) throw new Error("OnboardingService requires the local synchronous entitlement adapter");
  return value;
}
function reason(code: OnboardingRecommendationReasonView["code"], text: string): OnboardingRecommendationReasonView {
  return { code, text };
}
function firstHigherPlan(catalog: readonly PlanDefinition[], current: PlanDefinition, capability: CapabilityId): PlanDefinition | null {
  return catalog.find((plan) => plan.tier > current.tier && plan.entitlements.capabilities.includes(capability)) || null;
}

export function createOnboardingService(entitlements: OnboardingEntitlementBoundary): OnboardingService {
  function profileFromWorkspace(workspace: Readonly<Record<string, unknown>>): OnboardingProfile {
    return {
      companyName: asString(workspace.companyName),
      industry: asString(workspace.industry),
      city: asString(workspace.city),
      teamSize: asString(workspace.teamSize),
      goals: asValues(workspace.goals, goalValues),
      sources: asValues(workspace.sources, sourceValues),
      pipeline: workspace.pipeline === "نعم" || workspace.pipeline === "لا" ? workspace.pipeline : "",
      monthlyLeads: asNumber(workspace.monthlyLeads),
      averageDealValue: asNumber(workspace.averageDealValue),
      aiPreferences: asValues(workspace.aiPreferences, aiValues),
    };
  }

  function recommend(profile: OnboardingProfile): OnboardingRecommendation {
    const currentPlan = entitlements.currentPlan();
    const catalog = entitlements.planCatalog();
    const mappedGoalCapabilities = profile.goals.flatMap((goal) => onboardingGoalCapabilities[goal] || []);
    const sourceCapabilities = profile.sources.flatMap((source) => {
      const capability = onboardingSourceGuidance[source]?.capability;
      return capability ? [capability] : [];
    });
    const aiCapabilities = profile.aiPreferences.flatMap((preference) => [onboardingAiGuidance[preference].capability]);
    const relevantCapabilities = unique([...mappedGoalCapabilities, ...sourceCapabilities, ...aiCapabilities]);
    const entitlementDecisions: readonly EntitlementDecision[] = relevantCapabilities.map((capability) => entitlements.evaluate(capability));
    const reasons: OnboardingRecommendationReasonView[] = [];
    const limitMetrics: UsageMetric[] = [];
    const seenMetrics = new Set<string>();
    const addMetric = (metric: UsageMetric | null) => {
      if (metric && !seenMetrics.has(metric.metric)) { seenMetrics.add(metric.metric); limitMetrics.push(metric); }
    };
    entitlementDecisions.forEach((decision) => addMetric(decision.usage));
    const teamSize = parseTeamSize(profile.teamSize);
    const seatMetric = entitlements.usageFor("seats");
    const leadMetric = entitlements.usageFor("leads");
    if (teamSize !== null) addMetric(seatMetric);
    if (profile.monthlyLeads !== null) addMetric(leadMetric);

    const blocked = entitlementDecisions.filter((decision) => !decision.allowed);
    const currentLimit = currentPlan.entitlements.limits.leads;
    const leadNearLimit = currentLimit.kind === "finite" && profile.monthlyLeads !== null && profile.monthlyLeads >= currentLimit.value * 0.8;
    const seatLimit = currentPlan.entitlements.limits.seats;
    const teamNeedsMoreSeats = seatLimit.kind === "finite" && teamSize !== null && teamSize > seatLimit.value;

    if (profile.goals.length) reasons.push(reason("goal_capability", `اخترت ${profile.goals.length} أهداف؛ أظهرنا القدرات الأقرب لهذه الأولويات.`));
    if (profile.sources.length) {
      const sourceAction = onboardingSourceGuidance[profile.sources[0]]?.action;
      if (sourceAction) reasons.push(reason("source_guidance", sourceAction));
    }
    if (blocked.length) reasons.push(reason("locked_capability", `بعض الأولويات تحتاج خطة أعلى أو حدًا أكبر: ${blocked.map((item) => capabilityLabels[item.capability]).join("، ")}.`));
    if (teamNeedsMoreSeats) reasons.push(reason("seat_headroom", `حجم الفريق يتجاوز حد المقاعد الحالي (${teamSize} مقابل ${seatLimit.kind === "finite" ? seatLimit.value : "غير محدود"}).`));
    if (leadNearLimit) reasons.push(reason("lead_headroom", "حجم العملاء الشهري قريب من حد الخطة المقترح؛ راقب المساحة قبل التوسع."));

    const candidateTargets = blocked.flatMap((decision) => {
      const target = decision.upgradeTarget || firstHigherPlan(catalog, currentPlan, decision.capability)?.id;
      return target ? catalog.filter((plan) => plan.id === target) : [];
    });
    const recommendedPlan = candidateTargets.sort((a, b) => a.tier - b.tier)[0] || (teamNeedsMoreSeats ? catalog.find((plan) => plan.tier > currentPlan.tier && plan.entitlements.limits.seats.kind === "finite" && teamSize !== null && plan.entitlements.limits.seats.value >= teamSize) || null : null);
    const currentPlanSufficient = !recommendedPlan && !leadNearLimit && !teamNeedsMoreSeats;
    if (currentPlanSufficient) reasons.push(reason("current_plan_sufficient", "الخطة الحالية تدعم أولوياتك الأساسية في هذه التجربة."));

    const actionCandidates: readonly { id: "discover" | "inbox" | "crm" | "automation"; label: string; route: string; capability: CapabilityId; reason: string }[] = [
      { id: "discover", label: "ابدأ باكتشاف العملاء", route: "discovery", capability: "discovery.basic", reason: "لأن هدفك يتضمن اكتشاف العملاء." },
      { id: "inbox", label: "افتح Inbox", route: "inbox", capability: "inbox.copilot", reason: "لأن اختياراتك تتضمن المحادثات أو المتابعة." },
      { id: "crm", label: "أضف أول Lead", route: "crm", capability: "crm.core", reason: "لبناء سياق CRM من المصادر التي اخترتها." },
      { id: "automation", label: "راجع الأتمتة", route: "automation", capability: "automation.rules", reason: "لأن الأتمتة ضمن أولوياتك." },
    ];
    const preferredAction = profile.goals.map((goal) => goal === "discover" ? "discover" : goal === "automation" ? "automation" : goal === "conversations" || goal === "followup" ? "inbox" : "crm").map((id) => actionCandidates.find((candidate) => candidate.id === id)).find((candidate) => candidate && entitlements.evaluate(candidate.capability).allowed) || actionCandidates.find((candidate) => entitlements.evaluate(candidate.capability).allowed) || actionCandidates[0];
    if (preferredAction) reasons.push(reason("first_action_accessible", preferredAction.reason));

    const activationItems = actionCandidates.map((candidate) => {
      const decision = entitlements.evaluate(candidate.capability);
      return { id: candidate.id, label: candidate.label, route: candidate.route, capability: candidate.capability, enabled: decision.allowed, reason: decision.allowed ? candidate.reason : `هذه الخطوة مرتبطة بقدرة ${capabilityLabels[candidate.capability]} غير المتاحة حاليًا.` };
    });
    const firstAction = activationItems.find((item) => item.id === preferredAction?.id) || activationItems[0];
    return { currentPlan, recommendedPlan: recommendedPlan || null, currentPlanSufficient, relevantCapabilities, entitlementDecisions, reasons, limitContext: limitMetrics, firstAction, activationItems, profile };
  }

  return { profileFromWorkspace, recommend };
}

export function createOnboardingServiceFromEntitlements(entitlements: EntitlementService): OnboardingService {
  return createOnboardingService(entitlements);
}

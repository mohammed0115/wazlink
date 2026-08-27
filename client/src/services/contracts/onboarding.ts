import type { CapabilityId, EntitlementDecision, EntitlementService, PlanDefinition, PlanId, UsageMetric } from "./entitlements";

export type OnboardingGoal =
  | "discover"
  | "followup"
  | "convert"
  | "conversations"
  | "automation"
  | "attribution";

export type OnboardingSource = "business" | "file" | "website" | "whatsapp" | "manual" | "external-crm";

export type OnboardingAiPreference = "score" | "next-step" | "draft" | "summary" | "qualify" | "follow";

export type OnboardingGoalMapping = Readonly<Record<OnboardingGoal, readonly CapabilityId[]>>;
export type OnboardingSourceGuidance = Readonly<Record<OnboardingSource, Readonly<{ capability: CapabilityId | null; action: string }>>>;
export type OnboardingAiGuidance = Readonly<Record<OnboardingAiPreference, Readonly<{ capability: CapabilityId; label: string }>>>;

export interface OnboardingProfile {
  companyName: string;
  industry: string;
  city: string;
  teamSize: string;
  goals: readonly OnboardingGoal[];
  sources: readonly OnboardingSource[];
  pipeline: "نعم" | "لا" | "";
  monthlyLeads: number | null;
  averageDealValue: number | null;
  aiPreferences: readonly OnboardingAiPreference[];
}

export type OnboardingRecommendationReason =
  | "goal_capability"
  | "locked_capability"
  | "seat_headroom"
  | "lead_headroom"
  | "current_plan_sufficient"
  | "source_guidance"
  | "first_action_accessible";

export interface OnboardingRecommendationReasonView {
  code: OnboardingRecommendationReason;
  text: string;
}

export interface OnboardingActivationItem {
  id: "discover" | "inbox" | "crm" | "automation" | "billing";
  label: string;
  route: string;
  capability: CapabilityId | null;
  enabled: boolean;
  reason: string;
}

export interface OnboardingRecommendation {
  currentPlan: PlanDefinition;
  recommendedPlan: PlanDefinition | null;
  currentPlanSufficient: boolean;
  relevantCapabilities: readonly CapabilityId[];
  entitlementDecisions: readonly EntitlementDecision[];
  reasons: readonly OnboardingRecommendationReasonView[];
  limitContext: readonly UsageMetric[];
  firstAction: OnboardingActivationItem;
  activationItems: readonly OnboardingActivationItem[];
  profile: OnboardingProfile;
}

export interface OnboardingService {
  profileFromWorkspace(workspace: Readonly<Record<string, unknown>>): OnboardingProfile;
  recommend(profile: OnboardingProfile): OnboardingRecommendation;
}

export type OnboardingEntitlementBoundary = Pick<EntitlementService, "currentPlan" | "planCatalog" | "usageFor" | "evaluate">;


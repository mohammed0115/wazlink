/**
 * أنواع مشتركة فوق طبقة النطاق.
 *
 * هذه الأنواع **وصف** لعقود `ENTITY_MODEL.md` القائمة في `client/js/data.js`
 * وليست تعريفًا جديدًا لها. مصدر الحقيقة يبقى الـfixtures والـdomain functions،
 * والغرض هنا أن يمسك المترجم أخطاء العقود قبل التشغيل.
 */

/** مساحة عمل Onboarding — حالة جلسة فقط، لا علاقة لها بكيان `Workspace` في S11. */
export type OnboardingWorkspace = {
  companyName: string;
  industry: string;
  city: string;
  teamSize: string;
  goals: string[];
  sources: string[];
  pipeline: string;
  monthlyLeads: string;
  averageDealValue: string;
  aiPreferences: string[];
  /** يُكتب في الخطوة الرابعة ولا يوجد في الـfixture الابتدائية. */
  salesTeam?: string;
};

export type OnboardingCollection = "goals" | "sources" | "aiPreferences";

/** صف ملخص الإسناد المشتق في لوحة القيادة. */
export type AttributionSummaryRow = {
  label: string;
  sourceName: string;
  jobId: string;
  discovered: string;
  qualified: string;
  won: number;
  revenueEventIds: string[];
  revenue: number;
};

/** فلاتر قائمة عمليات الاكتشاف — حالة واجهة فقط. */
export type DiscoveryListFilters = Record<string, string>;

/** نوافذ الاكتشاف: تأكيد الإلغاء، معاينة شركة، وقرار Scraper/CRM بعد النتائج. */
export type DiscoveryModalState =
  | { type: "cancel"; jobId: string }
  | { type: "business"; businessId: string }
  | { type: "scraper-crm-decision"; jobId?: string; businessIds?: string[] }
  | { type: "scraper-export-success"; jobId?: string; businessIds?: string[] }
  | null;


/** Stable identifiers used by the frontend contracts; branding is intentionally deferred in S0. */
export type BusinessId = string;
export type LeadId = string;
export type DealId = string;
export type ConversationId = string;
export type MessageId = string;
export type TaskId = string;
export type AppointmentId = string;
export type RevenueEventId = string;
export type AttributionTouchpointId = string;
export type AutomationRuleId = string;
export type AutomationRunId = string;
export type UserId = string;
export type WorkspaceId = string;
export type IntegrationId = string;
export type SubscriptionId = string;

export type EntityStatus = string;

/** Canonical domain contracts. Concrete fixture records may carry additional fields until API schemas arrive. */
export interface Business {
  id: BusinessId;
  name: string;
  status?: EntityStatus;
  discoveryJobId?: string;
}

export interface Lead {
  id: LeadId;
  businessId: BusinessId;
  companyId?: string;
  ownerId?: UserId;
  sourceJobId?: string;
  status?: EntityStatus;
}

export interface Deal {
  id: DealId;
  leadId: LeadId;
  title: string;
  value: number;
  currency: string;
  probability: number;
  status?: EntityStatus;
}

export interface Conversation {
  id: ConversationId;
  leadId: LeadId;
  channel: string;
  status?: EntityStatus;
  assignedTo?: UserId;
}

export interface Message {
  id: MessageId;
  conversationId: ConversationId;
  body: string;
  direction: "inbound" | "outbound" | "draft";
  createdAt?: string;
}

export interface Task {
  id: TaskId;
  leadId?: LeadId;
  dealId?: DealId;
  ownerId?: UserId;
  status?: EntityStatus;
  dueAt?: string;
}

export interface Appointment {
  id: AppointmentId;
  leadId?: LeadId;
  contactId?: string;
  dealId?: DealId;
  status?: EntityStatus;
  scheduledAt?: string;
}

export interface RevenueEvent {
  id: RevenueEventId;
  dealId?: DealId;
  amount: number;
  currency: string;
  status?: EntityStatus;
}

export interface AttributionTouchpoint {
  id: AttributionTouchpointId;
  revenueEventId: RevenueEventId;
  discoveryJobId?: string;
  role?: "first_touch" | "assist" | "last_touch";
}

export interface AutomationRule {
  id: AutomationRuleId;
  name: string;
  status?: EntityStatus;
}

export interface AutomationRun {
  id: AutomationRunId;
  ruleId: AutomationRuleId;
  status?: EntityStatus;
  startedAt?: string;
  completedAt?: string;
}

export interface User {
  id: UserId;
  name: string;
  email?: string;
  status?: EntityStatus;
}

export interface Workspace {
  id: WorkspaceId;
  name: string;
  timezone?: string;
  currency?: string;
}

export interface Integration {
  id: IntegrationId;
  name: string;
  status?: EntityStatus;
}

export interface Subscription {
  id: SubscriptionId;
  plan: string;
  status?: EntityStatus;
}

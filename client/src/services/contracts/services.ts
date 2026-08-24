import type { Conversation, Deal, Lead, Message } from "@domain/types.js";

export type SortDirection = "asc" | "desc";
export type LeadFilters = { search?: string; status?: string; ownerId?: string; sortBy?: "updatedAt" | "score"; sortDirection?: SortDirection };
export type DealFilters = { search?: string; status?: string; stageId?: string; sortBy?: "updatedAt" | "value"; sortDirection?: SortDirection };
export type ConversationFilters = { search?: string; status?: string; channel?: string; sortBy?: "updatedAt" | "lastMessageAt"; sortDirection?: SortDirection };
export type DiscoveryFilters = { search?: string; city?: string; rating?: string; website?: string; phone?: string };

export interface AppServiceError { code: string; message: string; field?: string; retryable?: boolean; }
export type BusinessSummary = { id: string; name: string; category?: string; city?: string; rating?: number | null; reviews?: number | null; source?: string; short?: string; discoveryJobId?: string; phone?: string; email?: string; address?: string; country?: string; website?: string };
export type LeadListItem = { id: string; businessId: string; status?: string; priority?: string; score?: number; businessName?: string };
export type LeadDetail = Lead;
export type DealListItem = { id: string; leadId: string; stageId?: string; value: number; probability: number; status?: string };
export type DealDetail = Deal;
export type ConversationSummary = { id: string; leadId: string; channel: string; status?: string; lastMessageAt?: string; unreadCount?: number };
export type ConversationDetail = Conversation & { messages: Message[] };
export type DashboardSnapshot = { metrics: Record<string, number>; updatedAt: string };
export type AnalyticsSnapshot = { funnel: Array<{ label: string; count: number }>; revenue: number; attributedRevenue: number };

export type BillingPlan = { id: string; name: string; price: number; interval?: string; features?: string[] };
export type BillingSubscription = { planId: string; status?: string; renewsAt?: string | null; cancelAtPeriodEnd?: boolean };
export type BillingUsageItem = { key: string; label: string; used: number; limit: number; remaining: number };
export type BillingInvoice = { id: string; amount: number; status?: string; period?: string; issuedAt?: string };
export type BillingPaymentMethod = { id: string; brand: string; last4: string; label?: string };
export type CheckoutSession = { id: string; planId: string; step: "invoice" | "payment" | "review" | "success" | "failed"; invoice?: Record<string, unknown>; paymentMethodId?: string; error?: string | null; receiptId?: string | null };
export type CheckoutStartInput = { planId?: string; context?: string; jobId?: string | null; businessIds?: string[] };
export type CheckoutInvoiceInput = { companyName: string; billingEmail: string; taxNumber?: string };
export type PlanPreviewInput = { planId: string };
export type ServiceResult<T> = T | Promise<T>;

export interface BusinessService { list(filters?: DiscoveryFilters): Promise<BusinessSummary[]>; getById(id: string): Promise<BusinessSummary | null>; }
export interface LeadService { list(filters?: LeadFilters): Promise<LeadListItem[]>; getById(id: string): Promise<LeadDetail | null>; updateStatus(input: { id: string; status: string }): Promise<LeadDetail | null>; }
export interface DealService { list(filters?: DealFilters): Promise<DealListItem[]>; getById(id: string): Promise<DealDetail | null>; updateStatus(input: { id: string; status: string }): Promise<DealDetail | null>; }
export interface ConversationService { list(filters?: ConversationFilters): Promise<ConversationSummary[]>; getById(id: string): Promise<ConversationDetail | null>; }
export interface MessageService { list(conversationId: string): Promise<Message[]>; send(input: { conversationId: string; body: string }): Promise<Message | null>; }
export interface TaskService { list(filters?: Record<string, string>): Promise<unknown[]>; complete(id: string): Promise<unknown>; }
export interface AppointmentService { list(filters?: Record<string, string>): Promise<unknown[]>; }
export interface AnalyticsService { dashboard(): Promise<DashboardSnapshot>; overview(): Promise<AnalyticsSnapshot>; }
export interface AutomationService { list(): Promise<unknown[]>; run(id: string): Promise<unknown>; }
export interface SettingsService { workspace(): Promise<unknown>; update(input: Record<string, unknown>): Promise<unknown>; }
export interface IntegrationService { list(): Promise<unknown[]>; }
export interface BillingService {
  plans(): ServiceResult<BillingPlan[]>;
  currentSubscription(): ServiceResult<BillingSubscription | null>;
  usage(): ServiceResult<BillingUsageItem[]>;
  activities(): ServiceResult<unknown[]>;
  invoices(): ServiceResult<BillingInvoice[]>;
  paymentMethods(): ServiceResult<BillingPaymentMethod[]>;
  previewPlanChange(input: PlanPreviewInput): ServiceResult<unknown>;
  changePlan(planId: string): ServiceResult<unknown>;
  setCancelAtPeriodEnd(value: boolean): ServiceResult<unknown>;
  startCheckout(input?: CheckoutStartInput): ServiceResult<CheckoutSession | null>;
  getCheckout(): ServiceResult<CheckoutSession | null>;
  updateCheckoutInvoice(input: CheckoutInvoiceInput): ServiceResult<CheckoutSession | null>;
  continueCheckoutPayment(paymentMethodId: string): ServiceResult<CheckoutSession | null>;
  confirmCheckout(): ServiceResult<CheckoutSession | null>;
  failCheckout(reason?: string): ServiceResult<CheckoutSession | null>;
  cancelCheckout(): ServiceResult<void>;
  finishCheckoutJourney(): ServiceResult<unknown>;
}

export type FeatureRow = Record<string, unknown>;
export type FeatureRows = FeatureRow[];
export interface DashboardService {
  getDashboardOverview(): ServiceResult<FeatureRow>;
  getUpcomingActivities(): ServiceResult<FeatureRows>;
  getInboxConversations(): ServiceResult<FeatureRows>;
  getPipelineStageSummary(id?: string): ServiceResult<FeatureRows>;
  getAutomationMetrics(): ServiceResult<FeatureRow>;
  listBusinesses(): ServiceResult<BusinessSummary[]>;
  listDiscoveryJobs(): ServiceResult<FeatureRows>;
}
export interface DiscoveryService {
  listDiscoveryJobs(): ServiceResult<FeatureRows>; getDiscoveryJob(id: string): ServiceResult<FeatureRow | null>; getDiscoverySource(id: string): ServiceResult<FeatureRow | null>;
  createDiscoveryJob(input: FeatureRow): ServiceResult<FeatureRow>; startDiscoveryJob(id: string): ServiceResult<FeatureRow>;
  progressDiscoveryJob(id: string): ServiceResult<FeatureRow>; completeDiscoveryJob(id: string): ServiceResult<FeatureRow>;
  cancelDiscoveryJob(id: string): ServiceResult<FeatureRow>; retryDiscoveryJob(id: string): ServiceResult<FeatureRow>;
  getJobResults(id: string): ServiceResult<FeatureRows>;
}
export interface CrmService {
  listBusinesses(): ServiceResult<BusinessSummary[]>; listLeads(): ServiceResult<FeatureRows>;
  getLead(id: string): ServiceResult<FeatureRow | null>; getLeadByBusinessId(id: string): ServiceResult<FeatureRow | null>;
  getLeadActivities(id: string): ServiceResult<FeatureRows>; getLeadContacts(id: string): ServiceResult<FeatureRows>;
  getLeadConversations(id: string): ServiceResult<FeatureRows>; getLeadDeals(id: string): ServiceResult<FeatureRows>;
  convertBusinessToLead(id: string, input?: FeatureRow): ServiceResult<FeatureRow | null>;
  updateLeadStatus(id: string, value: string): ServiceResult<FeatureRow | null>;
  updateLeadPriority(id: string, value: string): ServiceResult<FeatureRow | null>;
  assignLeadOwner(id: string, ownerId: string): ServiceResult<FeatureRow | null>;
}
export interface PipelineService {
  listDeals(): ServiceResult<FeatureRows>; listBusinesses(): ServiceResult<BusinessSummary[]>; listLeads(): ServiceResult<FeatureRows>; getDeal(id: string): ServiceResult<FeatureRow | null>; getDealBusiness(id: string): ServiceResult<FeatureRow | null>;
  getPipeline(id?: string): ServiceResult<FeatureRow | null>; getPipelineMetrics(id?: string): ServiceResult<FeatureRow>;
  getPipelineStageSummary(id?: string): ServiceResult<FeatureRows>; moveDealStage(id: string, stageId: string): ServiceResult<FeatureRow | null>;
  closeDealAsWon(id: string): ServiceResult<FeatureRow | null>; closeDealAsLost(id: string, reason?: string): ServiceResult<FeatureRow | null>;
  updateDeal(id: string, patch: FeatureRow): ServiceResult<FeatureRow | null>;
}
export interface MessagingService {
  getConversation(id: string): ServiceResult<FeatureRow | null>; getConversationMessages(id: string): ServiceResult<FeatureRows>;
  getInboxConversations(): ServiceResult<FeatureRows>; getInboxSummary(): ServiceResult<FeatureRow>;
  sendMessage(id: string, input: FeatureRow): ServiceResult<FeatureRow | null>;
  advanceMessageStatus(id?: string): ServiceResult<FeatureRow | null>; retryMessage(id: string): ServiceResult<FeatureRow | null>;
  assignConversation(id: string, ownerId: string): ServiceResult<FeatureRow | null>;
  closeConversation(id: string): ServiceResult<FeatureRow | null>; reopenConversation(id: string): ServiceResult<FeatureRow | null>;
}
export interface AutomationFeatureService {
  getAutomationRules(): ServiceResult<FeatureRows>; getAutomationRuns(): ServiceResult<FeatureRows>;
  getAutomationRule(id: string): ServiceResult<FeatureRow | null>; getAutomationApprovalQueue(): ServiceResult<FeatureRows>;
  runAutomationNow(id: string): ServiceResult<FeatureRow | null>; testAutomationRule(id: string): ServiceResult<FeatureRow | null>;
  approveAutomationAction(id: string): ServiceResult<FeatureRow | null>; rejectAutomationAction(id: string): ServiceResult<FeatureRow | null>;
  setAutomationRuleStatus(id: string, status: string): ServiceResult<FeatureRow | null>;
}
export interface SettingsFeatureService {
  getWorkspace(): ServiceResult<FeatureRow>; getCurrentWorkspaceUser(): ServiceResult<FeatureRow | null>; listUsers(): ServiceResult<FeatureRows>;
  getNotificationPreferences(): ServiceResult<FeatureRows>; getSecuritySettings(): ServiceResult<FeatureRow>;
  getTeamInvitations(): ServiceResult<FeatureRows>; getSettingsActivities(): ServiceResult<FeatureRows>;
  updateWorkspaceSettings(input: FeatureRow): ServiceResult<FeatureRow>; updateCurrentUserSettings(input: FeatureRow): ServiceResult<FeatureRow>;
  setNotificationPreference(id: string, input: FeatureRow): ServiceResult<FeatureRow>;
}
export interface IntegrationFeatureService {
  listIntegrations(): ServiceResult<FeatureRows>; getIntegration(id: string): ServiceResult<FeatureRow | null>;
  getIntegrationActivities(id: string): ServiceResult<FeatureRows>; connectIntegration(id: string): ServiceResult<FeatureRow | null>;
  disconnectIntegration(id: string): ServiceResult<FeatureRow | null>; retryIntegration(id: string): ServiceResult<FeatureRow | null>;
  updateIntegrationConfiguration(id: string, input: FeatureRow): ServiceResult<FeatureRow | null>;
}

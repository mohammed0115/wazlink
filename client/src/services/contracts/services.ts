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

export type BillingPlan = { id: string; name: string; price: number; interval?: string; currency?: string; limits: Readonly<Record<"leads" | "discoveryRuns" | "seats" | "automationRuns" | "aiAnalyses", number | null>>; features: readonly string[] };
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
export interface TaskService { list(filters?: Record<string, string>): Promise<TaskView[]>; complete(id: string): Promise<TaskMutationResult>; getTasksWorkspace(): TaskView[]; completeLeadTask(id: string): boolean; }
export interface AppointmentService { list(filters?: Record<string, string>): Promise<AppointmentView[]>; getAppointments(): AppointmentView[]; createAppointment(input: FeatureRow): FeatureRow | null; getLeadAppointments(id: string): AppointmentView[]; }
export interface AnalyticsService { dashboard(): Promise<DashboardSnapshot>; overview(): Promise<AnalyticsSnapshot>; }
export interface AutomationService { list(): Promise<AutomationRuleView[]>; run(id: string): Promise<AutomationExecutionResult>; }
export interface SettingsService { workspace(): Promise<unknown>; update(input: Record<string, unknown>): Promise<unknown>; }
export interface IntegrationService { list(): Promise<IntegrationView[]>; }
export interface BillingService {
  plans(): ServiceResult<BillingPlan[]>;
  currentSubscription(): ServiceResult<BillingSubscription | null>;
  usage(): ServiceResult<BillingUsageItem[]>;
  activities(): ServiceResult<BillingActivity[]>;
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

export interface FeatureRow { id?: string; name?: string; status?: string; createdAt?: string; updatedAt?: string; [key: string]: unknown; }
export type FeatureRows = FeatureRow[];
export interface DashboardOverviewView extends FeatureRow { attentionItems?: FeatureRows; aiRecommendations?: FeatureRows; nearClosingDeals?: FeatureRows; }
export interface DashboardActivityItem extends FeatureRow { type?: string; title?: string; at?: string; }
export interface DashboardPipelineSummary extends FeatureRow { value?: number; count?: number; }
export interface DiscoveryJobSummary extends FeatureRow { id: string; query?: string; status?: string; resultCount?: number; }
export interface DiscoveryJobDetail extends DiscoveryJobSummary { completedAt?: string; error?: string | null; }
export interface DiscoveryResultItem extends FeatureRow { businessId?: string; source?: string; phone?: string; website?: string; }
export interface LeadActivityItem extends FeatureRow { type?: string; title?: string; body?: string; detail?: string; at?: string; createdAt?: string; actorId?: string; metadata?: { dealId?: string; leadId?: string; [key: string]: unknown }; }
export interface LeadRecordView extends FeatureRow { businessId?: string; ownerId?: string; priority?: string; sourceJobId?: string; }
export interface LeadMutationResult extends FeatureRow { success?: boolean; }
export interface DealDetailView extends FeatureRow { leadId?: string; stageId?: string; value?: number; probability?: number; }
export interface PipelineStageView extends FeatureRow { id?: string; name?: string; kind?: string; defaultProbability?: number; }
export interface PipelineMetricsView extends FeatureRow { openValue?: number; weightedValue?: number; }
export interface ConversationView extends FeatureRow { leadId?: string; businessId?: string; channel?: string; status?: string; lastMessageAt?: string; contactId?: string | null; unreadCount?: number; }
export interface MessageView extends FeatureRow { conversationId?: string; body?: string; direction?: string; deliveryStatus?: string; status?: string; createdAt?: string; senderId?: string | null; }
export type JourneyEntityKind = "business" | "lead" | "job" | "conversation" | "message" | "deal" | "task" | "appointment" | "activity";
export type JourneyCanonicalId = `BUS-${string}` | `LEAD-${string}` | `JOB-${string}` | `CONV-${string}` | `MSG-${string}` | `DEAL-${string}` | `TSK-${string}` | `APT-${string}` | `ACT-${string}`;
export interface JourneyEntityRef { kind: JourneyEntityKind; id: JourneyCanonicalId; }
export interface JourneyAction { label: string; route: string; entity: JourneyEntityRef; }
export interface CustomerJourneyContext { job?: JourneyEntityRef; business?: JourneyEntityRef; lead?: JourneyEntityRef; conversation?: JourneyEntityRef; deal?: JourneyEntityRef; sourceId?: string; actions: JourneyAction[]; }
export type JourneyActivityKind = "lead_activity" | "message" | "task" | "appointment" | "deal_activity";
export interface JourneyActivityItem { id: JourneyCanonicalId; kind: JourneyActivityKind; timestamp: string; leadId: JourneyCanonicalId; businessId?: JourneyCanonicalId; conversationId?: JourneyCanonicalId; messageId?: JourneyCanonicalId; dealId?: JourneyCanonicalId; taskId?: JourneyCanonicalId; appointmentId?: JourneyCanonicalId; title: string; description?: string; route?: string; }
export interface JourneyProjectionService { getContext(leadId: string): CustomerJourneyContext | null; getLeadActivity(leadId: string): JourneyActivityItem[]; }
export interface MessageMutationResult extends MessageView { success?: boolean; }
export interface AutomationRuleView extends FeatureRow { trigger?: string; action?: string; enabled?: boolean; }
export interface AutomationRunView extends FeatureRow { ruleId?: string; status?: string; }
export interface AutomationApprovalView extends FeatureRow { action?: string; status?: string; }
export interface AutomationAuditItem extends FeatureRow { eventType?: string; at?: string; }
export interface WorkspaceSettingsView extends FeatureRow { timezone?: string; currency?: string; locale?: string; }
export interface TeamMemberView extends FeatureRow { name?: string; role?: string; status?: string; }
export interface NotificationSettingsView extends FeatureRow { category?: string; channel?: string; enabled?: boolean; }
export interface IntegrationView extends FeatureRow { provider?: string; connectionStatus?: string; }
export interface IntegrationActivityView extends FeatureRow { action?: string; at?: string; }
export interface IntegrationMutationResult extends IntegrationView { success?: boolean; }
export interface UpdateLeadInput { id: string; value: string; }
export interface UpdateDealInput extends FeatureRow { id?: string; }
export interface SendHumanMessageInput extends FeatureRow { body?: string; }
export interface AutomationRuleInput extends FeatureRow { trigger?: string; action?: string; }
export interface UpdateWorkspaceSettingsInput extends FeatureRow { timezone?: string; currency?: string; locale?: string; }
export interface ConnectIntegrationInput extends FeatureRow { provider?: string; }
export interface SecuritySettingsInput { dataResidency: "local_only" | "external_allowed_mock"; externalAiAccess: boolean; actorId?: string; }
export interface TaskView extends FeatureRow { title?: string; dueAt?: string; createdAt?: string; leadId?: string; dealId?: string; type?: string; ownerId?: string; completed?: boolean; }
export interface TaskMutationResult extends FeatureRow { success: boolean; }
export interface AppointmentView extends FeatureRow { title?: string; startsAt?: string; createdAt?: string; leadId?: string; dealId?: string; status?: string; }
export interface AutomationExecutionResult extends FeatureRow { success?: boolean; matched?: boolean; kind?: string; run?: FeatureRow | null; conditionResult?: { matched?: boolean; [key: string]: unknown }; }
export interface BillingActivity extends FeatureRow { type?: string; actorId?: string; }
export interface AutomationRunView extends FeatureRow { ruleId?: string; status?: string; }
export interface DiscoverySourceView extends FeatureRow { name?: string; type?: string; status?: string; }
export interface CrmSummaryView extends FeatureRow { totalLeads?: number; openLeads?: number; convertedLeads?: number; }
export interface CrmFilterSnapshot extends FeatureRow { search?: string; status?: string; ownerId?: string; }
export interface ContactView extends FeatureRow { name?: string; phone?: string; email?: string; }
export interface ConversationContextView extends FeatureRow { lead?: LeadDetail | null; business?: BusinessSummary | null; contact?: ContactView | null; }
export interface PipelineView extends FeatureRow { stages?: PipelineStageView[]; }
export interface DealFilterSnapshot extends FeatureRow { search?: string; status?: string; stageId?: string; }
export interface AutomationConditionFieldView extends FeatureRow { field?: string; label?: string; entityType?: string; dataType?: string; }
export interface SecuritySettingsView extends FeatureRow { dataResidency?: "local_only" | "external_allowed_mock"; externalAiAccess?: boolean; }
export interface TeamInvitationView extends FeatureRow { email?: string; status?: string; role?: string; }
export interface SettingsActivityView extends FeatureRow { type?: string; at?: string; }
export interface TeamInvitationInput extends FeatureRow { email?: string; role?: string; }
export interface UserSettingsInput extends FeatureRow { name?: string; role?: string; }
export interface NotificationPreferenceInput extends FeatureRow { enabled?: boolean; channel?: string; }

export interface DashboardService {
  getDashboardOverview(): ServiceResult<DashboardOverviewView>; getUpcomingActivities(): ServiceResult<DashboardActivityItem[]>; getInboxConversations(): ServiceResult<ConversationView[]>; getPipelineStageSummary(id?: string): ServiceResult<DashboardPipelineSummary[]>; getAutomationMetrics(): ServiceResult<DashboardPipelineSummary>; listBusinesses(): ServiceResult<BusinessSummary[]>; listDiscoveryJobs(): ServiceResult<DiscoveryJobSummary[]>;
}
export interface DiscoveryService {
  listDiscoveryJobs(): ServiceResult<DiscoveryJobSummary[]>; getDiscoveryJob(id?: string): ServiceResult<DiscoveryJobDetail | null>; getDiscoverySource(id: string): ServiceResult<DiscoverySourceView | null>; getDiscoveryCombinations(): ServiceResult<DiscoveryResultItem[]>;
  createDiscoveryJob(input: FeatureRow, options?: FeatureRow): ServiceResult<DiscoveryJobDetail>; startDiscoveryJob(id?: string): ServiceResult<DiscoveryJobDetail>; progressDiscoveryJob(id?: string, step?: number): ServiceResult<DiscoveryJobDetail>; completeDiscoveryJob(id?: string): ServiceResult<DiscoveryJobDetail>; cancelDiscoveryJob(id?: string): ServiceResult<DiscoveryJobDetail>; retryDiscoveryJob(id?: string): ServiceResult<DiscoveryJobDetail>; getJobResults(id?: string): ServiceResult<DiscoveryResultItem[]>;
}
export interface CrmService {
  listBusinesses(): ServiceResult<BusinessSummary[]>; listLeads(): ServiceResult<LeadRecordView[]>; getCrmFiltersSnapshot(): ServiceResult<CrmFilterSnapshot>; getCrmSummary(): ServiceResult<CrmSummaryView>; getLead(id: string): ServiceResult<LeadDetail | null>; getLeadByBusinessId(id: string): ServiceResult<LeadDetail | null>; getLeadActivities(id: string): ServiceResult<LeadActivityItem[]>; getLeadActivitySummary(id: string): ServiceResult<LeadActivityItem>; getLeadOwner(id: string): ServiceResult<TeamMemberView | null>; getLeadNotes(id: string): ServiceResult<LeadActivityItem[]>; getLeadTasks(id: string): ServiceResult<TaskView[]>; addLeadNote(id: string, input: FeatureRow): ServiceResult<LeadMutationResult | null>; addLeadTask(id: string, input: FeatureRow): ServiceResult<LeadMutationResult | null>; getLeadAppointments(id: string): ServiceResult<AppointmentView[]>; getLeadContacts(id: string): ServiceResult<ContactView[]>; getLeadConversations(id: string): ServiceResult<ConversationView[]>; getLeadDeals(id: string): ServiceResult<DealDetailView[]>; convertBusinessToLead(id: string, input?: FeatureRow): ServiceResult<LeadMutationResult | null>; updateLeadStatus(id: string, value: string): ServiceResult<LeadMutationResult | null>; updateLeadPriority(id: string, value: string): ServiceResult<LeadMutationResult | null>; assignLeadOwner(id: string, ownerId: string): ServiceResult<LeadMutationResult | null>;
}
export interface PipelineService {
  listDeals(): ServiceResult<DealDetailView[]>; listBusinesses(): ServiceResult<BusinessSummary[]>; listLeads(): ServiceResult<LeadRecordView[]>; getDeal(id: string): ServiceResult<DealDetailView | null>; getDealLead(id: string): ServiceResult<LeadDetail | null>; getDealStage(deal: FeatureRow): ServiceResult<PipelineStageView | null>; getDealProbability(deal: FeatureRow): ServiceResult<number>; getDealBusiness(id: string): ServiceResult<BusinessSummary | null>; getPipeline(id?: string): ServiceResult<PipelineView | null>; getPipelineMetrics(id?: string): ServiceResult<PipelineMetricsView>; getPipelineStageSummary(id?: string): ServiceResult<PipelineStageView[]>; getDealFiltersSnapshot(): ServiceResult<DealFilterSnapshot>; getLeadActivitySummary(id: string): ServiceResult<LeadActivityItem>; getPipelineStages(): ServiceResult<PipelineStageView[]>; createDeal(input: FeatureRow): ServiceResult<DealDetailView | null>; getOpenDealsForLead(id: string): ServiceResult<DealDetailView[]>; getOpenDealForLead(id: string): ServiceResult<DealDetailView | null>; getDealActivities(id: string): ServiceResult<LeadActivityItem[]>; getDealTasks(id: string): ServiceResult<TaskView[]>; getLeadDeals(id: string): ServiceResult<DealDetailView[]>; moveDealStage(id: string, stageId: string): ServiceResult<DealDetailView | null>; closeDealAsWon(id: string): ServiceResult<DealDetailView | null>; closeDealAsLost(id: string, reason?: string): ServiceResult<DealDetailView | null>; updateDeal(id: string, patch: FeatureRow): ServiceResult<DealDetailView | null>;
}
export interface MessagingService {
  listUsers(): ServiceResult<TeamMemberView[]>; listConversations(): ServiceResult<ConversationView[]>; getConversation(id: string): ServiceResult<ConversationView | null>; getConversationMessages(id: string): ServiceResult<MessageView[]>; getConversationLatestMessage(conversation: FeatureRow): ServiceResult<MessageView | null>; getConversationContact(conversation: ConversationView): ServiceResult<ContactView | null>; getConversationBusiness(conversation: FeatureRow): ServiceResult<BusinessSummary | null>; getLeadContacts(id: string): ServiceResult<ContactView[]>; getLeadConversations(id: string): ServiceResult<ConversationView[]>; getConversationContext(conversation: ConversationView): ServiceResult<ConversationContextView | null>; getConversationNeedsReply(conversation: FeatureRow): ServiceResult<boolean>; getLeadOwner(id: string): ServiceResult<TeamMemberView | null>; getDealProbability(deal: FeatureRow): ServiceResult<number>; getDealStage(deal: FeatureRow): ServiceResult<PipelineStageView | null>; getInboxConversations(): ServiceResult<ConversationView[]>; getInboxSummary(): ServiceResult<DashboardOverviewView>; getLeadActivitySummary(id: string): ServiceResult<LeadActivityItem>; getConversationUnreadCount(conversation: FeatureRow): ServiceResult<number>; sendMessage(id: string, input: SendHumanMessageInput): ServiceResult<MessageMutationResult | null>; advanceMessageStatus(id?: string): ServiceResult<MessageMutationResult | null>; retryMessage(id: string): ServiceResult<MessageMutationResult | null>; assignConversation(id: string, ownerId: string): ServiceResult<ConversationView | null>; closeConversation(id: string): ServiceResult<ConversationView | null>; reopenConversation(id: string): ServiceResult<ConversationView | null>;
}
export interface AutomationFeatureService {
  getAutomationRules(): ServiceResult<AutomationRuleView[]>; getAutomationRuns(): ServiceResult<AutomationRunView[]>; getAutomationRunActionExecutions(id: string): ServiceResult<AutomationExecutionResult[]>; getAutomationMetrics(): ServiceResult<DashboardPipelineSummary>; getAutomationRule(id: string): ServiceResult<AutomationRuleView | null>; getAutomationApprovalQueue(): ServiceResult<AutomationApprovalView[]>; getAutomationConditionField(id: string): ServiceResult<AutomationConditionFieldView | null>; formatAutomationCondition(input: AutomationRuleInput): ServiceResult<string>; createAutomationRule(input: AutomationRuleInput): ServiceResult<AutomationRuleView | null>; updateAutomationRule(id: string, input: AutomationRuleInput): ServiceResult<AutomationRuleView | null>; runAutomationNow(input: FeatureRow, actorId?: string): ServiceResult<AutomationExecutionResult | null>; testAutomationRule(id: string, input: FeatureRow): ServiceResult<AutomationExecutionResult | null>; approveAutomationAction(id: string): ServiceResult<AutomationExecutionResult | null>; rejectAutomationAction(id: string): ServiceResult<AutomationExecutionResult | null>; setAutomationRuleStatus(id: string, status: string): ServiceResult<AutomationRuleView | null>;
}
export interface SettingsFeatureService {
  getWorkspace(): ServiceResult<WorkspaceSettingsView>; getCurrentWorkspaceUser(): ServiceResult<TeamMemberView | null>; listUsers(): ServiceResult<TeamMemberView[]>; setTeamMemberStatus(id: string, status: string): ServiceResult<TeamMemberView | null>; createTeamInvitation(input: TeamInvitationInput): ServiceResult<TeamInvitationView | null>; getNotificationPreferences(): ServiceResult<NotificationSettingsView[]>; getSecuritySettings(): ServiceResult<SecuritySettingsView>; getTeamInvitations(): ServiceResult<TeamInvitationView[]>; getSettingsActivities(): ServiceResult<SettingsActivityView[]>; updateWorkspaceSettings(input: UpdateWorkspaceSettingsInput): ServiceResult<WorkspaceSettingsView>; updateCurrentUserSettings(input: UserSettingsInput): ServiceResult<TeamMemberView>; setNotificationPreference(id: string, input: FeatureRow): ServiceResult<NotificationSettingsView>; updateSecuritySettings(input: SecuritySettingsInput): ServiceResult<SecuritySettingsView | null>;
}
export interface IntegrationFeatureService {
  listIntegrations(): ServiceResult<IntegrationView[]>; getIntegration(id: string): ServiceResult<IntegrationView | null>; getIntegrationActivities(id: string): ServiceResult<IntegrationActivityView[]>; connectIntegration(id: string): ServiceResult<IntegrationMutationResult | null>; disconnectIntegration(id: string): ServiceResult<IntegrationMutationResult | null>; retryIntegration(id: string): ServiceResult<IntegrationMutationResult | null>; updateIntegrationConfiguration(id: string, input: ConnectIntegrationInput): ServiceResult<IntegrationMutationResult | null>;
}

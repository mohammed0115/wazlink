import {
  businesses as legacyBusinesses,
  mockRecords,
  uiState,
  getLead,
  getDeal,
  getConversation,
  getConversationMessages,
  updateLeadStatus,
  updateDeal,
  sendMockMessage,
  getTasksWorkspace,
  getAppointments,
  getDashboardMetrics,
  getUpcomingActivities,
  getInboxConversations,
  getPipelineStageSummary,
  getAutomationMetrics,
  getRevenueSummary,
  completeLeadTask,
  getCurrentSubscription as legacyGetCurrentSubscription,
  getPlan as legacyGetPlan,
  getBillingUsage as legacyGetBillingUsage,
  getBillingActivities as legacyGetBillingActivities,
  changeSubscriptionPlanMock as legacyChangeSubscriptionPlan,
  setSubscriptionCancelAtPeriodEnd as legacySetSubscriptionCancelAtPeriodEnd,
  previewPlanChange as legacyPreviewPlanChange,
  openMockCheckout as legacyOpenMockCheckout,
  getMockCheckoutPreview as legacyGetCheckout,
  updateMockCheckoutInvoice as legacyUpdateCheckoutInvoice,
  continueMockCheckoutPayment as legacyContinueCheckoutPayment,
  completeMockCheckout as legacyConfirmCheckout,
  failMockCheckout as legacyFailCheckout,
  closeMockCheckout as legacyCancelCheckout,
  finishMockCheckoutJourney as legacyFinishCheckoutJourney,
} from "./mock/legacyDataBridge";
import * as analyticsEngine from "@domain/analytics-engine.js";
import * as bridge from "./mock/legacyDataBridge";
import type {
  AnalyticsService, AnalyticsSnapshot, AppointmentService, BusinessService, BusinessSummary, BillingService,
  ConversationDetail, ConversationService, ConversationSummary, DealDetail, DealService,
  DealListItem, LeadDetail, LeadFilters, LeadListItem, LeadService, MessageService,
  TaskService, DashboardService, DiscoveryService, CrmService, PipelineService, MessagingService, AutomationFeatureService, SettingsFeatureService, IntegrationFeatureService, DashboardSnapshot, DiscoveryFilters, DealFilters, ConversationFilters,
  BillingPlan, BillingSubscription, BillingUsageItem, BillingInvoice, BillingPaymentMethod, CheckoutSession, TaskView, TaskMutationResult, AppointmentView, BillingActivity, FeatureRow, DiscoveryJobDetail, DealDetailView, AutomationExecutionResult, SecuritySettingsView, SecuritySettingsInput,
} from "./contracts/services";
import type { EntitlementService } from "./contracts/entitlements";
import { createEntitlementService } from "./entitlementService";
import { createOnboardingServiceFromEntitlements } from "./onboardingService";

const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? value as Record<string, unknown> : {});
const normalizeRow = <T extends { [key: string]: unknown }>(value: unknown): T => asRecord(value) as T;
const normalizeRows = <T extends { [key: string]: unknown }>(value: unknown): T[] => Array.isArray(value) ? value.map((item) => normalizeRow<T>(item)) : [];
const normalizeSecuritySettings = (value: unknown): SecuritySettingsView => {
  const row = asRecord(value);
  return { ...row, dataResidency: row.dataResidency === "external_allowed_mock" ? "external_allowed_mock" : "local_only", externalAiAccess: Boolean(row.externalAiAccess) };
};
const asBusiness = (value: unknown): BusinessSummary => {
  const row = asRecord(value);
  return { id: String(row.id || ""), name: String(row.name || ""), category: row.category as string | undefined, city: row.city as string | undefined, rating: row.rating as number | null | undefined, reviews: row.reviews as number | null | undefined, source: row.source as string | undefined };
};

export const businessService: BusinessService = {
  async list(_filters?: DiscoveryFilters) { return legacyBusinesses.map(asBusiness); },
  async getById(id) { return asBusiness(legacyBusinesses.find((item) => item.id === id) || null); },
};

export const leadService: LeadService = {
  async list(_filters?: LeadFilters) { return (mockRecords.leads || []).map((item: unknown) => asRecord(item) as LeadListItem); },
  async getById(id): Promise<LeadDetail | null> { return (getLead(id) || null) as LeadDetail | null; },
  async updateStatus(input) { return (updateLeadStatus(input.id, input.status) || getLead(input.id) || null) as LeadDetail | null; },
};

export const dealService: DealService = {
  async list(_filters?: DealFilters) { return (mockRecords.deals || []).map((item: unknown) => asRecord(item) as DealListItem); },
  async getById(id): Promise<DealDetail | null> { return (getDeal(id) || null) as DealDetail | null; },
  async updateStatus(input) { return (updateDeal(input.id, { status: input.status }) || getDeal(input.id) || null) as DealDetail | null; },
};

export const conversationService: ConversationService = {
  async list(_filters?: ConversationFilters) { return (mockRecords.conversations || []).map((item: unknown) => asRecord(item) as ConversationSummary); },
  async getById(id): Promise<ConversationDetail | null> { const conversation = getConversation(id); return conversation ? ({ ...(conversation as object), messages: getConversationMessages(id) } as unknown as ConversationDetail) : null; },
};

export const messageService: MessageService = {
  async list(conversationId) { return getConversationMessages(conversationId) as never; },
  async send(input) { return sendMockMessage(input.conversationId, input.body) as never; },
};

export const taskService: TaskService & { getTasksWorkspace: typeof getTasksWorkspace; completeLeadTask: typeof completeLeadTask } = { async list(_filters): Promise<TaskView[]> { return getTasksWorkspace() as TaskView[]; }, async complete(id): Promise<TaskMutationResult> { return { success: Boolean(completeLeadTask(id)), id }; }, getTasksWorkspace, completeLeadTask };
export const appointmentService: AppointmentService & { getAppointments: typeof getAppointments; createAppointment: typeof bridge.createAppointment; getLeadAppointments: typeof bridge.getLeadAppointments } = { async list(_filters): Promise<AppointmentView[]> { return getAppointments() as AppointmentView[]; }, getAppointments, createAppointment: bridge.createAppointment, getLeadAppointments: bridge.getLeadAppointments };
export const analyticsService: AnalyticsService & {
  metricDefinitions: typeof analyticsEngine.analyticsMetricDefinitions; referenceDate: string; activeFilters: typeof analyticsEngine.activeAnalyticsFilters;
  normalizeContext: typeof analyticsEngine.normalizeAnalyticsContext; getOptions: typeof analyticsEngine.getAnalyticsOptions; getFunnel: typeof analyticsEngine.getAnalyticsFunnel;
  getMetricDrilldown: typeof analyticsEngine.getMetricDrilldown; getDataQuality: typeof analyticsEngine.getDataQuality; getJobPerformance: typeof analyticsEngine.getJobPerformance;
  getConversationAnalytics: typeof analyticsEngine.getConversationAnalytics; getAppointmentAnalytics: typeof analyticsEngine.getAppointmentAnalytics; getTaskAnalytics: typeof analyticsEngine.getTaskAnalytics;
  getAutomationAnalytics: typeof analyticsEngine.getAutomationAnalytics; getIntelligenceAnalytics: typeof analyticsEngine.getIntelligenceAnalytics; getAnalyticsExportRows: typeof analyticsEngine.getAnalyticsExportRows;
} = {
  metricDefinitions: analyticsEngine.analyticsMetricDefinitions,
  referenceDate: analyticsEngine.ANALYTICS_REFERENCE_DATE,
  activeFilters: analyticsEngine.activeAnalyticsFilters,
  normalizeContext: analyticsEngine.normalizeAnalyticsContext,
  getOptions: analyticsEngine.getAnalyticsOptions,
  getOverview: analyticsEngine.getAnalyticsOverview,
  getFunnel: analyticsEngine.getAnalyticsFunnel,
  getAttributionTraces: analyticsEngine.getAttributionTraces,
  getMetricDrilldown: analyticsEngine.getMetricDrilldown,
  getSourcePerformance: analyticsEngine.getSourcePerformance,
  getDataQuality: analyticsEngine.getDataQuality,
  getJobPerformance: analyticsEngine.getJobPerformance,
  getConversationAnalytics: analyticsEngine.getConversationAnalytics,
  getAppointmentAnalytics: analyticsEngine.getAppointmentAnalytics,
  getTaskAnalytics: analyticsEngine.getTaskAnalytics,
  getAutomationAnalytics: analyticsEngine.getAutomationAnalytics,
  getIntelligenceAnalytics: analyticsEngine.getIntelligenceAnalytics,
  getAnalyticsExportRows: analyticsEngine.getAnalyticsExportRows,
  async dashboard(): Promise<DashboardSnapshot> { return { metrics: getDashboardMetrics() as unknown as Record<string, number>, updatedAt: new Date().toISOString() }; },
  async overview(): Promise<AnalyticsSnapshot> { const overview = analyticsEngine.getAnalyticsOverview({ dateRange: "all" }); return { funnel: [], revenue: overview.metrics.revenue.value, attributedRevenue: overview.metrics.attributedRevenue.value }; },
};
export const automationService = { async list() { return mockRecords.automations || []; }, async run(id: string) { return id; } };
export const settingsService = { async workspace() { return uiState.workspace; }, async update(input: Record<string, unknown>) { uiState.workspace = { ...uiState.workspace, ...input }; return uiState.workspace; } };

export const workspaceService = {
  getCurrent: () => ({ ...uiState.workspace }),
  update: (patch: Record<string, unknown>) => {
    uiState.workspace = { ...uiState.workspace, ...patch };
    return { ...uiState.workspace };
  },
};

export const sessionService = {
  getSnapshot: () => ({
    signedIn: Boolean(uiState.signedIn),
    onboardingDone: Boolean(uiState.onboardingDone),
    currentUser: (listUsers()[0] as { id?: string; name?: string; role?: string } | undefined)
      ? { id: String((listUsers()[0] as { id?: string }).id || "USR-1001"), name: String((listUsers()[0] as { name?: string }).name || "سارة العمري"), role: String((listUsers()[0] as { role?: string }).role || "مسؤولة النمو") }
      : null,
  }),
  signInMock: () => { uiState.signedIn = true; return sessionService.getSnapshot(); },
  signOutMock: () => { uiState.signedIn = false; return sessionService.getSnapshot(); },
  completeOnboarding: () => { uiState.onboardingDone = true; uiState.signedIn = true; return sessionService.getSnapshot(); },
};

export const themeService = {
  get: (): "light" | "dark" => (uiState.theme === "dark" ? "dark" : "light"),
  set: (theme: "light" | "dark") => { uiState.theme = theme; return theme; },
};

export const notificationService = {
  unreadCount: () => Number(uiState.notifications || 0),
};

// Initial snapshots only: target Features own all subsequent UI mutations locally.
export const getDiscoveryDraftSnapshot = () => ({
  ...uiState.discoveryDraft,
  keywords: [...uiState.discoveryDraft.keywords],
  locations: [...uiState.discoveryDraft.locations],
  filters: { ...uiState.discoveryDraft.filters },
});

export const updateDiscoveryDraft = (patch: { keywords?: string[]; locations?: string[] }) => {
  uiState.discoveryDraft = {
    ...uiState.discoveryDraft,
    ...(patch.keywords ? { keywords: [...patch.keywords] } : {}),
    ...(patch.locations ? { locations: [...patch.locations] } : {}),
  };
  return getDiscoveryDraftSnapshot();
};
export const getDiscoveryListFiltersSnapshot = () => ({ ...uiState.discoveryListFilters });
export const getResultFiltersSnapshot = () => ({ ...uiState.resultFilters });
export const getCrmFiltersSnapshot = () => ({ ...uiState.crmFilters });
export const getDealFiltersSnapshot = () => ({ ...uiState.dealFilters });
export const getScraperExportColumnsSnapshot = () => [...uiState.scraperCrmUi.exportColumns];

export const integrationService = { async list() { return mockRecords.integrations || []; } };
export const billingService: BillingService = {
  plans() { return (mockRecords.plans || []).map((item: unknown) => asRecord(item) as unknown as BillingPlan); },
  currentSubscription() { return legacyGetCurrentSubscription() as unknown as BillingSubscription | null; },
  usage() { return (legacyGetBillingUsage() || []) as unknown as BillingUsageItem[]; },
  activities(): BillingActivity[] { return (legacyGetBillingActivities() || []) as BillingActivity[]; },
  invoices() { return [...(mockRecords.invoices || [])] as unknown as BillingInvoice[]; },
  paymentMethods() { return [...(mockRecords.paymentMethods || [])] as unknown as BillingPaymentMethod[]; },
  previewPlanChange(input) { return legacyPreviewPlanChange(input.planId); },
  changePlan(planId) { return legacyChangeSubscriptionPlan(planId); },
  setCancelAtPeriodEnd(value) { return legacySetSubscriptionCancelAtPeriodEnd(value); },
  startCheckout(input = {}) {
    const defaultPlanId = String(input.planId || (mockRecords.plans?.[0] as { id?: string } | undefined)?.id || "PLAN-GROWTH");
    legacyOpenMockCheckout({ ...input, planId: defaultPlanId });
    return legacyGetCheckout() as unknown as CheckoutSession | null;
  },
  getCheckout() { return legacyGetCheckout() as unknown as CheckoutSession | null; },
  updateCheckoutInvoice(input) { return legacyUpdateCheckoutInvoice({ companyName: input.companyName, email: input.billingEmail, vatNumber: input.taxNumber }) as unknown as CheckoutSession | null; },
  continueCheckoutPayment(paymentMethodId) { legacyContinueCheckoutPayment(paymentMethodId); return legacyGetCheckout() as unknown as CheckoutSession | null; },
  confirmCheckout() { legacyConfirmCheckout(); return legacyGetCheckout() as unknown as CheckoutSession | null; },
  failCheckout(reason) { legacyFailCheckout(reason); return legacyGetCheckout() as unknown as CheckoutSession | null; },
  cancelCheckout() { legacyCancelCheckout(); },
  finishCheckoutJourney() { return legacyFinishCheckoutJourney(); },
};
export const entitlementService: EntitlementService = createEntitlementService(billingService);
export const onboardingService = createOnboardingServiceFromEntitlements(entitlementService);
// Compatibility selectors: consumers receive snapshots through named service functions,
// while the legacy bridge remains the only source of mutable mock truth.
export const listUsers = () => [...(mockRecords.users || [])];
export const listLeads = () => [...(mockRecords.leads || [])];
export const listDeals = () => [...(mockRecords.deals || [])];
export const listConversations = () => [...(mockRecords.conversations || [])];
export const listSignals = () => [...(mockRecords.signals || [])];
export const listDiscoverySources = () => [...(mockRecords.discoverySources || [])];
export const listIntegrations = () => [...(mockRecords.integrations || [])];
export const listPlans = () => [...(mockRecords.plans || [])];
export const listInvoices = () => [...(mockRecords.invoices || [])];
export const listPaymentMethods = () => [...(mockRecords.paymentMethods || [])];
export const listQuickReplyTemplates = () => [...(mockRecords.quickReplyTemplates || [])];
export const listServiceCatalog = () => [...(mockRecords.serviceCatalog || [])];

export {
  listBusinesses,
  listDiscoveryJobs,
  navItems,
  getDashboardOverview,
  scraperCrmPackages,
  checkoutOffers,
  scraperExportColumns,
  discoverySourceOptions,
  discoveryStatusLabels,
  DISCOVERY_REFERENCE_DATE,
  getUpcomingActivities,
  getRevenueAttribution,
  getRevenueSummary,
  getDashboardMetrics,
  getAttributionIntegrityReport,
  getDiscoveryJob,
  getDiscoverySource,
  isDiscoveryResultsAvailable,
  isDiscoveryJobToday,
  isDiscoveryJobRecent,
  formatDiscoveryJobCreatedAt,
  getJobResults,
  getDiscoveryCombinations,
  getNextDiscoveryJobId,
  getNextBusinessId,
  getJobStatusLabel,
  createDiscoveryJob,
  startDiscoveryJob,
  progressDiscoveryJob,
  completeDiscoveryJob,
  cancelDiscoveryJob,
  retryDiscoveryJob,
  getDiscoveryIntegrityReport,
  leadStatusLabels,
  leadPriorityLabels,
  CRM_REFERENCE_TIME,
  CRM_ACTOR_ID,
  getLead,
  getLeadByBusinessId,
  getLeadOwner,
  getLeadCompany,
  getLeadContacts,
  getLeadNotes,
  getLeadTasks,
  getLeadActivities,
  getLeadActivitySummary,
  getLeadDeals,
  getLeadConversations,
  conversationStatusLabels,
  messageDeliveryLabels,
  S7_REFERENCE_TIME,
  getConversation,
  getConversationMessages,
  getConversationLatestMessage,
  getConversationUnreadCount,
  getConversationNeedsReply,
  getConversationContact,
  getConversationLead,
  getConversationBusiness,
  getConversationActivities,
  getConversationContext,
  getInboxSummary,
  getInboxConversations,
  markConversationRead,
  sendMessage,
  advanceMessageStatus,
  retryMessage,
  closeConversation,
  reopenConversation,
  assignConversation,
  refreshLeadActivityDates,
  getCrmSummary,
  convertBusinessToLead,
  assignLeadOwner,
  updateLeadStatus,
  updateLeadPriority,
  addLeadNote,
  addLeadTask,
  completeLeadTask,
  getLeadIntegrityReport,
  dealStatusLabels,
  dealLossReasons,
  getPipeline,
  getPipelineStages,
  getDeal,
  getDealStage,
  getDealProbability,
  isDealProbabilityManual,
  getOpenDealsForLead,
  getOpenDealForLead,
  getDealLead,
  getDealBusiness,
  getDealActivities,
  getDealTasks,
  getOpenPipelineMetrics,
  getPipelineMetrics,
  getPipelineStageSummary,
  createDeal,
  updateDeal,
  moveDealStage,
  closeDealAsWon,
  closeDealAsLost,
  getDealIntegrityReport,
  automationRuleStatusLabels,
  automationRunStatusLabels,
  automationActionStatusLabels,
  appointmentStatusLabels,
  appointmentTypeLabels,
  appointmentLocationLabels,
  automationTriggerCatalog,
  automationOperators,
  automationConditionFieldCatalog,
  automationOperatorLabels,
  automationActionCatalog,
  forbiddenAutomationActions,
  automationApprovalPolicies,
  AUTOMATION_REFERENCE_TIME,
  getAutomationConditionField,
  validateAutomationCondition,
  validateAutomationConditionGroup,
  formatAutomationCondition,
  getAutomationRule,
  getAutomationRules,
  getAutomationRuns,
  getAutomationRunActionExecutions,
  getAutomationApprovalQueue,
  getAutomationMetrics,
  getAppointment,
  getLeadAppointments,
  getDealAppointments,
  getAppointments,
  getTasksWorkspace,
  buildAutomationContext,
  evaluateAutomationCondition,
  evaluateAutomationConditions,
  canAutomationExecute,
  createAutomationRule,
  updateAutomationRule,
  setAutomationRuleStatus,
  testAutomationRule,
  evaluateAutomationRule,
  runAutomationNow,
  createAppointment,
  executeAutomationAction,
  approveAutomationAction,
  rejectAutomationAction,
  getAutomationIntegrityReport,
  integrationStatusLabels,
  notificationCategoryLabels,
  notificationChannelLabels,
  workspaceTimezones,
  workspaceCurrencies,
  workspaceLocales,
  getWorkspace,
  getCurrentWorkspaceUser,
  getNotificationPreferences,
  getSettingsActivities,
  getSecuritySettings,
  getTeamInvitations,
  updateWorkspaceSettings,
  updateCurrentUserSettings,
  setTeamMemberStatus,
  createTeamInvitation,
  setNotificationPreference,
  updateSecuritySettings,
  getIntegration,
  getIntegrationActivities,
  connectIntegration,
  disconnectIntegration,
  updateIntegrationConfiguration,
  retryIntegration,
  getCurrentSubscription,
  getPlan,
  getBillingActivities,
  getBillingUsage,
  getPlanChangePreview,
  previewPlanChange,
  changeSubscriptionPlan,
  setSubscriptionCancelAtPeriodEnd,
  getCheckoutOffer,
  isCheckoutPaid,
  startCheckout,
  updateCheckoutInvoice,
  continueCheckoutPayment,
  getCheckout,
  failCheckout,
  confirmCheckout,
  finishCheckoutJourney,
  cancelCheckout,
  getPaymentCheckoutIntegrityReport,
  getS11IntegrityReport,
  getAutomationConditionGroups,
  getAutomationActions,
} from "./data";
export type { DashboardOverview } from "./data";
export * from "./contracts/services";
export * from "./contracts/entitlements";
export * from "./contracts/repositories";


const clone = <T>(value: T): T => value;

export const dashboardService = {
  getDashboardOverview: () => bridge.dashboardData, getUpcomingActivities, getInboxConversations, getPipelineStageSummary, getAutomationMetrics,
  listBusinesses: () => legacyBusinesses.map(asBusiness), listDiscoveryJobs: () => bridge.jobs.map(clone),
};
export const discoveryService = {
  listDiscoveryJobs: () => bridge.jobs.map(clone), getDiscoveryJob: (id?: string) => id ? bridge.getDiscoveryJob(id) : null, createDiscoveryJob: (input: FeatureRow, _options?: FeatureRow) => normalizeRow<DiscoveryJobDetail>(bridge.createDiscoveryJob(input)), startDiscoveryJob: (id?: string) => normalizeRow<DiscoveryJobDetail>(bridge.startDiscoveryJob(id || "")), progressDiscoveryJob: (id?: string, _step?: number) => normalizeRow<DiscoveryJobDetail>(bridge.progressDiscoveryJob(id || "")), completeDiscoveryJob: (id?: string) => normalizeRow<DiscoveryJobDetail>(bridge.completeDiscoveryJob(id || "")), cancelDiscoveryJob: (id?: string) => normalizeRow<DiscoveryJobDetail>(bridge.cancelDiscoveryJob(id || "")), retryDiscoveryJob: (id?: string) => normalizeRow<DiscoveryJobDetail>(bridge.retryDiscoveryJob(id || "")), getJobResults: (id?: string) => normalizeRows(bridge.getJobResults(id || "")), getDiscoverySource: bridge.getDiscoverySource, getDiscoveryCombinations: bridge.getDiscoveryCombinations,
};
export const crmService = {
  listBusinesses: () => legacyBusinesses.map(asBusiness), listLeads: () => bridge.mockRecords.leads.map(clone), getCrmFiltersSnapshot, getCrmSummary: bridge.getCrmSummary, getLead: bridge.getLead, getLeadByBusinessId: (id: string) => bridge.getLeadByBusinessId(id) || null, getLeadActivities: bridge.getLeadActivities, getLeadContacts: bridge.getLeadContacts, getLeadConversations: bridge.getLeadConversations, getLeadDeals: (id: string) => normalizeRows<DealDetailView>(bridge.getLeadDeals(id)), getLeadOwner: bridge.getLeadOwner, getLeadActivitySummary: bridge.getLeadActivitySummary, getLeadAppointments: bridge.getLeadAppointments, getLeadNotes: bridge.getLeadNotes, getLeadTasks: bridge.getLeadTasks, addLeadNote: bridge.addLeadNote, addLeadTask: bridge.addLeadTask, convertBusinessToLead: bridge.convertBusinessToLead, updateLeadStatus: bridge.updateLeadStatus, updateLeadPriority: bridge.updateLeadPriority, assignLeadOwner: bridge.assignLeadOwner,
};
export const pipelineService = {
  listDeals: () => normalizeRows(bridge.mockRecords.deals), listBusinesses: () => legacyBusinesses.map(asBusiness), listLeads: () => bridge.mockRecords.leads.map(clone), getDeal: bridge.getDeal, getDealLead: bridge.getDealLead, getDealBusiness: bridge.getDealBusiness, getDealStage: bridge.getDealStage, getDealProbability: bridge.getDealProbability, getDealActivities: bridge.getDealActivities, getDealTasks: bridge.getDealTasks, getLeadDeals: (id: string) => normalizeRows<DealDetailView>(bridge.getLeadDeals(id)), getOpenDealsForLead: bridge.getOpenDealsForLead, getOpenDealForLead: bridge.getOpenDealForLead, getPipeline: bridge.getPipeline, getPipelineMetrics: bridge.getPipelineMetrics, getPipelineStageSummary: bridge.getPipelineStageSummary, getPipelineStages: bridge.getPipelineStages, moveDealStage: bridge.moveDealStage, createDeal: bridge.createDeal, updateDeal: bridge.updateDeal, closeDealAsWon: bridge.closeDealAsWon, closeDealAsLost: bridge.closeDealAsLost, getLeadActivitySummary: bridge.getLeadActivitySummary, getDealFiltersSnapshot,
};
export const messagingService = {
  listUsers: () => bridge.mockRecords.users.map(clone), listConversations: () => bridge.mockRecords.conversations.map(clone), getConversation: bridge.getConversation, getConversationMessages: bridge.getConversationMessages, getConversationLatestMessage: bridge.getConversationLatestMessage, getConversationNeedsReply: bridge.getConversationNeedsReply, getConversationUnreadCount: bridge.getConversationUnreadCount, getConversationContact: bridge.getConversationContact, getConversationBusiness: bridge.getConversationBusiness, getConversationContext: bridge.getConversationContext, getLeadContacts: bridge.getLeadContacts, getLeadConversations: bridge.getLeadConversations, getInboxConversations: bridge.getInboxConversations, getInboxSummary: bridge.getInboxSummary, sendMessage: bridge.sendMockMessage, advanceMessageStatus: bridge.advanceMockMessageStatus, retryMessage: bridge.retryMockMessage, assignConversation: bridge.assignConversation, closeConversation: bridge.closeConversation, reopenConversation: bridge.reopenConversation, getLeadActivitySummary: bridge.getLeadActivitySummary, getLeadOwner: bridge.getLeadOwner, getDealProbability: bridge.getDealProbability, getDealStage: bridge.getDealStage,
};
export const automationFeatureService = {
  getAutomationRules: bridge.getAutomationRules, getAutomationRuns: bridge.getAutomationRuns, getAutomationRule: bridge.getAutomationRule, getAutomationApprovalQueue: bridge.getAutomationApprovalQueue, getAutomationRunActionExecutions: bridge.getAutomationRunActionExecutions, getAutomationMetrics: bridge.getAutomationMetrics, runAutomationNow: (input: FeatureRow, actorId?: string) => normalizeRow<AutomationExecutionResult>(bridge.runAutomationNow(input, actorId)), testAutomationRule: (id: string, input: FeatureRow) => normalizeRow<AutomationExecutionResult>(bridge.testAutomationRule(id, input)), approveAutomationAction: (id: string, actorId?: string) => normalizeRow<AutomationExecutionResult>(bridge.approveAutomationAction(id, actorId)), rejectAutomationAction: (id: string, actorId?: string) => normalizeRow<AutomationExecutionResult>(bridge.rejectAutomationAction(id, actorId)), setAutomationRuleStatus: bridge.setAutomationRuleStatus, createAutomationRule: bridge.createAutomationRule, updateAutomationRule: bridge.updateAutomationRule, getAutomationConditionField: (id: string) => bridge.getAutomationConditionField(id) || null, formatAutomationCondition: bridge.formatAutomationCondition,
};
export const settingsFeatureService = {
  getWorkspace: bridge.getWorkspace, getCurrentWorkspaceUser: bridge.getCurrentWorkspaceUser, getNotificationPreferences: bridge.getNotificationPreferences, getSecuritySettings: () => normalizeSecuritySettings(bridge.getSecuritySettings()), getTeamInvitations: bridge.getTeamInvitations, getSettingsActivities: bridge.getSettingsActivities, updateWorkspaceSettings: (input: FeatureRow) => bridge.updateWorkspaceSettings(input) || {}, updateCurrentUserSettings: bridge.updateCurrentUserSettings, setNotificationPreference: bridge.setNotificationPreference, setTeamMemberStatus: bridge.setTeamMemberStatus, createTeamInvitation: bridge.createTeamInvitation, updateSecuritySettings: (input: SecuritySettingsInput) => normalizeSecuritySettings(bridge.updateSecuritySettings(input)), listUsers: () => bridge.mockRecords.users.map(clone),
};
export const integrationFeatureService = {
  listIntegrations: () => bridge.mockRecords.integrations.map(clone), getIntegration: bridge.getIntegration, getIntegrationActivities: bridge.getIntegrationActivities, connectIntegration: bridge.connectIntegrationMock, disconnectIntegration: bridge.disconnectIntegrationMock, retryIntegration: bridge.retryIntegrationMock, updateIntegrationConfiguration: bridge.updateIntegrationConfiguration,
};

const _typedFeatureServiceContracts: [DashboardService, DiscoveryService, CrmService, PipelineService, MessagingService, AutomationFeatureService, SettingsFeatureService, IntegrationFeatureService] = [
  dashboardService,
  discoveryService,
  crmService,
  pipelineService,
  messagingService,
  automationFeatureService,
  settingsFeatureService,
  integrationFeatureService,
];
void _typedFeatureServiceContracts;

export type { SecuritySettingsInput } from "./contracts/services";

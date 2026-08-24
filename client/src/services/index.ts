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
import type {
  AnalyticsService, AnalyticsSnapshot, AppointmentService, BusinessService, BusinessSummary, BillingService,
  ConversationDetail, ConversationService, ConversationSummary, DealDetail, DealService,
  DealListItem, LeadDetail, LeadFilters, LeadListItem, LeadService, MessageService,
  TaskService, DashboardSnapshot, DiscoveryFilters, DealFilters, ConversationFilters,
  BillingPlan, BillingSubscription, BillingUsageItem, BillingInvoice, BillingPaymentMethod, CheckoutSession,
} from "./contracts/services";

const asRecord = (value: unknown): Record<string, unknown> => (value && typeof value === "object" ? value as Record<string, unknown> : {});
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

export const taskService: TaskService = { async list(_filters) { return getTasksWorkspace() as unknown[]; }, async complete(id) { return completeLeadTask(id) || id; } };
export const appointmentService: AppointmentService = { async list(_filters) { return getAppointments() as unknown[]; } };
export const analyticsService: AnalyticsService & Record<string, unknown> = {
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
  activities() { return (legacyGetBillingActivities() || []) as unknown[]; },
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
export * from "./contracts/repositories";

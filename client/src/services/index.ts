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
} from "./data";
import { getAnalyticsOverview } from "@domain/analytics-engine.js";
import type {
  AnalyticsService, AnalyticsSnapshot, AppointmentService, BusinessService, BusinessSummary,
  ConversationDetail, ConversationService, ConversationSummary, DealDetail, DealService,
  DealListItem, LeadDetail, LeadFilters, LeadListItem, LeadService, MessageService,
  TaskService, DashboardSnapshot, DiscoveryFilters, DealFilters, ConversationFilters,
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
export const analyticsService: AnalyticsService = {
  async dashboard(): Promise<DashboardSnapshot> { return { metrics: getDashboardMetrics() as unknown as Record<string, number>, updatedAt: new Date().toISOString() }; },
  async overview(): Promise<AnalyticsSnapshot> { const overview = getAnalyticsOverview({ dateRange: "all" }); return { funnel: [], revenue: overview.metrics.revenue.value, attributedRevenue: overview.metrics.attributedRevenue.value }; },
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
export const integrationService = { async list() { return mockRecords.integrations || []; } };
export const billingService = { async plans() { return mockRecords.plans || []; } };

// Compatibility selectors: consumers receive snapshots through named service functions,
// while the legacy bridge remains the only source of mutable mock truth.
export const getUiState = () => uiState;
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

export * from "./data";
export * from "./contracts/services";
export * from "./contracts/repositories";

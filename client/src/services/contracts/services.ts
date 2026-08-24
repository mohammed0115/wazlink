import type { Conversation, Deal, Lead, Message } from "@domain/types.js";

export type SortDirection = "asc" | "desc";
export type LeadFilters = { search?: string; status?: string; ownerId?: string; sortBy?: "updatedAt" | "score"; sortDirection?: SortDirection };
export type DealFilters = { search?: string; status?: string; stageId?: string; sortBy?: "updatedAt" | "value"; sortDirection?: SortDirection };
export type ConversationFilters = { search?: string; status?: string; channel?: string; sortBy?: "updatedAt" | "lastMessageAt"; sortDirection?: SortDirection };
export type DiscoveryFilters = { search?: string; city?: string; rating?: string; website?: string; phone?: string };

export interface AppServiceError { code: string; message: string; field?: string; retryable?: boolean; }
export type BusinessSummary = { id: string; name: string; category?: string; city?: string; rating?: number | null; reviews?: number | null; source?: string };
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

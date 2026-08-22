/**
 * جذر تطبيق «نمو».
 *
 * جدول التوجيه منقول حرفيًا عن `renderPage()` في `client/js/app.js`،
 * بما فيه الـaliases التاريخية (`leads`, `whatsapp`, `job`, `results`,
 * `integrations`, `billing`) كي لا ينكسر أي رابط موثق في `ROUTES.md`.
 */
import { useEffect } from "react";
import { markConversationRead, state } from "@domain/data.js";
import { isPublicRoute, useHashRoute } from "./shared/router/useHashRoute";
import { useAppState } from "./shared/store/appStore";
import { ToastProvider } from "./shared/store/toast";
import { AppShell } from "./shared/shell/AppShell";
import { routeLabel, settingsRouteLabels } from "./shared/shell/routeMeta";
import { Placeholder } from "./shared/components/Placeholder";
import { ErrorBoundary } from "./shared/components/ErrorBoundary";
import { Landing } from "./features/landing/Landing";
import { Login } from "./features/auth/Login";
import { Onboarding } from "./features/auth/Onboarding";
import { Dashboard } from "./features/dashboard/Dashboard";
import { UiKit } from "./features/ui-kit/UiKit";
import { Discovery } from "./features/discovery/Discovery";
import { DiscoveryJobs } from "./features/discovery/DiscoveryJobs";
import { DiscoveryJob } from "./features/discovery/DiscoveryJob";
import { DiscoveryModal } from "./features/discovery/DiscoveryModal";
import { DiscoveryResults } from "./features/intelligence/DiscoveryResults";
import { Intelligence } from "./features/intelligence/Intelligence";
import { IntelligenceModal } from "./features/intelligence/IntelligenceModal";
import { IntelligenceProcessing } from "./features/intelligence/IntelligenceProcessing";
import { Crm } from "./features/crm/Crm";
import { Lead360 } from "./features/crm/Lead360";
import { CrmModal } from "./features/crm/CrmModal";
import { Pipeline } from "./features/sales/Pipeline";
import { Deals } from "./features/sales/Deals";
import { Deal360 } from "./features/sales/Deal360";
import { DealModal } from "./features/sales/DealModal";
import { Inbox } from "./features/inbox/Inbox";
import { Copilot } from "./features/ai/Copilot";
import { Agent } from "./features/ai/Agent";
import { Automation } from "./features/automation/Automation";
import { Tasks } from "./features/automation/Tasks";
import { Appointments } from "./features/automation/Appointments";
import { AutomationModal } from "./features/automation/AutomationModal";
import { AppointmentModal } from "./features/automation/AppointmentModal";
import { Analytics } from "./features/analytics/Analytics";
import { AnalyticsModal } from "./features/analytics/AnalyticsModal";
import { Settings } from "./features/settings/Settings";
import { Integrations } from "./features/settings/Integrations";
import { Billing } from "./features/settings/Billing";
import { Checkout } from "./features/settings/Checkout";

/** المسارات المعروفة التي تعرض Placeholder المنتج (غير منفذة أصلًا في V1). */
const productPlaceholders = new Set(["contacts", "companies", "calls"]);

function Page({ path, query }: { path: string; query: URLSearchParams }) {
  if (path === "dashboard") return <Dashboard />;
  if (path === "ui-kit") return <UiKit />;

  // S3 — الاكتشاف، مع aliases التاريخية من ROUTES.md
  if (path === "discovery") return <Discovery />;
  if (path === "discovery/jobs" || path === "discovery-jobs") return <DiscoveryJobs />;
  if (path.startsWith("discovery/jobs/")) return <DiscoveryJob jobId={path.split("/").pop() as string} />;
  if (path === "job") return <DiscoveryJob jobId={state.selectedJobId} />;

  // S4 — النتائج والذكاء
  if (path === "discovery/results" || path === "results") return <DiscoveryResults jobId={state.selectedJobId} />;
  if (path === "intelligence" || path === "lead-profile") return <Intelligence businessId={state.selectedBusinessId} />;

  // S5 — CRM وملف Lead 360
  if (path === "crm" || path === "leads") return <Crm />;
  if (path.startsWith("crm/leads/")) return <Lead360 leadId={path.split("/").pop() as string} />;

  // S6 — Pipeline والصفقات
  if (path === "pipeline") return <Pipeline />;
  if (path === "deals") return <Deals />;
  if (path.startsWith("deals/")) return <Deal360 dealId={path.split("/").pop() as string} />;

  // S7 — صندوق الوارد وواتساب التجريبي
  if (path === "inbox" || path === "whatsapp") return <Inbox />;
  if (path.startsWith("inbox/")) return <Inbox conversationId={path.split("/").pop() as string} />;

  // S8 — Copilot وAgent
  if (path === "copilot") return <Copilot />;
  if (path === "agent") return <Agent />;

  // S9 — الأتمتة والمهام والمواعيد
  if (path === "automation") return <Automation />;
  if (path.startsWith("automation/rules/")) return <Automation ruleId={path.split("/").pop() as string} />;
  if (path === "tasks") return <Tasks />;
  if (path === "appointments") return <Appointments />;

  // S10 — التحليلات وأقسامها الستة
  if (path === "analytics") return <Analytics />;
  if (path.startsWith("analytics/")) return <Analytics section={path.split("/")[1]} />;

  // S11 — الإعدادات والتكاملات والفوترة (canonical + aliases)
  if (path === "integrations" || path === "settings/integrations") return <Integrations />;
  if (path === "billing" || path === "settings/billing") return <Billing />;
  if (path === "settings") return <Settings />;
  if (path.startsWith("settings/")) return <Settings section={path.split("/")[1]} />;
  if (productPlaceholders.has(path)) return <Placeholder route={path} />;

  void query;
  return <Placeholder route={path} />;
}

export default function App() {
  const { path, query } = useHashRoute();
  useAppState();

  // مقابل `syncDiscoveryRouteContext()`: يثبّت السجل المختار من المسار قبل الرسم.
  const jobParam = query.get("job");
  const businessParam = query.get("business");
  if (jobParam) state.selectedJobId = jobParam;
  if (businessParam) state.selectedBusinessId = businessParam;
  if (path.startsWith("discovery/jobs/")) state.selectedJobId = path.split("/").pop() as string;
  if (path.startsWith("crm/leads/")) state.selectedLeadId = path.split("/").pop() as string;
  if (path.startsWith("deals/")) state.selectedDealId = path.split("/").pop() as string;
  if (path.startsWith("settings/")) {
    const section = path.split("/")[1];
    if (settingsRouteLabels[section]) state.s11Ui = { ...state.s11Ui, settingsSection: section };
  } else if (path === "settings") {
    state.s11Ui = { ...state.s11Ui, settingsSection: "workspace" };
  }
  if (path.startsWith("inbox/")) {
    state.selectedConversationId = path.split("/").pop() as string;
    markConversationRead(state.selectedConversationId);
  }

  useEffect(() => {
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    document.documentElement.dataset.theme = state.theme;
  });

  if (path === "landing" || path === "") {
    return (
      <ToastProvider>
        <Landing />
      </ToastProvider>
    );
  }

  if (isPublicRoute(path)) {
    return <ToastProvider>{path === "login" ? <Login /> : <Onboarding />}</ToastProvider>;
  }

  return (
    <ToastProvider>
      <AppShell route={path}>
        <ErrorBoundary key={path}>
          <Page path={path} query={query} />
        </ErrorBoundary>
      </AppShell>
      <DiscoveryModal />
      <IntelligenceModal />
      <IntelligenceProcessing />
      <CrmModal />
      <DealModal />
      <AutomationModal />
      <AppointmentModal />
      <AnalyticsModal />
      <Checkout />
    </ToastProvider>
  );
}

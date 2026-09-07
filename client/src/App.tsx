/**
 * جذر تطبيق «نمو».
 *
 * التوجيه ما زال Hash Router واحدًا متوافقًا مع V1، بينما تُحمّل صفحات
 * المناطق الثقيلة عند الحاجة لتقليل الحزمة الأولية. لا يوجد هنا Backend أو
 * تكامل شبكة؛ مصدر البيانات الحالي يمر عبر adapter الخدمات.
 */
import { lazy, Suspense, useEffect } from "react";
import { useSession, useTheme } from "./shared/context/AppProviders";
import { appConfig } from "./config/env";
import { go, isPublicRoute, useHashRoute } from "./shared/router/useHashRoute";
import { ToastProvider } from "./shared/store/toast";
import { AppShell } from "./shared/shell/AppShell";
import { settingsRouteLabels } from "./shared/shell/routeMeta";
import { Placeholder } from "./shared/components/Placeholder";
import { ErrorBoundary } from "./shared/components/ErrorBoundary";
import { RequireAuth } from "./shared/components/RequireAuth";
import { LoadingState } from "./shared/components/States";
import { DiscoveryModal } from "./features/discovery/DiscoveryModal";
import { IntelligenceModal } from "./features/intelligence/IntelligenceModal";
import { IntelligenceProcessing } from "./features/intelligence/IntelligenceProcessing";
import { AutomationModal } from "./features/automation/AutomationModal";
import { AppointmentModal } from "./features/automation/AppointmentModal";
import { AnalyticsModal } from "./features/analytics/AnalyticsModal";
import { Checkout } from "./features/settings/Checkout";

const Landing = lazy(() => import("./features/landing/Landing").then(({ Landing: Component }) => ({ default: Component })));
const Login = lazy(() => import("./features/auth/Login").then(({ Login: Component }) => ({ default: Component })));
const Onboarding = lazy(() => import("./features/auth/Onboarding").then(({ Onboarding: Component }) => ({ default: Component })));
// --- Live CRM (real API + PostgreSQL). These replace the mock CRM screens. ---
const CrmDashboardPage = lazy(() => import("./features/crm/CrmDashboardPage").then(({ CrmDashboardPage: Component }) => ({ default: Component })));
const LeadsPage = lazy(() => import("./features/crm/LeadsPage").then(({ LeadsPage: Component }) => ({ default: Component })));
const Lead360Page = lazy(() => import("./features/crm/Lead360Page").then(({ Lead360Page: Component }) => ({ default: Component })));
const CustomersPage = lazy(() => import("./features/crm/CustomersPage").then(({ CustomersPage: Component }) => ({ default: Component })));
const Customer360Page = lazy(() => import("./features/crm/Customer360Page").then(({ Customer360Page: Component }) => ({ default: Component })));
const ContactsPage = lazy(() => import("./features/crm/ContactsPage").then(({ ContactsPage: Component }) => ({ default: Component })));
const ImportPage = lazy(() => import("./features/crm/ImportPage").then(({ ImportPage: Component }) => ({ default: Component })));
const TasksPage = lazy(() => import("./features/crm/TasksPage").then(({ TasksPage: Component }) => ({ default: Component })));
const DealsPage = lazy(() => import("./features/sales/DealsPage").then(({ DealsPage: Component }) => ({ default: Component })));
const PipelinePage = lazy(() => import("./features/sales/PipelinePage").then(({ PipelinePage: Component }) => ({ default: Component })));
const Deal360Page = lazy(() => import("./features/sales/Deal360Page").then(({ Deal360Page: Component }) => ({ default: Component })));
const InboxPage = lazy(() => import("./features/inbox/InboxPage").then(({ InboxPage: Component }) => ({ default: Component })));
const UiKit = lazy(() => import("./features/ui-kit/UiKit").then(({ UiKit: Component }) => ({ default: Component })));
const Discovery = lazy(() => import("./features/discovery/Discovery").then(({ Discovery: Component }) => ({ default: Component })));
const DiscoveryJobs = lazy(() => import("./features/discovery/DiscoveryJobs").then(({ DiscoveryJobs: Component }) => ({ default: Component })));
const DiscoveryJob = lazy(() => import("./features/discovery/DiscoveryJob").then(({ DiscoveryJob: Component }) => ({ default: Component })));
const DiscoveryResults = lazy(() => import("./features/intelligence/DiscoveryResults").then(({ DiscoveryResults: Component }) => ({ default: Component })));
const Intelligence = lazy(() => import("./features/intelligence/Intelligence").then(({ Intelligence: Component }) => ({ default: Component })));
const Copilot = lazy(() => import("./features/ai/Copilot").then(({ Copilot: Component }) => ({ default: Component })));
const Agent = lazy(() => import("./features/ai/Agent").then(({ Agent: Component }) => ({ default: Component })));
const Automation = lazy(() => import("./features/automation/Automation").then(({ Automation: Component }) => ({ default: Component })));
const Appointments = lazy(() => import("./features/automation/Appointments").then(({ Appointments: Component }) => ({ default: Component })));
const Analytics = lazy(() => import("./features/analytics/Analytics").then(({ Analytics: Component }) => ({ default: Component })));
const Settings = lazy(() => import("./features/settings/Settings").then(({ Settings: Component }) => ({ default: Component })));
const Integrations = lazy(() => import("./features/settings/Integrations").then(({ Integrations: Component }) => ({ default: Component })));
const Billing = lazy(() => import("./features/settings/Billing").then(({ Billing: Component }) => ({ default: Component })));

/** المسارات المعروفة التي تعرض Placeholder المنتج (غير منفذة أصلًا في V1). */
const productPlaceholders = new Set(["contacts", "companies", "calls"]);

function Page({ path, query }: { path: string; query: URLSearchParams }) {
  if (path === "dashboard") return <RequireAuth><CrmDashboardPage /></RequireAuth>;
  if (path === "ui-kit") return <UiKit />;

  // S3 — الاكتشاف، مع aliases التاريخية من ROUTES.md
  if (path === "discovery") return <Discovery />;
  if (path === "discovery/jobs" || path === "discovery-jobs") return <DiscoveryJobs />;
  if (path.startsWith("discovery/jobs/")) return <DiscoveryJob jobId={path.split("/").pop() as string} />;
  if (path === "job") return <DiscoveryJob jobId={query.get("job") || ""} />;

  // S4 — النتائج والذكاء
  if (path === "discovery/results" || path === "results") return <DiscoveryResults jobId={query.get("job") || ""} />;
  if (path === "intelligence" || path === "lead-profile") return <Intelligence businessId={query.get("business") || ""} />;

  // S5 — CRM حي على الواجهة الحقيقية.
  // كل مسار هنا يقرأ ويكتب في PostgreSQL عبر Django، ولا يوجد أي مخزون mock.
  if (path === "crm" || path === "leads") return <RequireAuth><LeadsPage /></RequireAuth>;
  if (path.startsWith("crm/leads/"))
    return <RequireAuth><Lead360Page leadRef={decodeURIComponent(path.split("/").pop() as string)} /></RequireAuth>;
  if (path === "crm/customers" || path === "customers") return <RequireAuth><CustomersPage /></RequireAuth>;
  if (path.startsWith("crm/customers/"))
    return <RequireAuth><Customer360Page customerRef={decodeURIComponent(path.split("/").pop() as string)} /></RequireAuth>;
  if (path === "crm/contacts" || path === "contacts") return <RequireAuth><ContactsPage /></RequireAuth>;
  if (path === "crm/import" || path === "imports") return <RequireAuth><ImportPage /></RequireAuth>;

  // S6 — Pipeline والصفقات (حي)
  if (path === "pipeline") return <RequireAuth><PipelinePage /></RequireAuth>;
  if (path === "deals") return <RequireAuth><DealsPage /></RequireAuth>;
  if (path.startsWith("deals/"))
    return <RequireAuth><Deal360Page dealRef={decodeURIComponent(path.split("/").pop() as string)} /></RequireAuth>;

  // S7 — صندوق الوارد (حي)
  if (path === "inbox" || path === "whatsapp") return <RequireAuth><InboxPage /></RequireAuth>;
  if (path.startsWith("inbox/"))
    return <RequireAuth><InboxPage conversationId={decodeURIComponent(path.split("/").pop() as string)} /></RequireAuth>;

  // S8 — Copilot وAgent
  if (path === "copilot") return <Copilot />;
  if (path === "agent") return <Agent />;

  // S9 — الأتمتة والمهام والمواعيد
  if (path === "automation") return <Automation />;
  if (path.startsWith("automation/rules/")) return <Automation ruleId={path.split("/").pop() as string} />;
  if (path === "tasks") return <RequireAuth><TasksPage /></RequireAuth>;
  if (path === "appointments") return <Appointments />;

  // S10 — التحليلات وأقسامها الستة
  if (path === "analytics") return <Analytics />;
  if (path.startsWith("analytics/")) return <Analytics section={path.split("/")[1]} />;

  // S11 — الإعدادات والتكاملات والفوترة (canonical + aliases)
  if (path === "integrations" || path === "settings/integrations") return <Integrations />;
  if (path === "billing" || path === "settings/billing") return <Billing />;
  if (path === "settings") return <Settings />;
  if (path === "settings/billing/checkout") return <Checkout routeMode />;
  if (path.startsWith("settings/")) return <Settings section={path.split("/")[1]} />;
  if (productPlaceholders.has(path)) return <Placeholder route={path} />;

  void query;
  return <Placeholder route={path} />;
}

export default function App() {
  const { path, query } = useHashRoute();
  const queryString = query.toString();
  const { theme } = useTheme();
  const { onboardingDone } = useSession();

  useEffect(() => {
    if (path === "onboarding" && onboardingDone) {
      go("dashboard");
      return;
    }
    document.documentElement.lang = "ar";
    document.documentElement.dir = "rtl";
    document.documentElement.dataset.theme = theme;
    document.documentElement.dataset.appEnv = appConfig.appEnv;
  }, [path, queryString, theme, onboardingDone]);

  const routeContent = (
    <ErrorBoundary key={path}>
      <Suspense fallback={<LoadingState title="جار تحميل الشاشة" />}>
        <Page path={path} query={query} />
      </Suspense>
    </ErrorBoundary>
  );

  if (path === "landing" || path === "") {
    return (
      <ToastProvider>
        <Suspense fallback={<LoadingState title="جار تحميل الصفحة الرئيسية" />}>
          <Landing />
        </Suspense>
      </ToastProvider>
    );
  }

  if (path === "onboarding" && onboardingDone) {
    return <LoadingState title="جار فتح مساحة العمل" />;
  }

  if (isPublicRoute(path)) {
    return (
      <ToastProvider>
        <Suspense fallback={<LoadingState title="جار تحميل الصفحة" />}>
          {path === "login" ? <Login /> : <Onboarding />}
        </Suspense>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <AppShell route={path}>
        {routeContent}
      </AppShell>
      <DiscoveryModal />
      <IntelligenceModal />
      <IntelligenceProcessing />
      <AutomationModal />
      <AppointmentModal />
      <AnalyticsModal />
    </ToastProvider>
  );
}

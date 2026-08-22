/**
 * ربط المسار بعنصر التنقل النشط وبعنوان Breadcrumb.
 * منقول حرفيًا عن `routeNavId()` و`settingsRouteLabels` في نسخة V1،
 * ويحافظ على قاعدة S12: عنصر «الإعدادات» يبقى نشطًا في كل `#/settings/*`.
 */
import { navItems } from "@services/data";

export const settingsRouteLabels: Record<string, string> = {
  workspace: "مساحة العمل",
  account: "الحساب",
  team: "الفريق",
  notifications: "الإشعارات",
  security: "الأمان والخصوصية",
  integrations: "التكاملات",
  billing: "الفوترة",
};

export function routeNavId(route: string): string {
  if (route === "discovery/jobs" || route === "discovery-jobs" || route.startsWith("discovery/jobs/")) return "discovery/jobs";
  if (route === "discovery/results" || route === "results") return "discovery/results";
  if (route.startsWith("crm/leads/")) return "crm";
  if (route.startsWith("deals/")) return "deals";
  if (route.startsWith("inbox/")) return "inbox";
  if (route.startsWith("settings/")) return "settings";
  if (route === "leads") return "crm";
  if (route === "discovery") return "discovery";
  return route;
}

export function routeLabel(route: string): string {
  const labels = Object.fromEntries((navItems as { id: string; label: string }[]).map((item) => [item.id, item.label]));
  const settingsSection = route.startsWith("settings/") ? route.split("/")[1] : null;

  if (route.startsWith("discovery/jobs/")) return "تفاصيل العملية";
  if (route.startsWith("crm/leads/")) return "ملف العميل المحتمل";
  if (route.startsWith("deals/")) return "تفاصيل الصفقة";
  if (route.startsWith("inbox/")) return "المحادثة";
  if (route.startsWith("analytics/")) return "التحليلات";
  if (route.startsWith("settings/")) return settingsRouteLabels[settingsSection ?? ""] || "الإعدادات";
  if (route === "billing") return "الفوترة";
  if (route === "crm") return "إدارة العملاء";
  if (route === "discovery/jobs") return "عمليات الاكتشاف";
  if (route === "discovery/results") return "النتائج";
  return labels[routeNavId(route)] || "الرئيسية";
}

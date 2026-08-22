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

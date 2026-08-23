/**
 * فحص نزاهة تحويل React.
 *
 * يرسم مكوّنات المسارات المحوّلة عبر React SSR ثم يتحقق من أن الترميز
 * الناتج يحافظ على نفس عقود V1: الحقيقة المالية، الهوية، الحدود التجريبية،
 * وRTL. الغرض أن يبقى التحويل قابلًا للإثبات لا مجرد ادعاء بصري.
 */
import { createServer } from "vite";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

const results = [];
const check = (id, pass, detail = "") => results.push({ id, pass: Boolean(pass), detail });

const server = await createServer({
  configFile: false,
  root: new URL("../client", import.meta.url).pathname,
  logLevel: "error",
  resolve: {
    alias: {
      "@": new URL("../client/src", import.meta.url).pathname,
      "@domain": new URL("../client/src/domain", import.meta.url).pathname,
      "@services": new URL("../client/src/services", import.meta.url).pathname,
      "@config": new URL("../client/src/config", import.meta.url).pathname,
      "@shared": new URL("../shared", import.meta.url).pathname,
    },
  },
  plugins: [(await import("@vitejs/plugin-react")).default()],
});

try {
  const [{ Landing }, { Login }, { Onboarding }, { Dashboard }, { Sidebar }, domain, analytics] = await Promise.all([
    server.ssrLoadModule("/src/features/landing/Landing.tsx"),
    server.ssrLoadModule("/src/features/auth/Login.tsx"),
    server.ssrLoadModule("/src/features/auth/Onboarding.tsx"),
    server.ssrLoadModule("/src/features/dashboard/Dashboard.tsx"),
    server.ssrLoadModule("/src/shared/shell/Sidebar.tsx"),
    server.ssrLoadModule("/src/domain/data.js"),
    server.ssrLoadModule("/src/domain/analytics-engine.js"),
  ]);

  const { mockModel } = domain;
  const { getAnalyticsOverview } = analytics;

  // لقطة قبل الرسم لإثبات أن العرض قراءة فقط
  const snapshot = () =>
    JSON.stringify({
      revenueEvents: mockModel.revenueEvents,
      touchpoints: mockModel.attributionTouchpoints,
      leads: mockModel.leads.length,
      deals: mockModel.deals.length,
      messages: mockModel.messages.length,
    });

  const before = snapshot();

  const landing = renderToStaticMarkup(createElement(Landing));
  const login = renderToStaticMarkup(createElement(Login));
  const onboarding = renderToStaticMarkup(createElement(Onboarding));
  const dashboard = renderToStaticMarkup(createElement(Dashboard));
  const sidebar = renderToStaticMarkup(createElement(Sidebar, { route: "dashboard" }));

  const after = snapshot();
  const overview = getAnalyticsOverview({ dateRange: "all" });

  // A — الشاشات ترسم فعليًا
  check("A1 Landing يرسم بلا استثناء", landing.length > 4000, `${landing.length} حرفًا`);
  check("A2 Login يرسم بلا استثناء", login.includes("auth-shell") && login.includes("تسجيل الدخول"));
  check("A3 Onboarding يرسم الخطوة الأولى", onboarding.includes("onboarding-shell") && onboarding.includes("الخطوة"));
  check("A4 Dashboard يرسم لوحة القيادة", dashboard.includes("exec-dashboard") && dashboard.includes("exec-kpi-grid"));

  // B — الحقيقة المالية مطابقة لمحرك S10
  const revenue = new Intl.NumberFormat("ar-SA").format(overview.metrics.revenue.value);
  const attributed = new Intl.NumberFormat("ar-SA").format(overview.metrics.attributedRevenue.value);
  check("B1 الإيراد المعترف به 382,000", overview.metrics.revenue.value === 382000);
  check("B2 الإيراد المنسوب يساوي المعترف به", overview.metrics.revenue.value === overview.metrics.attributedRevenue.value);
  check("B3 Landing يعرض إيراد المحرك نفسه", landing.includes(revenue), revenue);
  check("B4 Landing يعرض الإسناد نفسه", landing.includes(attributed), attributed);
  check("B5 لا يوجد ادعاء 428k القديم", !landing.includes("428") && !landing.includes("٤٢٨"));
  check("B6 Landing يعلن أن الأرقام تجريبية", landing.includes("تجريبي") || landing.includes("بيانات محلية"));

  // C — الهوية التشغيلية
  check("C1 Landing يعرض قصة العميل المتصلة", landing.includes("عيادات الحياة لطب الأسنان"));
  check("C2 Landing لا يعرض الاسم القديم", !landing.includes("عيادات ابتسامة الرياض"));
  check("C3 Landing يربط الشركة بالمحادثة والصفقة", ["شركة", "محادثة", "صفقة", "إيراد"].every((label) => landing.includes(label)));

  // D — الحدود التجريبية معلنة
  check("D1 Landing يفصح أن البيانات تجريبية", landing.includes("تجريبي") || landing.includes("بيانات محلية"));
  check("D2 Login يفصح أنه دخول تجريبي", login.includes("دخول تجريبي"));
  check("D3 Onboarding يفصح بعدم الحفظ الخارجي", onboarding.includes("لا يتم حفظ أي معلومات خارج الذاكرة الحالية"));
  check("D4 Dashboard يفصح event مقابل snapshot", dashboard.includes("لا يطبق نطاق التاريخ") && dashboard.includes("حدث ضمن الفترة"));

  // E — العرض قراءة فقط
  check("E1 الرسم لا يغيّر الكيانات التشغيلية", before === after);

  // F — RTL والوصول
  check("F1 Landing لا يعرض معرفات تقنية داخلية", !/(BUS|LEAD|CONV|DEAL)-\\d{3,}/.test(landing));
  check("F2 كل عنصر تفاعلي زر أو رابط", !/<div[^>]*onclick/i.test(landing + dashboard));
  const navIconCount = (sidebar.match(/class="nav-icon /g) || []).length;
  const hiddenIconCount = (sidebar.match(/class="nav-icon [^"]*" aria-hidden="true"/g) || []).length;
  check(
    "F3 كل أيقونات التنقل aria-hidden",
    navIconCount > 0 && navIconCount === hiddenIconCount,
    `${hiddenIconCount}/${navIconCount}`,
  );
  check("F4 عنصر التنقل النشط يحمل aria-current", sidebar.includes('aria-current="page"'));
  check("F5 Sidebar يعرض كل عناصر التنقل", navIconCount === domain.navItems.length, `${navIconCount} عنصرًا`);
} finally {
  await server.close();
}

const passed = results.filter((result) => result.pass).length;
for (const result of results) {
  console.log(`${result.pass ? "PASS" : "FAIL"}  ${result.id}${result.detail ? ` — ${result.detail}` : ""}`);
}
console.log(`\nverify-react-shell: ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);

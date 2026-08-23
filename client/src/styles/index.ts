/**
 * أنماط «wazlink» — تُستورد بنفس ترتيب `client/index.html` الأصلي حرفيًا،
 * لأن الترتيب جزء من العقد البصري (الملفات المتأخرة تتجاوز المبكرة).
 *
 * لم يتغير أي ملف CSS في التحويل إلى React. الفارق الوحيد أنها صارت
 * تمر عبر Vite بدل وسوم `<link>` المطلقة، وهذا يصلح أيضًا كسر الأنماط
 * في مخرجات `pnpm build` لأن `/css/*.css` لم تكن تُنسخ إلى `dist`.
 */
import "./base.css";
import "./layout.css";
import "./components.css";
import "./pages.css";
import "./s1.css";
import "./s2.css";
import "./s3.css";
import "./s4.css";
import "./s4ux.css";
import "./s5.css";
import "./s6.css";
import "./s7.css";
import "./s8.css";
import "./s9.css";
import "./s10.css";
import "./s11.css";
import "./s11-integrations.css";
import "./s11-billing.css";
import "./scraper-crm.css";
import "./scraper-data-visibility.css";
import "./scraper-reference.css";
import "./payment-checkout.css";
import "./sidebar-semantic-icons.css";
import "./responsive.css";

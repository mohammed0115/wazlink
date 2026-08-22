# MOBILE-RESPONSIVE-FIX — QA Report

**Baseline:** `9d2d805`  
**النطاق:** إصلاح CSS واستجابة UI فقط؛ لا تعديل لبيانات أو عقود تشغيلية أو Revenue/Attribution.

## التشخيص

كانت قواعد الجوال السابقة تمنع overflow العام، لكنها أبقت بعض سطوح العرض الواسعة في حالة تمرير أفقي أو أعمدة صغيرة غير مريحة عند 360px: سلسلة Landing، قمع الإسناد، ملخص Pipeline، وInbox متعدد الأعمدة. كما كان Topbar يحتفظ بعناصر ثانوية كثيرة في مساحة محدودة.

## الإصلاح

أضيف breakpoint عند `540px` في `client/css/responsive.css`. ينتقل Landing إلى بطاقات عمودية قابلة للقراءة، وتتحول سلسلة الكيان وقمع الإسناد وPipeline إلى تدفق أحادي العمود. تتكدس فلاتر Topbar وتختفي الأيقونات الثانوية مع بقاء زر الاكتشاف والقائمة والبحث. يتحول Inbox على الجوال إلى قائمة محادثات قابلة للتمرير ثم pane محادثة، مع إخفاء الفلاتر والسياق الثانويين بدل فرض شبكة 4 أعمدة.

| السطح | التحقق عند 360px | النتيجة |
|---|---|---:|
| Landing | Navigation، Hero، Source-to-Revenue، Business card، chain، attribution | PASS |
| Dashboard | Topbar، decision rail، CTA، KPI cards | PASS |
| Inbox | Topbar، ملخصات، filters والـconversation flow | PASS |
| Analytics | Topbar وواجهة الفلاتر المتسلسلة | PASS |
| البناء | `pnpm build` | PASS |
| Contract regression | `verify-v1-final-fix.mjs` | PASS — 12/12 |
| تنسيق diff | `git diff --check` | PASS |

> يحافظ الإصلاح على Drawer Sidebar ليظهر فقط بعد الإجراء الصريح، ويحصر أي محتوى واسع في سطحه المحلي. لا يغير هذا الإصلاح حقائق التشغيل أو S10 أو مراحل V1/V2.

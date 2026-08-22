# DOCS-CODE-AUDIT — تدقيق مطابقة الوثائق للكود

**Baseline:** `138a727` + شحنة تحويل React
**الطريقة:** فحص آلي قابل للتكرار عبر `scripts/audit-docs-vs-code.mjs` يقرأ العقود من طبقة النطاق مباشرة، لا قراءة انطباعية للنصوص.
**النتيجة الأولى:** 59/65 بوابة — ستة انحرافات.
**بعد الإصلاح:** **69/69 بوابة PASS** — كل الانحرافات مغلقة.
**التحقق:** 18 فحصًا (17 انحدار + المدقّق) يمر في `UTC` و`Asia/Riyadh` و`America/Los_Angeles`.

## ما ثبتت مطابقته

| المجال | ما تم التحقق منه | النتيجة |
|---|---|---:|
| بادئات المعرفات | 16 مجموعة كيانات مقابل `ENTITY_MODEL.md §2` | PASS |
| عقد Fixtures §6.1 | `BUS-1042` درجة 92 · `BUS-1402` درجة 51 بلا خدمة · `BUS-1404` بلا درجة · `BUS-1403` خطأ | PASS |
| نموذج التقييم §6 | الأبعاد 25/30/20/15/10 بمجموع 100 · `S4-MOCK-v1` · الطبقات الأربع | PASS |
| الحقيقة المالية §12 | 382,000 ر.س · المنسوب = المعترف به · `recognized` فقط · الإسناد ≤ مبلغ الحدث | PASS |
| حد S6 §8 | `closeDealAsWon` لا ينشئ `RevenueEvent` ولا `AttributionTouchpoint` | PASS |
| عقد Deal §8 | عملة SAR · احتمال 0–100 · حالات `open/won/lost` · الرابحة تفرض 100 و`wonAt` | PASS |
| عقد Lead §7 | Lead واحدة لكل Business · الحالات الخمس · التحويل المكرر يعيد القائمة | PASS |
| حدود S11 §13 | حالات التكامل الخمس · لا اتصال إنتاجي · لا تخزين secret | PASS |
| حدود المعمارية | لا `fetch` / `axios` / `XHR` / `WebSocket` / `localStorage` / `sessionStorage` / `indexedDB` / بوابة دفع | PASS |
| مسار العرض | كل fixtures `DEMO_GUIDE.md` موجودة فعليًا | PASS |
| عقد المسارات | 37 مسارًا موثقًا يُحل إلى شاشة منفذة · 3 Placeholders مقصودة · **لا روابط ميتة** | PASS |
| أعداد البوابات | 13 من 14 عددًا معلنًا في التقارير مطابق للتشغيل الفعلي | PASS |

> القلب التعاقدي للمنتج — الكيانات والإيراد والإسناد والحدود التجريبية — **مطابق للوثائق بدقة**.

## الانحرافات — كلها مغلقة

### FND-DOC-001 · حرج · **مغلق** · تقرير يعلن نجاحًا لا يتحقق

`S9_EXECUTION_REPORT.md` و`S12_QA_REPORT.md` يعلنان `verify-s9.mjs` بـ**22/22 PASS**.
التشغيل الفعلي يرمي استثناء عند البوابة J. الفحص يمر تحت `TZ=UTC` فقط.

السبب في `automationDateAfter` داخل `client/js/data.js`: تمرير نص زمني بلا لاحقة
منطقة زمنية عبر `new Date(...).toISOString()` **مرتين**، فيُطرح الفارق المحلي مرتين
وتصبح نهاية الموعد قبل بدايته، فيرفضه `createAppointment`.

يترتب على ذلك أن ادعاء `TECHNICAL_DEBT.md` بأنه **«لا توجد Critical أو Major blockers»**
غير صحيح في أي منطقة زمنية غير UTC — ومنطقة عمل المنتج المعلنة هي `Asia/Riyadh`.

### FND-DOC-002 · حرج · **مغلق** · وصف الحزمة التقنية لم يعد صحيحًا

`PRODUCT_ARCHITECTURE.md` و`CTO_REPORT_AR.md` يصفان واجهة «HTML/CSS/Vanilla JavaScript»
وأن `client/js/app.js` هو الموجّه العامل. بعد شحنة التحويل صار `client/index.html`
يحمّل `/src/main.tsx`، ولم تعد `app.js` تُنفَّذ إطلاقًا.

هذا انحراف **أحدثته شحنة التحويل** ويجب إغلاقه بتحديث الوثيقتين عند اكتمال التحويل.

### FND-DOC-003 · متوسط · **مغلق** · نظام التصميم يوثّق tokens غير موجودة

`DESIGN_SYSTEM.md §2` يعلن 19 token، **15 منها غير معرَّف** في أي ملف CSS.
لكل واحد مقابل منفذ باسم مختلف:

| موثق | المنفذ فعليًا | موثق | المنفذ فعليًا |
|---|---|---|---|
| `--surface` | `--paper` | `--success` / `--success-pale` | `--green` / `--green-pale` |
| `--text-primary` | `--ink` | `--warning` / `--warning-pale` | `--amber` / `--amber-pale` |
| `--text-secondary` | `--muted` | `--danger` / `--danger-pale` | `--red` / `--red-pale` |
| `--border` / `--border-strong` | `--line` / `--line-strong` | `--shadow-sm` | `--shadow` |
| `--brand` / `--brand-deep` / `--brand-pale` | `--cyan` / `--cyan-deep` / `--cyan-pale` | | |

المطابق فقط: `--bg` و`--surface-elevated` و`--info` و`--info-pale`.
العنوان يقول «المقترحة»، لكن الوثيقة تُقرأ كمرجع نظام التصميم — ومن يبني واجهة
جديدة عليها سيكتب متغيرات غير موجودة.

### FND-DOC-004 · متوسط · **مغلق** · عمود الشحنة في خريطة الشاشات قديم

**15 من 28 شاشة** في `SCREEN_MAP.md` تحمل رقم شحنة لا يطابق الواقع. كُتبت الخريطة
في S0 كخطة ولم تُحدَّث حين تأخرت الشحنات:

`#/pipeline` و`#/deals` S5→**S6** · `#/tasks` و`#/appointments` S5→**S9** ·
`#/inbox` و`#/whatsapp` و`#/calls` S6→**S7** · `#/copilot` و`#/agent` S7→**S8** ·
`#/automation` S7→**S9** · `#/analytics` S8→**S10** · `#/integrations` و`#/billing`
و`#/settings` S9→**S11** · `#/leads` S4→**S5**.

### FND-DOC-005 · منخفض · **مغلق** · خريطة الشاشات تستخدم aliases انتقالية

7 شاشات تعلن alias بدل المسار canonical الذي ثبتته `ROUTES.md` لاحقًا:
`#/discovery-jobs` و`#/job` و`#/results` و`#/leads` و`#/lead-profile`
و`#/integrations` و`#/billing`.

### FND-DOC-006 · منخفض · **مغلق** · لقطة ملفات قديمة في تقرير CTO

`CTO_REPORT_AR.md` يذكر «**7 ملفات JavaScript تشغيلية** و**5 ملفات CSS**».
الفعلي: **21** ملف JS و**24** ملف CSS. التقرير مؤرخ 14 أغسطس 2026 ويصف حالة أقدم،
لكنه معروض ضمن `00_MASTER_REFERENCE` كمرجع حالي.

## الإصلاحات المنفذة

| Finding | الإصلاح | الإثبات |
|---|---|---|
| FND-DOC-001 | أُضيفت `parseAutomationInstant` و`formatAutomationInstant` في `client/js/data.js` لتحليل الطوابع الزمنية صراحة كـUTC، وطُبقتا على `automationDateAfter` وحساب `endsAt` في `executeAutomationAction`. | `verify-s9` يمر **22/22** في UTC وRiyadh وLondon وLos Angeles وTokyo وKiritimati — والرقم يطابق ما تعلنه التقارير. |
| FND-DOC-002 | `PRODUCT_ARCHITECTURE.md` يعلن الآن React 19 + TypeScript ونقطة الدخول `main.tsx`، مع تنويه أن طبقة النطاق لم تتغير. | بوابة «عمارة المنتج تعلن الحزمة الفعلية». |
| FND-DOC-003 | جدول `DESIGN_SYSTEM.md §2` أعيد بناؤه بالأسماء المعرَّفة فعليًا (`--cyan`, `--red`, `--ink`, `--line`, `--green`, `--amber`, `--shadow`)، وأُضيفت فئات Navigation وTypography وRadius الناقصة. | بوابة «tokens الوثيقة معرفة فعليًا في CSS» — 29 token. |
| FND-DOC-004 | صُحح عمود الشحنة لـ15 شاشة في `SCREEN_MAP.md`. | بوابة «عمود الشحنة مطابق للشحنة الفعلية» — 28 شاشة. |
| FND-DOC-005 | صُححت مسارات 7 شاشات إلى canonical، مع تنويه أن aliases موثقة في `ROUTES.md`. | بوابة «المسارات canonical لا aliases انتقالية». |
| FND-DOC-006 | وُسم `CTO_REPORT_AR.md` كتقييم تاريخي مؤرخ، وأُضيفت لقطة تذكر العدد الفعلي (21 JS / 24 CSS) بدل تزوير أرقام وثيقة مؤرخة. | بوابتا «أعداد الملفات موسومة كلقطة» و«اللقطة تذكر العدد الفعلي». |

نُسخ الأرشيف في `Docs/NOMO_V1_PROMPTS_ARCHIVE/00_MASTER_REFERENCE/` مُزامَنة مع الجذر.

## منع التكرار

أُضيفت إلى المدقّق بوابات تمنع عودة كل انحراف: نمط التاريخ المحلي، وعمودا خريطة الشاشات،
وأسماء الـtokens، ووصف الحزمة، ووسم اللقطة التاريخية.

التشغيل: `node scripts/audit-docs-vs-code.mjs` — يخرج بـ`1` عند أي انحراف، فيصلح للتشغيل في CI.

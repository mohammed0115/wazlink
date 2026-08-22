# REACT-MIGRATION — تقرير المرحلة الأولى

**Baseline:** `138a727`
**النطاق:** تحويل واجهة «نمو» من Vanilla JS إلى React 19 + TypeScript، تدريجيًا وبلا تغيير في طبقة النطاق أو العقود أو الحقيقة المالية.
**الحالة:** الأساس والغلاف والشاشات العامة ولوحة القيادة مكتملة ومُتحقق منها. باقي الشاشات قيد التحويل.

## قرار المعمارية

طبقة النطاق في `client/js/` **لا تتحرك ولا تتغير**. فحص الاعتماد على DOM أثبت أن
`data.js` و`analytics-engine.js` و`landing-truth.js` و`dashboard.js` و`discovery.js`
و`automation.js` تحوي **صفر** إشارة إلى `document` أو `window`، أي أنها منطق خالص
قابل للاستهلاك من React كما هو.

| الطبقة | القرار |
|---|---|
| الكيانات وdomain functions | تبقى في `client/js/*.js` بلا تعديل — مصدر الحقيقة الوحيد. |
| الحالة المشتركة | `state` نفسه؛ React يشترك عليه عبر `useSyncExternalStore` بدل `render()` اليدوية. |
| طبقة العرض | تُعاد كتابتها كمكوّنات React، صنفًا بصنف وترميزًا بترميز. |
| الأنماط | 24 ملف CSS تُستورد بنفس ترتيب `index.html` بلا أي تعديل. |
| المسارات | Hash Router أصلي بلا مكتبة، محافظ على كل مسار وalias في `ROUTES.md`. |
| فحوص V1 | تبقى تعمل لأنها تستورد طبقة النطاق نفسها. |

> **قاعدة التحويل:** لا يُنشئ React مصدر حقيقة ثانيًا. أي رقم مالي يبقى مشتقًا من selectors S10.

## ما اكتمل

| المكوّن | الملف | الدور |
|---|---|---|
| جسر الحالة | `client/src/store/appStore.ts` | `useAppState` و`mutate` فوق `state` المشترك. |
| الإشعارات | `client/src/store/toast.tsx` | مقابل `toast()` بنفس الأصناف والمدة. |
| الموجّه | `client/src/router/useHashRoute.ts` | عقد `#/` نفسه مع كل الـaliases. |
| الغلاف | `shell/AppShell · Sidebar · Topbar · NavIcon · Brand · routeMeta` | نفس ترميز V1 بعد UI-FIX وSIDEBAR-SEMANTIC-ICONS. |
| الشاشات العامة | `routes/Landing · Login · Onboarding` | القمع والإيراد من `getLandingTruth()` لا من أرقام محلية. |
| الرئيسية | `routes/Dashboard` | كل المؤشرات من `getAnalyticsOverview` بإفصاح event/snapshot. |
| سيناريو الاستخراج | `routes/ScraperReferenceHero` | نسختا Landing وDiscovery. |
| الفحص | `scripts/verify-react-shell.mjs` | 23 بوابة SSR على الحقيقة المالية والهوية والحدود والوصول. |

كما أُصلح عرضًا **كسر تاريخي في مخرجات البناء**: كانت الأنماط مرتبطة في `index.html`
بمسارات مطلقة `/css/*.css` لا ينسخها Vite إلى `dist`، فكان البناء ينجح بلا أنماط.
صارت الآن تمر عبر الحزمة (228 kB في المخرجات).

## ما تبقى

| المجموعة | المسارات | المصدر |
|---|---|---|
| الاكتشاف | `discovery`, `discovery/jobs`, `discovery/jobs/:id`, `discovery/results` | `discovery.js` |
| الذكاء | `intelligence`, `lead-profile` | `intelligence.js` |
| CRM | `crm`, `crm/leads/:id` | `crm.js` |
| المبيعات | `pipeline`, `deals`, `deals/:id` | `pipeline.js` |
| التواصل | `inbox`, `inbox/:id`, `whatsapp` | `inbox.js` |
| الذكاء التطبيقي | `copilot`, `agent` | `sales-ai.js` |
| الأتمتة | `automation`, `automation/rules/:id`, `tasks`, `appointments` | `automation.js` |
| التحليلات | `analytics` وأقسامها الستة | `analytics.js` |
| المنصة | `settings`, `settings/integrations`, `settings/billing`, `ui-kit` | `settings.js`, `ui-kit.js` |
| النوافذ | 7 مضيفات modal + Checkout التجريبي | `payment-checkout.js` وغيرها |

المسارات غير المحوّلة تعرض حاليًا شاشة «قيد التحويل» صريحة، وهي **ليست** Placeholder
المنتج؛ الشاشة معتمدة في V1 ومكوّن React الخاص بها لم يُكتب بعد.

## التحقق المنفذ

| البوابة | النتيجة |
|---|---:|
| `pnpm check` (TypeScript strict) | PASS — بلا أخطاء |
| `pnpm build` | PASS — CSS مجمّع 228 kB |
| خادم التطوير | PASS — يخدم `main.tsx` وطبقة النطاق بلا أخطاء |
| `verify-react-shell.mjs` | PASS — 23/23 |
| `verify-v1-final-fix.mjs` | PASS — 12/12 |
| `verify-s12.mjs` | PASS — 24/24 |
| `verify-s10.mjs` / `verify-s11.mjs` | PASS — 29/29 و20/20 |
| `verify-s3…s8` و`scraper-or-crm` و`payment-checkout` | PASS |
| `verify-s9.mjs` | **FAIL — سابق للتحويل**، انظر أدناه |

## FND-TZ-001 — خطأ منطقة زمنية سابق للتحويل

`verify-s9.mjs` يفشل عند البوابة J. تحقق أن الفشل **موجود على `138a727` نفسه**
قبل أي تغيير، وأن التحويل لم يمس `client/js/` ولا أي فحص قائم.

**السبب الجذري** في `automationDateAfter` داخل `client/js/data.js`: يمرّر نصًا زمنيًا
بلا لاحقة منطقة زمنية عبر `new Date(...).toISOString()` **مرتين متتاليتين**، فيُطرح
فارق التوقيت المحلي في كل مرة.

| TZ | startsAt | endsAt | النتيجة |
|---|---|---|---|
| `UTC` | `2026-08-16T14:02:00` | `2026-08-16T14:32:00` | سليم |
| `Asia/Riyadh` | `2026-08-16T11:02:00` | `2026-08-16T08:32:00` | **النهاية قبل البداية** |

لذلك يرفض `createAppointment` السجل بـ`kind:"invalid"`، فيعود الإجراء `failed`
ولا يُنشأ الموعد. الفحص يمر تحت `TZ=UTC` فقط، بينما منطقة عمل المنتج المعلنة في
`ENTITY_MODEL.md` هي `Asia/Riyadh` — أي أن أي مستخدم خارج UTC لا تعمل لديه
مواعيد الأتمتة.

> لم يُصلح ضمن هذه الشحنة لأنه تعديل في طبقة النطاق خارج نطاق التحويل، ويحتاج قرارًا صريحًا.

## الحدود المحفوظة

لم يضف التحويل Backend أو API أو OAuth أو دفعًا حقيقيًا أو LLM أو Scheduler.
لم تتغير `RevenueEvent` ولا `AttributionTouchpoint` ولا أي كيان تشغيلي، وأثبت
`verify-react-shell` أن رسم الشاشات قراءة فقط. يعيد refresh الذاكرة إلى Fixtures كما في V1.

## ملاحظة تنظيمية

`Docs/NOMO_V1_PROMPTS_ARCHIVE/` غير مضاف إلى git حتى الآن (untracked).
كما نُقل نموذج React القديم غير المستخدم من `client/src` إلى
`Docs/legacy-react-mockup/` لأنه كان يحمل مصدر حقيقة ثانيًا لا يتصل بـ`data.js`.

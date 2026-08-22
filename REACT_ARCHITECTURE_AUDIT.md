# React Architecture Audit — Baseline قبل V2-S0

**نطاق اللقطة:** المستودع `mohammed0115/wazlink` قبل تنفيذ تغييرات V2-S0 في هذه الجولة. **الهدف:** تسجيل نقطة البداية دون اقتراح Backend أو تغيير سلوك V1.

## ملخص تنفيذي

المشروع React/TypeScript مبني بواسطة Vite، وله mount واحد في [`client/index.html`](client/index.html) و[`client/src/main.tsx`](client/src/main.tsx). التوجيه الحالي مركزي لكنه Hash Router مخصص للحفاظ على aliases وروابط V1. غلاف التطبيق موحد في [`client/src/shared/shell/AppShell.tsx`](client/src/shared/shell/AppShell.tsx)، بينما كانت البيانات والحالة والمنطق الوهمي مجمعة في [`client/src/domain/data.js`](client/src/domain/data.js) وتُستورد مباشرة من معظم Features.

كان البناء ناجحًا وtypecheck ناجحًا قبل التغيير. الحزمة الأولية كانت تقارب **903.81 kB** قبل الضغط، مع تحذير Vite من chunk أكبر من 500 kB. لم توجد مجلدات `client/js` أو نقاط HTML قديمة منافسة داخل المصدر؛ لذلك سيبقى ملف `data.js` معزولًا خلف adapter بدل حذفه، لأن حذف المصدر قبل إثبات تطابق كامل يخالف سياسة الحذف.

## بنية التشغيل الفعلية

| الطبقة | الوضع قبل V2-S0 | الدليل |
|---|---|---|
| React root | mount واحد على `#app` | [`main.tsx`](client/src/main.tsx) و[`index.html`](client/index.html) |
| Build entry | `/src/main.tsx` تحت جذر Vite هو `client/` | [`vite.config.ts`](vite.config.ts) |
| Router | Hash Router مخصص عبر `useSyncExternalStore` | [`useHashRoute.ts`](client/src/shared/router/useHashRoute.ts) |
| App shell | `Sidebar + Topbar + page-content` في مكوّن مشترك | [`AppShell.tsx`](client/src/shared/shell/AppShell.tsx) |
| State | كائن mutable مركزي في `data.js` مع bridge لإعادة الرسم | [`data.js`](client/src/domain/data.js)، [`appStore.ts`](client/src/shared/store/appStore.ts) |
| CSS entry | مستورد واحد يحمّل ملفات CSS بترتيب مقصود | [`styles/index.ts`](client/src/styles/index.ts) |
| Error handling | Error Boundary على مستوى المسار | [`ErrorBoundary.tsx`](client/src/shared/components/ErrorBoundary.tsx) |

## قياسات التدقيق

| المقياس | النتيجة قبل التنفيذ |
|---|---:|
| أكبر ملف بيانات | `client/src/domain/data.js` — 1,066 سطرًا |
| أكبر Page React | `Dashboard.tsx` — 704 أسطر |
| ملفات React/TypeScript كبيرة إضافية | `Analytics.tsx` 668، `Inbox.tsx` 603، `Landing.tsx` 518 |
| مستهلكو `@domain/data.js` المباشرون | 50 ملفًا داخل المصدر |
| نقاط HTML في المصدر | 1 |
| مجلد `client/js` | غير موجود |
| `document.querySelector` / `innerHTML` | غير موجودين في المصدر |
| `classList.toggle` في AppShell | موجود، وكان side effect قابلًا للاستبدال 선언يًا |
| typecheck | PASS |
| build | PASS، مع تحذير chunk كبير |

## Findings والقرارات

### 1. مصدر الحقيقة مختلط

`data.js` يجمع fixtures و`state` وselectors وmutations لعائلات Discovery وCRM وDeals وInbox وAutomation والإعدادات. هذا مناسب كسلوك Prototype لكنه ليس boundary صالحًا للتوسع إذا استمر استيراده مباشرة من الواجهة. القرار هو إبقاء التنفيذ كما هو وإضافة `services/data.ts` كطبقة adapter؛ لا يوجد HTTP حقيقي ولا Fake API جديد.

### 2. التوجيه مركزي لكن تاريخي

لا توجد نقاط توجيه متنافسة داخل التطبيق الحالي. Hash Router هو قرار توافق مع V1، والaliases التاريخية موثقة داخل `App.tsx`. لا يُستبدل بـReact Router في S0 لأن ذلك قد يغير deep links وسلوك back/forward دون فائدة لازمة.

### 3. App Shell مشترك مع side effect غير ضروري

كان `AppShell` يبدّل class على عنصر Sidebar عبر `document.getElementById(...).classList.toggle(...)`. تم تحويل الحالة إلى prop declarative في `Sidebar` مع الحفاظ على class `open` نفسه، وبذلك بقي CSS وسلوك الهاتف كما هما.

### 4. الحزمة الأولية كبيرة

بما أن build baseline تجاوز 500 kB، تم اعتماد lazy loading لصفحات Features الثقيلة مع `Suspense` وshared `LoadingState`. هذا تغيير تحميل فقط، وليس feature أو redesign، ويُقاس في تقرير التنفيذ.

### 5. types جزئية

كان [`domain/types.ts`](client/src/domain/types.ts) يحتوي عقودًا لبعض حالات الواجهة فقط. تم توسيعه بعقود domain خفيفة ومعرفات aliases للأسماء المطلوبة، دون إجبار fixtures JavaScript على migration شاملة في هذه المرحلة.

## حدود هذه الجولة

لم يُنفذ Backend أو Database أو Authentication أو API integration أو RBAC أو Billing حقيقي أو WhatsApp حقيقي أو AI حقيقي. لم تُحذف `domain/data.js` أو أي fixture؛ لأن التحقق من تطابق سلوك V1 لا يبرر الحذف بعد. وتبقى ملفات CSS التاريخية كما هي، مع توثيقها كدين تقني بدل إعادة ترتيب بصري واسع.

## مراجع داخلية

1. [`package.json`](package.json)
2. [`client/src/App.tsx`](client/src/App.tsx)
3. [`client/src/domain/data.js`](client/src/domain/data.js)
4. [`client/src/shared/router/useHashRoute.ts`](client/src/shared/router/useHashRoute.ts)
5. [`client/src/shared/shell/AppShell.tsx`](client/src/shared/shell/AppShell.tsx)
6. [`client/src/styles/index.ts`](client/src/styles/index.ts)

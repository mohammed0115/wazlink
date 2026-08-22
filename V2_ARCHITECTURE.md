# V2 Frontend Architecture

## القرار العام

تعتمد V2 على **React 19 + TypeScript تدريجيًا + Vite** فوق السلوك المرئي المعتمد في V1. الهدف هو فصل مسؤوليات العرض عن الحالة والبيانات الوهمية، مع إبقاء كل عقود الإيراد والإسناد والـPipeline وسياسات الأتمتة كما هي في طبقة النطاق الحالية.

> V2-S0 مرحلة تأسيس للواجهة فقط؛ لا تنشئ Backend أو Database أو Auth أو HTTP integration.

## الطبقات

| الطبقة | المسؤولية | الوضع الحالي |
|---|---|---|
| `app` / `App.tsx` | تركيب التطبيق، حدود الخطأ، Suspense، واختيار الشاشة | مركزي في `App.tsx` مع Hash Router متوافق |
| `features` | UI وflows الخاصة بكل مساحة منتج | منظمة حسب feature وموجودة مسبقًا |
| `shared/shell` | Sidebar وTopbar والغلاف والتنقل العام | مشتركة، مع state drawer declarative |
| `shared/components` | عناصر العرض العابرة للميزات والحالات المشتركة | أضيفت `States.tsx` لحالات loading/empty/error |
| `domain` | عقود النطاق وتنفيذ Prototype الحالي | `types.ts` للعقود و`data.js` كمصدر mock تاريخي |
| `services` | boundary للوصول إلى البيانات والعقود المستقبلية | `data.ts` adapter فوق mock، وrepository contracts |
| `config` | قراءة إعدادات Vite العامة | `config/env.ts` هو المسار الوحيد لقراءة `import.meta.env` |
| `styles` | CSS الحالي وtokens وRTL | entry واحد؛ لم يحدث redesign أو حذف واسع |

## تدفق البيانات

```text
React Feature
   |
   v
services/data.ts  ----->  domain/data.js (mock implementation في S0)
   |
   +---- contracts/repositories.ts (عقود استبدال مستقبلية)

Future API adapter يمكنه استبدال data.ts implementation دون إعادة كتابة Feature UI.
```

## التوجيه

يظل [`useHashRoute`](client/src/shared/router/useHashRoute.ts) هو Router الوحيد. سبب الإبقاء عليه هو توافق V1 مع deep links وaliases مثل `leads`, `whatsapp`, `results`, `billing`, و`integrations`. لا توجد Router ثانية ولا نقاط HTML متنافسة.

## حالة التطبيق

الحالة الحالية Prototype state mutable ومشتركة عبر `data.js`، ويعيد [`appStore`](client/src/shared/store/appStore.ts) الرسم عند mutations. لا تتم إضافة Redux أو Zustand في S0؛ فالحل الأقل مخاطرة هو إبقاء state الحالي مع تصنيف واضح:

| النوع | أمثلة | مكانه |
|---|---|---|
| UI state | drawer، modal، filters، selected tab | local state أو `s11Ui`/modal state الحالي عند الحاجة |
| domain state | leads، deals، conversations، analytics | mock domain store الحالي، خلف service boundary |
| route state | path، query، aliases | Hash Router المركزي |

## التحميل والأخطاء

تُحمّل الصفحات الثقيلة عبر `React.lazy` وتُعرض أثناء ذلك `LoadingState` مشتركة. ويغلف `ErrorBoundary` المسار الحالي حتى لا يحول فشل Feature واحدة إلى white screen للتطبيق كله.

## قواعد مستقبلية

لا تنتقل طبقة `services` إلى HTTP إلا في مرحلة لاحقة بعد اعتماد CTO. عندها يجب أن يكون لكل repository تنفيذ واضح، وأن تبقى عقود `types.ts` و`contracts/repositories.ts` مصدر الواجهات بدل استيراد fixtures إلى JSX. كما ينبغي إضافة server state/query layer فقط عندما يصبح هناك API حقيقي، لا كـfake abstraction في S0.

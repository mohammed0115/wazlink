# S10 — Reconstructed CTO Verification Prompt

> **مهم:** هذا Prompt مُعاد بناؤه من QA/Execution reports، وليس نسخة حرفية من Prompt تاريخي غير محفوظ.

## الوضع
**READ ONLY.** لا تعدّل الملفات، لا تنشئ commit أو push، ولا تبدأ المرحلة التالية.

## المطلوب
تحقق بصورة مستقلة من تنفيذ **S10**:
- حالة repository وHEAD وworking tree وremote.
- Scope commit وعدم تسرب مراحل لاحقة.
- صحة العقود والكيانات ومصدر الحقيقة.
- السيناريوهات الوظيفية المذكورة في QA.
- الحسابات والمراجع والـprovenance حيث تنطبق.
- Arabic/RTL وresponsive وaccessibility.
- Console/network وحدود Mock مقابل التكامل الحقيقي.
- build والاختبارات والانحدارات.
- أخرج Findings مصنفة Critical/Major/Minor.
- القرار النهائي يجب أن يكون واحدًا من:
  - `S10 VERIFIED — READY TO CLOSE`
  - `S10 NOT VERIFIED — S10-FIX REQUIRED`

## QA المرجعي المحفوظ
# تقرير جودة S10 — Analytics + Revenue Attribution

**الحكم:** PASS — جاهزة لمراجعة CTO.  
**بيئة التحقق:** Prototype عربي RTL، Vite، بيانات ثابتة، محرك selectors محلي بلا Backend أو اتصال خارجي.

## نتائج التحقق الآلي

| الفحص | النتيجة | التغطية |
|---|---:|---|
| Build | PASS | 33 وحدة Vite دون خطأ. |
| S10 | PASS | `verify-s10.mjs`: **25/25**. |
| S9 | PASS | Rules وmanual-only والموافقات والتدقيق. |
| S8 runtime / S8 | PASS | Inbox/Copilot والـAgent والسياسات. |
| S7 / S6 / S5 | PASS | Inbox وPipeline وCRM. |
| S4 / S4-UX / S3 / S2-FIX | PASS | Intelligence وJobs وسلسلة الإسناد. |

## مصفوفة S10

| المحور | النتيجة |
|---|---:|
| Registry والمقاييس المعلنة | PASS |
| selectors read-only | PASS |
| Date safety وcontext defaults | PASS |
| Pipeline وWeighted separation | PASS |
| Funnel cohort nesting والتحويلات | PASS |
| Revenue recognized والإسناد والتسوية | PASS |
| Trace Revenue → Source | PASS |
| فلاتر Source وJob | PASS |
| Source performance وdrill-down | PASS |
| Export provenance وData Quality | PASS |
| AI/Inbox/Automation/Appointments/Tasks analytics | PASS |
| عدم إنشاء أي Message/Task/Deal/Revenue/Attribution | PASS |

## فحص الواجهة

تم فتح `#/analytics` ثم `#/analytics/funnel` من تحميل جديد. ظهرت KPIs الإيراد **382,000 ر.س** والإيراد المنسوب **382,000 ر.س** وقيمة Pipeline المفتوحة **261,000 ر.س** والمرجحة **198,980 ر.س**، مع تعريفات «كيف حُسب؟». فتح Drill-down مرحلة «مكتشف» وأظهر Business IDs الاثني عشر المكونة للـcohort.

بعد تطبيق فلتر مصدر «مواقع الشركات»، أعادت Funnel الحساب إلى Business واحدة ثم cohorts لاحقة صفرية من دون نسبة اختلاقية أو خطأ. تعرض Funnel الكاملة conversions متتابعة: 12 → 6 → 2 → 2 → 2 → 1 → 1 → 1 → 1، ولا توجد مرحلة تتجاوز السابقة.

## الحدود المعتمدة

S10 لا تعالج تدفقًا حيًا أو تقارير خارجية أو مقارنة فترات حقيقية. كما أن الأرقام لا تعني سببية AI أو Automation للإيراد. تبقى الشحنة قراءة فقط، ولا تبدأ S11 قبل GO صريح من CTO.


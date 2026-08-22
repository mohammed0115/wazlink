# S9 — Reconstructed Implementation Prompt

> **مهم:** هذا ليس النص الحرفي للـPrompt التاريخي الأصلي. تمت إعادة بنائه من تقارير المشروع المحفوظة في المستودع، حتى لا نخترع تعليمات غير موجودة.

## الدور
أنت مهندس تنفيذ Senior تعمل على مشروع NOMO/نمو. نفّذ نطاق **S9** فقط، مع الحفاظ على كل العقود والانحدارات السابقة.

## مصادر الحقيقة
اقرأ الملفات الموجودة في هذا المجلد، وبالأخص:
- `S9_EXECUTION_REPORT.md`
- `S9_QA_REPORT.md`
ثم ارجع إلى `../00_MASTER_REFERENCE/` لعقود الكيانات والمسارات والتصميم والمعمارية.

## قواعد التنفيذ
1. لا تبدأ المرحلة التالية.
2. لا تغيّر العقود السابقة إلا إذا كان التقرير يطلب ذلك صراحة.
3. حافظ على Arabic RTL، الاستجابة، الوصول، وسلامة الـroutes.
4. لا تضف Backend/API/تكامل إنتاجي إذا كانت المرحلة موصوفة كـMock/local.
5. حافظ على Source of Truth وعدم تكرار الكيانات أو الأرقام المالية.
6. نفّذ اختبارات النزاهة والبناء والانحدار المذكورة في التقارير.
7. وثّق أي انحراف بدل إخفائه.
8. عند الانتهاء، أنشئ Execution/QA report واضحًا، وتوقف لقرار CTO.

## مواصفات المرحلة المستخرجة من تقرير التنفيذ
التقرير الأصلي محفوظ بجانب هذا الملف ويُعد المرجع التفصيلي. لا تستبدل محتواه بافتراضات عامة.

---
### SOURCE EXECUTION REPORT
# تقرير تنفيذ S9 — Automation + Tasks + Appointments

**الحالة:** مكتملة تقنيًا، بانتظار قرار CTO قبل S10.  
**النطاق:** محاكاة Automation حتمية داخل الذاكرة المحلية فقط؛ لا Scheduler ولا قناة رسائل أو Calendar أو Backend.

## الملخص التنفيذي

تضيف S9 طبقة تشغيلية محكومة تحوّل حدثًا معروفًا إلى **Task** أو **اقتراح موعد** أو **Action داخلية محدودة**. تعمل الطبقة على المسار `Event → Trigger → Conditions → Rule → Policy → Execution → Audit`، ولا يبدأ التنفيذ من الخلفية أو الزمن أو خدمة خارجية. تظل المهام ضمن عقد S5، وتظل المواعيد كيانًا محليًا جديدًا، وتبقى Deals وRevenue وAttribution محمية من أي mutation.

> لا تعني كلمة Automation في S9 تنفيذًا ذاتيًا أو جدولة حقيقية. كل تشغيل يتم عبر محاكاة أو زر يدوي داخل جلسة Prototype الحالية.

| المجال | التنفيذ | الحماية |
|---|---|---|
| Rule | `AutomationRule` بحالة وإصدار ومشغّل ومجموعة شروط وإجراءات وسياسة موافقة. | Rule تعطيل أو مسودة لا ينتج Run. |
| Conditions | `ConditionGroup` مع allowlist محددة. | لا JavaScript أو expressions أو نص قابل للتنفيذ. |
| Run | `AutomationRun` يحتفظ بالـRule version وTrigger Event وidempotency key. | الحدث نفسه لا ينفذ مرتين. |
| Action | `AutomationActionExecution` مع حالات موافقة وتنفيذ ورفض وفشل. | Double Approve = no-op. |
| Tasks | إنشاء Follow-up عبر دالة S5 نفسها مع `createdByAutomationRunId`. | لا Task قبل الموافقة للإجراء الحساس. |
| Appointments | موعد محلي بتوقيت بداية/نهاية وLead وprovenance. | overlap تحذير محلي؛ لا Calendar API. |
| Policy | allowlist لإجراءات داخلية محدودة. | يمنع send_message، ماليات Deal، إغلاق Deal، Revenue وAttribution. |

## الواجهات المنفذة

| المسار | السلوك |
|---|---|
| `#/automation` | قواعد، metrics، Rule Builder، dry test، طابور الموافقات، وسجل تدقيق. |
| `#/automation/rules/:id` | تفاصيل Rule المحددة وتشغيل يدوي للإجراءات التي تدعم `manual`. |
| `#/tasks` | قائمة مهام S5 الأصلية مع مصدر يدوي أو Automation وفلاتر الحالة والاستحقاق. |
| `#/appointments` | مواعيد محلية وفلاتر، مع تحذير تعارض وزر إنشاء محلي. |

تضيف Lead 360 بطاقة مرجعية لمواعيد Lead وتشغيلات الأتمتة المرتبطة، بينما يقرأ Dashboard metrics الأتمتة من selector مركزي. لا تنسخ أي واجهة Lead أو Deal أو Message أو Intelligence كحقيقة ثانية.

## Fixtures وقواعد جاهزة

تشمل Fixtures Rule مفعلة لإنشاء Task من Lead عالي الأولوية، وRule لمحادثة تحتاج ردًا، وRule لاقتراح Appointment عند مرحلة عرض، وRule لتحديث Priority بعد التأهيل، وRule معطلة، وRule draft، وRule يدوي آمن. كما يظهر failure مضبوط عندما يفقد سياق Task مالكًا صالحًا، من دون إخفاء الأثر في السجل.

## حدود الشحنة

لا توجد Cron أو Queue أو Worker أو Webhook أو API أو Email/WhatsApp auto-send أو Campaign أو Agent autonomous أو نقل Deals أو تعديل قيمها أو احتمالاتها أو إغلاقها. لا تنشئ S9 `RevenueEvent` أو `AttributionTouchpoint`، ولا تبدأ S10 من دون GO صريح من CTO.


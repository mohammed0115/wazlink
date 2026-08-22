# S9-FIX REPORT — Manual Execution, Condition Contract & Audit Traceability

**Baseline:** `6ccf2fb`  
**نوع الإصلاح:** محدود لعقد S9 وسياسة التنفيذ وواجهة Preview/Audit.  
**الحالة:** مكتملة تقنيًا، بانتظار قرار CTO قبل S10.

## السبب الجذري والفجوات المغلقة

أظهرت مراجعة CTO لـS9 أن `manual_only` معروضة في الواجهة ولكن مسار التنفيذ المركزي يعاملها كسياسة تمنع كل التنفيذ، وأن شروط القواعد محمية من Builder فقط لا من Domain Function. كما كانت هوية التشغيل تعتمد الوقت، وكانت Preview ثابتة، وكانت Queue/Audit لا تعرض كامل سلسلة قرار الموافقة والتنفيذ.

| فجوة CTO | إصلاح S9-FIX |
|---|---|
| `manual_only` غير قابلة للتنفيذ | `evaluateAutomationRule` يمنع trigger التلقائي فقط، بينما `runAutomationNow` يمرر `triggerMode=manual` وactor/event identity صريحة؛ وتنفيذ Action يقرأ triggerMode المحفوظ من Run. |
| field/operator/value غير محصنة مركزيًا | أضيف `automationConditionFieldCatalog` وvalidator مركزي تستدعيه create/update/evaluate/test/integrity. |
| timestamp ليس event identity | أضيف `eventId` وtransition snapshot وidempotency key من Rule/Version/Event/Action. |
| Preview ثابتة | `getAutomationRulePreview` مشتقة من مدخلات Builder وتحدث مباشرة مع trigger/condition/value/action/policy. |
| Audit ناقص | Runs وAction Executions تحفظ السبب والموافقة والـactors وتواريخ التنفيذ وresult entity والفشل، وتعرضها Queue/Audit. |

## سياسة Manual Only

لا تبدأ Rule ذات سياسة `manual_only` من تقييم حدث تلقائي؛ ينتج Run skipped بعبارة واضحة تطلب **تشغيل الآن**. عند الضغط على Run Now ينشأ Trigger محلي يدوي يحمل `triggerMode=manual` و`triggeredBy` و`eventId` مستقلًا. الإجراء الآمن ينفذ داخل session فقط؛ والإجراء الحساس، مثل Appointment، يبقى في `awaiting_approval` حتى موافقة بشرية.

> لا توجد جدولة أو Job خلفية. التشغيل اليدوي محاكاة محلية ولا ينفذ أي اتصال خارجي أو رسالة أو إيراد.

## التحقق

| البوابة | النتيجة |
|---|---:|
| `manual_only` automatic trigger محجوب | PASS |
| `manual_only` Run Now آمن | PASS |
| Appointment manual approval ثم التنفيذ | PASS |
| Double Approve = no-op | PASS |
| Invalid field/operator/value مرفوض مركزيًا | PASS |
| Same event duplicate | PASS |
| New event على entity نفسها | PASS |
| Approval/execution/rejection trace | PASS |
| Live Preview للحقل والقيمة والسياسة | PASS |
| Loop guard، Messages، Deals، Revenue، Attribution | PASS |
| S9 integrity | PASS — 22/22 |
| S2–S8 regression | PASS |

## فحص الواجهة

تم فتح Rule Builder في `#/automation` وتغيير الحقل من أولوية العميل إلى قيمة الصفقة ثم إدخال `100000`: تغيرت Preview إلى **«قيمة الصفقة يساوي 100000»**. وعند اختيار سياسة **«يدوي فقط»** تغيرت الملاحظة إلى **«لن تعمل هذه القاعدة تلقائيًا؛ يجب تشغيلها يدويًا.»** من دون حفظ قاعدة جلسية جديدة.

## حدود الشحنة

لا يعيد S9-FIX بناء Automation Engine، ولا يغير S5 Tasks أو S6 Deals أو S7 Messaging أو S8 Copilot/Agent. لا Scheduler ولا Calendar API ولا Email/WhatsApp ولا Webhook ولا Backend ولا Revenue/Attribution ولا S10.

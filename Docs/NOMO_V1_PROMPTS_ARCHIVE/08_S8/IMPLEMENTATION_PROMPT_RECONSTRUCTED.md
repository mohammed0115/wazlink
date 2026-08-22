# S8 — Reconstructed Implementation Prompt

> **مهم:** هذا ليس النص الحرفي للـPrompt التاريخي الأصلي. تمت إعادة بنائه من تقارير المشروع المحفوظة في المستودع، حتى لا نخترع تعليمات غير موجودة.

## الدور
أنت مهندس تنفيذ Senior تعمل على مشروع NOMO/نمو. نفّذ نطاق **S8** فقط، مع الحفاظ على كل العقود والانحدارات السابقة.

## مصادر الحقيقة
اقرأ الملفات الموجودة في هذا المجلد، وبالأخص:
- `S8_EXECUTION_REPORT.md`
- `S8_QA_REPORT.md`
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
# تقرير تنفيذ S8 — Sales Copilot + AI Sales Agent

**الحالة:** مكتملة تقنيًا، بانتظار قرار CTO قبل S9.  
**النطاق:** Copilot وAgent حتميان ومحليان داخل Prototype؛ لا LLM ولا API ولا Backend ولا تنفيذ قناة خارجي.

## الملخص التنفيذي

تضيف S8 طبقة مساعد مبيعات قابلة للتفسير فوق S7 من دون تحويل المنتج إلى نظام يرسل أو يقرر ذاتيًا. يبني المحرك `SalesContext` من المراجع الأصلية، ثم ينتج Summary وSuggested Reply وNext Best Action وأسئلة تأهيل أو Escalation. تظل كل نتيجة مرتبطة بـEvidence IDs قائمة، وتبقى الثقة مستقلة عن Opportunity Score وDeal Probability.

> «استخدام الرد» لا ينشئ Message. يضع النص في Composer، وعندما يختار المستخدم الإرسال تبقى الرسالة من `senderType=user` ضمن دورة S7 البشرية المحلية.

| المجال | التنفيذ | الحماية |
|---|---|---|
| SalesContext | تجميعة Source وJob وBusiness وIntelligence وLead وConversation وMessages وDeals وTasks بالمراجع. | لا توجد نسخة ثانية من CRM أو Pipeline أو Intelligence. |
| Copilot | تحليل حتمي، ملخص، رد مقترح، NBA، تأهيل، Evidence، Confidence وstaleness. | لا نص غير مفسر ولا Score مصطنعة ولا عمليات CRM تلقائية. |
| Agent policy | مصفوفة مركزية للوضع `off/assist/approval_required` وللصلاحيات. | لا وضع استقلال ذاتي. |
| Agent actions | Proposal ثم Approval/Reject ثم Execution/Failure عبر Domain Functions. | التنفيذ مرة واحدة وقابل للتدقيق. |
| المحظورات | send_message، تغيير قيمة Deal، close won، Revenue وAttribution. | محظورة في المحرك لا في الواجهة فقط. |
| التكامل | Copilot في Inbox، Agent workspace، ملخص Lead 360 وDashboard. | السياق قراءة فقط إلا بعد موافقة Action مسموح بها. |

## دورات Agent المسموح بها

| الإجراء | السلوك |
|---|---|
| مسودة رد | اقتراح ثم إدراج في Composer بعد موافقة؛ لا إرسال تلقائي. |
| Task | Proposal ثم موافقة ثم إنشاء Task عبر دالة المجال مرة واحدة. |
| Lead status/priority/owner | Proposal ثم موافقة ثم mutation عبر الدالة القائمة مع metadata Agent. |
| Deal draft | Proposal ثم موافقة ثم فتح نموذج فقط؛ لا تعديل قيمة أو مرحلة أو احتمال. |
| Escalation | يسجل اقتراح تصعيد ظاهر للفريق من دون إنشاء تكامل خارجي. |

## حدود شحنة S8

لا يوجد OpenAI أو Anthropic أو Gemini أو LLM آخر، ولا fetch أو Webhook أو اتصال WhatsApp أو Meta أو Twilio أو Backend. لا يوجد Campaign أو Calendar أو Appointment Automation أو Agent متكرر في الخلفية. كل النتائج والحالات داخل الذاكرة الحالية فقط؛ يتطلب بدء S9 GO صريحًا من CTO.


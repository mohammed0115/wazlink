# S10 — Reconstructed Implementation Prompt

> **مهم:** هذا ليس النص الحرفي للـPrompt التاريخي الأصلي. تمت إعادة بنائه من تقارير المشروع المحفوظة في المستودع، حتى لا نخترع تعليمات غير موجودة.

## الدور
أنت مهندس تنفيذ Senior تعمل على مشروع NOMO/نمو. نفّذ نطاق **S10** فقط، مع الحفاظ على كل العقود والانحدارات السابقة.

## مصادر الحقيقة
اقرأ الملفات الموجودة في هذا المجلد، وبالأخص:
- `S10_EXECUTION_REPORT.md`
- `S10_QA_REPORT.md`
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
# تقرير تنفيذ S10 — Analytics + Revenue Attribution

**الحالة:** مكتملة تقنيًا، بانتظار قرار CTO قبل S11.  
**النطاق:** طبقة تحليلات مشتقة وقراءة فقط فوق الحقائق التشغيلية؛ لا Backend ولا قاعدة بيانات ولا تعديل إيراد.

## الملخص التنفيذي

تضيف S10 مساحة تحليلات قابلة للتفسير تجعل كل رقم مرتبطًا بتعريفه وفترته وفلاتره ومعرفات السجلات الداخلة فيه. تقرأ الطبقة مصادر الاكتشاف وJobs وBusiness وIntelligence وLead وConversation وDeal وRevenue وAttribution وTask وAppointment وAutomation وAgent من مصدر الحقيقة الحالي، من دون إنشاء نسخة تشغيلية ثانية أو mutation على أي كيان.

> لا تعرض S10 قيمة Deal على أنها إيراد. الإيراد يقرأ من RevenueEvent المعترف به فقط، وPipeline من Deals المفتوحة، وPipeline المرجحة من قيمة Deal × احتمالها التجاري.

| المجال | التنفيذ | الحماية |
|---|---|---|
| AnalyticsContext | فلاتر فترة ومصدر وJob ومالك ومدينة وTier وLead وDeal وقناة وقاعدة Automation. | تطبيع context غير الصالح إلى default آمن. |
| Metric Registry | تعريفات معلنة للمقاييس، timestamps، aggregation، وdrill-down IDs. | لا KPI بلا definition أو مصادر إدخال. |
| Funnel | تسع مراحل Business cohorts متتابعة. | كل cohort فرعية من السابقة؛ لا conversion أعلى من 100%. |
| Attribution | Trace من RevenueEvent إلى Source. | conservation: attributed لا تتجاوز مبلغ RevenueEvent. |
| Data Quality | سلاسل ناقصة وunknown/failed Intelligence وإيراد غير منسوب. | لا تخمين ولا إخفاء فجوة. |
| Export | CSV محلي لصفوف Attribution المشتقة. | لا API أو نقل بيانات خارجي. |

## المسارات المنفذة

| المسار | السلوك |
|---|---|
| `#/analytics` | ملخص تنفيذي، فلاتر، KPIs، تسوية إيراد، جودة بيانات، وFunnel مختصرة. |
| `#/analytics/funnel` | cohorts متتابعة مع conversion وdrill-down Business IDs. |
| `#/analytics/revenue` | Revenue Events وإسنادها وحالات السلسلة الناقصة وتتبّع المراجع. |
| `#/analytics/sources` | أداء المصادر وDiscovery Jobs. |
| `#/analytics/sales` | Deals المفتوحة والـPipeline والـweighted وWin Rate. |
| `#/analytics/ai` | Intelligence وInbox وAutomation وAppointments وTasks. |

## تكامل الشاشات السابقة

قرأ Dashboard Funnel وPipeline والإيراد والمصادر من selectors S10 عندما يكون المعنى متطابقًا. لم تُعد كتابة S2 أو S6 ولم يتغير Revenue Attribution أو Deal lifecycle. كما أن Lead 360 وInbox وAgent وAutomation تبقى حقائق تشغيلية؛ تظهر في S10 كقراءات مشتقة لا كواجهات تحرير.

## الحدود المقصودة

جميع الأرقام تخص بيانات تجريبية ثابتة ويظهر ذلك في الواجهة. لا يوجد تحليل سببـي يثبت أن AI أو Automation «سبب» إيرادًا؛ تعرض S10 metrics وصفية وAI-influenced revenue كما هي معرفة في registry. لا يوجد LLM أو API أو Scheduler أو Billing أو S11.


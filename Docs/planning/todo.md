# مسار التنفيذ الداخلي S0–S12

## S0 — Product Foundation & Architecture

- [x] إكمال مراجعة مواصفات S0 واعتماد عناصر القبول قبل أي شحنة لاحقة.
- [x] إنشاء `SCREEN_MAP.md` لجميع الشاشات المخطط لها حتى S12.
- [x] إنشاء وثيقة نموذج الكيانات وقواعد المنتج والربط بين الكيانات.
- [x] تثبيت Arabic Only وRTL native، وإزالة Language Toggle من تجربة المستخدم.
- [x] تثبيت CSS Tokens ومكتبة المكونات المشتركة ومقياس المسافات والكتابة.
- [x] تثبيت Application Shell والتنقل والـSidebar وTopbar ومسارات placeholders.
- [x] إضافة صفحة UI Kit داخلية للمراجعة فقط.
- [x] مراجعة بناء S0 وسجل الحالة الداخلي، من دون بدء S1 أو تسليم نسخة المشروع.

## S1 — Landing + Login + Onboarding

- [x] استكمال مراجعة مواصفات S1 وعناصر قبولها قبل تعديل الواجهة العامة.
- [x] بناء Landing عربية كاملة تشرح رحلة المصدر إلى الإيراد وتفاضل المنتج عن scraper أو CRM منفصل.
- [x] بناء Hero Product Preview وأقسام workflow والاكتشاف والذكاء وCRM والمساعد وPipeline والإسناد والتكاملات.
- [x] تثبيت Login عربية بسيطة وواضحة مع حالات الإدخال والانتقال التجريبي.
- [x] بناء Onboarding متعدد الخطوات يشرح ما يحدث بعد التسجيل وينتهي بمساحة العمل.
- [x] فحص رحلة Landing → Login → Onboarding → Dashboard على Desktop وMobile وRTL.
- [x] إعداد تقرير S1 والتوقف قبل S2 بانتظار قرار CTO.
- [x] تشغيل النظام بعد التنفيذ وفحص مسار Landing → Login → Onboarding → Dashboard على Desktop وMobile.

## تشغيل المعاينة

- [x] إعادة تشغيل النظام والتحقق من ظهور المعاينة العامة.
- [x] تسليم رابط فحص مباشر للمستخدم بعد نجاح التشغيل.

## مزامنة GitHub

- [x] فحص حالة Git وربط المشروع بالمستودع المحدد.
- [x] إنشاء commit للحالة الحالية ودفعه إلى الفرع البعيد.
- [x] التحقق من الـcommit الظاهر على GitHub وتسجيل مرجعه.

## S2 — Executive Dashboard

- [x] استكمال مراجعة مواصفات S2 وتثبيت ترتيب Dashboard ومعايير القبول.
- [x] توسيع نموذج البيانات المركزي بـKPIs والقمع وPipeline والتنبيهات والإسناد من دون كائنات متناقضة.
- [x] تطوير `#/dashboard` كسطح قيادة مبيعات: Header و8 KPIs ومركز الانتباه وتوصيات AI وقمع التحويل.
- [x] إضافة Pipeline Summary والصفقات القريبة من الإغلاق وأداء الاكتشاف والمتابعات والمحادثات والإيراد والإسناد.
- [x] تفعيل فلتر وقت Mock وروابط الإجراءات الرسمية وstates التحميل والفراغ والخطأ.
- [x] فحص Desktop وTablet وMobile وRTL والحسابات والاستجابة وتشغيل البناء.
- [x] إعداد تقرير S2 والتوقف قبل S3 بانتظار قرار CTO.

> S2 مغلقة بانتظار مراجعة CTO. لا يبدأ S3 إلا بعد GO صريح.

## S2-FIX — Attribution & Data Integrity Closure

- [x] بناء مصدر حقيقة واحد لسلسلة Attribution بثلاثة مسارات مكتملة من المصدر إلى الإيراد ونقطة الإسناد.
- [x] اشتقاق بطاقات Attribution وRevenue Summary من Revenue Events مع فحص تطابق مجموع الفترة.
- [x] توحيد حقيقة `TSK-1042` وربط المتابعات بسجلات المهام المركزية.
- [x] تصحيح دلالة فلتر الوقت وحالة المحادثات وتحسين النص التشغيلي الأساسي على الهاتف.
- [x] تشغيل اختبارات النزاهة A–E والبناء والانحدار والاستجابة، وإعداد تقرير S2-FIX.
- [x] إنشاء commit واحد لـS2-FIX ورفعه إلى `main` ثم التوقف قبل S3.

> S2-FIX نطاق إصلاحي محدود. لا يبدأ S3 إلا بعد GO صريح من CTO.

## S3 — Discovery + Jobs

- [x] مراجعة تنفيذ S3 وعقود المسارات والبيانات المعتمدة من commit `562c130` قبل التعديل.
- [x] توحيد عقد DiscoveryJob ومصادر الاكتشاف وحالات العملية وبيانات النتائج التجريبية.
- [x] بناء `#/discovery` كنقطة بدء تتضمن كلمات ومواقع متعددة وفلاتر ومعاينة مجموعات البحث.
- [x] بناء قائمة العمليات وتفاصيل العملية ومسار المعالجة المحلي على Routes المعتمدة.
- [x] بناء نتائج الاكتشاف المحلية والفرز والفلاتر وحالات UI من دون CRM أو AI أو Scraping حقيقي.
- [x] فحص S3 على Desktop وTablet وMobile وRTL والبناء والانحدار وإعداد التقرير.
- [x] إنشاء commit واحد لـS3 ورفعه إلى `main` ثم التوقف قبل S4.

> S3 ينفذ مساحة اكتشاف وعمليات تجريبية فقط. لا يبدأ S4 أو أي مسار CRM/AI/Sales/Outreach من دون GO صريح من CTO.

## S3-FIX — Results Lifecycle & Date Filtering

- [x] تثبيت عقد Results المتاح فقط عند `job.status === "completed"` لكل Routes والإجراءات المباشرة.
- [x] بناء حالات pending وprocessing وfailed وcancelled من دون Table أو فلاتر أو إجراءات نتائج.
- [x] منع Sidebar وJobs History وJob Detail من توجيه المستخدم إلى Results غير مكتملة.
- [x] فصل قيمة تاريخ Job الآلية عن قيمة العرض أو توحيد helper واحد لفلتر «اليوم».
- [x] اختبار مصفوفة دورة الحياة 5/5 وفلتر «اليوم» والـDirect Route والبناء والانحدار.
- [x] إعداد تقرير S3-FIX وإنشاء commit واحد ورفعه إلى `main` ثم التوقف قبل S4.

> S3-FIX يغلق فقط CTO-S3-01 وCTO-S3-02. لا يبدأ S4 إلا بعد GO صريح جديد من CTO.

## S4 — Results + AI Lead Intelligence

- [x] مراجعة عقود S4 وBaseline `70c059f` وملفات التنفيذ المعتمدة قبل تعديل Architecture.
- [x] بناء مصدر حقيقة مركزي لـBusinessSignal وOpportunityAnalysis وOpportunity وReason وService Catalog من دون نسخ Business.
- [x] توثيق Score حتمي قابل للتفسير وDimensions وTiers وConfidence وEvidence وقاعدة unknown ≠ no.
- [x] تطوير قائمة نتائج الاكتشاف بفرز وفلاتر Score وConfidence وTier ووجود Opportunity من دون إنشاء Lead أو CRM.
- [x] تطوير ملف Intelligence للـBusiness يوضح الإشارات والـEvidence والـScore Breakdown والأسباب والخدمات والنهج المقترح.
- [x] بناء حالات Loading وEmpty وError ومحاكاة تحليل تجريبية وأفعال محجوبة للشحنات اللاحقة.
- [x] تشغيل فحوص نزاهة S4 والبناء والانحدار وDesktop/Tablet/Mobile/RTL وإعداد التقرير.
- [x] إنشاء commit واحد لـS4 ورفعه إلى `main` ثم التوقف قبل S5.

> S4 يفسر فرص Business المكتشفة فقط. لا ينشئ Lead أو Company أو Deal أو CRM ولا يبدأ S5 إلا بعد GO صريح من CTO.

## S4-UX — AI Intelligence Processing Animations

- [x] مراجعة عقد S4-UX وBaseline `1e6fd7e` وتثبيت عدم تغيير Scores أو Signals أو Entity Model.
- [x] تصميم حالة معالجة حتمية من سبع مراحل للفرد والدفعة مرتبطة بنتائج Intelligence Engine نفسها.
- [x] تنفيذ Process Panel للفرد مع Score وConfidence وDimensions وSignals وRecommendations reveal متدرج.
- [x] تنفيذ Batch Processing Panel وRow statuses وملخص مشتق من النتائج الفعلية.
- [x] دعم Error وinsufficient_data وRe-analysis وReduced Motion من دون خلق Score أو Recommendation مصطنعة.
- [x] تشغيل فحوص S4 وS3 وS2-FIX والبناء والاستجابة وإعداد تقرير S4-UX.
- [x] إنشاء commit واحد لـS4-UX ورفعه إلى `main` ثم التوقف قبل S5.

> S4-UX طبقة تجربة فوق Intelligence الحالية فقط؛ لا تغيّر Scoring أو Signals أو Recommendations ولا تنشئ CRM أو تبدأ S5.

## S4-FIX — Counterexample Fixture Contract Alignment

- [x] مراجعة جميع مراجع Fixtures وتحديد النصوص أو الاختبارات التي تخالف عقد CTO المعتمد.
- [x] تثبيت BUS-1042 كفرصة عالية، وBUS-1402 كـStrong Business / Not High Opportunity، وBUS-1404 كـinsufficient_data، وBUS-1403 كـerror/retry في الاختبارات فقط.
- [x] تحديث التوثيق والتقارير المتعارضة دون تغيير scores أو signals أو evidence أو Business data أو Entity IDs.
- [x] إنشاء وتشغيل مصفوفة CTO النهائية 20/20 مع اختبارات S4-UX وS4 وS3 وS2-FIX والبناء.
- [x] إعداد تقرير S4-FIX وإنشاء commit واحد ورفعه إلى `main` ثم التوقف قبل S5.

> S4-FIX مواءمة عقد وتوثيق واختبارات فقط؛ لا تغير بيانات أو منطق S4 ولا تبدأ S5.

## S5 — Lead 360 + CRM

- [x] مراجعة مواصفات S5 وBaseline `6533996` وعقود المشروع قبل تعديل Architecture.
- [x] توسيع نموذج Lead وعقود التحويل والـOwners وLead lifecycle من دون نسخ Business أو Opportunity.
- [x] تنفيذ Conversion Preview وتأكيد الإضافة إلى CRM مع حماية `businessId` من Lead مكررة.
- [x] تنفيذ `#/crm` مع Lead summary والبحث والفلاتر والترتيب وإجراءات bulk المحلية فقط.
- [x] تنفيذ Lead 360 وربطه بالـBusiness وOpportunity وAnalysis وSignals والمصدر والأنشطة والمحادثات والمهام.
- [x] تنفيذ حالات Loading/Empty/Error ومشاهد insufficient data وduplicate lead وCRM value pass-through.
- [x] تشغيل فحوص S5 والبناء والانحدار والاستجابة وإعداد التقرير.
- [x] إنشاء commit واحد لـS5 ورفعه إلى `main` ثم التوقف قبل S6.

> S5 ينشئ Leads CRM بإجراء مستخدم صريح فقط؛ لا يبدأ S6 Pipeline أو Deals أو أي تكامل خارجي من دون GO صريح من CTO.

## S5-FIX — Activity Lifecycle, CRM Operations & Lead Context

- [x] مراجعة عقد S5-FIX وBaseline `5680409` وتثبيت نطاق CTO-S5-01 إلى CTO-S5-05 فقط.
- [x] تحويل Activity إلى عقد event-like مع actorId وmetadata وتحديث lastActivityAt وnextActivityAt المشتقين.
- [x] إصلاح owner/status/priority والنوتس والمهام لتسجل أنواع Activity صريحة وmetadata من المصدر.
- [x] إكمال CRM Summary والأعمدة والفلاتر والترتيب من Leads وBusiness وOpportunity الحية فقط.
- [x] إكمال Lead 360 وConversion Preview بأسلوب التواصل وContact data والحالة الأولية وعقد Contact الموثق.
- [x] تشغيل مصفوفة S5-FIX والانحدار والبناء والاستجابة وإعداد التقرير.
- [x] إنشاء commit واحد لـS5-FIX ورفعه إلى `main` ثم التوقف قبل S6.

> S5-FIX يغلق CTO-S5-01 إلى CTO-S5-05 فقط. لا ينشئ Deals أو Pipeline أو S6 أو تكاملات خارجية.

## S6 — Pipeline + Deals

- [x] مراجعة مواصفات S6 وBaseline `b9da654` وعقود Leads وDeals والإيراد قبل تعديل Architecture.
- [x] توحيد Pipeline وPipelineStage وDeal Contract ومالية الصفقة والاحتمال وسياسة override المركزية.
- [x] تنفيذ `#/pipeline` و`#/deals` وملخصاتهما من Deals المصدرية فقط.
- [x] تنفيذ Create/Edit Deal Preview وحماية التكرار وسياق Lead/Intelligence ومرحلة الإغلاق.
- [x] تنفيذ Win/Loss والـActivity وRevenue boundary وحالات UI من دون إنشاء Revenue أو S7.
- [x] تشغيل فحوص S6 والانحدار والبناء والاستجابة وإعداد التقرير.
- [x] إنشاء commit واحد لـS6 ورفعه إلى `main` ثم التوقف قبل S7.

> S6 يدير Pipeline وDeals محلية فقط؛ لا ينشئ RevenueEvent أو AttributionTouchpoint أو Automation أو يبدأ S7 من دون GO صريح من CTO.

## S6-FIX — Deal Lifecycle, Auditability & Pipeline Consistency

- [x] مراجعة Baseline `5ff367b` وتثبيت نطاق CTO-S6-FIX من دون أي توسع إلى S7 أو Backend أو إعادة تصميم.
- [x] توحيد Deal وDealActivity contract مع التطبيع التوافقي للبيانات القديمة، وlastActivityAt وسياسة الاحتمال الموثقة.
- [x] إصلاح lifecycle الرابحة والخاسرة وحماية الانتقال النهائي، وأحداث القيمة والاحتمال والمرحلة وتاريخ الإغلاق القابلة للتدقيق.
- [x] السماح بصفقات متعددة للـLead مع حماية التكرار الحقيقي حسب Lead والخدمة أو العنوان المطبع والحالة النشطة.
- [x] تنفيذ Drag & Drop للـKanban عبر mutation واحدة مع الإبقاء على بديل لوحة المفاتيح.
- [x] توحيد Dashboard وS6 على selector Pipeline واحد، وإكمال سياق Intelligence والفلاتر والبحث والفرز.
- [x] توسيع `verify-s6.mjs` إلى A–V وتشغيل الانحدار والبناء وفحص الاستجابة وإعداد `S6_FIX_REPORT.md`.
- [x] إنشاء commit واحد باسم `fix: close S6 deal lifecycle and pipeline gaps` ورفعه إلى `main` ثم التوقف قبل S7.

> S6-FIX يغلق فقط عقد الصفقة وسجلها وPipeline. لا يبدأ Inbox أو WhatsApp أو Agent أو Automation أو Revenue Automation من دون GO S7 صريح من CTO.

## S7 — Inbox + WhatsApp Mock

- [x] تثبيت Baseline `038cf04` وحالة Git وقراءة عقود Business وLead وContact وActivity وDeal وPipeline وIntelligence وDashboard وRoutes قبل التعديل.
- [x] بناء عقدين مركزيين مستقلين لـConversation وMessage ومشتقات Inbox، مع fixtures ثابتة ومتنوعة وحماية لا اتصال حقيقي.
- [x] تنفيذ `#/inbox` و`#/inbox/:conversationId` وقائمة المحادثات والرسائل المرتبة والفواصل اليومية ووسم WhatsApp — وضع تجريبي.
- [x] تنفيذ Composer بشري فقط، وحالة الإرسال التجريبية، والردود السريعة، وملحقات metadata، وتسجيل Activity محليًا من دون Auto-send أو AI.
- [x] تنفيذ سياق Lead وBusiness وDeal وIntelligence داخل المحادثة، مع بحث وفلاتر وفرز وحالات unread/read وneeds reply.
- [x] تنفيذ استجابة الجوال عبر قائمة ثم محادثة ثم Context Drawer، وفحص الوصول وبدائل لوحة المفاتيح.
- [x] إضافة `verify-s7.mjs` وتشغيل البناء والانحدار وDesktop/Mobile/RTL وإعداد تقارير S7.
- [x] إنشاء commit واحد لـS7 ورفعه إلى `main` ثم التوقف قبل S8.

> S7 واجهة Inbox وWhatsApp تجريبية محلية فقط. لا WhatsApp Cloud API ولا Meta أو Twilio أو Webhook أو إرسال فعلي أو Agent أو أتمتة أو campaigns أو Backend؛ لا يبدأ S8 من دون GO صريح من CTO.

## S8 — Sales Copilot + AI Sales Agent

- [x] تثبيت Baseline `ee0847a` وحالة Git وقراءة العقود المركزية لـBusiness وLead وIntelligence وDeal وConversation وMessage وActivity وInbox.
- [x] بناء `buildSalesContext` ومحرك توصيات حتمي محلي مع عقود Copilot وAgent وEvidence وConfidence، من دون نسخ مصادر الحقيقة.
- [x] تنفيذ Copilot داخل Inbox: ملخص محادثة وLead وIntelligence وDeals، Suggested Reply، Next Best Action، أسئلة التأهيل، وتفسير الأدلة.
- [x] تنفيذ «استخدام الرد» كإدراج في Composer فقط مع metadata مساعدة، والحفاظ على S7 Human Send و`senderType=user`.
- [x] تنفيذ Agent policy وAction Proposals والموافقة البشرية وسجل التنفيذ والتصعيد، مع mock execution مسموح فقط.
- [x] تنفيذ سلوك الجوال عبر Copilot Drawer، والوصول وReduced Motion، وربط Lead 360 وDashboard بالـselectors المشتركة عند الحاجة.
- [x] إضافة `verify-s8.mjs` وتشغيل البناء والانحدار وDesktop/Mobile/RTL وإعداد تقارير S8.
- [x] إنشاء commit واحد لـS8 ورفعه إلى `main` ثم التوقف قبل S9.

> S8 محاكاة ذكاء اصطناعي حتمية محلية فقط. لا OpenAI أو Anthropic أو Gemini أو LLM أو API أو Backend أو Webhook أو إرسال فعلي أو Agent ذاتي أو Campaign أو Appointment Automation أو S9 من دون GO صريح من CTO.

## UI-FIX — Light Sidebar & Navigation Visual Refresh

- [x] تثبيت Baseline `ace4602` ومراجعة المرجع البصري وتحديد ملفات App Shell وSidebar وTopbar وCSS فقط.
- [x] تحويل Sidebar إلى سطح فاتح بعرض مريح، وعلامة «نمو / مسار القرار»، وتنقل RTL واضح مع أيقونات مرئية وحالات active/hover هادئة.
- [x] تحسين footer المستخدم وscrollbar وحالة collapse من دون تغيير عناصر التنقل أو وظائفها أو المسارات.
- [x] إعادة ضبط Topbar البيضاء وCommand Bar وزر الاكتشاف ومساحة العمل وبطاقات الغلاف والهرمية البصرية وفق المرجع.
- [x] تطبيق استجابة الجوال والوصول وReduced Motion من CSS فقط، من دون تعديل Events أو Routes أو Data أو S2–S8.
- [x] تشغيل البناء وفحوص الانحدار ومعاينة Desktop/Mobile وإعداد تقرير UI-FIX.
- [x] إنشاء commit واحد لـUI-FIX ورفعه إلى `main` ثم التوقف.

> UI-FIX تعديل بصري فقط. لا تغيير Business Logic أو Routes أو S8 أو Copilot أو Agent أو CRM أو Pipeline أو Inbox أو Entity Model أو Data Contracts أو السلوك الوظيفي أو بدء Feature جديدة.

## S8-FIX — Inbox/Copilot Runtime Integration

- [x] إعادة إنتاج `ReferenceError: s8Action is not defined` على `#/inbox` و`#/inbox/:conversationId` من Fresh Load، وتوثيق caller وmodule ownership.
- [x] تحديد ownership الصحيح لمساعد S8 UI المشترك وإصلاح import/export صريح من دون global أو try/catch أو نسخ implementation أو circular dependency.
- [x] إثبات مسار Inbox → Conversation → Copilot → Analyze → Suggested Reply → Composer → Human Send من دون exception.
- [x] إضافة DOM/render smoke test لمساري Inbox والتحكم في Copilot وComposer، وإضافة assertion insert-only ثم Human Send.
- [x] تشغيل regressions S2–S8 وConsole/Network gates وتوثيق بقاء Agent وDeals وRevenue وAttribution سليمة.
- [x] إنشاء `S8_FIX_REPORT.md` ورفع commit واحد إلى `main` ثم التوقف قبل S9.

> S8-FIX يعالج Runtime Integration بين Inbox وCopilot فقط. لا تعديل لمحرك Copilot أو Agent Policy أو approval أو evidence أو confidence أو stale detection أو Lead/Task/Deal/Revenue/Attribution domain logic، ولا LLM أو API أو Backend أو إرسال فعلي أو S9.

## S9 — Automation + Tasks + Appointments

- [x] تثبيت Baseline `b0c0f15` وحالة Git وقراءة S5 Tasks/Activities وS6 Deals وS7 Conversations وS8 Agent وسياسات البيانات والمسارات وDashboard وLead 360 وInbox.
- [x] بناء عقود AutomationRule وConditionGroup وAutomationAction وAutomationRun وAutomationActionExecution وAppointment مع catalogs وسياسات مركزية حتمية.
- [x] تنفيذ محرك Event → Trigger → Conditions → Rule → Policy → Execution → Audit محليًا، مع idempotency ومعالجة unknown وحماية actions الممنوعة.
- [x] تنفيذ `#/automation` و`#/automation/rules/:id` و`#/tasks` و`#/appointments` مع Rule Builder بسيط وتشغيل يدوي ومحاكاة وموافقة وسجل تنفيذ.
- [x] تنفيذ Task وFollow-up وAppointment وسياق Lead/Conversation/Deal المرجعي من دون Calendar API أو جدولة خلفية أو رسائل تلقائية.
- [x] ربط Lead 360 وDashboard وInbox/Agent بالـselectors والـActivities المناسبة من دون نسخ مصدر حقيقة أو تغيير Revenue/Attribution.
- [x] إضافة `verify-s9.mjs` وتشغيل البناء والانحدار وDesktop/Mobile/RTL وإعداد تقارير S9.
- [x] إنشاء commit واحد لـS9 ورفعه إلى `main` ثم التوقف قبل S10.

> S9 محاكاة Automation حتمية محلية داخل session state فقط. لا Scheduler أو cron أو queue أو worker أو Webhook أو WhatsApp/Email auto-send أو Campaign أو Agent autonomous أو Deal Won/Lost أو Deal financial mutation أو Revenue/Attribution أو Calendar API أو Backend أو S10 من دون GO صريح من CTO.

## S9-FIX — Manual Execution, Condition Contract & Audit Traceability

- [x] تثبيت Baseline `6ccf2fb` وقراءة توجيهات CTO وفحوص S9 الحالية ضمن نطاق الإصلاح المحدود فقط.
- [x] تطبيق semantics رسمية لـ`manual_only`: منع trigger التلقائي، والسماح فقط بـRun Now مع actor/mode واضحين وموافقة إن كانت لازمة.
- [x] إضافة `automationConditionFieldCatalog` والتحقق المركزي للـfield/operator/value في create/update/dry-run/manual/event evaluation.
- [x] إضافة eventId وtransition snapshot وهوية idempotency مبنية على Rule/Version/Event/Action، مع حفظ Loop Guard.
- [x] تنفيذ Preview حية مشتقة من Builder، وإكمال Approval Queue وAudit ببيانات السبب والسياسة والـactors والـresult entity.
- [x] توسيع التحقق إلى manual-only والـcondition invalid/event identity/preview/approval trace وتشغيل البناء والانحدار وBrowser runtime.
- [x] إنشاء `S9_FIX_REPORT.md` وcommit واحد ورفعه إلى `main` ثم التوقف قبل S10.

> S9-FIX يصلح فقط policy والشروط والـevent identity وواجهة Preview/Audit. لا إعادة بناء لمحرك S9، ولا Scheduler أو Calendar API أو Messaging أو Deal mutation أو Revenue/Attribution أو Backend أو S10.

## S10 — Analytics + Revenue Attribution

- [x] تثبيت Baseline `19b5850` وجرد عقود Source وJob وBusiness وIntelligence وLead وConversation وDeal وRevenue وAttribution وTask وAppointment وAutomation وAgent قبل التعديل.
- [x] بناء طبقة Analytics selectors و`AnalyticsContext` وMetric Definitions Registry وtime semantics، مشتقة وقراءة فقط من الحقيقة التشغيلية.
- [x] تنفيذ Funnel ذات entity sets وconversion denominators معلنة وMetric drill-down، مع فلاتر الفترة والأبعاد وحالة demo data الصريحة.
- [x] تنفيذ Revenue وAttribution conservation وexplainer وtrace من RevenueEvent إلى Source، مع حالات السلسلة غير المكتملة.
- [x] تنفيذ Source/Job/Sales/Intelligence/Conversation/Automation analytics من selectors مركزية فقط من دون تعديل Deals أو Revenue أو Attribution.
- [x] تنفيذ `#/analytics` و`#/analytics/funnel` و`#/analytics/revenue` و`#/analytics/sources` و`#/analytics/ai` وفلاتر وexport محلي بسيط إذا أمكن.
- [x] إضافة `verify-s10.mjs` وتشغيل البناء والانحدار وDesktop/Mobile/RTL وإعداد تقارير S10.
- [x] إنشاء commit واحد لـS10 ورفعه إلى `main` ثم التوقف قبل S11.

> S10 تحليلات مشتقة وقراءة فقط. لا Backend أو Database أو API أو LLM أو Scheduler أو Billing أو إنشاء RevenueEvent أو تعديل Deals أو Attribution أو منطق الإيراد أو S11 من دون GO صريح من CTO.

## S10-FIX — Time Semantics, Funnel Denominators & Data Quality

- [x] تثبيت Baseline `bfb0caa` وقراءة توجيهات CTO وعقود S10 وfixtures قبل إصلاح التحليلات المحدود.
- [x] إضافة resolver زمني مركزي و`timeMode` لكل metric، مع استبعاد السجل ناقص timestamp من event metric وإظهار missing timestamp في الجودة.
- [x] توثيق Funnel كـcohort وتثبيت عرض denominator صفر في مرحلة لاحقة على `— / لا يوجد مقام سابق` فقط.
- [x] فصل Structural Integrity عن Coverage/Analysis Quality ومنع ظهور الحالة العامة OK عند وجود unknown أو failed أو missing timestamps.
- [x] توحيد Dashboard على selectors S10 للمقاييس المشتركة، وتوثيق owner semantics وmulti-touch attribution semantics في المحرك والواجهة.
- [x] إضافة focus trap وEscape وrestore focus إلى Modal التحليلات مع حفظ RTL وreduced motion.
- [x] توسيع `verify-s10.mjs` وفحص Browser للوقت والقمع والجودة والـmodal والانحدار، ثم إعداد `S10_FIX_REPORT.md`.
- [x] إنشاء commit واحد لـS10-FIX ورفعه إلى `main` ثم التوقف قبل S11.

> S10-FIX يعالج فقط time semantics وfunnel/data quality/dashboard/accessibility/owner/multi-touch semantics. لا تعديل RevenueEvent أو AttributionTouchpoint أو Deal truth، ولا Backend أو API أو Billing أو S11.

## S11 — Integrations + Billing + Settings

- [x] التحقق من Baseline `9b89f91` وحالة Git وعقود الكيانات والمسارات والأسطح ذات الصلة قبل التعديل.
- [x] توحيد عقود Workspace Settings وIntegration وIntegrationActivity وPlan وSubscription وUsage وInvoice وPaymentMethodMock وBillingActivity، محليًا فقط.
- [x] تنفيذ `#/settings` لأقسام مساحة العمل والحساب والفريق والإشعارات والخصوصية التجريبية، مع سجل تدقيق وإعادة استخدام Users الحالية.
- [x] تنفيذ `#/integrations` وكتالوج تكاملات تجريبية، connect/disconnect/retry/configuration محلي وسجل تدقيق وإفصاح Mock وإخفاء الأسرار.
- [x] تنفيذ `#/billing` للخطط والاشتراك والاستخدام والفواتير ووسيلة الدفع التجريبية وتغيير الخطة/الإلغاء المحلي مع فصل كامل عن RevenueEvent.
- [x] إضافة `verify-s11.mjs` وتشغيل سيناريوهات S11 والنزاهة والانحدار والبناء وفحص Desktop/Mobile/RTL.
- [x] إعداد تقارير التنفيذ وQA لشحنة S11، وإنشاء commit واحد ودفعه إلى `main` ثم التوقف قبل S12.

> S11 Settings/Integrations/Billing محلية وتجريبية فقط. لا OAuth أو provider/API أو webhook أو تخزين secrets أو بوابة دفع أو بطاقة حقيقية أو Backend أو Database أو S12. لا تعدّل S11 RevenueEvent أو AttributionTouchpoint أو عقود S2–S10 التشغيلية.

## S12 — End-to-End Demo + Final UX Polish

- [x] تثبيت Baseline `3337932` وجرد المسارات وفحوص S2–S11 وتوثيق فجوات الرحلة النهائية قبل التعديل.
- [x] إصلاح deep links: `#/settings/integrations` و`#/settings/team` و`#/settings/notifications` باستخدام مصدر حقيقة Settings الحالي فقط، مع canonical route/navigation/breadcrumb consistency.
- [x] مراجعة رحلة العرض المتصلة ومساراتها وحالات loading/empty/error/not-found والـCTA والنسخ العربية وواجهة الجوال والوصول، وإصلاح الفجوات ضمن scope فقط.
- [x] توحيد glossary والتوثيق النهائي: `DEMO_GUIDE.md` و`PRODUCT_ARCHITECTURE.md` و`TECHNICAL_DEBT.md` وتقارير S12، مع تنظيف whitespace في تقرير S11.
- [x] إنشاء `verify-s12.mjs` بـ24 بوابة، وتشغيل جميع فحوص الانحدار الفعلية والبناء وفحص Desktop/Mobile/RTL للرحلة.
- [x] إنشاء commit واحد لشحنة S12 ودفعه إلى `main` ثم التوقف قبل V2 أو أي Backend/API حقيقي.

> S12 مغلقة على إصلاحات التكامل النهائي والتنقل والـUX والنسخ والتوثيق فقط. لا Domain جديد ولا Backend أو Database أو OAuth أو دفع حقيقي أو API أو LLM خارجي أو تكاملات تشغيلية أو V2.

## V1-FINAL-FIX — Landing Truth & Financial Reconciliation

- [x] إعادة إنتاج تناقض Landing وAnalytics عند Baseline `e5fbd3f` وتوثيق السبب الجذري للمقاييس وقصة BUS-1042 القديمة.
- [x] توصيل Landing بالـselectors المشتركة لـS10 للحقيقة المالية والتشغيلية، وتحديد دلالة الفترة، وإزالة المقاييس الثابتة غير المؤسسة.
- [x] توحيد ظهور BUS-1042 مع اسمها وسياقها التشغيلي، أو إزالة المعرّف من أي مثال تسويقي لا يتصل بالحقيقة.
- [x] إضافة اختبارات equality بين Landing وS10 ومنع 428k الثابت واختبار عدم mutation المالية والتشغيلية عند فتح Landing.
- [x] تشغيل Browser Landing→Analytics، reconciliation المالية، S12، الانحدار الكامل، البناء، console/network، وفحص 390px.
- [x] إعداد `V1_FINAL_FIX_REPORT.md`، وإنشاء commit واحد ودفعه إلى `main` ثم التوقف قبل V2.

> V1-FINAL-FIX يصلح فقط FND-V1-001 وFND-V1-002. لا تغيير لـRevenueEvent أو AttributionTouchpoint أو BUS-1042 أو Analytics لإجبار المطابقة، ولا fixtures مالية جديدة ولا redesign ولا Backend/API/OAuth/Providers/V2.

## MOBILE-RESPONSIVE-FIX — Post-Acceptance UI Repair

- [x] إعادة إنتاج قص أو تراكب الجوال على Landing وشاشات التطبيق الجوهرية عند 360px و390px و430px، وتسجيل السبب في CSS الحالي.
- [x] تطبيق إصلاحات موضعية للـnavigation والـhero والبطاقات والجداول/الأعمدة من دون تغيير عقود البيانات أو منطق التشغيل.
- [x] إعادة فحص Desktop وMobile، وتشغيل البناء و`git diff --check`، ثم توثيق وإرسال commit واحد قبل التوقف.

> هذا الإصلاح بصري واستجابي فقط. لا يغير الحقيقة التشغيلية أو Revenue/Attribution أو S10 أو UI flows أو نطاق V2.

## SRS-PROTOTYPE-FIT — Read-Only Assessment

- [ ] استخراج المتطلبات الوظيفية وغير الوظيفية الأساسية من وثيقتي SRS الأصليتين.
- [ ] فتح الـPrototype المنشور وفحص الرحلة ومساراته الأساسية مقابل المتطلبات.
- [ ] قياس نسبة المطابقة حسب المجال وتحديد ما هو Prototype Mock وما يحتاج Backend/API أو تكامل فعلي.
- [ ] تقديم نتيجة القراءة فقط للمستخدم من دون تعديل أو commit أو push.

> هذا بند تقييم فقط. لا تعديل للـPrototype أو بياناته أو عقوده أو GitHub.

## CONCEPT-COMPLETENESS-PLAN — Design Only

- [ ] تحديد الرسالة المركزية ونقاط الفهم الإلزامية لمسار «البحث → الاستخراج → القرار: Excel فقط أو CRM نمو».
- [ ] تصميم رحلة عرض بصري كاملة تشمل Google Maps/استخراج، نتائج قابلة للتحديد، تنزيل Excel محليًا، وخيار تحويل النتائج إلى CRM نمو.
- [ ] تحديد الشاشات والحالات والـCTA والنسخ العربية ومعايير قبول وضوح الفكرة قبل أي تنفيذ.
- [ ] تقديم خطة تصميمية للمستخدم من دون تعديل أو commit أو push.

> هذه خطة مفهوم وتصميم فقط. العميل الذي يختار Excel لا يدخل CRM ولا يُطلب منه ربط نظام خارجي؛ العميل الذي يختار CRM ينتقل إلى نمو. لا تغيير للـPrototype إلى أن يوافق المستخدم صراحةً على التنفيذ.

## SCRAPER-OR-CRM — Decision Journey Prototype

- [x] مراجعة discovery/results والتحويل المركزي وعقود الخطط لتثبيت مسار Export أو CRM وباقتيهما المنفصلتين من دون تغيير العقود السابقة.
- [x] تنفيذ شاشة نتائج تشبه Excel مع تحديد صفوف، ملخص أعمدة، وزر تنزيل Excel تجريبي محلي واضح ضمن باقة Scraper.
- [x] تنفيذ بوابة قرار بعد النتائج: «نزّل Excel وانتهى» ضمن Scraper أو «ترقية إلى CRM نمو» ضمن باقة CRM، مع توضيح فرق القيمة.
- [x] تنفيذ تحويل النتائج المحددة إلى CRM نمو محليًا بعد تأكيد ترقية تجريبي، مع معاينة عدد الشركات/Leads وحماية التكرار والربط بالـCRM الحالي.
- [x] إضافة فحص نزاهة للشحنة وتشغيل الرحلة والبناء والانحدارات والمعاينة Desktop/Mobile/RTL.
- [x] إعداد تقرير التنفيذ وQA، ثم commit واحد ودفعه إلى `main` والتوقف قبل Backend أو Scraping/API حقيقي.

> SCRAPER-OR-CRM طبقة تجربة محلية فقط: باقة Scraper للاستخراج والتصدير فقط، وباقة CRM نمو مستقلة لإدارة النتائج والمبيعات. لا Google Maps API أو Scraping أو Excel server أو CRM خارجي أو OAuth أو Backend. Export هو تنزيل CSV بامتداد/تجربة Excel محلية واضحة، وCRM هو مصدر الحقيقة المحلي القائم.

## SRS-PROTOTYPE-FIT-REVIEW-2 — Read-Only Reassessment

- [ ] إعادة قراءة SRS الاستخراج وSRS CRM وتثبيت معيار «وضوح الفكرة البصرية» منفصلًا عن جاهزية الإنتاج.
- [ ] فحص Landing وDiscovery Results وبوابة Scraper أو CRM وCRM/Inbox/Analytics في النسخة المنشورة المحدثة.
- [ ] حساب نسبة مطابقة محدثة من 100 وتحديد ما تبقى فجوة في إيصال الفكرة فقط.
- [ ] تقديم التقرير للمستخدم من دون تعديل أو commit أو push.

> هذا تقييم قراءة فقط للنسخة المنشورة بعد مسار Scraper أو CRM. لا تعديل للـPrototype أو GitHub.

## SCRAPER-DATA-VISIBILITY — Final Concept Polish

- [x] مراجعة حقول Business وCSV الحالية وجدول النتائج لتثبيت أعمدة قيمة الـScraper القابلة للعرض والتصدير.
- [x] إضافة عرض هاتف وبريد وموقع وتواصل اجتماعي/رابط، ولوحة اختيار أعمدة Excel واضحة داخل نتائج الاكتشاف.
- [x] جعل CSV المحلي يلتزم بالأعمدة المختارة مع استمرار مسار CRM المنفصل وحماية الحقيقة التشغيلية.
- [x] تشغيل فحص الشحنة والبناء والمعاينة RTL/Desktop/Mobile، ثم تقرير وcommit واحد قبل التوقف.

> SCRAPER-DATA-VISIBILITY تحسين عرض محلي فقط؛ لا enrichment أو scraping أو API أو provider أو تعديل Business/Revenue/CRM truth.

## REFERENCE-ALIGNMENT — Google Maps Extractor Scenario

- [x] مراجعة تجربة gmapsextractor.com المرئية ومسار المستخدم وملامح البحث والتشغيل والتصدير القابلة للنقل إلى نموذج محلي.
- [x] مواءمة شاشة Scraper في نمو مع تسلسل المرجع: استعلام/موقع → تشغيل → تقدم → جدول نتائج → تصدير، من دون نسخ هوية أو محتوى المرجع.
- [x] إبقاء CRM نمو بوابة اختيارية صريحة بعد نجاح التصدير، لا جزءًا مفترضًا من تجربة استخراج Google Maps.
- [x] تشغيل بناء وفحص بصري وQA، ثم تقرير وcommit واحد ودفعه إلى main قبل التوقف.

> المواءمة تستلهم نمط رحلة المستخدم فقط. لا scraping أو Google Maps API أو استخراج حقيقي أو استخدام لشعارات/صور/نصوص المرجع أو Backend.

## PAYMENT-CHECKOUT-SCENARIO — Full Mock Checkout

- [x] مراجعة Plans وSubscription وInvoice وPaymentMethodMock وBilling routes الحالية لتثبيت مسار دفع تجريبي من مصدر الحقيقة نفسه.
- [x] تنفيذ Checkout متعدد الخطوات: اختيار باقة Scraper أو CRM، بيانات فاتورة تجريبية، ملخص ضريبة/إجمالي، ووسيلة دفع مقنّعة.
- [x] تنفيذ تحقق إدخال محلي وحالات تأكيد ونجاح وفشل وإيصال/فاتورة وسجل دفع، من دون جمع أو تخزين بيانات بطاقة حقيقية.
- [x] ربط نجاح Checkout بالاشتراك المحلي وبالتصدير/CRM وفق الباقة، مع فصل كامل عن RevenueEvent وAttribution.
- [x] إضافة فحص نزاهة لسيناريو الدفع وتشغيل البناء والانحدارات والمعاينة Desktop/Mobile/RTL.
- [x] إعداد تقرير وcommit واحد ودفعه إلى `main` ثم التوقف قبل Stripe أو بوابة دفع أو Backend حقيقي.

> PAYMENT-CHECKOUT-SCENARIO محاكاة محلية فقط. لا تدخل رقم بطاقة أو CVV أو بيانات بنكية حقيقية، ولا Payment Intent أو Stripe أو Gateway أو webhooks أو تحصيل أو تغيير لإيراد العملاء.

## GUIDED-JOURNEY-CLARITY — One Decision at a Time

- [x] تدقيق Landing وDiscovery وResults وبوابة الباقات لتحديد عناصر التشويش والإجراءات المتنافسة في كل مرحلة.
- [x] تنفيذ شريط رحلة ثابت: 1 استخراج، 2 نتائج، 3 اختيار المسار، 4 تفعيل الباقة، مع CTA رئيسي واحد ورسالة الخطوة التالية.
- [x] جعل باقة Scraper أو CRM وCheckout تظهر فقط بعد قرار المستخدم في النتائج، لا قبل أن يفهم قيمة الاستخراج.
- [x] فحص Landing → Discovery → Results → Excel/CRM → Checkout على Desktop/Mobile/RTL، ثم تقرير وcommit واحد قبل التوقف.

> GUIDED-JOURNEY-CLARITY ترتيب UX ونسخ فقط. لا يغير بيانات التشغيل أو Revenue/Attribution ولا يضيف Backend أو دفعًا حقيقيًا.

## SIDEBAR-SEMANTIC-ICONS — Navigation Clarity

- [x] جرد عناصر Sidebar والأيقونات الحالية وربط كل Route بأيقونة دلالية مستقرة وlabel وصولي.
- [x] استبدال الأيقونات العامة بأيقونات متوافقة مع المعنى، بما فيها WhatsApp للمحادثات والاكتشاف وCRM والصفقات والتحليلات والإعدادات.
- [x] فحص Desktop/Mobile وRTL والبناء، ثم تقرير وcommit واحد ودفعه إلى main قبل التوقف.

> هذا تحسين تنقل بصري فقط؛ لا يغير المسارات أو البيانات أو منطق التواصل أو تكامل WhatsApp التجريبي.

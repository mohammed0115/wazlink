# ROUTES — S0 Navigation Contract

**صيغة التنقل:** Hash Router  
**اللغة:** Arabic RTL native  
**قاعدة S0:** كل route معروف يعرض إما شاشة S0 منفذة أو Placeholder يوضح الشحنة اللاحقة؛ لا توجد dead links.

## 1. المسارات الحالية والمخططة

| Route | الحالة في S0 | الهدف | نوع العرض |
|---|---:|---|---|
| `#/` | منفذ | الصفحة التعريفية | Public |
| `#/login` | منفذ | الدخول التجريبي | Public |
| `#/onboarding` | منفذ | إعداد مساحة العمل التجريبية | Public |
| `#/dashboard` | منفذ | الرئيسية | App Shell |
| `#/ui-kit` | منفذ في S0 | نظام التصميم الداخلي | App Shell |
| `#/discovery` | منفذ في S3 | طلب اكتشاف | App Shell |
| `#/discovery/jobs` | منفذ في S3 | سجل عمليات الاكتشاف | App Shell |
| `#/discovery/jobs/:id` | منفذ في S3 | تفاصيل عملية اكتشاف | App Shell |
| `#/discovery/results` | منفذ في S3 | نتائج الاكتشاف التجريبية | App Shell |
| `#/intelligence?business=BUS-####` | منفذ في S4 | ملف ذكاء Business قابل للتفسير | App Shell |
| `#/lead-profile` | alias محدود في S4 | يفتح Intelligence للسجل المختار ولا ينشئ Lead | App Shell |
| `#/leads` | موجود كمرجع واجهة | العملاء المحتملون | App Shell |
| `#/contacts` | Placeholder | جهات الاتصال | App Shell |
| `#/companies` | Placeholder | الشركات | App Shell |
| `#/pipeline` | منفذ في S6 | Pipeline | App Shell |
| `#/deals` | منفذ في S6 | الصفقات | App Shell |
| `#/deals/:id` | منفذ في S6 | تفاصيل الصفقة | App Shell |
| `#/tasks` | موجود كمرجع واجهة | المهام | App Shell |
| `#/appointments` | Placeholder | المواعيد | App Shell |
| `#/inbox` | منفذ في S7 | قائمة Inbox التجريبية | App Shell |
| `#/inbox/:conversationId` | منفذ في S7 | تفاصيل محادثة واحدة | App Shell |
| `#/whatsapp` | alias في S7 | يفتح Inbox التجريبية | App Shell |
| `#/calls` | Placeholder | المكالمات | App Shell |
| `#/copilot` | منفذ في S8 | مساحة مراجعة Copilot الحتمية المحلية | App Shell |
| `#/agent` | منفذ في S8 | Agent محكوم بالموافقة وسجل الإجراءات | App Shell |
| `#/automation` | موجود كمرجع واجهة | الأتمتة | App Shell |
| `#/analytics` | موجود كمرجع واجهة | التحليلات | App Shell |
| `#/integrations` | موجود كمرجع واجهة | التكاملات | App Shell |
| `#/billing` | موجود كمرجع واجهة | الفوترة | App Shell |
| `#/settings` | موجود كمرجع واجهة | الإعدادات | App Shell |

## 2. قواعد سلوك التنقل

| الحالة | السلوك المطلوب |
|---|---|
| اختيار عنصر Sidebar | تحديث hash، Active state، وBreadcrumb فورًا. |
| فتح Business من Results | حفظ `selectedBusinessId` ثم فتح `#/intelligence?business=BUS-####` للسجل نفسه. |
| فتح محادثة | حفظ `selectedConversationId` ثم إعادة رسم Inbox بالرسائل والسياق الصحيحين. |
| Browser Back/Forward | الاستماع إلى `hashchange` وإعادة رسم route دون كسر الحالة المشتركة. |
| route مستقبلية | Placeholder واضح باسم الشاشة ورقم الشحنة المستهدفة، مع مسار عودة. |
| شاشة عامة | لا يظهر App Shell في Landing أو Login أو Onboarding. |
| شاشة داخلية | تظهر Sidebar وTopbar ومنطقة الإشعارات وسياق المستخدم. |

## 3. Breadcrumb Contract

صيغة الـBreadcrumb في S0 هي: **مساحة العمل › الوحدة › الشاشة**. لا يفرض S0 Breadcrumb متعدد المستويات لكل كيان، لكنه يضمن أن عنوان الشاشة وحالة Active navigation متسقان مع route الحالي.

## 4. Back Behavior

1. يمنع S0 الروابط الميتة عبر تحويل كل هدف غير منفذ إلى Placeholder ذي معنى.  
2. الروابط الكيانية تستخدم route واضحًا مع الحالة الحالية في الذاكرة؛ في الإنتاج ستتحول إلى معرفات داخل URL.  
3. لا تُبنى deep-link semantics نهائية قبل اعتماد نموذج المصادقة والـtenant في الشحنات اللاحقة.

## 5. إضافات S3

تستخدم S3 المسارات الأربعة أعلاه كعقود Canonical. تبقى المسارات التاريخية `#/discovery-jobs` و`#/job` و`#/results` aliases محلية إلى المسارات الجديدة كي لا تنتج روابط ميتة. لا تفتح S3 أي مسار Intelligence أو CRM أو Sales من نتائج الاكتشاف؛ تعرض هذه العناصر فقط كمرحلة لاحقة غير منفذة.

## 6. إضافات S4

تستخدم S4 `#/intelligence?business=BUS-####` كـdeep link لملف Intelligence. يقرأ التطبيق `business` من Hash ويحفظه في `selectedBusinessId` قبل الرسم. تبقى `#/lead-profile` alias لسطح Intelligence فقط، ولا ينشئ هذا المسار Lead أو CRM أو Deal أو Pipeline mutation.

## 7. إضافات S5

تستخدم S5 المسارين `#/crm` لقائمة Leads و`#/crm/leads/:id` لملف Lead 360. يقرأ التطبيق `:id` ويحفظه في `selectedLeadId` قبل الرسم. يبدأ التحويل من Business/Intelligence عبر Conversion Preview ولا ينشئ Lead إلا بعد التأكيد؛ يعيد التحويل المكرر إلى Lead الموجودة بدل إنشاء نسخة ثانية. تبقى `#/leads` alias آمنة لقائمة CRM، وتبقى Routes Pipeline وDeals في Placeholder حتى S6.

## 8. إضافات S6

تستخدم S6 `#/pipeline` لمسار المبيعات و`#/deals` لقائمة الصفقات و`#/deals/:id` لتفاصيل صفقة واحدة. يحفظ التطبيق `:id` في `selectedDealId` قبل الرسم. تبدأ إنشاء الصفقة من Lead 360 عبر Preview صريح، ولا تنشأ Deal عند فتح النموذج. تعيد محاولة إنشاء Deal مفتوحة لنفس Lead إلى الصفقة القائمة. تبقى Routes S7 وما بعده Placeholders آمنة.

## 9. إضافات S7

تستخدم S7 `#/inbox` لعرض قائمة المحادثات المحلية و`#/inbox/:conversationId` لفتح Conversation محددة. يقرأ التطبيق `:conversationId` من Hash ويحفظه في `selectedConversationId`، ثم يعلّم الرسائل الواردة في المحادثة مقروءة محليًا قبل الرسم. يعرض `#/whatsapp` Inbox نفسها كـalias تجريبي ولا يمثل تكامل WhatsApp فعليًا.

يبقى Browser Back/Forward متسقًا مع Hash؛ يعرض المعرّف غير الموجود حالة واضحة قابلة للعودة إلى Inbox. لا تنشئ زيارة `#/inbox` رسالة أو محادثة أو Reply. لا يبدأ الإرسال إلا من Composer بشري صريح داخل Conversation مفتوحة، وتظل عمليات الإغلاق والإسناد وإعادة المحاولة تغيرات داخل الذاكرة فقط.

## 10. إضافات S8

تفتح `#/copilot` مساحة مراجعة Copilot الحتمية المحلية، وتفتح `#/agent` سجل Agent وسياسة الموافقات. لا ينشئ فتح المسار رسالة أو Task أو تعديل Lead أو Deal. يبدأ التحليل فقط بفعل مستخدم صريح، ويظل «استخدام الرد» إدراجًا في Composer. تعرض مسارات Agent المقترحات وسجلها، ولا تنفذ Action قبل موافقة بشرية ضمن سياسة مركزية. لا يمثل أي مسار تكامل LLM أو WhatsApp أو API أو Backend أو Automation.

## 11. إضافات S9

تفتح `#/automation` مساحة قواعد الأتمتة المحلية، وتفتح `#/automation/rules/:id` تفصيل Rule واحدة من `selectedAutomationId`. تعرض `#/tasks` قائمة المهام من مصدر S5 نفسه مع provenance للأتمتة، بينما تعرض `#/appointments` المواعيد المحلية فقط. لا يؤدي فتح أي من المسارات إلى تشغيل Rule أو إنشاء Task أو Appointment أو إرسال رسالة.

يبدأ الاختبار الجاف من Rule بقراءة Fixture فقط. يبدأ التشغيل من زر Run Now يدويًا، وتظهر actions ذات `approval_required` في قائمة انتظار الموافقة قبل Domain Function. لا تمثل هذه المسارات Scheduler أو Calendar أو Workflow service أو تكامل خارجي، وتبقى كل النتائج في الذاكرة الحالية.

## 12. إضافات S10

تفتح `#/analytics` الملخص التنفيذي المشتق، بينما تفتح `#/analytics/funnel` القمع، و`#/analytics/revenue` تفسير الإيراد والإسناد، و`#/analytics/sources` أداء المصادر وJobs، و`#/analytics/sales` Pipeline والمبيعات، و`#/analytics/ai` الذكاء والتواصل والأتمتة والمواعيد والمهام. تحفظ الفلاتر في `AnalyticsContext` داخل الذاكرة وتعيد الرسم فقط؛ لا ينشئ فتح Route أو تغيير فلتر أي Business أو Lead أو Message أو Task أو Appointment أو Deal أو Revenue أو Attribution.

يفتح Drill-down Modal مجموعة Entity IDs الداخلة إلى metric أو Funnel Stage، ويفتح Revenue Trace السلسلة الكاملة للمراجع أو missing refs. تصدير CSV محلي من `#/analytics` يعيد صفوف Attribution المشتقة فقط، ولا يمثل نقل بيانات إلى خدمة خارجية.

## 13. إضافات S11

تفتح `#/settings` مركز إعدادات مساحة العمل والحساب والفريق والإشعارات والخصوصية التجريبية، وتحتوي روابط صريحة إلى `#/integrations` و`#/billing`. تحفظ تغييرات الاسم والتوقيت والعملة والإعداد المحلي وتفضيلات الإشعارات والحالة التجريبية للفريق في مصدر الحقيقة المحلي، وتضيف أثر تدقيق. لا يؤدي فتح هذه المسارات أو حفظها إلى اتصال خارجي أو دعوة بريد أو تغيير CRM أو رسالة أو إيراد.

تفتح `#/integrations` كتالوجًا معلنًا للحالات والقدرات التجريبية، بما فيها الخطأ وإعادة المحاولة. الربط والفصل والإعداد يعرضون **«اتصال تجريبي / Mock»** ويغيرون الذاكرة وسجل IntegrationActivity فقط؛ لا OAuth ولا API keys ولا provider request، وتظل S7 Inbox وS8 Copilot وS9 Automation تعمل كـMock مستقل حتى عند `not_connected`.

تفتح `#/billing` اشتراك المنصة وخططها واستخدامها وفواتيرها ووسيلة الدفع التجريبية. تفتح معاينة تغيير الخطة قبل confirmation المحلي وتعرض تحذيرًا عند تجاوز usage حد الخطة المستهدفة، ولا تحذف بيانات عند downgrade. تبقى الفوترة منفصلة عن `RevenueEvent` و`AttributionTouchpoint` في S10 ولا تؤثر على ميزات المنتج أو معالجة دفع حقيقية.

## 14. إغلاق S12 — Deep Links ومسار العرض

المسارات canonical لإعدادات S11 هي `#/settings/integrations` و`#/settings/billing`، مع دعم `#/integrations` و`#/billing` كـaliases انتقالية. تفتح `#/settings/team` و`#/settings/notifications` القسم المطابق داخل Settings بدل Placeholder. يعكس Topbar وBreadcrumb القسم نفسه، ويبقى عنصر Sidebar «الإعدادات» نشطًا في كل `#/settings/*`.

على الشاشات الصغيرة تصبح Sidebar Drawer مخفية افتراضيًا وتفتح بزر القائمة، ولا تحجز عرض الصفحة. يبقى التمرير الأفقي محصورًا داخل الحاويات المناسبة للـPipeline والجداول وصندوق الوارد بدل جسم التطبيق.

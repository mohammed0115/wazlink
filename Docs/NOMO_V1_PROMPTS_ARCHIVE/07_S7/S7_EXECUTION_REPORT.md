# تقرير تنفيذ S7 — Inbox + WhatsApp Mock

**الحالة:** مكتملة تقنيًا، بانتظار قرار CTO قبل S8.  
**النطاق:** واجهة Inbox ورسائل بشرية محلية في قناة WhatsApp تجريبية؛ لا Backend ولا اتصال قناة حقيقي.

## الملخص التنفيذي

تضيف S7 طبقة التواصل التشغيلي فوق Lead 360 من خلال `Conversation` و`Message` و`ConversationActivity` مستقلة. تضع الواجهة قائمة محادثات قابلة للبحث والفرز، Thread تفصيلي، Composer بشري، وصول سريع إلى سياق CRM، وقواعد تمنع الخلط بين المحادثة والإيراد أو Pipeline.

> WhatsApp في S7 هو **وضع تجريبي محلي فقط**. لا توجد API أو Webhook أو Meta أو Twilio أو إرسال خارجي أو رد تلقائي أو Agent أو Automation.

| المجال | التنفيذ | الحماية |
|---|---|---|
| عقد Inbox | Conversations وMessages ومشتقات مركزية في `data.js` | كل Conversation تشير إلى Lead، وكل Message تشير إلى Conversation. |
| Fixtures | أربع Conversations A–D، وحالة Lead بلا محادثات، وأربع قوالب رد ثابتة | تشمل unread ووسائط وunknown contact وclosed وfailed. |
| الرسائل | Composer بشري، وصف مرفق تجريبي، queued → sent → delivered، وإعادة محاولة failed | لا ينشئ الإرسال أي طلب شبكة أو Message مكررة. |
| التدقيق | ConversationActivity وLead Activity مرتبطتان بـ`messageId` والطابع الزمني نفسه | يعرض Lead Timeline أثر الإرسال وإعادة المحاولة. |
| عمليات المحادثة | read، close، reopen، assignment | لا يغلق النظام المحادثة مع unread inbound؛ مسؤول Conversation لا يغير مالك Lead. |
| السياق | Lead وBusiness وContact وIntelligence وDeals وProvenance | Intelligence وDeals مراجع للقراءة فقط. |

## المسارات والواجهة

| المسار | السلوك |
|---|---|
| `#/inbox` | قائمة المحادثات؛ على الجوال تبدأ بالقائمة لتقليل التزاحم. |
| `#/inbox/:conversationId` | يفتح Thread محددًا ويعلّم الرسائل الواردة مقروءة محليًا. |
| `#/whatsapp` | alias محلي إلى Inbox التجريبية، وليس تكامل WhatsApp. |

تستخدم مساحة Desktop قائمة محادثات وThread وسياق CRM في نظام واحد. تستخدم مساحة الجوال تسلسل **قائمة → محادثة → Context Drawer**، مع زر رجوع للمحادثات وبديل أزرار واضح لكل عملية لا تعتمد على السحب أو المؤشرات البصرية وحدها.

## التكاملات المحمية

ارتبطت محادثات Lead 360 ببيانات S7 الحقيقية بدل placeholder، وعرض Dashboard آخر محادثات من selectors Inbox الموحدة. لم تغيّر S7 Business أو Opportunity أو Score أو Deal أو Pipeline أو RevenueEvent أو AttributionTouchpoint. بقيت سلسلة S2 للإيراد والإسناد ومشتقات S6 للـPipeline خارج أي mutation في S7.

## الملفات الأساسية

| الملف | الأثر |
|---|---|
| `client/js/data.js` | عقد S7 وfixtures وselectors وmutations المحلية. |
| `client/js/inbox.js` | Inbox وThread وComposer وContext وQuick Replies. |
| `client/css/s7.css` | RTL وDesktop والجوال وحالات التسليم والهوية البصرية. |
| `client/js/app.js` | Routes S7 وأحداث الإرسال والقراءة والإغلاق والإسناد. |
| `client/js/crm.js` و`client/js/dashboard.js` | ربط Lead 360 وDashboard بمصدر Inbox الموحد. |
| `scripts/verify-s7.mjs` | مصفوفة S7 والعزل المالي والشبكي. |

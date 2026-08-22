# S8-FIX REPORT — Inbox/Copilot Runtime Integration

**Baseline:** `7f8323d` (UI-FIX)  
**نوع الإصلاح:** Runtime Integration محدود بين Inbox وCopilot  
**الحالة:** مكتملة تقنيًا، بانتظار اعتماد CTO قبل S9.

## السبب الجذري

كان `contextPanel()` في `client/js/inbox.js` يستدعي `s8Action(...)` عند رسم زري «السياق» و«مساعد المبيعات». كانت الدالة معرّفة محليًا داخل `client/js/sales-ai.js` فقط، وغير متاحة في module scope الخاص بـInbox. لذلك كان التحميل الجديد لمساري `#/inbox` و`#/inbox/:conversationId` يرمي `ReferenceError` ويوقف `renderInbox` قبل ظهور القائمة أو Thread أو Composer.

| المكوّن | قبل S8-FIX | بعد S8-FIX |
|---|---|---|
| ownership للمساعد | تعريف محلي غير قابل للاستيراد داخل `sales-ai.js`. | وحدة واجهة مستقلة `client/js/s8-ui-actions.js`. |
| Inbox | استدعاء غير معرّف لـ`s8Action`. | import صريح من الوحدة المشتركة. |
| Sales AI | تعريف inline لنفس markup. | import صريح من الوحدة المشتركة نفسها. |
| الاعتماديات | فشل runtime عند render Inbox. | لا global ولا duplicate implementation ولا dependency دائرية. |

> الوحدة الجديدة تولد markup لزر `data-s8-action` فقط. لا تنفذ Copilot أو Agent أو CRM أو Messaging أو أي Domain Logic.

## الإصلاح وحدود النطاق

أضيفت وحدة UI صغيرة تصدر `s8Action` واستوردتها `inbox.js` و`sales-ai.js`. لم يتغير محرك Sales Context أو Decision Records أو Policy Agent أو Approval أو Evidence أو Confidence أو Stale Detection. كما لم تتغير Domain Functions أو Lead أو Task أو Deal أو Pipeline أو RevenueEvent أو AttributionTouchpoint أو الإرسال البشري في S7.

## التحقق

| البوابة | النتيجة | الدليل |
|---|---:|---|
| Fresh Inbox render | PASS | `#/inbox/CONV-3042` عرض قائمة المحادثات وThread وContext وComposer بعد التحميل الجديد. |
| Context switch | PASS | الانتقال من CRM Context إلى Copilot داخل Conversation ظهر من دون exception. |
| Copilot analysis | PASS | ظهر Summary وNBA وSuggested Reply وEvidence بثقة 87% من المحاكاة المحلية. |
| Insert-only | PASS | اختبار runtime يثبت أن استخدام الرد يملأ `state.inboxDrafts` ولا ينشئ Message. |
| Human Send | PASS | الإرسال اللاحق أنشأ Message واحدة `outbound/user` محلية فقط مع metadata مساعدة. |
| Runtime smoke | PASS | `node scripts/verify-s8-runtime.mjs`: 11/11. |
| S8 regression | PASS | `node scripts/verify-s8.mjs`: 22/22. |
| S2–S7 regressions | PASS | فحوص S7 وS6 وS5 وS4 وS4-UX وS3 وS2-FIX ناجحة. |
| Build | PASS | `pnpm build` نجح بعد تحويل 28 وحدة. |

## تغطية الاختبار الجديدة

يهيئ `verify-s8-runtime.mjs` shim صغيرًا للـdocument/window كي يستورد `inbox.js` عبر module boundary الحقيقي ثم يستدعي `renderInbox` لمسار Inbox ومسار Conversation. يفحص وجود قائمة المحادثات وتحكم Copilot وComposer، ويتأكد من عدم بقاء رمز `s8Action(` غير محلول في HTML الناتج. بعد ذلك يشغل Copilot، ويختبر أن Suggested Reply تدخل Composer فقط، ثم يختبر أن `sendMockMessage` ينشئ outbound Message واحدة من `senderType=user`.

## ملاحظة على التحقق اليدوي

في جلسة المتصفح ظهر أن click adapter الخارجي لم يطلق مرة واحدة Listener المخصص لـ`data-s8-action`، بينما `element.click()` داخل الصفحة فعل Listener نفسه وأثبت إدراج الرد وتحول السياق. بعد ظهور الرد في Composer، زر **إرسال بشري** أنشأ الرسالة المحلية بنجاح وأظهر نص عدم الإرسال الخارجي. هذه ملاحظة عن أداة التحقق، وليست خطأ تطبيق: smoke test وlistener داخل الصفحة والمسار البشري جميعها اجتازت.

## قرار النطاق

لا تضيف S8-FIX أي اتصال خارجي أو LLM أو Webhook أو API أو إرسال WhatsApp حقيقي أو Agent ذاتي أو Automation أو S9. التوصية هي إعادة مراجعة CTO لمسار S8 بعد هذا الإصلاح، مع استمرار التوقف قبل S9 حتى GO صريح.

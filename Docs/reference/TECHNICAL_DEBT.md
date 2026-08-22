# الدين التقني المؤجل إلى V2

هذه القائمة ليست بديلًا عن إصلاح عائق في S12. لا توجد Critical أو Major blockers معروفة في Prototype الحالي؛ البنود التالية تتطلب نطاقًا ومعمارية تشغيلية جديدة.

| البند | سبب التأجيل | يتطلب |
|---|---|---|
| Persistence وDatabase | النموذج الحالي يعيد Fixtures عند refresh. | Backend، migrations، سياسات حفظ. |
| Auth وRBAC إنتاجيان | Login تجريبي ولا توجد جلسة هوية دائمة. | Identity provider، authorization، audit production. |
| Google Maps/Discovery حقيقي | Discovery الآن lifecycle محلي ببيانات Fixture. | Provider contract، quotas، consent، jobs. |
| WhatsApp/Email/Calendar حقيقي | لا يمكن استبدال Mock بطلبات شبكة مباشرة. | OAuth/secrets vault/webhooks/transport policy. |
| LLM حقيقي | Copilot حتمي ومحلي عمدًا. | Model gateway، privacy، cost controls، evaluation. |
| Billing حقيقي | لا توجد معالجة بطاقة أو فوترة قانونية. | Payment provider، PCI scope، tax/invoices. |
| Scheduler/Workers | Automation session-local فقط. | Queue، idempotency store، observability، retries. |
| Observability إنتاجية | لا توجد metrics أو tracing تشغيليان. | Logging، alerts، retention، dashboards. |
| E2E framework | الفحوص الحالية Node integrity + visual passes. | Playwright/Cypress، CI، test environment. |
| إدارة الأصول والملفات | لا يوجد file storage تشغيلي. | S3/storage policy، scanning، permissions. |

> أي تنفيذ لهذه البنود يبدأ بعد موافقة CTO في نطاق V2 مستقل، ولا يغير حكم إغلاق S12 الحالي.

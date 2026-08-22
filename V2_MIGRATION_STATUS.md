# V2 Migration Status

تسجل هذه الوثيقة حالة كل مساحة V1 بعد V2-S0. كلمة **React-native** تعني أن الشاشة تعمل من شجرة React الحالية. **Legacy dependency** هنا تعني اعتمادها على تنفيذ mock/domain تاريخي خلف adapter، وليس وجود HTML أو Vanilla entrypoint منافس.

| Feature | React route | React status | Legacy dependency | ملاحظة |
|---|---|---|---|---|
| Landing | `#/landing` | React-native | Mock data عند الحاجة | صفحة عامة |
| Login | `#/login` | React-native | لا يوجد auth حقيقي | Auth خارج S0 |
| Onboarding | `#/onboarding` | React-native | Session/mock state | لا يوجد account provisioning |
| Dashboard | `#/dashboard` | React-native | `services/data` → mock domain | attribution contracts محفوظة |
| Discovery | `#/discovery` | React-native | mock discovery engine | لا يوجد scraper حقيقي |
| Jobs | `#/discovery/jobs` | React-native | mock jobs | aliases V1 محفوظة |
| Results | `#/discovery/results` | React-native | mock result data | لا يوجد API |
| Intelligence | `#/intelligence` | React-native | deterministic intelligence engine | لا يوجد AI provider |
| CRM | `#/crm` | React-native | mock CRM records | لا يوجد database |
| Lead 360 | `#/crm/leads/:id` | React-native | mock CRM records | businessId/sourceJobId محفوظان |
| Deals | `#/deals` | React-native | mock deal/pipeline data | math في domain |
| Pipeline | `#/pipeline` | React-native | mock pipeline data | لا تغيير في calculations |
| Inbox | `#/inbox` | React-native | mock conversation data | WhatsApp تجريبي فقط |
| Copilot | `#/copilot` | React-native | local simulation | لا provider خارجي |
| Agent | `#/agent` | React-native | local simulation | policy خارج S0 |
| Automation | `#/automation` | React-native | mock automation data | لا scheduler/backend |
| Tasks | `#/tasks` | React-native | mock task data | — |
| Appointments | `#/appointments` | React-native | mock appointment data | — |
| Analytics | `#/analytics` | React-native | mock analytics engine | export محلي فقط |
| Settings | `#/settings` | React-native | mock settings model | لا user/auth backend |
| Integrations | `#/settings/integrations` | React-native | mock integration model | لا connectors حقيقية |
| Billing | `#/settings/billing` | React-native | mock subscription/checkout | لا billing حقيقي |

## قرار legacy

لا يوجد `client/js` أو `app.js` أو HTML قديم داخل source الحالي. أما `client/src/domain/data.js` وملفات domain JavaScript فهي **مرجع تشغيل Prototype** وليست entrypoints متنافسة. تبقى مؤقتًا لأن React يعتمد عليها عبر `services/data.ts` ولأن سياسة الحذف تتطلب إثبات regression قبل الإزالة.

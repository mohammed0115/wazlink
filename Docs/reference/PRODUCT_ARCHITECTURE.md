# ملخص عمارة المنتج

تستخدم «نمو» واجهة **React 19 + TypeScript** تعمل داخل المتصفح مع Hash Routing وFixtures محلية في `client/js/data.js`. لا توجد طبقة خادم تشغيلية أو قاعدة بيانات أو شبكة مقدمي خدمات. تمثل `mockModel` مصدر الحقيقة للكيانات، بينما تصدر كل شاشة selectors أو Domain Functions محكومة فوقه.

> **حالة الحزمة:** بُنيت V1 بـHTML/CSS/Vanilla JavaScript، وتجري حاليًا شحنة تحويل طبقة العرض إلى React.
> نقطة الدخول `client/index.html` تحمّل `/src/main.tsx`، ولم تعد `client/js/app.js` تُنفَّذ.
> **طبقة النطاق لم تتغير:** الكيانات والـdomain functions تبقى في `client/js/*.js` كما هي، وهي خالية من أي اعتماد على DOM.
> المسارات المحوّلة وغير المحوّلة موثقة في `REACT_MIGRATION_REPORT.md`.

```text
Source
  ↓
Discovery Job
  ↓
Business + Intelligence
  ↓
CRM Lead + Contact + Activity
  ↓
Deal + Pipeline
  ↓
Conversation + Human Message
  ↓
Copilot / Agent Proposal
  ↓
Automation → Task / Appointment
  ↓
Analytics + Revenue Attribution
  ↓
Settings / Integrations / Billing Mock
```

| الطبقة | المسؤولية | الحد المحفوظ |
|---|---|---|
| S3–S4 | Discovery وIntelligence | التحليل لا ينشئ Lead أو Deal أو Revenue تلقائيًا. |
| S5–S6 | CRM وDeals وPipeline | Deal تربط Lead وBusiness؛ won لا ينشئ RevenueEvent. |
| S7–S8 | Inbox وCopilot وAgent | الإرسال بشري فقط؛ Agent مقترحات تتطلب موافقة. |
| S9 | Automation وTasks وAppointments | Idempotency وloop guard وmanual-only؛ لا scheduler خارجي. |
| S10 | Analytics وAttribution | طبقة مشتقة قراءة فقط؛ event/snapshot وmulti-touch معلنان. |
| S11 | Settings وIntegrations وBilling | محلي وMock؛ لا OAuth أو secret حقيقي أو دفع أو إيراد عملاء. |
| S12 | E2E/UX/Routes/Docs | لا Domain جديد؛ يصلح الرحلة وواجهتها فقط. |

## قواعد الحقيقة والحدود

الإيراد المعترف به يقرأ من RevenueEvent فقط، وإسناد الإيراد لا يتجاوز مبلغ الحدث. Billing Domain لا يكتب RevenueEvent أو AttributionTouchpoint. تستخدم Settings وIntegrations وBilling الذاكرة المحلية نفسها مع audit مستقل، ولا تعيد تعريف Users أو Owners. تحافظ المسارات العميقة على نفس route state؛ `#/settings/integrations` و`#/settings/billing` canonical، بينما `#/integrations` و`#/billing` aliases مدعومة للانتقال السابق.

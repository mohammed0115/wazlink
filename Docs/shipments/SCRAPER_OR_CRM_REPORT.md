# SCRAPER-OR-CRM — Execution & QA Report

**Baseline:** `2d9db3e`  
**Scope:** رحلة محلية بصرية فقط بعد نتائج الاكتشاف: باقة Scraper للتنزيل أو باقة CRM نمو مستقلة لإدارة المبيعات.  
**الحالة:** مكتملة تقنيًا؛ لا Backend أو استخراج حقيقي أو Provider أو V2.

## قرار المنتج المنفذ

لا يفترض النموذج أن كل مستخدم يحتاج CRM. بعد تحديد شركات من نتائج Job مكتملة، يعرض المنتج قرارًا واضحًا:

| المسار | الباقة | النتيجة | ما لا يحدث |
|---|---|---|---|
| **Scraper فقط** | باقة Scraper — من 99 ر.س/شهريًا | تنزيل CSV محلي متوافق مع Excel للنتائج المحددة | لا Lead أو Deal أو CRM أو دفع أو اتصال خارجي. |
| **المبيعات داخل نمو** | باقة CRM نمو — من 299 ر.س/شهريًا | معاينة ترقية محلية ثم تحويل الشركات إلى Leads مع provenance | لا Payment أو OAuth أو CRM خارجي أو RevenueEvent. |

## التنفيذ

أضيفت `scraperCrmPackages` كتعريف مرئي محلي لباقتي Scraper وCRM. تعرض Landing مسارين بوضوح قبل بدء التجربة، بينما تعرض شاشة النتائج S4 الشريط «هذه النتائج جاهزة للتنزيل حتى لو لم تستخدم CRM» وزر «Excel أو CRM نمو» بعد اختيار الصفوف.

بوابة القرار تعرض ميزات وسعرًا تجريبيًا لكل باقة وتفصح أن كل الخيارات محلية. مسار Excel يصدر ملف CSV باسم `nomo-scraper-JOB-xxxx.csv` مع UTF-8 BOM كي يفتح في Excel باللغة العربية. مسار CRM يعرض عدد الشركات المحددة وLeads الجديدة وLeads المكررة قبل التأكيد، ثم يعيد استخدام `convertBusinessToLead()` القائم للحفاظ على مصدر الاكتشاف وحماية التكرار.

## إصلاح سلوكي تابع

كشف الاختبار أن النقر على أي زر داخل modal كان يفقع إلى backdrop ذي `data-action=close-discovery-modal` فيغلقه بعد الإجراء مباشرة. عُدل binder العام بحيث لا يغلق backdrop إلا عند النقر عليه نفسه. أصبح Success الخاص بالتصدير ومعاينة ترقية CRM ثابتين وقابلين للمراجعة.

## QA

| البوابة | النتيجة |
|---|---:|
| `verify-scraper-or-crm.mjs` | PASS — 15/15 |
| باقتان منفصلتان ومعرفات/مزايا مختلفة | PASS |
| نتائج Job مكتملة فقط | PASS |
| CSV محلي بلا network | PASS |
| قرار ظاهر في renderer النتائج S4 وLanding | PASS |
| حماية duplicate عند التحويل | PASS |
| تحويل Business جديدة إلى Lead محليًا | PASS |
| RevenueEvent وAttributionTouchpoint لا تتغير | PASS |
| `verify-v1-final-fix.mjs` | PASS — 12/12 |
| `verify-s12.mjs` | PASS — 24/24 |
| `pnpm build` و`git diff --check` | PASS |
| Browser: تحديد → بوابة قرار → CSV → معاينة CRM | PASS |

## الحدود المحفوظة

الأسعار وبطاقات الباقات والتصدير والترقية كلها تجريبية ومحلية. لا توجد خطة اشتراك حقيقية أو تحصيل أو Google Maps API أو Scraping أو Excel server أو CRM خارجي أو OAuth أو Webhook أو Backend. يظل إيراد S10 والـAttribution منفصلين تمامًا عن الباقات أو التحويل إلى CRM.

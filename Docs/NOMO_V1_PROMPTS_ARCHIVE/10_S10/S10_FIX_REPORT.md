# S10-FIX REPORT — Time Semantics, Funnel Denominators & Data Quality

**Baseline:** `bfb0caa`  
**نوع الإصلاح:** إغلاق محدود لعقد S10 التحليلي ودلالات Dashboard والوصول.  
**الحالة:** مكتملة تقنيًا؛ بانتظار رفع commit واحد ثم التوقف قبل S11.

## النطاق المغلق

| فجوة CTO | الإغلاق المنفذ |
|---|---|
| خلط event وsnapshot | عرّف Registry لكل metric `timeMode` وtimestamp وowner dimension. Event metric يدخل ضمن التاريخ المعلن فقط؛ snapshot يفصح أنه لقطة حالية. |
| denominator صفر | يبقى conversion = `null` ويظهر في Analytics وDashboard بالنص `— · لا يوجد مقام سابق` بدل 0% أو NaN. |
| جودة بيانات واحدة مبهمة | فصل التقرير إلى `structural` للمراجع والإسناد و`coverage` لاكتمال التحليل والطوابع الزمنية والإيراد غير المنسوب. |
| Dashboard view-model قديم | أصبحت KPI المشتركة وRevenue Summary والإسناد المستعرض مشتقة من selectors S10. |
| owner/multi-touch غير معلنين | Attribution trace يحمل Deal owner، واسم النموذج `multi_touch_weighted` وعدد نقاط اللمس والوزن والمبلغ المنسوب. |
| Modal analytics بلا إدارة تركيز مكتملة | أضيف `aria-modal` وlabels، Focus Trap، Escape، وتخزين/استعادة عنصر الفتح. |

## دلالات التحليلات

الإيراد المعترف به يقرأ فقط `RevenueEvent.status = recognized` و`recognizedAt` داخل الفترة المختارة. أما قيمة Pipeline وPipeline المرجحة فهما لقطة من الصفقات المفتوحة ولا تتغيران بتحريك مرشح التاريخ؛ تفصح البطاقات عن هذه الدلالة بدل الإيحاء بأنها حدث مبيعات خلال الفترة.

> لا يغير S10-FIX أي حقيقة تشغيلية. يبقى Revenue recognized من `REV-4061/4062/4063` بقيمة **382,000 ر.س**، وتبقى Open Pipeline **261,000 ر.س**؛ ولا ينشئ `closeDealAsWon` أي RevenueEvent أو AttributionTouchpoint.

## QA المنفذ

| البوابة | النتيجة |
|---|---:|
| بناء الإنتاج `pnpm build` | PASS |
| نزاهة S10-FIX الموسعة | PASS — 29/29 |
| Registry، read-only، Funnel cohort، conservation | PASS |
| event/snapshot semantics وmissing-timestamp coverage | PASS |
| zero denominator في المحرك والواجهتين | PASS |
| owner semantics وmulti-touch weighted fixture | PASS |
| Dashboard selectors وModal ARIA/Escape/Focus Trap/restore | PASS |
| انحدار S9 | PASS — 22/22 |
| انحدار S8 | PASS — 22/22 |

## الحدود المحفوظة

لا Backend أو Database أو API أو LLM أو Scheduler أو Billing أو تعديل لـ`RevenueEvent` أو `AttributionTouchpoint` أو Deal truth. لا تتضمن الشحنة S11 أو أي ميزة جديدة خارج التحليلات وDashboard والوصول التحليلي.

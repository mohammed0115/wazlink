# S9 — Reconstructed CTO Verification Prompt

> **مهم:** هذا Prompt مُعاد بناؤه من QA/Execution reports، وليس نسخة حرفية من Prompt تاريخي غير محفوظ.

## الوضع
**READ ONLY.** لا تعدّل الملفات، لا تنشئ commit أو push، ولا تبدأ المرحلة التالية.

## المطلوب
تحقق بصورة مستقلة من تنفيذ **S9**:
- حالة repository وHEAD وworking tree وremote.
- Scope commit وعدم تسرب مراحل لاحقة.
- صحة العقود والكيانات ومصدر الحقيقة.
- السيناريوهات الوظيفية المذكورة في QA.
- الحسابات والمراجع والـprovenance حيث تنطبق.
- Arabic/RTL وresponsive وaccessibility.
- Console/network وحدود Mock مقابل التكامل الحقيقي.
- build والاختبارات والانحدارات.
- أخرج Findings مصنفة Critical/Major/Minor.
- القرار النهائي يجب أن يكون واحدًا من:
  - `S9 VERIFIED — READY TO CLOSE`
  - `S9 NOT VERIFIED — S9-FIX REQUIRED`

## QA المرجعي المحفوظ
# تقرير جودة S9 — Automation + Tasks + Appointments

**الحكم:** PASS — جاهزة لمراجعة CTO.  
**بيئة التحقق:** Prototype عربي RTL، Vite، Fixtures ثابتة ومحلية، دون Backend أو جدولة أو قناة إنتاجية.

## نتائج التحقق الآلي

| الفحص | النتيجة | التغطية |
|---|---:|---|
| Build | PASS | 30 وحدة Vite من دون خطأ. |
| S9 | PASS | `verify-s9.mjs`: 22/22 A–V. |
| S8 runtime | PASS | 11/11 لمسار Inbox/Copilot والإدراج والإرسال البشري. |
| S8 | PASS | 22/22 للمحرك والـAgent والسياسات. |
| S7 | PASS | 25/25 للمحادثات وHuman Send. |
| S6 | PASS | 22/22 للصفقات وPipeline. |
| S5/S4/S4-UX/S3/S2-FIX | PASS | CRM وIntelligence وJobs والإسناد محفوظة. |

## مصفوفة S9 A–V

| المجموعة | النتيجة | الدليل |
|---|---:|---|
| A–B | PASS | Dry-run لا ينشئ Run، وFixture LEAD-1042 يطابق شرط priority العالية. |
| C–E | PASS | Rule مفعلة تنفذ Task آمنة مرة واحدة، والتكرار يمنع Task ثانية. |
| F–J | PASS | Rule Builder صالح، Appointment تنتظر Approval، ثم تنفذ مرة واحدة مع Start/End/Provenance. |
| K–N | PASS | Reject لا يغير Lead، Loop guard يتخطى origin=automation، وDisabled/Draft لا تعمل. |
| O–Q | PASS | Policy تحظر الإرسال والمال، Run Now يدوي، وتعديل Rule يزيد version. |
| R–V | PASS | Tasks provenance ظاهر، لا Automation Message، Deal وRevenue/Attribution بلا تغيير، Integrity report يمر. |

## فحص الواجهة

تم فتح `#/automation` من تحميل جديد. ظهرت القواعد والـmetrics وRule Builder وdry test وسجل failure المنضبط وطابور الموافقة. كما تم التنقل الداخلي إلى `#/tasks` و`#/appointments` و`#/crm/leads/LEAD-1042`؛ ظهرت فلاتر المهام، موعد محلي، وبطاقة Lead المرجعية للمواعيد وتشغيلات S9. لم تظهر أخطاء Console أثناء التنقل.

## حدود قبول معتمدة

كل الاختبارات تنفذ في عملية Node أو جلسة واجهة محلية مستقلة، ولذلك لا تغير بيانات الشحنة المخزنة. لا يظهر اتصال قناة أو backend أو scheduler في مسار S9. بقيت مراجعة S8-FIX مستقلة ومغلقة في baseline، ولم يضف S9 أي S10.

> لا توجد مخالفات Critical أو Major مفتوحة ضمن نطاق S9. يبقى البدء في S10 متوقفًا إلى GO صريح من CTO.


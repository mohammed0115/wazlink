# S11 — Reconstructed CTO Verification Prompt

> **مهم:** هذا Prompt مُعاد بناؤه من QA/Execution reports، وليس نسخة حرفية من Prompt تاريخي غير محفوظ.

## الوضع
**READ ONLY.** لا تعدّل الملفات، لا تنشئ commit أو push، ولا تبدأ المرحلة التالية.

## المطلوب
تحقق بصورة مستقلة من تنفيذ **S11**:
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
  - `S11 VERIFIED — READY TO CLOSE`
  - `S11 NOT VERIFIED — S11-FIX REQUIRED`

## QA المرجعي المحفوظ
# S11 — QA Report

**الحالة:** PASS تقنيًا؛ الشحنة تنتهي قبل S12.

## بوابات التحقق

| البوابة | النتيجة | التغطية |
|---|---:|---|
| `node scripts/verify-s11.mjs` | PASS — 20/20 | العقود، الحالات، secrets، connect/disconnect/retry، settings، دعوة الفريق، billing، cancel/reactivate، وفصل Revenue. |
| `node scripts/verify-s10.mjs` | PASS — 29/29 | سلامة Analytics وAttribution وDashboard. |
| `node scripts/verify-s9.mjs` | PASS — 22/22 | حدود Automation/Tasks/Appointments. |
| `node scripts/verify-s8.mjs` | PASS — 22/22 | حدود Copilot/Agent وMessaging/Revenue. |
| `pnpm build` | PASS | Vite وesbuild نجحا. |
| `git diff --check` | PASS | لا أخطاء whitespace. |
| Desktop RTL | PASS | معاينة `#/settings` و`#/integrations` و`#/billing`. |
| Mobile RTL، 390px | PASS | الفلاتر والكروت والجداول تستجيب وتبقى قابلة للقراءة. |

## حالات القبول

| الحالة | النتيجة |
|---|---:|
| WhatsApp `not_connected → mock_connected → not_connected` | PASS — local state + IntegrationActivity فقط. |
| Error fixture ثم retry | PASS — ينتقل إلى `configuration_required` ولا ينفذ شبكة. |
| Configuration masked | PASS — `hasConfiguredSecret` فقط؛ لا قيمة خام أو echo. |
| Workspace وNotification وInvite | PASS — مصدر حقيقة واحد وSettings audit، ولا بريد. |
| Downgrade إلى خطة أدنى | PASS — تحذير seats over-limit، بلا حذف بيانات. |
| Plan change وCancel/Reactivate | PASS — Subscription/BillingActivity محلية فقط. |
| Billing/Revenue separation | PASS — لم ينشأ RevenueEvent أو AttributionTouchpoint. |

> لا توجد فجوة حاجبة ضمن نطاق S11. تتطلب أي أعمال S12 موافقة CTO صريحة لاحقة.


# Dead Code and Legacy Report

## نتيجة الجرد

لم تُحذف ملفات تشغيلية في V2-S0. يظل السبب هو أن `domain/data.js` يحتوي مصدر mock الحالي وmutations مشتركة، ولذلك لا يمكن اعتباره dead code رغم كونه legacy-shaped. تم عزل مستهلكيه خلف [`services/data.ts`](client/src/services/data.ts) بدلًا من حذف المصدر.

| العنصر | الحالة | الإجراء |
|---|---|---|
| `client/src/domain/data.js` | Retained / legacy implementation | يبقى مصدر mock مؤقتًا، ويُستهلك عبر adapter |
| `client/src/domain/*.js` engines | Retained / active behavior | تحتوي حسابات deterministic وcontracts مقفلة |
| `client/src/features/*` | Active React | لا حذف؛ جميعها مرتبطة بمسارات أو modals |
| `client/src/shared/shell/*` | Active shared UI | AppShell/Sidebar/Topbar مشتركة |
| `client/src/shared/router/useHashRoute.ts` | Active router | Router الوحيد للحفاظ على aliases |
| `Docs/legacy-react-mockup/*` | Reference only | وثائق/مرجع، خارج build |
| `client/js` أو `client/js/app.js` | Not present | لا توجد Vanilla entrypoint منافسة |
| old HTML entrypoints | Not present | `client/index.html` هو الوحيد |
| CSS sheets التاريخية | Retained / active cascade | لم تُحذف لتفادي كسر العقد البصري؛ تحتاج purge لاحقًا مع visual regression |

## Anti-pattern findings

أكبر الملفات هي `data.js` ثم صفحات Dashboard وAnalytics وInbox وLanding. هذه ملفات كبيرة لكنها تحتوي أقسامًا ذات مسؤوليات حقيقية؛ لم تُجزأ ميكانيكيًا في S0 حتى لا يتغير السلوك. كانت هناك قراءة مباشرة للـ`state` داخل shell وfeatures؛ تم تقليل اقتران مصادر البيانات عبر adapter، بينما يحتاج state migration لاحقة مستقلة.

الـDOM imperative المتبقي مقصود أو معزول: `main.tsx` يحتاج mount root، وHash Router يحتاج `window.location.hash` و`hashchange`، وmodal hooks تحتاج `document` لـEscape/focus، وexport utilities تحتاج Blob URL cleanup. أما `AppShell` فلم يعد يستخدم `classList.toggle`؛ أصبحت حالة drawer prop declarative في `Sidebar`.

تم فحص timers في simulations وInbox وtoast، وتوجد cleanup functions عند unmount. لا توجد `innerHTML` أو `document.querySelector` في source. لا توجد قراءة مباشرة لـ`import.meta.env` خارج config module؛ قراءة `process.env` في server/Vite configuration لا تخص React client runtime.

## سياسة الحذف

لا يحذف V2-S0 أي legacy code إلا بعد تحقق React replacement، وتكافؤ المسار، ونجاح regression، ووجود تاريخ Git محفوظ. لذلك verdict الحالي للـlegacy هو **isolated / retained** وليس deleted. هذه نتيجة مقصودة وليست فشلًا صامتًا.

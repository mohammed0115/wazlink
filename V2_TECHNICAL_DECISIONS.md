# V2-S0 Technical Decisions

| القرار | الاختيار | السبب | ما لم يُفعل |
|---|---|---|---|
| UI framework | React 19 | التطبيق الحالي React ويعمل في production build | لا إعادة كتابة framework |
| Language | TypeScript تدريجيًا | يحمي العقود الجديدة دون migration واسعة عالية المخاطر | لا تحويل شامل لملفات JS في S0 |
| Router | Hash Router المركزي الحالي | يحافظ على V1 deep links وaliases وback/forward | لا إضافة Router ثانية ولا تبديل إلى React Router |
| State | current store bridge + local UI state | أقل تغيير يفي بحاجة Prototype | لا Redux/Zustand جديد |
| Query layer | مؤجل | لا يوجد API حقيقي بعد | لا TanStack Query ولا fake calls |
| Data boundary | `services/data.ts` adapter | يعزل Features عن fixtures ويحافظ على السلوك | لا HTTP ولا server repository |
| Domain contracts | `domain/types.ts` + repository interfaces | مصدر واحد لأسماء الكيانات والمعرفات | لا runtime validation شامل بعد |
| CSS | CSS entry الحالي مع tokens/RTL محفوظين | العقد البصري معتمد من V1 | لا redesign أو CSS purge واسع |
| Loading | shared `LoadingState` داخل `Suspense` | نمط موحد للتحميل عند lazy routes | لا skeleton system ضخم |
| Errors | route-level `ErrorBoundary` | يمنع white screen من خطأ Feature واحدة | لا telemetry خارجي |
| Performance | lazy load للصفحات الثقيلة | خفض الحزمة الأولية بعد ظهور chunk كبير في baseline | لا manual chunk tuning مبالغ |
| Environment | `config/env.ts` + `.env.example` | منع قراءة env في كل Feature | لا secrets في VITE variables |
| Testing | V1 scripts + `verify-v2-s0` smoke | فحص معماري deterministic قابل للتكرار | لا E2E framework جديد |

## عقود V1 المقفلة

لا تعدل هذه الجولة حسابات الإيراد أو الإسناد أو الـPipeline أو قواعد الإرسال أو سياسات Agent أو idempotency الخاصة بالأتمتة. إعادة تنظيم الاستيرادات، lazy loading، وdeclarative drawer state لا تغيّر هذه العقود.

## بوابة المرحلة التالية

يتطلب بدء API أو Auth أو Database أو RBAC موافقة CTO منفصلة بعد تثبيت V2-S0، مع اختبارات contract وregression مناسبة. لا تعتبر repository interfaces الحالية تصريحًا بالبدء في Backend.

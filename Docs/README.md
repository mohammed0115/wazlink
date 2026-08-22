# وثائق «نمو»

| المجلد | المحتوى |
|---|---|
| [reference/](reference/) | **المرجع المعماري الحي** — الكيانات والمسارات وخريطة الشاشات ونظام التصميم ودليل العرض والدين التقني. |
| [shipments/](shipments/) | تقارير التنفيذ وQA لكل شحنة من S0 إلى S12. |
| [post-v1/](post-v1/) | شحنات ما بعد إغلاق V1: الحقيقة المالية، الاستجابة، رحلة Scraper/CRM، Checkout، أيقونات التنقل. |
| [migration/](migration/) | تحويل الواجهة إلى React: التقرير، قائمة المهام، تدقيق الوثائق مقابل الكود، والفجوات. |
| [planning/](planning/) | سجل التنفيذ الداخلي واتجاه التصميم. |
| [NOMO_V1_PROMPTS_ARCHIVE/](NOMO_V1_PROMPTS_ARCHIVE/) | أرشيف V1 المجمّد: prompts معاد بناؤها + تقارير الشحنات الأصلية. **سجل تاريخي — لا يُحدَّث.** |
| [legacy-react-mockup/](legacy-react-mockup/) | نموذج React قديم غير مستخدم، محفوظ للرجوع البصري فقط. |

## من أين تبدأ

| سؤالك | الوثيقة |
|---|---|
| كيف أشغّل المشروع؟ | [../README.md](../README.md) |
| ما الكيانات وما حدودها؟ | [reference/ENTITY_MODEL.md](reference/ENTITY_MODEL.md) |
| ما المسارات المعتمدة؟ | [reference/ROUTES.md](reference/ROUTES.md) |
| ما ألوان وtokens التصميم؟ | [reference/DESIGN_SYSTEM.md](reference/DESIGN_SYSTEM.md) |
| كيف أعرض المنتج؟ | [reference/DEMO_GUIDE.md](reference/DEMO_GUIDE.md) |
| ما المؤجل إلى V2؟ | [reference/TECHNICAL_DEBT.md](reference/TECHNICAL_DEBT.md) |
| ما حالة تحويل React؟ | [migration/REACT_MIGRATION_TODO.md](migration/REACT_MIGRATION_TODO.md) |

> **قاعدة:** `reference/` هو المرجع الحي ويُحدَّث مع الكود، ويحرسه `scripts/audit-docs-vs-code.mjs`.
> أما `NOMO_V1_PROMPTS_ARCHIVE/` فسجل مجمّد لا يعكس بالضرورة الحالة الراهنة.

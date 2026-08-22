# DESIGN SYSTEM — S0 Foundation

**الاتجاه:** Enterprise SaaS هادئ، دقيق، عربي أولًا، وموجّه للبيانات.  
**الممنوع:** neon، crypto/gaming language، gradients كثيفة، glassmorphism واسع، وألوان حالة عشوائية.

## 1. مبادئ التصميم

> **المنتج لا يعرض قوائم بيانات فقط؛ بل يوضح أين يقع سجل أعمال واحد في رحلة قرار من المصدر إلى الإيراد.**

1. **البيانات قبل الزخرفة:** الجداول والحقول وLabels والحالات أهم من الخلفيات أو الظلال.
2. **السماوي للقرار:** يستخدم Brand Cyan للحالة النشطة أو الموضع أو الإجراء الرئيسي أو سجل موثوق، لا كخلفية عامة لكل شيء.
3. **العربية مصدر الحقيقة:** العناوين والـLabels وواجهة التحكم عربية RTL؛ IDs، emails، URLs، SAR، phones والأرقام التقنية تبقى LTR في نطاقها.
4. **الحدود والمسافات أولًا:** الحدود الناعمة والتباعد المنهجي أهم من ظل ثقيل أو تدوير مفرط.
5. **سكّة رحلة العميل سياقية:** تظهر في الأماكن التي تفسر انتقال Business/Lead، ولا تتكرر في كل شاشة بلا داعٍ.

## 2. CSS Tokens المعتمدة

الأسماء أدناه هي **المعرَّفة فعليًا** في `client/css/base.css`. استخدمها كما هي؛
لا توجد متغيرات بأسماء `--brand` أو `--danger` أو `--text-primary` في الكود.

| فئة | Token | الاستخدام |
|---|---|---|
| Background | `--bg` | خلفية مساحة العمل |
| Surface | `--paper` | البطاقات والجداول العادية |
| Surface Elevated | `--surface-elevated` | modal، drawer، card ذات أولوية |
| Primary Text | `--ink` | العناوين والقيم الأساسية |
| Secondary Text | `--muted` | الوصف والـmetadata |
| Border | `--line` / `--line-strong` | فصل البيانات والحالات المختارة |
| Brand | `--cyan` / `--cyan-deep` / `--cyan-pale` | قرار/إجراء/مرحلة نشطة |
| Success | `--green` / `--green-pale` | مكتمل، موثق، رابح |
| Warning | `--amber` / `--amber-pale` | متابعة أو مخاطرة متوسطة |
| Danger | `--red` / `--red-pale` | متأخر، فشل، حذف أو فقدان |
| Information | `--info` / `--info-pale` | معرفة النظام وتحديثاته |
| Navigation | `--nav` / `--nav-muted` | سطح Sidebar ونصها الثانوي |
| Typography | `--font` / `--mono` | الخط العربي وخط الأرقام والمعرفات |
| Radius | `--radius-sm` / `--radius-md` / `--radius-lg` | 4px / 8px / 12px |
| Shadow | `--shadow` | elevation خفيف فقط |

## 3. الكتابة والأرقام

| المستوى | الدور | القاعدة |
|---|---|---|
| Display | قيمة المنتج أو شاشة عامة | Arabic display weight واضح، لا يستخدم داخل الجداول |
| H1 | عنوان الشاشة | قصير، مباشر، ويعكس المهمة الأساسية |
| H2 | قسم رئيسي | يشرح مجموعة بيانات أو قرارًا |
| H3 | بطاقة أو مجموعة | يسبق نصًا أو قيمة ولا يطغى على H2 |
| Body | سياق وتشغيل | عربي مقروء مع line-height مريح |
| Small / Caption | metadata | مصدر، وقت، حالة، شرح مختصر |
| Numeric / KPI | IDs، SAR، scores، نسب | monospace أو tabular numerals ضمن `dir="ltr"` عند الحاجة |

## 4. مقياس المسافات والحواف والظلال

| النظام | القيم المعتمدة |
|---|---|
| Spacing | `4, 8, 12, 16, 20, 24, 32, 40, 48` px |
| Radius | `--radius-sm: 4px`, `--radius-md: 8px`, `--radius-lg: 12px` |
| Shadow | `--shadow` للـelevation الخفيف فقط؛ لا Shadow إلزامي للبطاقات العادية |
| Border | 1px خفيف للأسطح، أقوى للحالة النشطة أو اختيار المستخدم |

## 5. المكتبة المشتركة

| المكوّن | الحالات الإلزامية |
|---|---|
| Button | primary، secondary، ghost، destructive، disabled، loading |
| Input / Search / Textarea | default، focus، filled، error، disabled |
| Select / Checkbox / Radio | label مرتبط، focus ظاهر، disabled |
| Badge / Status | semantic فقط: success / warning / danger / info / neutral |
| Card / KPI Card | title، metadata، value، optional action، loading skeleton |
| Table | header، row hover، selected، empty، horizontal scroll على الشاشات الصغيرة |
| Pagination / Tabs | active واضح، keyboard focus، no dead links |
| Modal / Drawer / Dropdown / Tooltip | keyboard access، close action، focus behavior |
| Toast | success / warning / error / info، نص إجراء واضح |
| Timeline / Progress | حالة مكتملة، نشطة، قادمة، فاشلة |
| Lead Score | score رقمي، label عربي، تفسير أو مصدر |
| AI Recommendation | confidence، context، recommended action، human approval state |
| Entity Link | اسم كيان + ID/metadata، يفتح نفس السجل لا نسخة منسوخة |
| Public Nav | روابط مرساة عربية، CTA واحد رئيسي، وموضع دخول صريح |
| Auth Form | label دائم، inline validation، رسالة خطأ مرتبطة بالحقل، وبدون تنبيه متصفح |
| Onboarding Wizard | خمس خطوات كحد أقصى، progress ذو `aria-current`، رجوع/تقدم، وحالة اختيار واضحة |
| Choice Card | زر قابل للتركيز بـ`aria-pressed`، اختيار متعدد، وIcon لا يعتمد وحده على اللون |

## 6. أساس RTL والوصول

يستخدم CSS logical properties كلما أمكن: `margin-inline-start/end`، `padding-inline-start/end`، `inset-inline-start/end` و`text-align: start/end`. لا تعكس IDs أو البريد أو URLs أو أرقام الهاتف أو العملة داخل النص العربي؛ تغلف بعناصر ذات `dir="ltr"` عند الحاجة.

كل عنصر قابل للنقر يجب أن يكون `<button>` أو `<a>` مناسبًا، مع focus ring ظاهر وlabel أو `aria-label` عند غياب النص. لا تستخدم `div` قابلًا للنقر كبديل عن عناصر الإدخال الأصلية.

## 7. إضافات S1

تستخدم صفحات Landing وLogin وOnboarding نفس الرموز والألوان والحواف المثبتة في S0. Landing تشرح سجل الأعمال المتحرك من المصدر إلى الإيراد بدل عرض ادعاءات غير قابلة للاختبار. Login محلي تجريبي فقط، ويعرض أخطاء الحقول داخل الصفحة. أما Wizard الإعداد فيحتفظ بالمدخلات في ذاكرة الجلسة الحالية فقط، ولا ينشئ حسابًا أو تخزينًا دائمًا أو اتصالًا خارجيًا.

# نمو — AI Sales Engine

نموذج تفاعلي عربي RTL لمحرك مبيعات يربط **اكتشاف الشركات ← تحليل الفرصة ← CRM ← الصفقة ← المحادثة ← الأتمتة ← التحليلات وإسناد الإيراد** في سياق واحد قابل للتتبع.

> **حد النموذج:** كل البيانات والإجراءات محلية داخل الجلسة. لا Backend ولا قاعدة بيانات ولا APIs حقيقية ولا WhatsApp أو Google Maps أو Calendar أو LLM خارجي أو OAuth أو دفع حقيقي. يعيد refresh الذاكرة إلى Fixtures.

## التشغيل

المتطلبات: **Node.js 20.19+ أو 22.12+** و**pnpm 10+**.

```bash
pnpm install        # تثبيت الاعتماديات
pnpm dev            # خادم تطوير على http://localhost:3000
pnpm build          # بناء إنتاجي إلى dist/
pnpm check          # فحص أنواع TypeScript
```

## فحوص النزاهة

كل شحنة محروسة بفحص يتحقق من عقودها. تُشغَّل بلا متصفح:

```bash
node scripts/lib/build-ui-sources.mjs   # يولّد لقطات مصادر الواجهة أولًا
node scripts/verify-s12.mjs             # فحص شحنة واحدة
node scripts/audit-docs-vs-code.mjs     # مطابقة الوثائق للكود
node scripts/verify-react-coverage.mjs  # تغطية طبقة العرض

for f in scripts/verify-*.mjs; do node "$f" >/dev/null && echo "PASS $f" || echo "FAIL $f"; done
```

> الفحوص حساسة للمنطقة الزمنية عمدًا؛ شغّلها في `Asia/Riyadh` أو `UTC` للتأكد من الاستقلال عنها.

## البنية

```text
client/
  index.html
  src/
    main.tsx · App.tsx          نقطة الدخول وجدول التوجيه
    domain/                     طبقة النطاق — الكيانات والـselectors (JS، بلا DOM)
    features/                   واجهة كل مجال: landing · auth · dashboard · discovery
                                intelligence · crm · sales · inbox · ai · automation
                                analytics · settings · ui-kit
    shared/                     shell · components · store · router · lib
    styles/                     أنماط CSS المشتركة
scripts/                        فحوص النزاهة والتدقيق
Docs/                           المرجع المعماري وتقارير الشحنات والأرشيف
```

**قاعدة المعمارية:** طبقة النطاق في `client/src/domain/` هي مصدر الحقيقة الوحيد، وهي خالية من أي اعتماد على DOM. لا تنشئ طبقة العرض رقمًا ماليًا ولا تعيد حسابه — تقرأه من selectors المحرك.

## المسار التجريبي

`SRC-1001 → JOB-1028 → BUS-1042 → LEAD-1042 → DEAL-4042 → CONV-3042`

الإيراد المعترف به **382,000 ر.س** من `REV-4061/4062/4063` وحدها. إغلاق الصفقة كرابحة **لا** ينشئ `RevenueEvent`.

## الوثائق

| الوثيقة | المحتوى |
|---|---|
| [Docs/README.md](Docs/README.md) | فهرس الوثائق |
| [Docs/reference/ENTITY_MODEL.md](Docs/reference/ENTITY_MODEL.md) | الكيانات والعقود والحدود |
| [Docs/reference/ROUTES.md](Docs/reference/ROUTES.md) | عقد المسارات |
| [Docs/reference/DESIGN_SYSTEM.md](Docs/reference/DESIGN_SYSTEM.md) | نظام التصميم وtokens |
| [Docs/reference/DEMO_GUIDE.md](Docs/reference/DEMO_GUIDE.md) | مسار العرض |

# S12 Audit Notes

## Baseline and route findings

تم تثبيت baseline عند `3337932`. كانت المسارات `#/settings/integrations` و`#/settings/team` و`#/settings/notifications` تعرض Placeholder عامًا سابقًا. صارت الآن تستخدم واجهة Settings ومصدر حقيقتها المحلي، مع Sidebar فعّال وBreadcrumb يعرض الإعدادات ثم القسم. يعتمد كتالوج التكاملات والفوترة المسار canonical `#/settings/integrations` و`#/settings/billing`، فيما يبقى `#/integrations` و`#/billing` مدعومين كـlegacy aliases.

## Initial visual sweep

أظهر فحص 1440px أن Landing وLogin وOnboarding وDashboard وDiscovery وLead 360 وInbox وAnalytics تعمل ضمن RTL وتعرض الإفصاحات التجريبية. رصد الفحص تسميات تقنية إنجليزية ظاهرة في KPI Dashboard؛ عُرّبت في `dashboard.js` من دون تغيير تعريف metric أو selector أو منطق الإيراد. لا توجد شاشة فارغة أو خطأ بصري حاجب في المسارات المفحوصة.

## Mobile observation and correction

كشف فحص 390px أن قواعد Drawer المتداخلة كانت تسمح لـ`.sidebar.collapsed` بتجاوز transform الخاص بحالة الجوال، فتظهر كطبقة جانبية فوق محتوى التطبيق. أضيف override نهائي عند `max-width:760px` يفرض بقاء Sidebar خارج viewport إلا عند `.open`، مع إبقاء الجداول وPipeline وInbox داخل scrollers محلية. ستعاد المعاينة بعد التعديل قبل اعتماد S12.

أثبتت إعادة المعاينة على 390px أن Dashboard وInbox وكتالوج التكاملات أصبحت تستفيد من عرض الشاشة كاملًا، مع زر القائمة الظاهر بدل Sidebar الثابتة. لا يظهر قص أفقي عام أو شريط تنقل متراكب؛ وتظل البطاقات والجداول الواسعة محكومة بحاوياتها المحلية.

# NOMO V1 — Prompt & Verification Archive

هذه الحزمة تجمع تاريخ V1 من S0 إلى S12 وV1 Final Acceptance.

## تنبيه مهم
الـPrompts الموجودة باسم `*_RECONSTRUCTED.md` **ليست نسخًا حرفية** من الـPrompts الأصلية إذا لم يكن النص الأصلي محفوظًا داخل المستودع.
تم بناؤها حصريًا من Execution Reports وQA Reports وFIX Reports والوثائق الموجودة في المشروع، حتى لا يتم اختلاق تاريخ غير موجود.

## ما تحتويه الحزمة
- مجلد لكل مرحلة S0–S12.
- Execution/QA/FIX reports الأصلية الموجودة في السورس.
- Implementation prompt مُعاد البناء لكل مرحلة.
- CTO verification prompt مُعاد البناء لكل مرحلة.
- FIX prompt عند وجود FIX/UX تاريخي.
- Master reference: Architecture, Entity Model, Routes, Design System, Screen Map وغيرها.
- V1 Final Acceptance.

## الاستخدام المقترح لـ V2
استخدم هذه الحزمة كـ **V1 specification archive**.
لا تنسخ Vanilla JS حرفيًا إلى React. استخدم العقود، الرحلات، حالات القبول، والـfixtures كمراجع أثناء إعادة بناء Frontend نظيف.

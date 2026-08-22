/**
 * جسر الحالة بين React وطبقة النطاق القائمة.
 *
 * لا يعيد هذا الملف تعريف مصدر الحقيقة. يبقى `state` و`mockModel` في
 * `client/js/data.js` كما هما — نفس الكائن القابل للتغيير الذي تستخدمه
 * كل الـdomain functions وكل فحوص `scripts/verify-*.mjs`.
 *
 * الفارق الوحيد عن نسخة Vanilla أن `render()` اليدوية استُبدلت باشتراك
 * `useSyncExternalStore`: أي mutation يمر عبر `mutate()` يرفع رقم إصدار
 * فتعيد React رسم ما يعتمد عليه فقط.
 */
import { useCallback, useSyncExternalStore } from "react";
import { state } from "@domain/data.js";

type Listener = () => void;

const listeners = new Set<Listener>();
let version = 0;

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getVersion(): number {
  return version;
}

/** إشعار صريح بأن الحالة المشتركة تغيرت خارج `mutate()`. */
export function notifyStateChanged(): void {
  version += 1;
  listeners.forEach((listener) => listener());
}

/**
 * ينفذ mutation على مصدر الحقيقة المشترك ثم يعيد الرسم.
 * يقابل نمط `domainFunction(); render();` في نسخة Vanilla.
 */
export function mutate<T>(run: () => T): T {
  const result = run();
  notifyStateChanged();
  return result;
}

/** يشترك في إصدار الحالة المشتركة ويعيد الكائن نفسه (قابل للتغيير عمدًا). */
export function useAppState(): typeof state {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return state;
}

/** يعيد دالة mutate ثابتة المرجع لاستخدامها داخل معالجات الأحداث. */
export function useMutate(): typeof mutate {
  return useCallback(mutate, []);
}

/**
 * يضبط حقلًا واحدًا في الحالة المشتركة ثم يعيد الرسم.
 * مخصص لحالة الواجهة (فلاتر، تحديد، نوافذ) لا لكيانات النطاق.
 */
export function setUiState<K extends keyof typeof state>(key: K, value: (typeof state)[K]): void {
  state[key] = value;
  notifyStateChanged();
}

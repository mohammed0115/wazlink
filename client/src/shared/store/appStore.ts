/**
 * React mutation notifier.
 *
 * Domain mutations remain explicit service/domain operations. This module only
 * tells React consumers that a mock-only mutation completed; it does not expose
 * or mirror the legacy store shape.
 */
import { useCallback } from "react";

type Listener = () => void;

const listeners = new Set<Listener>();
let version = 0;

/** إشعار صريح بأن حالة mock تغيّرت خارج mutate(). */
export function notifyStateChanged(): void {
  version += 1;
  listeners.forEach((listener) => listener());
}

/** ينفذ mutation صريحًا ثم يخطر React بإعادة الرسم. */
export function mutate<T>(run: () => T): T {
  const result = run();
  notifyStateChanged();
  return result;
}

/** تسجيل مستمع اختياري للتكاملات التي تحتاج إشعارًا منخفض المستوى. */
export function subscribeToMutations(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** يعيد دالة mutate ثابتة المرجع لاستخدامها داخل معالجات الأحداث. */
export function useMutate(): typeof mutate {
  return useCallback(mutate, []);
}

void version;

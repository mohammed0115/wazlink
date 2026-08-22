/**
 * نظام الإشعارات — مقابل `toast()` في نسخة Vanilla.
 *
 * السلوك محفوظ كما هو: رسالة قصيرة أعلى الشاشة بنبرة دلالية،
 * تختفي تلقائيًا بعد 3300ms، وتستخدم نفس أصناف CSS القائمة
 * (`.toast-wrap` و`.toast`) بلا أي تغيير في الأنماط.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type ToastTone = "" | "success" | "warning" | "error" | "info";

type ToastEntry = { id: number; message: string; tone: ToastTone };

type ToastApi = (message: string, tone?: ToastTone) => void;

const ToastContext = createContext<ToastApi>(() => {});

const TOAST_DURATION_MS = 3300;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ToastEntry[]>([]);
  const nextId = useRef(0);
  const timers = useRef<number[]>([]);

  useEffect(
    () => () => {
      for (const timer of timers.current) window.clearTimeout(timer);
    },
    [],
  );

  const toast = useCallback<ToastApi>((message, tone = "") => {
    const id = (nextId.current += 1);
    setEntries((current) => [...current, { id, message, tone }]);
    const timer = window.setTimeout(() => {
      setEntries((current) => current.filter((entry) => entry.id !== id));
    }, TOAST_DURATION_MS);
    timers.current.push(timer);
  }, []);

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {entries.length > 0 && (
        <div className="toast-wrap">
          {entries.map((entry) => (
            <div key={entry.id} className={`toast ${entry.tone}`.trim()} role="status" aria-live="polite">
              <i />
              <span>{entry.message}</span>
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}

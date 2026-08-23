/**
 * Topbar — نفس ترميز V1 بعد UI-FIX: علامة مثبتة، Breadcrumb، شريط أوامر،
 * وإجراءات علوية. زر القائمة يظهر على الجوال فقط عبر `responsive.css`.
 */
import { useEffect, useRef } from "react";
import { state } from "@services/data";
import { go } from "../router/useHashRoute";
import { notifyStateChanged } from "../store/appStore";
import { useToast } from "../store/toast";
import { routeLabel } from "./routeMeta";

export function Topbar({ route, onToggleSidebar }: { route: string; onToggleSidebar: () => void }) {
  const toast = useToast();
  const commandInput = useRef<HTMLInputElement>(null);
  const workspaceName = state.workspace.companyName || "مساحة العمل";
  const label = routeLabel(route);

  // اختصار ⌘K / Ctrl+K لتركيز شريط الأوامر — سلوك محفوظ من V1.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        commandInput.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function toggleTheme() {
    state.theme = state.theme === "light" ? "dark" : "light";
    notifyStateChanged();
  }

  return (
    <header className="topbar">
      <div className="page-crumb">
        <button className="top-icon menu-button hidden" type="button" onClick={onToggleSidebar} aria-label="فتح القائمة">
          ☰
        </button>
        <a className="topbar-brand-lock" href="#/dashboard" aria-label="نمو — الرئيسية">
          <img src="/leadflow-orbit-mark.svg" alt="" />
          <span>
            <b>نمو</b>
            <small>مسار القرار</small>
          </span>
        </a>
        <span>{workspaceName}</span>
        <i>›</i>
        {route.startsWith("settings/") ? (
          <>
            <span>الإعدادات</span>
            <i>›</i>
            <b>{label}</b>
          </>
        ) : (
          <b>{label}</b>
        )}
      </div>

      <label className="command-bar">
        <span>⌘</span>
        <input id="commandInput" ref={commandInput} placeholder="ابحث في النظام أو اطلب إجراء..." />
        <kbd>⌘ K</kbd>
      </label>

      <div className="top-actions">
        <button className="button compact" type="button" onClick={() => go("discovery")}>
          اكتشاف جديد
        </button>
        <button className="top-icon" type="button" title="المظهر" onClick={toggleTheme}>
          ◐
        </button>
        <button
          className="top-icon"
          type="button"
          title="الإشعارات"
          onClick={() => toast(`لديك ${state.notifications} إشعارات تجريبية في هذه الجلسة.`, "info")}
        >
          ◌
        </button>
      </div>
    </header>
  );
}

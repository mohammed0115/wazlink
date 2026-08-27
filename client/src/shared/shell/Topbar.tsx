/**
 * Topbar — نفس ترميز V1 بعد UI-FIX: علامة مثبتة، Breadcrumb، شريط أوامر،
 * وإجراءات علوية. زر القائمة يظهر على الجوال فقط عبر `responsive.css`.
 */
import { useEffect, useRef } from "react";
import { appConfig } from "@config/env";
import { entitlementService, notificationService } from "@services";
import { useWorkspace, useTheme } from "../context/AppProviders";
import { go } from "../router/useHashRoute";
import { useToast } from "../store/toast";
import { routeLabel } from "./routeMeta";

export function Topbar({ route, onToggleSidebar, drawerOpen = false }: { route: string; onToggleSidebar: () => void; drawerOpen?: boolean }) {
  const toast = useToast();
  const commandInput = useRef<HTMLInputElement>(null);
  const { workspace } = useWorkspace();
  const { toggleTheme } = useTheme();
  const workspaceName = workspace.companyName || "مساحة العمل";
  const currentPlan = entitlementService.currentPlan();
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

  return (
    <header className="topbar">
      <div className="page-crumb">
        <button className="top-icon menu-button hidden" type="button" onClick={onToggleSidebar} aria-label={drawerOpen ? "إغلاق القائمة" : "فتح القائمة"} aria-expanded={drawerOpen}>
          ☰
        </button>
        <a className="topbar-brand-lock" href="#/dashboard" aria-label="wazlink — الرئيسية">
          <img src={`${appConfig.assetBaseUrl}wazlink-mark.svg`} alt="" />
          <span>
            <b>wazlink</b>
            <small>مسار القرار</small>
          </span>
        </a>
        <span>{workspaceName}</span>
        <small className="topbar-plan-context">{currentPlan.name}</small>
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
          onClick={() => toast(`لديك ${notificationService.unreadCount()} إشعارات تجريبية في هذه الجلسة.`, "info")}
        >
          ◌
        </button>
      </div>
    </header>
  );
}

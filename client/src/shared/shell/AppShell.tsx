/**
 * غلاف التطبيق الداخلي — نفس بنية `renderApp()` في V1:
 * Sidebar + workspace يحتوي Topbar ومنطقة المحتوى.
 *
 * قاعدة S12 محفوظة: على الشاشات الصغيرة تبقى Sidebar خارج مساحة العرض
 * حتى يفتحها المستخدم صراحة، وتُغلق تلقائيًا عند تغيّر المسار.
 */
import { useEffect, useState, type ReactNode } from "react";
import { state } from "@domain/data.js";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ route, children }: { route: string; children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [route]);

  useEffect(() => {
    const sidebar = document.getElementById("sidebar");
    sidebar?.classList.toggle("open", drawerOpen);
  }, [drawerOpen, route]);

  return (
    <div className={`app-shell ${state.sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
      <Sidebar route={route} />
      <main className="workspace">
        <Topbar route={route} onToggleSidebar={() => setDrawerOpen((open) => !open)} />
        <div className="page-content" id="pageContent">
          {children}
        </div>
      </main>
    </div>
  );
}

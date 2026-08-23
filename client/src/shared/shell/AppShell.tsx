/**
 * غلاف التطبيق الداخلي — نفس بنية `renderApp()` في V1:
 * Sidebar + workspace يحتوي Topbar ومنطقة المحتوى.
 *
 * قاعدة S12 محفوظة: على الشاشات الصغيرة تبقى Sidebar خارج مساحة العرض
 * حتى يفتحها المستخدم صراحة، وتُغلق تلقائيًا عند تغيّر المسار.
 */
import { useEffect, useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ route, children }: { route: string; children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [route]);

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`}>
      <Sidebar route={route} drawerOpen={drawerOpen} collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((value) => !value)} />
      <main className="workspace">
        <Topbar route={route} onToggleSidebar={() => setDrawerOpen((open) => !open)} />
        <div className="page-content" id="pageContent">
          {children}
        </div>
      </main>
    </div>
  );
}

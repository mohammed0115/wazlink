/**
 * غلاف التطبيق الداخلي — نفس بنية `renderApp()` في V1:
 * Sidebar + workspace يحتوي Topbar ومنطقة المحتوى.
 *
 * قاعدة S12 محفوظة: على الشاشات الصغيرة تبقى Sidebar خارج مساحة العرض
 * حتى يفتحها المستخدم صراحة، وتُغلق تلقائيًا عند تغيّر المسار.
 */
import { useEffect, useState, type ReactNode } from "react";
import { entitlementService } from "@services";
import { useWorkspace } from "../context/AppProviders";
import { projectShellContext } from "./shellNavigation";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ route, children }: { route: string; children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const { workspace } = useWorkspace();
  const shellContext = projectShellContext(route, workspace, entitlementService);

  useEffect(() => {
    setDrawerOpen(false);
  }, [route]);

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen]);

  return (
    <div className={`app-shell ${sidebarCollapsed ? "sidebar-is-collapsed" : ""}`} data-shell-route={shellContext.route}>
      <Sidebar route={route} drawerOpen={drawerOpen} collapsed={sidebarCollapsed} onToggleCollapsed={() => setSidebarCollapsed((value) => !value)} />
      {drawerOpen ? <button className="shell-backdrop" type="button" aria-label="إغلاق القائمة" onClick={() => setDrawerOpen(false)} /> : null}
      <main className="workspace">
        <Topbar route={route} drawerOpen={drawerOpen} onToggleSidebar={() => setDrawerOpen((open) => !open)} />
        <div className="page-content" id="pageContent">
          {children}
        </div>
      </main>
    </div>
  );
}

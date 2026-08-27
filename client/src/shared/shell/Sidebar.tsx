/**
 * Sidebar — نفس بنية وأصناف نسخة V1 بعد UI-FIX وSIDEBAR-SEMANTIC-ICONS.
 * مصدر عناصر التنقل يبقى في طبقة البيانات عبر adapter واحد بلا تكرار.
 */
import { Fragment } from "react";
import { entitlementService, getInboxSummary } from "@services";
import { useWorkspace } from "../context/AppProviders";
import { go } from "../router/useHashRoute";
import { Brand } from "./Brand";
import { NavIcon } from "./NavIcon";
import { projectShellNavigation } from "./shellNavigation";

type NavDecision = { status: "AVAILABLE" | "LIMITED" | "EXHAUSTED" | "LOCKED"; reason?: string };


type SidebarProps = {
  route: string;
  drawerOpen?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

export function Sidebar({ route, drawerOpen = false, collapsed = false, onToggleCollapsed }: SidebarProps) {
  const { workspace } = useWorkspace();
  const workspaceMeta = workspace.companyName
    ? `${workspace.companyName} · ${workspace.teamSize || "فريق جديد"}`
    : "مسؤولة النمو";
  const navigation = projectShellNavigation(route, entitlementService);
  const inboxUnread = getInboxSummary().unread;
  const currentPlan = entitlementService.currentPlan();
  const discoveryUsage = entitlementService.usageFor("discoveryRuns");
  const discoveryLimit = discoveryUsage.limit.kind === "finite" ? discoveryUsage.limit.value : null;
  const discoveryWidth = discoveryUsage.percentage === null ? 100 : discoveryUsage.percentage;

  let lastGroup: string | null = null;

  return (
    <aside
      className={`sidebar ${collapsed ? "collapsed" : ""} ${drawerOpen ? "open" : ""}`}
      id="sidebar"
      aria-label="التنقل الرئيسي"
    >
      <div className="sidebar-brand-row">
        <Brand />
        <button
          className="collapse-button"
          type="button"
          aria-label="طي القائمة"
          onClick={onToggleCollapsed}
        >
          ›
        </button>
      </div>

      <nav className="sidebar-nav">
        {navigation.map((item) => {
          const groupHeading = item.group && item.group !== lastGroup ? item.group : null;
          if (groupHeading) lastGroup = item.group;
          const decision = item.decision as NavDecision | null;
          const locked = decision?.status === "LOCKED";
          const pressured = decision?.status === "EXHAUSTED" || decision?.status === "LIMITED";
          return (
            <Fragment key={item.id}>
              {groupHeading && <p className="nav-group">{groupHeading}</p>}
              <button
                className={`side-link ${item.active ? "active" : ""} ${locked ? "is-locked" : ""}`}
                type="button"
                title={locked ? `${item.label} — متاح بعد الترقية` : item.label}
                aria-current={item.active ? "page" : undefined}
                aria-disabled={locked ? true : undefined}
                data-entitlement-state={decision?.status ?? "AVAILABLE"}
                onClick={() => go(locked ? "settings/billing" : item.id)}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
                {item.id === "inbox" && inboxUnread ? <em className="nav-pill">{inboxUnread}</em> : null}
                {locked ? <em className="nav-state" aria-label="مقفل">قفل</em> : pressured ? <em className="nav-state" aria-label={decision?.status === "EXHAUSTED" ? "مستنفد" : "قريب من الحد"}>!</em> : null}
              </button>
            </Fragment>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className="usage-card">
          <span>
            <b>{currentPlan.name}</b>
            <b className="mono">{discoveryUsage.used}{discoveryLimit === null ? " / ∞" : ` / ${discoveryLimit}`}</b>
          </span>
          <div className="meter" aria-label={`استخدام الاكتشاف ${discoveryUsage.used} من ${discoveryLimit === null ? "غير محدود" : discoveryLimit}`}>
            <i style={{ width: `${discoveryWidth}%` }} />
          </div>
          <small>{discoveryLimit === null ? "استخدام غير محدود" : `الاكتشاف · المتبقي ${discoveryUsage.remaining}`}</small>
          <button className="sidebar-upgrade" type="button" onClick={() => go("settings/billing")}>إدارة الباقة</button>
        </div>
        <button className="profile-trigger" type="button">
          <i className="avatar">س</i>
          <span>
            <b>سارة العمري</b>
            <small>{workspaceMeta}</small>
          </span>
        </button>
      </div>
    </aside>
  );
}

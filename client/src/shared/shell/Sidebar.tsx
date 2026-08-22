/**
 * Sidebar — نفس بنية وأصناف نسخة V1 بعد UI-FIX وSIDEBAR-SEMANTIC-ICONS.
 * مصدر عناصر التنقل يبقى `navItems` في `client/js/data.js` بلا تكرار.
 */
import { Fragment } from "react";
import { getInboxSummary, navItems, state } from "@domain/data.js";
import { setUiState } from "../store/appStore";
import { go } from "../router/useHashRoute";
import { Brand } from "./Brand";
import { NavIcon } from "./NavIcon";
import { routeNavId } from "./routeMeta";

type NavItem = { id: string; label: string; icon: string; group: string };

export function Sidebar({ route }: { route: string }) {
  const workspaceMeta = state.workspace.companyName
    ? `${state.workspace.companyName} · ${state.workspace.teamSize || "فريق جديد"}`
    : "مسؤولة النمو";
  const activeRoute = routeNavId(route);
  const inboxUnread = getInboxSummary().unread;

  let lastGroup: string | null = null;

  return (
    <aside className={`sidebar ${state.sidebarCollapsed ? "collapsed" : ""}`} id="sidebar">
      <div className="sidebar-brand-row">
        <Brand />
        <button
          className="collapse-button"
          type="button"
          aria-label="طي القائمة"
          onClick={() => setUiState("sidebarCollapsed", !state.sidebarCollapsed)}
        >
          ›
        </button>
      </div>

      <nav className="sidebar-nav">
        {(navItems as NavItem[]).map((item) => {
          const groupHeading = item.group && item.group !== lastGroup ? item.group : null;
          if (groupHeading) lastGroup = item.group;
          return (
            <Fragment key={item.id}>
              {groupHeading && <p className="nav-group">{groupHeading}</p>}
              <button
                className={`side-link ${activeRoute === item.id ? "active" : ""}`}
                type="button"
                title={item.label}
                aria-current={activeRoute === item.id ? "page" : undefined}
                onClick={() => go(item.id)}
              >
                <NavIcon name={item.icon} />
                <span>{item.label}</span>
                {item.id === "inbox" && inboxUnread ? <em className="nav-pill">{inboxUnread}</em> : null}
              </button>
            </Fragment>
          );
        })}
      </nav>

      <div className="sidebar-bottom">
        <div className="usage-card">
          <span>
            <b>رصيد الاكتشاف</b>
            <b className="mono">1,240</b>
          </span>
          <div className="meter">
            <i />
          </div>
          <small>الباقة المهنية</small>
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

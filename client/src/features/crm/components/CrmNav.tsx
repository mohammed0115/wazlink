/**
 * Sub-navigation across the live CRM area.
 *
 * Entries are filtered by the actor's server-derived permissions, so a role
 * that cannot read customers is not offered a tab that would only 403.
 */
import { useAuth } from "../../../shared/context/AuthProvider";
import { go, useHashRoute } from "../../../shared/router/useHashRoute";

const TABS: { route: string; label: string; permission: string; matches: string[] }[] = [
  { route: "crm", label: "العملاء المحتملون", permission: "lead.view", matches: ["crm", "leads"] },
  {
    route: "crm/customers",
    label: "العملاء",
    permission: "customer.view",
    matches: ["crm/customers", "customers"],
  },
  {
    route: "crm/contacts",
    label: "جهات الاتصال",
    permission: "contact.view",
    matches: ["crm/contacts", "contacts"],
  },
  { route: "tasks", label: "المهام", permission: "task.view", matches: ["tasks"] },
  {
    route: "crm/import",
    label: "استيراد CSV",
    permission: "import.manage",
    matches: ["crm/import", "imports"],
  },
];

export function CrmNav() {
  const { can } = useAuth();
  const { path } = useHashRoute();
  const visible = TABS.filter((tab) => can(tab.permission));
  if (visible.length <= 1) return null;

  return (
    <nav className="crm-lead-rail" aria-label="أقسام إدارة العملاء">
      {visible.map((tab) => (
        <button
          key={tab.route}
          type="button"
          className={`button ghost compact ${tab.matches.includes(path) ? "active" : ""}`}
          aria-current={tab.matches.includes(path) ? "page" : undefined}
          onClick={() => go(tab.route)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

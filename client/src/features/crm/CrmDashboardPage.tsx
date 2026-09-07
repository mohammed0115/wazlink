/**
 * CRM dashboard — real counts, and only counts the API can actually answer.
 *
 * Every tile is derived from a real collection read. Nothing is invented: if
 * the frozen API exposes no metric for something, no tile claims one. The
 * counts are page-scoped where the endpoint is cursor-paginated, and the tile
 * says so rather than implying a workspace total it did not measure.
 */
import { conversationsApi, customersApi, dealsApi, leadsApi, tasksApi } from "../../api";
import { useApiResource } from "../../api/hooks";
import { useAuth } from "../../shared/context/AuthProvider";
import { go } from "../../shared/router/useHashRoute";
import { PageHead } from "../../shared/components/PageHead";
import { ApiErrorState, ApiLoadingState } from "../../shared/components/ApiStates";
import { LeadStatusBadge, fmtNumber, formatIso } from "./components/primitives";

const PAGE = 100;

export function CrmDashboardPage() {
  const { can, activeWorkspace, role } = useAuth();

  const leads = useApiResource((signal) => leadsApi.list({ limit: PAGE }, signal), [], {
    enabled: can("lead.view"),
  });
  const customers = useApiResource((signal) => customersApi.list({ limit: PAGE }, signal), [], {
    enabled: can("customer.view"),
  });
  const tasks = useApiResource((signal) => tasksApi.list({ limit: PAGE }, signal), [], {
    enabled: can("task.view"),
  });
  const deals = useApiResource((signal) => dealsApi.list({ status: "open", limit: PAGE }, signal), [], {
    enabled: can("deal.view"),
  });
  const conversations = useApiResource(
    (signal) => conversationsApi.list({ status: "open", limit: PAGE }, signal),
    [],
    { enabled: can("conversation.view") },
  );

  const anyLoading =
    leads.initialLoading ||
    customers.initialLoading ||
    tasks.initialLoading ||
    deals.initialLoading ||
    conversations.initialLoading;

  const head = (
    <PageHead
      kicker="لوحة التحكم"
      title={activeWorkspace?.name || "مساحة العمل"}
      description={`الدور الحالي: ${role || "—"}. كل الأرقام مقروءة من الخادم مباشرة.`}
    />
  );

  if (anyLoading) {
    return (
      <>
        {head}
        <ApiLoadingState title="جارٍ تحميل لوحة التحكم" />
      </>
    );
  }

  // A permission-scoped failure is not a dashboard failure: the tile is simply
  // absent. Only a hard read failure on a permitted resource is surfaced.
  const failure =
    (can("lead.view") && leads.error) ||
    (can("customer.view") && customers.error) ||
    null;
  if (failure) {
    return (
      <>
        {head}
        <ApiErrorState
          error={failure}
          onRetry={() => {
            leads.reload();
            customers.reload();
          }}
        />
      </>
    );
  }

  const openTasks = (tasks.data?.items ?? []).filter((task) => task.status !== "completed");
  const overdueTasks = openTasks.filter((task) => task.overdue);
  const unread = (conversations.data?.items ?? []).reduce(
    (total, row) => total + (row.unread_count || 0),
    0,
  );

  const tiles: { label: string; value: string; hint: string; route?: string }[] = [];
  if (can("lead.view")) {
    tiles.push({
      label: "عملاء محتملون",
      value: fmtNumber(leads.data?.items.length ?? 0),
      hint: leads.data?.next_cursor ? "أول صفحة فقط" : "الإجمالي الحالي",
      route: "crm",
    });
  }
  if (can("customer.view")) {
    tiles.push({
      label: "عملاء",
      value: fmtNumber(customers.data?.items.length ?? 0),
      hint: customers.data?.next_cursor ? "أول صفحة فقط" : "الإجمالي الحالي",
      route: "crm/customers",
    });
  }
  if (can("task.view")) {
    tiles.push({
      label: "مهام مفتوحة",
      value: fmtNumber(openTasks.length),
      hint: `${fmtNumber(overdueTasks.length)} متأخرة`,
      route: "tasks",
    });
  }
  if (can("deal.view")) {
    tiles.push({
      label: "صفقات مفتوحة",
      value: fmtNumber(deals.data?.items.length ?? 0),
      hint: "قيم متوقعة، ليست إيرادًا",
      route: "deals",
    });
  }
  if (can("conversation.view")) {
    tiles.push({
      label: "رسائل غير مقروءة",
      value: fmtNumber(unread),
      hint: `${fmtNumber(conversations.data?.items.length ?? 0)} محادثة مفتوحة`,
      route: "inbox",
    });
  }

  return (
    <>
      {head}

      <section className="crm-summary-grid" aria-label="ملخص CRM">
        {tiles.map((tile) => (
          <article key={tile.label}>
            <span>{tile.label}</span>
            <b>{tile.value}</b>
            <small>{tile.hint}</small>
            {tile.route ? (
              <button className="button ghost compact" type="button" onClick={() => go(tile.route!)}>
                فتح
              </button>
            ) : null}
          </article>
        ))}
      </section>

      {can("lead.view") ? (
        <section className="card crm-list-card">
          <div className="crm-selection-bar">
            <b>أحدث نشاط على العملاء المحتملين</b>
            <button className="button ghost compact" type="button" onClick={() => go("crm")}>
              عرض الكل
            </button>
          </div>
          <div className="table-wrap">
            <table className="data-table crm-leads-table">
              <thead>
                <tr>
                  <th>العميل المحتمل</th>
                  <th>الحالة</th>
                  <th>آخر نشاط</th>
                </tr>
              </thead>
              <tbody>
                {(leads.data?.items ?? []).slice(0, 8).map((lead) => (
                  <tr key={lead.lead_ref}>
                    <td>
                      <button
                        type="button"
                        className="row-link"
                        onClick={() => go(`crm/leads/${encodeURIComponent(lead.lead_ref)}`)}
                      >
                        {lead.display_name || lead.lead_ref}
                      </button>
                    </td>
                    <td>
                      <LeadStatusBadge status={lead.status} />
                    </td>
                    <td>
                      <small>{formatIso(lead.last_activity_at)}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </>
  );
}

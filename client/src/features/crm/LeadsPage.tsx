/**
 * Leads — the live CRM list.
 *
 * Reads `GET /leads` with server-side filtering and cursor pagination: the
 * table never fetches the workspace and filters in the browser, so it stays
 * correct on a real dataset.
 *
 * The create panel is the DISCOVERY-FREE entry point. It posts
 * `origin_type: "manual"` with a primary contact and no `business_ref`, which
 * is exactly what CA-15 requires; no Business, DiscoveryJob or provenance is
 * fabricated to make the row render.
 */
import { useMemo, useState } from "react";
import {
  authApi,
  leadsApi,
  newIdempotencyKey,
  type LeadListItem,
  type MemberPayload,
} from "../../api";
import { useApiAction, useApiResource } from "../../api/hooks";
import { useAuth } from "../../shared/context/AuthProvider";
import { go } from "../../shared/router/useHashRoute";
import { PageHead } from "../../shared/components/PageHead";
import { CrmNav } from "./components/CrmNav";
import { ApiEmptyState, ApiErrorState, ApiLoadingState, FieldError, FormError } from "../../shared/components/ApiStates";
import { useToast } from "../../shared/store/toast";
import {
  LeadIdentity,
  LeadStatusBadge,
  OriginChip,
  PriorityBadge,
  fmtNumber,
  formatIso,
  leadPriorityLabels,
  leadStatusLabels,
} from "./components/primitives";

interface Filters {
  q: string;
  status: string;
  priority: string;
  owner: string;
}

const EMPTY_FILTERS: Filters = { q: "", status: "", priority: "", owner: "" };

function ManualLeadPanel({ onCreated }: { onCreated: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  // Generated once per intent, not per attempt: a retry after a network blip
  // reuses the key and cannot create a second Lead.
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  const create = useApiAction(async () =>
    leadsApi.create(
      { origin_type: "manual", primary_contact: { name, phone, email } },
      { idempotencyKey },
    ),
  );

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const created = await create.run();
    if (!created) return;
    toast(`أُنشئ عميل محتمل جديد: ${created.display_name || created.lead_ref}`, "success");
    setName("");
    setPhone("");
    setEmail("");
    setIdempotencyKey(newIdempotencyKey());
    onCreated();
  };

  return (
    <section className="card crm-create-panel">
      <div>
        <b>إضافة عميل محتمل يدويًا</b>
        <p className="crm-create-hint">
          لا يتطلب اكتشافًا ولا منشأة مسجّلة. يكفي جهة اتصال أساسية، وتُحفظ مباشرة في قاعدة البيانات.
        </p>
      </div>
      <form className="form-grid" onSubmit={submit} noValidate>
        <div className="form-field">
          <label htmlFor="leadContactName">اسم جهة الاتصال</label>
          <input
            id="leadContactName"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="مثال: نورة الحربي"
            required
          />
          <FieldError error={create.error} field="name" />
          <FieldError error={create.error} field="primary_contact" />
        </div>
        <div className="form-field">
          <label htmlFor="leadContactPhone">الجوال</label>
          <input
            id="leadContactPhone"
            className="ltr"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+9665xxxxxxxx"
          />
          <FieldError error={create.error} field="phone" />
        </div>
        <div className="form-field">
          <label htmlFor="leadContactEmail">البريد الإلكتروني</label>
          <input
            id="leadContactEmail"
            className="ltr"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="name@company.sa"
          />
          <FieldError error={create.error} field="email" />
        </div>
      </form>
      <FormError error={create.error} />
      <div className="crm-create-actions">
        <button
          className="button primary"
          type="button"
          disabled={create.pending || !name.trim()}
          onClick={submit}
        >
          {create.pending ? "جارٍ الحفظ…" : "إنشاء عميل محتمل"}
        </button>
        <span className="crm-create-hint">يُحفظ في PostgreSQL فورًا ويبقى بعد تحديث الصفحة.</span>
      </div>
    </section>
  );
}

export function LeadsPage() {
  const { can } = useAuth();
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const cursor = cursorStack[cursorStack.length - 1] ?? "";
  const [showCreate, setShowCreate] = useState(false);

  const leads = useApiResource(
    (signal) =>
      leadsApi.list(
        {
          q: filters.q || undefined,
          status: filters.status || undefined,
          priority: filters.priority || undefined,
          owner: filters.owner || undefined,
          cursor: cursor || undefined,
          limit: 25,
        },
        signal,
      ),
    [filters.q, filters.status, filters.priority, filters.owner, cursor],
  );

  // Owner filter options come from the workspace's real memberships. A
  // Viewer without member.view simply gets no owner filter.
  const members = useApiResource<{ items: MemberPayload[] }>(
    (signal) => authApi.members(signal),
    [],
    { enabled: can("member.view") },
  );

  const setFilter = (key: keyof Filters, value: string) => {
    setCursorStack([]);
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const rows = leads.data?.items ?? [];
  const hasFilters = useMemo(
    () => Object.values(filters).some((value) => value !== ""),
    [filters],
  );

  const head = (
    <PageHead
      kicker="إدارة العملاء"
      title="العملاء المحتملون"
      description="سجل حي مقروء من قاعدة البيانات. يمكن إنشاء عميل محتمل يدويًا دون أي اعتماد على الاكتشاف."
      actions={
        can("lead.create") ? (
          <button className="button primary" type="button" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "إخفاء نموذج الإضافة" : "إضافة عميل محتمل"}
          </button>
        ) : null
      }
    />
  );

  if (leads.initialLoading) {
    return (
      <>
        {head}
        <ApiLoadingState title="جارٍ تحميل العملاء المحتملين" />
      </>
    );
  }

  if (leads.state === "error" && leads.error) {
    return (
      <>
        {head}
        <ApiErrorState error={leads.error} onRetry={leads.reload} />
      </>
    );
  }

  return (
    <>
      {head}
      <CrmNav />

      {showCreate && can("lead.create") ? (
        <ManualLeadPanel
          onCreated={() => {
            setCursorStack([]);
            leads.reload();
          }}
        />
      ) : null}

      <section className="card crm-filter-card">
        <div className="crm-filter-grid">
          <label className="search-field">
            <span>⌕</span>
            <input
              value={filters.q}
              placeholder="ابحث بالاسم"
              onChange={(event) => setFilter("q", event.target.value)}
            />
          </label>
          <select value={filters.status} onChange={(event) => setFilter("status", event.target.value)}>
            <option value="">كل الحالات</option>
            {Object.entries(leadStatusLabels).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={filters.priority}
            onChange={(event) => setFilter("priority", event.target.value)}
          >
            <option value="">كل الأولويات</option>
            {Object.entries(leadPriorityLabels).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
          {can("member.view") ? (
            <select value={filters.owner} onChange={(event) => setFilter("owner", event.target.value)}>
              <option value="">كل الملاك</option>
              {(members.data?.items ?? []).map((member) => (
                <option value={member.membership_ref} key={member.membership_ref}>
                  {member.email || member.membership_ref}
                </option>
              ))}
            </select>
          ) : null}
        </div>
      </section>

      {rows.length === 0 ? (
        <ApiEmptyState
          title={hasFilters ? "لا توجد نتائج مطابقة للفلاتر" : "لا يوجد عملاء محتملون بعد"}
          description={
            hasFilters
              ? "جرّب توسيع الفلاتر أو إزالتها."
              : "أضف أول عميل محتمل يدويًا — لا حاجة إلى الاكتشاف."
          }
          actions={
            hasFilters ? (
              <button className="button ghost" type="button" onClick={() => setFilter("q", "")}>
                إزالة البحث
              </button>
            ) : can("lead.create") ? (
              <button className="button primary" type="button" onClick={() => setShowCreate(true)}>
                إضافة عميل محتمل
              </button>
            ) : null
          }
        />
      ) : (
        <section className="card crm-list-card">
          <div className="table-wrap">
            <table className="data-table crm-leads-table">
              <thead>
                <tr>
                  <th>العميل المحتمل</th>
                  <th>الحالة</th>
                  <th>الأولوية</th>
                  <th>المصدر</th>
                  <th>آخر نشاط</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((lead: LeadListItem) => (
                  <tr key={lead.lead_ref}>
                    <td>
                      <LeadIdentity
                        lead={lead}
                        onOpen={() => go(`crm/leads/${encodeURIComponent(lead.lead_ref)}`)}
                      />
                    </td>
                    <td>
                      <LeadStatusBadge status={lead.status} />
                    </td>
                    <td>
                      <PriorityBadge priority={lead.priority} />
                    </td>
                    <td>
                      <OriginChip origin={lead.origin_type} />
                    </td>
                    <td>
                      <small>{formatIso(lead.last_activity_at)}</small>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="button ghost compact"
                        onClick={() => go(`crm/leads/${encodeURIComponent(lead.lead_ref)}`)}
                      >
                        فتح 360
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="crm-pager">
            <span>{fmtNumber(rows.length)} عنصر في هذه الصفحة</span>
            <div className="crm-state-actions">
              <button
                className="button ghost compact"
                type="button"
                disabled={cursorStack.length === 0}
                onClick={() => setCursorStack((stack) => stack.slice(0, -1))}
              >
                السابق
              </button>
              <button
                className="button ghost compact"
                type="button"
                disabled={!leads.data?.next_cursor}
                onClick={() =>
                  setCursorStack((stack) =>
                    leads.data?.next_cursor ? [...stack, leads.data.next_cursor] : stack,
                  )
                }
              >
                التالي
              </button>
            </div>
          </div>
        </section>
      )}
    </>
  );
}

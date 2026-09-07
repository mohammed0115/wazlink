/**
 * Contacts — the workspace's people, read from the real contact table.
 *
 * A Contact belongs to its CRM party through a link row; this list does not
 * duplicate contact details onto Lead or Customer to make rendering easier,
 * and the 360 pages compose their contacts from the server instead.
 *
 * `masked` comes from the server: a Viewer sees masked PII because the
 * SELECTOR masked it before serialization, not because this screen hid it.
 */
import { useState } from "react";
import { contactsApi } from "../../api";
import { useApiResource } from "../../api/hooks";
import { PageHead } from "../../shared/components/PageHead";
import { CrmNav } from "./components/CrmNav";
import { ApiEmptyState, ApiErrorState, ApiLoadingState } from "../../shared/components/ApiStates";
import { Mono, fmtNumber } from "./components/primitives";

export function ContactsPage() {
  const [q, setQ] = useState("");
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const cursor = cursorStack[cursorStack.length - 1] ?? "";

  const contacts = useApiResource(
    (signal) => contactsApi.list({ q: q || undefined, cursor: cursor || undefined, limit: 25 }, signal),
    [q, cursor],
  );

  const head = (
    <PageHead
      kicker="إدارة العملاء"
      title="جهات الاتصال"
      description="قائمة جهات الاتصال الحقيقية في مساحة العمل، مع إخفاء البيانات الحساسة حسب الصلاحية."
    />
  );

  if (contacts.initialLoading) {
    return (
      <>
        {head}
        <ApiLoadingState title="جارٍ تحميل جهات الاتصال" />
      </>
    );
  }
  if (contacts.state === "error" && contacts.error) {
    return (
      <>
        {head}
        <ApiErrorState error={contacts.error} onRetry={contacts.reload} />
      </>
    );
  }

  const rows = contacts.data?.items ?? [];

  return (
    <>
      {head}
      <CrmNav />
      <section className="card crm-filter-card">
        <div className="crm-filter-grid">
          <label className="search-field">
            <span>⌕</span>
            <input
              value={q}
              placeholder="ابحث بالاسم"
              onChange={(event) => {
                setCursorStack([]);
                setQ(event.target.value);
              }}
            />
          </label>
        </div>
      </section>

      {rows.length === 0 ? (
        <ApiEmptyState
          title="لا توجد جهات اتصال"
          description="تُنشأ جهات الاتصال مع أول عميل محتمل أو عميل تضيفه يدويًا."
        />
      ) : (
        <section className="card crm-list-card">
          <div className="table-wrap">
            <table className="data-table crm-leads-table">
              <thead>
                <tr>
                  <th>الاسم</th>
                  <th>البريد</th>
                  <th>الجوال</th>
                  <th>المسمى</th>
                  <th>المعرف</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((contact) => (
                  <tr key={contact.contact_ref}>
                    <td>
                      <b>{contact.full_name || "—"}</b>
                      {contact.masked ? <span className="status neutral"> مخفي</span> : null}
                    </td>
                    <td className="ltr">{contact.email || "—"}</td>
                    <td className="ltr">{contact.phone || "—"}</td>
                    <td>{contact.title || "—"}</td>
                    <td>
                      <Mono>{contact.contact_ref}</Mono>
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
                disabled={!contacts.data?.next_cursor}
                onClick={() =>
                  setCursorStack((stack) =>
                    contacts.data?.next_cursor ? [...stack, contacts.data.next_cursor] : stack,
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

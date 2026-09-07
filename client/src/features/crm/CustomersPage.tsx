/**
 * Customers — the canonical CRM party.
 *
 * Customer is the one party model; no parallel "Account" is introduced here to
 * make a screen easier. Creation supports both frozen kinds (organization,
 * person) and requires NO Business: a person customer created by hand is a
 * first-class record, not a degraded one.
 */
import { useState } from "react";
import { customersApi, newIdempotencyKey, type PartyKind } from "../../api";
import { useApiAction, useApiResource } from "../../api/hooks";
import { useAuth } from "../../shared/context/AuthProvider";
import { go } from "../../shared/router/useHashRoute";
import { PageHead } from "../../shared/components/PageHead";
import { CrmNav } from "./components/CrmNav";
import {
  ApiEmptyState,
  ApiErrorState,
  ApiLoadingState,
  FieldError,
  FormError,
} from "../../shared/components/ApiStates";
import { useToast } from "../../shared/store/toast";
import { Mono, OriginChip, fmtNumber, partyKindLabels } from "./components/primitives";

function CreateCustomerPanel({ onCreated }: { onCreated: () => void }) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [partyKind, setPartyKind] = useState<PartyKind>("organization");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  const create = useApiAction(() =>
    customersApi.create(
      {
        party_kind: partyKind,
        name,
        origin_kind: "manual",
        ...(contactName.trim()
          ? { primary_contact: { name: contactName, phone: contactPhone } }
          : {}),
      },
      idempotencyKey,
    ),
  );

  return (
    <section className="card crm-create-panel">
      <div>
        <b>إضافة عميل يدويًا</b>
        <p className="crm-create-hint">
          بدون اكتشاف وبدون منشأة مرتبطة. اختر النوع ثم احفظ — يُكتب السجل في PostgreSQL مباشرة.
        </p>
      </div>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="customerName">الاسم</label>
          <input id="customerName" value={name} onChange={(event) => setName(event.target.value)} />
          <FieldError error={create.error} field="name" />
        </div>
        <div className="form-field">
          <label htmlFor="customerKind">النوع</label>
          <select
            id="customerKind"
            value={partyKind}
            onChange={(event) => setPartyKind(event.target.value as PartyKind)}
          >
            {Object.entries(partyKindLabels).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
          <FieldError error={create.error} field="party_kind" />
        </div>
        <div className="form-field">
          <label htmlFor="customerContact">جهة اتصال أساسية (اختياري)</label>
          <input
            id="customerContact"
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
          />
        </div>
        <div className="form-field">
          <label htmlFor="customerContactPhone">جوال جهة الاتصال</label>
          <input
            id="customerContactPhone"
            className="ltr"
            value={contactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
          />
        </div>
      </div>
      <FormError error={create.error} />
      <div className="crm-create-actions">
        <button
          className="button primary"
          type="button"
          disabled={create.pending || !name.trim()}
          onClick={async () => {
            const created = await create.run();
            if (!created) return;
            toast(`أُنشئ العميل: ${created.name}`, "success");
            setName("");
            setContactName("");
            setContactPhone("");
            setIdempotencyKey(newIdempotencyKey());
            onCreated();
          }}
        >
          {create.pending ? "جارٍ الحفظ…" : "إنشاء عميل"}
        </button>
      </div>
    </section>
  );
}

export function CustomersPage() {
  const { can } = useAuth();
  const [q, setQ] = useState("");
  const [partyKind, setPartyKind] = useState("");
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const cursor = cursorStack[cursorStack.length - 1] ?? "";

  const customers = useApiResource(
    (signal) =>
      customersApi.list(
        { q: q || undefined, party_kind: partyKind || undefined, cursor: cursor || undefined, limit: 25 },
        signal,
      ),
    [q, partyKind, cursor],
  );

  const head = (
    <PageHead
      kicker="إدارة العملاء"
      title="العملاء"
      description="الطرف الأساسي في CRM. يمكن إنشاؤه يدويًا بالكامل دون أي اعتماد على الاكتشاف."
      actions={
        can("customer.create") ? (
          <button className="button primary" type="button" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "إخفاء نموذج الإضافة" : "إضافة عميل"}
          </button>
        ) : null
      }
    />
  );

  if (customers.initialLoading) {
    return (
      <>
        {head}
        <ApiLoadingState title="جارٍ تحميل العملاء" />
      </>
    );
  }
  if (customers.state === "error" && customers.error) {
    return (
      <>
        {head}
        <ApiErrorState error={customers.error} onRetry={customers.reload} />
      </>
    );
  }

  const rows = customers.data?.items ?? [];

  return (
    <>
      {head}
      <CrmNav />

      {showCreate && can("customer.create") ? (
        <CreateCustomerPanel
          onCreated={() => {
            setCursorStack([]);
            customers.reload();
          }}
        />
      ) : null}

      <section className="card crm-filter-card">
        <div className="crm-filter-grid">
          <label className="search-field">
            <span>⌕</span>
            <input
              value={q}
              placeholder="ابحث باسم العميل"
              onChange={(event) => {
                setCursorStack([]);
                setQ(event.target.value);
              }}
            />
          </label>
          <select
            value={partyKind}
            onChange={(event) => {
              setCursorStack([]);
              setPartyKind(event.target.value);
            }}
          >
            <option value="">كل الأنواع</option>
            {Object.entries(partyKindLabels).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {rows.length === 0 ? (
        <ApiEmptyState
          title="لا يوجد عملاء بعد"
          description="أضف عميلًا يدويًا، أو حوّل عميلًا محتملًا من صفحته."
        />
      ) : (
        <section className="card crm-list-card">
          <div className="table-wrap">
            <table className="data-table crm-leads-table">
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>النوع</th>
                  <th>الحالة</th>
                  <th>المصدر</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((customer) => (
                  <tr key={customer.customer_ref}>
                    <td>
                      <button
                        type="button"
                        className="row-link company-cell"
                        onClick={() =>
                          go(`crm/customers/${encodeURIComponent(customer.customer_ref)}`)
                        }
                      >
                        <i className="company-mark">{(customer.name || "؟").slice(0, 1)}</i>
                        <span>
                          <b>{customer.name}</b>
                          <small>
                            <Mono>{customer.customer_ref}</Mono>
                          </small>
                        </span>
                      </button>
                    </td>
                    <td>{partyKindLabels[customer.party_kind] || customer.party_kind}</td>
                    <td>
                      <span className="status neutral">{customer.status}</span>
                    </td>
                    <td>
                      <OriginChip origin={customer.origin_kind} />
                    </td>
                    <td>
                      <button
                        className="button ghost compact"
                        type="button"
                        onClick={() =>
                          go(`crm/customers/${encodeURIComponent(customer.customer_ref)}`)
                        }
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
                disabled={!customers.data?.next_cursor}
                onClick={() =>
                  setCursorStack((stack) =>
                    customers.data?.next_cursor ? [...stack, customers.data.next_cursor] : stack,
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

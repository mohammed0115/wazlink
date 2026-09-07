/**
 * Deals — the live pipeline list.
 *
 * THE REVENUE BOUNDARY, stated where the action is taken:
 * a Deal's `value` is a FORECAST and closing a deal Won records a deal
 * outcome. It does NOT recognize revenue. Revenue recognition is a separate,
 * separately-permissioned finance command (`POST /revenue/events`), and this
 * screen neither calls it nor implies it happened. The note next to the close
 * control says so to the user, because a sales UI that lets "Won" read as
 * "money booked" is how forecast and ledger drift apart.
 *
 * A deal attaches to a Lead or a Customer, and neither requires a Business —
 * so a CRM-only party can carry a deal end to end.
 */
import { useState } from "react";
import { customersApi, dealsApi, leadsApi, type DealPayload } from "../../api";
import { useApiAction, useApiResource } from "../../api/hooks";
import { useAuth } from "../../shared/context/AuthProvider";
import { go } from "../../shared/router/useHashRoute";
import { PageHead } from "../../shared/components/PageHead";
import {
  ApiEmptyState,
  ApiErrorState,
  ApiLoadingState,
  FieldError,
  FormError,
} from "../../shared/components/ApiStates";
import { useToast } from "../../shared/store/toast";
import { Mono, fmtNumber, formatIso, formatMoney } from "../crm/components/primitives";

const DEAL_STATUS_LABELS: Record<string, string> = {
  open: "مفتوحة",
  won: "مكسوبة",
  lost: "خاسرة",
};

function CreateDealPanel({ onCreated }: { onCreated: () => void }) {
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [partyType, setPartyType] = useState<"lead" | "customer">("customer");
  const [partyRef, setPartyRef] = useState("");

  // Both party lists are real reads; a deal can hang off either one.
  const leads = useApiResource((signal) => leadsApi.list({ limit: 50 }, signal), [], {
    enabled: partyType === "lead",
  });
  const customers = useApiResource((signal) => customersApi.list({ limit: 50 }, signal), [], {
    enabled: partyType === "customer",
  });

  const create = useApiAction(() =>
    dealsApi.create({
      title,
      value: value || "0",
      currency: "SAR",
      ...(partyType === "lead" ? { lead_ref: partyRef } : { customer_ref: partyRef }),
    }),
  );

  return (
    <section className="card crm-create-panel">
      <div>
        <b>إنشاء صفقة</b>
        <p className="crm-create-hint">
          تُربط الصفقة بعميل محتمل أو بعميل. لا يشترط وجود منشأة مكتشفة.
        </p>
      </div>
      <div className="form-grid">
        <div className="form-field">
          <label htmlFor="dealTitle">عنوان الصفقة</label>
          <input id="dealTitle" value={title} onChange={(event) => setTitle(event.target.value)} />
          <FieldError error={create.error} field="title" />
        </div>
        <div className="form-field">
          <label htmlFor="dealValue">القيمة المتوقعة (ريال)</label>
          <input
            id="dealValue"
            className="ltr"
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="0.00"
          />
          <FieldError error={create.error} field="value" />
        </div>
        <div className="form-field">
          <label htmlFor="dealPartyType">نوع الطرف</label>
          <select
            id="dealPartyType"
            value={partyType}
            onChange={(event) => {
              setPartyType(event.target.value as "lead" | "customer");
              setPartyRef("");
            }}
          >
            <option value="customer">عميل</option>
            <option value="lead">عميل محتمل</option>
          </select>
        </div>
        <div className="form-field">
          <label htmlFor="dealParty">الطرف</label>
          <select
            id="dealParty"
            value={partyRef}
            onChange={(event) => setPartyRef(event.target.value)}
          >
            <option value="">اختر…</option>
            {partyType === "lead"
              ? (leads.data?.items ?? []).map((lead) => (
                  <option value={lead.lead_ref} key={lead.lead_ref}>
                    {lead.display_name || lead.lead_ref}
                  </option>
                ))
              : (customers.data?.items ?? []).map((customer) => (
                  <option value={customer.customer_ref} key={customer.customer_ref}>
                    {customer.name}
                  </option>
                ))}
          </select>
        </div>
      </div>
      <p className="revenue-boundary-note">
        القيمة هنا توقّع للمبيعات. الاعتراف بالإيراد إجراء مالي منفصل ولا يتم من هذه الشاشة.
      </p>
      <FormError error={create.error} />
      <div className="crm-create-actions">
        <button
          className="button primary"
          type="button"
          disabled={create.pending || !title.trim() || !partyRef}
          onClick={async () => {
            const created = await create.run();
            if (!created) return;
            toast("أُنشئت الصفقة.", "success");
            setTitle("");
            setValue("");
            setPartyRef("");
            onCreated();
          }}
        >
          {create.pending ? "جارٍ الحفظ…" : "إنشاء صفقة"}
        </button>
      </div>
    </section>
  );
}

export function DealsPage() {
  const toast = useToast();
  const { can } = useAuth();
  const [status, setStatus] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const deals = useApiResource(
    (signal) => dealsApi.list({ status: status || undefined, limit: 50 }, signal),
    [status],
  );
  const close = useApiAction((deal: DealPayload, outcome: "won" | "lost") =>
    dealsApi.close(deal.deal_ref, outcome, deal.version, outcome === "lost" ? "غير محدد" : ""),
  );

  const head = (
    <PageHead
      kicker="المبيعات"
      title="الصفقات"
      description="قائمة الصفقات الحقيقية. القيم توقّعات مبيعات ولا تعني إيرادًا معترفًا به."
      actions={
        can("deal.create") ? (
          <button className="button primary" type="button" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "إخفاء النموذج" : "صفقة جديدة"}
          </button>
        ) : null
      }
    />
  );

  if (deals.initialLoading) {
    return (
      <>
        {head}
        <ApiLoadingState title="جارٍ تحميل الصفقات" />
      </>
    );
  }
  if (deals.state === "error" && deals.error) {
    return (
      <>
        {head}
        <ApiErrorState error={deals.error} onRetry={deals.reload} />
      </>
    );
  }

  const rows = deals.data?.items ?? [];

  return (
    <>
      {head}

      {showCreate && can("deal.create") ? (
        <CreateDealPanel onCreated={deals.reload} />
      ) : null}

      <section className="card crm-filter-card">
        <div className="crm-filter-grid">
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">كل الحالات</option>
            {Object.entries(DEAL_STATUS_LABELS).map(([key, label]) => (
              <option value={key} key={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </section>

      <FormError error={close.error} />

      {rows.length === 0 ? (
        <ApiEmptyState title="لا توجد صفقات" description="أنشئ صفقة وأربطها بعميل أو عميل محتمل." />
      ) : (
        <section className="card crm-list-card">
          <div className="table-wrap">
            <table className="data-table crm-leads-table">
              <thead>
                <tr>
                  <th>الصفقة</th>
                  <th>المرحلة</th>
                  <th>القيمة المتوقعة</th>
                  <th>الحالة</th>
                  <th>الإغلاق</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((deal) => (
                  <tr key={deal.deal_ref}>
                    <td>
                      <b>{deal.title}</b>
                      <br />
                      <small>
                        <Mono>{deal.deal_ref}</Mono>
                      </small>
                    </td>
                    <td>{deal.stage?.name || "—"}</td>
                    <td className="ltr">{formatMoney(deal.value, deal.currency)}</td>
                    <td>
                      <span
                        className={`status ${
                          deal.status === "won" ? "success" : deal.status === "lost" ? "danger" : "info"
                        }`}
                      >
                        {DEAL_STATUS_LABELS[deal.status] || deal.status}
                      </span>
                    </td>
                    <td>
                      <small>{formatIso(deal.closed_at)}</small>
                    </td>
                    <td>
                      {can("deal.close") && deal.status === "open" ? (
                        <div className="crm-state-actions">
                          <button
                            className="button ghost compact"
                            type="button"
                            disabled={close.pending}
                            onClick={async () => {
                              const result = await close.run(deal, "won");
                              if (!result) return;
                              toast("أُغلقت الصفقة كمكسوبة. لم يُسجَّل أي إيراد.", "success");
                              deals.reload();
                            }}
                          >
                            كسب
                          </button>
                          <button
                            className="button ghost compact"
                            type="button"
                            disabled={close.pending}
                            onClick={async () => {
                              const result = await close.run(deal, "lost");
                              if (!result) return;
                              toast("أُغلقت الصفقة كخاسرة.", "info");
                              deals.reload();
                            }}
                          >
                            خسارة
                          </button>
                        </div>
                      ) : (
                        <button
                          className="button ghost compact"
                          type="button"
                          onClick={() => go(`deals/${encodeURIComponent(deal.deal_ref)}`)}
                        >
                          تفاصيل
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="crm-pager">
            <span>{fmtNumber(rows.length)} صفقة</span>
            <p className="revenue-boundary-note">
              «مكسوبة» حالة صفقة فقط. الإيراد المعترف به يُسجَّل عبر الحد المالي المستقل.
            </p>
          </div>
        </section>
      )}
    </>
  );
}

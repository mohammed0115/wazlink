/**
 * Deal detail — the live record.
 *
 * Stage moves and closing carry `If-Match`, so this page cannot overwrite a
 * change made elsewhere; it shows the conflict instead. Winning the deal
 * records a deal outcome and nothing else — revenue recognition is a separate
 * finance command this page deliberately does not call.
 */
import { dealsApi, type DealPayload } from "../../api";
import { useApiAction, useApiResource } from "../../api/hooks";
import { useAuth } from "../../shared/context/AuthProvider";
import { go } from "../../shared/router/useHashRoute";
import { PageHead } from "../../shared/components/PageHead";
import { ApiErrorState, ApiLoadingState, FormError } from "../../shared/components/ApiStates";
import { useToast } from "../../shared/store/toast";
import { Mono, formatIso, formatMoney } from "../crm/components/primitives";

const STATUS_LABELS: Record<string, string> = { open: "مفتوحة", won: "مكسوبة", lost: "خاسرة" };

export function Deal360Page({ dealRef }: { dealRef: string }) {
  const toast = useToast();
  const { can } = useAuth();
  const deal = useApiResource<DealPayload>((signal) => dealsApi.get(dealRef, signal), [dealRef]);

  const close = useApiAction((row: DealPayload, outcome: "won" | "lost") =>
    dealsApi.close(row.deal_ref, outcome, row.version, outcome === "lost" ? "غير محدد" : ""),
  );

  if (deal.initialLoading) return <ApiLoadingState title="جارٍ تحميل الصفقة" />;
  if (deal.state === "error" && deal.error) {
    return (
      <ApiErrorState
        error={deal.error}
        onRetry={deal.reload}
        actions={
          <button className="button ghost" type="button" onClick={() => go("deals")}>
            العودة إلى الصفقات
          </button>
        }
      />
    );
  }
  if (!deal.data) return null;

  const row = deal.data;
  const partyRoute = row.customer_ref
    ? `crm/customers/${encodeURIComponent(row.customer_ref)}`
    : row.lead_ref
      ? `crm/leads/${encodeURIComponent(row.lead_ref)}`
      : "";

  return (
    <>
      <PageHead
        kicker="الصفقة"
        title={row.title}
        description="بيانات الصفقة كما هي في قاعدة البيانات."
        actions={
          <button className="button ghost" type="button" onClick={() => go("deals")}>
            العودة إلى الصفقات
          </button>
        }
      />

      <section className="card lead-360-hero">
        <div className="lead-identity">
          <i className="company-mark">◆</i>
          <div>
            <h2>{row.title}</h2>
            <p>
              <Mono>{row.deal_ref}</Mono>
            </p>
          </div>
        </div>
        <div className="lead-quick-state">
          <div>
            <span>المرحلة</span>
            <b>{row.stage?.name || "—"}</b>
          </div>
          <div>
            <span>القيمة المتوقعة</span>
            <b className="ltr">{formatMoney(row.value, row.currency)}</b>
          </div>
          <div>
            <span>الحالة</span>
            <b>{STATUS_LABELS[row.status] || row.status}</b>
          </div>
        </div>
      </section>

      <FormError error={close.error} />

      <section className="card party-section">
        <header>
          <h3>التفاصيل</h3>
          {partyRoute ? (
            <button className="button ghost compact" type="button" onClick={() => go(partyRoute)}>
              فتح ملف الطرف
            </button>
          ) : null}
        </header>
        <div className="party-body">
          <div className="party-row">
            <span className="grow">
              <b>القيمة المرجّحة</b>
              <small className="ltr">{formatMoney(row.weighted_value, row.currency)}</small>
            </span>
          </div>
          <div className="party-row">
            <span className="grow">
              <b>تاريخ الإغلاق</b>
              <small>{formatIso(row.closed_at)}</small>
            </span>
          </div>
          {row.loss_reason ? (
            <div className="party-row">
              <span className="grow">
                <b>سبب الخسارة</b>
                <small>{row.loss_reason}</small>
              </span>
            </div>
          ) : null}
          <p className="revenue-boundary-note">
            كسب الصفقة يغيّر حالتها فقط ولا يُنشئ إيرادًا معترفًا به. الاعتراف بالإيراد إجراء مالي
            منفصل بصلاحية مستقلة.
          </p>
          {can("deal.close") && row.status === "open" ? (
            <div className="crm-state-actions">
              <button
                className="button primary compact"
                type="button"
                disabled={close.pending}
                onClick={async () => {
                  const done = await close.run(row, "won");
                  if (!done) return;
                  toast("أُغلقت الصفقة كمكسوبة. لم يُسجَّل أي إيراد.", "success");
                  deal.reload();
                }}
              >
                إغلاق ككسب
              </button>
              <button
                className="button ghost compact"
                type="button"
                disabled={close.pending}
                onClick={async () => {
                  const done = await close.run(row, "lost");
                  if (!done) return;
                  toast("أُغلقت الصفقة كخاسرة.", "info");
                  deal.reload();
                }}
              >
                إغلاق كخسارة
              </button>
            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}

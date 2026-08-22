/**
 * كتالوج التكاملات — S11.
 *
 * كل ربط أو فصل أو إعادة محاولة يغيّر الذاكرة المحلية وسجل التدقيق فقط:
 * لا OAuth ولا API keys ولا provider request ولا Webhook. تُحفظ
 * `hasConfiguredSecret` فقط ولا تُخزَّن أو تُعرض أي قيمة سرية.
 */
import type { FormEvent } from "react";
import {
  connectIntegrationMock,
  disconnectIntegrationMock,
  getIntegration,
  getIntegrationActivities,
  integrationStatusLabels as rawStatusLabels,
  mockModel,
  retryIntegrationMock,
  state,
  updateIntegrationConfiguration,
} from "@services/data";
import { mutate, notifyStateChanged } from "../../shared/store/appStore";
import { useToast } from "../../shared/store/toast";
import { PageHead } from "../../shared/components/PageHead";
import {
  AuditList,
  GovernanceRail,
  capabilityLabels,
  categoryLabels,
  fmtDate,
  integrationStatusClass,
  modeLabels,
  providerLabels,
} from "./shared";

type Row = Record<string, any>;
const integrationStatusLabels = rawStatusLabels as Record<string, string>;

function IntegrationAction({ integration, toast }: { integration: Row; toast: (m: string, t?: any) => void }) {
  const act = (fn: () => unknown, message: string) => {
    mutate(fn);
    toast(message, "info");
  };

  if (integration.status === "mock_connected") {
    return (
      <button className="button" type="button" onClick={() => act(() => disconnectIntegrationMock(integration.id), "فُصل التكامل تجريبيًا؛ لا طلب شبكة.")}>
        فصل تجريبي
      </button>
    );
  }
  if (integration.status === "error") {
    return (
      <button className="button" type="button" onClick={() => act(() => retryIntegrationMock(integration.id), "أُعيدت المحاولة محليًا.")}>
        إعادة محاولة محلية
      </button>
    );
  }
  if (integration.status === "not_connected") {
    return (
      <button className="button primary" type="button" onClick={() => act(() => connectIntegrationMock(integration.id), "اتصال تجريبي / Mock — لم يُرسل أي طلب.")}>
        ربط تجريبي
      </button>
    );
  }
  if (integration.status === "configuration_required") {
    return (
      <button
        className="button"
        type="button"
        onClick={() => {
          state.s11Ui = { ...state.s11Ui, integrationDetailId: integration.id };
          notifyStateChanged();
        }}
      >
        إعداد محلي
      </button>
    );
  }
  return (
    <button className="button" type="button" disabled>
      لا إجراء خارجي
    </button>
  );
}

export function Integrations() {
  const toast = useToast();
  const selected = getIntegration(state.s11Ui.integrationDetailId);

  return (
    <div className="s11-workspace">
      <GovernanceRail note="S11 · وضع تجريبي" />
      <PageHead
        kicker="S11 · تكاملات تجريبية"
        title="كتالوج التكاملات"
        description="تعرض هذه الصفحة إعدادات وقدرات محلية فقط. لا يوجد OAuth أو مفتاح API أو اتصال إنتاجي أو Webhook."
      />

      <div className="s11-global-disclosure">
        <b>وضع تجريبي / Mock</b>
        <span>
          كل حالة ربط أو فصل أو إعادة محاولة محفوظة في الذاكرة الحالية فقط، ولا تغيّر سلوك صندوق الوارد أو مساعد
          المبيعات أو الأتمتة القائم.
        </span>
      </div>

      {selected && <IntegrationDetail integration={selected} toast={toast} />}

      <section className="s11-integration-grid">
        {mockModel.integrations.map((integration: Row) => (
          <article className="s11-integration-card" key={integration.id}>
            <header>
              <span className="s11-integration-mark">{integration.name.slice(0, 1)}</span>
              <div>
                <b>{integration.name}</b>
                <small>{integration.context}</small>
              </div>
              <em className={`s11-status ${integrationStatusClass(integration.status)}`}>
                {integrationStatusLabels[integration.status]}
              </em>
            </header>
            <p>
              {categoryLabels[integration.category] || "تكامل تجريبي"} · {modeLabels[integration.mode] || "محاكاة محلية"}
            </p>
            <div className="s11-capabilities">
              {integration.capabilities.slice(0, 2).map((capability: string) => (
                <span key={capability}>{capabilityLabels[capability] || "قدرة تجريبية"}</span>
              ))}
            </div>
            <footer>
              <button
                className="button ghost"
                type="button"
                onClick={() => {
                  state.s11Ui = { ...state.s11Ui, integrationDetailId: integration.id };
                  notifyStateChanged();
                }}
              >
                التفاصيل
              </button>
              <IntegrationAction integration={integration} toast={toast} />
            </footer>
          </article>
        ))}
      </section>
    </div>
  );
}

function IntegrationDetail({ integration, toast }: { integration: Row; toast: (m: string, t?: any) => void }) {
  const activities = getIntegrationActivities(integration.id) as Row[];

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const hasConfiguredSecret = new FormData(event.currentTarget).get("hasConfiguredSecret") === "on";
    mutate(() => updateIntegrationConfiguration(integration.id, { hasConfiguredSecret }));
    toast("حُفظ الإعداد المحلي؛ لا تُخزَّن أي قيمة سرية فعلية.", "success");
  }

  return (
    <section className="s11-integration-detail">
      <header>
        <div>
          <p className="eyebrow">تفاصيل التكامل</p>
          <h2>{integration.name}</h2>
          <p>{integration.context} · اتصال تجريبي / Mock</p>
        </div>
        <button
          className="top-icon"
          type="button"
          aria-label="إغلاق التفاصيل"
          onClick={() => {
            state.s11Ui = { ...state.s11Ui, integrationDetailId: null };
            notifyStateChanged();
          }}
        >
          ×
        </button>
      </header>

      <div className="s11-detail-grid">
        <p><span>المزود</span><b>{providerLabels[integration.provider] || integration.name}</b></p>
        <p>
          <span>الحالة</span>
          <b className={`s11-status ${integrationStatusClass(integration.status)}`}>
            {integrationStatusLabels[integration.status]}
          </b>
        </p>
        <p><span>الوضع</span><b>{modeLabels[integration.mode] || "محاكاة محلية"}</b></p>
        <p><span>آخر فحص</span><b>{fmtDate(integration.lastCheckedAt)}</b></p>
        <p><span>تم الربط بواسطة</span><b>{integration.connectedBy || "—"}</b></p>
        <p><span>آخر إعداد</span><b>{fmtDate(integration.configuredAt)}</b></p>
      </div>

      {integration.errorReason && (
        <div className="s11-error-note">
          <b>خطأ إعداد تجريبي</b>
          <span>{integration.errorReason}</span>
        </div>
      )}

      <section className="s11-subsection">
        <h3>القدرات المعلنة</h3>
        <div className="s11-capabilities">
          {integration.capabilities.map((capability: string) => (
            <span key={capability}>{capabilityLabels[capability] || "قدرة تجريبية"}</span>
          ))}
        </div>
      </section>

      <section className="s11-subsection">
        <h3>إعدادات تجريبية</h3>
        <form className="s11-form compact-detail" onSubmit={submit}>
          <label className="form-field">
            <span>قيمة سرية تجريبية</span>
            <input value="••••••••••••" disabled aria-describedby="secretDisclosure" readOnly />
          </label>
          <label className="s11-toggle">
            <input type="checkbox" name="hasConfiguredSecret" defaultChecked={integration.hasConfiguredSecret} />
            <span>
              <b>تم إعداد قيمة تجريبية</b>
              <small id="secretDisclosure">لا تُحفظ أو تُعرض أي قيمة سرية فعلية.</small>
            </span>
          </label>
          <button type="submit" className="button">حفظ إعداد محلي</button>
        </form>
      </section>

      <section className="s11-subsection">
        <h3>سجل التدقيق</h3>
        <AuditList rows={activities} />
      </section>

      <footer>
        <IntegrationAction integration={integration} toast={toast} />
        <small>لا يبدأ هذا الإجراء إدارة العملاء أو صندوق الوارد أو حدث إيراد ولا يرسل أي طلب شبكة.</small>
      </footer>
    </section>
  );
}

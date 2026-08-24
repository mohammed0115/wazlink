import { settingsFeatureService } from "@services";
/**
 * الإعدادات والحوكمة — S11.
 *
 * إدارة محلية للهوية والفريق والتفضيلات. لا مصادقة ولا OAuth ولا إرسال بريد،
 * ويعاد استخدام `User` و`Team` القائمين بلا قاعدة مستخدمين ثانية.
 */
import { useState, type FormEvent } from "react";
import { notificationCategoryLabels as rawCategories, notificationChannelLabels as rawChannels, workspaceCurrencies, workspaceLocales, workspaceTimezones } from "@services";
import { go } from "../../shared/router/useHashRoute";
import { mutate } from "../../shared/store/appStore";
import { useToast } from "../../shared/store/toast";
import { PageHead } from "../../shared/components/PageHead";
import { AuditList, GovernanceRail, fmtDate, settingsSections } from "./shared";

type Row = Record<string, any>;
const notificationCategoryLabels = rawCategories as Record<string, string>;
const notificationChannelLabels = rawChannels as Record<string, string>;

/** الكتالوجات قد تكون مصفوفة نصوص أو كائنات {id,label}. */
function OptionRows({ items }: { items: readonly (string | Row)[] }) {
  return (
    <>
      {items.map((item) => {
        const value = typeof item === "string" ? item : item.id;
        const label = typeof item === "string" ? item : (item.label ?? item.id);
        return (
          <option value={value} key={value}>
            {label}
          </option>
        );
      })}
    </>
  );
}

export function Settings({ section }: { section?: string }) {
  const toast = useToast();
  const [localSection, setLocalSection] = useState("workspace");
  const active = section || localSection;

  const setSection = (id: string) => setLocalSection(id);

  return (
    <div className="s11-workspace">
      <GovernanceRail note="S11 · إعدادات محلية" />
      <PageHead
        kicker="S11 · إعدادات مساحة العمل"
        title="الإعدادات والحوكمة"
        description="إدارة محلية للهوية والفريق والتفضيلات؛ لا توجد مصادقة أو تكاملات أو إرسال خارجي حقيقي."
      />
      <div className="s11-layout">
        <nav className="s11-section-nav" aria-label="أقسام الإعدادات">
          {settingsSections.map(([id, label, description]) => (
            <button
              type="button"
              key={id}
              className={`s11-section-button ${active === id ? "active" : ""}`}
              aria-current={active === id ? "page" : undefined}
              onClick={() => (id === "integrations" || id === "billing" ? go(`settings/${id}`) : setSection(id))}
            >
              <b>{label}</b>
              <small>{description}</small>
            </button>
          ))}
        </nav>

        <main className="s11-content">
          {active === "workspace" && <WorkspaceSection toast={toast} />}
          {active === "account" && <AccountSection toast={toast} />}
          {active === "team" && <TeamSection toast={toast} />}
          {active === "notifications" && <NotificationsSection toast={toast} />}
          {active === "security" && <SecuritySection toast={toast} />}
          {active === "integrations" && (
            <RouteCard
              route="settings/integrations"
              title="التكاملات التجريبية"
              description="استعرض الكتالوج وحالة Mock والقدرات والإعدادات المحلية."
              action="فتح كتالوج التكاملات"
            />
          )}
          {active === "billing" && (
            <RouteCard
              route="settings/billing"
              title="الفوترة التجريبية"
              description="راجع الاشتراك والاستخدام والفواتير ووسيلة الدفع المقنّعة."
              action="فتح الفوترة"
            />
          )}
        </main>
      </div>
    </div>
  );
}

function RouteCard({ route, title, description, action }: { route: string; title: string; description: string; action: string }) {
  return (
    <section className="s11-section s11-route-card">
      <p className="eyebrow">واجهة مستقلة</p>
      <h2>{title}</h2>
      <p>{description}</p>
      <button className="button primary" type="button" onClick={() => go(route)}>{action}</button>
    </section>
  );
}

function WorkspaceSection({ toast }: { toast: (m: string, t?: any) => void }) {
  const workspace = settingsFeatureService.getWorkspace();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    mutate(() =>
      settingsFeatureService.updateWorkspaceSettings({
        name: String(data.get("name") || ""),
        timezone: String(data.get("timezone") || ""),
        currency: String(data.get("currency") || ""),
        locale: String(data.get("locale") || ""),
      }),
    );
    toast("حُفظت إعدادات مساحة العمل محليًا مع أثر تدقيق.", "success");
  }

  return (
    <section className="s11-section">
      <header>
        <p className="eyebrow">ملف مساحة العمل</p>
        <h2>هوية تشغيلية موحدة</h2>
        <p>هذه القيم محلية وتجريبية، وتنعكس في واجهة مساحة العمل فقط.</p>
      </header>
      <form className="s11-form" onSubmit={submit}>
        <div className="form-grid">
          <label className="form-field wide">
            <span>اسم مساحة العمل</span>
            <input name="name" defaultValue={workspace.name} required />
          </label>
          <label className="form-field">
            <span>المنطقة الزمنية</span>
            <select name="timezone" defaultValue={workspace.timezone}>
              <OptionRows items={workspaceTimezones} />
            </select>
          </label>
          <label className="form-field">
            <span>العملة</span>
            <select name="currency" defaultValue={workspace.currency}>
              <OptionRows items={workspaceCurrencies} />
            </select>
          </label>
          <label className="form-field wide">
            <span>الإعداد المحلي</span>
            <select name="locale" defaultValue={workspace.locale}>
              <OptionRows items={workspaceLocales} />
            </select>
          </label>
        </div>
        <div className="s11-form-footer">
          <small>
            معرّف مساحة العمل: <b className="mono">{workspace.id}</b> · آخر تحديث {fmtDate(workspace.updatedAt)}
          </small>
          <button type="submit" className="button primary">حفظ التغييرات محليًا</button>
        </div>
      </form>
      <section className="s11-subsection">
        <h3>سجل التغييرات</h3>
        <AuditList rows={settingsFeatureService.getSettingsActivities() as Row[]} />
      </section>
    </section>
  );
}

function AccountSection({ toast }: { toast: (m: string, t?: any) => void }) {
  const user = settingsFeatureService.getCurrentWorkspaceUser();
  return (
    <section className="s11-section">
      <header>
        <p className="eyebrow">الحساب</p>
        <h2>بيانات المستخدم الحالية</h2>
        <p>الملف محلي في هذا النموذج ولا يرتبط بمصادقة أو كلمة مرور.</p>
      </header>
      <div className="s11-account-identity">
        <i className="avatar">{user.name.slice(0, 1)}</i>
        <div>
          <b>{user.name}</b>
          <small>
            {user.role} · <span className="mono">{user.id}</span>
          </small>
        </div>
        <span className="s11-status active">نشط</span>
      </div>
      <form
        className="s11-form"
        onSubmit={(event) => {
          event.preventDefault();
          const name = String(new FormData(event.currentTarget).get("name") || "");
          mutate(() => settingsFeatureService.updateCurrentUserSettings({ name }));
          toast("حُفظ اسم العرض محليًا.", "success");
        }}
      >
        <div className="form-grid">
          <label className="form-field wide">
            <span>الاسم المعروض</span>
            <input name="name" defaultValue={user.name} required />
          </label>
          <label className="form-field wide">
            <span>البريد التجريبي</span>
            <input defaultValue="sara@nomo.example" disabled aria-describedby="accountMockNote" />
          </label>
        </div>
        <small id="accountMockNote">
          البريد للعرض فقط؛ لا توجد إدارة حسابات أو إعادة تعيين كلمات مرور في S11.
        </small>
        <div className="s11-form-footer">
          <span />
          <button type="submit" className="button primary">حفظ الاسم محليًا</button>
        </div>
      </form>
    </section>
  );
}

function TeamSection({ toast }: { toast: (m: string, t?: any) => void }) {
  const invitations = settingsFeatureService.getTeamInvitations() as Row[];
  return (
    <section className="s11-section">
      <header>
        <p className="eyebrow">الفريق</p>
        <h2>الأعضاء والملكية التشغيلية</h2>
        <p>تُعاد استخدام Users نفسها التي تملك Leads وDeals ومحادثات؛ لا توجد قاعدة مستخدمين ثانية.</p>
      </header>
      <div className="s11-team-list">
        {settingsFeatureService.listUsers().map((user: Row) => (
          <article key={user.id}>
            <i className="avatar">{user.name.slice(0, 1)}</i>
            <div>
              <b>{user.name}</b>
              <small>
                {user.role} · <span className="mono">{user.id}</span>
              </small>
            </div>
            <label className="s11-inline-select">
              <span className="sr-only">حالة {user.name}</span>
              <select
                value={user.status}
                onChange={(event) => {
                  mutate(() => settingsFeatureService.setTeamMemberStatus(user.id, event.target.value));
                  toast("حُدثت حالة العضو محليًا.", "info");
                }}
              >
                <option value="active">نشط</option>
                <option value="inactive">غير نشط</option>
              </select>
            </label>
          </article>
        ))}
      </div>

      <section className="s11-subsection split">
        <div>
          <h3>دعوة عضو — تجريبية</h3>
          <p>ينشئ هذا السجل دعوة معلقة فقط؛ لا يرسل بريدًا.</p>
          <form
            className="s11-form compact"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              mutate(() =>
                settingsFeatureService.createTeamInvitation({ email: String(data.get("email") || ""), role: String(data.get("role") || "") }),
              );
              toast("أُنشئت دعوة تجريبية معلقة؛ لم يُرسل أي بريد.", "success");
              event.currentTarget.reset();
            }}
          >
            <label className="form-field">
              <span>البريد التجريبي</span>
              <input name="email" type="email" placeholder="member@example.test" required />
            </label>
            <label className="form-field">
              <span>الدور</span>
              <select name="role">
                <option>مستشار نمو</option>
                <option>مدير مبيعات</option>
                <option>محلل عمليات</option>
              </select>
            </label>
            <button type="submit" className="button">إنشاء دعوة تجريبية</button>
          </form>
        </div>
        <div>
          <h3>دعوات معلقة</h3>
          <div className="s11-invites">
            {invitations.map((invite) => (
              <p key={invite.id}>
                <b>{invite.email}</b>
                <small>
                  {invite.role} · {invite.status === "pending_mock" ? "بانتظار قبول تجريبي" : "—"}
                </small>
              </p>
            ))}
          </div>
        </div>
      </section>
    </section>
  );
}

function NotificationsSection({ toast }: { toast: (m: string, t?: any) => void }) {
  return (
    <section className="s11-section">
      <header>
        <p className="eyebrow">الإشعارات</p>
        <h2>تفضيلات المتابعة</h2>
        <p>تحدد هذه الشاشة التفضيل المحلي فقط؛ لا تنشئ نظام إشعارات أو إرسال بريد أو WhatsApp حقيقي.</p>
      </header>
      <div className="s11-preferences">
        {(settingsFeatureService.getNotificationPreferences() as Row[]).map((pref) => (
          <label className="s11-preference" key={pref.id}>
            <input
              type="checkbox"
              checked={pref.enabled}
              onChange={(event) => {
                mutate(() => settingsFeatureService.setNotificationPreference(pref.id, event.target.checked));
                toast("حُدث التفضيل المحلي فقط.", "info");
              }}
            />
            <span>
              <b>{notificationCategoryLabels[pref.category]}</b>
              <small>{pref.channels.map((channel: string) => notificationChannelLabels[channel]).join(" · ")}</small>
            </span>
            <i aria-hidden="true" />
          </label>
        ))}
      </div>
    </section>
  );
}

function SecuritySection({ toast }: { toast: (m: string, t?: any) => void }) {
  const security = settingsFeatureService.getSecuritySettings();
  return (
    <section className="s11-section">
      <header>
        <p className="eyebrow">الأمان والخصوصية</p>
        <h2>إفصاح الخصوصية التجريبي</h2>
        <p>محرك Copilot الحالي محلي وحتمي. لا ترسل النسخة الحالية بيانات إلى مزود ذكاء خارجي.</p>
      </header>
      <div className="s11-disclosure">
        <b>الوضع الحالي: تنفيذ محلي فقط</b>
        <span>لا يوجد OAuth أو مفاتيح أو Webhook أو تخزين secrets في هذا النموذج.</span>
      </div>
      <form
        className="s11-form"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const dataResidency = data.get("dataResidency") === "external_allowed_mock" ? "external_allowed_mock" : "local_only";
          mutate(() =>
            settingsFeatureService.updateSecuritySettings({
              dataResidency,
              externalAiAccess: data.get("externalAiAccess") === "on",
            }),
          );
          toast("حُفظ تفضيل الخصوصية محليًا؛ لم يتغير محرك S8.", "success");
        }}
      >
        <div className="form-grid">
          <label className="form-field wide">
            <span>تفضيل إقامة البيانات</span>
            <select name="dataResidency" defaultValue={security.dataResidency}>
              <option value="local_only">محلي فقط</option>
              <option value="external_allowed_mock">سماح خارجي تجريبي</option>
            </select>
          </label>
          <label className="s11-toggle wide">
            <input type="checkbox" name="externalAiAccess" defaultChecked={security.externalAiAccess} />
            <span>
              <b>سماح مزود ذكاء خارجي</b>
              <small>تفضيل عرض تجريبي فقط؛ لا يغير محرك S8 ولا ينفذ اتصالًا.</small>
            </span>
          </label>
        </div>
        <div className="s11-form-footer">
          <small>آخر تحديث: {fmtDate(security.updatedAt)}</small>
          <button type="submit" className="button primary">حفظ التفضيلات محليًا</button>
        </div>
      </form>
    </section>
  );
}

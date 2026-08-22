/** مساعدات وكتالوجات S11 المشتركة. */
export const fmtDate = (value?: string | null) =>
  value ? new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";

export const sar = (value: number) => `${new Intl.NumberFormat("ar-SA").format(value)} ر.س`;

export const integrationStatusClass = (status: string) =>
  ({ not_connected: "neutral", mock_connected: "success", configuration_required: "warning", error: "danger", disabled: "disabled" } as Record<string, string>)[
    status
  ] || "neutral";

export const providerLabels: Record<string, string> = {
  google_maps: "خرائط Google", whatsapp: "واتساب", email: "البريد الإلكتروني", google_calendar: "تقويم Google",
  crm_import_export: "استيراد وتصدير CRM", ai_provider: "محرك الذكاء المحلي", webhook: "Webhook تجريبي",
};

export const modeLabels: Record<string, string> = { mock: "محاكاة محلية", local_deterministic_mock: "محرك محلي حتمي" };

export const categoryLabels: Record<string, string> = {
  business_sources: "مصادر الأعمال", messaging: "التواصل", calendar: "المواعيد",
  crm: "إدارة العملاء", ai: "الذكاء الاصطناعي", developer: "التطوير",
};

export const capabilityLabels: Record<string, string> = {
  read_business_sources_mock: "قراءة مصادر أعمال تجريبية", import_businesses_mock: "استيراد شركات تجريبي",
  read_messages_mock: "قراءة محادثات تجريبية", send_messages_mock: "إرسال تجريبي",
  send_email_mock: "بريد تجريبي", read_email_mock: "قراءة بريد تجريبي", sync_appointments_mock: "مزامنة مواعيد تجريبية",
};

export const activityLabels: Record<string, string> = {
  settings_changed: "تعديل إعداد", team_member_status_changed: "تعديل حالة عضو",
  team_invitation_created: "إنشاء دعوة تجريبية", notification_preference_changed: "تعديل تفضيل إشعار",
  security_setting_changed: "تعديل خصوصية", mock_connected: "ربط تجريبي", disconnected: "فصل تجريبي",
  configuration_updated: "تحديث إعداد", retry_attempted: "إعادة محاولة", plan_previewed: "معاينة خطة",
  plan_changed: "تغيير خطة", subscription_cancel_scheduled: "جدولة إلغاء", subscription_reactivated: "إحياء اشتراك",
};

export const settingsSections: [string, string, string][] = [
  ["workspace", "مساحة العمل", "الهوية واللغة والتوقيت"],
  ["account", "الحساب", "بيانات المستخدم الحالية"],
  ["team", "الفريق", "الأعضاء والدعوات التجريبية"],
  ["notifications", "الإشعارات", "تفضيلات محلية فقط"],
  ["security", "الأمان والخصوصية", "سياسات عرض تجريبية"],
  ["integrations", "التكاملات", "الكتالوج وحالة الاتصال التجريبي"],
  ["billing", "الفوترة", "الاشتراك والاستخدام التجريبيان"],
];

type Row = Record<string, any>;

export function AuditList({ rows }: { rows: Row[] }) {
  if (!rows.length) return <p className="s11-empty">لا توجد أنشطة مسجلة بعد.</p>;
  return (
    <ol className="s11-audit-list">
      {rows.slice(0, 6).map((row) => (
        <li key={row.id}>
          <i />
          <div>
            <b>{activityLabels[row.type] || "نشاط تجريبي"}</b>
            <small>
              {fmtDate(row.createdAt)} · {row.actorId}
            </small>
          </div>
          <span>
            {Object.entries(row.metadata || {})
              .map(([key, value]) => `${key}: ${String(value)}`)
              .join(" · ") || "تغيير محلي"}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** سكة القرار في سطوح الحوكمة — المرحلة الخامسة. */
export function GovernanceRail({ note }: { note: string }) {
  return (
    <section className="decision-rail s11-decision-rail" aria-label="مسار القرار">
      <div className="decision-brand">
        <img src="/manus-storage/leadflow-orbit-mark_f6c27956.png" alt="نمو" />
        مسار القرار
      </div>
      <div className="decision-steps">
        <span className="done"><i>١</i><b>اكتشاف</b></span>
        <span className="done"><i>٢</i><b>فهم</b></span>
        <span className="done"><i>٣</i><b>تواصل</b></span>
        <span className="done"><i>٤</i><b>قرار</b></span>
        <span className="active"><i>٥</i><b>حوكمة</b></span>
      </div>
      <small>{note}</small>
    </section>
  );
}

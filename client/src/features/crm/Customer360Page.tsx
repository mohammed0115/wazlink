/**
 * Customer 360 — the same composed read as Lead 360, different subject.
 *
 * It renders whatever sections the composer returns for a customer and nothing
 * more. A customer created manually, with no Business and no Discovery
 * provenance, gets a complete and usable page: identity, contacts, deals,
 * files, custom fields and the merged timeline.
 */
import { useState } from "react";
import { customersApi, type Party360 } from "../../api";
import { useApiAction, useApiResource } from "../../api/hooks";
import { useAuth } from "../../shared/context/AuthProvider";
import { go } from "../../shared/router/useHashRoute";
import { PageHead } from "../../shared/components/PageHead";
import { ApiErrorState, ApiLoadingState, FormError } from "../../shared/components/ApiStates";
import { useToast } from "../../shared/store/toast";
import {
  ContactRow,
  Mono,
  OriginChip,
  PartySection,
  formatIso,
  partyKindLabels,
} from "./components/primitives";
import { PartyTimeline } from "./components/PartyTimeline";
import { CustomFieldsSection } from "./components/CustomFieldsSection";
import { PartyFilesSection } from "./components/PartyFilesSection";

export function Customer360Page({ customerRef }: { customerRef: string }) {
  const toast = useToast();
  const { can } = useAuth();
  const view = useApiResource<Party360>(
    (signal) => customersApi.get360(customerRef, signal),
    [customerRef],
  );

  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");

  const profile = view.data?.profile;

  const addContact = useApiAction(() =>
    customersApi.addContact(customerRef, {
      primary_contact: { name: contactName, phone: contactPhone },
    }),
  );

  if (view.initialLoading) return <ApiLoadingState title="جارٍ تحميل ملف العميل" />;
  if (view.state === "error" && view.error) {
    return (
      <ApiErrorState
        error={view.error}
        onRetry={view.reload}
        actions={
          <button className="button ghost" type="button" onClick={() => go("crm/customers")}>
            العودة إلى القائمة
          </button>
        }
      />
    );
  }
  if (!view.data) return null;

  const sections = view.data;
  const displayName = profile?.name || customerRef;

  return (
    <>
      <PageHead
        kicker="ملف 360"
        title={displayName}
        description="ملف العميل مركّب في الخادم. الأقسام غير المصرّح بها تُحذف ولا تُعرض فارغة."
        actions={
          <button className="button ghost" type="button" onClick={() => go("crm/customers")}>
            العودة إلى القائمة
          </button>
        }
      />

      <section className="card lead-360-hero">
        <div className="lead-identity">
          <i className="company-mark">{displayName.slice(0, 1)}</i>
          <div>
            <h2>{displayName}</h2>
            <p>{partyKindLabels[profile?.party_kind || ""] || profile?.party_kind || "—"}</p>
            <span>
              <Mono>{customerRef}</Mono> · <OriginChip origin={profile?.origin_kind || "manual"} />
            </span>
          </div>
        </div>
        <div className="lead-quick-state">
          <div>
            <span>الحالة</span>
            <b>{profile?.status || "—"}</b>
          </div>
          <div>
            <span>النوع</span>
            <b>{partyKindLabels[profile?.party_kind || ""] || "—"}</b>
          </div>
          <div>
            <span>آخر نشاط</span>
            <b>{formatIso(sections.activities[0]?.occurred_at)}</b>
          </div>
        </div>
      </section>

      <div className="party-360-grid">
        <div className="party-column">
          <PartySection
            title="جهات الاتصال"
            present={sections.contacts !== undefined}
            isEmpty={(sections.contacts ?? []).length === 0}
            emptyText="لا توجد جهات اتصال."
          >
            {(sections.contacts ?? []).map((contact) => (
              <ContactRow key={contact.contact_ref} contact={contact} />
            ))}
          </PartySection>

          {can("customer.update") ? (
            <section className="card crm-create-panel">
              <b>إضافة جهة اتصال</b>
              <div className="form-grid">
                <div className="form-field">
                  <label htmlFor="customerContactName">الاسم</label>
                  <input
                    id="customerContactName"
                    value={contactName}
                    onChange={(event) => setContactName(event.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="customerContactPhoneAdd">الجوال</label>
                  <input
                    id="customerContactPhoneAdd"
                    className="ltr"
                    value={contactPhone}
                    onChange={(event) => setContactPhone(event.target.value)}
                  />
                </div>
              </div>
              <FormError error={addContact.error} />
              <div className="crm-create-actions">
                <button
                  className="button primary compact"
                  type="button"
                  disabled={addContact.pending || !contactName.trim()}
                  onClick={async () => {
                    const result = await addContact.run();
                    if (!result) return;
                    setContactName("");
                    setContactPhone("");
                    toast("أُضيفت جهة الاتصال.", "success");
                    view.reload();
                  }}
                >
                  إضافة
                </button>
              </div>
            </section>
          ) : null}

          <PartySection
            title="السجل الزمني"
            present={true}
            isEmpty={sections.activities.length === 0}
            emptyText="لا توجد أنشطة بعد."
          >
            <PartyTimeline entries={sections.activities} />
          </PartySection>
        </div>

        <div className="party-column">
          <PartySection
            title="الصفقات"
            present={sections.deals !== undefined}
            isEmpty={(sections.deals ?? []).length === 0}
            emptyText="لا توجد صفقات مرتبطة."
          >
            {(sections.deals ?? []).map((deal) => (
              <div className="party-row" key={deal.deal_ref}>
                <span className="grow">
                  <b>{deal.title}</b>
                  <small>
                    <Mono>{deal.deal_ref}</Mono>
                  </small>
                </span>
                <button
                  className="button ghost compact"
                  type="button"
                  onClick={() => go(`deals/${encodeURIComponent(deal.deal_ref)}`)}
                >
                  فتح
                </button>
              </div>
            ))}
          </PartySection>

          <CustomFieldsSection
            subjectType="customer"
            values={sections.custom_fields}
            onSave={(values) => customersApi.setCustomFields(customerRef, values)}
            onSaved={view.reload}
          />

          <PartyFilesSection
            subjectType="customer"
            subjectRef={customerRef}
            files={sections.files}
            onChanged={view.reload}
          />
        </div>
      </div>
    </>
  );
}

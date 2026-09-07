/**
 * Small presentational pieces shared by every integrated CRM screen.
 *
 * They render server-supplied values and nothing else: no screen computes a
 * status, a display name or an owner locally, because the backend already
 * decided each of those and a second opinion here would be a second truth.
 */
import type { ReactNode } from "react";
import type { ContactPayload, LeadListItem, LeadPriority, LeadStatus } from "../../../api";

export const leadStatusLabels: Record<string, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  qualified: "مؤهل",
  unqualified: "غير مؤهل",
  converted: "محوّل",
};

export const leadPriorityLabels: Record<string, string> = {
  low: "منخفضة",
  medium: "متوسطة",
  high: "عالية",
};

export const originLabels: Record<string, string> = {
  manual: "إدخال يدوي",
  import: "استيراد",
  api: "واجهة برمجية",
  form: "نموذج",
  discovery: "اكتشاف",
};

export const partyKindLabels: Record<string, string> = {
  organization: "منشأة",
  person: "فرد",
};

const STATUS_TONE: Record<string, string> = {
  new: "info",
  contacted: "neutral",
  qualified: "success",
  unqualified: "danger",
  converted: "success",
};

export function LeadStatusBadge({ status }: { status: LeadStatus | string }) {
  return <span className={`status ${STATUS_TONE[status] || "neutral"}`}>{leadStatusLabels[status] || status}</span>;
}

export function PriorityBadge({ priority }: { priority: LeadPriority | string }) {
  const tone = priority === "high" ? "danger" : priority === "medium" ? "warning" : "neutral";
  return <span className={`status ${tone}`}>{leadPriorityLabels[priority] || priority}</span>;
}

/**
 * Where this party came from.
 *
 * A manual origin is shown as a first-class chip, not as a missing value:
 * CRM participation never requires Discovery, and the UI should not make a
 * manually created party look incomplete.
 */
export function OriginChip({ origin }: { origin: string }) {
  const isManual = origin !== "discovery";
  return (
    <span className={`origin-chip ${isManual ? "manual" : ""}`}>{originLabels[origin] || origin}</span>
  );
}

export function Mono({ children }: { children: ReactNode }) {
  return <code className="ltr">{children}</code>;
}

/** ISO -> Arabic-locale date/time. Digits stay LTR inside an RTL line. */
export function formatIso(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
    numberingSystem: "latn",
  }).format(date);
}

export function formatDateOnly(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("ar-SA", { dateStyle: "medium", numberingSystem: "latn" }).format(date);
}

export function fmtNumber(value: number): string {
  return new Intl.NumberFormat("ar-SA", { numberingSystem: "latn" }).format(value);
}

/** Money is rendered from the server's decimal string + its own currency. */
export function formatMoney(amount: string, currency: string): string {
  const numeric = Number(amount);
  if (Number.isNaN(numeric)) return `${amount} ${currency}`;
  return new Intl.NumberFormat("ar-SA", {
    style: "currency",
    currency: currency || "SAR",
    numberingSystem: "latn",
    maximumFractionDigits: 2,
  }).format(numeric);
}

/**
 * The lead's identity cell.
 *
 * It renders `display_name`/`display_subtitle` — the server's read-time
 * projection — so a Business-less Lead shows its primary Contact and never a
 * bare id or an invented company.
 */
export function LeadIdentity({ lead, onOpen }: { lead: LeadListItem; onOpen: () => void }) {
  const initial = (lead.display_name || "؟").trim().slice(0, 1);
  return (
    <button type="button" className="row-link company-cell" onClick={onOpen}>
      <i className="company-mark">{initial}</i>
      <span>
        <b>{lead.display_name || "بدون اسم"}</b>
        <small>
          <Mono>{lead.lead_ref}</Mono>
          {lead.display_subtitle ? ` · ${lead.display_subtitle}` : ""}
        </small>
      </span>
    </button>
  );
}

export function ContactRow({ contact }: { contact: ContactPayload }) {
  return (
    <div className="party-row">
      <i className="company-mark">{(contact.full_name || "؟").slice(0, 1)}</i>
      <span className="grow">
        <b>
          {contact.full_name || "—"}
          {contact.is_primary ? <em className="origin-chip manual"> أساسي</em> : null}
        </b>
        <small className="ltr">{contact.email || contact.phone || "—"}</small>
      </span>
      {contact.masked ? <span className="status neutral">مخفي جزئيًا</span> : null}
    </div>
  );
}

/**
 * A 360 section wrapper.
 *
 * `present` false means the composer omitted the section — the actor may not
 * read it, or the slice has not shipped. It renders a restriction notice, not
 * an empty list, because "you cannot see this" and "there is nothing here" are
 * different facts and must not look alike.
 */
export function PartySection({
  title,
  present,
  action,
  children,
  emptyText,
  isEmpty,
}: {
  title: string;
  present: boolean;
  action?: ReactNode;
  children?: ReactNode;
  emptyText?: string;
  isEmpty?: boolean;
}) {
  return (
    <article className="card party-section">
      <header>
        <h3>{title}</h3>
        {present ? action : null}
      </header>
      {!present ? (
        <div className="party-body">
          <p className="party-restricted">هذا القسم غير متاح لصلاحيتك الحالية.</p>
        </div>
      ) : isEmpty ? (
        <div className="party-body">
          <p className="party-empty">{emptyText || "لا توجد عناصر."}</p>
        </div>
      ) : (
        <div className="party-body">{children}</div>
      )}
    </article>
  );
}

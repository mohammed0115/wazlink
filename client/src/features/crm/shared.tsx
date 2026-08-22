/** مساعدات CRM مشتركة — منقولة عن رؤوس عرض `crm.js`. */
import { leadPriorityLabels as rawPriority, leadStatusLabels as rawStatus, mockModel } from "@services/data";
import { tierLabels as rawTiers } from "@domain/intelligence.js";

export const leadStatusLabels = rawStatus as Record<string, string>;
export const leadPriorityLabels = rawPriority as Record<string, string>;
export const tierLabels = rawTiers as Record<string, string>;

export const fmt = (value: number | null | undefined) => new Intl.NumberFormat("ar-SA").format(value ?? 0);

/** طابع زمني عربي مختصر — منقول عن `formatIso` المحلية في `crm.js`. */
export const formatIso = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("ar-SA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
    : "—";

export const statusTone = (status: string) =>
  ({ new: "info", contacted: "warning", qualified: "success", unqualified: "neutral", nurturing: "info" } as Record<string, string>)[
    status
  ] || "neutral";

export const priorityTone = (priority: string) =>
  ({ high: "danger", medium: "warning", low: "neutral" } as Record<string, string>)[priority] || "neutral";

export function Mono({ children }: { children: React.ReactNode }) {
  return <span className="mono ltr">{children}</span>;
}

export function LeadStatusBadge({ status }: { status: string }) {
  return <span className={`status ${statusTone(status)}`}>{leadStatusLabels[status] || status}</span>;
}

export function PriorityBadge({ priority }: { priority: string }) {
  return <span className={`status ${priorityTone(priority)}`}>{leadPriorityLabels[priority] || priority}</span>;
}

export function ScoreBadge({ record }: { record: any }) {
  if (record?.score === null || record?.score === undefined) return <span className="crm-score-empty">—</span>;
  return (
    <span className={`crm-score ${record.tier}`}>
      <b>{record.score}</b>
      <small>{tierLabels[record.tier]}</small>
    </span>
  );
}

export function OrbitBrand() {
  return (
    <div className="crm-orbit-brand" aria-label="نمو — مسار القرار">
      <span className="crm-orbit-mark" aria-hidden="true">
        <i /><i /><i /><b />
      </span>
      <strong>نمو</strong>
      <small>مسار القرار</small>
    </div>
  );
}

const railStages: [string, string][] = [
  ["بحث", "طلب ومصدر"],
  ["نتائج", "سجلات مكتشفة"],
  ["ذكاء", "دليل وقرار"],
  ["CRM ومتابعة", "المالك والإجراء"],
];

/** سكة القرار داخل CRM — تمتد من البحث حتى المتابعة وفق `ideas.md`. */
export function LeadRail({ lead, business, job, source }: { lead?: any; business?: any; job?: any; source?: any }) {
  return (
    <section className="crm-decision-rail" aria-label="رحلة السجل من البحث إلى CRM">
      <OrbitBrand />
      <div className="crm-rail-stages">
        {railStages.map(([label, detail], index) => (
          <div className={`${index < 3 ? "done" : ""} ${index === 3 ? "active" : ""}`} key={label}>
            <i>{String(index + 1).padStart(2, "0")}</i>
            <span>
              <b>{label}</b>
              <small>{detail}</small>
            </span>
          </div>
        ))}
      </div>
      {lead && (
        <div className="crm-rail-record">
          <Mono>{source?.id || "—"}</Mono> <i>←</i> <Mono>{job?.id || "—"}</Mono> <i>←</i>{" "}
          <Mono>{business?.id || "—"}</Mono> <i>←</i>{" "}
          <b>
            <Mono>{lead.id}</Mono>
          </b>
        </div>
      )}
    </section>
  );
}

export const userName = (id: string) => mockModel.users.find((user: { id: string }) => user.id === id)?.name || "الفريق";

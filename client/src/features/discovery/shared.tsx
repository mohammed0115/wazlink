/** مساعدات مشتركة بين شاشات الاكتشاف — منقولة عن رؤوس `discovery.js`. */
import { getDiscoverySource, getJobStatusLabel } from "@services/data";

export const fmt = (value: number) => new Intl.NumberFormat("ar-SA").format(value || 0);

export const statusTone = (status: string) =>
  ({ completed: "success", processing: "info", pending: "warning", failed: "danger", cancelled: "neutral" } as Record<string, string>)[
    status
  ] || "neutral";

export const sourceName = (id: string) => getDiscoverySource(id)?.name || "مصدر غير معروف";

export const isProcessing = (job?: { status?: string }) => ["pending", "processing"].includes(job?.status ?? "");

export function StatusBadge({ status }: { status: string }) {
  return <span className={`status discovery-status ${statusTone(status)}`}>{getJobStatusLabel(status)}</span>;
}

/** معرف تقني يُقرأ LTR داخل نص عربي — قاعدة `DESIGN_SYSTEM.md`. */
export function Mono({ children }: { children: React.ReactNode }) {
  return <b className="mono ltr">{children}</b>;
}

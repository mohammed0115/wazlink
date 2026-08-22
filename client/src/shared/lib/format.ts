/**
 * مُنسّقات العرض — نفس دوال `fmt` و`sar` في نسخة Vanilla.
 * الأرقام والعملة والمعرفات تبقى LTR داخل نص عربي RTL، كما تفرض `DESIGN_SYSTEM.md`.
 */
const arabicNumberFormat = new Intl.NumberFormat("ar-SA");

export function fmt(value: number): string {
  return arabicNumberFormat.format(value);
}

export function sar(value: number): string {
  return `SAR ${fmt(value)}`;
}

/** صنف الحالة الدلالي المشترك بين الشارات والجداول. */
export function statusClass(status: string): string {
  if (["completed", "won", "qualified", "active", "recognized", "executed", "paid_mock"].includes(status)) return "success";
  if (["processing", "contacted", "open", "pending", "nurturing", "trial"].includes(status)) return "info";
  if (["failed", "lost", "unqualified", "overdue", "error", "blocked"].includes(status)) return "danger";
  if (["cancelled", "waiting", "awaiting_approval", "paused", "past_due_mock"].includes(status)) return "warning";
  return "neutral";
}

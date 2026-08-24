/**
 * تصدير CSV محلي للتحليلات — S10.
 * يعيد صفوف الإسناد المشتقة فقط عبر Blob محلي؛ لا نقل بيانات إلى خدمة خارجية.
 */
import { analyticsService } from "@services";

const getAnalyticsExportRows = analyticsService.getAnalyticsExportRows as (context: Record<string, unknown>) => unknown[];

const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

export function exportAnalyticsCsv(context: Record<string, unknown>): number {
  const rows = getAnalyticsExportRows(context) as Record<string, unknown>[];
  if (!rows.length) return 0;

  const columns = Object.keys(rows[0]);
  const header = columns.map(quote).join(",");
  const body = rows.map((row) => columns.map((column) => quote(row[column])).join(","));

  const blob = new Blob([`﻿${header}\n${body.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "nomo-analytics-attribution.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return rows.length;
}

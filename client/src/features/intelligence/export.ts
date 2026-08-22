/**
 * تصدير Excel المحلي — SCRAPER-DATA-VISIBILITY.
 *
 * ينتج CSV متوافقًا مع Excel عبر Blob محلي فقط: لا خادم تصدير ولا طلب شبكة.
 * يبدأ بـUTF-8 BOM كي تُقرأ العربية صحيحة في Excel.
 */
import { getJobResults, scraperExportColumns, state } from "@services/data";

type Business = Record<string, unknown>;

const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;

const valueFor = (business: Business, id: string) =>
  (
    {
      businessId: business.id,
      name: business.name,
      category: business.category,
      city: business.city,
      phone: business.phone,
      email: business.email,
      website: business.website,
      instagram: business.instagram,
      rating: business.rating,
      reviews: business.reviews,
      source: business.source,
    } as Record<string, unknown>
  )[id] ?? "";

/** ينزّل الصفوف المحددة بالأعمدة المختارة ويعيد عدد الصفوف. */
export function downloadScraperCsv(jobId: string, businessIds: string[]): number {
  const rows = (getJobResults(jobId) as Business[]).filter((business) => businessIds.includes(business.id as string));
  const selected = new Set<string>(state.scraperCrmUi.exportColumns);
  const columns = (scraperExportColumns as { id: string; label: string }[]).filter((column) => selected.has(column.id));

  const header = columns.map((column) => quote(column.label)).join(",");
  const body = rows.map((business) => columns.map((column) => quote(valueFor(business, column.id))).join(","));

  const blob = new Blob([`﻿${header}\n${body.join("\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `nomo-scraper-${jobId}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return rows.length;
}

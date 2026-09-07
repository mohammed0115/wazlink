/**
 * The merged timeline, rendered exactly as the composer ordered it.
 *
 * No sorting, no grouping, no de-duplication and no synthesis happens here.
 * Entries arrive already merged across CRM, messaging and pipeline, already
 * filtered by what this actor may read, and already ordered
 * (occurred_at DESC, entry_id DESC). Re-ordering them in the browser would
 * quietly create a second history that disagrees with the audit trail.
 */
import type { TimelineEntry } from "../../../api";
import { go } from "../../../shared/router/useHashRoute";
import { formatIso } from "./primitives";

const DOMAIN_LABELS: Record<string, string> = {
  crm: "العملاء",
  messaging: "المحادثات",
  pipeline: "الصفقات",
  customers: "العملاء",
  files: "الملفات",
  support: "الدعم",
};

const DOMAIN_GLYPH: Record<string, string> = {
  crm: "●",
  messaging: "✉",
  pipeline: "◆",
  customers: "●",
  files: "▣",
  support: "◈",
};

export function PartyTimeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ul className="lead-timeline">
      {entries.map((entry) => (
        <li key={entry.entry_id}>
          <i aria-hidden="true">{DOMAIN_GLYPH[entry.source_domain] || "●"}</i>
          <div>
            <b>{entry.summary || entry.source_event_type || "نشاط"}</b>
            <p>
              {DOMAIN_LABELS[entry.source_domain] || entry.source_domain}
              {entry.actor ? ` · ${entry.actor}` : ""}
            </p>
            <small>{formatIso(entry.occurred_at)}</small>
            {/* route_hint is the composer telling us where this entry lives.
                It is followed, never guessed at from the entry's shape. */}
            {entry.route_hint ? (
              <button
                type="button"
                className="button ghost compact"
                onClick={() => go(entry.route_hint as string)}
              >
                فتح المصدر
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

"""analytics (L10) — the READ/QUERY COMPOSITION surface.

analytics owns NO table, mints NO identity and is imported by NO app. It
reaches every contributor through common/party360/'s registries (class E), so
composition adds NO class A import edge. In particular there is no
analytics -> messaging edge and no crm -> messaging / crm -> pipeline edge.

Nothing here may write. The composer holds no permission code of its own: each
contributor enforces its own domain's permission and masking.
"""

from __future__ import annotations

from typing import Any

from common.party360.contracts import (
    ActorContext,
    QueryContext,
    SectionState,
    SubjectRef,
    TimelineCursor,
    TimelineEntry,
    TimelineEntryPage,
    WorkspaceRef,
)
from common.party360.registry import section_registry, timeline_contributor_registry


class Party360Composer:
    """Composes a subject's 360 from registered section providers.

    A section the actor may not read and a section whose owning slice has not
    shipped are BOTH key-absent and indistinguishable on the wire.
    """

    def compose(
        self, workspace_ref: WorkspaceRef, subject: SubjectRef, actor: ActorContext
    ) -> dict[str, Any]:
        result: dict[str, Any] = {}
        for provider in section_registry.all():
            if not provider.supports(subject):
                continue  # key-absent
            try:
                section = provider.fetch(workspace_ref, subject, actor)
            except Exception:
                # A failing contributor degrades its own section only; the
                # remaining sections are still served (B2_LEAD360 §5 rule 5).
                continue
            if section.state == SectionState.PRESENT:
                result[section.name] = section.payload
            # UNAVAILABLE => the key is ABSENT. No placeholder is emitted.
        return result

    def registered_sections(self) -> list[str]:
        return section_registry.registered_names()


class TimelineComposer:
    """The multi-contributor timeline merge (B14_03 §5e).

    Read-time, deterministic, and it PERSISTS NOTHING: no table, no cache, no
    projection and no cross-domain dedup store. Dedup is applied in memory
    during the merge.
    """

    def compose(
        self, workspace_ref: WorkspaceRef, subject: SubjectRef, actor: ActorContext, query: QueryContext
    ) -> TimelineEntryPage:
        collected: list[TimelineEntry] = []
        any_more = False

        for contributor in timeline_contributor_registry.all():
            try:
                page = contributor.fetch(workspace_ref, subject, actor, query)
            except Exception:
                # A contributor that raises or times out yields [] for its own
                # entries — never a 500 — and the others are still served.
                continue
            collected.extend(page.entries)
            any_more = any_more or page.has_more

        merged = self._dedupe(collected)
        # Ordering: (occurred_at DESC, entry_id DESC) — a TOTAL order with no ties.
        merged.sort(key=lambda e: (e.occurred_at, e.entry_id), reverse=True)

        limit = query.limit
        has_more = any_more or len(merged) > limit
        window = merged[:limit]
        next_cursor = (
            TimelineCursor(window[-1].occurred_at, window[-1].entry_id) if has_more and window else None
        )
        return TimelineEntryPage(entries=window, has_more=has_more, next_cursor=next_cursor)

    @staticmethod
    def _dedupe(entries: list[TimelineEntry]) -> list[TimelineEntry]:
        """In-memory dedup on (source_domain, source_event_id).

        NEVER a persisted store, cache or projection (T-P360-17). An entry with
        no source_event_id is already uniquely identified by its entry_id.
        """
        seen: set[tuple[str, str]] = set()
        out: list[TimelineEntry] = []
        for entry in entries:
            key = entry.dedup_key()
            if key is None:
                out.append(entry)
                continue
            if key in seen:
                continue
            seen.add(key)
            out.append(entry)
        return out


party360_composer = Party360Composer()
timeline_composer = TimelineComposer()


def serialize_timeline_entry(entry: TimelineEntry) -> dict[str, Any]:
    return {
        "entry_id": entry.entry_id,
        "source_domain": entry.source_domain,
        "occurred_at": entry.occurred_at,
        "recorded_at": entry.recorded_at,
        "actor": entry.actor,
        "summary": entry.summary,
        "change": entry.change,
        "target_ref": entry.target_ref,
        "source_resource_ref": entry.source_resource_ref,
        "source_event_type": entry.source_event_type,
        "route_hint": entry.route_hint,
    }


def encode_timeline_cursor(cursor: TimelineCursor | None) -> str | None:
    if cursor is None or cursor.is_empty():
        return None
    from common.pagination import encode_cursor

    return encode_cursor({"t": cursor.occurred_at.isoformat(), "e": cursor.entry_id})


def decode_timeline_cursor(raw: str) -> TimelineCursor:
    if not raw:
        return TimelineCursor()
    from datetime import datetime

    from common.pagination import decode_cursor

    state = decode_cursor(raw)
    if not state.get("t"):
        return TimelineCursor()
    return TimelineCursor(datetime.fromisoformat(state["t"]), state.get("e"))


__all__ = [
    "Party360Composer",
    "TimelineComposer",
    "party360_composer",
    "timeline_composer",
    "serialize_timeline_entry",
    "encode_timeline_cursor",
    "decode_timeline_cursor",
]

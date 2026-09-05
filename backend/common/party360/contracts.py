"""Party360 read-composition CONTRACTS (B14_03 §5a, §5e).

Interfaces only. No section logic, no timeline logic, no business rule.
Implementations live in the owning domain's party360.py; wiring lives in config/.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol, runtime_checkable


@dataclass(frozen=True)
class SubjectRef:
    """The subject of a 360 composition.

    `related` carries references the SUBJECT OWNER already holds (for example
    a Lead's business_ref). It is populated by the composing view, so a
    lower-layer contributor never has to import a higher-layer module to
    discover its own subject.
    """

    kind: str  # 'lead' | 'customer'
    public_id: str
    internal_id: Any = None
    related: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ActorContext:
    """The B1 pipeline's own context object — session, membership, role."""

    user_id: Any
    membership_id: Any
    workspace_id: Any
    role: str
    permissions: frozenset[str] = field(default_factory=frozenset)

    def has(self, permission: str) -> bool:
        return permission in self.permissions


@dataclass(frozen=True)
class WorkspaceRef:
    """Active-workspace scope, SERVER-DERIVED. Never client-supplied."""

    id: Any
    public_id: str = ""


class SectionState:
    """A section is either present or key-absent. There is no third state.

    A section the actor may not read and a section whose owning slice has not
    shipped are BOTH key-absent and indistinguishable on the wire.
    """

    PRESENT = "present"
    UNAVAILABLE = "unavailable"


@dataclass(frozen=True)
class Section:
    name: str
    state: str
    payload: Any = None


@runtime_checkable
class SectionProvider(Protocol):
    """Implemented by the OWNING domain in its own party360.py.

    The provider imports common/ only. It never imports the composer and never
    imports another contributor.
    """

    section_name: str

    def supports(self, subject: SubjectRef) -> bool: ...

    def fetch(self, workspace_ref: WorkspaceRef, subject: SubjectRef, actor: ActorContext) -> Section: ...


# --------------------------------------------------------------------------
# Timeline (B14_03 §5e) — TimelineEntryProvider lives BESIDE SectionProvider.
# This is not a second architecture.
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class TimelineEntry:
    """Exactly the frozen fields the deterministic merge needs (B2 §3.1).

    No field is invented and no new namespace is minted: the timeline never
    mints a TLE-* identity.
    """

    entry_id: str
    source_domain: str  # 'crm' | 'messaging' | 'pipeline'
    occurred_at: datetime
    recorded_at: datetime
    actor: str | None = None
    summary: str = ""
    change: dict[str, Any] | None = None
    target_ref: str | None = None
    source_resource_ref: str | None = None
    source_event_type: str = ""
    route_hint: str | None = None
    # REQUIRED for cross-domain entries; NULL for CRM-owned entries where
    # entry_id is already the identity.
    source_event_id: str | None = None

    def sort_key(self) -> tuple[datetime, str]:
        return (self.occurred_at, self.entry_id)

    def dedup_key(self) -> tuple[str, str] | None:
        if self.source_event_id is None:
            return None
        return (self.source_domain, self.source_event_id)


@dataclass(frozen=True)
class TimelineCursor:
    """The opaque (occurred_at, entry_id) encoding frozen B2 mandates.
    Offset pagination is forbidden."""

    occurred_at: datetime | None = None
    entry_id: str | None = None

    def is_empty(self) -> bool:
        return self.occurred_at is None


@dataclass(frozen=True)
class QueryContext:
    cursor: TimelineCursor
    limit: int = 25


@dataclass(frozen=True)
class TimelineEntryPage:
    entries: list[TimelineEntry]
    has_more: bool = False
    next_cursor: TimelineCursor | None = None
    degraded: bool = False


@runtime_checkable
class TimelineEntryProvider(Protocol):
    """One shape for EVERY contributor, so no domain invents its own.

    Each contributor supplies ONLY ITS OWN entries and enforces its own
    domain's permission and masking before returning.
    """

    source_domain: str

    def fetch(
        self,
        workspace_ref: WorkspaceRef,
        subject_ref: SubjectRef,
        actor_context: ActorContext,
        query_context: QueryContext,
    ) -> TimelineEntryPage: ...

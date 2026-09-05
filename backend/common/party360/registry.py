"""SectionRegistry and TimelineContributorRegistry.

Both are populated by config/ at app-ready time, NEVER by an app. A contributing
domain never enumerates the registry, and the composer never imports a
contributor (B14_03 §6 rule 12).
"""

from __future__ import annotations

from .contracts import SectionProvider, TimelineEntryProvider


class SectionRegistry:
    def __init__(self) -> None:
        self._providers: dict[str, SectionProvider] = {}

    def register(self, provider: SectionProvider) -> None:
        self._providers[provider.section_name] = provider

    def get(self, section_name: str) -> SectionProvider | None:
        return self._providers.get(section_name)

    def all(self) -> list[SectionProvider]:
        return list(self._providers.values())

    def registered_names(self) -> list[str]:
        return sorted(self._providers)

    def clear(self) -> None:
        self._providers.clear()


class TimelineContributorRegistry:
    """Lives BESIDE SectionRegistry — same boundary, same lifecycle."""

    def __init__(self) -> None:
        self._contributors: dict[str, TimelineEntryProvider] = {}

    def register(self, contributor: TimelineEntryProvider) -> None:
        self._contributors[contributor.source_domain] = contributor

    def all(self) -> list[TimelineEntryProvider]:
        # Deterministic contributor order; the merge order itself is by
        # (occurred_at DESC, entry_id DESC), not by contributor.
        return [self._contributors[key] for key in sorted(self._contributors)]

    def registered_domains(self) -> list[str]:
        return sorted(self._contributors)

    def clear(self) -> None:
        self._contributors.clear()


section_registry = SectionRegistry()
timeline_contributor_registry = TimelineContributorRegistry()

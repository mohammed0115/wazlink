"""SectionRegistry and TimelineContributorRegistry.

Both are populated by config/ at app-ready time, NEVER by an app. A contributing
domain never enumerates the registry, and the composer never imports a
contributor (B14_03 §6 rule 12).
"""

from __future__ import annotations

from typing import Any

from .contracts import SectionProvider, TimelineEntryProvider


class SectionRegistry:
    """Every registered section provider.

    A section NAME is not unique, and must not be treated as if it were. The
    same name is contributed by different domains for different SUBJECT KINDS:
    `contacts` comes from crm for a `lead` and from customers for a `customer`,
    and `Party360Composer` already discriminates between them by asking each
    provider `supports(subject)`.

    Registration is therefore keyed by (section name, provider type) — one row
    per provider. Keying by name alone made the second registration silently
    EVICT the first, which is not a collision the composer can detect: the
    surviving provider simply answers `supports()` false for the other kind and
    the section goes key-absent, indistinguishable from a slice that never
    shipped. Re-registering the same provider stays idempotent, which is what
    the per-test `register_all()` relies on.
    """

    def __init__(self) -> None:
        self._providers: dict[tuple[str, str], SectionProvider] = {}

    @staticmethod
    def _key(provider: SectionProvider) -> tuple[str, str]:
        kind = type(provider)
        return (provider.section_name, f"{kind.__module__}.{kind.__qualname__}")

    def register(self, provider: SectionProvider) -> None:
        self._providers[self._key(provider)] = provider

    def get(self, section_name: str) -> SectionProvider | None:
        """The first provider contributing this section name, if any.

        Ambiguous by construction when several kinds share a name; callers that
        need a specific one should filter `all()` by `supports(subject)`.
        """
        for (name, _), provider in self._providers.items():
            if name == section_name:
                return provider
        return None

    def providers_for(self, subject: Any) -> list[SectionProvider]:
        """Every provider that will contribute for this subject."""
        return [provider for provider in self._providers.values() if provider.supports(subject)]

    def all(self) -> list[SectionProvider]:
        return list(self._providers.values())

    def registered_names(self) -> list[str]:
        return sorted({name for name, _ in self._providers})

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

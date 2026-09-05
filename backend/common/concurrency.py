"""If-Match / expected_version optimistic concurrency (ADR-010)."""

from __future__ import annotations

from typing import Any

from .errors import StaleVersion


def parse_if_match(request: Any) -> int | None:
    """Read the If-Match header, tolerating quoted and weak ETags."""
    raw = request.headers.get("If-Match") or request.headers.get("if-match")
    if not raw:
        return None
    cleaned = raw.strip().lstrip("W/").strip('"').strip()
    try:
        return int(cleaned)
    except ValueError:
        raise StaleVersion("The If-Match header is not a valid version.") from None


def require_version(instance: Any, expected: int | None, *, required: bool = True) -> None:
    """Enforce optimistic concurrency. Mismatch => 409 STALE_VERSION."""
    if expected is None:
        if required:
            raise StaleVersion("This resource requires an If-Match version header.")
        return
    if int(getattr(instance, "version", 0)) != int(expected):
        raise StaleVersion("The resource has changed since it was read.")


def bump_version(instance: Any) -> None:
    instance.version = int(getattr(instance, "version", 0)) + 1

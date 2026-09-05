"""If-Match / expected_version optimistic concurrency (ADR-010).

The concurrency primitive is the frozen pair (B1_CONCURRENCY_IDEMPOTENCY §1):

    integer `version` + `If-Match`   AND   `SELECT ... FOR UPDATE` row lock

Both halves are load-bearing. Comparing an in-memory `version` against the
caller's expectation proves only that the CLIENT read that version; it cannot
observe a writer that committed in between. Race R1 is authoritative: two
writers on one row serialize on the lock, the first commits and bumps
`version`, and the second's `If-Match` no longer matches => 409 STALE_VERSION,
no write.

`require_version` therefore takes the row lock itself and compares against the
LOCKED state. Every command keeps its own transition logic; none of them
repeats the locking rule.
"""

from __future__ import annotations

from typing import Any

from django.db import transaction

from .errors import EntityNotFound, StaleVersion


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


def lock_aggregate(instance: Any) -> Any:
    """Take `SELECT ... FOR UPDATE` on this row and refresh `instance` from it.

    Must be called inside the command's transaction: a lock released before the
    mutation commits would protect nothing. After this returns, every field on
    `instance` reflects committed truth that no other writer can change until
    this transaction ends — so the caller's domain guards read real state, not
    the snapshot the request began with.
    """
    if not transaction.get_connection().in_atomic_block:
        raise RuntimeError(
            "lock_aggregate() requires an open transaction; the command must be @transaction.atomic."
        )

    locked = instance.__class__._base_manager.select_for_update().filter(pk=instance.pk).first()
    if locked is None:
        # Deleted under us. Never disclose more than a normal miss would.
        raise EntityNotFound("The requested resource was not found.")

    for field in instance._meta.concrete_fields:
        setattr(instance, field.attname, getattr(locked, field.attname))
    # Related objects cached before the lock may now disagree with their FK ids.
    instance._state.fields_cache.clear()
    return instance


def require_version(instance: Any, expected: int | None, *, required: bool = True) -> None:
    """Enforce ADR-010 against the LOCKED row. Mismatch => 409 STALE_VERSION.

    Locking here rather than in each command keeps the rule in one place and
    leaves the commands to express only their own transition.
    """
    if expected is None:
        if required:
            raise StaleVersion("This resource requires an If-Match version header.")
        return

    lock_aggregate(instance)

    if int(getattr(instance, "version", 0)) != int(expected):
        raise StaleVersion("The resource has changed since it was read.")


def bump_version(instance: Any) -> None:
    instance.version = int(getattr(instance, "version", 0)) + 1

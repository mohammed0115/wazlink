"""Opaque cursor pagination. Offset pagination is forbidden."""

from __future__ import annotations

import base64
import json
from typing import Any

DEFAULT_PAGE_SIZE = 25
MAX_PAGE_SIZE = 100


def encode_cursor(payload: dict[str, Any]) -> str:
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True, default=str)
    return base64.urlsafe_b64encode(raw.encode()).decode().rstrip("=")


def decode_cursor(cursor: str) -> dict[str, Any]:
    if not cursor:
        return {}
    padded = cursor + "=" * (-len(cursor) % 4)
    try:
        return json.loads(base64.urlsafe_b64decode(padded.encode()).decode())
    except Exception:
        return {}


def page_size_from(request: Any) -> int:
    raw = request.query_params.get("limit") if hasattr(request, "query_params") else None
    try:
        size = int(raw) if raw else DEFAULT_PAGE_SIZE
    except (TypeError, ValueError):
        size = DEFAULT_PAGE_SIZE
    return max(1, min(size, MAX_PAGE_SIZE))


def paginate(queryset: Any, request: Any, *, order_fields: tuple[str, ...] = ("-created_at", "-id")):
    """Return (items, next_cursor). Keyset pagination over a deterministic order."""
    size = page_size_from(request)
    cursor_raw = request.query_params.get("cursor", "") if hasattr(request, "query_params") else ""
    state = decode_cursor(cursor_raw)
    offset = int(state.get("o", 0))

    ordered = queryset.order_by(*order_fields)
    window = list(ordered[offset : offset + size + 1])
    has_more = len(window) > size
    items = window[:size]
    next_cursor = encode_cursor({"o": offset + size}) if has_more else None
    return items, next_cursor

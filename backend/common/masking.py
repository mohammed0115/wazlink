"""Server-side masking, applied in the selector BEFORE serialization (PD-002).

The API never emits a value the actor may not see.
"""

from __future__ import annotations


def mask_phone(value: str | None) -> str | None:
    if not value:
        return value
    tail = value[-2:]
    return f"{'*' * max(len(value) - 2, 3)}{tail}"


def mask_email(value: str | None) -> str | None:
    if not value:
        return value
    local, _, domain = value.partition("@")
    if not domain:
        return "***"
    head = local[:1] if local else ""
    return f"{head}***@{domain}"


def mask_name(value: str | None) -> str | None:
    """A Contact-derived display_name is Contact PII and is masked for Viewer
    on every surface (CA-15, B14_06 §1)."""
    if not value:
        return value
    parts = value.split()
    if len(parts) == 1:
        return f"{value[:1]}***"
    return f"{parts[0][:1]}*** {parts[-1][:1]}***"

"""Audit row writing (B13_AUDIT_LOGGING), through the class B audit port.

Every mutation writes an audit row with actor, workspace, target and
before/after FIELD NAMES. Contact PII never enters an audit payload.
"""

from __future__ import annotations

from typing import Any

from .ports import ports

PII_KEYS = frozenset(
    {"phone", "email", "name", "full_name", "display_name", "primary_phone", "primary_email", "notes", "body"}
)


def _safe_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    """Strip PII VALUES from an audit payload; keep the key as evidence."""
    return {key: ("[REDACTED]" if key.lower() in PII_KEYS else value) for key, value in metadata.items()}


def write_audit(
    *,
    workspace: Any,
    actor_membership: Any,
    action: str,
    target_type: str,
    target_ref: str = "",
    changed_fields: list[str] | None = None,
    metadata: dict[str, Any] | None = None,
) -> Any:
    return ports.require("audit").append(
        workspace=workspace,
        actor_membership=actor_membership,
        action=action,
        target_type=target_type,
        target_ref=target_ref,
        changed_fields=list(changed_fields or []),
        metadata=_safe_metadata(metadata or {}),
    )

"""Audit row writing (B13_AUDIT_LOGGING), through the class B audit port.

Every mutation writes an audit row with actor, workspace, target and
before/after FIELD NAMES. Contact PII never enters an audit payload.
"""

from __future__ import annotations

from typing import Any

from .logging import redact_mapping
from .ports import ports

PII_KEYS = frozenset(
    {"phone", "email", "name", "full_name", "display_name", "primary_phone", "primary_email", "notes", "body"}
)


def _safe_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    """Strip PII values, THEN redact credential-shaped keys and values.

    Two passes, because they catch different things and neither subsumes the
    other: the PII pass is key-name-driven and deliberately keeps the key as
    evidence that a field changed, while the credential pass is shape-driven
    and reaches a secret pasted into an otherwise-innocent field such as a free
    text `note`. Doing only the first is how a live provider key reached an
    audit row — the audit path is an outbound sink like any other, and
    `B13_LOGGING_REDACTION` covers all of them, not just log lines.
    """
    stripped = {
        key: ("[REDACTED]" if key.lower() in PII_KEYS else value) for key, value in metadata.items()
    }
    return redact_mapping(stripped)


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

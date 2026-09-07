"""Transactional outbox publish, through the class B outbox port.

The event row is written in the SAME transaction as the domain change, which
is what makes publication atomic with the state it describes (T-ASYNC-3).
"""

from __future__ import annotations

from typing import Any

from .logging import redact_mapping
from .ports import ports

PII_KEYS = frozenset(
    {"phone", "email", "name", "full_name", "display_name", "primary_phone", "primary_email", "body"}
)


def _safe_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Contact PII never enters an event payload, and neither does a secret.

    An outbox row is read by workers, replayed by operators and inspected in
    the admin, so it is an outbound sink in the sense `B13_LOGGING_REDACTION`
    means. Dropping PII keys alone left a credential pasted into any other
    field intact.
    """
    without_pii = {k: v for k, v in payload.items() if k.lower() not in PII_KEYS}
    return redact_mapping(without_pii)


def publish_event(
    *,
    workspace: Any,
    event_type: str,
    aggregate_type: str,
    aggregate_ref: str,
    payload: dict[str, Any] | None = None,
    correlation_id: str = "",
    causation_id: str = "",
) -> Any:
    return ports.require("outbox").publish(
        workspace=workspace,
        event_type=event_type,
        aggregate_type=aggregate_type,
        aggregate_ref=aggregate_ref,
        payload=_safe_payload(payload or {}),
        correlation_id=correlation_id,
        causation_id=causation_id,
    )

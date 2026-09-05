"""Credential handoff to the out-of-band delivery boundary.

Frozen rule (B1-D-A19, B1_PRIVACY_AUDIT_MODEL Rule P-1, B1_API_DTO_CONTRACTS
§3.1): a raw invitation / verification / reset token is returned to a client
**zero times, not once**, and never lands in a log line, an audit row, an event
payload, the outbox, or a Celery argument.

A command that mints a token calls `deliver_credential` and retains nothing.
The handoff is bound to the issuing transaction's `command_id`, so the token
crosses exactly one seam and is consumed exactly once
(B1_COMMAND_EVENT_CATALOG §3.3).

This module mirrors `common.audit` and `common.outbox`: a thin function over a
class B port. common/ stays L0 and imports nothing from apps/.
"""

from __future__ import annotations

import uuid

from .ports import ports

VERIFY_EMAIL = "verify_email"
ACCOUNT_EXISTS = "account_exists"
INVITATION = "invitation"


def new_command_id() -> str:
    return str(uuid.uuid4())


def deliver_credential(
    *, kind: str, subject_ref: str, raw_token: str = "", command_id: str = ""
) -> None:
    """Hand a raw credential (or a token-less notification) to the boundary.

    `raw_token` is passed by value and kept by nobody: the caller drops it when
    this returns, and the bound adapter is the only thing permitted to act on
    it. `kind` carries no secret, so a notification that has no token at all
    (ACCOUNT_EXISTS) travels the same seam and is externally indistinguishable
    from one that does.
    """
    ports.require("credential_delivery").deliver(
        kind=kind,
        subject_ref=subject_ref,
        raw_token=raw_token,
        command_id=command_id or new_command_id(),
    )


__all__ = ["deliver_credential", "new_command_id", "VERIFY_EMAIL", "ACCOUNT_EXISTS", "INVITATION"]

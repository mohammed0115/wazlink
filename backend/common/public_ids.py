"""Public ID generation and prefix validation (BACKEND_PUBLIC_ID_REGISTRY).

Internal UUID PKs are NEVER exposed. Every externally visible identifier is a
prefixed opaque token registered here.
"""

from __future__ import annotations

import secrets
import string

ALPHABET = string.ascii_uppercase + string.digits
TOKEN_LENGTH = 16

# Registered prefixes. A prefix not in this registry cannot be minted.
PREFIX_REGISTRY: dict[str, str] = {
    "USER": "accounts.User",
    "SESS": "identity_access.Session",
    "WS": "workspaces.Workspace",
    "MEM": "workspaces.Membership",
    "INV": "workspaces.Invitation",
    "PLAN": "entitlements.Plan",
    "PLANV": "entitlements.PlanVersion",
    "WPA": "entitlements.WorkspacePlanAssignment",
    "OBX": "platform_async.OutboxEvent",
    "AUD": "auditlog.AuditLog",
    "BIZ": "discovery.Business",
    "DJOB": "discovery.DiscoveryJob",
    "LEAD": "crm.Lead",
    "CT": "crm.Contact",
    "TASK": "crm.Task",
    "APPT": "crm.Appointment",
    "NOTE": "crm.Note",
    "ACT": "crm.CrmActivity",
    "FILE": "files.FileAsset",
    "CUS": "customers.Customer",
    "PID": "identity.PartyIdentifier",
    "FLD": "customfields.FieldDefinition",
    "IMP": "imports.ImportBatch",
    "PIPE": "pipeline.Pipeline",
    "STG": "pipeline.PipelineStage",
    "DEAL": "pipeline.Deal",
}


class UnregisteredPrefixError(ValueError):
    """Raised when a public ID is minted with an unregistered prefix."""


def generate_public_id(prefix: str) -> str:
    """Mint a public ID. The prefix MUST be registered."""
    if prefix not in PREFIX_REGISTRY:
        raise UnregisteredPrefixError(f"Public ID prefix {prefix!r} is not registered")
    token = "".join(secrets.choice(ALPHABET) for _ in range(TOKEN_LENGTH))
    return f"{prefix}-{token}"


def is_valid_public_id(value: str, prefix: str | None = None) -> bool:
    if not value or "-" not in value:
        return False
    head, _, tail = value.partition("-")
    if head not in PREFIX_REGISTRY:
        return False
    if prefix is not None and head != prefix:
        return False
    return len(tail) == TOKEN_LENGTH and all(c in ALPHABET for c in tail)

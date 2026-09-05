"""identity commands — party identity resolution.

Identity resolution NEVER crosses a workspace boundary. workspace_id is
required on every lookup and every write; a cross-workspace merge is
structurally impossible here.
"""

from __future__ import annotations

from dataclasses import dataclass

from django.db import transaction

from ..models import PartyIdentifier


@dataclass(frozen=True)
class ResolutionResult:
    result: str  # 'resolved' | 'unresolved' | 'ambiguous'
    party_type: str | None = None
    party_id: object = None


def normalize(kind: str, value: str) -> str:
    cleaned = (value or "").strip()
    if kind == "email":
        return cleaned.lower()
    if kind == "phone":
        return "".join(ch for ch in cleaned if ch.isdigit() or ch == "+")
    return cleaned


@transaction.atomic
def register_identifier(
    *, workspace, contact=None, party_type: str = "contact", party_id=None
) -> list[PartyIdentifier]:
    """Register a contact's reachability identifiers within its workspace."""
    rows: list[PartyIdentifier] = []
    if contact is not None:
        party_id = contact.id
        pairs = [("phone", contact.phone), ("email", contact.email)]
    else:
        pairs = []

    for kind, raw in pairs:
        value = normalize(kind, raw)
        if not value:
            continue
        row, _ = PartyIdentifier.objects.get_or_create(
            workspace=workspace,
            identifier_kind=kind,
            identifier_value=value,
            party_type=party_type,
            party_id=party_id,
        )
        rows.append(row)
    return rows


def resolve_party(*, workspace, identifier_kind: str, identifier_value: str) -> ResolutionResult:
    """INTERNAL selector. Scoped to one workspace, always."""
    value = normalize(identifier_kind, identifier_value)
    if not value:
        return ResolutionResult("unresolved")

    matches = list(
        PartyIdentifier.objects.filter(
            workspace=workspace, identifier_kind=identifier_kind, identifier_value=value
        )[:3]
    )
    if not matches:
        return ResolutionResult("unresolved")
    distinct = {(m.party_type, m.party_id) for m in matches}
    if len(distinct) > 1:
        return ResolutionResult("ambiguous")
    match = matches[0]
    return ResolutionResult("resolved", match.party_type, match.party_id)


__all__ = ["register_identifier", "resolve_party", "ResolutionResult", "normalize"]

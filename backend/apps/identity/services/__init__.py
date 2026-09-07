"""identity commands — party identity resolution.

Identity resolution NEVER crosses a workspace boundary. workspace_id is
required on every lookup and every write; a cross-workspace merge is
structurally impossible here.
"""

from __future__ import annotations

from dataclasses import dataclass

from django.db import transaction

from common.audit import write_audit
from common.concurrency import lock_aggregate
from common.errors import DomainConflict, ValidationFailed
from common.outbox import publish_event

from ..models import MergeRecord, PartyIdentifier


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


# --------------------------------------------------------------------------
# MergeParties (I14, GAP-007). HUMAN-ONLY, reason mandatory, IRREVERSIBLE.
# --------------------------------------------------------------------------
MERGEABLE_PARTY_TYPES = ("customer", "lead", "contact")


@transaction.atomic
def merge_parties(*, context, party_type: str, surviving, losing, reason: str) -> MergeRecord:
    """Merge two parties within ONE workspace.

    Three guards, and each closes a specific harm:

    *   **Human only.** There is no system-actor path and no automation action
        that reaches this command, because a merge is irreversible (`PD-006`)
        and an automated one would be an unrecoverable mistake at scale.
    *   **Reason mandatory.** The lineage row is the only record of WHY two
        records became one; without it a later reader cannot tell a correction
        from an error.
    *   **Single workspace.** Asserted explicitly rather than inferred from the
        caller having passed two objects it happened to own.

    It rewrites **no immutable finance row**. `revenue_events` and
    `revenue_reversals` are untouched — a merge changes who a party is, never
    what was recognized.
    """
    membership = getattr(context, "membership", None)
    if membership is None:
        raise ValidationFailed("A merge requires a human membership actor.")
    if party_type not in MERGEABLE_PARTY_TYPES:
        raise ValidationFailed("That party type cannot be merged.")
    if not (reason or "").strip():
        raise ValidationFailed("A merge requires a stated reason.")
    if surviving.pk == losing.pk:
        raise ValidationFailed("A party cannot be merged into itself.")
    if surviving.workspace_id != context.workspace.id or losing.workspace_id != context.workspace.id:
        raise ValidationFailed("Parties from different workspaces cannot be merged.")

    lock_aggregate(surviving)
    lock_aggregate(losing)
    if MergeRecord.objects.filter(workspace=context.workspace, merged_id=losing.pk).exists():
        raise DomainConflict("This party has already been merged.")

    # Re-point identifiers. The unique constraint absorbs one the survivor
    # already holds, so a duplicate is dropped rather than re-pointed.
    held = set(
        PartyIdentifier.objects.filter(
            workspace=context.workspace, party_type=party_type, party_id=surviving.pk
        ).values_list("identifier_kind", "identifier_value")
    )
    for identifier in PartyIdentifier.objects.filter(
        workspace=context.workspace, party_type=party_type, party_id=losing.pk
    ):
        if (identifier.identifier_kind, identifier.identifier_value) in held:
            identifier.delete()
        else:
            PartyIdentifier.objects.filter(pk=identifier.pk).update(party_id=surviving.pk)

    record = MergeRecord.objects.create(
        workspace=context.workspace,
        party_type=party_type,
        surviving_id=surviving.pk,
        merged_id=losing.pk,
        reason=reason.strip(),
    )
    write_audit(
        workspace=context.workspace,
        actor_membership=membership,
        action="identity.parties_merged",
        target_type=party_type,
        target_ref=getattr(losing, "public_id", str(losing.pk)),
        metadata={"surviving_ref": getattr(surviving, "public_id", str(surviving.pk)),
                  "reason": reason.strip()[:200]},
    )
    publish_event(
        workspace=context.workspace,
        event_type="PartiesMerged",
        aggregate_type=party_type,
        aggregate_ref=getattr(losing, "public_id", str(losing.pk)),
        payload={"surviving_ref": getattr(surviving, "public_id", str(surviving.pk))},
    )
    return record


__all__ = [
    "register_identifier",
    "resolve_party",
    "ResolutionResult",
    "normalize",
    "merge_parties",
    "MERGEABLE_PARTY_TYPES",
]

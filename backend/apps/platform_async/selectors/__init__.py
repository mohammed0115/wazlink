"""platform operations read models. Reference names only — never a value."""

from __future__ import annotations

from ..models import IntegrationConnection, PlatformDeadLetter, PlatformReconciliationCase


def dead_letters(status: str = "") -> object:
    rows = PlatformDeadLetter.objects.all()
    if status:
        rows = rows.filter(status=status)
    return rows.order_by("-created_at")


def dead_letter_payload(record: PlatformDeadLetter) -> dict:
    return {
        "id": str(record.pk),
        "command_name": record.command_name,
        "status": record.status,
        "owning_domain": record.owning_domain,
        "replay_eligible": record.replay_eligible,
        # The REFERENCE payload — never an embedded copy of domain state.
        "reference_payload": record.reference_payload,
        "reason": record.reason,
        "created_at": record.created_at,
    }


def reconciliation_cases(status: str = "") -> object:
    rows = PlatformReconciliationCase.objects.all()
    if status:
        rows = rows.filter(status=status)
    return rows.order_by("-created_at")


def case_payload(case: PlatformReconciliationCase) -> dict:
    return {
        "id": str(case.pk),
        "case_class": case.case_class,
        "subject_ref": case.subject_ref,
        "status": case.status,
        "detail": case.detail,
        "created_at": case.created_at,
    }


def integrations_for(workspace) -> object:
    return IntegrationConnection.objects.filter(workspace=workspace).order_by("provider")


def integration_payload(connection: IntegrationConnection) -> dict:
    """`T-SEC-4`: `credential_refs` holds NAMES. No value, masked or otherwise."""
    return {
        "provider": connection.provider,
        "status": connection.status,
        "configuration_valid": connection.configuration_valid,
        "credential_refs": connection.credential_refs,
        "updated_at": connection.updated_at,
    }


__all__ = [
    "dead_letters",
    "dead_letter_payload",
    "reconciliation_cases",
    "case_payload",
    "integrations_for",
    "integration_payload",
]

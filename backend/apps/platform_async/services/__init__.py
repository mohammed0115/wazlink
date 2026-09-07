"""platform_async operator commands (B12/B13). I12.

Two rules shape everything below, and both are refusals:

*   **Nothing here auto-repairs.** Reconciliation classes `P-1`, `P-3`, `P-5`,
    `P-6` and `P-7` are report-only (`B14_09` §4). A case is opened for a human
    and closed by a human; no sweep quietly fixes one.
*   **There is no "retry this task" button** (`B12-D-A053`). `ReplayDeadLetter`
    is the ONLY human-initiated re-execution surface in the platform, it
    re-runs every original guard, and it requires a reason.

`apps/platform_async/` imports no other app (`T-DISP-4`). Replay reaches the
owning domain through the NAME registry, which produces no import edge.
"""

from __future__ import annotations

import re
from datetime import timedelta

from django.db import transaction
from django.db.models import Q
from django.utils import timezone

from common.audit import write_audit
from common.dispatch import UnknownCommandError, command_registry
from common.errors import DomainConflict, PermissionDeniedError, ValidationFailed
from common.provider_ports import ProviderError, providers

from ..models import (
    IntegrationConnection,
    IntegrationHealthSnapshot,
    PlatformDeadLetter,
    PlatformReconciliationCase,
    WorkerExecution,
)

# A `running` row older than this is HEARTBEAT-STALE. It becomes `unknown` and
# is operator-gated — never re-executed, because a worker that stopped
# reporting may still be doing the work.
HEARTBEAT_STALE_MINUTES = 45

# Domains whose records only an Owner may replay (`FI-B9-02`).
OWNER_ONLY_DOMAINS = ("billing", "finance", "revenue", "tax")

# Secret-shaped content in an operator's free-text reason. Detected and
# REJECTED, never redacted-and-stored: a redacted reason has lost the very
# thing it was written to preserve, and quietly scrubbing teaches an operator
# the field is a safe place to put credentials.
_SECRET_PATTERNS = (
    # Real provider keys carry internal separators (`sk_live_…`, `sk-test-…`),
    # so the token class must include them or the common shape slips past.
    re.compile(r"\bsk[-_][A-Za-z0-9_-]{12,}", re.I),
    re.compile(r"\bBearer\s+[A-Za-z0-9._\-]{12,}", re.I),
    re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
    re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}", re.I),
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
    re.compile(r"\b(api[_-]?key|secret|password|passwd)\s*[:=]\s*\S{6,}", re.I),
)


def _require_reason(reason: str) -> str:
    text = (reason or "").strip()
    if not text:
        raise ValidationFailed("A reason is required.")
    for pattern in _SECRET_PATTERNS:
        if pattern.search(text):
            # Reports THAT a class was detected; never echoes the value, in any
            # response, log line or audit row. The reason is not persisted.
            raise ValidationFailed("The reason appears to contain a credential and was refused.")
    return text


def _require_operator(context, permission: str, *, owning_domain: str = "") -> None:
    role = getattr(context, "role", "")
    if permission not in getattr(context, "permissions", frozenset()):
        raise PermissionDeniedError("This operation requires platform operations authority.")
    # Admin is CONDITIONAL and never for a finance-owning record.
    if owning_domain in OWNER_ONLY_DOMAINS and role != "owner":
        raise PermissionDeniedError("This operation requires platform operations authority.")


# --------------------------------------------------------------------------
# Dead letters
# --------------------------------------------------------------------------
@transaction.atomic
def replay_dead_letter(*, context, record: PlatformDeadLetter, reason: str) -> PlatformDeadLetter:
    """The ONLY human-initiated re-execution surface (`FI-B12-06` §6a).

    Evaluation order is fail-closed at every step:
    authorization -> reason presence -> reason content -> frozen eligibility
    guards -> domain command. A failure at any step leaves the record untouched
    and emits no provider effect.
    """
    # 1. Authorization FIRST — before the body is even validated, so an
    #    unauthorized caller learns nothing about the record.
    _require_operator(context, "platform.operations.replay", owning_domain=record.owning_domain)
    # 2/3. Reason present, and free of credentials.
    text = _require_reason(reason)

    # 4. The frozen guards are ADDITIONAL, never substituted. A valid reason
    #    never advances a record the guards would refuse.
    if record.status != "dead":
        raise DomainConflict("This record is no longer replayable.")
    if not record.replay_eligible:
        raise DomainConflict("This operation is not eligible for replay.")

    # 5. Replay invokes the OWNING DOMAIN's own guarded command, by NAME.
    #    It never invokes RetryJob or RetryWebhook — both stay system-only.
    try:
        command_registry.dispatch(record.command_name, record.reference_payload or {})
    except UnknownCommandError:
        raise DomainConflict("The original command is no longer registered.") from None

    record.status = "replayed"
    record.resolved_at = timezone.now()
    record.save(update_fields=["status", "resolved_at", "updated_at"])

    # 6. The audit row is the durable home of the reason — no column is minted
    #    on the dead letter to hold it.
    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="platform.replayed",
        target_type="platform_dead_letter",
        target_ref=str(record.pk),
        metadata={"reason": text, "command_name": record.command_name},
    )
    return record


@transaction.atomic
def abandon_dead_letter(*, context, record: PlatformDeadLetter, reason: str) -> PlatformDeadLetter:
    """Terminal. Makes no further attempt at the underlying intent."""
    _require_operator(context, "platform.operations.replay", owning_domain=record.owning_domain)
    text = _require_reason(reason)
    if record.status != "dead":
        raise DomainConflict("This record is already resolved.")

    record.status = "abandoned"
    record.resolved_at = timezone.now()
    record.save(update_fields=["status", "resolved_at", "updated_at"])
    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="platform.abandoned",
        target_type="platform_dead_letter",
        target_ref=str(record.pk),
        metadata={"reason": text},
    )
    return record


@transaction.atomic
def resolve_reconciliation_case(
    *, context, case: PlatformReconciliationCase, reason: str
) -> PlatformReconciliationCase:
    """Gated by `platform.operations.replay`, not `.view`.

    Reading an incident and re-executing its repair are different powers.
    """
    _require_operator(context, "platform.operations.replay", owning_domain=case.owning_domain)
    text = _require_reason(reason)
    if case.status != "open":
        raise DomainConflict("This case is already resolved.")

    case.status = "resolved"
    case.resolution_note = text
    case.resolved_at = timezone.now()
    case.save(update_fields=["status", "resolution_note", "resolved_at", "updated_at"])
    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="platform.case_resolved",
        target_type="platform_reconciliation_case",
        target_ref=str(case.pk),
        metadata={"reason": text, "case_class": case.case_class},
    )
    return case


# --------------------------------------------------------------------------
# Integrations
# --------------------------------------------------------------------------
def check_provider_configuration(*, context, provider: str) -> IntegrationConnection:
    """Ask the ADAPTER what it can see. Stores reference NAMES, never values."""
    _require_operator(context, "integration.manage")
    try:
        adapter = providers.require(provider)
        status = adapter.status()
    except ProviderError:
        status = None

    connection, _ = IntegrationConnection.objects.get_or_create(
        provider=provider, workspace=context.workspace, defaults={"status": "not_connected"}
    )
    if status is None:
        connection.status = "not_configured"
        connection.configuration_valid = False
        connection.credential_refs = []
    else:
        connection.status = status.status
        connection.configuration_valid = status.configuration_valid
        # REFERENCE NAMES only. `T-SEC-4` asserts no value reaches here.
        connection.credential_refs = list(status.credential_refs)
    connection.save(update_fields=["status", "configuration_valid", "credential_refs", "updated_at"])
    return connection


@transaction.atomic
def enable_integration(*, context, connection: IntegrationConnection) -> IntegrationConnection:
    """Refused unless the connection is CONFIGURED and valid.

    An operator cannot enable their way past a missing credential: the check
    reads the adapter's own report, not the operator's intent.
    """
    _require_operator(context, "integration.manage")
    if connection.status not in ("configured", "enabled") or not connection.configuration_valid:
        raise DomainConflict("This integration cannot be enabled until it is configured.")

    # A provider whose webhook verification scheme does not exist yet may not
    # be enabled at all (`B12-D-A054`), whatever an operator wants.
    adapter = getattr(providers, connection.provider, None)
    checker = getattr(adapter, "verification_scheme_available", None)
    if checker is not None and not checker():
        raise DomainConflict("This provider has no webhook verification scheme and cannot be enabled.")

    connection.status = "enabled"
    connection.save(update_fields=["status", "updated_at"])
    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="platform.integration_enabled",
        target_type="integration_connection",
        target_ref=connection.provider,
    )
    return connection


@transaction.atomic
def disable_integration(*, context, connection: IntegrationConnection) -> IntegrationConnection:
    """Disabling stops OUTBOUND use. Inbound webhooks stay ACCEPTED.

    Refusing inbound callbacks would make a provider retry, then give up, and
    the evidence of what happened while disabled would be lost.
    """
    _require_operator(context, "integration.manage")
    connection.status = "disabled"
    connection.save(update_fields=["status", "updated_at"])
    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="platform.integration_disabled",
        target_type="integration_connection",
        target_ref=connection.provider,
    )
    return connection


# --------------------------------------------------------------------------
# Sweeps — REPORT ONLY
# --------------------------------------------------------------------------
def sweep_heartbeat_stale_executions(*, now=None) -> int:
    """A stale `running` row becomes `unknown`. It is NEVER re-executed.

    `worker_executions` carries no lease and no fencing column on purpose: a
    lease implies it is safe to take the work back, and for a non-idempotent
    operation whose outcome is unknown it is not.
    """
    now = now or timezone.now()
    cutoff = now - timedelta(minutes=HEARTBEAT_STALE_MINUTES)
    # A row with no heartbeat at all is judged by its creation time, so a
    # worker that died before its first beat is not invisible to the sweep.
    stale = WorkerExecution.objects.filter(status="running").filter(
        Q(heartbeat_at__lte=cutoff) | (Q(heartbeat_at__isnull=True) & Q(created_at__lte=cutoff))
    )
    count = 0
    for execution in stale:
        execution.status = "unknown"
        execution.save(update_fields=["status", "updated_at"])
        PlatformReconciliationCase.objects.get_or_create(
            case_class="P-3",
            subject_ref=str(execution.pk),
            status="open",
            defaults={
                "detail": {"task_name": execution.task_name, "note": "heartbeat stale; operator-gated"}
            },
        )
        count += 1
    return count


def reconciliation_sweep(*, now=None) -> int:
    """Report-only across every class. Repairs nothing, ever."""
    return sweep_heartbeat_stale_executions(now=now)


def integration_health_check(*, now=None) -> int:
    """Snapshot each connection's health from its adapter's own report."""
    count = 0
    for connection in IntegrationConnection.objects.all():
        try:
            status = providers.require(connection.provider).status()
            healthy = status.is_usable
            detail = {"status": status.status, "configuration_valid": status.configuration_valid}
        except ProviderError:
            healthy, detail = False, {"status": "not_configured"}
        IntegrationHealthSnapshot.objects.create(
            connection=connection, healthy=healthy, detail=detail
        )
        count += 1
    return count


def record_dead_letter(
    *, command_name: str, reference_payload: dict, reason: str, owning_domain: str = "",
    replay_eligible: bool = False, workspace=None,
) -> PlatformDeadLetter:
    """Open a dead letter. `replay_eligible` is COMPUTED by the caller from the
    operation's own idempotency — never supplied by an operator."""
    return PlatformDeadLetter.objects.create(
        command_name=command_name,
        reference_payload=reference_payload,
        reason=reason,
        owning_domain=owning_domain,
        replay_eligible=replay_eligible,
        workspace=workspace,
    )


__all__ = [
    "replay_dead_letter",
    "abandon_dead_letter",
    "resolve_reconciliation_case",
    "check_provider_configuration",
    "enable_integration",
    "disable_integration",
    "sweep_heartbeat_stale_executions",
    "reconciliation_sweep",
    "integration_health_check",
    "record_dead_letter",
    "HEARTBEAT_STALE_MINUTES",
    "OWNER_ONLY_DOMAINS",
]

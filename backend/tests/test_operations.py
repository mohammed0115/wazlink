"""I12 — Async / Integration platform completion + Admin operations.

Frozen sources, read directly:

*   `B13_OPERATOR_MODEL` §6a — the fail-closed replay order: authorization →
    reason presence → reason content → frozen guards → domain command.
*   `B13_OPERATOR_MODEL` §6b — a secret-bearing reason is REJECTED, never
    redacted-and-stored.
*   `B12-D-A020` / `B12-D-A053` — an `unknown` outcome is operator-gated and
    never auto-re-executed, and there is no "retry this task" button.
*   `B14_08` §6 — Platform Operator is a separate namespace and is never
    treated as a workspace role (`T-RBAC-4`).
"""

from __future__ import annotations

from datetime import timedelta

import pytest
from django.utils import timezone

from apps.platform_async.models import (
    IntegrationConnection,
    PlatformReconciliationCase,
    WorkerExecution,
)
from apps.platform_async.services import (
    abandon_dead_letter,
    check_provider_configuration,
    disable_integration,
    enable_integration,
    record_dead_letter,
    replay_dead_letter,
    resolve_reconciliation_case,
    sweep_heartbeat_stale_executions,
)
from common.errors import DomainConflict, PermissionDeniedError, ValidationFailed

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def replayable(_registries_populated):
    """Register a dispatchable command AFTER the composition root has run.

    Depending on `_registries_populated` is load-bearing: `register_all()`
    clears the registries, so a command registered before it would vanish.
    The registry dispatches with `**payload`, so the handler takes kwargs.
    """
    from common.dispatch import command_registry

    calls: list[dict] = []
    command_registry.register("TestReplayable", lambda **payload: calls.append(payload))
    return calls


# ------------------------------------------------------------ T-ASYNC: unknown
def test_t_async_no_lease_or_fence_column_exists():
    """`T-ASYNC-*`. A lease would imply it is safe to take the work back."""
    columns = {f.name for f in WorkerExecution._meta.get_fields()}
    for forbidden in ("lease", "lease_expires_at", "fence", "fence_token", "owner_token"):
        assert forbidden not in columns, f"worker_executions carries a {forbidden}"


def test_a_heartbeat_stale_execution_becomes_unknown_and_is_never_re_executed():
    """`B12-D-A020`. Operator-gated, with a case opened for a human."""
    execution = WorkerExecution.objects.create(
        task_name="discovery.run_discovery_job", queue="providers.slow", status="running"
    )
    WorkerExecution.objects.filter(pk=execution.pk).update(
        heartbeat_at=timezone.now() - timedelta(hours=3)
    )
    assert sweep_heartbeat_stale_executions() == 1

    execution.refresh_from_db()
    assert execution.status == "unknown"
    # A case exists for a HUMAN. Nothing re-ran.
    assert PlatformReconciliationCase.objects.filter(
        case_class="P-3", subject_ref=str(execution.pk), status="open"
    ).exists()


def test_the_sweep_never_repairs_anything():
    """Report-only across every class (`B14_09` §4)."""
    import inspect

    from apps.platform_async import services

    source = inspect.getsource(services)
    for forbidden in ("auto_repair", "def repair", ".retry(", "requeue"):
        assert forbidden not in source, f"the sweep repairs: {forbidden}"


# ------------------------------------------------------------ replay contract
def test_replay_requires_a_non_empty_reason(actor, replayable):
    a = actor()
    record = record_dead_letter(
        command_name="TestReplayable", reference_payload={"x": 1}, reason="failed",
        replay_eligible=True,
    )
    for empty in ("", "   ", "\n\t"):
        with pytest.raises(ValidationFailed):
            replay_dead_letter(context=a.context, record=record, reason=empty)
    record.refresh_from_db()
    # The record is untouched and NOTHING was dispatched.
    assert record.status == "dead"
    assert replayable == []


def test_a_secret_bearing_reason_is_rejected_never_stored(actor, replayable):
    """`B13_OPERATOR_MODEL` §6b. Rejected, and never persisted anywhere."""
    a = actor()
    record = record_dead_letter(
        command_name="TestReplayable", reference_payload={}, reason="x", replay_eligible=True
    )
    secrets = (
        "retrying with sk_live_ABCDEFGHIJKLMNOP",
        "used Bearer eyJhbGciOiJIUzI1NiJ9abcdefgh",
        "key AKIAIOSFODNN7EXAMPLE",
        "api_key=supersecretvalue",
    )
    for reason in secrets:
        with pytest.raises(ValidationFailed) as exc:
            replay_dead_letter(context=a.context, record=record, reason=reason)
        # The response says THAT a class was detected, never the value.
        assert "sk_live" not in str(exc.value) and "AKIA" not in str(exc.value)

    from apps.auditlog.models import AuditLog

    for row in AuditLog.objects.all():
        assert "sk_live" not in str(row.metadata) and "AKIA" not in str(row.metadata)
    record.refresh_from_db()
    assert record.status == "dead"


def test_an_ineligible_record_is_refused_even_with_a_valid_reason(actor, replayable):
    """`FI-B12-06` §5: the guards are ADDITIONAL, never substituted."""
    a = actor()
    record = record_dead_letter(
        command_name="TestReplayable", reference_payload={}, reason="x", replay_eligible=False
    )
    with pytest.raises(DomainConflict):
        replay_dead_letter(context=a.context, record=record, reason="a perfectly good reason")
    record.refresh_from_db()
    assert record.status == "dead"
    assert replayable == []


def test_a_successful_replay_dispatches_and_audits_the_reason(actor, replayable):
    a = actor()
    record = record_dead_letter(
        command_name="TestReplayable", reference_payload={"job": "J1"}, reason="timeout",
        replay_eligible=True,
    )
    record = replay_dead_letter(context=a.context, record=record, reason="provider recovered")
    assert record.status == "replayed"
    assert replayable == [{"job": "J1"}]

    from apps.auditlog.models import AuditLog

    audit = AuditLog.objects.get(action="platform.replayed")
    # The audit row is the durable home of the reason.
    assert audit.metadata["reason"] == "provider recovered"
    assert audit.actor_membership_id == a.membership.pk


def test_replay_is_refused_without_the_replay_permission(actor, replayable):
    """Authorization runs FIRST — before the body is even validated."""
    manager = actor(email="mg@example.test", role="manager", workspace_name="Mg")
    record = record_dead_letter(
        command_name="TestReplayable", reference_payload={}, reason="x", replay_eligible=True
    )
    with pytest.raises(PermissionDeniedError):
        replay_dead_letter(context=manager.context, record=record, reason="let me")
    assert replayable == []


def test_an_admin_may_not_replay_a_finance_owned_record(actor, replayable):
    """`FI-B9-02`. Admin is conditional; a billing record requires Owner."""
    admin = actor(email="ad@example.test", role="admin", workspace_name="Ad")
    owner = actor(email="ow@example.test", role="owner", workspace_name="Ow")

    for domain in ("billing", "finance", "revenue", "tax"):
        record = record_dead_letter(
            command_name="TestReplayable", reference_payload={}, reason="x",
            owning_domain=domain, replay_eligible=True,
        )
        with pytest.raises(PermissionDeniedError):
            replay_dead_letter(context=admin.context, record=record, reason="ok")
        record.refresh_from_db()
        assert record.status == "dead"

    # An ordinary domain record IS replayable by an admin.
    ordinary = record_dead_letter(
        command_name="TestReplayable", reference_payload={}, reason="x",
        owning_domain="messaging", replay_eligible=True,
    )
    assert replay_dead_letter(context=admin.context, record=ordinary, reason="ok").status == "replayed"

    # And an Owner may replay a finance record.
    finance = record_dead_letter(
        command_name="TestReplayable", reference_payload={}, reason="x",
        owning_domain="billing", replay_eligible=True,
    )
    assert replay_dead_letter(context=owner.context, record=finance, reason="ok").status == "replayed"


def test_a_replayed_record_cannot_be_replayed_twice(actor, replayable):
    a = actor()
    record = record_dead_letter(
        command_name="TestReplayable", reference_payload={}, reason="x", replay_eligible=True
    )
    replay_dead_letter(context=a.context, record=record, reason="first")
    with pytest.raises(DomainConflict):
        replay_dead_letter(context=a.context, record=record, reason="second")
    assert len(replayable) == 1


def test_abandon_is_terminal_and_reason_required(actor):
    a = actor()
    record = record_dead_letter(command_name="X", reference_payload={}, reason="x")
    with pytest.raises(ValidationFailed):
        abandon_dead_letter(context=a.context, record=record, reason="")
    record = abandon_dead_letter(context=a.context, record=record, reason="customer contacted")
    assert record.status == "abandoned"
    with pytest.raises(DomainConflict):
        abandon_dead_letter(context=a.context, record=record, reason="again")


def test_case_resolution_requires_the_replay_permission_not_view(actor):
    """Reading an incident and re-executing its repair are different powers."""
    manager = actor(email="cm@example.test", role="manager", workspace_name="Cm")
    owner = actor(email="co@example.test", role="owner", workspace_name="Co")
    case = PlatformReconciliationCase.objects.create(case_class="P-3", subject_ref="x")

    with pytest.raises(PermissionDeniedError):
        resolve_reconciliation_case(context=manager.context, case=case, reason="looked at it")
    case = resolve_reconciliation_case(context=owner.context, case=case, reason="verified by hand")
    assert case.status == "resolved"
    assert case.resolution_note == "verified by hand"


# ------------------------------------------------------------ integrations
def test_enable_is_refused_until_the_adapter_reports_configured(actor):
    a = actor()
    connection = IntegrationConnection.objects.create(
        provider="whatsapp", workspace=a.workspace, status="not_configured", configuration_valid=False
    )
    with pytest.raises(DomainConflict):
        enable_integration(context=a.context, connection=connection)
    connection.refresh_from_db()
    assert connection.status == "not_configured"


def test_check_configuration_records_reference_names_never_values(actor):
    a = actor()
    connection = check_provider_configuration(context=a.context, provider="whatsapp")
    assert connection.credential_refs
    for ref in connection.credential_refs:
        # A NAME, uppercase and env-var shaped. Never a value.
        assert ref.isupper() or "_" in ref
        assert "stub" not in ref.lower()


def test_a_configured_connection_enables_then_disables(actor):
    a = actor()
    connection = check_provider_configuration(context=a.context, provider="whatsapp")
    connection = enable_integration(context=a.context, connection=connection)
    assert connection.status == "enabled"
    connection = disable_integration(context=a.context, connection=connection)
    assert connection.status == "disabled"


def test_an_unverifiable_provider_can_never_be_enabled(actor):
    """`B12-D-A054`. The scraping vendor has no verification scheme."""
    a = actor()
    connection = IntegrationConnection.objects.create(
        provider="scraping", workspace=a.workspace, status="configured", configuration_valid=True
    )
    with pytest.raises(DomainConflict):
        enable_integration(context=a.context, connection=connection)


def test_disabling_keeps_inbound_webhooks_accepted(actor, client):
    """Refusing inbound would make the provider retry, give up, and lose the
    evidence of what happened while disabled."""
    import json

    from adapters.tap import StubTapAdapter
    from apps.billing.services import start_checkout, subscription_for

    a = actor()
    subscription_for(a.workspace)
    payment = start_checkout(context=a.context, plan_code="PLAN-GROWTH")
    connection = check_provider_configuration(context=a.context, provider="whatsapp")
    disable_integration(context=a.context, connection=connection)

    raw = json.dumps(
        {
            "id": payment.provider_payment_ref,
            "amount": "299.0000",
            "currency": "SAR",
            "status": "CAPTURED",
            "reference": {"gateway": "g", "payment": "p"},
            "transaction": {"created": "1700000000"},
        }
    ).encode()
    response = client.post(
        "/webhooks/tap", data=raw, content_type="application/json",
        headers={"hashstring": StubTapAdapter.sign(raw)},
    )
    assert response.status_code == 200


# ------------------------------------------------------------ admin / NC
def test_t_sec_4_nc_no_secret_reaches_a_rendered_admin_response(actor, monkeypatch):
    """`T-SEC-4` **(NC)**. Not masked — absent."""
    from django.contrib import admin as django_admin

    monkeypatch.setenv("WHATSAPP_ACCESS_TOKEN", "SENTINEL-TOKEN-VALUE-123456")
    a = actor()
    check_provider_configuration(context=a.context, provider="whatsapp")

    registered = django_admin.site._registry
    for model, model_admin in registered.items():
        if model._meta.app_label != "platform_async":
            continue
        for row in model.objects.all():
            rendered = " ".join(
                str(getattr(row, field, "")) for field in (model_admin.readonly_fields or ())
            )
            assert "SENTINEL" not in rendered


def test_no_tenant_business_model_is_admin_editable():
    """A platform operator holds no business authority."""
    from django.contrib import admin as django_admin

    forbidden_labels = {"crm", "customers", "pipeline", "messaging", "revenue", "billing", "tax"}
    for model, model_admin in django_admin.site._registry.items():
        if model._meta.app_label in forbidden_labels:
            raise AssertionError(f"{model._meta.label} is registered in the admin")
        if model._meta.app_label == "platform_async":
            assert model_admin.has_add_permission(None) is False
            assert model_admin.has_change_permission(None) is False
            assert model_admin.has_delete_permission(None) is False


def test_there_is_no_retry_this_task_button():
    """`B12-D-A053`. Replay is a governed command, not a one-click action."""
    from django.contrib import admin as django_admin

    for model, model_admin in django_admin.site._registry.items():
        if model._meta.app_label != "platform_async":
            continue
        assert not getattr(model_admin, "actions", None), f"{model._meta.label} exposes admin actions"


def test_t_rbac_4_nc_platform_operator_is_not_a_workspace_role():
    """`T-RBAC-4` **(NC)**. It appears in no cell of the six-role matrix."""
    from common.permissions_catalog import WORKSPACE_ROLES, cell

    assert "operator" not in WORKSPACE_ROLES
    assert "platform_operator" not in WORKSPACE_ROLES
    assert len(WORKSPACE_ROLES) == 6
    # And the platform codes still resolve fail-closed for an unknown role.
    assert cell("platform.operations.replay", "operator") == "."


def test_t_disp_4_platform_async_imports_no_other_app():
    """`T-DISP-4` **(NC)**. Replay reaches a domain by NAME, not by import."""
    import ast
    import pathlib

    root = pathlib.Path(__file__).resolve().parent.parent / "apps" / "platform_async"
    offenders = []
    for path in root.rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            module = node.module if isinstance(node, ast.ImportFrom) else ""
            if module and module.startswith("apps.") and not module.startswith("apps.platform_async"):
                offenders.append(f"{path.name}: {module}")
    assert offenders == [], f"platform_async imports another app: {offenders}"


def test_t_disp_2_an_unknown_command_name_is_refused(actor):
    a = actor()
    record = record_dead_letter(
        command_name="NoSuchCommand", reference_payload={}, reason="x", replay_eligible=True
    )
    with pytest.raises(DomainConflict):
        replay_dead_letter(context=a.context, record=record, reason="try it")


def test_the_operations_api_is_tenant_safe_and_gated(actor, auth_client):
    viewer = actor(email="ov@example.test", role="viewer", workspace_name="Ov")
    owner = actor(email="oo@example.test", role="owner", workspace_name="Oo")
    assert auth_client(viewer).get("/api/v1/operations/dead-letters").status_code == 403
    assert auth_client(owner).get("/api/v1/operations/dead-letters").status_code == 200
    assert auth_client(viewer).get("/api/v1/integrations").status_code == 403

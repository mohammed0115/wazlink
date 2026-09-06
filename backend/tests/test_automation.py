"""I8 — Automation. Frozen B7.

The load-bearing assertions here are the safety ones: `send_message` is
permanently `approval_required`, the excluded action list stays excluded, and no
automation path reaches a provider without a human decision.
"""

from __future__ import annotations

import pytest
from django.utils import timezone

pytestmark = pytest.mark.django_db


@pytest.fixture
def owner(actor):
    return actor(email="auto-owner@example.test", role="owner", workspace_name="AutoOwner")


@pytest.fixture
def wa(owner):
    from apps.platform_async.models import IntegrationConnection
    from common.provider_ports import providers

    IntegrationConnection.objects.create(
        workspace=owner.workspace, provider="whatsapp", status="enabled",
        provider_account_id="PN-AUTO", configuration_valid=True,
    )
    return providers.require("whatsapp")


def _rule(owner, *, name="rule", trigger="lead_created", actions=None, conditions=None, activate=True):
    from apps.automation.services import activate_revision, create_rule

    rule = create_rule(
        context=owner.context,
        name=name,
        trigger_type=trigger,
        actions=actions or [{"action_type": "create_task", "params": {"title": "Follow up"}}],
        conditions=conditions or [],
    )
    return activate_revision(context=owner.context, rule=rule) if activate else rule


def _fire(owner, *, trigger="lead_created", event_id="evt-1", payload=None, depth=0):
    from apps.automation.services import evaluate_event

    return evaluate_event(
        workspace=owner.workspace,
        trigger_type=trigger,
        source_event_id=event_id,
        payload=payload or {},
        depth=depth,
    )


# --------------------------------------------------------------------------
# T-AUTO-1 (NC) — the mandatory, non-configurable send tier.
# --------------------------------------------------------------------------


def test_auto_1_nc_send_message_is_permanently_approval_required():
    """Frozen `B7_ACTION_CATALOG` §3. Never `auto_safe`, not per-rule."""
    from apps.automation.models import ACTION_TIERS, TIER_APPROVAL_REQUIRED
    from apps.automation.services import safety_tier_for

    assert ACTION_TIERS["send_message"] == TIER_APPROVAL_REQUIRED
    assert safety_tier_for("send_message") == TIER_APPROVAL_REQUIRED

    # The tier is a property of the CATALOG. There is no per-action column a
    # rule author could set, so it cannot be lowered anywhere.
    from apps.automation.models import AutomationAction

    columns = {f.name for f in AutomationAction._meta.get_fields() if hasattr(f, "attname")}
    assert "safety_tier" not in columns
    assert "auto_safe" not in columns


def test_auto_1_nc_a_rule_cannot_declare_its_own_safety_tier(owner):
    from common.errors import PermissionDeniedError

    with pytest.raises(PermissionDeniedError):
        _rule(
            owner,
            name="sneaky",
            actions=[
                {"action_type": "send_message", "params": {"body": "hi"}, "safety_tier": "auto_safe"}
            ],
        )


def test_the_excluded_action_list_stays_excluded(owner):
    """`close_won_deal`, `create_revenue`, `delete_lead` and the rest."""
    from apps.automation.models import EXCLUDED_ACTION_TYPES
    from apps.automation.services import safety_tier_for
    from common.errors import PermissionDeniedError

    for excluded in EXCLUDED_ACTION_TYPES:
        with pytest.raises(PermissionDeniedError):
            safety_tier_for(excluded)
        with pytest.raises(PermissionDeniedError):
            _rule(owner, name=f"rule-{excluded}", actions=[{"action_type": excluded}])


def test_an_excluded_action_cannot_even_be_stored(owner):
    """The refusal is STRUCTURAL: a CHECK constraint, not a service guard."""
    from django.db import IntegrityError, transaction

    from apps.automation.models import AutomationAction

    rule = _rule(owner, name="structural", activate=False)
    revision = rule.revisions.first()
    with pytest.raises(IntegrityError), transaction.atomic():
        AutomationAction.objects.create(
            revision=revision, position=99, action_type="create_revenue", params={}
        )


def test_no_automation_path_writes_a_revenue_row(owner):
    """`B7_REVENUE_FIREWALL`. There is no reachable command that could."""
    import ast
    import pathlib

    root = pathlib.Path(__file__).resolve().parent.parent / "apps" / "automation"
    imports: set[str] = set()
    for path in root.rglob("*.py"):
        if "migrations" in path.parts:
            continue
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.ImportFrom) and node.module:
                imports.add(node.module)
            elif isinstance(node, ast.Import):
                imports.update(a.name for a in node.names)

    assert not any(name.startswith("apps.revenue") for name in imports)
    # And the module reaches only its four frozen governed action families.
    app_edges = {name.split(".")[1] for name in imports if name.startswith("apps.")}
    assert app_edges <= {"crm", "messaging", "pipeline", "workspaces", "automation"}


# --------------------------------------------------------------------------
# THE AUTOMATION SEND FIREWALL.
# --------------------------------------------------------------------------


def _conversation(owner):
    from apps.messaging.models import Conversation

    return Conversation.objects.create(
        workspace=owner.workspace, peer_address="+966500222333", last_inbound_at=timezone.now()
    )


def test_an_automation_send_never_reaches_the_provider_without_an_approval(owner, wa):
    """The hard gate. A rule cannot send by firing."""
    from apps.automation.models import AutomationRun

    conversation = _conversation(owner)
    _rule(
        owner,
        name="autosend",
        trigger="conversation_received",
        actions=[
            {
                "action_type": "send_message",
                "params": {"conversation_ref": conversation.public_id, "body": "Auto reply"},
            }
        ],
    )
    before = len(wa.sent)

    runs = _fire(owner, trigger="conversation_received", event_id="evt-send-1")

    assert len(runs) == 1
    run = AutomationRun.objects.get(pk=runs[0].pk)
    # It STOPPED at the human gate — it did not run and did not send.
    assert run.status == "awaiting_approval"
    assert len(wa.sent) == before
    assert run.steps.filter(status="succeeded").count() == 0


def test_executing_an_unapproved_run_directly_still_sends_nothing(owner, wa):
    """A second, independent check: the approval ROW must exist and be approved.

    Even if a run's status were set by some other path, `execute_run` re-reads
    the approval and refuses — a status can be written, an approval decision
    cannot be forged.
    """
    from apps.automation.models import RUN_RUNNING, AutomationRun
    from apps.automation.services import execute_run

    conversation = _conversation(owner)
    _rule(
        owner, name="forced", trigger="conversation_received",
        actions=[{"action_type": "send_message",
                  "params": {"conversation_ref": conversation.public_id, "body": "Forced"}}],
    )
    run = _fire(owner, trigger="conversation_received", event_id="evt-forced")[0]
    before = len(wa.sent)

    # Force the status past the gate without an approval decision.
    AutomationRun.objects.filter(pk=run.pk).update(status=RUN_RUNNING)
    execute_run(run_id=run.pk, actor_context=owner.context)

    assert len(wa.sent) == before, "an unapproved run reached the provider"
    assert AutomationRun.objects.get(pk=run.pk).steps.filter(status="succeeded").count() == 0


def test_an_approved_send_runs_as_the_approving_human_through_the_frozen_path(
    owner, wa, django_capture_on_commit_callbacks
):
    """After approval the send is a HUMAN's, through messaging's own command."""
    from apps.messaging.models import Message
    from apps.messaging.tasks import send_outbound_message_task
    from common.dispatch import task_registry

    conversation = _conversation(owner)
    _rule(
        owner, name="approved-send", trigger="conversation_received",
        actions=[{"action_type": "send_message",
                  "params": {"conversation_ref": conversation.public_id, "body": "Approved reply"}}],
    )
    run = _fire(owner, trigger="conversation_received", event_id="evt-approved")[0]

    from apps.automation.services import approve_run

    task_registry.enqueued.clear()
    with django_capture_on_commit_callbacks(execute=True):
        approve_run(context=owner.context, run=run, reason="Reviewed and approved")

    message = Message.objects.get(workspace=owner.workspace, direction="outbound")
    # The MESSAGE's sender is the approving human — not a system identity.
    assert message.sent_by_id == owner.membership.id
    assert message.status == "queued"

    for name, payload in task_registry.enqueued:
        if name == "messaging.send_outbound_message":
            send_outbound_message_task(payload["message_id"])
    assert len(wa.sent) == 1


def test_a_rejected_run_never_executes_any_step(owner, wa):
    from apps.automation.services import reject_run

    conversation = _conversation(owner)
    _rule(
        owner, name="rejected", trigger="conversation_received",
        actions=[{"action_type": "send_message",
                  "params": {"conversation_ref": conversation.public_id, "body": "Nope"}}],
    )
    run = _fire(owner, trigger="conversation_received", event_id="evt-rejected")[0]
    before = len(wa.sent)

    rejected = reject_run(context=owner.context, run=run, reason="Not appropriate")
    assert rejected.status == "rejected"
    assert len(wa.sent) == before
    assert set(rejected.steps.values_list("status", flat=True)) == {"skipped"}


def test_approval_requires_the_approve_permission(owner, actor, wa):
    from apps.automation.services import approve_run
    from common.authz import AuthorizationContext
    from common.errors import PermissionDeniedError
    from common.permissions_catalog import permissions_for_role

    conversation = _conversation(owner)
    _rule(
        owner, name="perm", trigger="conversation_received",
        actions=[{"action_type": "send_message",
                  "params": {"conversation_ref": conversation.public_id, "body": "x"}}],
    )
    run = _fire(owner, trigger="conversation_received", event_id="evt-perm")[0]

    powerless = AuthorizationContext(
        user=owner.user, session=None, workspace=owner.workspace, membership=owner.membership,
        role="member", permissions=permissions_for_role("member") - {"automation.run.approve"},
    )
    with pytest.raises(PermissionDeniedError):
        approve_run(context=powerless, run=run)
    assert len(wa.sent) == 0


# --------------------------------------------------------------------------
# Auto-safe execution, idempotency and loop prevention.
# --------------------------------------------------------------------------


def test_an_auto_safe_rule_executes_through_the_owning_domains_command(owner):
    from apps.automation.services import execute_run
    from apps.crm.models import Task

    _rule(owner, name="task-rule", actions=[{"action_type": "create_task",
                                             "params": {"title": "Automated follow up"}}])
    run = _fire(owner, event_id="evt-task")[0]
    assert run.status == "pending"  # auto_safe: no approval gate

    execute_run(run_id=run.pk, actor_context=owner.context)

    run.refresh_from_db()
    assert run.status == "succeeded"
    task = Task.objects.get(workspace=owner.workspace)
    assert task.title == "Automated follow up"
    assert run.steps.get(position=0).result_ref == task.public_id


def test_a_duplicate_event_executes_the_action_exactly_once(owner):
    """Inbox dedup on `(workspace, source_event_id)`."""
    from apps.automation.models import AutomationRun
    from apps.automation.services import execute_run
    from apps.crm.models import Task

    _rule(owner, name="dedup", actions=[{"action_type": "create_task", "params": {"title": "Once"}}])

    first = _fire(owner, event_id="evt-dup")
    second = _fire(owner, event_id="evt-dup")  # redelivery

    assert len(first) == 1 and len(second) == 1
    assert first[0].pk == second[0].pk
    assert AutomationRun.objects.filter(workspace=owner.workspace).count() == 1

    execute_run(run_id=first[0].pk, actor_context=owner.context)
    execute_run(run_id=first[0].pk, actor_context=owner.context)  # worker retry
    assert Task.objects.filter(workspace=owner.workspace).count() == 1


def test_a_retried_run_does_not_re_execute_a_completed_step(owner):
    from apps.automation.services import execute_run
    from apps.crm.models import Task

    _rule(owner, name="retry", actions=[{"action_type": "create_task", "params": {"title": "Idem"}}])
    run = _fire(owner, event_id="evt-retry")[0]

    for _ in range(3):
        execute_run(run_id=run.pk, actor_context=owner.context)

    assert Task.objects.filter(workspace=owner.workspace).count() == 1
    assert run.steps.count() == 1


def test_loop_prevention_blocks_a_run_beyond_the_reentrancy_bound(owner):
    from apps.automation.models import MAX_RUN_DEPTH
    from apps.automation.services import execute_run
    from apps.crm.models import Task

    _rule(owner, name="loop", actions=[{"action_type": "create_task", "params": {"title": "Loop"}}])
    run = _fire(owner, event_id="evt-deep", depth=MAX_RUN_DEPTH + 1)[0]

    assert run.status == "blocked"
    assert run.failure_code == "loop_depth_exceeded"
    execute_run(run_id=run.pk, actor_context=owner.context)
    # Blocked is TERMINAL: nothing executes, and no task appears.
    assert not Task.objects.filter(workspace=owner.workspace).exists()


def test_conditions_are_evaluated_over_the_event_payload_only(owner):
    from apps.automation.models import AutomationRun

    _rule(
        owner,
        name="conditional",
        conditions=[{"field": "priority", "operator": "eq", "value": "high"}],
    )

    _fire(owner, event_id="evt-low", payload={"priority": "low"})
    assert AutomationRun.objects.filter(workspace=owner.workspace).count() == 0

    _fire(owner, event_id="evt-high", payload={"priority": "high"})
    assert AutomationRun.objects.filter(workspace=owner.workspace).count() == 1


def test_a_paused_rule_does_not_fire(owner):
    from apps.automation.models import AutomationRun
    from apps.automation.services import pause_rule

    rule = _rule(owner, name="pausable")
    pause_rule(context=owner.context, rule=rule)

    _fire(owner, event_id="evt-paused")
    assert AutomationRun.objects.filter(workspace=owner.workspace).count() == 0


def test_a_run_records_which_revision_it_ran(owner):
    """"Why did this fire" stays answerable after the rule is edited."""
    from apps.automation.services import _add_revision, activate_revision

    rule = _rule(owner, name="revisioned")
    original = rule.active_revision
    run = _fire(owner, event_id="evt-rev")[0]
    assert run.revision_id == original.id

    new_revision = _add_revision(
        rule=rule, trigger_type="lead_created",
        actions=[{"action_type": "create_task", "params": {"title": "Changed"}}], conditions=[],
    )
    activate_revision(context=owner.context, rule=rule, revision=new_revision)

    run.refresh_from_db()
    assert run.revision_id == original.id, "an edit rewrote a completed run's history"


# --------------------------------------------------------------------------
# Authority, tenancy and the API.
# --------------------------------------------------------------------------


def test_automation_grants_no_authority_the_actor_lacks(owner):
    """The action runs as a HUMAN, so the target domain's guard decides."""
    from apps.automation.services import execute_run
    from apps.crm.models import Task
    from common.authz import AuthorizationContext
    from common.permissions_catalog import permissions_for_role

    _rule(owner, name="authority", actions=[{"action_type": "create_task",
                                             "params": {"title": "Should not exist"}}])
    run = _fire(owner, event_id="evt-authority")[0]

    powerless = AuthorizationContext(
        user=owner.user, session=None, workspace=owner.workspace, membership=owner.membership,
        role="viewer", permissions=permissions_for_role("viewer") - {"task.manage"},
    )
    execute_run(run_id=run.pk, actor_context=powerless)

    run.refresh_from_db()
    assert run.status == "failed"
    assert run.steps.get(position=0).failure_code == "target_command_refused"
    assert not Task.objects.filter(workspace=owner.workspace).exists()


def test_a_rule_from_another_workspace_is_not_found(actor, owner, auth_client):
    rule = _rule(owner, name="isolated")
    stranger = actor(email="auto-iso@example.test", workspace_name="AutoIso")

    assert auth_client(stranger).get(f"/api/v1/automation/rules/{rule.public_id}").status_code == 404
    assert auth_client(owner).get(f"/api/v1/automation/rules/{rule.public_id}").status_code == 200


def test_an_event_never_fires_another_workspaces_rule(actor, owner):
    from apps.automation.models import AutomationRun

    stranger = actor(email="auto-cross@example.test", workspace_name="AutoCross")
    _rule(owner, name="mine")
    _rule(stranger, name="theirs")

    _fire(owner, event_id="evt-scoped")

    assert AutomationRun.objects.filter(workspace=owner.workspace).count() == 1
    assert AutomationRun.objects.filter(workspace=stranger.workspace).count() == 0


def test_rule_management_requires_the_manage_permission(actor, auth_client):
    member = actor(email="auto-member@example.test", role="member", workspace_name="AutoMember")
    denied = auth_client(member).post(
        "/api/v1/automation/rules",
        {"name": "x", "trigger_type": "lead_created",
         "actions": [{"action_type": "create_task"}]},
        format="json",
    )
    assert denied.status_code == 403
    # A member may still VIEW rules.
    assert auth_client(member).get("/api/v1/automation/rules").status_code == 200


def test_the_approval_queue_surfaces_only_runs_awaiting_a_decision(owner, wa, auth_client):
    conversation = _conversation(owner)
    _rule(
        owner, name="queued", trigger="conversation_received",
        actions=[{"action_type": "send_message",
                  "params": {"conversation_ref": conversation.public_id, "body": "Queued"}}],
    )
    _rule(owner, name="autosafe", actions=[{"action_type": "create_task", "params": {"title": "T"}}])

    _fire(owner, trigger="conversation_received", event_id="evt-q1")
    _fire(owner, trigger="lead_created", event_id="evt-q2")

    body = auth_client(owner).get("/api/v1/automation/runs?awaiting_approval=true").json()
    assert len(body["items"]) == 1
    item = body["items"][0]
    assert item["status"] == "awaiting_approval"
    assert item["steps"][0]["action_type"] == "send_message"
    assert item["approval"]["status"] == "pending"


def test_the_api_renders_the_catalog_tier_not_a_declared_one(owner, auth_client):
    conversation = _conversation(owner)
    rule = _rule(
        owner, name="tiered", trigger="conversation_received",
        actions=[{"action_type": "send_message",
                  "params": {"conversation_ref": conversation.public_id, "body": "x"}}],
    )
    body = auth_client(owner).get(f"/api/v1/automation/rules/{rule.public_id}").json()
    assert body["actions"][0]["safety_tier"] == "approval_required"

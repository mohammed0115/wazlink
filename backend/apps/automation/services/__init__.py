"""automation commands — B7.

Automation reacts to a DOMAIN EVENT and dispatches a GOVERNED COMMAND. It never
mutates another domain's table, and it never carries authority of its own: every
action runs through the owning domain's ordinary command with a real human
actor, so that domain's permission, invariant and concurrency guards all apply
unchanged.

**No automation path reaches a provider send without a human approval**, and
that is structural rather than procedural: `send_message`'s safety tier lives in
the CATALOG, is `approval_required`, and has no per-rule field that could lower
it (`T-AUTO-1`). A run carrying an approval-required step cannot execute until a
member holding `automation.run.approve` decides — and the send then runs as that
member.

**No automation path writes `revenue_events`.** The excluded action list is
enforced by a CHECK constraint, so an excluded action cannot be stored, let
alone scheduled.
"""

from __future__ import annotations

from django.db import IntegrityError, transaction
from django.utils import timezone

from common.audit import write_audit
from common.concurrency import bump_version, lock_aggregate, require_version
from common.errors import DomainConflict, PermissionDeniedError, ValidationFailed
from common.outbox import publish_event

from ..models import (
    ACTION_TIERS,
    ACTION_TYPES,
    EXCLUDED_ACTION_TYPES,
    MAX_RUN_DEPTH,
    RULE_ACTIVE,
    RULE_DRAFT,
    RULE_PAUSED,
    RUN_AWAITING_APPROVAL,
    RUN_BLOCKED,
    RUN_FAILED,
    RUN_PENDING,
    RUN_REJECTED,
    RUN_RUNNING,
    RUN_SUCCEEDED,
    TIER_APPROVAL_REQUIRED,
    TRIGGER_TYPES,
    AutomationAction,
    AutomationApproval,
    AutomationCondition,
    AutomationInboxRecord,
    AutomationRule,
    AutomationRuleRevision,
    AutomationRun,
    AutomationStepRun,
)

FAILURE_DEPTH_EXCEEDED = "loop_depth_exceeded"
FAILURE_COMMAND_REFUSED = "target_command_refused"
FAILURE_UNSUPPORTED = "action_unsupported"


# --------------------------------------------------------------------------
# Rules.
# --------------------------------------------------------------------------


def _validate_definition(trigger_type: str, actions: list[dict]) -> None:
    if trigger_type not in TRIGGER_TYPES:
        raise ValidationFailed(
            "That trigger is not in the automation catalog.", {"trigger_type": trigger_type}
        )
    if not actions:
        raise ValidationFailed("A rule requires at least one action.")

    for action in actions:
        action_type = (action or {}).get("action_type", "")
        if action_type in EXCLUDED_ACTION_TYPES:
            # Named explicitly so the refusal is legible: this is not "unknown
            # action", it is "this action is forbidden to automation".
            raise PermissionDeniedError(
                "That action is permanently excluded from automation."
            )
        if action_type not in ACTION_TYPES:
            raise ValidationFailed(
                "That action is not in the automation catalog.", {"action_type": action_type}
            )
        # A rule author may not declare a safety tier at all. Attempting to is
        # refused rather than ignored, so nobody believes they lowered one.
        if "safety_tier" in (action or {}):
            raise PermissionDeniedError(
                "An action's safety tier is fixed by the catalog and cannot be set per rule."
            )


@transaction.atomic
def create_rule(
    *, context, name: str, trigger_type: str, actions: list[dict], conditions: list[dict] | None = None
) -> AutomationRule:
    """`CreateRule`. Creates the rule and its first revision, inactive."""
    if not (name or "").strip():
        raise ValidationFailed("A rule requires a name.")
    _validate_definition(trigger_type, actions)

    rule = AutomationRule.objects.create(
        workspace=context.workspace,
        name=name.strip()[:120],
        status=RULE_DRAFT,
        created_by=context.membership,
    )
    _add_revision(rule=rule, trigger_type=trigger_type, actions=actions, conditions=conditions or [])

    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="automation.rule_created",
        target_type="automation_rule",
        target_ref=rule.public_id,
        changed_fields=["name", "status"],
    )
    return rule


def _add_revision(*, rule, trigger_type, actions, conditions) -> AutomationRuleRevision:
    latest = rule.revisions.order_by("-revision_no").first()
    revision = AutomationRuleRevision.objects.create(
        rule=rule,
        revision_no=(latest.revision_no + 1) if latest else 1,
        trigger_type=trigger_type,
    )
    for index, action in enumerate(actions):
        AutomationAction.objects.create(
            revision=revision,
            position=index,
            action_type=action["action_type"],
            params=action.get("params") or {},
        )
    for condition in conditions:
        AutomationCondition.objects.create(
            revision=revision,
            field=condition.get("field", "")[:80],
            operator=condition.get("operator", "eq"),
            value={"v": condition.get("value")},
        )
    return revision


@transaction.atomic
def activate_revision(
    *, context, rule: AutomationRule, revision: AutomationRuleRevision | None = None,
    expected_version: int | None = None,
) -> AutomationRule:
    """`ActivateRevision`. Only an active rule's active revision ever fires."""
    require_version(rule, expected_version, required=False)
    lock_aggregate(rule)

    revision = revision or rule.revisions.order_by("-revision_no").first()
    if revision is None or revision.rule_id != rule.id:
        raise ValidationFailed("That revision does not belong to this rule.")

    rule.active_revision = revision
    rule.status = RULE_ACTIVE
    bump_version(rule)
    rule.save(update_fields=["active_revision", "status", "version", "updated_at"])

    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="automation.revision_activated",
        target_type="automation_rule",
        target_ref=rule.public_id,
        changed_fields=["active_revision", "status"],
        metadata={"revision_no": revision.revision_no},
    )
    publish_event(
        workspace=context.workspace,
        event_type="AutomationRuleActivated",
        aggregate_type="automation_rule",
        aggregate_ref=rule.public_id,
        payload={"revision_no": revision.revision_no},
    )
    return rule


@transaction.atomic
def pause_rule(*, context, rule: AutomationRule, expected_version: int | None = None) -> AutomationRule:
    require_version(rule, expected_version, required=False)
    lock_aggregate(rule)
    if rule.status == RULE_PAUSED:
        raise DomainConflict("This rule is already paused.")

    rule.status = RULE_PAUSED
    bump_version(rule)
    rule.save(update_fields=["status", "version", "updated_at"])
    publish_event(
        workspace=context.workspace,
        event_type="AutomationRulePaused",
        aggregate_type="automation_rule",
        aggregate_ref=rule.public_id,
        payload={"status": RULE_PAUSED},
    )
    return rule


# --------------------------------------------------------------------------
# Evaluation — the event consumer.
# --------------------------------------------------------------------------


def _conditions_hold(revision, payload: dict) -> bool:
    """Evaluate over the EVENT payload only.

    Nothing here traverses a live object graph, so a condition cannot reach into
    another domain's secrets or a provider payload.
    """
    for condition in revision.conditions.all():
        actual = (payload or {}).get(condition.field)
        expected = (condition.value or {}).get("v")
        operator = condition.operator
        if operator == "exists":
            if (actual is not None) != bool(expected):
                return False
        elif operator == "eq" and actual != expected:
            return False
        elif operator == "ne" and actual == expected:
            return False
        elif operator == "in" and actual not in (expected or []):
            return False
        elif operator == "contains" and str(expected) not in str(actual or ""):
            return False
        elif operator == "gt" and not (actual is not None and actual > expected):
            return False
        elif operator == "lt" and not (actual is not None and actual < expected):
            return False
    return True


def evaluate_event(
    *, workspace, trigger_type: str, source_event_id: str, payload: dict | None = None, depth: int = 0
) -> list[AutomationRun]:
    """Consume ONE domain event and open a run per eligible rule.

    Dedup happens twice and deliberately: once on the INBOX
    `(workspace, source_event_id)` — this event has been seen — and once per
    rule on `(rule, source_event_id)` — this rule has already run for it. The
    first makes a redelivery cheap; the second is what holds when two workers
    race the same delivery, because the inbox insert of the loser rolls back
    while the winner's run has already committed.
    """
    payload = payload or {}

    if source_event_id:
        try:
            with transaction.atomic():
                AutomationInboxRecord.objects.create(
                    workspace=workspace, source_event_id=source_event_id, trigger_type=trigger_type
                )
        except IntegrityError:
            # Already consumed. Return the runs it produced, so a redelivery is
            # a no-op with an honest answer rather than an empty one.
            return list(
                AutomationRun.objects.filter(workspace=workspace, source_event_id=source_event_id)
            )

    rules = (
        AutomationRule.objects.filter(
            workspace=workspace, status=RULE_ACTIVE, active_revision__trigger_type=trigger_type
        )
        .select_related("active_revision")
        .prefetch_related("active_revision__conditions", "active_revision__actions")
    )

    runs = []
    for rule in rules:
        revision = rule.active_revision
        if not _conditions_hold(revision, payload):
            continue
        run = _open_run(
            rule=rule,
            revision=revision,
            trigger_type=trigger_type,
            source_event_id=source_event_id,
            payload=payload,
            depth=depth,
        )
        if run is not None:
            runs.append(run)
    return runs


def _open_run(*, rule, revision, trigger_type, source_event_id, payload, depth) -> AutomationRun | None:
    try:
        with transaction.atomic():
            run = AutomationRun.objects.create(
                workspace=rule.workspace,
                rule=rule,
                revision=revision,
                trigger_type=trigger_type,
                source_event_id=source_event_id or "",
                entity_ref=str(payload.get("entity_ref") or "")[:60],
                event_payload=payload,
                depth=depth,
                status=RUN_PENDING,
            )
    except IntegrityError:
        # This rule has already run for this event. Exactly once, always.
        return AutomationRun.objects.filter(rule=rule, source_event_id=source_event_id).first()

    # Loop prevention: a run caused by another run's action carries depth+1, and
    # beyond the bound it is BLOCKED rather than executed. Blocking is visible
    # and diagnosable; silently dropping would look like the rule never fired.
    if depth > MAX_RUN_DEPTH:
        AutomationRun.objects.filter(pk=run.pk).update(
            status=RUN_BLOCKED, failure_code=FAILURE_DEPTH_EXCEEDED, finished_at=timezone.now()
        )
        return AutomationRun.objects.get(pk=run.pk)

    for index, action in enumerate(revision.actions.all()):
        AutomationStepRun.objects.create(
            run=run, position=index, action_type=action.action_type, status="pending"
        )

    needs_approval = any(
        ACTION_TIERS.get(action.action_type) == TIER_APPROVAL_REQUIRED
        for action in revision.actions.all()
    )
    if needs_approval:
        AutomationRun.objects.filter(pk=run.pk).update(status=RUN_AWAITING_APPROVAL)
        AutomationApproval.objects.get_or_create(run=run)
        publish_event(
            workspace=rule.workspace,
            event_type="AutomationRunAwaitingApproval",
            aggregate_type="automation_run",
            aggregate_ref=run.public_id,
            payload={"rule_ref": rule.public_id, "trigger_type": trigger_type},
        )
    else:
        publish_event(
            workspace=rule.workspace,
            event_type="AutomationRunStarted",
            aggregate_type="automation_run",
            aggregate_ref=run.public_id,
            payload={"rule_ref": rule.public_id, "trigger_type": trigger_type},
        )
    return AutomationRun.objects.get(pk=run.pk)


# --------------------------------------------------------------------------
# Approval and execution.
# --------------------------------------------------------------------------


@transaction.atomic
def approve_run(
    *, context, run: AutomationRun, reason: str = "", expected_version: int | None = None
) -> AutomationRun:
    """`ApproveRun` — the HUMAN gate.

    The approving member becomes the ACTOR of every governed command the run
    then dispatches, so each target domain's own guard decides whether it may
    proceed. Approval grants permission to proceed; it never grants authority
    the approver lacks.
    """
    if not context.has("automation.run.approve"):
        raise PermissionDeniedError("This operation is not permitted.")

    require_version(run, expected_version, required=False)
    lock_aggregate(run)
    if run.status != RUN_AWAITING_APPROVAL:
        raise DomainConflict(
            "This run is not awaiting approval.",
            {"reason": "run_not_awaiting_approval", "status": run.status},
        )

    approval, _ = AutomationApproval.objects.get_or_create(run=run)
    approval.status = "approved"
    approval.decided_by = context.membership
    approval.decided_at = timezone.now()
    approval.reason = reason
    approval.save(update_fields=["status", "decided_by", "decided_at", "reason", "updated_at"])

    run.status = RUN_RUNNING
    bump_version(run)
    run.save(update_fields=["status", "version", "updated_at"])

    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="automation.run_approved",
        target_type="automation_run",
        target_ref=run.public_id,
        changed_fields=["status"],
    )
    publish_event(
        workspace=context.workspace,
        event_type="AutomationRunApproved",
        aggregate_type="automation_run",
        aggregate_ref=run.public_id,
        payload={"rule_ref": run.rule.public_id},
    )
    # Execution happens after commit, as the approving human.
    transaction.on_commit(lambda: execute_run(run_id=run.pk, actor_context=context))
    return run


@transaction.atomic
def reject_run(
    *, context, run: AutomationRun, reason: str = "", expected_version: int | None = None
) -> AutomationRun:
    if not context.has("automation.run.approve"):
        raise PermissionDeniedError("This operation is not permitted.")
    require_version(run, expected_version, required=False)
    lock_aggregate(run)
    if run.status != RUN_AWAITING_APPROVAL:
        raise DomainConflict(
            "This run is not awaiting approval.",
            {"reason": "run_not_awaiting_approval", "status": run.status},
        )

    approval, _ = AutomationApproval.objects.get_or_create(run=run)
    approval.status = "rejected"
    approval.decided_by = context.membership
    approval.decided_at = timezone.now()
    approval.reason = reason
    approval.save(update_fields=["status", "decided_by", "decided_at", "reason", "updated_at"])

    run.status = RUN_REJECTED
    run.finished_at = timezone.now()
    bump_version(run)
    run.save(update_fields=["status", "finished_at", "version", "updated_at"])
    run.steps.update(status="skipped")

    publish_event(
        workspace=context.workspace,
        event_type="AutomationRunRejected",
        aggregate_type="automation_run",
        aggregate_ref=run.public_id,
        payload={"rule_ref": run.rule.public_id},
    )
    return run


def execute_run(*, run_id, actor_context) -> AutomationRun | None:
    """Execute an APPROVED or auto-safe run. Idempotent; steps run once each.

    `actor_context` is a HUMAN's authorization context. Every governed command
    below runs under it, so a member who may not perform an action cannot obtain
    it by approving a rule that does.
    """
    run = AutomationRun.objects.select_related("rule", "revision", "workspace").filter(pk=run_id).first()
    if run is None or run.is_terminal:
        return run

    # Claim in PostgreSQL: only a pending or approved-and-running run executes,
    # and only one worker may do it.
    with transaction.atomic():
        claimed = (
            AutomationRun.objects.select_for_update()
            .filter(pk=run.pk, status__in=(RUN_PENDING, RUN_RUNNING))
            .first()
        )
        if claimed is None:
            return AutomationRun.objects.get(pk=run.pk)
        # An approval-required run must actually HAVE its approval. This is the
        # second, independent check: the status could in principle be set by
        # some other path, but the approval row cannot be forged by one.
        approval = AutomationApproval.objects.filter(run=claimed).first()
        needs_approval = any(
            ACTION_TIERS.get(step.action_type) == TIER_APPROVAL_REQUIRED for step in claimed.steps.all()
        )
        if needs_approval and (approval is None or approval.status != "approved"):
            return AutomationRun.objects.get(pk=claimed.pk)
        claimed.status = RUN_RUNNING
        claimed.save(update_fields=["status", "updated_at"])
        run = claimed

    failed = False
    for step in run.steps.order_by("position"):
        # Each step claims itself DURABLY, so a retried run — or a second
        # worker — re-executes nothing. The claim must survive the commit that
        # releases the lock, because the governed command runs after it.
        with transaction.atomic():
            step_claim = (
                AutomationStepRun.objects.select_for_update()
                .filter(pk=step.pk, status="pending")
                .first()
            )
            if step_claim is None:
                continue
            step_claim.status = "running"
            step_claim.save(update_fields=["status", "updated_at"])

        action = run.revision.actions.filter(position=step.position).first()
        try:
            result_ref = _dispatch(context=actor_context, run=run, action=action)
            AutomationStepRun.objects.filter(pk=step.pk, status="running").update(
                status="succeeded", result_ref=result_ref or "", updated_at=timezone.now()
            )
        except PermissionDeniedError:
            failed = True
            AutomationStepRun.objects.filter(pk=step.pk, status="running").update(
                status="failed", failure_code=FAILURE_COMMAND_REFUSED, updated_at=timezone.now()
            )
        except Exception:  # noqa: BLE001 - the target domain refused; recorded, not propagated
            failed = True
            AutomationStepRun.objects.filter(pk=step.pk, status="running").update(
                status="failed", failure_code=FAILURE_COMMAND_REFUSED, updated_at=timezone.now()
            )

    with transaction.atomic():
        AutomationRun.objects.filter(pk=run.pk, status=RUN_RUNNING).update(
            status=RUN_FAILED if failed else RUN_SUCCEEDED,
            finished_at=timezone.now(),
            updated_at=timezone.now(),
        )

    final = AutomationRun.objects.get(pk=run.pk)
    publish_event(
        workspace=final.workspace,
        event_type="AutomationRunFailed" if failed else "AutomationRunSucceeded",
        aggregate_type="automation_run",
        aggregate_ref=final.public_id,
        payload={"rule_ref": final.rule.public_id, "status": final.status},
    )
    return final


def _dispatch(*, context, run: AutomationRun, action) -> str:
    """Invoke the ONE governed command this action maps to.

    Every branch calls another domain's ordinary command with the human's
    context. There is no branch that writes a table directly, none that reaches
    a provider directly, and none for an excluded action — an excluded action
    cannot even be stored.
    """
    if action is None:
        raise ValidationFailed("That action is no longer defined.")

    params = action.params or {}
    payload = run.event_payload or {}
    kind = action.action_type

    if kind == "stop_execution":
        return ""

    if kind in ("create_task", "create_followup_task", "escalate_to_manager"):
        if not context.has("task.manage"):
            raise PermissionDeniedError("This operation is not permitted.")
        from apps.crm.services import create_task

        title = params.get("title") or ("Escalation" if kind == "escalate_to_manager" else "Follow up")
        task = create_task(context=context, title=str(title)[:200])
        return task.public_id

    if kind == "create_ticket":
        # `CA-12`. Like every other branch, this calls the owning domain's
        # ordinary command with the human's context and its own permission
        # check — automation grants no authority it did not already have.
        if not context.has("ticket.create"):
            raise PermissionDeniedError("This operation is not permitted.")
        from apps.support.services import create_ticket

        ticket = create_ticket(
            context=context,
            subject=str(params.get("subject") or "Automated ticket")[:250],
            body=str(params.get("body") or ""),
            priority=str(params.get("priority") or "normal"),
            subject_ref=str(payload.get("entity_ref") or "")[:60],
        )
        return ticket.public_id

    if kind in ("change_lead_status", "change_lead_priority", "assign_lead_owner"):
        # Each action carries the permission ITS OWN command requires: B2 gates
        # ownership behind `lead.assign`, which is strictly narrower than
        # `lead.update`. Automation lends no authority it does not hold.
        required = "lead.assign" if kind == "assign_lead_owner" else "lead.update"
        if not context.has(required):
            raise PermissionDeniedError("This operation is not permitted.")
        from apps.crm.models import Lead
        from apps.crm.services import assign_lead_owner, set_lead_priority, set_lead_status

        lead = Lead.objects.filter(
            workspace=run.workspace, public_id=params.get("lead_ref") or payload.get("entity_ref", "")
        ).first()
        if lead is None:
            raise ValidationFailed("That lead is no longer available.")
        if kind == "change_lead_status":
            # `If-Match` captured at execution: the target domain still enforces
            # its own concurrency rule.
            set_lead_status(
                context=context, lead=lead, status=params.get("status", ""),
                expected_version=lead.version,
            )
        elif kind == "change_lead_priority":
            set_lead_priority(
                context=context, lead=lead, priority=params.get("priority", ""),
                expected_version=lead.version,
            )
        else:
            # B2 names `AssignLeadOwner` among the commands Automation may
            # invoke "through the application-service boundary". It runs the
            # SAME command a human PATCH runs, so the active-membership,
            # workspace, archived and `to <> from` guards are re-enforced there
            # rather than restated here. The action stays `approval_required`
            # in the frozen catalogue; delegating does not lower its tier.
            assign_lead_owner(
                context=context, lead=lead, owner_ref=params.get("owner_ref", ""),
                expected_version=lead.version,
            )
        return lead.public_id

    if kind == "move_deal_stage":
        if not context.has("deal.update"):
            raise PermissionDeniedError("This operation is not permitted.")
        from apps.pipeline.models import Deal
        from apps.pipeline.services import move_deal_stage

        deal = Deal.objects.filter(
            workspace=run.workspace, public_id=params.get("deal_ref") or payload.get("entity_ref", "")
        ).first()
        if deal is None:
            raise ValidationFailed("That deal is no longer available.")
        move_deal_stage(
            context=context, deal=deal, stage_ref=params.get("to_stage_ref", ""),
            expected_version=deal.version,
        )
        return deal.public_id

    if kind == "send_message":
        # Reachable ONLY after a human approval — the tier is approval_required
        # in the catalog and cannot be lowered. The send then runs through
        # messaging's UNMODIFIED admission sequence as the approving human, so
        # `message.send`, consent and the service window are all re-enforced
        # there. Automation adds no transport and no exemption.
        if not context.has("message.send"):
            raise PermissionDeniedError("This operation is not permitted.")
        from apps.messaging.models import Conversation
        from apps.messaging.services import send_message

        conversation = Conversation.objects.filter(
            workspace=run.workspace,
            public_id=params.get("conversation_ref") or payload.get("conversation_ref", ""),
        ).first()
        if conversation is None:
            raise ValidationFailed("That conversation is no longer available.")
        message = send_message(
            context=context, conversation=conversation, body=params.get("body", "")
        )
        return message.public_id

    if kind == "schedule_appointment":
        if not context.has("appointment.manage"):
            raise PermissionDeniedError("This operation is not permitted.")
        from apps.crm.services import create_appointment

        appointment = create_appointment(
            context=context,
            title=str(params.get("title") or "Appointment")[:200],
            starts_at=params.get("starts_at"),
            ends_at=params.get("ends_at"),
        )
        return appointment.public_id

    raise ValidationFailed(FAILURE_UNSUPPORTED)


def safety_tier_for(action_type: str) -> str:
    """The catalog's answer. There is no per-rule override to consult."""
    if action_type in EXCLUDED_ACTION_TYPES:
        raise PermissionDeniedError("That action is permanently excluded from automation.")
    if action_type not in ACTION_TIERS:
        raise ValidationFailed("That action is not in the automation catalog.")
    return ACTION_TIERS[action_type]


__all__ = [
    "create_rule",
    "activate_revision",
    "pause_rule",
    "evaluate_event",
    "approve_run",
    "reject_run",
    "execute_run",
    "safety_tier_for",
    "MAX_RUN_DEPTH",
]

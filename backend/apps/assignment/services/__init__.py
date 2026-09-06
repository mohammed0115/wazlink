"""assignment commands — UpsertAssignmentRule and the round-robin advance."""

from __future__ import annotations

from django.db import transaction

from common.audit import write_audit
from common.concurrency import bump_version, require_version
from common.errors import EntityNotFound, ValidationFailed

from ..models import STRATEGIES, STRATEGY_ROUND_ROBIN, AssignmentCounter, AssignmentRule


@transaction.atomic
def upsert_assignment_rule(
    *,
    context,
    name: str,
    member_refs: list[str],
    strategy: str = STRATEGY_ROUND_ROBIN,
    position: int = 0,
    active: bool = True,
    rule: AssignmentRule | None = None,
    expected_version: int | None = None,
) -> AssignmentRule:
    if not (name or "").strip():
        raise ValidationFailed("An assignment rule requires a name.")
    if strategy not in STRATEGIES:
        raise ValidationFailed("That assignment strategy is not supported.")

    members = [ref.strip() for ref in (member_refs or []) if (ref or "").strip()]
    if not members:
        raise ValidationFailed("An assignment rule requires at least one member.")

    # Every candidate must be an ACTIVE membership of THIS workspace. Validating
    # here rather than at assignment time means a rule can never quietly route
    # to somebody who has left.
    from apps.workspaces.models import Membership

    known = set(
        Membership.objects.filter(
            workspace=context.workspace, public_id__in=members, status="active"
        ).values_list("public_id", flat=True)
    )
    unknown = [ref for ref in members if ref not in known]
    if unknown:
        raise ValidationFailed(
            "Every assignment member must be an active member of this workspace.",
            {"unknown": unknown},
        )

    if rule is None:
        rule = AssignmentRule.objects.create(
            workspace=context.workspace,
            name=name.strip()[:120],
            strategy=strategy,
            member_refs=members,
            position=position,
            active=active,
        )
        AssignmentCounter.objects.create(rule=rule)
        action = "assignment.rule_created"
    else:
        require_version(rule, expected_version, required=False)
        rule.name = name.strip()[:120]
        rule.strategy = strategy
        rule.member_refs = members
        rule.position = position
        rule.active = active
        bump_version(rule)
        rule.save(
            update_fields=["name", "strategy", "member_refs", "position", "active", "version", "updated_at"]
        )
        AssignmentCounter.objects.get_or_create(rule=rule)
        action = "assignment.rule_updated"

    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action=action,
        target_type="assignment_rule",
        target_ref=rule.public_id,
        changed_fields=["name", "strategy", "member_refs", "active"],
    )
    return rule


def next_assignee_ref(*, workspace, subject_kind: str = "conversation") -> str | None:
    """Advance the round robin and return the chosen membership's public id.

    MUST be called inside the caller's transaction. The counter row is taken
    under `SELECT ... FOR UPDATE`, so two conversations arriving at the same
    instant serialize here and receive DIFFERENT assignees. An in-memory
    counter, or a Redis one, would hand both to the same person — which is the
    precise fairness failure round robin exists to prevent.

    Returns None when no rule applies. That is not an error: an unrouted
    conversation is simply unassigned, and a human picks it up.
    """
    rule = (
        AssignmentRule.objects.filter(workspace=workspace, subject_kind=subject_kind, active=True)
        .order_by("position", "created_at")
        .first()
    )
    if rule is None or not rule.member_refs:
        return None

    if rule.strategy != STRATEGY_ROUND_ROBIN:
        return rule.member_refs[0]

    counter, _ = AssignmentCounter.objects.get_or_create(rule=rule)
    locked = AssignmentCounter.objects.select_for_update().get(pk=counter.pk)
    chosen = rule.member_refs[locked.cursor % len(rule.member_refs)]
    locked.cursor += 1
    locked.save(update_fields=["cursor", "updated_at"])
    return chosen


def resolve_rule(*, workspace, rule_ref: str) -> AssignmentRule:
    rule = AssignmentRule.objects.filter(workspace=workspace, public_id=rule_ref).first()
    if rule is None:
        raise EntityNotFound("The requested resource was not found.")
    return rule


__all__ = ["upsert_assignment_rule", "next_assignee_ref", "resolve_rule"]

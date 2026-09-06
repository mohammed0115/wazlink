"""automation read models — rules, runs and the approval queue."""

from __future__ import annotations

from ..models import ACTION_TIERS, AutomationRule, AutomationRun


def rules_for(workspace):
    return AutomationRule.objects.filter(workspace=workspace).select_related("active_revision")


def runs_for(workspace):
    return AutomationRun.objects.filter(workspace=workspace).select_related("rule", "revision")


def approval_queue(workspace):
    """Runs a human must decide on.

    This is the ONLY route to an approval-tier action, so an empty queue means
    nothing is waiting to act.
    """
    return runs_for(workspace).filter(status="awaiting_approval").order_by("created_at")


def rule_payload(rule: AutomationRule) -> dict:
    revision = rule.active_revision or rule.revisions.order_by("-revision_no").first()
    return {
        "rule_ref": rule.public_id,
        "name": rule.name,
        "status": rule.status,
        "active_revision_no": rule.active_revision.revision_no if rule.active_revision_id else None,
        "trigger_type": revision.trigger_type if revision else None,
        "actions": [
            {
                "action_type": action.action_type,
                "position": action.position,
                "params": action.params,
                # Rendered from the CATALOG, so a client shows the real tier and
                # not something a rule author declared.
                "safety_tier": ACTION_TIERS.get(action.action_type),
            }
            for action in (revision.actions.all() if revision else [])
        ],
        "version": rule.version,
    }


def run_payload(run: AutomationRun) -> dict:
    approval = getattr(run, "approval", None)
    return {
        "run_ref": run.public_id,
        "rule_ref": run.rule.public_id,
        "trigger_type": run.trigger_type,
        "status": run.status,
        "entity_ref": run.entity_ref or None,
        "depth": run.depth,
        "failure_code": run.failure_code or None,
        "approval": (
            {
                "status": approval.status,
                "decided_by_ref": approval.decided_by.public_id if approval.decided_by_id else None,
                "decided_at": approval.decided_at,
            }
            if approval
            else None
        ),
        "steps": [
            {
                "position": step.position,
                "action_type": step.action_type,
                "status": step.status,
                "result_ref": step.result_ref or None,
                "failure_code": step.failure_code or None,
            }
            for step in run.steps.order_by("position")
        ],
        "version": run.version,
    }


__all__ = ["rules_for", "runs_for", "approval_queue", "rule_payload", "run_payload"]

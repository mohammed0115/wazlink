"""assignment read models."""

from __future__ import annotations

from ..models import AssignmentRule


def rules_for(workspace):
    return AssignmentRule.objects.filter(workspace=workspace).order_by("position", "created_at")


def rule_payload(rule: AssignmentRule) -> dict:
    return {
        "rule_ref": rule.public_id,
        "name": rule.name,
        "subject_kind": rule.subject_kind,
        "strategy": rule.strategy,
        "member_refs": rule.member_refs,
        "active": rule.active,
        "position": rule.position,
        "version": rule.version,
    }


__all__ = ["rules_for", "rule_payload"]

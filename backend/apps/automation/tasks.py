"""automation Celery tasks.

Queue `default`: automation never calls a provider directly, so it has no place
on a `providers.*` queue. A message action routes through `messaging` AFTER a
human approval, and pays messaging's own queue cost there.
"""

from __future__ import annotations

from celery import shared_task


@shared_task(name="automation.evaluate_automation_event", queue="default", bind=True)
def evaluate_automation_event_task(
    self, workspace_id: str, trigger_type: str, source_event_id: str, payload: dict | None = None
):
    """Consume one domain event. Deduped on `(workspace_id, source_event_id)`.

    A redelivered event opens no second run: the inbox constraint absorbs it,
    and the per-rule run constraint absorbs a racing worker.
    """
    from apps.workspaces.models import Workspace

    from .services import evaluate_event

    workspace = Workspace.objects.filter(pk=workspace_id).first()
    if workspace is None:
        return {"runs": 0}
    runs = evaluate_event(
        workspace=workspace,
        trigger_type=trigger_type,
        source_event_id=source_event_id,
        payload=payload or {},
    )
    return {"runs": len(runs)}


__all__ = ["evaluate_automation_event_task"]

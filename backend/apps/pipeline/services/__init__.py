"""pipeline commands — Deals.

REVENUE FIREWALL: closing a Deal Won writes NOTHING to revenue. No
RevenueEvent, no reversal and no attribution row is created here, ever. This
module does not import apps.revenue and cannot: they share layer L7.
"""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from common.audit import write_audit
from common.concurrency import bump_version, require_version
from common.errors import DomainConflict, EntityNotFound, ValidationFailed
from common.outbox import publish_event

from ..models import Deal, Pipeline, PipelineStage

DEFAULT_STAGES = [
    ("New", 0, Decimal("0.10")),
    ("Qualified", 1, Decimal("0.30")),
    ("Proposal", 2, Decimal("0.60")),
    ("Negotiation", 3, Decimal("0.80")),
    ("Closed", 4, Decimal("1.00")),
]


@transaction.atomic
def ensure_default_pipeline(*, workspace) -> Pipeline:
    """Seed the workspace's default pipeline and its stages, idempotently."""
    pipeline = Pipeline.objects.filter(workspace=workspace, is_default=True).first()
    if pipeline is not None:
        return pipeline
    pipeline = Pipeline.objects.create(workspace=workspace, name="Default Pipeline", is_default=True)
    for name, position, probability in DEFAULT_STAGES:
        PipelineStage.objects.create(
            workspace=workspace,
            pipeline=pipeline,
            name=name,
            position=position,
            probability=probability,
            is_terminal=(position == len(DEFAULT_STAGES) - 1),
        )
    return pipeline


def _to_decimal(raw) -> Decimal:
    try:
        value = Decimal(str(raw if raw not in (None, "") else "0"))
    except (InvalidOperation, TypeError):
        raise ValidationFailed("The deal value must be a number.") from None
    if value < 0:
        raise ValidationFailed("The deal value cannot be negative.")
    return value


@transaction.atomic
def create_deal(
    *,
    context,
    title: str,
    lead=None,
    customer=None,
    value=0,
    currency: str = "SAR",
    pipeline: Pipeline | None = None,
    stage: PipelineStage | None = None,
    owner_membership=None,
) -> Deal:
    if not (title or "").strip():
        raise ValidationFailed("A deal title is required.")
    if lead is None and customer is None:
        raise ValidationFailed("A deal requires a lead or a customer.")

    pipeline = pipeline or ensure_default_pipeline(workspace=context.workspace)
    stage = stage or pipeline.stages.order_by("position").first()
    if stage is None:
        raise ValidationFailed("This pipeline has no stages.")
    if stage.pipeline_id != pipeline.id:
        raise ValidationFailed("That stage does not belong to that pipeline.")

    deal = Deal.objects.create(
        workspace=context.workspace,
        lead=lead,
        customer=customer,
        pipeline=pipeline,
        stage=stage,
        title=title.strip(),
        value=_to_decimal(value),
        currency=(currency or "SAR")[:3].upper(),
        owner_membership=owner_membership or context.membership,
    )
    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="deal.created",
        target_type="deal",
        target_ref=deal.public_id,
        changed_fields=["title", "value", "stage"],
    )
    publish_event(
        workspace=context.workspace,
        event_type="DealCreated",
        aggregate_type="deal",
        aggregate_ref=deal.public_id,
        payload={"stage": stage.name},
    )
    return deal


@transaction.atomic
def move_deal_stage(*, context, deal: Deal, stage_ref: str, expected_version: int | None) -> Deal:
    if deal.status != "open":
        raise DomainConflict("A closed deal cannot change stage.", {"status": deal.status})
    require_version(deal, expected_version)

    stage = PipelineStage.objects.filter(
        workspace=context.workspace, pipeline=deal.pipeline, public_id=stage_ref
    ).first()
    if stage is None:
        raise EntityNotFound("The requested resource was not found.")

    before = deal.stage.name
    deal.stage = stage
    bump_version(deal)
    deal.save(update_fields=["stage", "version", "updated_at"])

    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="deal.stage_changed",
        target_type="deal",
        target_ref=deal.public_id,
        changed_fields=["stage"],
        metadata={"before": before, "after": stage.name},
    )
    publish_event(
        workspace=context.workspace,
        event_type="DealStageChanged",
        aggregate_type="deal",
        aggregate_ref=deal.public_id,
        payload={"before": before, "after": stage.name},
    )
    return deal


@transaction.atomic
def close_deal(
    *, context, deal: Deal, outcome: str, loss_reason: str = "", expected_version: int | None = None
) -> Deal:
    """CloseDeal.

    WON DEAL != RECOGNIZED REVENUE. This command writes no revenue_events row,
    no reversal and no attribution touchpoint. Recognizing revenue is
    RecordRevenueEvent's job alone, and it is human-gated in the revenue
    domain (B9-D-A021).
    """
    if outcome not in ("won", "lost"):
        raise ValidationFailed("A deal is closed as 'won' or 'lost'.")
    if deal.status != "open":
        raise DomainConflict("This deal is already closed.", {"status": deal.status})
    if outcome == "lost" and not (loss_reason or "").strip():
        raise ValidationFailed("A lost deal requires a loss reason.")
    require_version(deal, expected_version)

    deal.status = outcome
    deal.loss_reason = (loss_reason or "").strip() if outcome == "lost" else ""
    deal.closed_at = timezone.now()
    bump_version(deal)
    deal.save(update_fields=["status", "loss_reason", "closed_at", "version", "updated_at"])

    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action=f"deal.closed_{outcome}",
        target_type="deal",
        target_ref=deal.public_id,
        changed_fields=["status", "closed_at"],
    )
    # The event announces the deal outcome. It is NOT a revenue signal and no
    # consumer may treat it as one.
    publish_event(
        workspace=context.workspace,
        event_type="DealWon" if outcome == "won" else "DealLost",
        aggregate_type="deal",
        aggregate_ref=deal.public_id,
        payload={"status": outcome},
    )
    return deal


__all__ = [
    "ensure_default_pipeline",
    "create_deal",
    "move_deal_stage",
    "close_deal",
]

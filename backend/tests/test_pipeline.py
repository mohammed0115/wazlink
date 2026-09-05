"""B6 Pipeline / Deal behaviour."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.django_db


@pytest.fixture
def deal_for(actor):
    def _make(a, **kwargs):
        from apps.customers.services import create_customer
        from apps.pipeline.services import create_deal

        customer = create_customer(context=a.context, party_kind="organization", name="Northwind")
        return create_deal(
            context=a.context, title="Renewal", customer=customer, value=kwargs.get("value", 1000)
        )

    return _make


def test_default_pipeline_is_seeded_idempotently(actor):
    from apps.pipeline.models import Pipeline, PipelineStage
    from apps.pipeline.services import ensure_default_pipeline

    a = actor()
    first = ensure_default_pipeline(workspace=a.workspace)
    second = ensure_default_pipeline(workspace=a.workspace)
    assert first.id == second.id
    assert Pipeline.objects.filter(workspace=a.workspace).count() == 1
    assert PipelineStage.objects.filter(pipeline=first).count() == 5


def test_deal_requires_a_subject(actor):
    from apps.pipeline.services import create_deal
    from common.errors import ValidationFailed

    a = actor()
    with pytest.raises(ValidationFailed):
        create_deal(context=a.context, title="Orphan", value=100)


def test_stage_move_is_version_guarded(actor, deal_for):
    from apps.pipeline.models import PipelineStage
    from apps.pipeline.services import move_deal_stage
    from common.errors import StaleVersion

    a = actor()
    deal = deal_for(a)
    stage = PipelineStage.objects.filter(pipeline=deal.pipeline, position=2).first()

    with pytest.raises(StaleVersion):
        move_deal_stage(context=a.context, deal=deal, stage_ref=stage.public_id, expected_version=999)

    version_before = deal.version
    moved = move_deal_stage(
        context=a.context, deal=deal, stage_ref=stage.public_id, expected_version=version_before
    )
    assert moved.stage_id == stage.id
    assert moved.version == version_before + 1

    # And the bump is durable, not just in memory.
    moved.refresh_from_db()
    assert moved.version == version_before + 1


def test_closed_deal_cannot_change_stage(actor, deal_for):
    from apps.pipeline.models import PipelineStage
    from apps.pipeline.services import close_deal, move_deal_stage
    from common.errors import DomainConflict

    a = actor()
    deal = deal_for(a)
    deal = close_deal(context=a.context, deal=deal, outcome="won", expected_version=deal.version)
    stage = PipelineStage.objects.filter(pipeline=deal.pipeline, position=3).first()
    with pytest.raises(DomainConflict):
        move_deal_stage(
            context=a.context, deal=deal, stage_ref=stage.public_id, expected_version=deal.version
        )


def test_lost_deal_requires_a_loss_reason(actor, deal_for):
    from apps.pipeline.services import close_deal
    from common.errors import ValidationFailed

    a = actor()
    deal = deal_for(a)
    with pytest.raises(ValidationFailed):
        close_deal(context=a.context, deal=deal, outcome="lost", expected_version=deal.version)

    closed = close_deal(
        context=a.context, deal=deal, outcome="lost", loss_reason="Budget cut", expected_version=deal.version
    )
    assert closed.status == "lost"
    assert closed.loss_reason == "Budget cut"


def test_deal_cannot_be_closed_twice(actor, deal_for):
    from apps.pipeline.services import close_deal
    from common.errors import DomainConflict

    a = actor()
    deal = deal_for(a)
    deal = close_deal(context=a.context, deal=deal, outcome="won", expected_version=deal.version)
    with pytest.raises(DomainConflict):
        close_deal(context=a.context, deal=deal, outcome="won", expected_version=deal.version)


def test_deal_close_is_gated_above_ordinary_update(actor, auth_client, deal_for):
    """deal.close is denied to member; deal.update is conditional for member."""
    from common.permissions_catalog import cell

    assert cell("deal.close", "member") == "."
    assert cell("deal.update", "member") == "C"
    assert cell("deal.close", "sales") == "C"


def test_weighted_value_tracks_stage_probability(actor, deal_for):
    from decimal import Decimal

    from apps.pipeline.models import PipelineStage
    from apps.pipeline.services import move_deal_stage

    a = actor()
    deal = deal_for(a, value=1000)
    # Stage 0 has probability 0.10.
    assert deal.weighted_value == Decimal("100.00")

    stage = PipelineStage.objects.filter(pipeline=deal.pipeline, position=3).first()
    deal = move_deal_stage(
        context=a.context, deal=deal, stage_ref=stage.public_id, expected_version=deal.version
    )
    assert deal.weighted_value == Decimal("800.00")

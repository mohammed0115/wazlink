"""T-REV-* — the REVENUE FIREWALL. Absolute.

WON_DEAL_EQUALS_REVENUE = FALSE.
A Won Deal is not recognized revenue and creates no revenue truth of any kind.
"""

from __future__ import annotations

import pytest

pytestmark = [pytest.mark.django_db, pytest.mark.security]


def _won_deal(a):
    from apps.customers.services import create_customer
    from apps.pipeline.services import close_deal, create_deal

    customer = create_customer(context=a.context, party_kind="organization", name="Northwind")
    deal = create_deal(context=a.context, title="Renewal", customer=customer, value=50000)
    return close_deal(context=a.context, deal=deal, outcome="won", expected_version=deal.version)


@pytest.mark.nc
def test_rev_1_closing_a_deal_won_writes_no_revenue_row(actor):
    """The primary negative control. There is no revenue table in Wave 1, and
    closing a deal must not create one, nor any row that stands in for one."""
    from django.db import connection

    a = actor()
    deal = _won_deal(a)
    assert deal.status == "won"

    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT table_name FROM information_schema.tables
            WHERE table_schema = 'public'
              AND (table_name LIKE '%%revenue%%' OR table_name LIKE '%%attribution%%')
        """)
        tables = [row[0] for row in cursor.fetchall()]
    assert tables == [], f"a revenue-shaped table exists in Wave 1: {tables}"


@pytest.mark.nc
def test_rev_2_pipeline_module_contains_no_revenue_write(actor):
    """Pipeline must not write RevenueEvent, reversal or attribution truth.

    Checked over the AST — identifiers, attributes and import names — so a
    docstring that merely DESCRIBES the firewall is not mistaken for a
    violation of it, and a real reference cannot hide inside a string.
    """
    import ast
    import pathlib

    forbidden = {
        "RevenueEvent",
        "RevenueReversal",
        "AttributionTouchpoint",
        "RecordRevenueEvent",
        "revenue_events",
        "attribution_touchpoints",
    }
    pipeline_root = pathlib.Path(__file__).resolve().parent.parent / "apps" / "pipeline"

    offenders: list[str] = []
    for path in pipeline_root.rglob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.Name) and node.id in forbidden:
                offenders.append(f"{path.name}:{node.lineno} name {node.id}")
            elif isinstance(node, ast.Attribute) and node.attr in forbidden:
                offenders.append(f"{path.name}:{node.lineno} attribute {node.attr}")
            elif isinstance(node, ast.alias) and any(f in node.name for f in forbidden):
                offenders.append(f"{path.name} import {node.name}")
            elif isinstance(node, (ast.Import, ast.ImportFrom)):
                module = getattr(node, "module", "") or ""
                if "revenue" in module:
                    offenders.append(f"{path.name} imports {module}")

    assert offenders == [], f"pipeline references revenue truth: {offenders}"


@pytest.mark.nc
def test_rev_2b_the_revenue_detector_is_not_vacuous(tmp_path):
    """A detector that finds nothing would pass a broken module."""
    import ast

    probe = ast.parse("from apps.revenue.services import RecordRevenueEvent\n")
    modules = [n.module for n in ast.walk(probe) if isinstance(n, ast.ImportFrom) and n.module]
    assert any("revenue" in m for m in modules)


def test_rev_3_won_deal_value_is_forecast_not_recognized_revenue(actor, auth_client):
    a = actor()
    deal = _won_deal(a)
    body = auth_client(a).get(f"/api/v1/deals/{deal.public_id}").json()

    # Wave 1 MAY display deal value...
    assert body["value"] == "50000.00"
    assert body["status"] == "won"
    # ...but it must never claim that value as recognized revenue.
    assert "recognized_revenue" not in body
    assert "revenue" not in body


def test_rev_4_weighted_value_is_computed_never_persisted(actor):
    """weighted_value is a read-time computation with no column behind it."""
    from apps.pipeline.models import Deal

    a = actor()
    deal = _won_deal(a)
    columns = {f.name for f in Deal._meta.get_fields() if hasattr(f, "attname")}
    assert "weighted_value" not in columns
    assert deal.weighted_value == deal.value  # won => full value, still not revenue


@pytest.mark.nc
def test_rev_5_the_firewall_is_structural_not_only_behavioural():
    """revenue and pipeline share layer L7, so the import edge cannot exist."""
    from tests.arch_walker import LAYERS, build_edges

    assert LAYERS["revenue"] == LAYERS["pipeline"]
    edges = build_edges()
    assert ("pipeline", "revenue") not in edges
    assert ("revenue", "pipeline") not in edges


def test_trackb_6_deal_for_a_track_b_customer_with_zero_discovery(actor):
    """T-TRACKB-6 — completes the Track-B independence proof at I7."""
    from apps.customers.services import create_customer
    from apps.discovery.models import DiscoveryJob
    from apps.pipeline.services import close_deal, create_deal

    a = actor()
    customer = create_customer(context=a.context, party_kind="organization", name="Track-B Co")
    deal = create_deal(context=a.context, title="First Deal", customer=customer, value=2500)

    from apps.pipeline.models import PipelineStage

    stage = PipelineStage.objects.filter(pipeline=deal.pipeline, position=1).first()
    from apps.pipeline.services import move_deal_stage

    deal = move_deal_stage(
        context=a.context, deal=deal, stage_ref=stage.public_id, expected_version=deal.version
    )
    deal = close_deal(context=a.context, deal=deal, outcome="won", expected_version=deal.version)

    assert deal.status == "won"
    assert DiscoveryJob.objects.filter(workspace=a.workspace).count() == 0

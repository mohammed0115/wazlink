"""T-ARCH-1 / T-P360-12 / T-P360-16 — the class A dependency DAG.

Hard requirements, with NO exception list (W-9):
    SAME_LAYER_EDGE_COUNT  = 0
    UPWARD_EDGE_COUNT      = 0
    MODULE_DAG_CYCLE_COUNT = 0
"""

from __future__ import annotations

import pytest

from .arch_walker import LAYERS, build_edges, classify, discover_modules


def test_arch_1_dag_is_acyclic_and_layer_respecting():
    """T-ARCH-1 — the real tree. Every edge points strictly downward."""
    result = classify(build_edges())

    assert result["same_layer"] == [], f"SAME_LAYER edges found: {result['same_layer']}"
    assert result["upward"] == [], f"UPWARD edges found: {result['upward']}"
    assert result["cycles"] == [], f"Cycles found: {result['cycles']}"


def test_every_installed_module_has_a_layer():
    """A module with no declared layer could not be checked at all."""
    for module in discover_modules():
        assert module in LAYERS, f"module {module!r} has no declared layer"


def test_crm_imports_neither_messaging_nor_pipeline():
    """The N-09 invariant, asserted directly on the real tree."""
    edges = build_edges()
    assert ("crm", "messaging") not in edges
    assert ("crm", "pipeline") not in edges


def test_analytics_is_imported_by_no_app():
    """B14_03 §6 rule 5. analytics hosts the composers; an app importing it
    would invert the composition boundary."""
    edges = build_edges()
    importers = [source for source, target in edges if target == "analytics"]
    assert importers == [], f"apps importing analytics: {importers}"


def test_revenue_firewall_is_structural():
    """revenue and pipeline are both L7, so neither can import the other."""
    assert LAYERS["revenue"] == LAYERS["pipeline"] == 7
    edges = build_edges()
    assert ("pipeline", "revenue") not in edges
    assert ("revenue", "pipeline") not in edges


# --------------------------------------------------------------------------
# NEGATIVE CONTROLS. A walker that passes these mutations is itself the defect.
# --------------------------------------------------------------------------


@pytest.mark.nc
@pytest.mark.parametrize("target", ["messaging", "pipeline"])
def test_p360_16_walker_fails_on_injected_crm_edge(target):
    """T-P360-16 (NC) — inject a DIRECT crm -> messaging and, separately, a
    direct crm -> pipeline selector import in place of the registry call.

    The walker must FAIL and NAME the offending edge. This is the control that
    would have caught N-09.
    """
    injected = {"crm": f"from apps.{target}.selectors import something\n"}
    result = classify(build_edges(extra_source=injected))

    offending = result["upward"] + result["same_layer"]
    assert ("crm", target) in offending, f"the walker did not flag the injected crm -> {target} edge"
    # And it must be reported as UPWARD specifically (crm L5 -> L6/L7).
    assert ("crm", target) in result["upward"]


@pytest.mark.nc
def test_p360_12_walker_fails_on_same_layer_edge():
    """T-ARCH-1a (NC) — a same-layer edge must fail just as an upward one does."""
    injected = {"revenue": "from apps.pipeline.selectors import board\n"}
    result = classify(build_edges(extra_source=injected))
    assert ("revenue", "pipeline") in result["same_layer"]


@pytest.mark.nc
def test_walker_detects_a_cycle():
    """W-8 — a cycle must be reported, not silently tolerated."""
    injected = {
        "crm": "from apps.customers.selectors import x\n",  # crm(5) -> customers(6): upward
    }
    result = classify(build_edges(extra_source=injected))
    # customers -> crm already exists legitimately, so this closes a cycle.
    assert result["cycles"], "an injected back-edge did not produce a detected cycle"


@pytest.mark.nc
def test_walker_is_not_vacuous():
    """A walker that finds no edges at all would pass everything."""
    edges = build_edges()
    assert len(edges) >= 5, "the walker found implausibly few edges — it may be vacuous"
    assert ("customers", "crm") in edges, "a known-legitimate edge is missing"

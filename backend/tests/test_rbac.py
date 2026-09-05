"""T-RBAC-* — the six frozen workspace roles and the permission matrix."""

from __future__ import annotations

import pytest

from common.permissions_catalog import (
    ALL_PERMISSIONS,
    ALLOW,
    CONDITIONAL,
    DEFERRED_PERMISSIONS,
    DENY,
    WORKSPACE_ROLE_COUNT,
    WORKSPACE_ROLES,
    cell,
    grants,
    permissions_for_role,
)


def test_rbac_1_exactly_six_workspace_roles():
    """WORKSPACE_ROLE_COUNT must remain 6. There is no role #7."""
    assert WORKSPACE_ROLE_COUNT == 6
    assert WORKSPACE_ROLES == ("owner", "admin", "manager", "sales", "member", "viewer")


def test_rbac_2_platform_operator_is_not_a_workspace_role():
    """Platform Operator belongs to the B13 platform namespace and is never a
    memberships.role value. Conflating the two produced V-03."""
    assert "operator" not in WORKSPACE_ROLES
    assert "platform_operator" not in WORKSPACE_ROLES


def test_rbac_3_every_permission_has_an_explicit_cell_for_all_six_roles():
    """No blank, no inherited value, no 'not applicable'."""
    for permission in ALL_PERMISSIONS:
        for role in WORKSPACE_ROLES:
            assert cell(permission, role) in (ALLOW, CONDITIONAL, DENY), (
                f"{permission} x {role} has no explicit cell"
            )


def test_rbac_4_no_rank_inheritance():
    """Owner does not INHERIT from admin; every owner cell is an explicit grant.
    The matrix is consulted directly, never composed from ranks."""
    # A permission where owner is allow and admin is conditional proves the
    # cells are independent rather than derived from rank ordering.
    assert cell("subscription.change", "owner") == ALLOW
    assert cell("subscription.change", "admin") == CONDITIONAL
    assert cell("workspace.suspend", "owner") == ALLOW
    assert cell("workspace.suspend", "admin") == DENY


def test_rbac_5_frozen_b1_cells_are_reproduced_exactly():
    """A spot-check of frozen B1 rows, verbatim from the frozen matrix."""
    expected = {
        "lead.view": (ALLOW, ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL),
        "lead.create": (ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY),
        "lead.assign": (ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY, DENY),
        "deal.close": (ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY, DENY),
        "audit.view": (ALLOW, ALLOW, DENY, DENY, DENY, DENY),
        "ai.use": (ALLOW, ALLOW, ALLOW, CONDITIONAL, CONDITIONAL, DENY),
    }
    for permission, row in expected.items():
        actual = tuple(cell(permission, role) for role in WORKSPACE_ROLES)
        assert actual == row, f"{permission} cells drifted: {actual} != {row}"


def test_rbac_6_customer_view_mirrors_lead_view_exactly():
    """V-M07: Sales must not have narrower access to Customers than to Leads,
    and Viewer must not have broader."""
    for permission in ("customer.view", "contact.view", "ticket.view", "knowledge.view", "quote.view"):
        assert tuple(cell(permission, r) for r in WORKSPACE_ROLES) == tuple(
            cell("lead.view", r) for r in WORKSPACE_ROLES
        ), permission


def test_rbac_7_no_member_cell_exceeds_the_frozen_cell_it_mirrors():
    """member is an active operational role, never more permissive than its
    frozen mirror."""
    mirrors = {
        "customer.create": "lead.create",
        "customer.update": "lead.update",
        "contact.manage": "lead.update",
        "customer.assign": "lead.assign",
    }
    strength = {DENY: 0, CONDITIONAL: 1, ALLOW: 2}
    for new, frozen in mirrors.items():
        assert strength[cell(new, "member")] <= strength[cell(frozen, "member")], new


def test_rbac_8_administrative_permissions_deny_member_and_viewer():
    for permission in (
        "customer.archive",
        "customer.merge",
        "import.manage",
        "customfield.manage",
        "assignment.manage",
        "agent.manage",
    ):
        assert cell(permission, "member") == DENY, permission
        assert cell(permission, "viewer") == DENY, permission


def test_viewer_holds_no_write_permission():
    viewer = permissions_for_role("viewer")
    for permission in (
        "lead.create",
        "lead.update",
        "customer.create",
        "deal.create",
        "deal.close",
        "import.manage",
    ):
        assert permission not in viewer, permission


def test_deferred_permissions_are_registered_but_not_wave1():
    assert DEFERRED_PERMISSIONS <= set(ALL_PERMISSIONS)
    assert "quote.accept" in DEFERRED_PERMISSIONS
    assert "form.manage" in DEFERRED_PERMISSIONS


@pytest.mark.nc
def test_unknown_permission_or_role_fails_closed():
    """An unknown pair must DENY, never allow."""
    assert cell("does.not.exist", "owner") == DENY
    assert cell("lead.view", "superuser") == DENY
    assert grants("does.not.exist", "owner") is False

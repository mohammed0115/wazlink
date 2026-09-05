"""The frozen permission catalog and the six-role matrix.

WORKSPACE_ROLE_COUNT = 6, exactly: owner, admin, manager, sales, member, viewer
(B1_AUTHORIZATION_RBAC.md §3/§4; B14_08 §1). Platform Operator is a separate
B13 platform namespace and is NOT a memberships.role value.

Cells use the frozen symbols:  A = allow · C = conditional · . = deny
There is NO rank inheritance: every cell is an explicit grant.
"""

from __future__ import annotations

from typing import Final

ALLOW: Final = "A"
CONDITIONAL: Final = "C"
DENY: Final = "."

ROLE_OWNER: Final = "owner"
ROLE_ADMIN: Final = "admin"
ROLE_MANAGER: Final = "manager"
ROLE_SALES: Final = "sales"
ROLE_MEMBER: Final = "member"
ROLE_VIEWER: Final = "viewer"

WORKSPACE_ROLES: Final[tuple[str, ...]] = (
    ROLE_OWNER,
    ROLE_ADMIN,
    ROLE_MANAGER,
    ROLE_SALES,
    ROLE_MEMBER,
    ROLE_VIEWER,
)
WORKSPACE_ROLE_COUNT: Final[int] = 6

# Rank governs the role-mutation guards only. It grants nothing by itself.
ROLE_RANK: Final[dict[str, int]] = {
    ROLE_OWNER: 60,
    ROLE_ADMIN: 50,
    ROLE_MANAGER: 40,
    ROLE_SALES: 30,
    ROLE_MEMBER: 20,
    ROLE_VIEWER: 10,
}

# --------------------------------------------------------------------------
# The matrix. Column order is the frozen order:
#   owner, admin, manager, sales, member, viewer
# Frozen B1 rows are reproduced verbatim; B14_08 §4 additive rows follow.
# --------------------------------------------------------------------------
_M: Final[dict[str, tuple[str, str, str, str, str, str]]] = {
    # --- Frozen B1_AUTHORIZATION_RBAC.md §3 ---
    "workspace.view": (ALLOW, ALLOW, ALLOW, ALLOW, ALLOW, ALLOW),
    "workspace.manage": (ALLOW, ALLOW, CONDITIONAL, DENY, DENY, DENY),
    "workspace.suspend": (ALLOW, DENY, DENY, DENY, DENY, DENY),
    "workspace.archive": (ALLOW, DENY, DENY, DENY, DENY, DENY),
    "workspace.delete": (ALLOW, DENY, DENY, DENY, DENY, DENY),
    "ownership.transfer": (ALLOW, DENY, DENY, DENY, DENY, DENY),
    "member.view": (ALLOW, ALLOW, ALLOW, ALLOW, ALLOW, ALLOW),
    "member.invite": (ALLOW, ALLOW, CONDITIONAL, DENY, DENY, DENY),
    "member.remove": (ALLOW, ALLOW, CONDITIONAL, DENY, DENY, DENY),
    "member.suspend": (ALLOW, ALLOW, CONDITIONAL, DENY, DENY, DENY),
    "member.role.change": (ALLOW, ALLOW, DENY, DENY, DENY, DENY),
    "invitation.view": (ALLOW, ALLOW, ALLOW, DENY, DENY, DENY),
    "invitation.cancel": (ALLOW, ALLOW, CONDITIONAL, DENY, DENY, DENY),
    "invitation.resend": (ALLOW, ALLOW, CONDITIONAL, DENY, DENY, DENY),
    "session.self.manage": (ALLOW, ALLOW, ALLOW, ALLOW, ALLOW, ALLOW),
    "subscription.change": (ALLOW, CONDITIONAL, DENY, DENY, DENY, DENY),
    "payment.manage": (ALLOW, CONDITIONAL, DENY, DENY, DENY, DENY),
    "billing.view": (ALLOW, ALLOW, DENY, DENY, DENY, DENY),
    "billing.manage": (ALLOW, CONDITIONAL, DENY, DENY, DENY, DENY),
    "tax.view": (ALLOW, ALLOW, DENY, DENY, DENY, DENY),
    "discovery.run": (ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY),
    "discovery.view": (ALLOW, ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL),
    "discovery.export": (ALLOW, ALLOW, ALLOW, CONDITIONAL, CONDITIONAL, DENY),
    "business.view": (ALLOW, ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL),
    "business.convert": (ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY),
    "lead.view": (ALLOW, ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL),
    "lead.create": (ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY),
    "lead.update": (ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY),
    "lead.assign": (ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY, DENY),
    # lead.archive — new in frozen B2-D-B004, mirroring lead.update's authority.
    "lead.archive": (ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY),
    "task.view": (ALLOW, ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL),
    "task.manage": (ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY),
    "appointment.view": (ALLOW, ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL),
    "appointment.manage": (ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY),
    "conversation.view": (ALLOW, ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL),
    "message.send": (ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY),
    "ai.use": (ALLOW, ALLOW, ALLOW, CONDITIONAL, CONDITIONAL, DENY),
    "deal.view": (ALLOW, ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL),
    "deal.create": (ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY),
    "deal.update": (ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY),
    "deal.close": (ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY, DENY),
    "automation.rule.view": (ALLOW, ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL),
    "automation.rule.manage": (ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY, DENY),
    "automation.run.approve": (ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY, DENY),
    "analytics.view": (ALLOW, ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL),
    "crm.export": (ALLOW, ALLOW, CONDITIONAL, CONDITIONAL, DENY, DENY),
    "file.upload": (ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY),
    "file.download": (ALLOW, ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL),
    "integration.manage": (ALLOW, ALLOW, CONDITIONAL, DENY, DENY, DENY),
    "settings.manage": (ALLOW, ALLOW, CONDITIONAL, DENY, DENY, DENY),
    "audit.view": (ALLOW, ALLOW, DENY, DENY, DENY, DENY),
    # --- B14_08 §4 additive rows (26 codes, six explicit cells each) ---
    "customer.view": (ALLOW, ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL),
    "customer.create": (ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY),
    "customer.update": (ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY),
    "customer.archive": (ALLOW, ALLOW, ALLOW, DENY, DENY, DENY),
    "customer.assign": (ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY, DENY),
    "customer.merge": (ALLOW, ALLOW, DENY, DENY, DENY, DENY),
    "contact.view": (ALLOW, ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL),
    "contact.manage": (ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY),
    "import.manage": (ALLOW, ALLOW, ALLOW, DENY, DENY, DENY),
    "customfield.manage": (ALLOW, ALLOW, DENY, DENY, DENY, DENY),
    "assignment.manage": (ALLOW, ALLOW, ALLOW, DENY, DENY, DENY),
    "form.manage": (ALLOW, ALLOW, DENY, DENY, DENY, DENY),
    "ticket.view": (ALLOW, ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL),
    "ticket.create": (ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY),
    "ticket.update": (ALLOW, ALLOW, ALLOW, CONDITIONAL, CONDITIONAL, DENY),
    "ticket.assign": (ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY, DENY),
    "ticket.resolve": (ALLOW, ALLOW, ALLOW, CONDITIONAL, CONDITIONAL, DENY),
    "knowledge.view": (ALLOW, ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL),
    "knowledge.manage": (ALLOW, ALLOW, ALLOW, DENY, DENY, DENY),
    "agent.manage": (ALLOW, ALLOW, DENY, DENY, DENY, DENY),
    "product.manage": (ALLOW, ALLOW, ALLOW, DENY, DENY, DENY),
    "quote.view": (ALLOW, ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL),
    "quote.create": (ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY),
    "quote.update": (ALLOW, ALLOW, ALLOW, ALLOW, CONDITIONAL, DENY),
    "quote.send": (ALLOW, ALLOW, ALLOW, CONDITIONAL, CONDITIONAL, DENY),
    "quote.accept": (ALLOW, ALLOW, ALLOW, DENY, DENY, DENY),
}

PERMISSION_MATRIX: Final = _M
ALL_PERMISSIONS: Final[tuple[str, ...]] = tuple(sorted(_M))

# Deferred codes: registered in the catalog, never granted by a Wave 1 endpoint.
DEFERRED_PERMISSIONS: Final[frozenset[str]] = frozenset(
    {
        "form.manage",
        "product.manage",
        "quote.view",
        "quote.create",
        "quote.update",
        "quote.send",
        "quote.accept",
    }
)

_ROLE_INDEX: Final[dict[str, int]] = {role: i for i, role in enumerate(WORKSPACE_ROLES)}


def cell(permission: str, role: str) -> str:
    """The frozen cell for (permission, role). Unknown pairs DENY (fail closed)."""
    row = _M.get(permission)
    if row is None or role not in _ROLE_INDEX:
        return DENY
    return row[_ROLE_INDEX[role]]


def grants(permission: str, role: str) -> bool:
    """True if the role holds the permission at all (allow or conditional).

    A CONDITIONAL grant still requires its object-level condition to pass at
    pipeline step 10 — this function answers step 8 only.
    """
    return cell(permission, role) in (ALLOW, CONDITIONAL)


def is_conditional(permission: str, role: str) -> bool:
    return cell(permission, role) == CONDITIONAL


def permissions_for_role(role: str) -> frozenset[str]:
    return frozenset(p for p in ALL_PERMISSIONS if grants(p, role))

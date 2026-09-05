"""Runtime PORTS (class B) — declared in common/, BOUND IN config/.

common/ is L0 and imports NOTHING from apps/ (B14_03 §6 rule 3, T-ARCH-8).
The cross-cutting pipeline therefore reaches domain data through these ports,
whose implementations are bound at the composition root. This is the class B
mechanism, and it adds no class A edge.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any, Protocol


class MembershipPort(Protocol):
    def resolve(self, workspace: Any, user: Any) -> Any | None: ...
    def initial_workspace_for(self, user: Any) -> Any | None: ...


class AuditPort(Protocol):
    def append(self, **kwargs: Any) -> Any: ...


class OutboxPort(Protocol):
    def publish(self, **kwargs: Any) -> Any: ...


class EntitlementPort(Protocol):
    def evaluate_entitlement(self, workspace: Any, capability: str) -> Any: ...
    def evaluate_quota(self, workspace: Any, metric: str, amount: int) -> Any: ...


class SessionPort(Protocol):
    def resolve(self, raw_token: str) -> Any | None: ...


class _Bindings:
    """Ports bound once by the composition root."""

    membership: MembershipPort | None = None
    audit: AuditPort | None = None
    outbox: OutboxPort | None = None
    entitlement: EntitlementPort | None = None
    session: SessionPort | None = None

    def bind(self, **ports: Any) -> None:
        for name, port in ports.items():
            setattr(self, name, port)

    def require(self, name: str) -> Any:
        port = getattr(self, name, None)
        if port is None:
            raise RuntimeError(f"The {name!r} port is not bound. config/ binds every port at app-ready time.")
        return port


ports = _Bindings()


def simple_port(**methods: Callable[..., Any]) -> Any:
    """Build a lightweight port object from callables (used by config/)."""
    return type("BoundPort", (), {k: staticmethod(v) for k, v in methods.items()})()

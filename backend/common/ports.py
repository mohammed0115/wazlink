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


class WebhookReceiptPort(Protocol):
    """Durable webhook ingestion (B12_WEBHOOK_GATEWAY).

    `record` is the FIRST idempotency defence: it returns `created=False` when
    `(provider, external_id)` was already receipted, so a redelivered callback
    is recognised before any domain processing begins. The second defence lives
    in the domain's own status/message identity — frozen B5 requires both, and
    neither is a substitute for the other.
    """

    def record(
        self, *, provider: str, external_id: str, payload_digest: str, signature_verified: bool
    ) -> tuple[Any, bool]: ...


class ProviderAttemptPort(Protocol):
    """`provider_request_attempts`, written BEFORE the call (B12-D-A021).

    Writing first is what leaves evidence when a process dies mid-call — the
    difference between an outcome that is `unknown` and an outcome that is
    invisible.
    """

    def open(self, *, provider: str, operation: str) -> Any: ...

    def settle(self, *, attempt: Any, outcome: str, status_code: int | None = None) -> None: ...


class ReconciliationPort(Protocol):
    """Opens a platform reconciliation case. NEVER auto-repairs (B14_09 §4)."""

    def open_case(self, *, case_class: str, subject_ref: str, detail: dict[str, Any]) -> Any: ...


class CredentialDeliveryPort(Protocol):
    """The out-of-band credential delivery boundary (B1_COMMAND_EVENT_CATALOG §3.3).

    This is the ONLY path by which a raw credential token leaves its issuing
    transaction. It never reaches an API response, the outbox, an audit row, a
    Celery argument or a log line — a domain that mints a token hands it here
    and keeps nothing.

    B1 defines no provider, no template and no transport, so the bound default
    is a discard. Until a provider adapter exists the seam is the contract.
    """

    def deliver(self, *, kind: str, subject_ref: str, raw_token: str, command_id: str) -> None: ...


class _Bindings:
    """Ports bound once by the composition root."""

    membership: MembershipPort | None = None
    audit: AuditPort | None = None
    outbox: OutboxPort | None = None
    entitlement: EntitlementPort | None = None
    session: SessionPort | None = None
    credential_delivery: CredentialDeliveryPort | None = None
    webhook_receipts: WebhookReceiptPort | None = None
    provider_attempts: ProviderAttemptPort | None = None
    reconciliation: ReconciliationPort | None = None

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

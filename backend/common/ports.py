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


class SingleUseTokenPort(Protocol):
    """Short-lived, single-use tokens — B11's download tickets.

    Deliberately NOT a durable store, and deliberately not a B11 table.
    Frozen `B11_STORAGE_MODEL` §"what B11 never holds" is explicit: *"No table,
    column, or JSONB key anywhere in B11 holds … a download ticket"*, and
    `B11_DOMAIN_MODEL` classifies a ticket as *"a short-lived access
    capability"* against *"a durable column, an event payload, a log line, a
    business record"*. So the ticket may not be persisted as business truth.

    It passes `B12-D-A014`'s flush test — *"if this Redis instance is flushed
    right now, does the system remain correct after recovery from
    PostgreSQL?"* — with a clear yes: a lost ticket is simply unredeemable, and
    the holder asks for another through the full authorization chain. Nothing
    committed is lost, and the failure direction is closed. It appears nowhere
    in `B12_REDIS_BOUNDARY` §3's forbidden list.

    `take` MUST be atomic: two concurrent redemptions of one token must not
    both receive a payload, or "single-use" would hold only by luck.
    """

    def put(self, *, token: str, payload: dict[str, Any], ttl_seconds: int) -> None: ...

    def take(self, *, token: str) -> dict[str, Any] | None: ...


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
    single_use_tokens: SingleUseTokenPort | None = None

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

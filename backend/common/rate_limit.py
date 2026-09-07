"""Rate limiting with SEPARATE classes (`B13_RATE_LIMIT_ABUSE_MODEL` §2).

The classes are kept apart deliberately, and that separation is the security
property rather than a tidiness preference: if login attempts and ordinary API
calls shared a budget, an attacker could exhaust the login limiter by making
harmless reads — or, worse, hide a credential-stuffing run inside normal
traffic and never trip the limiter that exists to catch it. Each class below
gets its own namespace, its own key shape and its own window.

**No rate-limit decision is business truth.** The counters live in a cache, not
in PostgreSQL: losing one fails OPEN for a legitimate user and closed for
nothing, which is the correct trade for a control that exists to slow abuse
rather than to authorize it. Nothing in this module is consulted for
authorization, entitlement or payment state — those are PostgreSQL's, always.
"""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass

# --- The classes. Each is its own namespace; none shares a budget. ---------
CLASS_LOGIN = "login"
CLASS_CREDENTIAL_RECOVERY = "credential_recovery"
CLASS_GENERAL_API = "general_api"
CLASS_EXPORT = "export"
CLASS_ADMIN_REPAIR = "admin_repair"
CLASS_WEBHOOK_INGRESS = "webhook_ingress"
CLASS_PROVIDER_CHECK = "provider_check"

RATE_LIMIT_CLASSES = (
    CLASS_LOGIN,
    CLASS_CREDENTIAL_RECOVERY,
    CLASS_GENERAL_API,
    CLASS_EXPORT,
    CLASS_ADMIN_REPAIR,
    CLASS_WEBHOOK_INGRESS,
    CLASS_PROVIDER_CHECK,
)


@dataclass(frozen=True)
class Budget:
    limit: int
    window_seconds: int


# The frozen rows are exact; the rest are Class B defaults to be calibrated in
# staging, per `FI-B0-20`'s own instruction. They are DATA, not architecture.
BUDGETS: dict[str, Budget] = {
    CLASS_LOGIN: Budget(10, 60),
    CLASS_CREDENTIAL_RECOVERY: Budget(5, 60),
    CLASS_GENERAL_API: Budget(300, 60),
    CLASS_EXPORT: Budget(10, 3600),
    CLASS_ADMIN_REPAIR: Budget(30, 3600),
    CLASS_WEBHOOK_INGRESS: Budget(600, 60),
    CLASS_PROVIDER_CHECK: Budget(20, 3600),
}


@dataclass(frozen=True)
class Decision:
    allowed: bool
    remaining: int
    limit: int
    retry_after_seconds: int = 0


class _Counters:
    """A fixed-window counter store, keyed by `(class, key)`.

    In-process and thread-safe. A deployment that runs more than one process
    binds a shared cache here instead and changes nothing else — the class
    separation, the key shapes and the budgets all live above this line.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._hits: dict[tuple[str, str], list[float]] = {}

    def hit(self, namespace: str, key: str, budget: Budget, *, now: float | None = None) -> Decision:
        now = now if now is not None else time.monotonic()
        cutoff = now - budget.window_seconds
        bucket_key = (namespace, key)
        with self._lock:
            hits = [t for t in self._hits.get(bucket_key, []) if t > cutoff]
            if len(hits) >= budget.limit:
                oldest = min(hits)
                self._hits[bucket_key] = hits
                return Decision(
                    allowed=False,
                    remaining=0,
                    limit=budget.limit,
                    retry_after_seconds=max(1, int(oldest + budget.window_seconds - now)),
                )
            hits.append(now)
            self._hits[bucket_key] = hits
            return Decision(allowed=True, remaining=budget.limit - len(hits), limit=budget.limit)

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()


_counters = _Counters()


def check(rate_class: str, key: str, *, now: float | None = None) -> Decision:
    """Consume one unit from ONE class's budget.

    An unknown class is refused rather than defaulted: silently sharing an
    unrecognized class's traffic with a general bucket is exactly the
    cross-class leak this module exists to prevent.
    """
    if rate_class not in BUDGETS:
        raise ValueError(f"Unknown rate-limit class: {rate_class!r}")
    return _counters.hit(rate_class, str(key), BUDGETS[rate_class], now=now)


def reset() -> None:
    """Test-only. Production never clears a limiter."""
    _counters.reset()


__all__ = [
    "check",
    "reset",
    "Decision",
    "Budget",
    "BUDGETS",
    "RATE_LIMIT_CLASSES",
    "CLASS_LOGIN",
    "CLASS_CREDENTIAL_RECOVERY",
    "CLASS_GENERAL_API",
    "CLASS_EXPORT",
    "CLASS_ADMIN_REPAIR",
    "CLASS_WEBHOOK_INGRESS",
    "CLASS_PROVIDER_CHECK",
]

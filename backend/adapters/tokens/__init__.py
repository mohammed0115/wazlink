"""Single-use short-lived token stores — the B11 download-ticket seam.

Two implementations behind ONE port, and the domain cannot tell them apart
(LSP, `B14_19`). Neither stores business truth: a ticket is a short-lived
access capability, and losing one costs a round trip, never a fact.

`RedisSingleUseTokenStore` is the deployed implementation. Redis is the
correct home under `B12-D-A014`'s flush test — a flushed ticket is simply
unredeemable and the holder requests another through the full authorization
chain — and download tickets appear nowhere in `B12_REDIS_BOUNDARY` §3's
forbidden list. Storing them in PostgreSQL instead was not an option:
`B11_STORAGE_MODEL` forbids any B11 table from holding a download ticket.
"""

from __future__ import annotations

import json
import threading
import time
from typing import Any

# One namespace, so an operator can see and expire the whole class at once and
# no other Redis user can collide with it.
KEY_PREFIX = "wazlink:dlticket:"


class RedisSingleUseTokenStore:
    """The deployed store. Single-use is enforced by the SERVER, not the caller.

    `GETDEL` reads and deletes in one atomic server-side operation, so two
    workers redeeming the same ticket cannot both receive the payload. A
    read-then-delete pair would leave exactly the race the "single-use"
    guarantee exists to close.
    """

    def __init__(self, *, url: str = "", client: Any = None):
        self._url = url
        self._client = client

    def _redis(self) -> Any:
        if self._client is None:
            import redis  # noqa: PLC0415 - the vendor import stays in the adapter
            from django.conf import settings  # noqa: PLC0415

            self._client = redis.Redis.from_url(
                self._url or settings.REDIS_URL, socket_connect_timeout=2
            )
        return self._client

    def put(self, *, token: str, payload: dict[str, Any], ttl_seconds: int) -> None:
        # The TTL is set by the store, so an expired ticket cannot be redeemed
        # even if the application clock is wrong.
        self._redis().set(KEY_PREFIX + token, json.dumps(payload), ex=max(1, int(ttl_seconds)))

    def take(self, *, token: str) -> dict[str, Any] | None:
        raw = self._redis().getdel(KEY_PREFIX + token)
        if raw is None:
            return None
        try:
            return json.loads(raw)
        except (ValueError, TypeError):
            return None


class InMemorySingleUseTokenStore:
    """Process-local equivalent for tests and single-process local runs.

    Same observable contract: single-use, expiring, atomic take. The lock makes
    the take atomic within the process, which is the strongest guarantee this
    implementation can offer and the reason it is not the deployed one.
    """

    def __init__(self):
        self._items: dict[str, tuple[float, dict[str, Any]]] = {}
        self._lock = threading.Lock()

    def put(self, *, token: str, payload: dict[str, Any], ttl_seconds: int) -> None:
        with self._lock:
            self._items[token] = (time.monotonic() + max(1, int(ttl_seconds)), dict(payload))

    def take(self, *, token: str) -> dict[str, Any] | None:
        with self._lock:
            record = self._items.pop(token, None)
        if record is None:
            return None
        expires_at, payload = record
        if expires_at <= time.monotonic():
            return None
        return payload

    def clear(self) -> None:
        with self._lock:
            self._items.clear()


__all__ = ["RedisSingleUseTokenStore", "InMemorySingleUseTokenStore", "KEY_PREFIX"]

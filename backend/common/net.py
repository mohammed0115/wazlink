"""client_ip() — the ONLY forwarded-header parser in the codebase (B14_31 §5).

Safe default: TRUSTED_PROXY_COUNT=0 means forwarded headers are IGNORED.
"""

from __future__ import annotations

from typing import Any

from django.conf import settings


def client_ip(request: Any) -> str:
    """Resolve the client IP, honouring only as many proxy hops as are trusted."""
    trusted = int(getattr(settings, "TRUSTED_PROXY_COUNT", 0) or 0)
    remote_addr = request.META.get("REMOTE_ADDR", "") or ""

    if trusted <= 0:
        # Trust boundary closed: a forwarded header is attacker-controlled.
        return remote_addr

    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if not forwarded:
        return remote_addr

    hops = [part.strip() for part in forwarded.split(",") if part.strip()]
    if not hops:
        return remote_addr
    # Count back exactly `trusted` hops from the right; never read the leftmost
    # value blindly, which is the classic spoof.
    index = max(len(hops) - trusted, 0)
    return hops[index] if index < len(hops) else remote_addr

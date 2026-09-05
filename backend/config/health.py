"""Health and readiness — three-tier, NEVER provider-dependent (B13_HEALTH_READINESS).

Starting with ZERO provider credentials must succeed.
"""

from __future__ import annotations

from django.db import connection
from django.http import JsonResponse


def health(request):
    """Liveness: the process is up. Touches nothing external."""
    return JsonResponse({"status": "ok"})


def ready(request):
    """Readiness: the dependencies this process REQUIRES are reachable.

    PostgreSQL and Redis are required. NO provider is consulted — a missing
    provider credential never makes the platform unready.
    """
    checks: dict[str, str] = {}
    healthy = True

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "unavailable"
        healthy = False

    try:
        import redis
        from django.conf import settings

        client = redis.Redis.from_url(settings.REDIS_URL, socket_connect_timeout=2)
        client.ping()
        checks["redis"] = "ok"
    except Exception:
        checks["redis"] = "unavailable"
        healthy = False

    return JsonResponse(
        {"status": "ready" if healthy else "not_ready", "checks": checks},
        status=200 if healthy else 503,
    )

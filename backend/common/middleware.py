"""Request-scoped primitives: correlation identifiers and idempotency replay."""

from __future__ import annotations

import uuid
from typing import Any

from django.utils.deprecation import MiddlewareMixin


class RequestContextMiddleware(MiddlewareMixin):
    """request_id / correlation_id / causation_id propagation primitives."""

    def process_request(self, request: Any) -> None:
        request.request_id = str(uuid.uuid4())
        request.correlation_id = request.headers.get("X-Correlation-Id") or request.request_id
        request.causation_id = request.headers.get("X-Causation-Id", "")

    def process_response(self, request: Any, response: Any) -> Any:
        request_id = getattr(request, "request_id", "")
        if request_id:
            response["X-Request-Id"] = request_id
        return response


class IdempotencyMiddleware(MiddlewareMixin):
    """Records the idempotency key on the request for commands to consume."""

    def process_request(self, request: Any) -> None:
        from .idempotency import key_from

        request.idempotency_key = key_from(request)

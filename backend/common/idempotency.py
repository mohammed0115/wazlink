"""Frozen idempotency-key standard (BACKEND_IDEMPOTENCY_STANDARD).

Replay with the SAME body returns the original result.
Reuse with a DIFFERENT body is 409 IDEMPOTENCY_CONFLICT.
"""

from __future__ import annotations

import hashlib
import json
from typing import Any

HEADER = "Idempotency-Key"


def fingerprint(body: Any) -> str:
    raw = json.dumps(body, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


def key_from(request: Any) -> str:
    return (request.headers.get(HEADER) or request.headers.get(HEADER.lower()) or "").strip()

"""Structured JSON logging with the mandatory redaction processor (B13)."""

from __future__ import annotations

import json
import logging
import re
from typing import Any

SENSITIVE_KEY_PATTERN = re.compile(
    r"(password|secret|token|api[_-]?key|authorization|cookie|credential|access[_-]?token)",
    re.IGNORECASE,
)
# Value-shaped redaction: bearer tokens, long opaque keys, emails, phone numbers.
VALUE_PATTERNS = [
    (re.compile(r"Bearer\s+[A-Za-z0-9._\-]+", re.IGNORECASE), "Bearer [REDACTED]"),
    # Real provider keys carry INTERNAL SEPARATORS — `sk_live_…`, `sk_test_…`,
    # `sk-proj-…`. A character class of `[A-Za-z0-9]` only stops at the first
    # underscore and lets the rest of the key through, which is how a live
    # secret reached an audit row before this was widened.
    (re.compile(r"\bsk[-_][A-Za-z0-9_\-]{12,}"), "[REDACTED]"),
    (re.compile(r"\bAKIA[0-9A-Z]{16}\b"), "[REDACTED]"),
    (re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{10,}", re.IGNORECASE), "[REDACTED]"),
    (re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"),
     "[REDACTED]"),
    (re.compile(r"\b[\w.+-]+@[\w-]+\.[\w.]+\b"), "[REDACTED_EMAIL]"),
    (re.compile(r"\b\+?\d[\d\s\-()]{8,}\d\b"), "[REDACTED_PHONE]"),
]

REDACTED = "[REDACTED]"


def redact_text(text: str) -> str:
    for pattern, replacement in VALUE_PATTERNS:
        text = pattern.sub(replacement, text)
    return text


def redact_mapping(data: dict[Any, Any]) -> dict[Any, Any]:
    out: dict[Any, Any] = {}
    for key, value in data.items():
        if SENSITIVE_KEY_PATTERN.search(str(key)):
            out[key] = REDACTED
        elif isinstance(value, dict):
            out[key] = redact_mapping(value)
        elif isinstance(value, str):
            out[key] = redact_text(value)
        else:
            out[key] = value
    return out


class RedactionFilter(logging.Filter):
    """No secret value ever reaches a log sink."""

    def filter(self, record: logging.LogRecord) -> bool:
        # record.msg is typed str in typeshed but accepts any object at
        # runtime; structured logs pass a mapping, so set it dynamically.
        message: Any = record.msg
        if isinstance(message, dict):
            redacted: Any = redact_mapping(message)
        elif isinstance(message, str):
            redacted = redact_text(message)
        else:
            return True
        # LogRecord.msg is annotated `str` in typeshed but accepts any object
        # at runtime, which structured logging relies on.
        setattr(record, "msg", redacted)  # noqa: B010
        return True


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage() if not isinstance(record.msg, dict) else record.msg,
        }
        for field in ("request_id", "correlation_id", "causation_id", "workspace_ref"):
            value = getattr(record, field, None)
            if value:
                payload[field] = value
        return json.dumps(payload, default=str)

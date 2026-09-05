"""Secret resolution: the domain holds a NAME, the resolver reads the
environment AT CALL TIME (B14_11 §1).

No credential value is cached, stored in a row, placed in a Celery payload, or
held in a long-lived process variable beyond this call's scope.
"""

from __future__ import annotations

import os


class SecretNotConfigured(LookupError):
    """The referenced credential is absent from the environment."""


def resolve_secret_ref(credential_ref: str) -> str:
    """Resolve a credential REFERENCE NAME to its value, at call time."""
    value = os.environ.get(credential_ref, "").strip()
    if not value:
        raise SecretNotConfigured(credential_ref)  # names the variable, never a value
    return value


def is_configured(credential_ref: str) -> bool:
    return bool(os.environ.get(credential_ref, "").strip())


def provider_status(refs: list[str]) -> str:
    """Absent credentials are represented safely, never as a fake value."""
    if not refs:
        return "not_connected"
    return "configured" if all(is_configured(ref) for ref in refs) else "not_configured"

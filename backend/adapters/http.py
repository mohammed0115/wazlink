"""Bounded outbound HTTP for provider adapters (B12_OUTBOUND_HTTP_POLICY).

stdlib only — a provider adapter introduces no new dependency (B14_34).

Three properties this helper exists to guarantee, because every adapter needs
them and none should re-derive them:

*   **Every call is deadline-bounded.** There is no un-timed provider call.
*   **Every failure is already a closed provider class.** A caller never sees
    urllib's exception vocabulary, so a provider's own error text cannot reach
    a domain by accident.
*   **Nothing sensitive is returned in a failure.** `detail` is a short safe
    label; the provider's body, URL and headers are dropped here rather than
    trusted to be dropped later (B14_15 §6).
"""

from __future__ import annotations

import json
import urllib.error
import urllib.request
from typing import Any

from common.provider_ports import (
    ProviderInvalidResponse,
    ProviderPermanentFailure,
    ProviderRateLimited,
    ProviderTemporaryFailure,
    ProviderTimeout,
)

DEFAULT_TIMEOUT_SECONDS = 20.0
# A provider answer larger than this is refused unread rather than buffered.
MAX_RESPONSE_BYTES = 2_000_000


def post_json(
    url: str,
    *,
    headers: dict[str, str],
    body: dict[str, Any],
    timeout: float = DEFAULT_TIMEOUT_SECONDS,
    provider: str = "",
) -> dict[str, Any]:
    """POST JSON, return parsed JSON, or raise a CLOSED provider error class."""
    encoded = json.dumps(body).encode("utf-8")
    request = urllib.request.Request(  # noqa: S310 - https URL built by the adapter
        url,
        data=encoded,
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:  # noqa: S310
            raw = response.read(MAX_RESPONSE_BYTES + 1)
    except urllib.error.HTTPError as exc:
        raise _classify_status(exc.code, provider) from None
    except TimeoutError:
        raise ProviderTimeout("The provider did not answer in time.", provider=provider) from None
    except urllib.error.URLError:
        # Includes DNS and connection failures. The reason object can carry a
        # host name, so it is deliberately not propagated.
        raise ProviderTemporaryFailure("The provider was unreachable.", provider=provider) from None

    if len(raw) > MAX_RESPONSE_BYTES:
        raise ProviderInvalidResponse("The provider response exceeded its bound.", provider=provider)
    try:
        parsed = json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        raise ProviderInvalidResponse(
            "The provider response was not valid JSON.", provider=provider
        ) from None
    if not isinstance(parsed, dict):
        raise ProviderInvalidResponse("The provider response was not an object.", provider=provider)
    return parsed


def _classify_status(status_code: int, provider: str):
    """Map an HTTP status onto the closed classes. No provider body is read."""
    if status_code == 429:
        return ProviderRateLimited("The provider rate-limited this request.", provider=provider)
    if status_code in (408, 504):
        return ProviderTimeout("The provider timed out.", provider=provider)
    if status_code >= 500:
        return ProviderTemporaryFailure("The provider reported an upstream failure.", provider=provider)
    if status_code in (401, 403):
        # A credential problem is PERMANENT: retrying a rejected credential
        # only burns quota (B14_15 §5 — no automatic retry on 401/403).
        return ProviderPermanentFailure("The provider refused the credential.", provider=provider)
    return ProviderPermanentFailure("The provider refused the request.", provider=provider)


__all__ = ["post_json", "DEFAULT_TIMEOUT_SECONDS", "MAX_RESPONSE_BYTES"]

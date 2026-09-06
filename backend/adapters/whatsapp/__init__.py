"""Meta WhatsApp Cloud API adapter — implements WhatsAppProviderPort.

**Provider facts verified against official Meta documentation during I6**
(`developers.facebook.com/docs/graph-api/webhooks/getting-started` and the
Cloud API messages reference, read 2026-09-06 — the `FI-B12-12` / `B12-X-001` /
`B12-X-014` in-slice re-verification this slice owes):

*   **Subscription verification (GET).** Meta sends `hub.mode=subscribe`,
    `hub.verify_token` and `hub.challenge`. The endpoint compares the token and
    echoes `hub.challenge` verbatim on success.
*   **Payload authenticity (POST).** Meta signs the body and sends
    `X-Hub-Signature-256: sha256=<hex>`, where `<hex>` is HMAC-SHA256 over the
    **raw request body** keyed by the app secret. Verification must therefore
    run on raw bytes, before any parse.
*   **Send.** `POST https://graph.facebook.com/{version}/{phone_number_id}/messages`
    with `Authorization: Bearer <access token>` and a body of
    `{messaging_product, recipient_type, to, type, text{body}}`. The response
    carries `messages[0].id` — the provider message identity.
*   **Callbacks.** Inbound messages *and* delivery statuses both arrive as
    webhooks under `entry[].changes[].value`, as `messages[]` and `statuses[]`.

Everything above stops here. The domain receives `InboundMessage`,
`InboundStatus` and `OutboundMessageResult` and cannot tell Meta was involved.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
from datetime import UTC, datetime

from adapters.http import DEFAULT_TIMEOUT_SECONDS, as_dict, post_json
from common.provider_ports import (
    CONFIGURED,
    NOT_CONFIGURED,
    InboundMessage,
    InboundStatus,
    OutboundMessageRequest,
    OutboundMessageResult,
    ProviderInvalidResponse,
    ProviderNotConfigured,
    ProviderStatus,
    WebhookEnvelope,
)

PROVIDER_NAME = "whatsapp"
CREDENTIAL_REFS = (
    "WHATSAPP_ACCESS_TOKEN",
    "WHATSAPP_PHONE_NUMBER_ID",
    "WHATSAPP_BUSINESS_ACCOUNT_ID",
    "WHATSAPP_APP_SECRET",
    "WHATSAPP_VERIFY_TOKEN",
)
DEFAULT_GRAPH_VERSION = "v21.0"

# Provider status vocabulary -> WazLink's. `sent` is deliberately included so a
# provider that reports acceptance separately from delivery still maps cleanly.
STATUS_MAP = {"sent": "sent", "delivered": "delivered", "read": "read", "failed": "failed"}


def _env(name: str) -> str:
    return (os.environ.get(name) or "").strip()


def _timestamp(raw) -> datetime | None:
    try:
        return datetime.fromtimestamp(int(raw), tz=UTC)
    except (TypeError, ValueError):
        return None


def normalize_callback(raw_body: bytes) -> WebhookEnvelope:
    """Normalize ONE provider callback body into WazLink's own envelope.

    Module level rather than a method, because EVERY implementation of the port
    needs the identical normalization: the real adapter and the stub differ only
    in credentials and transport, never in contract, and a stub that
    reimplemented this could silently drift from the thing it stands in for.

    It never raises on unsupported content. An unrecognised payload yields
    `unsupported=True`, because frozen B12 requires a `200` for it — telling the
    provider to redeliver what WazLink will never understand is an infinite loop.
    """
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        raise ProviderInvalidResponse(
            "The callback body was not valid JSON.", provider=PROVIDER_NAME
        ) from None
    if not isinstance(payload, dict):
        raise ProviderInvalidResponse("The callback body was not an object.", provider=PROVIDER_NAME)

    messages: list[InboundMessage] = []
    statuses: list[InboundStatus] = []
    account_ids: set[str] = set()

    for entry in payload.get("entry") or []:
        if not isinstance(entry, dict):
            continue
        for change in entry.get("changes") or []:
            if not isinstance(change, dict):
                continue
            value = as_dict(change.get("value"))
            if not value:
                continue
            account_id = str(as_dict(value.get("metadata")).get("phone_number_id") or "")[:60]
            if account_id:
                account_ids.add(account_id)

            profiles: dict[str, str] = {}
            for contact in value.get("contacts") or []:
                if isinstance(contact, dict):
                    profiles[str(contact.get("wa_id") or "")] = str(
                        as_dict(contact.get("profile")).get("name") or ""
                    )[:120]

            for message in value.get("messages") or []:
                if not isinstance(message, dict):
                    continue
                provider_id = str(message.get("id") or "")[:200]
                sender = str(message.get("from") or "")[:40]
                if not provider_id or not sender:
                    continue
                messages.append(
                    InboundMessage(
                        provider_message_id=provider_id,
                        from_phone=sender,
                        body=str(as_dict(message.get("text")).get("body") or "")[:4000],
                        kind=str(message.get("type") or "text")[:30],
                        occurred_at=_timestamp(message.get("timestamp")),
                        profile_name=profiles.get(sender, ""),
                        provider_account_id=account_id,
                    )
                )

            for status in value.get("statuses") or []:
                if not isinstance(status, dict):
                    continue
                provider_id = str(status.get("id") or "")[:200]
                mapped = STATUS_MAP.get(str(status.get("status") or "").lower())
                if not provider_id or mapped is None:
                    continue
                statuses.append(
                    InboundStatus(
                        provider_message_id=provider_id,
                        status=mapped,
                        occurred_at=_timestamp(status.get("timestamp")),
                        recipient_phone=str(status.get("recipient_id") or "")[:40],
                    )
                )

    return WebhookEnvelope(
        provider_event_identity=hashlib.sha256(raw_body).hexdigest(),
        # Exactly one account, or none: a callback spanning two accounts is not
        # routable to one tenant and must never be guessed onto either.
        provider_account_id=account_ids.pop() if len(account_ids) == 1 else "",
        messages=tuple(messages),
        statuses=tuple(statuses),
        unsupported=not messages and not statuses,
    )


class MetaWhatsAppAdapter:
    """Translation, signature verification, normalization. No business rule."""

    provider_name = PROVIDER_NAME

    def __init__(self, *, timeout: float = DEFAULT_TIMEOUT_SECONDS):
        self._timeout = timeout

    # -- configuration -----------------------------------------------------
    def status(self) -> ProviderStatus:
        missing = [ref for ref in ("WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID") if not _env(ref)]
        configured = not missing
        return ProviderStatus(
            provider=PROVIDER_NAME,
            status=CONFIGURED if configured else NOT_CONFIGURED,
            configuration_valid=configured,
            credential_refs=CREDENTIAL_REFS,
            detail="" if configured else "Required credentials are absent from the environment.",
        )

    # -- inbound -----------------------------------------------------------
    def verify_signature(self, *, raw_body: bytes, signature_header: str) -> bool:
        """HMAC-SHA256 over the RAW body, compared in constant time.

        Returns False when the app secret is absent. That is the fail-closed
        answer frozen B14_15 §7 requires: with no secret a signature cannot be
        verified, so the only safe conclusion is "not authentic" — never "trust
        it because we cannot check".
        """
        secret = _env("WHATSAPP_APP_SECRET")
        if not secret or not signature_header:
            return False
        prefix, _, provided = signature_header.partition("=")
        if prefix.strip().lower() != "sha256" or not provided:
            return False
        expected = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, provided.strip())

    def verify_subscription(self, *, mode: str, token: str, challenge: str) -> str | None:
        """Echo `hub.challenge` on a correct token, else None.

        The token comparison is constant-time: a timing oracle on a static
        shared secret is exactly the kind of leak that survives forever.
        """
        expected = _env("WHATSAPP_VERIFY_TOKEN")
        if not expected or mode != "subscribe":
            return None
        return challenge if hmac.compare_digest(expected, token or "") else None

    def parse_webhook(self, raw_body: bytes) -> WebhookEnvelope:
        return normalize_callback(raw_body)

    # -- outbound ----------------------------------------------------------

    def send(self, request: OutboundMessageRequest) -> OutboundMessageResult:
        token = _env("WHATSAPP_ACCESS_TOKEN")
        phone_number_id = _env("WHATSAPP_PHONE_NUMBER_ID")
        if not token or not phone_number_id:
            raise ProviderNotConfigured("WhatsApp sending is not configured.", provider=PROVIDER_NAME)

        version = _env("WHATSAPP_GRAPH_VERSION") or DEFAULT_GRAPH_VERSION
        body: dict[str, object] = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": request.to_phone,
        }
        if request.kind == "template":
            body["type"] = "template"
            body["template"] = {
                "name": request.template_name,
                "language": {"code": request.template_language or "en"},
                "components": (
                    [
                        {
                            "type": "body",
                            "parameters": [
                                {"type": "text", "text": v} for v in request.template_variables
                            ],
                        }
                    ]
                    if request.template_variables
                    else []
                ),
            }
        else:
            body["type"] = "text"
            body["text"] = {"body": request.body}

        payload = post_json(
            f"https://graph.facebook.com/{version}/{phone_number_id}/messages",
            headers={"Authorization": f"Bearer {token}"},
            body=body,
            timeout=self._timeout,
            provider=PROVIDER_NAME,
        )
        sent = payload.get("messages")
        if not isinstance(sent, list) or not sent or not isinstance(sent[0], dict):
            # The provider MAY have accepted the message. Saying "failed" would
            # invite a resend, which is the exact duplicate B12-D-A020 forbids.
            raise ProviderInvalidResponse(
                "The provider acknowledged in an unusable shape.", provider=PROVIDER_NAME
            )
        provider_message_id = str(sent[0].get("id") or "")
        if not provider_message_id:
            raise ProviderInvalidResponse("The provider returned no message id.", provider=PROVIDER_NAME)
        return OutboundMessageResult(provider_message_id=provider_message_id[:200], accepted=True)


class StubWhatsAppAdapter:
    """A DETERMINISTIC second implementation of the identical port (LSP).

    It performs no network I/O and signs with its own secret, so the full
    inbound pipeline — signature, dedup, identity resolution, status
    monotonicity — is exercised end to end with no mock of the behaviour under
    test.
    """

    provider_name = PROVIDER_NAME
    APP_SECRET = "stub-app-secret"
    VERIFY_TOKEN = "stub-verify-token"

    def __init__(self, *, configured: bool = True):
        self._configured = configured
        self.sent: list[OutboundMessageRequest] = []
        self._counter = 0
        # When set, the next send raises this instead of succeeding. It is how a
        # failure-path test drives a provider failure without patching a method.
        self.next_error: Exception | None = None

    def status(self) -> ProviderStatus:
        return ProviderStatus(
            provider=PROVIDER_NAME,
            status=CONFIGURED if self._configured else NOT_CONFIGURED,
            configuration_valid=self._configured,
            credential_refs=CREDENTIAL_REFS,
        )

    @classmethod
    def sign(cls, raw_body: bytes) -> str:
        """Produce the header a genuine caller would send."""
        return "sha256=" + hmac.new(cls.APP_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()

    def verify_signature(self, *, raw_body: bytes, signature_header: str) -> bool:
        if not self._configured or not signature_header:
            return False
        prefix, _, provided = signature_header.partition("=")
        if prefix.strip().lower() != "sha256" or not provided:
            return False
        expected = hmac.new(self.APP_SECRET.encode(), raw_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, provided.strip())

    def verify_subscription(self, *, mode: str, token: str, challenge: str) -> str | None:
        if mode != "subscribe":
            return None
        return challenge if hmac.compare_digest(self.VERIFY_TOKEN, token or "") else None

    def parse_webhook(self, raw_body: bytes) -> WebhookEnvelope:
        # The SAME normalizer the real adapter uses, so the stub cannot drift.
        return normalize_callback(raw_body)

    def send(self, request: OutboundMessageRequest) -> OutboundMessageResult:
        if not self._configured:
            raise ProviderNotConfigured("WhatsApp sending is not configured.", provider=PROVIDER_NAME)
        if self.next_error is not None:
            error, self.next_error = self.next_error, None
            raise error
        self.sent.append(request)
        self._counter += 1
        return OutboundMessageResult(provider_message_id=f"wamid.stub.{self._counter}", accepted=True)


__all__ = [
    "MetaWhatsAppAdapter",
    "normalize_callback",
    "StubWhatsAppAdapter",
    "PROVIDER_NAME",
    "CREDENTIAL_REFS",
    "DEFAULT_GRAPH_VERSION",
]

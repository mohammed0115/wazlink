"""Provider PORTS and their normalized contracts (class B, B14_03 §4).

Declared in common/ (L0), implemented under adapters/, BOUND IN config/. A
domain module imports this file and nothing else to reach a provider, which is
why no app depends on a vendor SDK and why swapping an adapter changes no
domain module, migration, DTO or test (B14_14 §8, B14_16 §1, T-DISC-2, T-AI-6).

Two rules make the boundary real rather than decorative:

1.  **Nothing vendor-shaped crosses it.** The dataclasses below are WazLink's
    own vocabulary. No provider field name, error code, HTTP status, model name
    or token identifier appears in a domain signature (B14_14 §3, T-DISC-1).
2.  **Every failure is one of the closed classes below.** An adapter maps its
    provider's failures onto them; a domain reasons about the class alone, so a
    provider stack trace can never reach a tenant API (B14_16 §3).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Protocol, runtime_checkable

# --------------------------------------------------------------------------
# Provider status — the vocabulary of platform_async.IntegrationConnection.
# Absent credentials are NOT_CONFIGURED, never a crash and never a fake
# credential (B14_16 §3, B14_14 §4, B14_15 §7).
# --------------------------------------------------------------------------

NOT_CONNECTED = "not_connected"
NOT_CONFIGURED = "not_configured"
CONFIGURED = "configured"
ENABLED = "enabled"
DISABLED = "disabled"


@dataclass(frozen=True)
class ProviderStatus:
    """What an operator may see. It carries NO credential value, ever."""

    provider: str
    status: str
    configuration_valid: bool
    # REFERENCE NAMES only — e.g. ("GOOGLE_PLACES_API_KEY",). Never a value.
    credential_refs: tuple[str, ...] = ()
    detail: str = ""

    @property
    def is_usable(self) -> bool:
        return self.status in (CONFIGURED, ENABLED) and self.configuration_valid


# --------------------------------------------------------------------------
# The closed provider-failure classes (B12). An adapter raises one of these and
# nothing else; a domain never sees a provider's own error vocabulary.
# --------------------------------------------------------------------------


class ProviderError(Exception):
    """Base. `detail` is SAFE text — never a provider body, URL or credential."""

    outcome = "known_failure"

    def __init__(self, detail: str = "", *, provider: str = ""):
        self.detail = detail
        self.provider = provider
        super().__init__(detail or self.__class__.__name__)


class ProviderNotConfigured(ProviderError):
    """No usable credential. The platform keeps working; this feature does not."""

    outcome = "not_configured"


class ProviderTimeout(ProviderError):
    """The call exceeded its bounded deadline."""

    outcome = "unknown"


class ProviderRateLimited(ProviderError):
    """The provider refused for rate or quota reasons. Retryable with backoff."""

    outcome = "known_failure"


class ProviderTemporaryFailure(ProviderError):
    """A transient upstream failure. Retryable."""

    outcome = "known_failure"


class ProviderPermanentFailure(ProviderError):
    """The provider refused permanently. NOT retryable."""

    outcome = "known_failure"


class ProviderInvalidResponse(ProviderError):
    """The provider answered in a shape this adapter cannot normalize.

    Raised by the ADAPTER, so malformed provider output never reaches a domain
    as if it were data.
    """

    outcome = "known_failure"


class ProviderUnknownOutcome(ProviderError):
    """The call may or may not have taken effect.

    B12-D-A020: an operation with this outcome is NEVER retried automatically.
    A reconciliation case is opened and a human decides.
    """

    outcome = "unknown"


# --------------------------------------------------------------------------
# Discovery — B14_16 §2. The domain speaks ONLY in normalized results.
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class NormalizedBusinessResult:
    """The frozen normalized contract. Only fields WazLink actually uses.

    `provider_external_id` is the identity key and is OPAQUE: the domain never
    parses it and never infers a vendor from it.
    """

    provider_external_id: str
    name: str
    source_provider: str
    observed_at: datetime
    category: str = ""
    address_text: str = ""
    city: str = ""
    latitude: float | None = None
    longitude: float | None = None
    phone: str = ""
    website: str = ""
    rating: float | None = None
    review_count: int | None = None


@dataclass(frozen=True)
class PlaceSearchRequest:
    term: str
    location: str = ""
    page_token: str = ""
    page_size: int = 20
    language_code: str = ""
    region_code: str = ""


@dataclass(frozen=True)
class PlaceSearchPage:
    results: tuple[NormalizedBusinessResult, ...]
    next_page_token: str = ""
    # Attribution the provider requires wherever results are displayed
    # (B14_16 §3). Carried as data, never hard-coded in a domain module.
    attribution: str = ""


@runtime_checkable
class PlaceSearchPort(Protocol):
    """Place search. `adapters/places` implements it for Google Places."""

    provider_name: str

    def status(self) -> ProviderStatus: ...

    def search(self, request: PlaceSearchRequest) -> PlaceSearchPage: ...


@runtime_checkable
class ScrapingProviderPort(Protocol):
    """Enrichment/scraping. The VENDOR IS UNSELECTED (B12-D-B005, ID-01).

    `verification_scheme_available()` is the load-bearing method: frozen
    B12-D-A054 forbids ENABLING this connection while no webhook verification
    scheme exists, so the port exposes that fact rather than leaving the
    decision to an operator's judgement (T-DISC-6).
    """

    provider_name: str

    def status(self) -> ProviderStatus: ...

    def verification_scheme_available(self) -> bool: ...

    def search(self, request: PlaceSearchRequest) -> PlaceSearchPage: ...


# --------------------------------------------------------------------------
# AI — B14_14 §2. Typed intents in, normalized result out. No model name, no
# prompt, no token identifier, no finish_reason crosses this boundary.
# --------------------------------------------------------------------------

INTENT_DRAFT_REPLY = "draft_reply"
INTENT_SUMMARIZE_CONVERSATION = "summarize_conversation"
INTENT_ANSWER_FROM_KNOWLEDGE = "answer_from_knowledge"
INTENT_QUALIFY_LEAD = "qualify_lead"
INTENT_PROPOSE_ACTION = "propose_action"

AI_INTENTS = (
    INTENT_DRAFT_REPLY,
    INTENT_SUMMARIZE_CONVERSATION,
    INTENT_ANSWER_FROM_KNOWLEDGE,
    INTENT_QUALIFY_LEAD,
    INTENT_PROPOSE_ACTION,
)


@dataclass(frozen=True)
class AICitation:
    """A grounding citation. `article_ref` is a KBA-* public id."""

    article_ref: str
    version: int
    excerpt: str = ""


@dataclass(frozen=True)
class AIUsage:
    """Aggregate-only counters. They carry NO content (B14_14 §6)."""

    input_units: int = 0
    output_units: int = 0
    total_units: int = 0


@dataclass(frozen=True)
class AIRequest:
    """Context is assembled by the DOMAIN, after PD-002 masking.

    The adapter receives already-minimized content and adds nothing.
    """

    intent: str
    workspace_ref: str
    context: dict[str, Any] = field(default_factory=dict)
    grounding: tuple[AICitation, ...] = ()
    max_output_units: int = 700


@dataclass(frozen=True)
class AIResult:
    """Normalized. `abstained` is how a provider declines, not an exception."""

    intent: str
    content: str = ""
    structured: dict[str, Any] = field(default_factory=dict)
    citations: tuple[AICitation, ...] = ()
    confidence: float | None = None
    abstained: bool = False
    usage: AIUsage = field(default_factory=AIUsage)


@runtime_checkable
class AIProviderPort(Protocol):
    """The ONE AI seam. `adapters/openai` is one implementation of it."""

    provider_name: str

    def status(self) -> ProviderStatus: ...

    def generate(self, request: AIRequest) -> AIResult: ...


# --------------------------------------------------------------------------
# Messaging — B14_15. There is exactly ONE send path and its actor is a human.
# The port has no field, flag or method that admits an autonomous sender.
# --------------------------------------------------------------------------


@dataclass(frozen=True)
class OutboundMessageRequest:
    to_phone: str
    body: str = ""
    kind: str = "text"  # 'text' | 'template'
    template_name: str = ""
    template_language: str = ""
    template_variables: tuple[str, ...] = ()


@dataclass(frozen=True)
class OutboundMessageResult:
    provider_message_id: str
    accepted: bool = True


@dataclass(frozen=True)
class InboundMessage:
    """One normalized inbound message extracted from a provider callback."""

    provider_message_id: str
    from_phone: str
    body: str = ""
    kind: str = "text"
    occurred_at: datetime | None = None
    profile_name: str = ""
    provider_account_id: str = ""


@dataclass(frozen=True)
class InboundStatus:
    """One normalized delivery-status callback."""

    provider_message_id: str
    status: str  # 'sent' | 'delivered' | 'read' | 'failed'
    occurred_at: datetime | None = None
    recipient_phone: str = ""
    error_class: str = ""


@dataclass(frozen=True)
class WebhookEnvelope:
    """The normalized result of parsing ONE provider callback body."""

    provider_event_identity: str
    messages: tuple[InboundMessage, ...] = ()
    statuses: tuple[InboundStatus, ...] = ()
    unsupported: bool = False


@runtime_checkable
class WhatsAppProviderPort(Protocol):
    """Outbound send + inbound normalization + signature verification.

    Signature verification lives in the ADAPTER because the scheme is the
    provider's; the DOMAIN only ever learns true or false (B14_15 §3).
    """

    provider_name: str

    def status(self) -> ProviderStatus: ...

    def verify_signature(self, *, raw_body: bytes, signature_header: str) -> bool: ...

    def verify_subscription(self, *, mode: str, token: str, challenge: str) -> str | None: ...

    def parse_webhook(self, raw_body: bytes) -> WebhookEnvelope: ...

    def send(self, request: OutboundMessageRequest) -> OutboundMessageResult: ...


# --------------------------------------------------------------------------
# Bindings. config/ supplies the implementations; common/ imports no adapter
# and no app, so this file stays L0 (T-ARCH-8).
# --------------------------------------------------------------------------


class _ProviderBindings:
    place_search: PlaceSearchPort | None = None
    scraping: ScrapingProviderPort | None = None
    ai: AIProviderPort | None = None
    whatsapp: WhatsAppProviderPort | None = None

    def bind(self, **adapters: Any) -> None:
        for name, adapter in adapters.items():
            setattr(self, name, adapter)

    def require(self, name: str) -> Any:
        adapter = getattr(self, name, None)
        if adapter is None:
            # Fail CLOSED and in the provider vocabulary: an unbound provider is
            # indistinguishable, to a domain, from an unconfigured one.
            raise ProviderNotConfigured(f"No {name} provider is bound.", provider=name)
        return adapter


providers = _ProviderBindings()


__all__ = [
    "NOT_CONNECTED",
    "NOT_CONFIGURED",
    "CONFIGURED",
    "ENABLED",
    "DISABLED",
    "ProviderStatus",
    "ProviderError",
    "ProviderNotConfigured",
    "ProviderTimeout",
    "ProviderRateLimited",
    "ProviderTemporaryFailure",
    "ProviderPermanentFailure",
    "ProviderInvalidResponse",
    "ProviderUnknownOutcome",
    "NormalizedBusinessResult",
    "PlaceSearchRequest",
    "PlaceSearchPage",
    "PlaceSearchPort",
    "ScrapingProviderPort",
    "AI_INTENTS",
    "INTENT_DRAFT_REPLY",
    "INTENT_SUMMARIZE_CONVERSATION",
    "INTENT_ANSWER_FROM_KNOWLEDGE",
    "INTENT_QUALIFY_LEAD",
    "INTENT_PROPOSE_ACTION",
    "AICitation",
    "AIUsage",
    "AIRequest",
    "AIResult",
    "AIProviderPort",
    "OutboundMessageRequest",
    "OutboundMessageResult",
    "InboundMessage",
    "InboundStatus",
    "WebhookEnvelope",
    "WhatsAppProviderPort",
    "providers",
]

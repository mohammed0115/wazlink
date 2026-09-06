"""Tap Payments adapter — implements `PaymentProviderPort`.

**Provider facts RE-VERIFIED against official Tap documentation in-slice**
(`developers.tap.company`, read 2026-09-06 — the `B14_33` §3 / `FI-B12-12`
re-verification this slice owes). Each fact carries its frozen `B8-X-*` id:

*   **`B8-X-002` Authentication.** `Authorization: Bearer <secret key>` on every
    server-to-Tap request. Confirmed.
*   **`B8-X-003` Charge creation.** `POST /v2/charges` with `amount`,
    `currency`, `customer`, `source`, `redirect.url`, `post.url` and
    `reference.idempotent`. Confirmed.
*   **`B8-X-006` Idempotency.** A **body field**, not a header:
    `reference.idempotent`, valid **24 hours**, covering Authorize, Charges and
    Refunds. Re-fetched 2026-09-06 and confirmed verbatim. WazLink derives it
    from `Payment.public_id`, never from client input.
*   **`B8-X-007` Webhook authenticity.** Header **`hashstring`**, HMAC-SHA256
    over the fixed concatenation
    `x_id[..]x_amount[..]x_currency[..]x_gateway_reference[..]x_payment_reference[..]x_status[..]x_created[..]`,
    keyed by the **secret API key** (not a separate signing secret). Tap makes
    **three** delivery attempts total. Re-fetched 2026-09-06 and confirmed
    verbatim, including the field order.
*   **`B8-X-010` Retrieve.** `GET /v2/charges/{id}` returns the same shape.
*   **`B8-X-005a` Status codes.** The charge/authorize code table below.
*   **`B8-X-011` Redirect.** A redirect **does not prove payment** — Tap's own
    documentation requires a retrieve call. Nothing here mutates on redirect.

Everything above stops in this file. `apps/billing` sees `ChargeResult`,
`RefundResult` and `PaymentWebhookEvent` and cannot tell Tap was involved.
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os

from adapters.http import DEFAULT_TIMEOUT_SECONDS, as_dict, post_json
from common.provider_ports import (
    CONFIGURED,
    NOT_CONFIGURED,
    PAYMENT_AUTHORIZED,
    PAYMENT_CANCELLED,
    PAYMENT_CAPTURED,
    PAYMENT_FAILED,
    PAYMENT_PENDING,
    ChargeRequest,
    ChargeResult,
    PaymentWebhookEvent,
    ProviderInvalidResponse,
    ProviderNotConfigured,
    ProviderStatus,
    RefundResult,
)

PROVIDER_NAME = "tap"
# REFERENCE NAMES. No value is ever stored, logged or returned (B14_13).
CREDENTIAL_REFS = ("TAP_SECRET_KEY",)
DEFAULT_API_BASE = "https://api.tap.company"

# `B8-X-005a` — Tap's charge/authorize codes mapped onto the eight
# provider-neutral statuses. This table is the ONLY place Tap's vocabulary
# exists. Anything absent from it falls to the fail-closed branch below.
CHARGE_CODE_MAP: dict[str, str] = {
    "000": PAYMENT_CAPTURED,
    "001": PAYMENT_AUTHORIZED,
    "100": PAYMENT_PENDING,
    "301": PAYMENT_CANCELLED,  # Abandoned
    "302": PAYMENT_CANCELLED,  # Canceled
    "303": PAYMENT_PENDING,  # Deferred
    "601": PAYMENT_CANCELLED,  # Void
}
# Failure families, matched by prefix range rather than enumerating 40 codes.
_FAILED_PREFIXES = ("4", "5", "7")
# `304` Expired, `801` Timed Out, `901` Unknown — the FAIL-CLOSED set. They map
# to `pending` PLUS a reconciliation flag, never to captured or failed.
_UNKNOWN_CODES = frozenset({"304", "801", "901"})

# Tap's own textual statuses, which the webhook sends rather than the code.
CHARGE_STATUS_MAP: dict[str, str] = {
    "CAPTURED": PAYMENT_CAPTURED,
    "AUTHORIZED": PAYMENT_AUTHORIZED,
    "INITIATED": PAYMENT_PENDING,
    "DEFERRED": PAYMENT_PENDING,
    "ABANDONED": PAYMENT_CANCELLED,
    "CANCELLED": PAYMENT_CANCELLED,
    "CANCELED": PAYMENT_CANCELLED,
    "VOID": PAYMENT_CANCELLED,
    "FAILED": PAYMENT_FAILED,
    "DECLINED": PAYMENT_FAILED,
    "RESTRICTED": PAYMENT_FAILED,
}
_UNKNOWN_STATUSES = frozenset({"UNKNOWN", "TIMEDOUT", "TIMED_OUT", "EXPIRED", "INPROGRESS"})

# The exact signed-field order of `B8-X-007`. Order is load-bearing: a
# different order produces a different digest and every webhook would fail.
HASHSTRING_FIELDS = (
    ("x_id", "id"),
    ("x_amount", "amount"),
    ("x_currency", "currency"),
    ("x_gateway_reference", "gateway_reference"),
    ("x_payment_reference", "payment_reference"),
    ("x_status", "status"),
    ("x_created", "created"),
)


def _env(name: str) -> str:
    return (os.environ.get(name) or "").strip()


def normalize_status(*, code: str = "", status: str = "") -> tuple[str, bool]:
    """Map Tap's vocabulary onto WazLink's. Returns `(status, needs_recon)`.

    Module level, and shared by the real adapter and the stub, so the stub
    cannot drift from the thing it stands in for.

    The fail-closed rule of `B8_PAYMENT_PROVIDER_PORT` §3 lives HERE and is the
    default branch rather than a special case: anything this table does not
    recognize becomes `pending` + reconciliation. There is no code path from an
    unrecognized provider status to `captured` or `failed`.
    """
    text = (status or "").strip().upper().replace(" ", "")
    if text in _UNKNOWN_STATUSES:
        return PAYMENT_PENDING, True
    if text in CHARGE_STATUS_MAP:
        return CHARGE_STATUS_MAP[text], False

    digits = (code or "").strip()
    if digits in _UNKNOWN_CODES:
        return PAYMENT_PENDING, True
    if digits in CHARGE_CODE_MAP:
        return CHARGE_CODE_MAP[digits], False
    if digits[:1] in _FAILED_PREFIXES and digits.isdigit():
        return PAYMENT_FAILED, False

    # Unrecognized. Fail closed and demand a human/reconciliation look.
    return PAYMENT_PENDING, True


def _amount_text(value: object) -> str:
    """Provider amounts become decimal STRINGS. A float never enters the domain."""
    if value is None:
        return ""
    return str(value).strip()


def build_hashstring_payload(event: dict) -> str:
    """The exact concatenation `B8-X-007` specifies, in its documented order."""
    parts = []
    for label, key in HASHSTRING_FIELDS:
        parts.append(f"{label}[{event.get(key, '')}]")
    return "".join(parts)


def _webhook_fields(payload: dict) -> dict:
    """Pull the signed fields out of a Tap callback body.

    Tap nests the two reference values under `reference`; the rest are top
    level. Only these seven are read — `B8_WEBHOOK_MODEL` §8's minimal-payload
    rule means the rest of the body is never retained or interpreted.
    """
    reference = as_dict(payload.get("reference"))
    return {
        "id": str(payload.get("id") or ""),
        "amount": _amount_text(payload.get("amount")),
        "currency": str(payload.get("currency") or ""),
        "gateway_reference": str(reference.get("gateway") or ""),
        "payment_reference": str(reference.get("payment") or ""),
        "status": str(payload.get("status") or ""),
        "created": str(payload.get("transaction", {}).get("created") or payload.get("created") or ""),
    }


def parse_callback(raw_body: bytes) -> PaymentWebhookEvent:
    """Normalize ONE Tap callback. Shared by the real adapter and the stub.

    Never raises on an unrecognized body shape: `unsupported=True` is returned
    so the gateway can answer `200` rather than inviting an infinite redelivery
    loop for something WazLink will never understand.
    """
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except (ValueError, UnicodeDecodeError):
        raise ProviderInvalidResponse(
            "The callback body was not valid JSON.", provider=PROVIDER_NAME
        ) from None
    if not isinstance(payload, dict):
        raise ProviderInvalidResponse("The callback body was not an object.", provider=PROVIDER_NAME)

    fields = _webhook_fields(payload)
    charge_id = fields["id"]
    if not charge_id:
        return PaymentWebhookEvent(provider_event_identity="", unsupported=True)

    response = as_dict(payload.get("response"))
    status, needs_recon = normalize_status(
        code=str(response.get("code") or ""), status=fields["status"]
    )
    customer = as_dict(payload.get("customer"))
    return PaymentWebhookEvent(
        # Tap has no separate event id; the charge id plus its reported status
        # IS the event identity, which is what makes a redelivery detectable.
        provider_event_identity=f"{charge_id}:{fields['status']}",
        provider_payment_ref=charge_id,
        provider_customer_ref=str(customer.get("id") or ""),
        status=status,
        amount=fields["amount"],
        currency=fields["currency"],
        requires_reconciliation=needs_recon,
    )


class TapAdapter:
    """The deployed implementation. Reads its credential AT CALL TIME."""

    provider_name = PROVIDER_NAME

    def __init__(self, *, api_base: str = "", timeout: float = DEFAULT_TIMEOUT_SECONDS):
        self._api_base = (api_base or _env("TAP_API_BASE") or DEFAULT_API_BASE).rstrip("/")
        self._timeout = timeout

    # -- configuration ----------------------------------------------------
    def status(self) -> ProviderStatus:
        configured = bool(_env("TAP_SECRET_KEY"))
        return ProviderStatus(
            provider=PROVIDER_NAME,
            status=CONFIGURED if configured else NOT_CONFIGURED,
            configuration_valid=configured,
            credential_refs=CREDENTIAL_REFS,
        )

    def _secret(self) -> str:
        value = _env("TAP_SECRET_KEY")
        if not value:
            raise ProviderNotConfigured("Tap payments are not configured.", provider=PROVIDER_NAME)
        return value

    def _headers(self) -> dict[str, str]:
        # `B8-X-002`. Built per call and never stored.
        return {"Authorization": f"Bearer {self._secret()}"}

    # -- operations -------------------------------------------------------
    def ensure_customer(self, *, workspace_ref: str, email: str = "", name: str = "") -> str:
        payload = post_json(
            f"{self._api_base}/v2/customers",
            headers=self._headers(),
            body={
                "first_name": (name or workspace_ref)[:60],
                "email": email or f"billing+{workspace_ref.lower()}@wazlink.invalid",
            },
            timeout=self._timeout,
            provider=PROVIDER_NAME,
        )
        customer_id = str(payload.get("id") or "")
        if not customer_id:
            raise ProviderInvalidResponse("Tap returned no customer id.", provider=PROVIDER_NAME)
        return customer_id

    def create_charge(self, request: ChargeRequest) -> ChargeResult:
        payload = post_json(
            f"{self._api_base}/v2/charges",
            headers=self._headers(),
            body={
                "amount": request.amount,
                "currency": request.currency,
                "customer": {"id": request.customer_ref},
                "source": {"id": "src_all"},
                "description": request.description[:200],
                "redirect": {"url": request.redirect_url},
                "post": {"url": request.webhook_url},
                # `B8-X-006` — derived from PAY-*, never from client input.
                "reference": {"idempotent": request.payment_ref},
            },
            timeout=self._timeout,
            provider=PROVIDER_NAME,
        )
        return self._charge_result(payload)

    def retrieve_charge(self, provider_payment_ref: str) -> ChargeResult:
        # `B8-X-010`. A GET is expressed through the same bounded helper by
        # POSTing nothing would be wrong, so urllib is used directly with the
        # same deadline and the same closed error classes.
        import urllib.error  # noqa: PLC0415
        import urllib.request  # noqa: PLC0415

        from adapters.http import _classify_status  # noqa: PLC0415
        from common.provider_ports import ProviderTemporaryFailure, ProviderTimeout  # noqa: PLC0415

        req = urllib.request.Request(  # noqa: S310
            f"{self._api_base}/v2/charges/{provider_payment_ref}",
            headers=self._headers(),
            method="GET",
        )
        try:
            with urllib.request.urlopen(req, timeout=self._timeout) as response:  # noqa: S310
                raw = response.read(2_000_000)
        except urllib.error.HTTPError as exc:
            raise _classify_status(exc.code, PROVIDER_NAME) from None
        except TimeoutError:
            raise ProviderTimeout("The provider did not answer in time.", provider=PROVIDER_NAME) from None
        except urllib.error.URLError:
            raise ProviderTemporaryFailure("The provider was unreachable.", provider=PROVIDER_NAME) from None
        try:
            payload = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            raise ProviderInvalidResponse(
                "The provider response was not valid JSON.", provider=PROVIDER_NAME
            ) from None
        if not isinstance(payload, dict):
            raise ProviderInvalidResponse("The provider response was not an object.", provider=PROVIDER_NAME)
        return self._charge_result(payload)

    def create_refund(
        self, *, provider_payment_ref: str, amount: str, currency: str, reason: str
    ) -> RefundResult:
        payload = post_json(
            f"{self._api_base}/v2/refunds",
            headers=self._headers(),
            body={
                "charge_id": provider_payment_ref,
                "amount": amount,
                "currency": currency,
                "reason": reason,
                "reference": {"idempotent": f"{provider_payment_ref}:{amount}"},
            },
            timeout=self._timeout,
            provider=PROVIDER_NAME,
        )
        raw_status = str(payload.get("status") or "").upper()
        if raw_status == "REFUNDED":
            status = "refunded"
        elif raw_status in ("PENDING", "INPROGRESS", "IN_PROGRESS"):
            status = "pending"
        else:
            status = "failed"
        return RefundResult(
            provider_refund_ref=str(payload.get("id") or ""),
            status=status,
            amount=_amount_text(payload.get("amount")),
            currency=str(payload.get("currency") or ""),
        )

    def verify_webhook(self, *, raw_body: bytes, headers: dict[str, str]) -> bool:
        """`B8-X-007`. Runs on RAW BYTES, before any domain parse."""
        provided = (headers.get("hashstring") or headers.get("HTTP_HASHSTRING") or "").strip()
        if not provided:
            return False
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return False
        if not isinstance(payload, dict):
            return False
        try:
            secret = self._secret()
        except ProviderNotConfigured:
            # Unconfigured verifies NOTHING. It never returns True.
            return False
        expected = hmac.new(
            secret.encode(), build_hashstring_payload(_webhook_fields(payload)).encode(), hashlib.sha256
        ).hexdigest()
        return hmac.compare_digest(expected, provided)

    def parse_webhook(self, raw_body: bytes) -> PaymentWebhookEvent:
        return parse_callback(raw_body)

    # -- internals --------------------------------------------------------
    def _charge_result(self, payload: dict) -> ChargeResult:
        charge_id = str(payload.get("id") or "")
        if not charge_id:
            raise ProviderInvalidResponse("Tap returned no charge id.", provider=PROVIDER_NAME)
        response = as_dict(payload.get("response"))
        status, needs_recon = normalize_status(
            code=str(response.get("code") or ""), status=str(payload.get("status") or "")
        )
        return ChargeResult(
            provider_payment_ref=charge_id,
            status=status,
            requires_reconciliation=needs_recon,
            amount=_amount_text(payload.get("amount")),
            currency=str(payload.get("currency") or ""),
        )


class StubTapAdapter:
    """Deterministic test double satisfying the SAME port (LSP, B14_19).

    It signs with the same algorithm and normalizes with the same module-level
    functions the real adapter uses, so a test that passes here exercises the
    real contract rather than a convenient imitation of it.
    """

    provider_name = PROVIDER_NAME
    SECRET = "stub-tap-secret"

    def __init__(self, *, configured: bool = True):
        self._configured = configured
        self.charges: list[ChargeRequest] = []
        self._results: list[ChargeResult] = []
        self.refunds: list[dict] = []
        self.customers: list[str] = []
        self._counter = 0
        # Drives the next charge's normalized outcome without patching.
        self.next_status: str = "PENDING"
        self.next_error: Exception | None = None
        self.retrieve_status: str = "CAPTURED"

    def status(self) -> ProviderStatus:
        return ProviderStatus(
            provider=PROVIDER_NAME,
            status=CONFIGURED if self._configured else NOT_CONFIGURED,
            configuration_valid=self._configured,
            credential_refs=CREDENTIAL_REFS,
        )

    def _require(self) -> None:
        if not self._configured:
            raise ProviderNotConfigured("Tap payments are not configured.", provider=PROVIDER_NAME)

    def ensure_customer(self, *, workspace_ref: str, email: str = "", name: str = "") -> str:
        self._require()
        self.customers.append(workspace_ref)
        return f"cus_stub_{workspace_ref}"

    def create_charge(self, request: ChargeRequest) -> ChargeResult:
        self._require()
        if self.next_error is not None:
            error, self.next_error = self.next_error, None
            raise error
        # Tap's own 24h idempotency, modelled: the SAME `reference.idempotent`
        # returns the ORIGINAL charge rather than creating a second one.
        for previous, result in zip(self.charges, self._results, strict=False):
            if previous.payment_ref == request.payment_ref:
                return result
        self.charges.append(request)
        self._counter += 1
        status, needs_recon = normalize_status(status=self.next_status)
        result = ChargeResult(
            provider_payment_ref=f"chg_stub_{self._counter}",
            status=status,
            requires_reconciliation=needs_recon,
            amount=request.amount,
            currency=request.currency,
        )
        self._results.append(result)
        return result

    def retrieve_charge(self, provider_payment_ref: str) -> ChargeResult:
        self._require()
        status, needs_recon = normalize_status(status=self.retrieve_status)
        return ChargeResult(
            provider_payment_ref=provider_payment_ref,
            status=status,
            requires_reconciliation=needs_recon,
        )

    def create_refund(
        self, *, provider_payment_ref: str, amount: str, currency: str, reason: str
    ) -> RefundResult:
        self._require()
        self.refunds.append({"ref": provider_payment_ref, "amount": amount, "reason": reason})
        return RefundResult(
            provider_refund_ref=f"re_stub_{len(self.refunds)}",
            status="refunded",
            amount=amount,
            currency=currency,
        )

    @classmethod
    def sign(cls, raw_body: bytes) -> str:
        """Produce the header a genuine Tap caller would send."""
        payload = json.loads(raw_body.decode("utf-8"))
        return hmac.new(
            cls.SECRET.encode(), build_hashstring_payload(_webhook_fields(payload)).encode(), hashlib.sha256
        ).hexdigest()

    def verify_webhook(self, *, raw_body: bytes, headers: dict[str, str]) -> bool:
        if not self._configured:
            return False
        provided = (headers.get("hashstring") or "").strip()
        if not provided:
            return False
        try:
            payload = json.loads(raw_body.decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            return False
        if not isinstance(payload, dict):
            return False
        expected = hmac.new(
            self.SECRET.encode(),
            build_hashstring_payload(_webhook_fields(payload)).encode(),
            hashlib.sha256,
        ).hexdigest()
        return hmac.compare_digest(expected, provided)

    def parse_webhook(self, raw_body: bytes) -> PaymentWebhookEvent:
        return parse_callback(raw_body)


__all__ = [
    "TapAdapter",
    "StubTapAdapter",
    "parse_callback",
    "normalize_status",
    "build_hashstring_payload",
    "PROVIDER_NAME",
    "CREDENTIAL_REFS",
    "CHARGE_CODE_MAP",
]

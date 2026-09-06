"""Google Places adapter — implements PlaceSearchPort (B14_16 §3, ID-02).

**Provider facts verified against official Google documentation during I3**
(`developers.google.com/maps/documentation/places/web-service/text-search`,
read 2026-09-06 — the `ID-02` in-slice verification this slice owes):

*   `POST https://places.googleapis.com/v1/places:searchText`.
*   API key in the `X-Goog-Api-Key` header.
*   **`X-Goog-FieldMask` is mandatory.** There is no default field list; a
    request that omits the mask is an error. The mask is therefore built from
    the normalized contract itself, so a field WazLink does not map is a field
    WazLink never asks for or pays for.
*   Body: `textQuery`, `pageSize` (1–20), `pageToken`, plus optional
    `languageCode` / `regionCode`.
*   Response: `places[]` carrying `id`, `displayName.text`, `formattedAddress`,
    `location.{latitude,longitude}`, `nationalPhoneNumber`,
    `internationalPhoneNumber`, `websiteUri`, `rating`, `userRatingCount`,
    `types[]`; plus `nextPageToken`. Paging is capped at 60 results upstream.

Nothing above leaks past `normalize()`: the domain receives
`NormalizedBusinessResult` and has no way to observe that Google was involved.
"""

from __future__ import annotations

import os
from datetime import UTC, datetime

from adapters.http import DEFAULT_TIMEOUT_SECONDS, as_dict, post_json
from common.provider_ports import (
    CONFIGURED,
    NOT_CONFIGURED,
    NormalizedBusinessResult,
    PlaceSearchPage,
    PlaceSearchRequest,
    ProviderInvalidResponse,
    ProviderNotConfigured,
    ProviderStatus,
)

PROVIDER_NAME = "places"
CREDENTIAL_REF = "GOOGLE_PLACES_API_KEY"
SEARCH_TEXT_URL = "https://places.googleapis.com/v1/places:searchText"

# Exactly the fields the normalized contract maps — and not one more. Asking
# for a field WazLink cannot store would be paid-for data with nowhere to go
# (B14_16 §2, T-DISC-7).
FIELD_MASK = ",".join(
    (
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.location",
        "places.nationalPhoneNumber",
        "places.internationalPhoneNumber",
        "places.websiteUri",
        "places.rating",
        "places.userRatingCount",
        "places.types",
        "nextPageToken",
    )
)

# Google requires attribution wherever results are displayed. It travels as
# DATA on the page so no domain module hard-codes a vendor string.
ATTRIBUTION = "Powered by Google"

MAX_PAGE_SIZE = 20


def _api_key() -> str:
    return (os.environ.get(CREDENTIAL_REF) or "").strip()


def _text(value) -> str:
    return value.strip() if isinstance(value, str) else ""


def _number(value) -> float | None:
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) else None


def _city_from(address: str) -> str:
    """Google returns a formatted address, not a city field.

    The second-to-last comma part is the locality in Google's own formatting
    for the overwhelming majority of addresses. Where it is not, an empty city
    is the honest answer — a wrong city is worse than none.
    """
    parts = [part.strip() for part in address.split(",") if part.strip()]
    return parts[-2][:120] if len(parts) >= 2 else ""


class GooglePlacesAdapter:
    """Translation, normalization, error mapping, timeouts. Nothing else."""

    provider_name = PROVIDER_NAME

    def __init__(self, *, timeout: float = DEFAULT_TIMEOUT_SECONDS):
        self._timeout = timeout

    def status(self) -> ProviderStatus:
        """Key PRESENCE only — no network call, so status is always cheap.

        A missing key is `not_configured`, never an exception: Discovery
        becomes unavailable and every non-Discovery flow is untouched
        (`T-DISC-5`).
        """
        configured = bool(_api_key())
        return ProviderStatus(
            provider=PROVIDER_NAME,
            status=CONFIGURED if configured else NOT_CONFIGURED,
            configuration_valid=configured,
            credential_refs=(CREDENTIAL_REF,),
            detail="" if configured else "No API key is present in the environment.",
        )

    def search(self, request: PlaceSearchRequest) -> PlaceSearchPage:
        key = _api_key()
        if not key:
            raise ProviderNotConfigured("Place search is not configured.", provider=PROVIDER_NAME)

        query = " ".join(part for part in (request.term, request.location) if part).strip()
        if not query:
            raise ProviderInvalidResponse("An empty query cannot be searched.", provider=PROVIDER_NAME)

        body: dict[str, object] = {
            "textQuery": query,
            "pageSize": max(1, min(int(request.page_size or MAX_PAGE_SIZE), MAX_PAGE_SIZE)),
        }
        if request.page_token:
            body["pageToken"] = request.page_token
        if request.language_code:
            body["languageCode"] = request.language_code
        if request.region_code:
            body["regionCode"] = request.region_code

        payload = post_json(
            SEARCH_TEXT_URL,
            headers={"X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELD_MASK},
            body=body,
            timeout=self._timeout,
            provider=PROVIDER_NAME,
        )
        return self.normalize(payload)

    def normalize(self, payload: dict) -> PlaceSearchPage:
        """Provider shape -> WazLink shape. Public so a test can drive it alone."""
        raw_places = payload.get("places")
        if raw_places is None:
            raw_places = []
        if not isinstance(raw_places, list):
            raise ProviderInvalidResponse("The provider result set was malformed.", provider=PROVIDER_NAME)

        observed_at = datetime.now(UTC)
        results = []
        for raw in raw_places:
            if not isinstance(raw, dict):
                continue
            external_id = _text(raw.get("id"))
            display = raw.get("displayName")
            name = _text(as_dict(display).get("text")) if isinstance(display, dict) else _text(display)
            # Identity and a name are the two things WazLink cannot invent. A
            # record missing either is SKIPPED, never persisted half-formed.
            if not external_id or not name:
                continue

            location = as_dict(raw.get("location"))
            types = raw.get("types")
            address = _text(raw.get("formattedAddress"))
            review_count = raw.get("userRatingCount")

            results.append(
                NormalizedBusinessResult(
                    provider_external_id=external_id[:200],
                    name=name[:250],
                    source_provider=PROVIDER_NAME,
                    observed_at=observed_at,
                    category=(_text(types[0])[:120] if isinstance(types, list) and types else ""),
                    address_text=address[:400],
                    city=_city_from(address),
                    latitude=_number(location.get("latitude")),
                    longitude=_number(location.get("longitude")),
                    phone=(
                        _text(raw.get("internationalPhoneNumber"))
                        or _text(raw.get("nationalPhoneNumber"))
                    )[:40],
                    website=_text(raw.get("websiteUri"))[:400],
                    rating=_number(raw.get("rating")),
                    review_count=int(review_count) if isinstance(review_count, int) else None,
                )
            )

        return PlaceSearchPage(
            results=tuple(results),
            next_page_token=_text(payload.get("nextPageToken")),
            attribution=ATTRIBUTION,
        )


class StubPlaceSearchAdapter:
    """A DETERMINISTIC fake behind the identical port (T-DISC-2, LSP).

    This is not a mock of the domain: it is a second, complete implementation
    of `PlaceSearchPort`. Every discovery test runs against it with no domain
    module, migration or assertion changed, which is the whole evidence that
    the port is a real boundary. It performs NO network I/O, so no test can
    reach the internet by accident.
    """

    provider_name = PROVIDER_NAME

    def __init__(self, *, results_per_query: int = 3, configured: bool = True):
        self._per_query = results_per_query
        self._configured = configured
        self.calls: list[PlaceSearchRequest] = []

    def status(self) -> ProviderStatus:
        return ProviderStatus(
            provider=PROVIDER_NAME,
            status=CONFIGURED if self._configured else NOT_CONFIGURED,
            configuration_valid=self._configured,
            credential_refs=(CREDENTIAL_REF,),
        )

    def search(self, request: PlaceSearchRequest) -> PlaceSearchPage:
        self.calls.append(request)
        if not self._configured:
            raise ProviderNotConfigured("Place search is not configured.", provider=PROVIDER_NAME)

        observed_at = datetime.now(UTC)
        slug = (request.term or "q").strip().lower().replace(" ", "-")[:40]
        place = (request.location or "").strip()
        # The SAME query yields the SAME provider_external_id set, which is what
        # lets a re-run prove upsert-not-duplicate rather than merely not crash.
        results = tuple(
            NormalizedBusinessResult(
                provider_external_id=f"stub:{slug}:{place.lower()}:{index}",
                name=f"{request.term.title()} {index}",
                source_provider=PROVIDER_NAME,
                observed_at=observed_at,
                category=slug[:120],
                address_text=f"{index} Example Street, {place}" if place else f"{index} Example Street",
                city=place[:120],
                latitude=24.7 + index / 1000,
                longitude=46.7 + index / 1000,
                phone=f"+96650000{index:04d}",
                website=f"https://example.test/{slug}/{index}",
                rating=4.0,
                review_count=10 + index,
            )
            for index in range(self._per_query)
        )
        return PlaceSearchPage(results=results, next_page_token="", attribution="Stub attribution")


__all__ = [
    "GooglePlacesAdapter",
    "StubPlaceSearchAdapter",
    "PROVIDER_NAME",
    "CREDENTIAL_REF",
    "FIELD_MASK",
    "SEARCH_TEXT_URL",
    "ATTRIBUTION",
]

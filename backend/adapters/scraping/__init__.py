"""Scraping / enrichment adapter — VENDOR DELIBERATELY UNSELECTED.

Frozen `B12-D-B005` leaves the scraping webhook verification scheme open, and
frozen `B12-D-A054` forbids ENABLING this connection until a scheme exists.
`B14_16` §4 records that B14 selects no vendor and invents no contract.

So this file implements the port **honestly**: the seam is complete, the
normalized contract is fixed, and the vendor half is absent rather than
guessed. `verification_scheme_available()` returns `False` and is what
`EnableIntegration` consults — the refusal is a fact the adapter states, not a
policy an operator is trusted to remember (`T-DISC-6`).

Choosing a vendor means writing a sibling class here. It means changing no
domain module, no migration, no DTO and no test.
"""

from __future__ import annotations

import os

from common.provider_ports import (
    CONFIGURED,
    NOT_CONFIGURED,
    PlaceSearchPage,
    PlaceSearchRequest,
    ProviderNotConfigured,
    ProviderStatus,
)

PROVIDER_NAME = "scraping"
CREDENTIAL_REFS = (
    "SCRAPING_PROVIDER",
    "SCRAPING_API_KEY",
    "SCRAPING_BASE_URL",
    "SCRAPING_WEBHOOK_SECRET",
)


class UnselectedScrapingAdapter:
    """The bound default. Configured or not, it can never become `enabled`."""

    provider_name = PROVIDER_NAME

    def status(self) -> ProviderStatus:
        credentials_present = bool((os.environ.get("SCRAPING_API_KEY") or "").strip())
        # Credentials may legitimately be present; that is NOT sufficient.
        # `configuration_valid` stays False while no verification scheme exists,
        # which is precisely what keeps `enabled` unreachable.
        return ProviderStatus(
            provider=PROVIDER_NAME,
            status=CONFIGURED if credentials_present else NOT_CONFIGURED,
            configuration_valid=False,
            credential_refs=CREDENTIAL_REFS,
            detail="No webhook verification scheme is defined for this provider.",
        )

    def verification_scheme_available(self) -> bool:
        """False until a vendor and its verification scheme are chosen."""
        return False

    def search(self, request: PlaceSearchRequest) -> PlaceSearchPage:
        raise ProviderNotConfigured(
            "No scraping provider is selected.",
            provider=PROVIDER_NAME,
        )


__all__ = ["UnselectedScrapingAdapter", "PROVIDER_NAME", "CREDENTIAL_REFS"]

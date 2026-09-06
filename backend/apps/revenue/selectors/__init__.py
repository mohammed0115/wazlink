"""revenue read models. Every monetary response requires `revenue.view`.

That conjunction is enforced at the VIEW, per operation, rather than inferred
from today's role matrix (`B9-D-A038`): `analytics.view` is granted to `member`
and `viewer`, and a monetary field must never ride in on it.
"""

from __future__ import annotations

from decimal import Decimal

from ..models import RevenueAttribution, RevenueEvent, RevenueReversal


def revenue_events_for(workspace):
    return RevenueEvent.objects.filter(workspace=workspace).order_by("-recognized_at", "-public_id")


def revenue_event_payload(event: RevenueEvent) -> dict:
    """The frozen eight-field DTO shape. `idempotency_key` is stored, never returned."""
    return {
        "id": event.public_id,
        "source_type": event.source_type,
        "source_ref": {
            "entity_type": event.source_entity_type,
            "public_id": event.source_public_id,
        },
        "gross": {"amount": f"{event.gross_amount:.4f}", "currency": event.currency},
        "net": {"amount": f"{event.net_amount:.4f}", "currency": event.currency},
        "recognized_at": event.recognized_at,
        "status": event.status,
    }


def reversals_for(workspace, event: RevenueEvent | None = None):
    rows = RevenueReversal.objects.filter(workspace=workspace)
    if event is not None:
        rows = rows.filter(revenue_event=event)
    return rows.order_by("-reversed_at")


def reversal_payload(reversal: RevenueReversal) -> dict:
    return {
        "id": reversal.public_id,
        "revenue_event_ref": reversal.revenue_event.public_id,
        "gross": {"amount": f"{reversal.gross_amount:.4f}", "currency": reversal.currency},
        "net": {"amount": f"{reversal.net_amount:.4f}", "currency": reversal.currency},
        "reason": reversal.reason,
        "reversed_at": reversal.reversed_at,
    }


def revenue_summary(workspace) -> dict:
    """Recognized minus reversed, per currency. Read from `revenue_events` ONLY.

    It never unions `deals`, a pipeline value or a payment. That is not a
    filter applied to a wider query — the wider query is not written.
    """
    totals: dict[str, dict[str, Decimal]] = {}
    for event in RevenueEvent.objects.filter(workspace=workspace):
        bucket = totals.setdefault(
            event.currency, {"gross": Decimal("0"), "net": Decimal("0"), "reversed_net": Decimal("0")}
        )
        bucket["gross"] += event.gross_amount
        bucket["net"] += event.net_amount
    for reversal in RevenueReversal.objects.filter(workspace=workspace):
        bucket = totals.setdefault(
            reversal.currency,
            {"gross": Decimal("0"), "net": Decimal("0"), "reversed_net": Decimal("0")},
        )
        bucket["reversed_net"] += reversal.net_amount
    return {
        currency: {
            "gross": f"{amounts['gross']:.4f}",
            "net_recognized": f"{amounts['net']:.4f}",
            "net_reversed": f"{amounts['reversed_net']:.4f}",
            "net_outstanding": f"{amounts['net'] - amounts['reversed_net']:.4f}",
        }
        for currency, amounts in sorted(totals.items())
    }


def attribution_ladder(workspace) -> list[dict]:
    """Revenue grouped by acquisition channel, plus the unattributed bucket.

    An event with no attribution row is reported as `unattributed` — a real,
    expected outcome for a Track-B customer, never an error.
    """
    attributed: dict[str, Decimal] = {}
    attributed_events = set()
    for row in RevenueAttribution.objects.filter(workspace=workspace).select_related("revenue_event"):
        attributed_events.add(row.revenue_event_id)
        attributed[row.origin_kind] = attributed.get(row.origin_kind, Decimal("0")) + (
            row.revenue_event.net_amount
        )

    unattributed = Decimal("0")
    for event in RevenueEvent.objects.filter(workspace=workspace):
        if event.pk not in attributed_events:
            unattributed += event.net_amount

    ladder = [
        {"origin_kind": kind, "net": f"{amount:.4f}"} for kind, amount in sorted(attributed.items())
    ]
    ladder.append({"origin_kind": "unattributed", "net": f"{unattributed:.4f}"})
    return ladder


def revenue_refs_for_subject(workspace, subject_public_id: str) -> list[str]:
    """The Party360 `revenue_refs` section — IDENTITIES ONLY, never an amount.

    `T-P360-6`. The section exists so a 360 view can say "this party has
    recognized revenue"; the amounts stay behind `revenue.view`.
    """
    return list(
        RevenueEvent.objects.filter(workspace=workspace, source_public_id=subject_public_id)
        .order_by("-recognized_at")
        .values_list("public_id", flat=True)
    )


__all__ = [
    "revenue_events_for",
    "revenue_event_payload",
    "reversals_for",
    "reversal_payload",
    "revenue_summary",
    "attribution_ladder",
    "revenue_refs_for_subject",
]

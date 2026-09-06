"""revenue commands (L7) — B9, implemented.

Read the shape of this module before its details: it declares **no event
consumer, no signal receiver and no task that reacts to another domain**. That
absence is `B9-D-A002`, and it is the whole firewall. `DealWon` reaches no
handler here because there is no handler for it to reach.

Two amounts, two rules:

*   **Recognition takes `gross` and `net` from the CALLER**, because the frozen
    DTO makes both required inputs. B9 never reads `Deal.value`, and no default
    derives from one.
*   **Reversal takes `gross` ONLY.** `net` is DERIVED by a running-total
    allocation (`B9-D-A033`, §4.1). An earlier design that accepted both let a
    reversal exhaust the gross fold while leaving net revenue stranded on an
    event marked `reversed` — with its source released for re-recognition. The
    input that made that expressible does not exist here.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from django.db import IntegrityError, transaction
from django.utils import timezone

from common.audit import write_audit
from common.errors import DomainConflict, EntityNotFound, ValidationFailed
from common.outbox import publish_event

from ..models import (
    AMOUNT_PRODUCT_MAX,
    ORIGIN_KINDS,
    REVERSAL_REASONS,
    SOURCE_TYPES,
    STATUS_PARTIALLY_REVERSED,
    STATUS_RECOGNIZED,
    STATUS_REVERSED,
    TOUCHPOINT_SOURCE_TYPES,
    TOUCHPOINT_SUBJECTS,
    AttributionTouchpoint,
    RevenueAttribution,
    RevenueEvent,
    RevenueReversal,
)

QUANT = Decimal("0.0001")
# Platform-billing identities are categorically NOT customer revenue sources
# (`B9-AF-007`). The prefixes are named rather than pattern-guessed.
PLATFORM_BILLING_PREFIXES = ("PAY-", "INV-BILL-", "SUB-", "UPQ-")


def _money(value, field: str) -> Decimal:
    try:
        amount = Decimal(str(value))
    except (TypeError, ArithmeticError, ValueError):
        raise ValidationFailed(f"{field} is not a valid amount.") from None
    if amount != amount.quantize(QUANT, rounding=ROUND_HALF_UP):
        # Scale > 4 is rejected rather than silently rounded: a caller that
        # meant 4 places did not send 5, and one that sent 5 meant something.
        raise ValidationFailed(f"{field} carries more than four decimal places.")
    if amount > Decimal(str(AMOUNT_PRODUCT_MAX)):
        raise ValidationFailed(f"{field} exceeds the product amount limit.")
    return amount


def _cumulative_net(x: Decimal, *, gross: Decimal, net: Decimal) -> Decimal:
    """`ROUND_HALF_UP(x * N / G, 4)` — the running-total allocation.

    Deliberately NOT a per-reversal rounding of `Rg * N / G`: that accumulates
    error across reversals and can strand net on a fully-reversed event. Here
    each step corrects the last, so a reversal that exhausts gross takes
    exactly the residual net, and `Sum(Rn) = N` exactly.
    """
    return (x * net / gross).quantize(QUANT, rounding=ROUND_HALF_UP)


# --------------------------------------------------------------------------
# RecordRevenueEvent — human membership only
# --------------------------------------------------------------------------
@transaction.atomic
def record_revenue_event(
    *,
    context,
    source_type: str,
    source_entity_type: str,
    source_public_id: str,
    gross,
    net,
    currency: str,
    recognized_at=None,
    idempotency_key: str = "",
    note: str = "",
) -> RevenueEvent:
    """The ONE writer of `revenue_events`.

    `context.membership` is required and is a human workspace membership. There
    is no system-actor variant, no automation entry point and no event handler,
    which is what makes `AT-B7-2` structurally true rather than policed.
    """
    membership = getattr(context, "membership", None)
    if membership is None:
        raise ValidationFailed("Revenue recognition requires a human membership actor.")

    if source_type not in SOURCE_TYPES:
        raise ValidationFailed("That is not a recognized revenue source type.")
    entity_type = (source_entity_type or "").strip()
    public_id = (source_public_id or "").strip()
    if not entity_type or not public_id:
        raise ValidationFailed("A revenue source reference is required.")
    # `B9-AF-006`: the pair must agree.
    if source_type != entity_type:
        raise ValidationFailed("The source type and the source reference type disagree.")
    # `B9-AF-007`: platform billing is not customer revenue.
    if public_id.startswith(PLATFORM_BILLING_PREFIXES):
        raise ValidationFailed("A platform billing record is not a customer revenue source.")

    gross_amount = _money(gross, "gross")
    net_amount = _money(net, "net")
    if gross_amount <= 0 or net_amount <= 0:
        raise ValidationFailed("Recognized amounts must be greater than zero.")
    if net_amount > gross_amount:
        raise ValidationFailed("Net revenue cannot exceed gross revenue.")

    code = (currency or "").strip().upper()
    if len(code) != 3 or not code.isalpha():
        raise ValidationFailed("A three-letter ISO-4217 currency is required.")

    when = recognized_at or timezone.now()
    if when > timezone.now():
        raise ValidationFailed("Revenue cannot be recognized in the future.")

    key = (idempotency_key or "").strip() or f"{source_type}:{public_id}:{when.isoformat()}"

    existing = RevenueEvent.objects.filter(workspace=context.workspace, idempotency_key=key).first()
    if existing is not None:
        return existing  # replay returns the original, never a second row

    try:
        event = RevenueEvent.objects.create(
            workspace=context.workspace,
            source_type=source_type,
            source_entity_type=entity_type,
            source_public_id=public_id,
            gross_amount=gross_amount,
            net_amount=net_amount,
            currency=code,
            recognized_at=when,
            status=STATUS_RECOGNIZED,
            recognized_by_membership=membership,
            idempotency_key=key,
            note=note or "",
        )
    except IntegrityError:
        # Either the idempotency key or the source guard fired. Both mean the
        # recognition already exists; a duplicate is never created.
        duplicate = RevenueEvent.objects.filter(
            workspace=context.workspace, idempotency_key=key
        ).first()
        if duplicate is not None:
            return duplicate
        raise DomainConflict("This source already has recognized revenue.") from None

    _resolve_attribution(event=event)

    write_audit(
        workspace=context.workspace,
        actor_membership=membership,
        action="revenue.recognized",
        target_type="revenue_event",
        target_ref=event.public_id,
        # NO amount in the audit metadata: `B9_SECURITY_PRIVACY` keeps money
        # out of operational records; the event row IS the amount's home.
        metadata={"source_type": source_type, "source_ref": public_id},
    )
    publish_event(
        workspace=context.workspace,
        event_type="RevenueRecognized",
        aggregate_type="revenue_event",
        aggregate_ref=event.public_id,
        payload={"source_type": source_type, "source_ref": public_id, "currency": code},
    )
    return event


# --------------------------------------------------------------------------
# ReverseRevenueEvent — gross in, net derived
# --------------------------------------------------------------------------
@transaction.atomic
def reverse_revenue_event(
    *,
    context,
    event: RevenueEvent,
    gross,
    reason: str,
    evidence_ref: str = "",
    note: str = "",
    idempotency_key: str = "",
) -> RevenueReversal:
    """Append one reversal under the event's row lock and recompute `status`."""
    membership = getattr(context, "membership", None)
    if membership is None:
        raise ValidationFailed("Reversal requires a human membership actor.")
    if event.workspace_id != context.workspace.id:
        raise EntityNotFound("The requested revenue event was not found.")
    if reason not in REVERSAL_REASONS:
        raise ValidationFailed("That is not a recognized reversal reason.")

    # An idempotency key is REQUIRED and is never derived. A key synthesized
    # from `(event, amount, reason)` looks idempotent and is not: two genuinely
    # distinct reversals of the same amount for the same reason — an ordinary
    # thing when a refund is split — would collapse into one, and the second
    # would silently return the first. For a financial reversal that is worse
    # than refusing, so the caller supplies the key or the command declines.
    key = (idempotency_key or "").strip()
    if not key:
        raise ValidationFailed("A reversal requires an idempotency key.")
    existing = RevenueReversal.objects.filter(workspace=context.workspace, idempotency_key=key).first()
    if existing is not None:
        return existing

    # Lock the parent, THEN read both folds under that lock. Reading first
    # would let a competitor commit between the read and the insert.
    locked = RevenueEvent.objects.select_for_update().get(pk=event.pk)
    prior = RevenueReversal.objects.filter(revenue_event=locked)
    prior_gross = sum((row.gross_amount for row in prior), Decimal("0"))
    prior_net = sum((row.net_amount for row in prior), Decimal("0"))

    reversal_gross = _money(gross, "gross")
    if reversal_gross <= 0:
        raise ValidationFailed("A reversal amount must be greater than zero.")
    if prior_gross + reversal_gross > locked.gross_amount:
        raise ValidationFailed("A reversal cannot exceed the remaining recognized amount.")

    reversal_net = (
        _cumulative_net(
            prior_gross + reversal_gross, gross=locked.gross_amount, net=locked.net_amount
        )
        - prior_net
    )
    if reversal_net < 0:
        raise ValidationFailed("The derived net reversal is negative.")
    if reversal_net == 0 and prior_gross + reversal_gross < locked.gross_amount:
        # A non-terminal dust reversal. The ONLY legal zero-net row is the
        # terminal gross-cleanup, and this is not it.
        raise ValidationFailed("This reversal would allocate no net revenue.")

    reversal = RevenueReversal.objects.create(
        workspace=context.workspace,
        revenue_event=locked,
        gross_amount=reversal_gross,
        net_amount=reversal_net,
        currency=locked.currency,  # equality by construction, never by input
        reason=reason,
        evidence_ref=evidence_ref[:120],
        note=note or "",
        reversed_by_membership=membership,
        reversed_at=timezone.now(),
        idempotency_key=key,
    )

    total_gross = prior_gross + reversal_gross
    total_net = prior_net + reversal_net
    # `status` is DERIVED from both folds, never set. `reversed` requires BOTH
    # exhausted — a source is not released while any net value survives.
    if total_gross == locked.gross_amount and total_net == locked.net_amount:
        locked.status = STATUS_REVERSED
    elif total_gross > 0:
        locked.status = STATUS_PARTIALLY_REVERSED
    else:
        locked.status = STATUS_RECOGNIZED
    locked.save(update_fields=["status", "updated_at"])

    write_audit(
        workspace=context.workspace,
        actor_membership=membership,
        action="revenue.reversed",
        target_type="revenue_event",
        target_ref=locked.public_id,
        metadata={"reason": reason},
    )
    publish_event(
        workspace=context.workspace,
        event_type="RevenueReversed",
        aggregate_type="revenue_event",
        aggregate_ref=locked.public_id,
        payload={"reason": reason},
    )
    return reversal


# --------------------------------------------------------------------------
# RecordTouchpoint
# --------------------------------------------------------------------------
@transaction.atomic
def record_touchpoint(
    *,
    context,
    subject_type: str,
    subject_public_id: str,
    source_type: str,
    source_entity_type: str,
    source_public_id: str,
    origin_kind: str,
    occurred_at=None,
    position: int = 1,
    source_code: str = "",
    channel: str = "",
    campaign: str = "",
    idempotency_key: str = "",
) -> AttributionTouchpoint:
    membership = getattr(context, "membership", None)
    if membership is None:
        raise ValidationFailed("A touchpoint requires a human membership actor.")
    if subject_type not in TOUCHPOINT_SUBJECTS:
        raise ValidationFailed("That is not a recognized attribution subject.")
    if source_type not in TOUCHPOINT_SOURCE_TYPES:
        raise ValidationFailed("That is not a recognized attribution source.")
    if origin_kind not in ORIGIN_KINDS:
        raise ValidationFailed("That is not a recognized acquisition channel.")
    if int(position) < 1:
        raise ValidationFailed("A touchpoint position starts at one.")

    key = (idempotency_key or "").strip() or f"tp:{subject_public_id}:{position}"
    existing = AttributionTouchpoint.objects.filter(
        workspace=context.workspace, idempotency_key=key
    ).first()
    if existing is not None:
        return existing

    try:
        return AttributionTouchpoint.objects.create(
            workspace=context.workspace,
            subject_type=subject_type,
            subject_public_id=subject_public_id.strip(),
            source_type=source_type,
            source_entity_type=source_entity_type.strip(),
            source_public_id=source_public_id.strip(),
            origin_kind=origin_kind,
            source_code=(source_code or "")[:40],
            occurred_at=occurred_at or timezone.now(),
            position=int(position),
            channel=(channel or "")[:60],
            campaign=(campaign or "")[:120],
            recorded_by_membership=membership,
            idempotency_key=key,
        )
    except IntegrityError:
        raise DomainConflict("A touchpoint already occupies that position.") from None


# --------------------------------------------------------------------------
# First-touch resolution (B9_FIRST_TOUCH_MODEL)
# --------------------------------------------------------------------------
def _resolve_attribution(*, event: RevenueEvent) -> RevenueAttribution | None:
    """Snapshot the FIRST touch for this event, once, immutably.

    A Track-B customer — created manually, imported, or through the API, with
    no Discovery anywhere in its history — resolves to NO touchpoint. That is
    reported as **unattributed**, not as an error (`T-REV-5`, `AT-TRACK-3/4`):
    revenue recognition does not require an acquisition story, and refusing to
    recognize without one would make CRM-without-Discovery unusable.
    """
    subjects = [event.source_public_id]
    touchpoint = (
        AttributionTouchpoint.objects.filter(
            workspace=event.workspace, subject_public_id__in=subjects
        )
        .order_by("occurred_at", "position")
        .first()
    )
    if touchpoint is None:
        return None

    return RevenueAttribution.objects.create(
        revenue_event=event,
        workspace=event.workspace,
        touchpoint=touchpoint,
        candidate_kind="touchpoint",
        derived_result_public_id="",
        origin_kind=touchpoint.origin_kind,
        source_code=touchpoint.source_code,
        model="first_touch",
        allocation_bps=10000,
        source_type=event.source_type,
        source_entity_type=event.source_entity_type,
        source_public_id=event.source_public_id,
        discovery_job_public_id=(
            touchpoint.source_public_id if touchpoint.source_type == "discovery_job" else ""
        ),
        business_public_id=(
            touchpoint.subject_public_id if touchpoint.subject_type == "business" else ""
        ),
        lead_public_id=(touchpoint.subject_public_id if touchpoint.subject_type == "lead" else ""),
        deal_public_id=(event.source_public_id if event.source_type == "deal" else ""),
        acquired_at=touchpoint.occurred_at,
        resolved_at=timezone.now(),
    )


__all__ = [
    "record_revenue_event",
    "reverse_revenue_event",
    "record_touchpoint",
    "PLATFORM_BILLING_PREFIXES",
]

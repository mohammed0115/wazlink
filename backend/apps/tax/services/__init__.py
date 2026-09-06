"""tax commands (L5) — readiness only.

What this module deliberately does NOT do is as specified as what it does:

*   it computes **no** tax while applicability is `unknown` or
    `not_applicable` — the four-category rate model is fully expressed and
    simply yields zero, which is the correct answer for a seller with no
    obligation;
*   it builds **no** ZATCA adapter, generates no QR, signs nothing and clears
    nothing (`B14_18` defers it); and
*   it asserts **no** exemption on the owner's behalf. `unknown` is the
    bootstrap value, and only an explicit, reason-required, audited command
    moves off it.
"""

from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal

from django.db import transaction
from django.utils import timezone

from common.audit import write_audit
from common.errors import DomainConflict, ValidationFailed

from ..models import (
    INVOICE_ISSUED,
    TAX_CATEGORIES,
    ZATCA_APPLICABILITY,
    ZATCA_ENABLED,
    ZATCA_NOT_APPLICABLE,
    ZATCA_UNKNOWN,
    LegalEntity,
    TaxInvoice,
    TaxInvoiceLine,
    TaxProfile,
    TaxSubmission,
)

QUANT = Decimal("0.01")
DEFAULT_ENTITY_CODE = "WAZLINK"
# The standard KSA VAT rate, as DATA. Nothing computes with it while the
# profile says the seller has no obligation.
STANDARD_RATE_BPS = 1500


def bootstrap_legal_entity(*, code: str = DEFAULT_ENTITY_CODE, legal_name: str = "WazLink"):
    """Create the seller and its FIRST profile, at `unknown`.

    `unknown` rather than `not_applicable` is the whole point: the platform
    must be able to say it does not yet know, instead of encoding an
    unverified legal claim as architecture.
    """
    entity = LegalEntity.objects.filter(code=code).first()
    if entity is not None:
        return entity
    with transaction.atomic():
        entity = LegalEntity.objects.create(code=code, legal_name=legal_name)
        TaxProfile.objects.create(
            legal_entity=entity,
            version_number=1,
            is_current=True,
            zatca_applicability=ZATCA_UNKNOWN,
            effective_from=timezone.now(),
        )
    return entity


def current_profile(entity: LegalEntity) -> TaxProfile | None:
    return TaxProfile.objects.filter(legal_entity=entity, effective_to__isnull=True).first()


@transaction.atomic
def set_zatca_applicability(*, context, entity: LegalEntity, applicability: str, reason: str):
    """Move applicability by publishing a NEW profile version.

    A reason is MANDATORY, and the previous version is closed rather than
    edited — so a document issued under the old state keeps its own snapshot
    and is never retroactively reinterpreted (`B10-D-A008`).
    """
    if applicability not in ZATCA_APPLICABILITY:
        raise ValidationFailed("That is not a recognized ZATCA applicability state.")
    if not (reason or "").strip():
        # An applicability change without a stated reason is exactly the
        # unverified legal claim this model exists to prevent.
        raise ValidationFailed("An applicability change requires a stated reason.")

    now = timezone.now()
    previous = current_profile(entity)
    version_number = 1
    if previous is not None:
        if previous.zatca_applicability == applicability:
            return previous
        previous.effective_to = now
        previous.is_current = False
        previous.save(update_fields=["effective_to", "is_current", "updated_at"])
        version_number = previous.version_number + 1

    profile = TaxProfile.objects.create(
        legal_entity=entity,
        version_number=version_number,
        is_current=True,
        zatca_applicability=applicability,
        applicability_reason=reason.strip(),
        effective_from=now,
    )
    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="tax.applicability_changed",
        target_type="tax_profile",
        target_ref=entity.public_id,
        changed_fields=["zatca_applicability"],
        metadata={"to": applicability, "reason": reason.strip()[:200]},
    )
    return profile


def tax_rate_bps(*, profile: TaxProfile | None, category: str) -> int:
    """The four-category rate model.

    It computes nothing at all while the seller has no obligation — which is
    not a special case bolted on, but the model evaluated honestly for a
    profile that says so.
    """
    if category not in TAX_CATEGORIES:
        raise ValidationFailed("That is not a recognized tax category.")
    if profile is None or profile.zatca_applicability in (ZATCA_UNKNOWN, ZATCA_NOT_APPLICABLE):
        return 0
    return STANDARD_RATE_BPS if category == "standard" else 0


@transaction.atomic
def issue_tax_invoice(
    *,
    context,
    entity: LegalEntity,
    lines: list[dict],
    classification: str = "standard",
    document_kind: str = "invoice",
    billing_invoice_ref: str = "",
    currency: str = "SAR",
) -> TaxInvoice:
    """Issue one document. Rounding is per CATEGORY SUBTOTAL, then summed.

    That order is the `B10-FIX.1` correction: the official XML Implementation
    Standard rounds VAT once per tax-category subtotal and takes the document
    total as the sum of already-rounded category amounts. Rounding per line and
    summing gives a different — and wrong — total.
    """
    if not lines:
        raise ValidationFailed("A tax document needs at least one line.")
    profile = current_profile(entity)

    invoice = TaxInvoice.objects.create(
        workspace=context.workspace,
        legal_entity=entity,
        tax_profile=profile,
        document_kind=document_kind,
        invoice_classification=classification,
        status=INVOICE_ISSUED,
        currency=currency,
        issued_at=timezone.now(),
        billing_invoice_ref=billing_invoice_ref[:60],
        legal_sequence_number=_next_sequence(entity),
    )

    # Accumulate per CATEGORY, round once per category, then sum.
    by_category: dict[str, Decimal] = {}
    subtotal = Decimal("0")
    for raw in lines:
        category = raw.get("tax_category", "standard")
        quantity = Decimal(str(raw.get("quantity", 1)))
        unit_price = Decimal(str(raw.get("unit_price", 0)))
        line_subtotal = (quantity * unit_price).quantize(QUANT, rounding=ROUND_HALF_UP)
        rate = tax_rate_bps(profile=profile, category=category)
        by_category[category] = by_category.get(category, Decimal("0")) + line_subtotal
        subtotal += line_subtotal
        TaxInvoiceLine.objects.create(
            invoice=invoice,
            description=str(raw.get("description", ""))[:200],
            quantity=quantity,
            unit_price=unit_price,
            tax_category=category,
            tax_rate_bps=rate,
            line_subtotal=line_subtotal,
            # Per-line tax is recorded for transparency but is NOT what the
            # document total is built from.
            line_tax=(line_subtotal * Decimal(rate) / Decimal(10000)).quantize(
                QUANT, rounding=ROUND_HALF_UP
            ),
        )

    tax_total = Decimal("0")
    for category, category_subtotal in by_category.items():
        rate = tax_rate_bps(profile=profile, category=category)
        tax_total += (category_subtotal * Decimal(rate) / Decimal(10000)).quantize(
            QUANT, rounding=ROUND_HALF_UP
        )

    invoice.subtotal = subtotal
    invoice.tax_total = tax_total
    invoice.total = subtotal + tax_total
    invoice.save(update_fields=["subtotal", "tax_total", "total", "updated_at"])

    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="tax.invoice_issued",
        target_type="tax_invoice",
        target_ref=invoice.public_id,
        metadata={"classification": classification, "kind": document_kind},
    )
    return invoice


def _next_sequence(entity: LegalEntity) -> int:
    last = (
        TaxInvoice.objects.filter(legal_entity=entity, legal_sequence_number__isnull=False)
        .order_by("-legal_sequence_number")
        .first()
    )
    return (last.legal_sequence_number + 1) if last else 1


def submit_to_zatca(*, context, invoice: TaxInvoice) -> TaxSubmission:
    """The submission BOUNDARY. Deliberately inert in this wave.

    `B14_18` defers the ZATCA adapter, so there is nothing to call. Refusing
    while the profile is not `enabled` is the honest behaviour: pretending to
    submit would be worse than declining to, and inventing a clearance
    workflow nobody asked for is exactly the unsolicited scope this slice
    excludes.
    """
    profile = current_profile(invoice.legal_entity)
    if profile is None or profile.zatca_applicability != ZATCA_ENABLED:
        raise DomainConflict("ZATCA submission is not enabled for this legal entity.")
    # Routing is decided by CLASSIFICATION alone, never by credit-vs-debit.
    route = "clearance" if invoice.invoice_classification == "standard" else "reporting"
    attempt = TaxSubmission.objects.filter(invoice=invoice).count() + 1
    return TaxSubmission.objects.create(
        invoice=invoice, attempt_number=attempt, status="pending", route=route
    )


__all__ = [
    "bootstrap_legal_entity",
    "current_profile",
    "set_zatca_applicability",
    "tax_rate_bps",
    "issue_tax_invoice",
    "submit_to_zatca",
    "STANDARD_RATE_BPS",
]

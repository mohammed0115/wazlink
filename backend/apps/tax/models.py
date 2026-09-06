"""tax (L5) — the tax/invoice READINESS boundary (M22).

**Scope discipline first, because it is the point of this module.** The
programme's stated position is that the current operating entity is not
obligated to ZATCA e-invoicing today. B10's answer is not to hard-code that
claim, and not to build an integration nobody needs: it is a five-state
`zatca_applicability` model that can honestly represent *we don't know yet*.

    unknown -> not_applicable | applicable_not_enabled -> enabled -> suspended

A deployment BOOTSTRAPS AT `unknown` and moves to `not_applicable` only through
an explicit, owner-only, reason-required, audited action (`B10-D-A016`). This
module never asserts the exemption on the owner's behalf.

**No ZATCA adapter exists**, deliberately: `B14_18` defers it, and the three
`UNRESOLVED` research items (QR/XML/cryptographic-stamp encoding) sit entirely
inside that unbuilt adapter. Nothing here needs them, because the current
deployment never reaches `enabled`.

`LegalEntity`/`TaxProfile` are **platform-scoped, not workspace-scoped**
(`B10-D-A001`): applicability is a property of WazLink as seller, not of any
individual buyer workspace.

> **PAYMENT SUCCESS != TAX OBLIGATION != RECOGNIZED REVENUE.** This module has
> zero write path to `revenue_events` and zero write path to any B8 table.
"""

from __future__ import annotations

from django.db import models
from django.db.models import Q

from common.models import PublicIdModel, TimestampedModel

# `B10-D-A002`. Five states, and `unknown` is the honest bootstrap value.
ZATCA_UNKNOWN = "unknown"
ZATCA_NOT_APPLICABLE = "not_applicable"
ZATCA_APPLICABLE_NOT_ENABLED = "applicable_not_enabled"
ZATCA_ENABLED = "enabled"
ZATCA_SUSPENDED = "suspended"
ZATCA_APPLICABILITY = (
    ZATCA_UNKNOWN,
    ZATCA_NOT_APPLICABLE,
    ZATCA_APPLICABLE_NOT_ENABLED,
    ZATCA_ENABLED,
    ZATCA_SUSPENDED,
)

# The economic direction, and the ROUTING classification — two INDEPENDENT
# columns (`B10-FIX.1`). Routing is decided solely by `invoice_classification`;
# keying it on credit-vs-debit was the CRITICAL defect that fix corrected.
DOCUMENT_KINDS = ("invoice", "credit_note", "debit_note")
INVOICE_CLASSIFICATIONS = ("standard", "simplified")

TAX_CATEGORIES = ("standard", "zero_rated", "exempt", "out_of_scope")

INVOICE_DRAFT = "draft"
INVOICE_ISSUED = "issued"
INVOICE_CANCELLED = "cancelled"
TAX_INVOICE_STATUSES = (INVOICE_DRAFT, INVOICE_ISSUED, INVOICE_CANCELLED)

SUBMISSION_STATUSES = ("pending", "submitted", "accepted", "rejected", "failed")


class LegalEntity(PublicIdModel, TimestampedModel):
    """The SELLER. Platform-scoped — there is no `workspace` column by design."""

    PUBLIC_ID_PREFIX = "TAX"

    code = models.CharField(max_length=40, unique=True)
    legal_name = models.CharField(max_length=200)
    country_code = models.CharField(max_length=2, default="SA")
    vat_number = models.CharField(max_length=40, blank=True)

    class Meta:
        db_table = "legal_entities"


class TaxProfile(TimestampedModel):
    """A VERSIONED, snapshot-safe configuration row (`B10-D-A008`).

    Versioned rather than mutable so that a later applicability change never
    retroactively rewrites how a document already issued was treated.
    """

    legal_entity = models.ForeignKey(LegalEntity, on_delete=models.RESTRICT, related_name="profiles")
    version_number = models.PositiveIntegerField(default=1)
    is_current = models.BooleanField(default=True)
    zatca_applicability = models.CharField(max_length=30, default=ZATCA_UNKNOWN)
    # WHY it is what it is. Required by the command for any move off `unknown`.
    applicability_reason = models.TextField(blank=True)
    # An opaque SECRET-STORE POINTER. Never a certificate, never a plaintext
    # credential — the same discipline the Tap key follows.
    csid_secret_ref = models.CharField(max_length=80, blank=True)
    effective_from = models.DateTimeField()
    effective_to = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "tax_profiles"
        constraints = [
            models.UniqueConstraint(
                fields=["legal_entity", "version_number"], name="uq_tax_profile_version"
            ),
            models.UniqueConstraint(
                fields=["legal_entity"],
                condition=Q(effective_to__isnull=True),
                name="uq_tax_profile_current",
            ),
            models.CheckConstraint(
                condition=Q(zatca_applicability__in=ZATCA_APPLICABILITY),
                name="ck_tax_profile_applicability",
            ),
        ]


class TaxBuyerProfile(TimestampedModel):
    """The BUYER's tax identity, per workspace. Optional by design."""

    workspace = models.OneToOneField(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="tax_buyer_profile"
    )
    legal_name = models.CharField(max_length=200, blank=True)
    vat_number = models.CharField(max_length=40, blank=True)
    country_code = models.CharField(max_length=2, blank=True)

    class Meta:
        db_table = "tax_buyer_profiles"


class TaxInvoice(PublicIdModel, TimestampedModel):
    """Every document shape lives here — invoice, credit note, debit note.

    Two independent columns carry two independent facts, which is the
    `B10-FIX.1` correction: `document_kind` is the economic direction, and
    `invoice_classification` is the ZATCA routing determinant, inherited
    immutably by a note from the invoice it corrects.
    """

    PUBLIC_ID_PREFIX = "TAX"

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="tax_invoices"
    )
    legal_entity = models.ForeignKey(LegalEntity, on_delete=models.RESTRICT, related_name="invoices")
    tax_profile = models.ForeignKey(
        TaxProfile, on_delete=models.RESTRICT, related_name="invoices", null=True, blank=True
    )
    document_kind = models.CharField(max_length=20, default="invoice")
    invoice_classification = models.CharField(max_length=20, default="standard")
    corrects = models.ForeignKey(
        "self", on_delete=models.RESTRICT, related_name="corrections", null=True, blank=True
    )
    status = models.CharField(max_length=20, default=INVOICE_DRAFT)
    # A WazLink product/legal sequence. Explicitly NOT asserted to be ZATCA's
    # device-scoped Invoice Counter Value (`B10-FIX.1` corrected that
    # conflation); the two are different things with different scopes.
    legal_sequence_number = models.PositiveIntegerField(null=True, blank=True)
    currency = models.CharField(max_length=3, default="SAR")
    subtotal = models.DecimalField(max_digits=19, decimal_places=4, default=0)
    tax_total = models.DecimalField(max_digits=19, decimal_places=4, default=0)
    total = models.DecimalField(max_digits=19, decimal_places=4, default=0)
    issued_at = models.DateTimeField(null=True, blank=True)
    # The B8 platform invoice this document describes, by PUBLIC ID only —
    # a string, never a foreign key, because `Invoice (B8) != TaxInvoice (B10)`
    # and an FK would make the two look like one aggregate.
    billing_invoice_ref = models.CharField(max_length=60, blank=True)

    class Meta:
        db_table = "tax_invoices"
        indexes = [
            models.Index(fields=["workspace", "issued_at"]),
            models.Index(fields=["status"]),
        ]
        constraints = [
            models.CheckConstraint(
                condition=Q(document_kind__in=DOCUMENT_KINDS), name="ck_tax_invoice_kind"
            ),
            models.CheckConstraint(
                condition=Q(invoice_classification__in=INVOICE_CLASSIFICATIONS),
                name="ck_tax_invoice_classification",
            ),
            models.CheckConstraint(
                condition=Q(status__in=TAX_INVOICE_STATUSES), name="ck_tax_invoice_status"
            ),
            models.CheckConstraint(condition=Q(total__gte=0), name="ck_tax_invoice_total"),
            models.UniqueConstraint(
                fields=["legal_entity", "legal_sequence_number"],
                condition=Q(legal_sequence_number__isnull=False),
                name="uq_tax_invoice_sequence",
            ),
        ]


class TaxInvoiceLine(TimestampedModel):
    invoice = models.ForeignKey(TaxInvoice, on_delete=models.CASCADE, related_name="lines")
    description = models.CharField(max_length=200)
    quantity = models.DecimalField(max_digits=12, decimal_places=4, default=1)
    unit_price = models.DecimalField(max_digits=19, decimal_places=4, default=0)
    tax_category = models.CharField(max_length=20, default="standard")
    tax_rate_bps = models.PositiveIntegerField(default=0)
    line_subtotal = models.DecimalField(max_digits=19, decimal_places=4, default=0)
    line_tax = models.DecimalField(max_digits=19, decimal_places=4, default=0)

    class Meta:
        db_table = "tax_invoice_lines"
        constraints = [
            models.CheckConstraint(
                condition=Q(tax_category__in=TAX_CATEGORIES), name="ck_tax_line_category"
            ),
            models.CheckConstraint(condition=Q(line_subtotal__gte=0), name="ck_tax_line_subtotal"),
        ]


class TaxSubmission(TimestampedModel):
    """One attempt to hand a document to a tax authority.

    Nothing writes an `accepted` row in this wave: the ZATCA adapter is
    deferred and the current deployment never reaches `enabled`. The table
    exists so the boundary is real when it is needed, not so it can be used.
    """

    invoice = models.ForeignKey(TaxInvoice, on_delete=models.RESTRICT, related_name="submissions")
    attempt_number = models.PositiveIntegerField(default=1)
    status = models.CharField(max_length=20, default="pending")
    # The ROUTE taken — clearance or reporting — decided solely by the
    # document's classification, never by credit-vs-debit.
    route = models.CharField(max_length=20, blank=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    # A SAFE label. Never a provider body, certificate or credential.
    failure_class = models.CharField(max_length=60, blank=True)

    class Meta:
        db_table = "tax_submissions"
        constraints = [
            models.UniqueConstraint(
                fields=["invoice", "attempt_number"], name="uq_tax_submission_attempt"
            ),
            models.CheckConstraint(
                condition=Q(status__in=SUBMISSION_STATUSES), name="ck_tax_submission_status"
            ),
        ]

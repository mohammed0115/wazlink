"""billing (L4) — platform subscriptions, checkout and payments (M20).

Three frozen decisions dominate this module, and each is expressed as a
structure rather than a convention:

*   **Billing is not revenue.** Nothing here writes, references or can reach
    `revenue_events`. A captured `Payment` is WazLink being paid for a
    subscription; it is not a tenant's customer revenue, and frozen
    `B8_REVENUE_FIREWALL` §2 forbids the identification. `T-REV-3` asserts it.
*   **`billing` -> `entitlements` is the only direction** (`B14_03` §6b).
    `entitlements` never reads a subscription, a payment or an amount; billing
    calls DOWN into it with a plan version and nothing else (`T-ENT-6`,
    `T-ENT-7`).
*   **Payment truth is webhook-first.** A browser redirect is UX evidence and
    mutates nothing (`B8_CHECKOUT_PAYMENT_MODEL` §8, corroborated by Tap's own
    documentation, `B8-X-011`). There is no field on any row below that a
    redirect handler could legally write.

Money is `NUMERIC(19,4)` plus a paired ISO-4217 `currency`, with zero
exceptions (`B8_STORAGE_MODEL`, ADR-011). No float touches an amount.
"""

from __future__ import annotations

from django.db import models
from django.db.models import Q

from common.models import PublicIdModel, TimestampedModel, VersionedModel
from common.provider_ports import PAYMENT_CREATED, PAYMENT_STATUSES

# --- Subscription states (B8_SUBSCRIPTION_STATE_MACHINE §1) ----------------
# Six values, exactly. `past_due` IS the grace state; there is no seventh.
SUB_TRIALING = "trialing"
SUB_ACTIVE = "active"
SUB_PAST_DUE = "past_due"
SUB_SUSPENDED = "suspended"
SUB_CANCELLED = "cancelled"
SUB_EXPIRED = "expired"
SUBSCRIPTION_STATUSES = (
    SUB_TRIALING,
    SUB_ACTIVE,
    SUB_PAST_DUE,
    SUB_SUSPENDED,
    SUB_CANCELLED,
    SUB_EXPIRED,
)
# The hard-deny floor (§5): every capability LOCKED, every quota EXHAUSTED.
SUBSCRIPTION_DENY_STATES = (SUB_SUSPENDED, SUB_CANCELLED, SUB_EXPIRED)

QUOTE_ACTIVE = "active"
QUOTE_EXPIRED = "expired"
QUOTE_CONSUMED = "consumed"
QUOTE_CANCELLED = "cancelled"
QUOTE_STATUSES = (QUOTE_ACTIVE, QUOTE_EXPIRED, QUOTE_CONSUMED, QUOTE_CANCELLED)

INVOICE_OPEN = "open"
INVOICE_PAID = "paid"
INVOICE_VOID = "void"
INVOICE_STATUSES = (INVOICE_OPEN, INVOICE_PAID, INVOICE_VOID)

REFUND_STATUSES = ("pending", "refunded", "failed")
ATTEMPT_KINDS = ("create", "reconciliation_query", "retry")

# The legal forward transitions of `Payment.status`. A webhook reporting
# anything not reachable from the current state is DISCARDED, never applied
# backwards (`B8_WEBHOOK_MODEL` §6) — which is what makes the consumer
# order-independent without Tap guaranteeing delivery order.
PAYMENT_TRANSITIONS: dict[str, tuple[str, ...]] = {
    "created": ("pending", "authorized", "captured", "failed", "cancelled"),
    "pending": ("authorized", "captured", "failed", "cancelled"),
    "authorized": ("captured", "failed", "cancelled"),
    "captured": ("partially_refunded", "refunded"),
    "partially_refunded": ("refunded",),
    "failed": (),
    "cancelled": (),
    "refunded": (),
}


class BillingCustomer(TimestampedModel):
    """One provider customer per workspace, ever (`B8-X-013`).

    This row is also the WEBHOOK WORKSPACE RESOLUTION join
    (`B8_CHECKOUT_PAYMENT_MODEL` §5): an inbound callback finds its tenant by
    looking its opaque refs up HERE, never by reading a workspace id out of a
    provider payload. `PaymentWebhookEvent` carries no such field, so the
    unsafe path is absent rather than merely unused.
    """

    workspace = models.OneToOneField(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="billing_customer"
    )
    provider = models.CharField(max_length=40, default="tap")
    provider_customer_ref = models.CharField(max_length=120)
    # Set once, when a recurring agreement exists. Never a card number.
    provider_agreement_ref = models.CharField(max_length=120, blank=True)

    class Meta:
        db_table = "billing_customers"
        constraints = [
            models.UniqueConstraint(
                fields=["provider", "provider_customer_ref"], name="uq_billing_customer_provider_ref"
            ),
        ]


class Subscription(PublicIdModel, TimestampedModel, VersionedModel):
    """Exactly ONE non-terminal subscription per workspace (`B8` §1, §6.1).

    Uniqueness is a database constraint rather than an application check
    because `B1_COMMAND_EVENT_CATALOG` names the exact race it must close:
    two consumers of one `WorkspaceCreated` must not create two subscriptions.
    """

    PUBLIC_ID_PREFIX = "SUB"

    workspace = models.OneToOneField(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="subscription"
    )
    status = models.CharField(max_length=20, default=SUB_ACTIVE)
    plan_version = models.ForeignKey(
        "entitlements.PlanVersion", on_delete=models.RESTRICT, related_name="subscriptions"
    )
    # Non-null only while a DOWNGRADE is scheduled. An upgrade is immediate and
    # never uses this column (`B8_UPGRADE_DOWNGRADE_MODEL` §4).
    pending_plan_version = models.ForeignKey(
        "entitlements.PlanVersion",
        on_delete=models.RESTRICT,
        related_name="pending_subscriptions",
        null=True,
        blank=True,
    )
    billing_customer = models.ForeignKey(
        BillingCustomer, on_delete=models.RESTRICT, related_name="subscriptions", null=True, blank=True
    )
    current_period_start = models.DateTimeField()
    current_period_end = models.DateTimeField()
    trial_end = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end = models.BooleanField(default=False)
    cancelled_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "subscriptions"
        indexes = [models.Index(fields=["status", "current_period_end"])]
        constraints = [
            models.CheckConstraint(
                condition=Q(status__in=SUBSCRIPTION_STATUSES), name="ck_subscription_status"
            ),
            models.CheckConstraint(
                condition=Q(current_period_end__gt=models.F("current_period_start")),
                name="ck_subscription_period",
            ),
        ]


class UpgradeQuote(PublicIdModel, TimestampedModel):
    """The SERVER-PRICED snapshot. This is the whole anti-tampering mechanism.

    `amount`/`currency` are computed once from the target plan version at issue
    time. `CreatePayment` reads them from HERE and never re-derives from the
    catalog or from anything a client sent — so a client-supplied amount has no
    column to land in and no code path to travel (`B8_CHECKOUT_PAYMENT_MODEL`
    §2).
    """

    PUBLIC_ID_PREFIX = "UPQ"

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="upgrade_quotes"
    )
    plan_version = models.ForeignKey(
        "entitlements.PlanVersion", on_delete=models.RESTRICT, related_name="quotes"
    )
    amount = models.DecimalField(max_digits=19, decimal_places=4)
    currency = models.CharField(max_length=3)
    status = models.CharField(max_length=20, default=QUOTE_ACTIVE)
    expires_at = models.DateTimeField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    created_by_membership = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="upgrade_quotes", null=True
    )

    class Meta:
        db_table = "upgrade_quotes"
        indexes = [models.Index(fields=["workspace", "status", "expires_at"])]
        constraints = [
            models.CheckConstraint(condition=Q(status__in=QUOTE_STATUSES), name="ck_quote_status"),
            models.CheckConstraint(condition=Q(amount__gte=0), name="ck_quote_amount"),
        ]


class Payment(PublicIdModel, TimestampedModel):
    """Provider-neutral payment lifecycle.

    `public_id` doubles as the PROVIDER idempotency key (`B8-X-006`): it is
    minted once inside `CreatePayment`'s transaction and never regenerated, so
    a retry that reaches the provider at all reaches it with the same key.

    One quote yields at most one payment — enforced by a partial unique index
    on `quote`, independent of any HTTP header (`B8_IDEMPOTENCY_MODEL` §2).
    """

    PUBLIC_ID_PREFIX = "PAY"

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="payments"
    )
    subscription = models.ForeignKey(
        Subscription, on_delete=models.RESTRICT, related_name="payments", null=True, blank=True
    )
    quote = models.ForeignKey(
        UpgradeQuote, on_delete=models.RESTRICT, related_name="payments", null=True, blank=True
    )
    invoice = models.ForeignKey(
        "billing.Invoice", on_delete=models.RESTRICT, related_name="payments", null=True, blank=True
    )
    amount = models.DecimalField(max_digits=19, decimal_places=4)
    currency = models.CharField(max_length=3)
    status = models.CharField(max_length=30, default=PAYMENT_CREATED)
    provider = models.CharField(max_length=40, default="tap")
    provider_payment_ref = models.CharField(max_length=120, blank=True)
    # Set when the provider reported something this adapter could not map. The
    # sweep picks these up; nothing advances on a guess.
    requires_reconciliation = models.BooleanField(default=False)
    failure_code = models.CharField(max_length=60, blank=True)
    created_by_membership = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="payments", null=True
    )

    class Meta:
        db_table = "payments"
        indexes = [
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["status", "created_at"]),
        ]
        constraints = [
            models.CheckConstraint(condition=Q(status__in=PAYMENT_STATUSES), name="ck_payment_status"),
            models.CheckConstraint(condition=Q(amount__gte=0), name="ck_payment_amount"),
            # One quote, one payment lineage — a DATABASE fact, not a check.
            models.UniqueConstraint(
                fields=["quote"], condition=Q(quote__isnull=False), name="uq_payment_quote"
            ),
            models.UniqueConstraint(
                fields=["provider", "provider_payment_ref"],
                condition=~Q(provider_payment_ref=""),
                name="uq_payment_provider_ref",
            ),
        ]


class PaymentAttempt(TimestampedModel):
    """Append-only record of HOW a Payment reached its status (`B8-D-A017`)."""

    payment = models.ForeignKey(Payment, on_delete=models.CASCADE, related_name="attempts")
    attempt_number = models.PositiveIntegerField(default=1)
    kind = models.CharField(max_length=30, default="create")
    provider_request_ref = models.CharField(max_length=120, blank=True)
    outcome_status = models.CharField(max_length=30, blank=True)
    occurred_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "payment_attempts"
        constraints = [
            models.UniqueConstraint(
                fields=["payment", "attempt_number"], name="uq_payment_attempt_number"
            ),
            models.CheckConstraint(condition=Q(kind__in=ATTEMPT_KINDS), name="ck_payment_attempt_kind"),
        ]


class Refund(TimestampedModel):
    """A child of Payment. A refund never mints a new PAY-*."""

    payment = models.ForeignKey(Payment, on_delete=models.RESTRICT, related_name="refunds")
    provider_refund_ref = models.CharField(max_length=120, blank=True)
    amount = models.DecimalField(max_digits=19, decimal_places=4)
    currency = models.CharField(max_length=3)
    reason = models.CharField(max_length=60, default="requested_by_customer")
    status = models.CharField(max_length=20, default="pending")
    created_by_membership = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="refunds", null=True
    )

    class Meta:
        db_table = "refunds"
        constraints = [
            models.CheckConstraint(condition=Q(amount__gt=0), name="ck_refund_amount"),
            models.CheckConstraint(condition=Q(status__in=REFUND_STATUSES), name="ck_refund_status"),
        ]


class Invoice(PublicIdModel, TimestampedModel):
    """PLATFORM billing invoice. Not a tenant's customer invoice.

    The `INV-BILL-*` prefix is deliberate: `B9-AF-007` rejects this document as
    a revenue source precisely so the two can never be confused.
    """

    PUBLIC_ID_PREFIX = "INV-BILL"

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="billing_invoices"
    )
    subscription = models.ForeignKey(Subscription, on_delete=models.RESTRICT, related_name="invoices")
    total = models.DecimalField(max_digits=19, decimal_places=4)
    currency = models.CharField(max_length=3)
    status = models.CharField(max_length=20, default=INVOICE_OPEN)
    issued_at = models.DateTimeField()

    class Meta:
        db_table = "invoices"
        indexes = [models.Index(fields=["workspace", "issued_at"])]
        constraints = [
            models.CheckConstraint(condition=Q(status__in=INVOICE_STATUSES), name="ck_invoice_status"),
            models.CheckConstraint(condition=Q(total__gte=0), name="ck_invoice_total"),
        ]


class InvoiceLine(TimestampedModel):
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name="lines")
    description = models.CharField(max_length=200)
    amount = models.DecimalField(max_digits=19, decimal_places=4)
    currency = models.CharField(max_length=3)

    class Meta:
        db_table = "invoice_lines"
        constraints = [models.CheckConstraint(condition=Q(amount__gte=0), name="ck_invoice_line_amount")]

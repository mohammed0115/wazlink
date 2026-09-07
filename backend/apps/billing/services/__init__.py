"""billing commands (L4) — B8, implemented.

The load-bearing sequence is `B8_CHECKOUT_PAYMENT_MODEL` §6, and it is followed
step for step:

    1. CreateUpgradeQuote  -> priced from the CURRENT plan version, server-side
    2. StartCheckout       -> locks the subscription, consumes the quote,
                              creates Payment{created}, ensures the customer
    3. adapter create_charge -> Payment{pending}, provider ref, attempt appended
    4. browser redirect    -> UX ONLY. Mutates nothing.
    5. signed webhook      -> ProcessPaymentWebhook -> Payment{captured}
                              -> AssignWorkspacePlan -> SubscriptionActivated

Three properties are structural rather than conventional:

*   **The provider call happens OUTSIDE the database transaction.** A durable
    `Payment` row and its attempt exist BEFORE the charge is attempted
    (`B12-D-A021`), so a process that dies mid-call leaves evidence rather than
    a silent gap. Holding a transaction open across a 20-second HTTP call would
    also pin a row lock for the provider's convenience.
*   **An `unknown` outcome is NEVER retried** (`B12-D-A020`). It opens a
    reconciliation case and a human decides.
*   **Nothing here writes, imports or can reach `revenue_events`** — the
    `T-REV-3` firewall. A captured subscription payment produces entitlements,
    an invoice and an event; it does not produce revenue.
"""

from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.db import IntegrityError, transaction
from django.utils import timezone

from apps.entitlements.services import assign_workspace_plan, default_plan_version
from common.audit import write_audit
from common.concurrency import bump_version, lock_aggregate
from common.errors import DomainConflict, EntityNotFound, ValidationFailed
from common.outbox import publish_event
from common.ports import ports
from common.provider_ports import (
    PAYMENT_CAPTURED,
    PAYMENT_CREATED,
    PAYMENT_PENDING,
    ChargeRequest,
    ProviderError,
    ProviderNotConfigured,
    ProviderUnknownOutcome,
    providers,
)

from ..models import (
    PAYMENT_TRANSITIONS,
    QUOTE_ACTIVE,
    QUOTE_CONSUMED,
    QUOTE_EXPIRED,
    SUB_ACTIVE,
    SUB_CANCELLED,
    SUB_EXPIRED,
    SUB_PAST_DUE,
    SUB_SUSPENDED,
    SUB_TRIALING,
    BillingCustomer,
    Invoice,
    InvoiceLine,
    Payment,
    PaymentAttempt,
    Refund,
    Subscription,
    UpgradeQuote,
)

# `B8_SUBSCRIPTION_STATE_MACHINE` §4. A DATA value, so changing it is a config
# change rather than an architecture change.
GRACE_WINDOW_DAYS = 7
QUOTE_TTL_MINUTES = 60
DEFAULT_PERIOD_DAYS = 30
# `B8_WEBHOOK_MODEL` §7 — past this, the sweep calls retrieve_charge rather
# than continuing to wait on a webhook Tap may already have given up on.
PENDING_RECONCILE_MINUTES = 30

# The states from which a checkout may legally start (`B8` §6 authority table).
CHECKOUT_SOURCE_STATES = (SUB_ACTIVE, SUB_PAST_DUE, SUB_TRIALING)


# --------------------------------------------------------------------------
# Bootstrap — consumes WorkspaceCreated (B8 §2)
# --------------------------------------------------------------------------
def bootstrap_workspace_subscription(*, workspace, plan_version=None) -> Subscription:
    """Every workspace has exactly one Subscription from creation (B8 §2).

    Idempotent by the `workspace` unique column, which is the database-level
    backstop `B1_COMMAND_EVENT_CATALOG` demands against two consumers of one
    `WorkspaceCreated` racing. The `get_or_create` pre-check is a convenience;
    the constraint is the authority.
    """
    existing = Subscription.objects.filter(workspace=workspace).first()
    if existing is not None:
        return existing

    version = plan_version or default_plan_version()
    if version is None:
        raise ValidationFailed("No default plan version is configured.")

    now = timezone.now()
    try:
        with transaction.atomic():
            subscription = Subscription.objects.create(
                workspace=workspace,
                status=SUB_ACTIVE,  # never `trialing` — B8-D-B001 is inactive
                plan_version=version,
                current_period_start=now,
                current_period_end=now + timedelta(days=DEFAULT_PERIOD_DAYS),
            )
            assign_workspace_plan(workspace=workspace, plan_version=version)
    except IntegrityError:
        # A competitor won. Its row IS the subscription.
        subscription = Subscription.objects.get(workspace=workspace)
    return subscription


def subscription_for(workspace) -> Subscription:
    """The frozen read seam (B8 §7). Other domains never join `subscriptions`."""
    subscription = Subscription.objects.select_related("plan_version__plan").filter(
        workspace=workspace
    ).first()
    if subscription is None:
        return bootstrap_workspace_subscription(workspace=workspace)
    return subscription


# --------------------------------------------------------------------------
# Quote — the SERVER-SIDE price (B8_CHECKOUT_PAYMENT_MODEL §2)
# --------------------------------------------------------------------------
@transaction.atomic
def create_upgrade_quote(*, context, plan_code: str, amount=None) -> UpgradeQuote:
    """Price a plan change from the CURRENT plan version, server-side.

    `amount` exists only so a caller inside this module can price a renewal; it
    is NOT reachable from the API, and the checkout endpoint never forwards a
    client value into it. A client-supplied price has no route here.
    """
    from apps.entitlements.models import PlanVersion

    version = (
        PlanVersion.objects.select_related("plan")
        .filter(plan__code=(plan_code or "").strip(), is_current=True)
        .first()
    )
    if version is None:
        raise EntityNotFound("The requested plan was not found.")

    price = amount if amount is not None else _price_of(version)
    quote = UpgradeQuote.objects.create(
        workspace=context.workspace,
        plan_version=version,
        amount=price,
        currency=_currency_of(version),
        status=QUOTE_ACTIVE,
        expires_at=timezone.now() + timedelta(minutes=QUOTE_TTL_MINUTES),
        created_by_membership=context.membership,
    )
    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="billing.quote_issued",
        target_type="upgrade_quote",
        target_ref=quote.public_id,
        metadata={"plan_code": version.plan.code},
    )
    publish_event(
        workspace=context.workspace,
        event_type="UpgradeQuoteIssued",
        aggregate_type="upgrade_quote",
        aggregate_ref=quote.public_id,
        # NO amount on the event: B8 events carry identities, and an amount on
        # a bus is an amount in a log.
        payload={"plan_code": version.plan.code},
    )
    return quote


def _price_of(plan_version) -> Decimal:
    """The catalogue price. `entitlements` stores no price column, so B8's
    pricing lives on the plan version through the billing-owned price table
    below — a Decimal, never a float (ADR-011)."""
    price = getattr(plan_version, "price_amount", None)
    if price is not None:
        return Decimal(str(price))
    return PLAN_PRICES.get(plan_version.plan.code, Decimal("0.0000"))


def _currency_of(plan_version) -> str:
    return getattr(plan_version, "price_currency", "") or DEFAULT_CURRENCY


# Pricing is NOT frozen (`CA-11`: "pricing not frozen"), so the catalogue is a
# data table here rather than an invented contract. An operator changes it
# without a migration; nothing in the domain branches on a specific value.
DEFAULT_CURRENCY = "SAR"
PLAN_PRICES: dict[str, Decimal] = {
    "PLAN-STARTER": Decimal("0.0000"),
    "PLAN-GROWTH": Decimal("299.0000"),
    "PLAN-SCALE": Decimal("999.0000"),
}


# --------------------------------------------------------------------------
# StartCheckout (B8_CHECKOUT_PAYMENT_MODEL §6 steps 2-3)
# --------------------------------------------------------------------------
def start_checkout(*, context, plan_code: str, quote: UpgradeQuote | None = None) -> Payment:
    """Create the durable Payment, THEN call the provider.

    The split is the point. Everything durable commits first; the provider call
    happens after, outside any transaction. A crash between the two leaves a
    `created` Payment and an open attempt — visible, reconcilable evidence —
    rather than a charge nobody knows about.
    """
    if quote is None:
        quote = create_upgrade_quote(context=context, plan_code=plan_code)

    payment = _open_payment(context=context, quote=quote)

    # --- provider boundary: NO transaction is open here ------------------
    adapter = _payment_adapter()
    attempt = PaymentAttempt.objects.create(
        payment=payment, attempt_number=1, kind="create", outcome_status=""
    )
    try:
        customer_ref = _ensure_billing_customer(context=context, adapter=adapter)
        result = adapter.create_charge(
            ChargeRequest(
                payment_ref=payment.public_id,  # B8-X-006 idempotency key
                amount=f"{payment.amount:.4f}",
                currency=payment.currency,
                customer_ref=customer_ref,
                description=f"WazLink {quote.plan_version.plan.code}",
            )
        )
    except ProviderUnknownOutcome:
        # B12-D-A020: never retried. A human decides.
        _settle_attempt(attempt, "unknown")
        # `P-1` — a provider attempt whose outcome is unknown. The frozen
        # remedy is a READ-ONLY status lookup, never a mutating repeat.
        _open_case("P-1", payment, detail={"reason": "charge outcome unknown"})
        payment.requires_reconciliation = True
        payment.status = PAYMENT_PENDING
        payment.save(update_fields=["requires_reconciliation", "status", "updated_at"])
        return payment
    except ProviderNotConfigured:
        _settle_attempt(attempt, "not_configured")
        payment.status = PAYMENT_CREATED
        payment.failure_code = "provider_not_configured"
        payment.save(update_fields=["status", "failure_code", "updated_at"])
        raise
    except ProviderError as exc:
        _settle_attempt(attempt, "known_failure")
        payment.failure_code = exc.outcome[:60]
        payment.save(update_fields=["failure_code", "updated_at"])
        raise

    _settle_attempt(attempt, result.status, provider_request_ref=result.provider_payment_ref)
    with transaction.atomic():
        locked = lock_aggregate(payment)
        locked.provider_payment_ref = result.provider_payment_ref
        locked.requires_reconciliation = result.requires_reconciliation
        # Only a LEGAL forward transition is applied, here as everywhere.
        if result.status in PAYMENT_TRANSITIONS.get(locked.status, ()):
            locked.status = result.status
        locked.save(
            update_fields=["provider_payment_ref", "requires_reconciliation", "status", "updated_at"]
        )
    payment.refresh_from_db()
    if payment.status == PAYMENT_CAPTURED:
        # A provider that captures synchronously must still converge to the
        # same durable end state the webhook would have produced.
        _apply_capture(payment)
    return payment


@transaction.atomic
def _open_payment(*, context, quote: UpgradeQuote) -> Payment:
    """Lock the subscription, consume the quote, mint the Payment. One txn."""
    subscription = subscription_for(context.workspace)
    lock_aggregate(subscription)
    if subscription.status not in CHECKOUT_SOURCE_STATES:
        raise DomainConflict("This subscription cannot start a checkout in its current state.")

    lock_aggregate(quote)
    if quote.workspace_id != context.workspace.id:
        raise EntityNotFound("The requested quote was not found.")
    if quote.status != QUOTE_ACTIVE:
        raise DomainConflict("This quote has already been used or is no longer active.")
    if quote.expires_at <= timezone.now():
        quote.status = QUOTE_EXPIRED
        quote.save(update_fields=["status", "updated_at"])
        raise DomainConflict("This quote has expired.")

    quote.status = QUOTE_CONSUMED
    quote.consumed_at = timezone.now()
    quote.save(update_fields=["status", "consumed_at", "updated_at"])

    try:
        payment = Payment.objects.create(
            workspace=context.workspace,
            subscription=subscription,
            quote=quote,
            # The amount comes from the STORED QUOTE and nowhere else.
            amount=quote.amount,
            currency=quote.currency,
            status=PAYMENT_CREATED,
            created_by_membership=context.membership,
        )
    except IntegrityError:
        # `uq_payment_quote`: one quote yields at most one payment lineage.
        raise DomainConflict("A payment already exists for this quote.") from None
    return payment


def _ensure_billing_customer(*, context, adapter) -> str:
    record = BillingCustomer.objects.filter(workspace=context.workspace).first()
    if record is not None and record.provider_customer_ref:
        return record.provider_customer_ref
    customer_ref = adapter.ensure_customer(
        workspace_ref=context.workspace.slug, name=context.workspace.name
    )
    record, _ = BillingCustomer.objects.get_or_create(
        workspace=context.workspace,
        defaults={"provider": adapter.provider_name, "provider_customer_ref": customer_ref},
    )
    return record.provider_customer_ref


# --------------------------------------------------------------------------
# ProcessPaymentWebhook (B8_WEBHOOK_MODEL)
# --------------------------------------------------------------------------
def process_payment_webhook(*, event) -> Payment | None:
    """Apply ONE verified, normalized provider event.

    Three refusals are structural:

    *   The workspace is resolved by looking `provider_payment_ref` up against
        WazLink's own rows. The event type carries no workspace field, so the
        forbidden shortcut is unrepresentable (`B8_WEBHOOK_MODEL` §3).
    *   Only a LEGAL FORWARD transition is applied. A stale `pending` arriving
        after `captured` is discarded, which is what makes the consumer
        order-independent (§6).
    *   A DIFFERENT terminal outcome against an already-terminal Payment is a
        reconciliation MISMATCH — recorded, never overwritten (§5).
    """
    if event.unsupported or not event.provider_payment_ref:
        return None

    with transaction.atomic():
        payment = (
            Payment.objects.select_for_update()
            .filter(provider_payment_ref=event.provider_payment_ref)
            .first()
        )
        if payment is None:
            # Zero matches: quarantined and alerted, never guessed.
            # `P-7` — a receipt whose binding resolved to zero workspaces.
            # Quarantined and reported, never guessed.
            _open_case(
                "P-7", None, detail={"reason": "no payment matches this provider reference"}
            )
            return None

        if event.requires_reconciliation:
            payment.requires_reconciliation = True
            payment.save(update_fields=["requires_reconciliation", "updated_at"])
            # `P-1` again: an unmapped provider status is an unknown
            # outcome, and it awaits a lookup rather than a guess.
            _open_case("P-1", payment, detail={"reason": "provider status not mapped"})
            return payment

        current = payment.status
        if event.status == current:
            return payment  # replay of an already-applied event: a no-op
        if event.status not in PAYMENT_TRANSITIONS.get(current, ()):
            if current in ("captured", "failed", "cancelled", "refunded") and event.status in (
                "captured",
                "failed",
                "cancelled",
            ):
                # `P-6` — the same identity reporting a DIFFERENT terminal
                # outcome. Report only; the domain application is withheld
                # rather than overwriting a terminal state.
                _open_case(
                    "P-6",
                    payment,
                    detail={"reason": "conflicting terminal outcome", "reported": event.status},
                )
            return payment  # discarded, never applied backwards

        payment.status = event.status
        payment.save(update_fields=["status", "updated_at"])
        _settle_attempt(_next_attempt(payment, "reconciliation_query"), event.status)

    if payment.status == PAYMENT_CAPTURED:
        _apply_capture(payment)
    elif payment.status == "failed":
        _mark_past_due(payment)
    return payment


def _apply_capture(payment: Payment) -> None:
    """Capture is the ONLY status that may activate a subscription.

    The entitlement grant and the subscription transition commit in ONE
    transaction with the invoice (`B14_03` §6b, `T-ENT-4`). If any part fails,
    none of it happened.
    """
    with transaction.atomic():
        locked = Payment.objects.select_for_update().get(pk=payment.pk)
        if locked.status != PAYMENT_CAPTURED:
            return
        subscription = locked.subscription
        if subscription is None:
            return
        lock_aggregate(subscription)
        if Invoice.objects.filter(payments__pk=locked.pk).exists():
            return  # already applied; capture is idempotent by effect

        quote = locked.quote
        now = timezone.now()
        if quote is not None:
            subscription.plan_version = quote.plan_version
            # AssignWorkspacePlan — DOWNWARD, inside this transaction, and
            # carrying no amount, currency, payment or card fact.
            assign_workspace_plan(workspace=subscription.workspace, plan_version=quote.plan_version)
        subscription.status = SUB_ACTIVE
        subscription.current_period_start = now
        subscription.current_period_end = now + timedelta(days=DEFAULT_PERIOD_DAYS)
        subscription.pending_plan_version = None
        bump_version(subscription)
        subscription.save(
            update_fields=[
                "plan_version",
                "status",
                "current_period_start",
                "current_period_end",
                "pending_plan_version",
                "version",
                "updated_at",
            ]
        )

        invoice = Invoice.objects.create(
            workspace=locked.workspace,
            subscription=subscription,
            total=locked.amount,
            currency=locked.currency,
            status="paid",
            issued_at=now,
        )
        InvoiceLine.objects.create(
            invoice=invoice,
            description=f"Subscription — {subscription.plan_version.plan.code}",
            amount=locked.amount,
            currency=locked.currency,
        )
        Payment.objects.filter(pk=locked.pk).update(invoice=invoice)

        publish_event(
            workspace=locked.workspace,
            event_type="PaymentSucceeded",
            aggregate_type="payment",
            aggregate_ref=locked.public_id,
            payload={"subscription_ref": subscription.public_id},
        )
        publish_event(
            workspace=locked.workspace,
            event_type="SubscriptionActivated",
            aggregate_type="subscription",
            aggregate_ref=subscription.public_id,
            payload={"plan_code": subscription.plan_version.plan.code},
        )
        # NOTE: no RevenueRecognized. A platform payment is not customer
        # revenue (`B8_REVENUE_FIREWALL`, `T-REV-3`), and this module holds no
        # import by which it could write one.


def _mark_past_due(payment: Payment) -> None:
    subscription = payment.subscription
    if subscription is None:
        return
    with transaction.atomic():
        lock_aggregate(subscription)
        if subscription.status != SUB_ACTIVE:
            return
        subscription.status = SUB_PAST_DUE
        bump_version(subscription)
        subscription.save(update_fields=["status", "version", "updated_at"])
        publish_event(
            workspace=subscription.workspace,
            event_type="SubscriptionPastDue",
            aggregate_type="subscription",
            aggregate_ref=subscription.public_id,
            payload={},
        )


# --------------------------------------------------------------------------
# Reconciliation (B8_RECONCILIATION_MODEL / B8_WEBHOOK_MODEL §7)
# --------------------------------------------------------------------------
def reconcile_payment(*, payment: Payment) -> Payment:
    """Ask the provider what actually happened. READ-ONLY at the provider.

    This is the backstop for Tap's bounded 3-attempt webhook budget — which is
    the structural reason reconciliation is not optional insurance.
    """
    adapter = _payment_adapter()
    attempt = _next_attempt(payment, "reconciliation_query")
    try:
        result = adapter.retrieve_charge(payment.provider_payment_ref)
    except ProviderError as exc:
        _settle_attempt(attempt, exc.outcome)
        return payment

    _settle_attempt(attempt, result.status)
    if result.requires_reconciliation:
        return payment

    with transaction.atomic():
        locked = Payment.objects.select_for_update().get(pk=payment.pk)
        if result.status in PAYMENT_TRANSITIONS.get(locked.status, ()):
            locked.status = result.status
            locked.requires_reconciliation = False
            locked.save(update_fields=["status", "requires_reconciliation", "updated_at"])
    payment.refresh_from_db()
    if payment.status == PAYMENT_CAPTURED:
        _apply_capture(payment)
    return payment


def sweep_pending_payments(*, now=None) -> int:
    """Scheduled sweep. Bounded window, then ASK rather than wait."""
    now = now or timezone.now()
    cutoff = now - timedelta(minutes=PENDING_RECONCILE_MINUTES)
    stale = Payment.objects.filter(
        status__in=(PAYMENT_PENDING, "authorized"), created_at__lte=cutoff
    ).exclude(provider_payment_ref="")
    count = 0
    for payment in stale:
        reconcile_payment(payment=payment)
        count += 1
    return count


# --------------------------------------------------------------------------
# Lifecycle commands (B8_SUBSCRIPTION_STATE_MACHINE §6)
# --------------------------------------------------------------------------
@transaction.atomic
def cancel_subscription(*, context, expected_version: int | None = None) -> Subscription:
    """Sets `cancel_at_period_end`. Phase 1 supports ONLY cancel-at-period-end."""
    from common.concurrency import require_version

    subscription = subscription_for(context.workspace)
    require_version(subscription, expected_version, required=False)
    if subscription.status not in (SUB_ACTIVE, SUB_TRIALING, SUB_PAST_DUE):
        raise DomainConflict("This subscription cannot be cancelled in its current state.")
    if subscription.cancel_at_period_end:
        return subscription

    subscription.cancel_at_period_end = True
    subscription.cancelled_at = timezone.now()
    subscription.pending_plan_version = None  # cancellation supersedes (§6 race rule)
    bump_version(subscription)
    subscription.save(
        update_fields=[
            "cancel_at_period_end",
            "cancelled_at",
            "pending_plan_version",
            "version",
            "updated_at",
        ]
    )
    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="billing.subscription_cancelled",
        target_type="subscription",
        target_ref=subscription.public_id,
    )
    publish_event(
        workspace=context.workspace,
        event_type="SubscriptionCancellationScheduled",
        aggregate_type="subscription",
        aggregate_ref=subscription.public_id,
        payload={},
    )
    return subscription


@transaction.atomic
def reactivate_subscription(*, context, expected_version: int | None = None) -> Subscription:
    """Legal ONLY against an `active` row still carrying cancel_at_period_end."""
    from common.concurrency import require_version

    subscription = subscription_for(context.workspace)
    require_version(subscription, expected_version, required=False)
    if subscription.status != SUB_ACTIVE or not subscription.cancel_at_period_end:
        raise DomainConflict("There is no scheduled cancellation to undo.")

    subscription.cancel_at_period_end = False
    subscription.cancelled_at = None
    bump_version(subscription)
    subscription.save(
        update_fields=["cancel_at_period_end", "cancelled_at", "version", "updated_at"]
    )
    return subscription


def sweep_subscription_periods(*, now=None) -> int:
    """The period-boundary sweep: past_due->suspended and the cancel ladder."""
    now = now or timezone.now()
    changed = 0

    for subscription in Subscription.objects.filter(
        status=SUB_ACTIVE, cancel_at_period_end=True, current_period_end__lte=now
    ):
        with transaction.atomic():
            lock_aggregate(subscription)
            if subscription.status != SUB_ACTIVE or not subscription.cancel_at_period_end:
                continue
            # `active -> cancelled -> expired` as ONE atomic action (B8 §3):
            # `cancelled` is real and momentarily observable, then terminal.
            subscription.status = SUB_CANCELLED
            bump_version(subscription)
            subscription.save(update_fields=["status", "version", "updated_at"])
            publish_event(
                workspace=subscription.workspace,
                event_type="SubscriptionCancelled",
                aggregate_type="subscription",
                aggregate_ref=subscription.public_id,
                payload={},
            )
            subscription.status = SUB_EXPIRED
            bump_version(subscription)
            subscription.save(update_fields=["status", "version", "updated_at"])
            changed += 1

    grace_cutoff = now - timedelta(days=GRACE_WINDOW_DAYS)
    for subscription in Subscription.objects.filter(
        status=SUB_PAST_DUE, updated_at__lte=grace_cutoff
    ):
        with transaction.atomic():
            lock_aggregate(subscription)
            if subscription.status != SUB_PAST_DUE:
                continue
            subscription.status = SUB_SUSPENDED
            bump_version(subscription)
            subscription.save(update_fields=["status", "version", "updated_at"])
            changed += 1
    return changed


@transaction.atomic
def refund_payment(*, context, payment: Payment, amount, reason: str = "requested_by_customer"):
    """Operator-initiated refund. A child record; never a new PAY-*."""
    if payment.workspace_id != context.workspace.id:
        raise EntityNotFound("The requested payment was not found.")
    if payment.status not in (PAYMENT_CAPTURED, "partially_refunded"):
        raise DomainConflict("Only a captured payment can be refunded.")
    return Refund.objects.create(
        payment=payment,
        amount=amount,
        currency=payment.currency,
        reason=reason,
        status="pending",
        created_by_membership=context.membership,
    )


# --------------------------------------------------------------------------
# Internals
# --------------------------------------------------------------------------
def _payment_adapter():
    return providers.require("payments")


def _next_attempt(payment: Payment, kind: str) -> PaymentAttempt:
    """Append an attempt row, tolerating a concurrent appender.

    `uq_payment_attempt_number` is the guard against two workers claiming the
    same ordinal. Counting and inserting is a read-then-write race, so the
    loser retries against the freshly-committed maximum rather than failing a
    reconciliation that was otherwise fine.
    """
    from django.db.models import Max

    for _ in range(5):
        current = (
            PaymentAttempt.objects.filter(payment=payment).aggregate(top=Max("attempt_number"))["top"]
            or 0
        )
        try:
            with transaction.atomic():
                return PaymentAttempt.objects.create(
                    payment=payment, attempt_number=current + 1, kind=kind
                )
        except IntegrityError:
            continue
    raise DomainConflict("Could not record a payment attempt.")


def _settle_attempt(attempt: PaymentAttempt, outcome: str, *, provider_request_ref: str = "") -> None:
    attempt.outcome_status = (outcome or "")[:30]
    attempt.provider_request_ref = provider_request_ref[:120]
    attempt.save(update_fields=["outcome_status", "provider_request_ref"])


def _open_case(case_class: str, payment: Payment | None, *, detail: dict | None = None) -> None:
    """Open a platform reconciliation case. NEVER auto-repairs (B14_09 §4)."""
    port = getattr(ports, "reconciliation", None)
    if port is None:
        return
    port.open_case(
        case_class=case_class,
        subject_ref=payment.public_id if payment is not None else "",
        detail=detail or {},
    )


__all__ = [
    "bootstrap_workspace_subscription",
    "subscription_for",
    "create_upgrade_quote",
    "start_checkout",
    "process_payment_webhook",
    "reconcile_payment",
    "sweep_pending_payments",
    "sweep_subscription_periods",
    "cancel_subscription",
    "reactivate_subscription",
    "refund_payment",
    "PLAN_PRICES",
    "DEFAULT_CURRENCY",
    "GRACE_WINDOW_DAYS",
]

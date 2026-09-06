"""billing API — thin transport. Every rule lives in services/ or selectors/.

The checkout endpoint is where the server-side pricing rule becomes visible:
it reads `plan_code` and **nothing else**. A client that sends `amount`,
`currency`, `price` or `total` is not rejected by a validator — those keys are
simply never read, so there is no path from a request body to a stored amount.
"""

from __future__ import annotations

from rest_framework.response import Response

from common.concurrency import parse_if_match
from common.pagination import paginate
from common.views import WazlinkAPIView

from ..selectors import (
    invoice_payload,
    invoices_for,
    payment_payload,
    payments_for,
    plan_catalog,
    subscription_payload,
)
from ..services import (
    cancel_subscription,
    reactivate_subscription,
    start_checkout,
    subscription_for,
)


class PlanCatalogView(WazlinkAPIView):
    permission_code = "billing.view"

    def get(self, request):
        self.context(request)
        return Response({"items": plan_catalog()})


class BillingSubscriptionView(WazlinkAPIView):
    def get(self, request):
        context = self.context(request, "billing.view")
        return Response(subscription_payload(subscription_for(context.workspace)))

    def patch(self, request):
        """Cancel or reactivate. There is no PATCH path that sets `status`."""
        context = self.context(request, "subscription.change")
        action = (request.data or {}).get("action", "")
        expected = parse_if_match(request)
        if action == "cancel":
            subscription = cancel_subscription(context=context, expected_version=expected)
        elif action == "reactivate":
            subscription = reactivate_subscription(context=context, expected_version=expected)
        else:
            subscription = subscription_for(context.workspace)
        return Response(subscription_payload(subscription))


class BillingCheckoutView(WazlinkAPIView):
    permission_code = "subscription.change"

    def post(self, request):
        context = self.context(request)
        # ONLY `plan_code` is read. The price comes from the server-issued
        # quote (B8_CHECKOUT_PAYMENT_MODEL §2).
        plan_code = (request.data or {}).get("plan_code", "")
        payment = start_checkout(context=context, plan_code=plan_code)
        return Response(payment_payload(payment), status=201)


class BillingInvoiceListView(WazlinkAPIView):
    permission_code = "billing.view"

    def get(self, request):
        context = self.context(request)
        items, next_cursor = paginate(invoices_for(context.workspace), request)
        return Response(
            {"items": [invoice_payload(i) for i in items], "next_cursor": next_cursor}
        )


class BillingPaymentListView(WazlinkAPIView):
    permission_code = "billing.view"

    def get(self, request):
        context = self.context(request)
        items, next_cursor = paginate(payments_for(context.workspace), request)
        return Response(
            {"items": [payment_payload(p) for p in items], "next_cursor": next_cursor}
        )

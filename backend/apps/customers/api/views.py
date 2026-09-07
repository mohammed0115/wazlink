"""customers API. Customer 360 is served by the COMPOSER, routed from config/."""

from __future__ import annotations

from rest_framework.response import Response

from common.authz import resolve_in_workspace
from common.concurrency import parse_if_match
from common.pagination import paginate
from common.views import WazlinkAPIView

from ..models import Customer
from ..services import (
    archive_customer,
    convert_lead_to_customer,
    create_customer,
    link_contact,
    unlink_contact,
    update_customer,
)


def customer_summary(customer: Customer) -> dict:
    return {
        "customer_ref": customer.public_id,
        "party_kind": customer.party_kind,
        "name": customer.name,
        "origin_kind": customer.origin_kind,
        "status": customer.status,
        "owner_ref": customer.owner_membership.public_id,
        "business_ref": customer.business.public_id if customer.business_id else None,
        "version": customer.version,
    }


class CustomerListCreateView(WazlinkAPIView):
    def get(self, request):
        context = self.context(request, "customer.view")
        queryset = Customer.objects.select_related("owner_membership", "business").filter(
            workspace=context.workspace
        )
        if party_kind := request.query_params.get("party_kind"):
            queryset = queryset.filter(party_kind=party_kind)
        if status_filter := request.query_params.get("status"):
            queryset = queryset.filter(status=status_filter)
        if q := request.query_params.get("q"):
            queryset = queryset.filter(name__icontains=q)
        items, next_cursor = paginate(queryset, request, order_fields=("name", "public_id"))
        return Response({"items": [customer_summary(c) for c in items], "next_cursor": next_cursor})

    def post(self, request):
        context = self.context(request, "customer.create")
        data = request.data or {}
        business = None
        if business_ref := data.get("business_ref"):
            from apps.discovery.models import Business

            business = resolve_in_workspace(Business.objects.all(), context, public_id=business_ref)
        customer = create_customer(
            context=context,
            party_kind=data.get("party_kind", ""),
            name=data.get("name", ""),
            origin_kind=data.get("origin_kind", "manual"),
            business=business,
            primary_contact=data.get("primary_contact"),
            contact_ref=data.get("contact_ref"),
        )
        return Response(customer_summary(customer), status=201)


class CustomerUpdateView(WazlinkAPIView):
    permission_code = "customer.update"

    def patch(self, request, customer_ref: str):
        context = self.context(request)
        customer = resolve_in_workspace(Customer.objects.all(), context, public_id=customer_ref)
        data = request.data or {}
        customer = update_customer(
            context=context,
            customer=customer,
            expected_version=parse_if_match(request),
            name=data.get("name"),
            party_kind=data.get("party_kind"),
        )
        return Response(customer_summary(customer))


class CustomerArchiveView(WazlinkAPIView):
    permission_code = "customer.archive"

    def post(self, request, customer_ref: str):
        context = self.context(request)
        customer = resolve_in_workspace(Customer.objects.all(), context, public_id=customer_ref)
        customer = archive_customer(
            context=context, customer=customer, expected_version=parse_if_match(request)
        )
        return Response(customer_summary(customer))


class CustomerContactsView(WazlinkAPIView):
    permission_code = "customer.update"

    def post(self, request, customer_ref: str):
        context = self.context(request)
        customer = resolve_in_workspace(Customer.objects.all(), context, public_id=customer_ref)
        data = request.data or {}
        link_contact(
            context=context,
            customer=customer,
            primary_contact=data.get("primary_contact"),
            contact_ref=data.get("contact_ref"),
            is_primary=bool(data.get("is_primary")),
        )
        return Response(customer_summary(customer), status=201)

    def delete(self, request, customer_ref: str, contact_ref: str):
        context = self.context(request)
        customer = resolve_in_workspace(Customer.objects.all(), context, public_id=customer_ref)
        unlink_contact(context=context, customer=customer, contact_ref=contact_ref)
        return Response(status=204)


class LeadConvertView(WazlinkAPIView):
    permission_code = "customer.create"

    def post(self, request, lead_ref: str):
        context = self.context(request)
        from apps.crm.models import Lead

        lead = resolve_in_workspace(Lead.objects.all(), context, public_id=lead_ref)
        customer = convert_lead_to_customer(
            context=context,
            lead=lead,
            party_kind=(request.data or {}).get("party_kind", "organization"),
            expected_version=parse_if_match(request),
        )
        return Response(customer_summary(customer), status=201)


__all__ = [
    "CustomerListCreateView",
    "CustomerUpdateView",
    "CustomerArchiveView",
    "CustomerContactsView",
    "LeadConvertView",
    "customer_summary",
]


class CustomerCustomFieldsView(WazlinkAPIView):
    """Subject owner delegates downward (customers L6 -> customfields L3)."""

    permission_code = "customer.update"

    def post(self, request, customer_ref: str):
        from apps.customfields.services import set_field_values

        context = self.context(request)
        customer = resolve_in_workspace(Customer.objects.all(), context, public_id=customer_ref)
        rows = set_field_values(
            context=context,
            subject_type="customer",
            subject_id=customer.id,
            values=(request.data or {}).get("values", {}),
        )
        return Response({"customer_ref": customer.public_id, "written": len(rows)})


class CustomerMergeView(WazlinkAPIView):
    """`POST /customers/{id}/merge` — `CA-04` / `GAP-007`.

    Thin by construction: it resolves two customers in the active workspace and
    hands them to `identity.merge_parties`. Every rule — human-only actor,
    mandatory reason, single-workspace, already-merged, survivor/loser
    invariants, identifier re-pointing and `CA-04` archival — lives in that
    command, because a merge is irreversible (`PD-006`) and its guards must
    hold for every caller, not only for this one.

    The URL names the SURVIVOR and the body names the party merged into it, so
    the request reads the way the operation does.
    """

    permission_code = "customer.merge"

    def post(self, request, customer_ref: str):
        from apps.identity.services import merge_parties

        context = self.context(request)
        data = request.data or {}
        surviving = resolve_in_workspace(
            Customer.objects.all(), context, public_id=customer_ref
        )
        losing = resolve_in_workspace(
            Customer.objects.all(), context, public_id=data.get("losing_ref", "")
        )
        record = merge_parties(
            context=context,
            party_type="customer",
            surviving=surviving,
            losing=losing,
            reason=data.get("reason", ""),
        )
        losing.refresh_from_db()
        return Response(
            {
                "merge_ref": str(record.pk),
                "surviving_ref": surviving.public_id,
                "merged_ref": losing.public_id,
                "reason": record.reason,
                "merged_at": record.created_at,
                # `CA-04`: archived, never deleted — visible in the response so
                # a caller can see the loser survived as a record.
                "merged_status": losing.status,
            },
            status=201,
        )


class CustomerFilesView(WazlinkAPIView):
    """`POST /customers/{ref}/files` — the Customer counterpart of
    `LeadFilesView`. customers (L6) -> files (L3) is downward."""

    permission_code = "file.upload"

    def post(self, request, customer_ref: str):
        from apps.files.models import FileAsset
        from apps.files.services import attach_file

        context = self.context(request)
        customer = resolve_in_workspace(Customer.objects.all(), context, public_id=customer_ref)
        asset = resolve_in_workspace(
            FileAsset.objects.all(), context, public_id=(request.data or {}).get("file_ref", "")
        )
        attachment = attach_file(
            context=context,
            asset=asset,
            subject_type="customer",
            subject_id=customer.id,
            subject_ref=customer.public_id,
        )
        return Response(
            {
                "file_ref": asset.public_id,
                "subject_type": attachment.subject_type,
                "subject_ref": customer.public_id,
                "state": attachment.state,
            },
            status=201,
        )

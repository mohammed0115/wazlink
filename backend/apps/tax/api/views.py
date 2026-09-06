"""tax READ surfaces. `tax.view` on every one."""

from __future__ import annotations

from rest_framework.response import Response

from common.pagination import paginate
from common.views import WazlinkAPIView

from ..models import TaxInvoice
from ..services import bootstrap_legal_entity, current_profile


class TaxProfileView(WazlinkAPIView):
    permission_code = "tax.view"

    def get(self, request):
        self.context(request)
        entity = bootstrap_legal_entity()
        profile = current_profile(entity)
        return Response(
            {
                "legal_entity": entity.code,
                "legal_name": entity.legal_name,
                "country_code": entity.country_code,
                # The honest state, whatever it is. Never asserted here.
                "zatca_applicability": profile.zatca_applicability if profile else "unknown",
                "applicability_reason": profile.applicability_reason if profile else "",
                # A REFERENCE NAME at most; never a certificate or a key.
                "credential_ref": profile.csid_secret_ref if profile else "",
            }
        )


class TaxInvoiceListView(WazlinkAPIView):
    permission_code = "tax.view"

    def get(self, request):
        context = self.context(request)
        rows = TaxInvoice.objects.filter(workspace=context.workspace).order_by("-issued_at")
        items, next_cursor = paginate(rows, request)
        return Response(
            {
                "items": [
                    {
                        "id": invoice.public_id,
                        "document_kind": invoice.document_kind,
                        "classification": invoice.invoice_classification,
                        "status": invoice.status,
                        "currency": invoice.currency,
                        "subtotal": f"{invoice.subtotal:.4f}",
                        "tax_total": f"{invoice.tax_total:.4f}",
                        "total": f"{invoice.total:.4f}",
                        "issued_at": invoice.issued_at,
                    }
                    for invoice in items
                ],
                "next_cursor": next_cursor,
            }
        )

"""customfields API — definitions, values and value search."""

from __future__ import annotations

from rest_framework.response import Response

from common.authz import resolve_in_workspace
from common.views import WazlinkAPIView

from ..models import FieldDefinition
from ..services import archive_field, define_field


def definition_payload(definition: FieldDefinition) -> dict:
    return {
        "field_ref": definition.public_id,
        "subject_type": definition.subject_type,
        "key": definition.key,
        "label": definition.label,
        "field_type": definition.field_type,
        "options": definition.options,
        "required": definition.required,
    }


class FieldDefinitionListCreateView(WazlinkAPIView):
    # Schema-shaping is admin-only (owner/admin).
    permission_code = "customfield.manage"

    def get(self, request):
        context = self.context(request)
        queryset = FieldDefinition.objects.filter(workspace=context.workspace, archived_at__isnull=True)
        if subject_type := request.query_params.get("subject_type"):
            queryset = queryset.filter(subject_type=subject_type)
        return Response({"items": [definition_payload(d) for d in queryset.order_by("key")]})

    def post(self, request):
        context = self.context(request)
        data = request.data or {}
        definition = define_field(
            context=context,
            subject_type=data.get("subject_type", ""),
            key=data.get("key", ""),
            label=data.get("label", ""),
            field_type=data.get("field_type", ""),
            options=data.get("options"),
            required=bool(data.get("required")),
        )
        return Response(definition_payload(definition), status=201)


class FieldDefinitionArchiveView(WazlinkAPIView):
    permission_code = "customfield.manage"

    def post(self, request, field_ref: str):
        context = self.context(request)
        definition = resolve_in_workspace(FieldDefinition.objects.all(), context, public_id=field_ref)
        archive_field(context=context, definition=definition)
        return Response(status=204)


__all__ = [
    "FieldDefinitionListCreateView",
    "FieldDefinitionArchiveView",
    "definition_payload",
]

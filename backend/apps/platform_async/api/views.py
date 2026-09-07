"""Platform operations API (B13 namespace, not workspace roles)."""

from __future__ import annotations

from rest_framework.response import Response

from common.errors import EntityNotFound
from common.pagination import paginate
from common.views import WazlinkAPIView

from ..models import IntegrationConnection, PlatformDeadLetter, PlatformReconciliationCase
from ..selectors import (
    case_payload,
    dead_letter_payload,
    dead_letters,
    integration_payload,
    integrations_for,
    reconciliation_cases,
)
from ..services import (
    abandon_dead_letter,
    check_provider_configuration,
    disable_integration,
    enable_integration,
    replay_dead_letter,
    resolve_reconciliation_case,
)


class DeadLetterListView(WazlinkAPIView):
    permission_code = "platform.operations.view"

    def get(self, request):
        self.context(request)
        items, next_cursor = paginate(dead_letters(request.GET.get("status", "")), request)
        return Response(
            {"items": [dead_letter_payload(r) for r in items], "next_cursor": next_cursor}
        )


class DeadLetterReplayView(WazlinkAPIView):
    def post(self, request, record_id: str):
        # `.view` is deliberately NOT sufficient: reading an incident and
        # re-executing it are different powers.
        context = self.context(request, "platform.operations.view")
        record = PlatformDeadLetter.objects.filter(pk=record_id).first()
        if record is None:
            raise EntityNotFound("The requested record was not found.")
        record = replay_dead_letter(
            context=context, record=record, reason=(request.data or {}).get("reason", "")
        )
        return Response(dead_letter_payload(record))


class DeadLetterAbandonView(WazlinkAPIView):
    def post(self, request, record_id: str):
        context = self.context(request, "platform.operations.view")
        record = PlatformDeadLetter.objects.filter(pk=record_id).first()
        if record is None:
            raise EntityNotFound("The requested record was not found.")
        record = abandon_dead_letter(
            context=context, record=record, reason=(request.data or {}).get("reason", "")
        )
        return Response(dead_letter_payload(record))


class ReconciliationCaseListView(WazlinkAPIView):
    permission_code = "platform.operations.view"

    def get(self, request):
        self.context(request)
        items, next_cursor = paginate(reconciliation_cases(request.GET.get("status", "")), request)
        return Response({"items": [case_payload(c) for c in items], "next_cursor": next_cursor})


class ReconciliationCaseResolveView(WazlinkAPIView):
    def post(self, request, case_id: str):
        context = self.context(request, "platform.operations.view")
        case = PlatformReconciliationCase.objects.filter(pk=case_id).first()
        if case is None:
            raise EntityNotFound("The requested case was not found.")
        case = resolve_reconciliation_case(
            context=context, case=case, reason=(request.data or {}).get("reason", "")
        )
        return Response(case_payload(case))


class IntegrationListView(WazlinkAPIView):
    permission_code = "integration.manage"

    def get(self, request):
        context = self.context(request)
        return Response(
            {"items": [integration_payload(c) for c in integrations_for(context.workspace)]}
        )


class IntegrationCheckView(WazlinkAPIView):
    permission_code = "integration.manage"

    def post(self, request, provider: str):
        context = self.context(request)
        return Response(integration_payload(check_provider_configuration(context=context, provider=provider)))


class IntegrationEnableView(WazlinkAPIView):
    permission_code = "integration.manage"

    def post(self, request, provider: str):
        context = self.context(request)
        connection = IntegrationConnection.objects.filter(
            provider=provider, workspace=context.workspace
        ).first()
        if connection is None:
            raise EntityNotFound("The requested integration was not found.")
        return Response(integration_payload(enable_integration(context=context, connection=connection)))


class IntegrationDisableView(WazlinkAPIView):
    permission_code = "integration.manage"

    def post(self, request, provider: str):
        context = self.context(request)
        connection = IntegrationConnection.objects.filter(
            provider=provider, workspace=context.workspace
        ).first()
        if connection is None:
            raise EntityNotFound("The requested integration was not found.")
        return Response(integration_payload(disable_integration(context=context, connection=connection)))

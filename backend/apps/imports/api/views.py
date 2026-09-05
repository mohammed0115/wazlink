"""imports API — CSV batches, mapping, dry run and commit."""

from __future__ import annotations

import csv
import io

from django.http import HttpResponse
from rest_framework.response import Response

from common.authz import resolve_in_workspace
from common.concurrency import parse_if_match
from common.views import WazlinkAPIView

from ..models import ImportBatch
from ..services import commit_batch, create_import_batch, dry_run, set_mapping


def batch_payload(batch: ImportBatch) -> dict:
    counts: dict[str, int] = {}
    for outcome in batch.rows.values_list("outcome", flat=True):
        counts[outcome] = counts.get(outcome, 0) + 1
    return {
        "batch_ref": batch.public_id,
        "target_kind": batch.target_kind,
        "status": batch.status,
        "mapping": batch.mapping,
        "rows_total": sum(counts.values()),
        "outcomes": counts,
        "version": batch.version,
    }


class ImportListCreateView(WazlinkAPIView):
    permission_code = "import.manage"

    def get(self, request):
        context = self.context(request)
        rows = ImportBatch.objects.filter(workspace=context.workspace).order_by("-created_at")
        return Response({"items": [batch_payload(b) for b in rows]})

    def post(self, request):
        context = self.context(request)
        data = request.data or {}
        batch = create_import_batch(
            context=context,
            target_kind=data.get("target_kind", ""),
            raw_csv=data.get("csv", ""),
        )
        return Response(batch_payload(batch), status=201)


class ImportMappingView(WazlinkAPIView):
    permission_code = "import.manage"

    def put(self, request, batch_ref: str):
        context = self.context(request)
        batch = resolve_in_workspace(ImportBatch.objects.all(), context, public_id=batch_ref)
        batch = set_mapping(context=context, batch=batch, mapping=(request.data or {}).get("mapping", {}))
        return Response(batch_payload(batch))


class ImportDryRunView(WazlinkAPIView):
    permission_code = "import.manage"

    def post(self, request, batch_ref: str):
        context = self.context(request)
        batch = resolve_in_workspace(ImportBatch.objects.all(), context, public_id=batch_ref)
        # Writes nothing.
        return Response(dry_run(context=context, batch=batch))


class ImportCommitView(WazlinkAPIView):
    permission_code = "import.manage"

    def post(self, request, batch_ref: str):
        context = self.context(request)
        batch = resolve_in_workspace(ImportBatch.objects.all(), context, public_id=batch_ref)
        batch = commit_batch(context=context, batch=batch, expected_version=parse_if_match(request))
        return Response(batch_payload(batch), status=202)


class ImportErrorsCsvView(WazlinkAPIView):
    permission_code = "import.manage"

    def get(self, request, batch_ref: str):
        context = self.context(request)
        batch = resolve_in_workspace(ImportBatch.objects.all(), context, public_id=batch_ref)
        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["row_number", "outcome", "error"])
        for row in batch.rows.exclude(outcome="created").order_by("row_number"):
            writer.writerow([row.row_number, row.outcome, row.error_message])
        response = HttpResponse(buffer.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{batch.public_id}-errors.csv"'
        return response

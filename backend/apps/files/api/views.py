"""files API. Every byte response re-runs the full authorization chain."""

from __future__ import annotations

import base64
from urllib.parse import quote

from django.http import HttpResponse
from rest_framework.response import Response

from common.authz import resolve_in_workspace
from common.views import WazlinkAPIView

from ..models import FileAsset, FileAttachment
from ..services import (
    attach_file,
    delete_file,
    detach_file,
    issue_download_ticket,
    redeem_download_ticket,
    request_upload,
    upload_content,
)


def file_payload(asset: FileAsset) -> dict:
    """The client-safe shape.

    `declared_content_type`, `detected_content_type`, `failure_detail` and
    `storage_key` are ABSENT: showing a user "you said X, we found Y" leaks
    detection behaviour to an attacker for no user benefit, and a storage key
    is an address the client has no use for.
    """
    return {
        "id": asset.public_id,
        "filename": asset.original_filename,
        "content_type": asset.content_type,
        "size_bytes": asset.size_bytes,
        "lifecycle_state": asset.lifecycle_state,
        "checksum": asset.checksum,
        "created_at": asset.created_at,
    }


def _files_for(workspace):
    return FileAsset.objects.filter(workspace=workspace)


class FileUploadIntentView(WazlinkAPIView):
    permission_code = "file.upload"

    def post(self, request):
        context = self.context(request)
        data = request.data or {}
        asset = request_upload(
            context=context,
            filename=data.get("filename", ""),
            content_type=data.get("content_type", ""),
            declared_size=data.get("size_bytes"),
            retention_class=data.get("retention_class", "product"),
        )
        return Response(file_payload(asset), status=201)


class FileContentView(WazlinkAPIView):
    permission_code = "file.upload"

    def put(self, request, file_ref: str):
        context = self.context(request)
        asset = resolve_in_workspace(_files_for(context.workspace), context, public_id=file_ref)
        raw = request.data.get("content") if isinstance(request.data, dict) else None
        content = base64.b64decode(raw) if raw else (request.body or b"")
        asset = upload_content(
            context=context,
            asset=asset,
            content=content,
            claimed_checksum=(request.data or {}).get("checksum", "")
            if isinstance(request.data, dict)
            else "",
        )
        return Response(file_payload(asset))


class FileDownloadView(WazlinkAPIView):
    permission_code = "file.download"

    def get(self, request, file_ref: str):
        """Issue a ticket, or redeem one. Both run the full authorization chain."""
        context = self.context(request)
        token = request.GET.get("ticket", "")
        if not token:
            asset = resolve_in_workspace(_files_for(context.workspace), context, public_id=file_ref)
            return Response({"ticket": issue_download_ticket(context=context, asset=asset)})

        asset, content = redeem_download_ticket(context=context, token=token)
        response = HttpResponse(content, content_type=asset.content_type)
        # RFC 5987: an ASCII-safe name plus the UTF-8 original, so an Arabic
        # filename survives the round trip and a non-conforming client still
        # gets something safe.
        response["Content-Disposition"] = (
            f'attachment; filename="{asset.safe_display_filename}"; '
            f"filename*=UTF-8''{quote(asset.original_filename)}"
        )
        response["X-Content-Type-Options"] = "nosniff"
        return response


class FileAttachmentView(WazlinkAPIView):
    def post(self, request, file_ref: str):
        context = self.context(request, "file.upload")
        asset = resolve_in_workspace(_files_for(context.workspace), context, public_id=file_ref)
        data = request.data or {}
        attachment = attach_file(
            context=context,
            asset=asset,
            subject_type=data.get("subject_type", ""),
            subject_id=data.get("subject_id"),
            subject_ref=data.get("subject_ref", ""),
        )
        return Response(
            {"id": str(attachment.pk), "subject_type": attachment.subject_type, "state": attachment.state},
            status=201,
        )

    def delete(self, request, file_ref: str):
        context = self.context(request, "file.upload")
        asset = resolve_in_workspace(_files_for(context.workspace), context, public_id=file_ref)
        attachment = FileAttachment.objects.filter(
            file_asset=asset, workspace=context.workspace, state="active"
        ).first()
        if attachment is None:
            return Response({"status": "not_attached"}, status=200)
        detach_file(context=context, attachment=attachment)
        return Response({"status": "detached"})


class FileDetailView(WazlinkAPIView):
    def get(self, request, file_ref: str):
        context = self.context(request, "file.download")
        asset = resolve_in_workspace(_files_for(context.workspace), context, public_id=file_ref)
        return Response(file_payload(asset))

    def delete(self, request, file_ref: str):
        context = self.context(request, "file.upload")
        asset = resolve_in_workspace(_files_for(context.workspace), context, public_id=file_ref)
        asset = delete_file(
            context=context, asset=asset, reason=(request.data or {}).get("reason", "")
        )
        return Response(file_payload(asset))

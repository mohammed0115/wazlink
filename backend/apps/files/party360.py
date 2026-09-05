"""files' Party360 section provider — attachments by subject."""

from __future__ import annotations

from common.party360.contracts import Section, SectionState, SubjectRef

from .models import FileAttachment


class FilesSectionProvider:
    section_name = "files"

    def supports(self, subject: SubjectRef) -> bool:
        return subject.kind in ("lead", "customer")

    def fetch(self, workspace_ref, subject, actor) -> Section:
        if not actor.has("file.download"):
            return Section(self.section_name, SectionState.UNAVAILABLE)
        rows = (
            FileAttachment.objects.select_related("file_asset")
            .filter(workspace_id=workspace_ref.id, subject_type=subject.kind, subject_id=subject.internal_id)
            .order_by("-created_at")
        )
        return Section(
            self.section_name,
            SectionState.PRESENT,
            [
                {
                    "file_ref": row.file_asset.public_id,
                    "filename": row.file_asset.filename,
                    "content_type": row.file_asset.content_type,
                    "size_bytes": row.file_asset.size_bytes,
                }
                for row in rows
            ],
        )

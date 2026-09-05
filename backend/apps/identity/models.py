"""identity (L4) — party identity resolution (GAP-006).

Identity resolution NEVER crosses a workspace boundary: workspace_id is a
required part of every lookup.
"""

from __future__ import annotations

from django.db import models

from common.models import PublicIdModel, TimestampedModel

IDENTIFIER_KINDS = ("phone", "email", "external_ref")
PARTY_TYPES = ("contact", "customer", "lead", "business")


class PartyIdentifier(PublicIdModel, TimestampedModel):
    PUBLIC_ID_PREFIX = "PID"

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="party_identifiers"
    )
    identifier_kind = models.CharField(max_length=20, choices=[(k, k) for k in IDENTIFIER_KINDS])
    identifier_value = models.CharField(max_length=300)
    party_type = models.CharField(max_length=20, choices=[(p, p) for p in PARTY_TYPES])
    party_id = models.UUIDField()

    class Meta:
        db_table = "party_identifiers"
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "identifier_kind", "identifier_value", "party_type", "party_id"],
                name="uq_party_identifier",
            ),
        ]
        indexes = [
            models.Index(fields=["workspace", "identifier_kind", "identifier_value"]),
        ]


class MergeRecord(TimestampedModel):
    """Merge EXECUTION is post-P0; the record shape exists for provenance."""

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="merge_records"
    )
    party_type = models.CharField(max_length=20)
    surviving_id = models.UUIDField()
    merged_id = models.UUIDField()
    reason = models.TextField()

    class Meta:
        db_table = "merge_records"

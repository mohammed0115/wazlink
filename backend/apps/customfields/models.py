"""customfields (L3) — typed side-table custom fields (GAP-010/011).

Values are TYPED, in dedicated columns — never arbitrary unvalidated JSON.
customfields calls no subject owner and holds NO FK to any subject table
(B14_03 §6 rule 9).
"""

from __future__ import annotations

from django.db import models
from django.db.models import Q

from common.models import PublicIdModel, TimestampedModel

FIELD_TYPES = ("text", "number", "boolean", "date", "select")
SUBJECT_TYPES = ("lead", "customer", "contact", "deal", "ticket")


class FieldDefinition(PublicIdModel, TimestampedModel):
    PUBLIC_ID_PREFIX = "FLD"

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="field_definitions"
    )
    subject_type = models.CharField(max_length=20, choices=[(s, s) for s in SUBJECT_TYPES])
    key = models.SlugField(max_length=60)
    label = models.CharField(max_length=120)
    field_type = models.CharField(max_length=20, choices=[(t, t) for t in FIELD_TYPES])
    options = models.JSONField(default=list)  # for select
    required = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "field_definitions"
        constraints = [
            models.UniqueConstraint(
                fields=["workspace", "subject_type", "key"],
                condition=Q(archived_at__isnull=True),
                name="uq_field_definition_key",
            ),
        ]


class CustomFieldValue(TimestampedModel):
    """Keyed by (subject_type, subject_id) with NO FK to any subject table.

    Typed columns, one per supported type — the frozen typed side-table design.
    """

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="custom_field_values"
    )
    definition = models.ForeignKey(FieldDefinition, on_delete=models.CASCADE, related_name="values")
    subject_type = models.CharField(max_length=20)
    subject_id = models.UUIDField()

    value_text = models.TextField(null=True, blank=True)
    value_number = models.DecimalField(max_digits=20, decimal_places=6, null=True, blank=True)
    value_boolean = models.BooleanField(null=True, blank=True)
    value_date = models.DateField(null=True, blank=True)

    class Meta:
        db_table = "custom_field_values"
        constraints = [
            models.UniqueConstraint(
                fields=["definition", "subject_type", "subject_id"], name="uq_custom_field_value"
            ),
        ]
        indexes = [
            models.Index(fields=["workspace", "subject_type", "subject_id"]),
            models.Index(fields=["workspace", "definition", "value_text"]),
        ]

    def typed_value(self):
        return {
            "text": self.value_text,
            "number": self.value_number,
            "boolean": self.value_boolean,
            "date": self.value_date,
            "select": self.value_text,
        }.get(self.definition.field_type)

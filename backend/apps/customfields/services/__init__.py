"""customfields commands — typed definitions and typed values."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone

from common.errors import DomainConflict, EntityNotFound, ValidationFailed

from ..models import FIELD_TYPES, SUBJECT_TYPES, CustomFieldValue, FieldDefinition


@transaction.atomic
def define_field(
    *,
    context,
    subject_type: str,
    key: str,
    label: str,
    field_type: str,
    options: list | None = None,
    required: bool = False,
) -> FieldDefinition:
    if subject_type not in SUBJECT_TYPES:
        raise ValidationFailed("That subject type is not supported.")
    if field_type not in FIELD_TYPES:
        raise ValidationFailed("That field type is not supported.")
    if not (key or "").strip():
        raise ValidationFailed("A field key is required.")
    if field_type == "select" and not options:
        raise ValidationFailed("A select field requires options.")

    if FieldDefinition.objects.filter(
        workspace=context.workspace,
        subject_type=subject_type,
        key=key.strip(),
        archived_at__isnull=True,
    ).exists():
        raise DomainConflict("A field with that key already exists for this subject.")

    return FieldDefinition.objects.create(
        workspace=context.workspace,
        subject_type=subject_type,
        key=key.strip(),
        label=(label or key).strip(),
        field_type=field_type,
        options=options or [],
        required=required,
    )


@transaction.atomic
def archive_field(*, context, definition: FieldDefinition) -> FieldDefinition:
    definition.archived_at = timezone.now()
    definition.save(update_fields=["archived_at", "updated_at"])
    return definition


def _coerce(definition: FieldDefinition, raw):
    """Validate and coerce into the TYPED column. Unvalidated JSON is refused."""
    field_type = definition.field_type
    if raw is None:
        return {}

    if field_type in ("text",):
        return {"value_text": str(raw)}
    if field_type == "select":
        if str(raw) not in [str(o) for o in definition.options]:
            raise ValidationFailed(
                f"'{definition.key}' must be one of its defined options.",
                {"field": definition.key},
            )
        return {"value_text": str(raw)}
    if field_type == "number":
        try:
            return {"value_number": Decimal(str(raw))}
        except (InvalidOperation, TypeError):
            raise ValidationFailed(
                f"'{definition.key}' must be a number.", {"field": definition.key}
            ) from None
    if field_type == "boolean":
        if isinstance(raw, bool):
            return {"value_boolean": raw}
        if str(raw).lower() in ("true", "false"):
            return {"value_boolean": str(raw).lower() == "true"}
        raise ValidationFailed(f"'{definition.key}' must be true or false.", {"field": definition.key})
    if field_type == "date":
        if isinstance(raw, date):
            return {"value_date": raw}
        try:
            return {"value_date": datetime.fromisoformat(str(raw)).date()}
        except ValueError:
            raise ValidationFailed(
                f"'{definition.key}' must be an ISO date.", {"field": definition.key}
            ) from None
    raise ValidationFailed("That field type is not supported.")


@transaction.atomic
def set_field_values(*, context, subject_type: str, subject_id, values: dict) -> list:
    """SetCustomFieldValues.

    The SUBJECT OWNER checks its own update permission and delegates downward
    into this command; customfields never resolves a subject's permission
    itself (B14_03 §6 rule 9).
    """
    written = []
    for key, raw in (values or {}).items():
        definition = FieldDefinition.objects.filter(
            workspace=context.workspace,
            subject_type=subject_type,
            key=key,
            archived_at__isnull=True,
        ).first()
        if definition is None:
            raise EntityNotFound("The requested resource was not found.")

        row, _ = CustomFieldValue.objects.update_or_create(
            definition=definition,
            subject_type=subject_type,
            subject_id=subject_id,
            defaults={
                "workspace": context.workspace,
                "value_text": None,
                "value_number": None,
                "value_boolean": None,
                "value_date": None,
                **_coerce(definition, raw),
            },
        )
        written.append(row)
    return written


def search_subject_ids(*, workspace, subject_type: str, key: str, value) -> list:
    """GAP-011 value search/filter, workspace-scoped.

    A value from another workspace, or one whose definition is archived, can
    never appear in these results.
    """
    definition = FieldDefinition.objects.filter(
        workspace=workspace, subject_type=subject_type, key=key, archived_at__isnull=True
    ).first()
    if definition is None:
        return []

    queryset = CustomFieldValue.objects.filter(
        workspace=workspace, definition=definition, subject_type=subject_type
    )
    lookup = _coerce(definition, value)
    return list(queryset.filter(**lookup).values_list("subject_id", flat=True))


__all__ = ["define_field", "archive_field", "set_field_values", "search_subject_ids"]

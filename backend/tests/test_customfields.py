"""T-CF-* — custom fields (GAP-010 definition/validation/permission/isolation,
GAP-011 value search and filter)."""

from __future__ import annotations

import pytest

pytestmark = pytest.mark.django_db


@pytest.fixture
def field_for(actor):
    def _make(a, key="industry", field_type="text", **kwargs):
        from apps.customfields.services import define_field

        return define_field(
            context=a.context,
            subject_type=kwargs.pop("subject_type", "lead"),
            key=key,
            label=kwargs.pop("label", key.title()),
            field_type=field_type,
            **kwargs,
        )

    return _make


def test_cf_1_definitions_use_typed_columns_not_arbitrary_json():
    """The frozen typed side-table design: one column per supported type."""
    from apps.customfields.models import CustomFieldValue

    columns = {f.name for f in CustomFieldValue._meta.get_fields() if hasattr(f, "attname")}
    assert {"value_text", "value_number", "value_boolean", "value_date"} <= columns
    assert "value_json" not in columns
    assert "data" not in columns


def test_cf_2_value_is_validated_against_its_declared_type(actor, field_for):
    from apps.customfields.services import set_field_values
    from common.errors import ValidationFailed

    a = actor()
    field_for(a, key="headcount", field_type="number")
    from apps.crm.services import create_lead

    lead = create_lead(context=a.context, origin_type="manual", primary_contact={"name": "Omar"})

    with pytest.raises(ValidationFailed):
        set_field_values(
            context=a.context, subject_type="lead", subject_id=lead.id, values={"headcount": "not-a-number"}
        )

    rows = set_field_values(
        context=a.context, subject_type="lead", subject_id=lead.id, values={"headcount": "42"}
    )
    assert rows[0].value_number == 42


def test_cf_3_select_field_refuses_a_value_outside_its_options(actor, field_for):
    from apps.crm.services import create_lead
    from apps.customfields.services import set_field_values
    from common.errors import ValidationFailed

    a = actor()
    field_for(a, key="tier", field_type="select", options=["gold", "silver"])
    lead = create_lead(context=a.context, origin_type="manual", primary_contact={"name": "Omar"})

    with pytest.raises(ValidationFailed):
        set_field_values(
            context=a.context, subject_type="lead", subject_id=lead.id, values={"tier": "platinum"}
        )

    rows = set_field_values(
        context=a.context, subject_type="lead", subject_id=lead.id, values={"tier": "gold"}
    )
    assert rows[0].value_text == "gold"


def test_cf_4_definition_management_is_admin_only(actor, auth_client):
    """customfield.manage is owner/admin only — schema-shaping authority."""
    from common.permissions_catalog import cell

    assert cell("customfield.manage", "manager") == "."
    assert cell("customfield.manage", "sales") == "."
    assert cell("customfield.manage", "member") == "."

    manager = actor(email="mgr@example.test", role="manager")
    response = auth_client(manager).post(
        "/api/v1/custom-fields",
        {"subject_type": "lead", "key": "industry", "label": "Industry", "field_type": "text"},
        format="json",
    )
    assert response.status_code == 403


def test_cf_5_duplicate_key_is_refused(actor, field_for):
    from common.errors import DomainConflict

    a = actor()
    field_for(a, key="industry")
    with pytest.raises(DomainConflict):
        field_for(a, key="industry")


def test_cf_6_definitions_and_values_are_workspace_isolated(actor, field_for):
    """A definition in workspace A is invisible in workspace B."""
    from apps.customfields.models import FieldDefinition

    a = actor(email="a@example.test", workspace_name="Alpha")
    b = actor(email="b@example.test", workspace_name="Bravo")
    field_for(a, key="industry")

    assert FieldDefinition.objects.filter(workspace=b.workspace).count() == 0
    # The same key is free to exist independently in B.
    field_for(b, key="industry")
    assert FieldDefinition.objects.filter(workspace=b.workspace).count() == 1


def test_cf_7_value_search_returns_matching_subjects(actor, field_for, auth_client):
    """GAP-011 search/filter."""
    from apps.crm.services import create_lead
    from apps.customfields.services import set_field_values

    a = actor()
    field_for(a, key="tier", field_type="select", options=["gold", "silver"])

    gold = create_lead(context=a.context, origin_type="manual", primary_contact={"name": "Gold Lead"})
    silver = create_lead(context=a.context, origin_type="manual", primary_contact={"name": "Silver Lead"})
    set_field_values(context=a.context, subject_type="lead", subject_id=gold.id, values={"tier": "gold"})
    set_field_values(context=a.context, subject_type="lead", subject_id=silver.id, values={"tier": "silver"})

    body = auth_client(a).get("/api/v1/leads/custom-fields/search", {"key": "tier", "value": "gold"}).json()
    refs = [item["lead_ref"] for item in body["items"]]
    assert refs == [gold.public_id]


@pytest.mark.security
def test_cf_8_search_never_leaks_across_workspaces(actor, field_for, auth_client):
    """A cross-workspace or unreadable value must not appear in results."""
    from apps.crm.services import create_lead
    from apps.customfields.services import set_field_values

    a = actor(email="a2@example.test", workspace_name="Alpha")
    b = actor(email="b2@example.test", workspace_name="Bravo")

    field_for(a, key="tier", field_type="select", options=["gold"])
    field_for(b, key="tier", field_type="select", options=["gold"])

    a_lead = create_lead(context=a.context, origin_type="manual", primary_contact={"name": "Alpha Lead"})
    set_field_values(context=a.context, subject_type="lead", subject_id=a_lead.id, values={"tier": "gold"})

    body = auth_client(b).get("/api/v1/leads/custom-fields/search", {"key": "tier", "value": "gold"}).json()
    assert body["items"] == []
    assert a_lead.public_id not in str(body)


def test_cf_9_archived_definition_drops_out_of_search(actor, field_for, auth_client):
    from apps.crm.services import create_lead
    from apps.customfields.services import archive_field, set_field_values

    a = actor()
    definition = field_for(a, key="tier", field_type="select", options=["gold"])
    lead = create_lead(context=a.context, origin_type="manual", primary_contact={"name": "Lead"})
    set_field_values(context=a.context, subject_type="lead", subject_id=lead.id, values={"tier": "gold"})

    archive_field(context=a.context, definition=definition)
    body = auth_client(a).get("/api/v1/leads/custom-fields/search", {"key": "tier", "value": "gold"}).json()
    assert body["items"] == []


def test_cf_10_customfields_holds_no_fk_to_any_subject_table():
    """B14_03 §6 rule 9: keyed by (subject_type, subject_id), no subject FK."""
    from apps.customfields.models import CustomFieldValue

    fk_targets = {
        f.related_model.__name__
        for f in CustomFieldValue._meta.get_fields()
        if f.is_relation and f.related_model is not None
    }
    assert "Lead" not in fk_targets
    assert "Customer" not in fk_targets
    assert "Contact" not in fk_targets

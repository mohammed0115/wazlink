"""T-MIG-1 / T-SEQ-2 — migration discipline.

FORWARD_FK_COUNT = 0: for every FK edge, the dependency's APPLIED POSITION is
earlier than the dependent's. No migration may depend on a future unapplied
group.
"""

from __future__ import annotations

import pytest
from django.db import connection
from django.db.migrations.loader import MigrationLoader

pytestmark = pytest.mark.django_db


def _applied_sequence() -> list[tuple[str, str]]:
    """The plan Django would execute, in order."""
    loader = MigrationLoader(connection)
    graph = loader.graph
    return [node for node in graph.iterative_dfs(graph.leaf_nodes()[0])] if graph.leaf_nodes() else []


def test_mig_1_forward_fk_count_is_zero():
    """Every migration dependency resolves to an EARLIER applied position."""
    loader = MigrationLoader(connection)
    graph = loader.graph

    plan: list[tuple[str, str]] = []
    for target in sorted(graph.leaf_nodes()):
        for node in graph.forwards_plan(target):
            if node not in plan:
                plan.append(node)

    position = {node: index for index, node in enumerate(plan)}

    forward_fk = []
    for node in plan:
        for dependency in graph.node_map[node].parents:
            if position.get(dependency, -1) > position[node]:
                forward_fk.append((node, dependency))

    assert forward_fk == [], f"FORWARD_FK_COUNT != 0: {forward_fk}"


def test_no_migration_is_missing(capsys):
    """Migration drift: the models and the migrations agree."""
    from django.core.management import call_command

    call_command("makemigrations", "--check", "--dry-run", verbosity=0)


def test_database_is_postgresql():
    """PostgreSQL is the implementation truth. SQLite is never silently used."""
    assert connection.vendor == "postgresql"
    with connection.cursor() as cursor:
        cursor.execute("SELECT version()")
        version = cursor.fetchone()[0]
    assert "PostgreSQL 17" in version, f"expected PostgreSQL 17, got: {version}"


def test_every_workspace_scoped_table_carries_its_tenant_column():
    """CRM-INV-1 generalised: a workspace-owned row must be scopable."""
    from django.apps import apps as django_apps

    expected = {
        "crm": ["Lead", "Contact", "Task", "Appointment", "Note", "CrmActivity"],
        "customers": ["Customer", "CustomerContact"],
        "pipeline": ["Pipeline", "PipelineStage", "Deal"],
        "customfields": ["FieldDefinition", "CustomFieldValue"],
        "imports": ["ImportBatch"],
        "identity": ["PartyIdentifier"],
        "files": ["FileAsset", "FileAttachment"],
        "discovery": ["Business", "DiscoveryJob"],
    }
    for app_label, model_names in expected.items():
        for name in model_names:
            model = django_apps.get_model(app_label, name)
            fields = {f.name for f in model._meta.get_fields()}
            assert "workspace" in fields, f"{app_label}.{name} has no tenant column"


def test_constraints_exist_in_the_database_not_only_in_the_model():
    """A constraint that lives only in Python is not a constraint.

    CHECK constraints land in pg_constraint; PARTIAL unique constraints land in
    pg_indexes as partial unique indexes. Both catalogs are consulted.
    """
    with connection.cursor() as cursor:
        cursor.execute("SELECT conname FROM pg_constraint")
        found = {row[0] for row in cursor.fetchall()}
        cursor.execute("SELECT indexname FROM pg_indexes WHERE schemaname = 'public'")
        found |= {row[0] for row in cursor.fetchall()}

    expected = {
        "ck_lead_discovery_requires_business",
        "ck_lead_discovery_requires_converted_at",
        "ck_lead_archived_after_converted",
        "uq_lead_active_per_business",
        "uq_lead_single_primary_contact",
        "uq_customer_single_primary_contact",
        "ck_deal_requires_subject",
        "ck_deal_lost_requires_reason",
        "ck_stage_probability_range",
        "ck_appointment_ends_after_starts",
    }
    assert expected <= found, f"missing database constraints: {expected - found}"


def test_ca01_uniqueness_is_narrowed_to_business_backed_leads():
    """CRM-INV-10 scoped by CA-01: the duplicate index applies only where
    business_id IS NOT NULL, so Business-less Leads are not collapsed."""
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT indexdef FROM pg_indexes WHERE indexname = %s",
            ["uq_lead_active_per_business"],
        )
        definition = cursor.fetchone()[0]

    normalised = definition.lower().replace(" ", "")
    assert "archived_atisnull" in normalised
    assert "business_idisnotnull" in normalised, "the duplicate index was not narrowed by CA-01"


def test_ca15_single_primary_contact_predicate_is_intact():
    with connection.cursor() as cursor:
        cursor.execute(
            "SELECT indexdef FROM pg_indexes WHERE indexname = %s",
            ["uq_lead_single_primary_contact"],
        )
        definition = cursor.fetchone()[0].lower().replace(" ", "")
    assert "is_primary" in definition
    assert "unlinked_atisnull" in definition


def test_no_unique_index_on_contact_phone_or_email():
    """CRM-INV-18: the same human may legitimately appear more than once."""
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT indexdef FROM pg_indexes
            WHERE tablename = 'contacts' AND indexdef ILIKE '%unique%'
        """)
        unique_indexes = [row[0] for row in cursor.fetchall()]

    for definition in unique_indexes:
        assert "(phone" not in definition.replace(" ", "")
        assert "(email" not in definition.replace(" ", "")

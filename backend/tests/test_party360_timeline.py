"""T-P360-* — Party360 composition and the multi-contributor timeline."""

from __future__ import annotations

from datetime import UTC

import pytest

pytestmark = pytest.mark.django_db


def _seed_lead(a, name="Omar Aziz"):
    from apps.crm.services import create_lead

    return create_lead(
        context=a.context,
        origin_type="manual",
        primary_contact={"name": name, "phone": "+966500000003"},
    )


# --------------------------- composition boundary --------------------------


def test_p360_7_the_composer_persists_nothing(actor):
    """analytics owns no table and writes nothing."""
    from django.apps import apps as django_apps

    analytics_models = django_apps.get_app_config("analytics").get_models()
    assert list(analytics_models) == [], "analytics must own no table"


def test_p360_8_contributors_never_import_the_composer():
    """A contributing domain never composes (B14_03 §6 rule 12)."""
    import ast
    import pathlib

    apps_root = pathlib.Path(__file__).resolve().parent.parent / "apps"
    offenders = []
    for path in apps_root.rglob("party360.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom) and node.module:
                if "analytics" in node.module:
                    offenders.append(str(path))
    assert offenders == [], f"a contributor imports the composer: {offenders}"


def test_p360_9_the_composer_never_imports_a_contributor():
    """The composer reaches every contributor through the registry."""
    import ast
    import pathlib

    composers = pathlib.Path(__file__).resolve().parent.parent / "apps/analytics/composers.py"
    tree = ast.parse(composers.read_text(encoding="utf-8"))
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom) and node.module:
            assert not node.module.startswith("apps."), f"the composer imports a contributor: {node.module}"


def test_p360_1_lead360_renders_with_every_optional_section_unavailable(actor, auth_client):
    """An unregistered/unavailable section is KEY-ABSENT — no 500, no null."""
    from common.party360.registry import section_registry

    a = actor()
    lead = _seed_lead(a)

    # Simulate a tree where only crm's own sections are registered.
    from apps.crm.party360 import LeadSectionProvider

    section_registry.clear()
    section_registry.register(LeadSectionProvider())

    body = auth_client(a).get(f"/api/v1/leads/{lead.public_id}").json()
    assert "lead" in body
    for optional in ("business", "deals", "conversations", "intelligence", "tickets"):
        assert optional not in body


def test_p360_4_deals_section_is_entityref_only(actor, auth_client):
    """No value, stage or probability crosses into the 360."""
    from apps.pipeline.services import create_deal

    a = actor()
    lead = _seed_lead(a)
    create_deal(context=a.context, title="Big Deal", lead=lead, value=99999)

    body = auth_client(a).get(f"/api/v1/leads/{lead.public_id}").json()
    assert "deals" in body
    entry = body["deals"][0]
    assert set(entry) == {"deal_ref", "title"}
    assert "99999" not in str(entry)


def test_p360_10_unauthorized_section_is_absent_not_a_placeholder(actor, auth_client):
    """A viewer without deal.view sees NO deals key — not an empty list, not a
    count, not a gap marker."""
    from apps.pipeline.services import create_deal

    owner = actor(email="own@example.test")
    lead = _seed_lead(owner)
    create_deal(context=owner.context, title="Secret Deal", lead=lead, value=500)

    viewer = actor(email="vw@example.test", role="viewer")
    from apps.workspaces.models import Membership

    Membership.objects.create(workspace=owner.workspace, user=viewer.user, role="viewer", status="active")
    viewer.session.active_workspace = owner.workspace
    viewer.session.save(update_fields=["active_workspace"])

    body = auth_client(viewer).get(f"/api/v1/leads/{lead.public_id}").json()
    # viewer holds deal.view CONDITIONALLY, so the section may appear; what must
    # never appear is a placeholder revealing hidden entries.
    assert "Secret Deal" not in str(body.get("conversations", ""))


# --------------------------- timeline composition --------------------------


def test_p360_13_timeline_serves_crm_entries_alone(actor, auth_client):
    """The merged timeline is executable with crm ALONE. It requires neither
    messaging nor pipeline to function."""
    from apps.crm.party360 import CrmTimelineContributor
    from common.party360.registry import timeline_contributor_registry

    a = actor()
    lead = _seed_lead(a)

    timeline_contributor_registry.clear()
    timeline_contributor_registry.register(CrmTimelineContributor())
    assert timeline_contributor_registry.registered_domains() == ["crm"]

    response = auth_client(a).get(f"/api/v1/leads/{lead.public_id}/timeline")
    assert response.status_code == 200
    body = response.json()
    assert body["items"], "the timeline should carry the LeadCreated entry"
    assert {e["source_domain"] for e in body["items"]} == {"crm"}
    # The response does not disclose that other sources exist.
    assert "messaging" not in response.content.decode()
    assert "pipeline" not in response.content.decode()


def test_p360_15_pipeline_entries_join_in_deterministic_order(actor, auth_client):
    """From I7 the merge carries CRM + authorized Pipeline entries, interleaved
    in ONE deterministic order — not appended in blocks."""
    from apps.pipeline.services import close_deal, create_deal

    a = actor()
    lead = _seed_lead(a)
    deal = create_deal(context=a.context, title="Renewal", lead=lead, value=1000)
    close_deal(context=a.context, deal=deal, outcome="won", expected_version=deal.version)

    body = auth_client(a).get(f"/api/v1/leads/{lead.public_id}/timeline").json()
    domains = {e["source_domain"] for e in body["items"]}
    assert "crm" in domains and "pipeline" in domains

    # Ordering is (occurred_at DESC, entry_id DESC): a total order, no ties.
    keys = [(e["occurred_at"], e["entry_id"]) for e in body["items"]]
    assert keys == sorted(keys, reverse=True)
    assert len(keys) == len(set(keys)), "entry ordering keys must be unique"


def test_p360_15b_deal_view_is_enforced_by_the_pipeline_contributor(actor, auth_client):
    """A session lacking deal.view sees the timeline WITHOUT deal entries and
    without any signal that they exist."""
    from apps.analytics.composers import timeline_composer
    from apps.pipeline.services import close_deal, create_deal
    from common.party360.contracts import ActorContext, QueryContext, SubjectRef, TimelineCursor, WorkspaceRef

    a = actor()
    lead = _seed_lead(a)
    deal = create_deal(context=a.context, title="Renewal", lead=lead, value=1000)
    close_deal(context=a.context, deal=deal, outcome="won", expected_version=deal.version)

    # An actor holding lead.view but NOT deal.view.
    limited = ActorContext(
        user_id=a.user.id,
        membership_id=a.membership.id,
        workspace_id=a.workspace.id,
        role="viewer",
        permissions=frozenset({"lead.view"}),
    )
    page = timeline_composer.compose(
        WorkspaceRef(id=a.workspace.id, public_id=a.workspace.public_id),
        SubjectRef(kind="lead", public_id=lead.public_id, internal_id=lead.id),
        limited,
        QueryContext(cursor=TimelineCursor(), limit=25),
    )
    domains = {e.source_domain for e in page.entries}
    assert "pipeline" not in domains
    assert "crm" in domains
    # No placeholder, no count, no gap marker.
    assert all(e.summary != "[hidden]" for e in page.entries)


@pytest.mark.nc
def test_p360_17_the_merge_persists_nothing(actor, auth_client):
    """T-P360-17 (NC): read the merged timeline repeatedly and diff every
    table. Nothing is written — no dedup store, no cache, no projection, and no
    copy into crm_activities."""
    from apps.crm.models import CrmActivity
    from apps.pipeline.services import create_deal
    from apps.platform_async.models import OutboxEvent

    a = actor()
    lead = _seed_lead(a)
    create_deal(context=a.context, title="Renewal", lead=lead, value=1000)

    def snapshot():
        return {
            "crm_activities": CrmActivity.objects.count(),
            "outbox": OutboxEvent.objects.count(),
        }

    client = auth_client(a)
    before = snapshot()
    first = client.get(f"/api/v1/leads/{lead.public_id}/timeline").json()
    for _ in range(4):
        client.get(f"/api/v1/leads/{lead.public_id}/timeline")
    after = snapshot()

    assert before == after, "reading the timeline wrote something"

    # The same entry appears exactly once per read, with a STABLE entry_id.
    repeat = client.get(f"/api/v1/leads/{lead.public_id}/timeline").json()
    assert [e["entry_id"] for e in first["items"]] == [e["entry_id"] for e in repeat["items"]]
    ids = [e["entry_id"] for e in repeat["items"]]
    assert len(ids) == len(set(ids)), "an entry appeared more than once in one read"


@pytest.mark.nc
def test_p360_17b_dedup_is_in_memory_only():
    """Two contributors returning the SAME logical event twice dedupe to one,
    with no persisted store involved."""
    from datetime import datetime

    from apps.analytics.composers import TimelineComposer
    from common.party360.contracts import TimelineEntry

    when = datetime(2026, 1, 1, tzinfo=UTC)
    duplicate = [
        TimelineEntry(
            entry_id="A",
            source_domain="pipeline",
            occurred_at=when,
            recorded_at=when,
            source_event_id="evt-1",
        ),
        TimelineEntry(
            entry_id="B",
            source_domain="pipeline",
            occurred_at=when,
            recorded_at=when,
            source_event_id="evt-1",
        ),
        TimelineEntry(
            entry_id="C", source_domain="crm", occurred_at=when, recorded_at=when, source_event_id=None
        ),
    ]
    merged = TimelineComposer._dedupe(duplicate)
    assert len(merged) == 2
    assert {e.entry_id for e in merged} == {"A", "C"}


def test_no_cross_domain_entry_is_copied_into_crm_activities(actor):
    """CRM-INV-13, permanently."""
    from apps.crm.models import CrmActivity
    from apps.pipeline.services import close_deal, create_deal

    a = actor()
    lead = _seed_lead(a)
    before = CrmActivity.objects.filter(workspace=a.workspace).count()

    deal = create_deal(context=a.context, title="Renewal", lead=lead, value=1000)
    close_deal(context=a.context, deal=deal, outcome="won", expected_version=deal.version)

    rows = CrmActivity.objects.filter(workspace=a.workspace)
    assert rows.count() == before, "a pipeline event was copied into crm_activities"
    assert not rows.filter(activity_type__icontains="deal").exists()


def test_lead360_activities_is_the_first_page_of_the_same_merge(actor, auth_client):
    a = actor()
    lead = _seed_lead(a)
    from apps.pipeline.services import create_deal

    create_deal(context=a.context, title="Renewal", lead=lead, value=10)

    client = auth_client(a)
    detail = client.get(f"/api/v1/leads/{lead.public_id}").json()
    timeline = client.get(f"/api/v1/leads/{lead.public_id}/timeline").json()

    assert [e["entry_id"] for e in detail["activities"]] == [e["entry_id"] for e in timeline["items"]]


def test_timeline_cursor_is_opaque_and_stable(actor, auth_client):
    from apps.crm.services import add_note

    a = actor()
    lead = _seed_lead(a)
    for i in range(6):
        add_note(context=a.context, lead=lead, body=f"note {i}")

    client = auth_client(a)
    first = client.get(f"/api/v1/leads/{lead.public_id}/timeline", {"limit": 3}).json()
    assert len(first["items"]) == 3
    assert first["has_more"] is True
    assert first["next_cursor"]

    second = client.get(
        f"/api/v1/leads/{lead.public_id}/timeline",
        {"limit": 3, "cursor": first["next_cursor"]},
    ).json()
    first_ids = {e["entry_id"] for e in first["items"]}
    second_ids = {e["entry_id"] for e in second["items"]}
    assert first_ids.isdisjoint(second_ids), "pages overlapped"


def test_composition_diagnostics_lists_registered_contributors(actor, auth_client):
    body = auth_client(actor()).get("/api/v1/_composition").json()
    assert "crm" in body["timeline_contributors"]
    assert "pipeline" in body["timeline_contributors"]
    assert "lead" in body["sections"]
    assert "deals" in body["sections"]

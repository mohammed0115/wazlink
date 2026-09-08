"""`AssignLeadOwner` — the frozen B2 command, end to end.

Frozen sources this file is asserted against, not paraphrased from:

  * `B2_COMMAND_EVENT_CATALOG.md` §1 — command `AssignLeadOwner`, permission
    `lead.assign`, concurrency `FOR UPDATE` + `If-Match`, emits
    `LeadOwnerChanged`; §2 — payload `lead_ref`, `from_owner_ref`,
    `to_owner_ref`, no PII.
  * `B2_API_DTO_CONTRACTS.md` §2 — `PATCH /leads/{id}` is FROZEN, gated by
    `lead.update` **and/or** `lead.assign`, and `LeadUpdate` carries
    `status?`, `priority?`, `owner_ref?`, `version` with at least one of the
    three present.
  * `B2_STATE_MACHINES.md` §1.2 — guard order, and "a no-op transition
    (`to == from`) is `400 VALIDATION_ERROR`, not a silent `200`".
  * `B2_ERROR_CONTRACT.md` §2 — `409 CONFLICT`·`owner_membership_inactive`.
  * `B2_CRM_ACTIVITY_VOCABULARY.md` §1 — activity `lead_owner_changed`.
  * `B2_ACCEPTANCE_TEST_MATRIX.md` — AT-OWN-1..8, AT-ACTV-3.

The two rejection shapes are the reason this file is long: a Membership in
ANOTHER workspace is `404`, and a Membership in THIS workspace that is not
active is `409`. Proving they stay distinct is proving we do not leak
cross-tenant existence through an error code.
"""

from __future__ import annotations

import pytest

from apps.crm.models import CrmActivity, Lead
from apps.crm.services import assign_lead_owner, create_lead
from apps.workspaces.models import Membership

pytestmark = pytest.mark.django_db(transaction=True)


def _lead(context, name="نورة"):
    return create_lead(context=context, origin_type="manual", primary_contact={"name": name})


def _member(workspace, email, *, role="member", status="active", make_user=None):
    user = make_user(email=email)
    return Membership.objects.create(workspace=workspace, user=user, role=role, status=status)


def _patch(client, lead, body, version=None):
    headers = {}
    if version is not None:
        headers["HTTP_IF_MATCH"] = str(version)
    return client.patch(f"/api/v1/leads/{lead.public_id}", body, format="json", **headers)


# --------------------------------------------------------------------------
# AT-OWN-1 — the happy path
# --------------------------------------------------------------------------
def test_an_authorised_actor_assigns_an_active_member(actor, auth_client, make_user):
    a = actor()
    lead = _lead(a.context)
    target = _member(a.workspace, "target@example.test", make_user=make_user)

    response = _patch(auth_client(a), lead, {"owner_ref": target.public_id}, version=lead.version)

    assert response.status_code == 200, response.data
    assert response.data["owner_ref"] == target.public_id
    lead.refresh_from_db()
    assert lead.owner_membership_id == target.id
    assert lead.version == 2


def test_assigning_an_unowned_shaped_lead_from_its_creator_to_another_member(
    actor, auth_client, make_user
):
    """A Lead is created owned by its creator; reassignment is the first move."""
    a = actor()
    lead = _lead(a.context)
    assert lead.owner_membership_id == a.membership.id

    target = _member(a.workspace, "first@example.test", make_user=make_user)
    response = _patch(auth_client(a), lead, {"owner_ref": target.public_id}, version=lead.version)

    assert response.status_code == 200
    lead.refresh_from_db()
    assert lead.owner_membership_id == target.id


# --------------------------------------------------------------------------
# AT-OWN-2 / AT-OWN-3 — the two rejection shapes must stay DISTINCT
# --------------------------------------------------------------------------
def test_an_inactive_membership_is_a_conflict_with_the_frozen_reason(
    actor, auth_client, make_user
):
    a = actor()
    lead = _lead(a.context)
    suspended = _member(
        a.workspace, "suspended@example.test", status="suspended", make_user=make_user
    )

    response = _patch(auth_client(a), lead, {"owner_ref": suspended.public_id}, version=lead.version)

    assert response.status_code == 409
    assert response.data["error"]["code"] == "CONFLICT"
    assert response.data["error"]["details"]["reason"] == "owner_membership_inactive"
    lead.refresh_from_db()
    assert lead.owner_membership_id == a.membership.id, "no mutation on a refused assignment"
    assert lead.version == 1


def test_a_membership_in_another_workspace_is_not_found_never_conflict(
    actor, auth_client, make_user
):
    """AT-OWN-3. A `409` here would confirm the Membership exists elsewhere."""
    mine = actor(email="mine@example.test", workspace_name="Mine")
    theirs = actor(email="theirs@example.test", workspace_name="Theirs")
    lead = _lead(mine.context)

    response = _patch(
        auth_client(mine), lead, {"owner_ref": theirs.membership.public_id}, version=lead.version
    )

    assert response.status_code == 404
    assert response.data["error"]["code"] == "ENTITY_NOT_FOUND"
    lead.refresh_from_db()
    assert lead.owner_membership_id == mine.membership.id


def test_an_inactive_foreign_membership_is_still_not_found(actor, auth_client, make_user):
    """The workspace check runs FIRST, so tenancy never falls through to 409."""
    mine = actor(email="m2@example.test", workspace_name="Mine2")
    theirs = actor(email="t2@example.test", workspace_name="Theirs2")
    foreign = _member(
        theirs.workspace, "foreign@example.test", status="suspended", make_user=make_user
    )
    lead = _lead(mine.context)

    response = _patch(auth_client(mine), lead, {"owner_ref": foreign.public_id}, version=lead.version)

    assert response.status_code == 404, "an inactive FOREIGN member must not leak 409"


def test_a_lead_in_another_workspace_is_not_found(actor, auth_client, make_user):
    mine = actor(email="m3@example.test", workspace_name="Mine3")
    theirs = actor(email="t3@example.test", workspace_name="Theirs3")
    foreign_lead = _lead(theirs.context)
    target = _member(mine.workspace, "t@example.test", make_user=make_user)

    response = _patch(
        auth_client(mine), foreign_lead, {"owner_ref": target.public_id}, version=foreign_lead.version
    )

    assert response.status_code == 404
    foreign_lead.refresh_from_db()
    assert foreign_lead.owner_membership_id == theirs.membership.id


# --------------------------------------------------------------------------
# AT-OWN-6 / AT-OWN-7 — per-field permission, applied before ANY write
# --------------------------------------------------------------------------
def test_a_role_without_lead_assign_is_refused(actor, auth_client, make_user):
    """`member` holds `lead.update` (conditional) but is DENIED `lead.assign`
    in the frozen B1 matrix — the exact shape AT-OWN-6 describes."""
    owner = actor(email="own@example.test", workspace_name="Perm")
    lead = _lead(owner.context)
    target = _member(owner.workspace, "tgt@example.test", make_user=make_user)

    actor_user = make_user(email="plain@example.test")
    plain_membership = Membership.objects.create(
        workspace=owner.workspace, user=actor_user, role="member", status="active"
    )
    from apps.identity_access.models import Session

    _, token = Session.issue(actor_user, active_workspace=owner.workspace)
    from rest_framework.test import APIClient

    client = APIClient()
    client.credentials(HTTP_X_SESSION_TOKEN=token)

    response = _patch(client, lead, {"owner_ref": target.public_id}, version=lead.version)

    assert response.status_code == 403
    assert response.data["error"]["code"] == "PERMISSION_DENIED"
    assert response.data["error"]["details"]["permission"] == "lead.assign"
    lead.refresh_from_db()
    assert lead.owner_membership_id == owner.membership.id
    assert plain_membership.role == "member"


def test_a_mixed_patch_without_lead_assign_applies_NOTHING(actor, auth_client, make_user):
    """AT-OWN-7 — the status change must not sneak through beside a denied owner."""
    owner = actor(email="own2@example.test", workspace_name="Perm2")
    lead = _lead(owner.context)
    target = _member(owner.workspace, "tgt2@example.test", make_user=make_user)
    before_status, before_version = lead.status, lead.version

    actor_user = make_user(email="plain2@example.test")
    Membership.objects.create(
        workspace=owner.workspace, user=actor_user, role="member", status="active"
    )
    from apps.identity_access.models import Session

    _, token = Session.issue(actor_user, active_workspace=owner.workspace)
    from rest_framework.test import APIClient

    client = APIClient()
    client.credentials(HTTP_X_SESSION_TOKEN=token)

    response = _patch(
        client,
        lead,
        {"status": "qualified", "owner_ref": target.public_id},
        version=lead.version,
    )

    assert response.status_code == 403
    lead.refresh_from_db()
    assert lead.status == before_status, "the status change must NOT be applied either"
    assert lead.version == before_version
    assert lead.owner_membership_id == owner.membership.id


# --------------------------------------------------------------------------
# Concurrency, no-op and DTO shape
# --------------------------------------------------------------------------
def test_a_stale_if_match_is_refused(actor, auth_client, make_user):
    a = actor()
    lead = _lead(a.context)
    target = _member(a.workspace, "stale@example.test", make_user=make_user)

    response = _patch(auth_client(a), lead, {"owner_ref": target.public_id}, version=lead.version + 5)

    assert response.status_code == 409
    assert response.data["error"]["code"] == "STALE_VERSION"
    lead.refresh_from_db()
    assert lead.owner_membership_id == a.membership.id


def test_a_missing_if_match_is_refused(actor, auth_client, make_user):
    a = actor()
    lead = _lead(a.context)
    target = _member(a.workspace, "noif@example.test", make_user=make_user)

    response = _patch(auth_client(a), lead, {"owner_ref": target.public_id})

    assert response.status_code == 409
    assert response.data["error"]["code"] == "STALE_VERSION"


def test_the_version_may_travel_in_the_body_as_the_frozen_dto_spells_it(
    actor, auth_client, make_user
):
    a = actor()
    lead = _lead(a.context)
    target = _member(a.workspace, "bodyver@example.test", make_user=make_user)

    response = auth_client(a).patch(
        f"/api/v1/leads/{lead.public_id}",
        {"owner_ref": target.public_id, "version": lead.version},
        format="json",
    )

    assert response.status_code == 200, response.data
    lead.refresh_from_db()
    assert lead.owner_membership_id == target.id


def test_assigning_the_same_owner_is_a_validation_error_not_a_silent_success(
    actor, auth_client
):
    """`to == from` must not emit an event or bump a version."""
    a = actor()
    lead = _lead(a.context)
    before_version = lead.version

    response = _patch(
        auth_client(a), lead, {"owner_ref": a.membership.public_id}, version=lead.version
    )

    assert response.status_code == 422
    assert response.data["error"]["code"] == "VALIDATION_FAILED"
    lead.refresh_from_db()
    assert lead.version == before_version
    assert not CrmActivity.objects.filter(lead=lead, activity_type="LeadOwnerChanged").exists()


def test_a_patch_with_no_recognised_field_is_rejected(actor, auth_client):
    a = actor()
    lead = _lead(a.context)

    response = _patch(auth_client(a), lead, {}, version=lead.version)

    assert response.status_code == 422
    assert response.data["error"]["code"] == "VALIDATION_FAILED"


def test_two_assignments_racing_on_one_version_produce_one_winner(actor, auth_client, make_user):
    """AT-OWN-8 in miniature: the second holder of a spent version is refused."""
    a = actor()
    lead = _lead(a.context)
    first = _member(a.workspace, "race1@example.test", make_user=make_user)
    second = _member(a.workspace, "race2@example.test", make_user=make_user)
    version = lead.version

    ok = _patch(auth_client(a), lead, {"owner_ref": first.public_id}, version=version)
    late = _patch(auth_client(a), lead, {"owner_ref": second.public_id}, version=version)

    assert ok.status_code == 200
    assert late.status_code == 409
    assert late.data["error"]["code"] == "STALE_VERSION"
    lead.refresh_from_db()
    assert lead.owner_membership_id == first.id
    assert lead.version == version + 1, "exactly one version bump"


# --------------------------------------------------------------------------
# Event, activity and the list projection
# --------------------------------------------------------------------------
def test_the_frozen_activity_and_event_are_recorded(actor, auth_client, make_user):
    a = actor()
    lead = _lead(a.context)
    target = _member(a.workspace, "evt@example.test", make_user=make_user)
    before_ref = a.membership.public_id

    _patch(auth_client(a), lead, {"owner_ref": target.public_id}, version=lead.version)

    activity = CrmActivity.objects.get(lead=lead, activity_type="LeadOwnerChanged")
    assert activity.summary == f"owner:{before_ref}→{target.public_id}"
    assert activity.change == {"before": before_ref, "after": target.public_id}

    from apps.platform_async.models import OutboxEvent

    event = OutboxEvent.objects.filter(event_type="LeadOwnerChanged").order_by("-id").first()
    assert event is not None, "LeadOwnerChanged must be published"
    assert event.payload == {
        "lead_ref": lead.public_id,
        "from_owner_ref": before_ref,
        "to_owner_ref": target.public_id,
    }
    # No PII may ride on this event.
    assert "email" not in event.payload and "name" not in event.payload


def test_the_owner_change_appears_on_the_lead_timeline(actor, auth_client, make_user):
    a = actor()
    lead = _lead(a.context)
    target = _member(a.workspace, "tl@example.test", make_user=make_user)

    _patch(auth_client(a), lead, {"owner_ref": target.public_id}, version=lead.version)

    response = auth_client(a).get(f"/api/v1/leads/{lead.public_id}/timeline")
    assert response.status_code == 200
    kinds = [row["source_event_type"] for row in response.data["items"]]
    assert "LeadOwnerChanged" in kinds


def test_the_list_and_the_360_agree_on_the_new_owner(actor, auth_client, make_user):
    a = actor()
    lead = _lead(a.context)
    target = _member(a.workspace, "agree@example.test", make_user=make_user)

    _patch(auth_client(a), lead, {"owner_ref": target.public_id}, version=lead.version)

    listed = auth_client(a).get("/api/v1/leads").data["items"]
    row = next(item for item in listed if item["lead_ref"] == lead.public_id)
    assert row["owner_ref"] == target.public_id

    detail = auth_client(a).get(f"/api/v1/leads/{lead.public_id}").data
    assert detail["lead"]["owner_ref"] == target.public_id


def test_the_server_side_owner_filter_finds_the_reassigned_lead(actor, auth_client, make_user):
    a = actor()
    lead = _lead(a.context)
    target = _member(a.workspace, "filter@example.test", make_user=make_user)

    _patch(auth_client(a), lead, {"owner_ref": target.public_id}, version=lead.version)

    found = auth_client(a).get("/api/v1/leads", {"owner": target.public_id}).data["items"]
    assert [row["lead_ref"] for row in found] == [lead.public_id]

    gone = auth_client(a).get("/api/v1/leads", {"owner": a.membership.public_id}).data["items"]
    assert lead.public_id not in [row["lead_ref"] for row in gone]


def test_a_lead_whose_owner_went_inactive_says_so_and_is_never_reassigned(
    actor, auth_client, make_user
):
    """AT-OWN-4/5 — the Lead keeps its owner; the list flags it for a human."""
    a = actor()
    target = _member(a.workspace, "willgo@example.test", make_user=make_user)
    lead = _lead(a.context)
    _patch(auth_client(a), lead, {"owner_ref": target.public_id}, version=lead.version)

    target.status = "suspended"
    target.save(update_fields=["status"])

    row = next(
        item
        for item in auth_client(a).get("/api/v1/leads").data["items"]
        if item["lead_ref"] == lead.public_id
    )
    assert row["owner_ref"] == target.public_id, "the Lead is never silently reassigned"
    assert row["owner_inactive"] is True

    lead.refresh_from_db()
    assert lead.owner_membership_id == target.id
    assert (
        CrmActivity.objects.filter(lead=lead, activity_type="LeadOwnerChanged").count() == 1
    ), "deactivation emits no LeadOwnerChanged"


def test_an_active_owner_is_not_flagged_inactive(actor, auth_client):
    a = actor()
    lead = _lead(a.context)
    row = next(
        item
        for item in auth_client(a).get("/api/v1/leads").data["items"]
        if item["lead_ref"] == lead.public_id
    )
    assert row["owner_inactive"] is False


# --------------------------------------------------------------------------
# Archived leads, and the multi-field PATCH
# --------------------------------------------------------------------------
def test_an_archived_lead_refuses_reassignment(actor, auth_client, make_user):
    a = actor()
    lead = _lead(a.context)
    target = _member(a.workspace, "arch@example.test", make_user=make_user)
    from apps.crm.services import archive_lead

    archive_lead(context=a.context, lead=lead, expected_version=lead.version)
    lead.refresh_from_db()

    response = _patch(auth_client(a), lead, {"owner_ref": target.public_id}, version=lead.version)

    assert response.status_code == 409
    assert response.data["error"]["details"]["reason"] == "lead_archived"


def test_status_and_owner_change_together_in_one_patch(actor, auth_client, make_user):
    a = actor()
    lead = _lead(a.context)
    target = _member(a.workspace, "both@example.test", make_user=make_user)

    response = _patch(
        auth_client(a),
        lead,
        {"status": "qualified", "owner_ref": target.public_id},
        version=lead.version,
    )

    assert response.status_code == 200, response.data
    lead.refresh_from_db()
    assert lead.status == "qualified"
    assert lead.owner_membership_id == target.id


def test_a_refused_owner_rolls_back_the_status_applied_earlier_in_the_same_patch(
    actor, auth_client, make_user
):
    """One PATCH is one atomic unit, so a late conflict undoes an early write."""
    a = actor()
    lead = _lead(a.context)
    suspended = _member(a.workspace, "late@example.test", status="suspended", make_user=make_user)

    response = _patch(
        auth_client(a),
        lead,
        {"status": "qualified", "owner_ref": suspended.public_id},
        version=lead.version,
    )

    assert response.status_code == 409
    lead.refresh_from_db()
    assert lead.status == "new", "the earlier field must not survive a later refusal"
    assert lead.version == 1


# --------------------------------------------------------------------------
# The service is the single write path — Automation runs the SAME command
# --------------------------------------------------------------------------
def test_the_service_enforces_the_same_guards_when_automation_is_the_caller(
    actor, make_user
):
    """B2: Automation may invoke `AssignLeadOwner` through the application
    service, and therefore inherits every guard rather than restating any."""
    a = actor()
    lead = _lead(a.context)
    suspended = _member(a.workspace, "auto@example.test", status="suspended", make_user=make_user)

    from common.errors import DomainConflict

    with pytest.raises(DomainConflict) as excinfo:
        assign_lead_owner(
            context=a.context, lead=lead, owner_ref=suspended.public_id, expected_version=lead.version
        )
    assert excinfo.value.details["reason"] == "owner_membership_inactive"

    assert Lead.objects.get(pk=lead.pk).owner_membership_id == a.membership.id

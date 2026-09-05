"""MAJOR-2 regression — ADR-010 under REAL database concurrency.

The frozen primitive is the pair `integer version + If-Match` AND
`SELECT ... FOR UPDATE` (B1_CONCURRENCY_IDEMPOTENCY §1, race R1). Comparing an
in-memory version proves only what the CLIENT read; it cannot see a writer that
committed in between.

These tests use `transaction=True`, so every write really commits and the
worker threads are genuinely concurrent on separate PostgreSQL connections.
Nothing here mocks the database or the lock: remove the row lock and these
tests fail.
"""

from __future__ import annotations

import threading
import uuid

import pytest
from django.db import connections
from django.utils import timezone

pytestmark = [pytest.mark.django_db(transaction=True), pytest.mark.security]

ROUNDS = 5  # repeat so a single lucky interleaving cannot pass


def _run_concurrently(callables):
    """Run callables on real threads, released together by a barrier."""
    barrier = threading.Barrier(len(callables))
    results: dict[int, object] = {}

    def worker(index, fn):
        barrier.wait()
        try:
            results[index] = fn()
        except Exception as exc:  # recorded, then asserted on by the test
            results[index] = exc
        finally:
            connections.close_all()

    threads = [threading.Thread(target=worker, args=(i, fn)) for i, fn in enumerate(callables)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)
    assert all(not t.is_alive() for t in threads), "a worker deadlocked"
    return [results[i] for i in range(len(callables))]


@pytest.fixture
def owner(db):
    """A committed owner actor. Built without the transactional fixtures so the
    worker threads can see it on their own connections."""
    from apps.accounts.models import User
    from apps.workspaces.models import Membership, Workspace
    from common.authz import AuthorizationContext
    from common.permissions_catalog import permissions_for_role

    user = User.objects.create_user(email="race@example.test", password="correct-horse-battery")
    user.email_verified_at = timezone.now()
    user.save(update_fields=["email_verified_at"])
    workspace = Workspace.objects.create(name="Race", slug=f"race-{uuid.uuid4().hex[:8]}")
    membership = Membership.objects.create(workspace=workspace, user=user, role="owner", status="active")

    class Actor:
        pass

    actor = Actor()
    actor.user, actor.workspace, actor.membership = user, workspace, membership
    actor.context = AuthorizationContext(
        user=user,
        session=None,
        workspace=workspace,
        membership=membership,
        role="owner",
        permissions=permissions_for_role("owner"),
    )
    return actor


def _classify(results):
    """Split outcomes into (successes, conflicts). Anything else is a failure."""
    from common.errors import DomainConflict, StaleVersion

    successes, conflicts = [], []
    for result in results:
        if isinstance(result, (StaleVersion, DomainConflict)):
            conflicts.append(result)
        elif isinstance(result, Exception):
            raise AssertionError(f"unexpected exception from a writer: {result!r}")
        else:
            successes.append(result)
    return successes, conflicts


# --------------------------------------------------------------------------
# §13 — Deal. The hard gate.
# --------------------------------------------------------------------------


def test_concurrent_deal_close_won_and_lost_cannot_both_win(owner):
    """Writer A closes Won and writer B closes Lost, both from version N.

    Exactly one succeeds; the other gets the frozen concurrency conflict; the
    version moves exactly once; and the outbox carries ONE terminal event —
    never both DealWon and DealLost.
    """
    from apps.crm.services import create_lead
    from apps.pipeline.models import Deal
    from apps.pipeline.services import close_deal, create_deal
    from apps.platform_async.models import OutboxEvent

    lead = create_lead(
        context=owner.context, origin_type="manual", primary_contact={"name": "Race Contact"}
    )

    for _round in range(ROUNDS):
        deal = create_deal(context=owner.context, title="Race", lead=lead, value=1000)
        version = deal.version

        def close(outcome, reason, *, pk=deal.pk, expected=version):
            def _do():
                fresh = Deal.objects.get(pk=pk)
                return close_deal(
                    context=owner.context,
                    deal=fresh,
                    outcome=outcome,
                    loss_reason=reason,
                    expected_version=expected,
                )

            return _do

        results = _run_concurrently([close("won", ""), close("lost", "race")])
        successes, conflicts = _classify(results)

        assert len(successes) == 1, f"round {_round}: {len(successes)} writers succeeded, expected 1"
        assert len(conflicts) == 1, f"round {_round}: expected exactly one conflict"

        final = Deal.objects.get(pk=deal.pk)
        assert final.version == version + 1, "version must increment exactly once"
        assert final.status == successes[0].status, "final state must match the winner"
        assert final.status in ("won", "lost")
        assert final.closed_at is not None

        terminal = list(
            OutboxEvent.objects.filter(
                aggregate_ref=deal.public_id, event_type__in=("DealWon", "DealLost")
            ).values_list("event_type", flat=True)
        )
        assert terminal == ["DealWon" if final.status == "won" else "DealLost"], (
            f"round {_round}: contradictory or duplicated terminal events {terminal}"
        )


def test_concurrent_deal_close_over_http_yields_one_200_and_one_409(owner):
    """§16 — the guarantee holds on the real HTTP path, not only in-process."""
    from rest_framework.test import APIClient

    from apps.crm.services import create_lead
    from apps.identity_access.models import Session
    from apps.pipeline.models import Deal
    from apps.pipeline.services import create_deal

    _session, raw = Session.issue(owner.user, active_workspace=owner.workspace)
    lead = create_lead(
        context=owner.context, origin_type="manual", primary_contact={"name": "Http Race"}
    )

    for _round in range(ROUNDS):
        deal = create_deal(context=owner.context, title="Http Race", lead=lead, value=10)
        version = deal.version

        def close(outcome, reason, *, ref=deal.public_id, expected=version):
            def _do():
                client = APIClient()
                client.credentials(HTTP_X_SESSION_TOKEN=raw)
                response = client.post(
                    f"/api/v1/deals/{ref}/close",
                    {"outcome": outcome, "loss_reason": reason},
                    format="json",
                    **{"HTTP_IF_MATCH": str(expected)},
                )
                return response.status_code, response.json()

            return _do

        results = _run_concurrently([close("won", ""), close("lost", "race")])
        codes = sorted(status for status, _ in results)

        assert codes == [200, 409], f"round {_round}: got {codes}"
        loser = next(body for status, body in results if status == 409)
        assert loser["error"]["code"] in ("STALE_VERSION", "CONFLICT")

        final = Deal.objects.get(pk=deal.pk)
        assert final.version == version + 1


# --------------------------------------------------------------------------
# §14 — Lead.
# --------------------------------------------------------------------------


def test_concurrent_lead_status_changes_serialize(owner):
    from apps.crm.models import Lead
    from apps.crm.services import create_lead, set_lead_status

    for _round in range(ROUNDS):
        lead = create_lead(
            context=owner.context, origin_type="manual", primary_contact={"name": "Lead Race"}
        )
        version = lead.version

        def to_status(status, *, pk=lead.pk, expected=version):
            def _do():
                fresh = Lead.objects.get(pk=pk)
                return set_lead_status(
                    context=owner.context, lead=fresh, status=status, expected_version=expected
                )

            return _do

        results = _run_concurrently([to_status("qualified"), to_status("unqualified")])
        successes, conflicts = _classify(results)

        assert len(successes) == 1 and len(conflicts) == 1
        final = Lead.objects.get(pk=lead.pk)
        assert final.version == version + 1
        assert final.status == successes[0].status
        assert final.status in ("qualified", "unqualified")


def test_concurrent_lead_archive_and_status_change_serialize(owner):
    """A conflicting pair of DIFFERENT transitions, not two of the same."""
    from apps.crm.models import Lead
    from apps.crm.services import archive_lead, create_lead, set_lead_status

    for _round in range(ROUNDS):
        lead = create_lead(
            context=owner.context, origin_type="manual", primary_contact={"name": "Mixed Race"}
        )
        version = lead.version

        def archive(*, pk=lead.pk, expected=version):
            fresh = Lead.objects.get(pk=pk)
            return archive_lead(context=owner.context, lead=fresh, expected_version=expected)

        def qualify(*, pk=lead.pk, expected=version):
            fresh = Lead.objects.get(pk=pk)
            return set_lead_status(
                context=owner.context, lead=fresh, status="qualified", expected_version=expected
            )

        results = _run_concurrently([archive, qualify])
        successes, conflicts = _classify(results)

        assert len(successes) == 1 and len(conflicts) == 1
        final = Lead.objects.get(pk=lead.pk)
        assert final.version == version + 1
        # An archived Lead must never also have taken the status transition.
        assert (final.archived_at is not None) ^ (final.status == "qualified")


# --------------------------------------------------------------------------
# §15 — Customer.
# --------------------------------------------------------------------------


def test_concurrent_customer_archive_serializes(owner):
    from apps.customers.models import Customer
    from apps.customers.services import archive_customer, create_customer

    for _round in range(ROUNDS):
        customer = create_customer(
            context=owner.context, party_kind="organization", name="Race Co"
        )
        version = customer.version

        def archive(*, pk=customer.pk, expected=version):
            fresh = Customer.objects.get(pk=pk)
            return archive_customer(context=owner.context, customer=fresh, expected_version=expected)

        results = _run_concurrently([archive, archive])
        successes, conflicts = _classify(results)

        assert len(successes) == 1, "an aggregate must not archive twice from one version"
        assert len(conflicts) == 1
        final = Customer.objects.get(pk=customer.pk)
        assert final.version == version + 1
        assert final.status == "archived"


def test_concurrent_customer_rename_serializes(owner):
    from apps.customers.models import Customer
    from apps.customers.services import create_customer, update_customer

    for _round in range(ROUNDS):
        customer = create_customer(context=owner.context, party_kind="organization", name="Before")
        version = customer.version

        def rename(name, *, pk=customer.pk, expected=version):
            def _do():
                fresh = Customer.objects.get(pk=pk)
                return update_customer(
                    context=owner.context, customer=fresh, expected_version=expected, name=name
                )

            return _do

        results = _run_concurrently([rename("Alpha Name"), rename("Beta Name")])
        successes, conflicts = _classify(results)

        assert len(successes) == 1 and len(conflicts) == 1
        final = Customer.objects.get(pk=customer.pk)
        assert final.version == version + 1
        # Exactly one of the two names, never a merge.
        assert final.name in ("Alpha Name", "Beta Name")
        assert final.name == successes[0].name


# --------------------------------------------------------------------------
# Negative control — the guarantee must come from the LOCK, not from luck.
# --------------------------------------------------------------------------


@pytest.mark.nc
def test_stale_in_memory_instance_cannot_bypass_the_version_check(owner):
    from apps.customers.services import create_customer
    from apps.pipeline.models import Deal
    from apps.pipeline.services import close_deal, create_deal
    from common.errors import StaleVersion

    customer = create_customer(context=owner.context, party_kind="organization", name="Snapshot Co")
    deal = create_deal(context=owner.context, title="Snapshot", customer=customer, value=1)

    # Two independent reads of the SAME version — exactly what two concurrent
    # requests hold.
    first = Deal.objects.get(pk=deal.pk)
    second = Deal.objects.get(pk=deal.pk)
    assert first.version == second.version

    close_deal(context=owner.context, deal=first, outcome="won", expected_version=first.version)

    with pytest.raises(StaleVersion):
        close_deal(
            context=owner.context,
            deal=second,
            outcome="lost",
            loss_reason="stale",
            expected_version=second.version,
        )

    final = Deal.objects.get(pk=deal.pk)
    assert final.status == "won"
    assert final.version == deal.version + 1


@pytest.mark.nc
def test_lock_aggregate_refuses_to_run_outside_a_transaction(owner):
    """A lock taken outside the command's transaction would protect nothing."""
    from apps.customers.services import create_customer
    from common.concurrency import lock_aggregate

    customer = create_customer(context=owner.context, party_kind="organization", name="No Txn")
    with pytest.raises(RuntimeError, match="transaction"):
        lock_aggregate(customer)

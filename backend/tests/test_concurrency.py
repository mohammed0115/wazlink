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
import time
import uuid

import pytest
from django.db import connections, transaction
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


def test_concurrent_import_commit_yields_one_winner_and_one_conflict(owner):
    """Two writers commit the same ImportBatch from the same version.

    The batch carries `version` (`B14_04` §M13) and its commit endpoint is
    frozen to accept `If-Match` (`B14_06` §Imports), so ADR-010 applies to the
    aggregate exactly as it does to a Deal. Exactly one writer may consume a
    given version; the other is refused. Per-row semantics are unaffected: the
    winner still commits each row in its own transaction.
    """
    from apps.customers.models import Customer
    from apps.imports.models import ImportBatch
    from apps.imports.services import commit_batch, create_import_batch, set_mapping

    for _round in range(ROUNDS):
        batch = create_import_batch(
            context=owner.context,
            target_kind="customer",
            raw_csv="name,phone\nRace One,+966500000021\nRace Two,+966500000022\n",
        )
        batch = set_mapping(
            context=owner.context, batch=batch, mapping={"name": "name", "phone": "phone"}
        )
        version = batch.version
        before = Customer.objects.filter(workspace=owner.workspace).count()

        def commit(*, pk=batch.pk, expected=version):
            def _do():
                fresh = ImportBatch.objects.get(pk=pk)
                return commit_batch(context=owner.context, batch=fresh, expected_version=expected)

            return _do

        results = _run_concurrently([commit(), commit()])
        successes, conflicts = _classify(results)

        assert len(successes) == 1, f"round {_round}: {len(successes)} writers committed, expected 1"
        assert len(conflicts) == 1, f"round {_round}: expected exactly one conflict"

        final = ImportBatch.objects.get(pk=batch.pk)
        assert final.version == version + 1, "version must increment exactly once"
        assert final.status == "completed"
        # The winner imported every row exactly once — the loser wrote nothing.
        assert Customer.objects.filter(workspace=owner.workspace).count() == before + 2
        assert sorted(final.rows.values_list("outcome", flat=True)) == ["created", "created"]


# --------------------------------------------------------------------------
# T-IMP-13..16 — the PER-ROW claim. `_begin_commit` serialises the aggregate,
# but it releases that lock before the row loop, so a second commit carrying
# the freshly bumped version is legitimately accepted while the first is still
# importing. Independent verification measured what that cost: 400 source rows
# produced 779 Customers, 379 of them duplicates, both requests `202`. The row
# claim is what makes `(batch_id, row_number)` (`B14_04` §M13) hold under that
# interleaving. These run on real PostgreSQL, on separate connections, with no
# surrounding transaction to serialise them.
# --------------------------------------------------------------------------

CUSTOMER_MAPPING = {"name": "name", "phone": "phone"}


def _import_batch(owner, raw_csv):
    from apps.imports.services import create_import_batch, set_mapping

    batch = create_import_batch(context=owner.context, target_kind="customer", raw_csv=raw_csv)
    return set_mapping(context=owner.context, batch=batch, mapping=CUSTOMER_MAPPING)


def _valid_csv(prefix, count):
    return "name,phone\n" + "".join(f"{prefix}{i},+9665{i:07d}\n" for i in range(count))


def _customer_census(owner):
    """(total, duplicated names) for this workspace — the business effect count."""
    from django.db.models import Count

    from apps.customers.models import Customer

    rows = Customer.objects.filter(workspace=owner.workspace)
    dupes = rows.values("name").annotate(n=Count("id")).filter(n__gt=1)
    return rows.count(), {d["name"]: d["n"] for d in dupes}


def _commit_mid_loop(owner, batch_pk, total_rows, *, timeout=25.0):
    """The discovered race, reproduced: commit again from INSIDE the first
    commit's row loop, using the version that commit just published.

    The second caller is legitimate — it holds the current version, so ADR-010
    admits it. Waiting for a partially-processed batch is what puts both loops
    over the same `pending` rows; missing that window would make the test
    vacuous, so it is an assertion rather than a silent return.
    """
    from apps.imports.models import ImportBatch
    from apps.imports.services import commit_batch

    deadline = time.time() + timeout
    while time.time() < deadline:
        current = ImportBatch.objects.get(pk=batch_pk)
        if current.status == "committing":
            done = current.rows.exclude(outcome="pending").count()
            if 0 < done < total_rows:
                return commit_batch(context=owner.context, batch=current, expected_version=current.version)
        time.sleep(0.001)
    raise AssertionError("never entered the mid-loop window — the race was not reproduced")


def _first_commit(owner, batch):
    from apps.imports.models import ImportBatch
    from apps.imports.services import commit_batch

    def _do():
        fresh = ImportBatch.objects.get(pk=batch.pk)
        return commit_batch(context=owner.context, batch=fresh, expected_version=batch.version)

    return _do


def _tolerate_conflicts(results):
    """Both callers are legitimate, so the frozen batch contract lets either
    succeed or be refused. Only a NON-conflict exception is a defect here —
    the at-most-once claim is asserted on the durable effects instead."""
    from common.errors import DomainConflict, StaleVersion

    for result in results:
        if isinstance(result, AssertionError):
            raise result
        if isinstance(result, Exception) and not isinstance(result, (StaleVersion, DomainConflict)):
            raise AssertionError(f"unexpected exception from a worker: {result!r}")


def test_imp_13_a_pending_row_admits_exactly_one_claimant(owner):
    """The claim is decided by PostgreSQL, not by an in-memory outcome check."""
    from apps.imports.models import ImportRow
    from apps.imports.services import _claim_row

    batch = _import_batch(owner, "name,phone\nClaim Me,+966500000031\n")
    row = batch.rows.get(row_number=1)
    claimed_by, holding = {}, threading.Event()

    def holder():
        try:
            with transaction.atomic():
                mine = _claim_row(row)
                claimed_by["holder"] = mine is not None
                holding.set()
                time.sleep(0.4)  # keep the claim open while the rival attempts it
                mine.outcome, mine.created_ref = "created", "CUS-CLAIMED"
                mine.save(update_fields=["outcome", "created_ref", "updated_at"])
        finally:
            connections.close_all()

    def rival():
        try:
            holding.wait(10)
            with transaction.atomic():
                # Blocks on the holder's lock, then re-reads the committed row.
                claimed_by["rival"] = _claim_row(row) is not None
        finally:
            connections.close_all()

    threads = [threading.Thread(target=holder), threading.Thread(target=rival)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=30)
    assert all(not t.is_alive() for t in threads), "a claimant deadlocked"

    assert claimed_by["holder"] is True, "the first worker must win the row"
    assert claimed_by["rival"] is False, "two workers claimed the same pending row"
    assert ImportRow.objects.get(pk=row.pk).outcome == "created"


def test_imp_14_a_concurrent_recommit_imports_every_row_exactly_once(owner):
    """The reported blocker, asserted on durable effects: N rows => N entities."""
    from apps.imports.models import ImportBatch

    rows = 120
    batch = _import_batch(owner, _valid_csv("Once", rows))
    before, _ = _customer_census(owner)

    _tolerate_conflicts(
        _run_concurrently([_first_commit(owner, batch), lambda: _commit_mid_loop(owner, batch.pk, rows)])
    )

    after, duplicated = _customer_census(owner)
    assert duplicated == {}, f"rows imported more than once: {duplicated}"
    assert after - before == rows, f"{after - before} customers for {rows} source rows"

    final = ImportBatch.objects.get(pk=batch.pk)
    assert set(final.rows.values_list("outcome", flat=True)) == {"created"}
    assert final.rows.count() == rows


def test_imp_15_a_concurrent_recommit_keeps_mixed_row_failure_semantics(owner):
    """Every third row is unnamed and must fail — once — while its siblings
    commit once and nothing is left claimed or pending (`T-IMP-2`)."""
    from apps.imports.models import ImportBatch

    rows = 120
    lines = [f"Mixed{i},+9667{i:07d}" if i % 3 else f",+9667{i:07d}" for i in range(rows)]
    expected_failures = sum(1 for i in range(rows) if i % 3 == 0)
    expected_created = rows - expected_failures

    batch = _import_batch(owner, "name,phone\n" + "\n".join(lines) + "\n")
    before, _ = _customer_census(owner)

    _tolerate_conflicts(
        _run_concurrently([_first_commit(owner, batch), lambda: _commit_mid_loop(owner, batch.pk, rows)])
    )

    after, duplicated = _customer_census(owner)
    assert duplicated == {}, f"rows imported more than once: {duplicated}"
    assert after - before == expected_created, "a failing row must not cost a sibling its import"

    final = ImportBatch.objects.get(pk=batch.pk)
    counts = {}
    for outcome in final.rows.values_list("outcome", flat=True):
        counts[outcome] = counts.get(outcome, 0) + 1
    assert counts == {"created": expected_created, "failed": expected_failures}, counts
    # No stuck claim: the claim is transactional, so nothing can be left mid-flight.
    assert not final.rows.filter(outcome="pending").exists()
    assert set(final.rows.filter(outcome="failed").values_list("error_message", flat=True)) == {
        "name is required"
    }


def test_imp_16_four_workers_contending_on_one_batch_import_each_row_once(owner):
    """Contention beyond a pair. The invariant may not depend on there being
    exactly two workers, nor on requests arriving one at a time."""
    from apps.imports.models import ImportBatch
    from apps.imports.services import commit_batch
    from common.errors import DomainConflict, StaleVersion

    rows = 90
    batch = _import_batch(owner, _valid_csv("Four", rows))
    before, _ = _customer_census(owner)

    def worker():
        # A real client refreshing its version and retrying, which is exactly
        # how the second caller in the reported race obtained a valid version.
        for _ in range(200):
            current = ImportBatch.objects.get(pk=batch.pk)
            if not current.rows.filter(outcome="pending").exists():
                return "drained"
            try:
                commit_batch(context=owner.context, batch=current, expected_version=current.version)
                return "committed"
            except (StaleVersion, DomainConflict):
                time.sleep(0.005)
        return "exhausted"

    _tolerate_conflicts(_run_concurrently([worker] * 4))

    after, duplicated = _customer_census(owner)
    assert duplicated == {}, f"rows imported more than once: {duplicated}"
    assert after - before == rows, f"{after - before} customers for {rows} source rows"
    assert set(ImportBatch.objects.get(pk=batch.pk).rows.values_list("outcome", flat=True)) == {"created"}


# --------------------------------------------------------------------------
# I3 — Discovery. The execution claim and the Business identity, under real
# concurrency on separate connections. Two workers receiving the same job (a
# redelivery, a duplicated Celery message, or a retry racing a late worker) must
# not double-spend the provider or double-count results.
# --------------------------------------------------------------------------


def _discovery_job(owner, terms, locations=("Riyadh",)):
    from apps.discovery.services import create_discovery_job

    return create_discovery_job(
        context=owner.context, terms=list(terms), locations=list(locations)
    )


def test_imp_disc_1_two_workers_on_one_job_execute_each_query_exactly_once(owner):
    """The execution claim decided in PostgreSQL, not in Python.

    Both workers see every execution as `pending` when they start. Only one may
    own each: the claim BLOCKS the competitor, and under READ COMMITTED the
    competitor then re-reads the committed row, finds it terminal and skips.
    """
    from apps.discovery.models import Business, DiscoveryQueryExecution, DiscoveryResult
    from apps.discovery.services import run_discovery_job
    from common.provider_ports import providers

    terms = [f"term{i}" for i in range(12)]
    job = _discovery_job(owner, terms)
    stub = providers.require("place_search")
    before = Business.objects.filter(workspace=owner.workspace).count()

    def worker():
        try:
            return run_discovery_job(job_id=job.id)
        finally:
            connections.close_all()

    for result in _run_concurrently([worker, worker]):
        assert not isinstance(result, Exception), f"a worker raised: {result!r}"

    executions = DiscoveryQueryExecution.objects.filter(job=job, attempt_no=1)
    # ONE execution per planned query — never two, on any interleaving.
    assert executions.count() == len(terms)
    assert not executions.filter(outcome="pending").exists(), "an execution was left claimed"

    # 12 terms x 3 stub results, each a distinct external identity.
    after = Business.objects.filter(workspace=owner.workspace).count()
    assert after - before == len(terms) * 3
    assert DiscoveryResult.objects.filter(job=job, execution__attempt_no=1).count() == len(terms) * 3
    # The provider was called once per query, not twice.
    assert len(stub.calls) == len(terms)

    final = job.__class__.objects.get(pk=job.pk)
    assert final.status == "completed"
    assert final.found_count - final.duplicate_count == final.deduplicated_count


def test_imp_disc_2_concurrent_upserts_of_one_external_record_yield_one_business(owner):
    """B3-INV-4 under contention: the UNIQUE CONSTRAINT is the arbiter.

    Six workers upsert the same `(workspace, provider_external_id)` at once. An
    `if exists()` guard would let several through; the constraint cannot.
    """
    from datetime import UTC, datetime

    from apps.discovery.models import Business
    from apps.discovery.services import upsert_business
    from common.provider_ports import NormalizedBusinessResult

    record = NormalizedBusinessResult(
        provider_external_id="shared-external-id",
        name="Contended Cafe",
        source_provider="place_search",
        observed_at=datetime.now(UTC),
    )

    def worker():
        try:
            business, created = upsert_business(workspace=owner.workspace, result=record)
            return (business.pk, created)
        finally:
            connections.close_all()

    results = _run_concurrently([worker] * 6)
    for result in results:
        assert not isinstance(result, Exception), f"an upsert raised: {result!r}"

    rows = Business.objects.filter(
        workspace=owner.workspace, provider_external_id="shared-external-id"
    )
    assert rows.count() == 1, "the same external record became two Businesses"
    # Every worker converged on the SAME row, and exactly one created it.
    assert len({pk for pk, _ in results}) == 1
    assert sum(1 for _, created in results if created) == 1

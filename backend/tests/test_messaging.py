"""I6 — Messaging / WhatsApp, team inbox and assignment. Frozen B5 + `B14_15`.

Every test runs against the deterministic stub bound behind
`WhatsAppProviderPort`. The stub signs with its own secret, so the whole inbound
pipeline — signature, receipt dedup, routing, identity resolution, status
monotonicity — is exercised for real rather than mocked away.
"""

from __future__ import annotations

import ast
import json
import pathlib

import pytest
from django.utils import timezone

pytestmark = pytest.mark.django_db

WEBHOOK_URL = "/webhooks/whatsapp"


@pytest.fixture
def owner(actor):
    return actor(email="msg-owner@example.test", role="owner", workspace_name="MsgOwner")


@pytest.fixture
def wa(owner):
    """The bound adapter, with this workspace routed to a provider account."""
    from apps.platform_async.models import IntegrationConnection
    from common.provider_ports import providers

    IntegrationConnection.objects.create(
        workspace=owner.workspace,
        provider="whatsapp",
        status="enabled",
        provider_account_id="PN-OWNER",
        configuration_valid=True,
    )
    return providers.require("whatsapp")


def inbound_body(*, from_phone="+966500111222", text="Hello", message_id="wamid.in.1",
                 account="PN-OWNER", name="Sara", ts=None):
    return json.dumps(
        {
            "object": "whatsapp_business_account",
            "entry": [
                {
                    "changes": [
                        {
                            "value": {
                                "messaging_product": "whatsapp",
                                "metadata": {"phone_number_id": account},
                                "contacts": [{"wa_id": from_phone, "profile": {"name": name}}],
                                "messages": [
                                    {
                                        "id": message_id,
                                        "from": from_phone,
                                        "timestamp": str(ts or int(timezone.now().timestamp())),
                                        "type": "text",
                                        "text": {"body": text},
                                    }
                                ],
                            }
                        }
                    ]
                }
            ],
        }
    ).encode()


def status_body(*, message_id, status, account="PN-OWNER", ts=None, recipient="+966500111222"):
    return json.dumps(
        {
            "object": "whatsapp_business_account",
            "entry": [
                {
                    "changes": [
                        {
                            "value": {
                                "metadata": {"phone_number_id": account},
                                "statuses": [
                                    {
                                        "id": message_id,
                                        "status": status,
                                        "recipient_id": recipient,
                                        "timestamp": str(ts or int(timezone.now().timestamp())),
                                    }
                                ],
                            }
                        }
                    ]
                }
            ],
        }
    ).encode()


def imported_modules(root: pathlib.Path) -> set[str]:
    """Every module actually IMPORTED under `root`, by AST.

    Deliberately not a grep: a docstring that says "crm imports neither
    apps.messaging nor apps.pipeline" is documentation OF the rule, and a
    control that fails on it is measuring prose rather than structure. This is
    the same discipline the frozen walker rules require (`W-3`, `W-4`).
    """
    found: set[str] = set()
    for path in root.rglob("*.py"):
        if "migrations" in path.parts:
            continue
        for node in ast.walk(ast.parse(path.read_text())):
            if isinstance(node, ast.Import):
                found.update(alias.name for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                found.add(node.module)
    return found


def post_webhook(client, body: bytes, *, signature=None):
    from adapters.whatsapp import StubWhatsAppAdapter

    return client.post(
        WEBHOOK_URL,
        data=body,
        content_type="application/json",
        HTTP_X_HUB_SIGNATURE_256=(
            StubWhatsAppAdapter.sign(body) if signature is None else signature
        ),
    )


def drain(client, body, *, signature=None):
    """Deliver a callback and run the worker it enqueues — as production does."""
    from apps.messaging.tasks import apply_provider_status_task, process_webhook_receipt_task
    from common.dispatch import task_registry

    task_registry.enqueued.clear()
    response = post_webhook(client, body, signature=signature)
    for name, payload in list(task_registry.enqueued):
        if name == "messaging.process_webhook_receipt":
            process_webhook_receipt_task(payload["receipt_id"])
        elif name == "messaging.apply_provider_status":
            apply_provider_status_task(payload["receipt_id"])
    return response


# --------------------------------------------------------------------------
# T-WA-1/2/9 — webhook security. The status contract is narrow on purpose.
# --------------------------------------------------------------------------


def test_wa_2_subscription_verification_echoes_only_on_the_right_token(client, wa):
    from adapters.whatsapp import StubWhatsAppAdapter

    ok = client.get(
        WEBHOOK_URL,
        {"hub.mode": "subscribe", "hub.verify_token": StubWhatsAppAdapter.VERIFY_TOKEN,
         "hub.challenge": "1158201444"},
    )
    assert ok.status_code == 200 and ok.content.decode() == "1158201444"

    wrong = client.get(
        WEBHOOK_URL,
        {"hub.mode": "subscribe", "hub.verify_token": "wrong", "hub.challenge": "1158201444"},
    )
    assert wrong.status_code == 403


def test_wa_1_an_invalid_signature_is_the_only_401(client, wa):
    """Frozen B12: 401 ONLY on a bad signature; everything else answers 200."""
    body = inbound_body()

    assert post_webhook(client, body).status_code == 200
    assert post_webhook(client, body, signature="sha256=deadbeef").status_code == 401
    assert post_webhook(client, body, signature="").status_code == 401
    assert post_webhook(client, body, signature="md5=whatever").status_code == 401

    # Malformed and unsupported both answer 200: redelivery would never succeed.
    assert post_webhook(client, b"{not json").status_code == 200
    assert post_webhook(client, b'{"entry": []}').status_code == 200


def test_wa_9_a_missing_app_secret_fails_closed(client, wa, monkeypatch):
    """With no secret a signature CANNOT be verified — so it is refused."""
    from adapters.whatsapp import MetaWhatsAppAdapter
    from common.provider_ports import providers

    monkeypatch.delenv("WHATSAPP_APP_SECRET", raising=False)
    monkeypatch.setattr(providers, "whatsapp", MetaWhatsAppAdapter())
    assert post_webhook(client, inbound_body(), signature="sha256=anything").status_code == 401


def test_an_oversized_body_is_refused_before_any_parse(client, wa):
    from apps.messaging.services import WEBHOOK_MAX_BODY_BYTES

    oversized = b'{"padding":"' + b"x" * (WEBHOOK_MAX_BODY_BYTES + 100) + b'"}'
    assert post_webhook(client, oversized).status_code == 413


def test_a_signature_is_verified_before_the_body_is_parsed(client, wa):
    """An unauthenticated caller must not reach the JSON decoder at all."""
    assert post_webhook(client, b"{not json at all", signature="sha256=bad").status_code == 401


def test_wa_8_nc_no_secret_or_signature_appears_in_any_log_record(client, wa, caplog):
    import logging

    from adapters.whatsapp import StubWhatsAppAdapter

    with caplog.at_level(logging.DEBUG):
        drain(client, inbound_body(text="sensitive customer text"))
    rendered = " ".join(record.getMessage() for record in caplog.records)
    for secret in (StubWhatsAppAdapter.APP_SECRET, StubWhatsAppAdapter.VERIFY_TOKEN, "sha256="):
        assert secret not in rendered


# --------------------------------------------------------------------------
# T-WA-3 — duplicate callbacks. TWO independent defences.
# --------------------------------------------------------------------------


def test_wa_3_nc_a_redelivered_callback_creates_no_second_message(client, owner, wa):
    from apps.messaging.models import Conversation, Message

    body = inbound_body(message_id="wamid.dup.1")
    first = drain(client, body)
    second = drain(client, body)

    assert first.json()["status"] == "accepted"
    # Absorbed at the RECEIPT layer — the domain never even ran.
    assert second.json()["status"] == "duplicate"
    assert Message.objects.filter(workspace=owner.workspace).count() == 1
    assert Conversation.objects.filter(workspace=owner.workspace).count() == 1


def test_the_second_defence_holds_even_when_the_receipt_layer_is_bypassed(owner, wa):
    """Frozen B5 requires TWO defences; neither substitutes for the other.

    A provider that re-sends the same message under a NEW event id defeats the
    receipt layer. The message identity constraint still holds.
    """
    from apps.messaging.models import Message
    from apps.messaging.services import ingest_inbound
    from common.provider_ports import InboundMessage

    inbound = InboundMessage(
        provider_message_id="wamid.bypass.1",
        from_phone="+966500111222",
        body="Hello",
        occurred_at=timezone.now(),
    )
    first = ingest_inbound(workspace=owner.workspace, inbound=inbound)
    second = ingest_inbound(workspace=owner.workspace, inbound=inbound)

    assert first.pk == second.pk
    assert Message.objects.filter(workspace=owner.workspace).count() == 1


def test_wa_4_delivery_status_is_monotonic_and_infers_what_it_skipped(client, owner, wa):
    """`AT-STATE-6`. A `read` that overtook `delivered` records both."""
    from apps.messaging.models import Message, MessageDelivery

    drain(client, inbound_body(message_id="wamid.status.seed"))
    message = Message.objects.get(workspace=owner.workspace)
    Message.objects.filter(pk=message.pk).update(
        direction="outbound", status="sent", provider_message_id="wamid.out.1"
    )

    drain(client, status_body(message_id="wamid.out.1", status="read"))
    message.refresh_from_db()
    assert message.status == "read"
    recorded = set(MessageDelivery.objects.filter(message=message).values_list("status", flat=True))
    # `delivered` is INFERRED — the delivery happened, so it is not lost, even
    # though no `delivered` callback ever arrived. (`sent` has no row: it was
    # reached by the send path, not by an applied provider callback, and this
    # table records applied transitions.)
    assert {"delivered", "read"} <= recorded

    # A late, lower status does NOT regress the message.
    drain(client, status_body(message_id="wamid.out.1", status="delivered"))
    message.refresh_from_db()
    assert message.status == "read"


def test_a_duplicate_status_callback_is_absorbed_at_the_status_layer(owner, wa):
    from apps.messaging.models import Conversation, Message, MessageDelivery
    from apps.messaging.services import apply_provider_status
    from common.provider_ports import InboundStatus

    conversation = Conversation.objects.create(
        workspace=owner.workspace, peer_address="+966500111222"
    )
    message = Message.objects.create(
        workspace=owner.workspace, conversation=conversation, direction="outbound",
        status="sent", provider_message_id="wamid.dupstatus",
    )
    update = InboundStatus(provider_message_id="wamid.dupstatus", status="delivered",
                           occurred_at=timezone.now())
    apply_provider_status(workspace=owner.workspace, status_update=update)
    apply_provider_status(workspace=owner.workspace, status_update=update)

    assert MessageDelivery.objects.filter(message=message, status="delivered").count() == 1


# --------------------------------------------------------------------------
# Identity resolution — B14_15 §3.
# --------------------------------------------------------------------------


def test_an_existing_crm_contact_is_resolved_without_any_discovery_provenance(client, owner, wa):
    """The Wave 2 product invariant: CRM is independent of Discovery."""
    from apps.crm.services import create_lead
    from apps.discovery.models import Business
    from apps.messaging.models import Conversation

    lead = create_lead(
        context=owner.context,
        origin_type="manual",
        primary_contact={"name": "Known Customer", "phone": "+966500111222"},
    )
    assert lead.business_id is None
    assert not Business.objects.filter(workspace=owner.workspace).exists()

    drain(client, inbound_body(from_phone="+966500111222"))
    conversation = Conversation.objects.get(workspace=owner.workspace)

    assert conversation.identity_state == "resolved"
    assert conversation.contact is not None
    assert conversation.contact.full_name == "Known Customer"
    # And still no Discovery artifact anywhere.
    assert not Business.objects.filter(workspace=owner.workspace).exists()


def test_an_unknown_number_opens_an_unlinked_conversation_and_creates_nothing(client, owner, wa):
    """No inbound message ever creates a Lead or a Customer."""
    from apps.crm.models import Contact, Lead
    from apps.customers.models import Customer
    from apps.messaging.models import Conversation

    drain(client, inbound_body(from_phone="+966599999999"))
    conversation = Conversation.objects.get(workspace=owner.workspace)

    assert conversation.identity_state == "unresolved"
    assert conversation.contact_id is None and conversation.customer_id is None
    assert not Lead.objects.filter(workspace=owner.workspace).exists()
    assert not Customer.objects.filter(workspace=owner.workspace).exists()
    assert not Contact.objects.filter(workspace=owner.workspace).exists()


def test_an_ambiguous_number_is_reported_never_merged(owner, wa):
    from apps.crm.models import Contact
    from apps.messaging.services import resolve_party

    for name in ("First Match", "Second Match"):
        Contact.objects.create(workspace=owner.workspace, full_name=name, phone="+966577777777")

    state, contact, customer = resolve_party(workspace=owner.workspace, address="+966577777777")
    assert state == "ambiguous"
    assert contact is None and customer is None


def test_an_unroutable_callback_is_quarantined_and_opens_a_case(client, owner, wa):
    """P-7. A workspace binding is never guessed."""
    from apps.messaging.models import Message
    from apps.platform_async.models import PlatformReconciliationCase

    response = drain(client, inbound_body(account="PN-UNKNOWN", message_id="wamid.unrouted"))

    assert response.status_code == 200
    assert response.json()["status"] == "unrouted"
    assert not Message.objects.filter(workspace=owner.workspace).exists()
    assert PlatformReconciliationCase.objects.filter(case_class="P-7", status="open").count() == 1


# --------------------------------------------------------------------------
# THE SEND FIREWALL — the hard Wave 2 gate.
# --------------------------------------------------------------------------


def human_send(auth_client, owner, conversation, capture, **payload):
    """Send as a human and run the worker the commit schedules.

    `send_message` enqueues through `transaction.on_commit`, so a rolled-back
    send cannot have already left the building. Capturing the callback is how a
    test exercises that real ordering instead of bypassing it.
    """
    from apps.messaging.tasks import send_outbound_message_task
    from common.dispatch import task_registry

    task_registry.enqueued.clear()
    with capture(execute=True):
        response = auth_client(owner).post(
            "/api/v1/messages",
            {"conversation_ref": conversation.public_id, **payload},
            format="json",
        )
    sent = [p["message_id"] for n, p in task_registry.enqueued if n == "messaging.send_outbound_message"]
    for message_id in sent:
        send_outbound_message_task(message_id)
    return response, (sent[0] if sent else None)


def test_only_a_human_can_send_and_the_provider_sees_exactly_one_call(
    client, owner, wa, auth_client, django_capture_on_commit_callbacks
):
    from apps.messaging.models import Conversation, Message

    drain(client, inbound_body())
    conversation = Conversation.objects.get(workspace=owner.workspace)
    before = len(wa.sent)

    response, _ = human_send(
        auth_client, owner, conversation, django_capture_on_commit_callbacks,
        body="A human wrote this.",
    )
    assert response.status_code == 202
    assert len(wa.sent) == before + 1

    message = Message.objects.get(workspace=owner.workspace, direction="outbound")
    assert message.status == "sent"
    assert message.sent_by_id == owner.membership.id  # a HUMAN, always


def test_the_provider_is_not_called_until_the_send_transaction_commits(
    client, owner, wa, auth_client, django_capture_on_commit_callbacks
):
    """A rolled-back send must not already have reached the customer."""
    from apps.messaging.models import Conversation
    from common.dispatch import task_registry

    drain(client, inbound_body())
    conversation = Conversation.objects.get(workspace=owner.workspace)
    before = len(wa.sent)

    task_registry.enqueued.clear()
    with django_capture_on_commit_callbacks(execute=False):
        auth_client(owner).post(
            "/api/v1/messages",
            {"conversation_ref": conversation.public_id, "body": "Not yet"},
            format="json",
        )
        # Inside the transaction: nothing enqueued, nothing sent.
        assert task_registry.enqueued == []
    assert len(wa.sent) == before


def test_a_redelivered_send_task_never_sends_twice(
    client, owner, wa, auth_client, django_capture_on_commit_callbacks
):
    from apps.messaging.models import Conversation, Message
    from apps.messaging.tasks import send_outbound_message_task

    drain(client, inbound_body())
    conversation = Conversation.objects.get(workspace=owner.workspace)
    before = len(wa.sent)
    _, message_id = human_send(
        auth_client, owner, conversation, django_capture_on_commit_callbacks, body="Once"
    )
    assert len(wa.sent) == before + 1

    send_outbound_message_task(message_id)  # redelivery
    send_outbound_message_task(message_id)

    assert len(wa.sent) == before + 1, "a redelivered task sent the message again"
    assert Message.objects.get(pk=message_id).status == "sent"


def test_wa_6_nc_an_unknown_send_outcome_is_never_resent(
    client, owner, wa, auth_client, django_capture_on_commit_callbacks
):
    """`B12-D-A020`. A recipient cannot un-receive a duplicate."""
    from apps.messaging.models import Conversation, Message
    from apps.messaging.tasks import send_outbound_message_task
    from apps.platform_async.models import PlatformReconciliationCase
    from common.provider_ports import ProviderUnknownOutcome

    drain(client, inbound_body())
    conversation = Conversation.objects.get(workspace=owner.workspace)
    wa.next_error = ProviderUnknownOutcome("indeterminate", provider="whatsapp")
    before = len(wa.sent)
    _, message_id = human_send(
        auth_client, owner, conversation, django_capture_on_commit_callbacks, body="Uncertain"
    )

    message = Message.objects.get(pk=message_id)
    assert message.status == "unknown"
    assert PlatformReconciliationCase.objects.filter(case_class="P-1", status="open").exists()

    # Every retry path: still never resent.
    for _ in range(3):
        send_outbound_message_task(message_id)
    assert len(wa.sent) == before
    assert Message.objects.get(pk=message_id).status == "unknown"


def test_wa_5_nc_outside_the_service_window_the_send_is_refused_before_any_provider_call(
    owner, wa, auth_client, client
):
    """Frozen B5: refused BEFORE the call, so it costs nothing."""
    from datetime import timedelta

    from apps.messaging.models import Conversation
    from apps.platform_async.models import ProviderRequestAttempt

    drain(client, inbound_body())
    conversation = Conversation.objects.get(workspace=owner.workspace)
    Conversation.objects.filter(pk=conversation.pk).update(
        last_inbound_at=timezone.now() - timedelta(hours=48)
    )
    before_attempts = ProviderRequestAttempt.objects.count()
    before_sent = len(wa.sent)

    response = auth_client(owner).post(
        "/api/v1/messages", {"conversation_ref": conversation.public_id, "body": "Too late"},
        format="json",
    )  # noqa: E501
    assert response.status_code == 409
    assert response.json()["error"]["details"]["reason"] == "outside_service_window"
    # No message, no attempt row, no provider call.
    assert ProviderRequestAttempt.objects.count() == before_attempts
    assert len(wa.sent) == before_sent


def test_an_unapproved_template_cannot_be_sent(owner, wa, auth_client, client):
    from apps.messaging.models import Conversation, Template

    drain(client, inbound_body())
    conversation = Conversation.objects.get(workspace=owner.workspace)
    template = Template.objects.create(
        workspace=owner.workspace, name="promo", language="en", body="Hi", status="draft"
    )
    response = auth_client(owner).post(
        "/api/v1/messages/template",
        {"conversation_ref": conversation.public_id, "template_ref": template.public_id},
        format="json",
    )
    assert response.status_code == 409
    assert response.json()["error"]["details"]["reason"] == "template_not_approved"


def test_wa_7_precursor_nc_exactly_one_send_command_exists_in_the_codebase():
    """The structural half of the firewall, assertable before `aiagent` exists.

    Frozen `T-WA-7` belongs to I13, where it is non-vacuous. What IS assertable
    now is that the codebase contains exactly one function able to reach the
    provider's `send`, so there is no second path for I13's agent to find.
    """
    root = pathlib.Path(__file__).resolve().parent.parent / "apps"
    senders = []
    for path in root.rglob("*.py"):
        if "migrations" in path.parts:
            continue
        source = path.read_text()
        if ".send(" not in source:
            continue
        for node in ast.walk(ast.parse(source)):
            if (
                isinstance(node, ast.Call)
                and isinstance(node.func, ast.Attribute)
                and node.func.attr == "send"
            ):
                senders.append(f"{path.relative_to(root)}")

    assert senders == ["messaging/services/__init__.py"], (
        f"more than one module can reach the provider send path: {senders}"
    )


# --------------------------------------------------------------------------
# T-CA02-1..4 — handling mode and the takeover CAS.
# --------------------------------------------------------------------------


def test_ca02_1_handling_mode_defaults_to_human_reproducing_prior_behaviour(client, owner, wa):
    from apps.messaging.models import Conversation

    drain(client, inbound_body())
    assert Conversation.objects.get(workspace=owner.workspace).handling_mode == "human"


def test_ca02_2_mode_changes_are_guarded_audited_and_evented(owner, auth_client, client, wa):
    from apps.messaging.models import Conversation
    from apps.platform_async.models import OutboxEvent

    drain(client, inbound_body())
    conversation = Conversation.objects.get(workspace=owner.workspace)
    response = auth_client(owner).post(
        f"/api/v1/conversations/{conversation.public_id}/handling-mode",
        {"handling_mode": "ai_assisted"},
        format="json",
    )
    assert response.status_code == 200
    assert response.json()["handling_mode"] == "ai_assisted"
    assert OutboxEvent.objects.filter(event_type="ConversationHandlingModeChanged").exists()

    invalid = auth_client(owner).post(
        f"/api/v1/conversations/{conversation.public_id}/handling-mode",
        {"handling_mode": "autonomous"},
        format="json",
    )
    assert invalid.status_code == 422


def test_ca02_3_a_takeover_pauses_the_ai_and_only_one_member_can_hold_it(owner, actor, client, wa,
                                                                        auth_client, make_workspace):
    from apps.messaging.models import Conversation
    from apps.workspaces.models import Membership

    drain(client, inbound_body())
    conversation = Conversation.objects.get(workspace=owner.workspace)

    rival_user = actor(email="rival@example.test", workspace_name="RivalWs").user
    rival = Membership.objects.create(
        workspace=owner.workspace, user=rival_user, role="sales", status="active"
    )
    from apps.identity_access.models import Session

    _, rival_token = Session.issue(rival_user, active_workspace=owner.workspace)

    first = auth_client(owner).post(f"/api/v1/conversations/{conversation.public_id}/takeover",
                                    {}, format="json")
    assert first.status_code == 200
    assert first.json()["handling_mode"] == "ai_paused"
    assert first.json()["takeover_by_ref"] == owner.membership.public_id

    from rest_framework.test import APIClient

    rival_client = APIClient()
    rival_client.credentials(HTTP_X_SESSION_TOKEN=rival_token)
    second = rival_client.post(f"/api/v1/conversations/{conversation.public_id}/takeover",
                               {}, format="json")
    assert second.status_code == 409
    assert second.json()["error"]["details"]["reason"] == "takeover_already_held"
    assert rival.pk is not None


def test_ca02_4_only_the_holder_may_end_a_takeover(owner, client, wa, auth_client):
    from apps.messaging.models import Conversation

    drain(client, inbound_body())
    conversation = Conversation.objects.get(workspace=owner.workspace)
    client_ = auth_client(owner)
    client_.post(f"/api/v1/conversations/{conversation.public_id}/takeover", {}, format="json")
    ended = client_.delete(f"/api/v1/conversations/{conversation.public_id}/takeover")

    assert ended.status_code == 200
    assert ended.json()["handling_mode"] == "human"
    assert ended.json()["takeover_by_ref"] is None


# --------------------------------------------------------------------------
# T-ASG-1..4 — assignment.
# --------------------------------------------------------------------------


def _members(owner, count=3):
    from apps.accounts.models import User
    from apps.identity_access.models import Session  # noqa: F401
    from apps.workspaces.models import Membership

    refs = [owner.membership.public_id]
    for index in range(count - 1):
        user = User.objects.create_user(email=f"agent{index}@example.test", password="correct-horse-x")
        membership = Membership.objects.create(
            workspace=owner.workspace, user=user, role="sales", status="active"
        )
        refs.append(membership.public_id)
    return refs


def test_asg_1_round_robin_distributes_fairly_across_members(owner, wa, client):
    from apps.assignment.services import upsert_assignment_rule
    from apps.messaging.models import Conversation

    refs = _members(owner, 3)
    upsert_assignment_rule(context=owner.context, name="inbox", member_refs=refs)

    for index in range(6):
        drain(client, inbound_body(from_phone=f"+96650000{index:04d}", message_id=f"wamid.rr.{index}"))

    assigned = [
        c.assigned_to.public_id
        for c in Conversation.objects.filter(workspace=owner.workspace).order_by("created_at")
    ]
    assert len(assigned) == 6
    # Two full cycles: every member got exactly two.
    assert sorted(assigned) == sorted(refs * 2)


def test_asg_2_the_counter_is_a_postgresql_row_never_redis():
    """CRM-INV-11, asserted structurally.

    A Redis counter can silently reset on eviction, handing every conversation
    to the same agent. The counter is a table row taken under FOR UPDATE.
    """
    from apps.assignment.models import AssignmentCounter

    root = pathlib.Path(__file__).resolve().parent.parent / "apps" / "assignment"
    imports = imported_modules(root)
    for forbidden in ("redis", "django.core.cache", "django.core.cache.cache"):
        assert not any(name.startswith(forbidden) for name in imports), (
            f"assignment imported {forbidden}"
        )

    assert AssignmentCounter._meta.db_table == "assignment_counters"
    source = (root / "services" / "__init__.py").read_text()
    assert "select_for_update()" in source


def test_asg_3_an_assignment_rule_cannot_route_outside_its_workspace(actor, owner):
    from apps.assignment.services import upsert_assignment_rule
    from common.errors import ValidationFailed

    stranger = actor(email="stranger@example.test", workspace_name="StrangerWs")
    with pytest.raises(ValidationFailed) as raised:
        upsert_assignment_rule(
            context=owner.context, name="bad", member_refs=[stranger.membership.public_id]
        )
    assert "unknown" in raised.value.details


def test_asg_4_assignment_rules_require_the_assignment_permission(actor, auth_client):
    sales = actor(email="asg-sales@example.test", role="sales", workspace_name="AsgSales")
    denied = auth_client(sales).get("/api/v1/assignment/rules")
    assert denied.status_code == 403


# --------------------------------------------------------------------------
# The inbox, tenancy and Party360.
# --------------------------------------------------------------------------


def test_the_inbox_is_a_view_over_messaging_truth_not_a_second_store(owner, wa, client, auth_client):
    from apps.messaging.models import Conversation

    drain(client, inbound_body(from_phone="+966500111222", message_id="wamid.a", text="First"))
    drain(client, inbound_body(from_phone="+966500333444", message_id="wamid.b", text="Second"))

    body = auth_client(owner).get("/api/v1/conversations").json()
    assert len(body["items"]) == 2
    for item in body["items"]:
        assert item["latest_message"]["body"] in ("First", "Second")
        assert item["unread_count"] == 1

    unread = auth_client(owner).get("/api/v1/conversations?unread=true").json()
    assert len(unread["items"]) == 2
    conversation = Conversation.objects.first()
    auth_client(owner).post(f"/api/v1/conversations/{conversation.public_id}/read", {}, format="json")
    assert len(auth_client(owner).get("/api/v1/conversations?unread=true").json()["items"]) == 1


def test_a_conversation_from_another_workspace_is_not_found(actor, owner, wa, client, auth_client):
    from apps.messaging.models import Conversation

    drain(client, inbound_body())
    conversation = Conversation.objects.get(workspace=owner.workspace)
    stranger = actor(email="msg-iso@example.test", workspace_name="MsgIso")

    assert auth_client(stranger).get(
        f"/api/v1/conversations/{conversation.public_id}"
    ).status_code == 404
    denied = auth_client(stranger).post(
        "/api/v1/messages", {"conversation_ref": conversation.public_id, "body": "hi"}, format="json"
    )
    assert denied.status_code == 404


def test_p360_3_the_conversations_section_activates_at_this_slice(owner, wa, client, auth_client):
    from apps.crm.services import create_lead
    from apps.messaging.models import Conversation

    lead = create_lead(
        context=owner.context,
        origin_type="manual",
        primary_contact={"name": "Sectioned", "phone": "+966500111222"},
    )
    before = auth_client(owner).get(f"/api/v1/leads/{lead.public_id}").json()
    assert "conversations" not in before

    drain(client, inbound_body(from_phone="+966500111222"))
    Conversation.objects.filter(workspace=owner.workspace).update(lead=lead)

    after = auth_client(owner).get(f"/api/v1/leads/{lead.public_id}").json()
    assert "conversations" in after
    assert after["conversations"][0]["handling_mode"] == "human"


def test_p360_14_messaging_entries_join_the_timeline_and_crm_imports_no_messaging(
    owner, wa, client, auth_client
):
    """`T-P360-14`. The merge happens in `analytics`, through the registry."""
    from apps.crm.services import create_lead
    from apps.messaging.models import Conversation

    lead = create_lead(
        context=owner.context,
        origin_type="manual",
        primary_contact={"name": "Timelined", "phone": "+966500111222"},
    )
    drain(client, inbound_body(from_phone="+966500111222", text="On the timeline"))
    Conversation.objects.filter(workspace=owner.workspace).update(lead=lead)

    body = auth_client(owner).get(f"/api/v1/leads/{lead.public_id}/timeline").json()
    domains = {entry["source_domain"] for entry in body["items"]}
    assert "messaging" in domains and "crm" in domains

    # The structural half: crm still imports NO messaging symbol.
    crm_root = pathlib.Path(__file__).resolve().parent.parent / "apps" / "crm"
    offenders = [name for name in imported_modules(crm_root) if name.startswith("apps.messaging")]
    assert offenders == [], f"crm imported messaging: {offenders}"


def test_an_unauthorized_timeline_entry_is_absent_not_a_placeholder(owner, wa, client):
    """A placeholder would itself disclose that a conversation exists.

    Every one of the six roles holds `conversation.view` at least conditionally,
    so the rule is exercised where it actually lives: the contributor is handed
    an actor context WITHOUT the permission and must yield nothing.
    """
    from apps.crm.services import create_lead
    from apps.messaging.models import Conversation
    from apps.messaging.party360 import MessagingTimelineContributor
    from common.party360.contracts import (
        ActorContext,
        QueryContext,
        SubjectRef,
        TimelineCursor,
        WorkspaceRef,
    )

    lead = create_lead(
        context=owner.context,
        origin_type="manual",
        primary_contact={"name": "Hidden", "phone": "+966500111222"},
    )
    drain(client, inbound_body(from_phone="+966500111222"))
    Conversation.objects.filter(workspace=owner.workspace).update(lead=lead)

    contributor = MessagingTimelineContributor()
    workspace_ref = WorkspaceRef(id=owner.workspace.id, public_id=owner.workspace.public_id)
    subject = SubjectRef(kind="lead", public_id=lead.public_id)
    query = QueryContext(cursor=TimelineCursor(), limit=25)

    permitted = contributor.fetch(
        workspace_ref,
        subject,
        ActorContext(
            user_id=owner.user.id,
            membership_id=owner.membership.id,
            workspace_id=owner.workspace.id,
            role="owner",
            permissions=frozenset({"conversation.view"}),
        ),
        query,
    )
    assert permitted.entries, "the fixture must actually produce a messaging entry"

    withheld = contributor.fetch(
        workspace_ref,
        subject,
        ActorContext(
            user_id=owner.user.id,
            membership_id=owner.membership.id,
            workspace_id=owner.workspace.id,
            role="viewer",
            permissions=frozenset({"lead.view"}),  # no conversation.view
        ),
        query,
    )
    # ABSENT, not an empty placeholder with a count.
    assert withheld.entries == []
    assert withheld.has_more is False

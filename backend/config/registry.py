"""COMPOSITION ROOT registrations.

config/ is the ONLY package permitted to import upward. Every Party360 section
provider, every timeline contributor and every dispatchable command name is
registered HERE — never by an app, and never by the composer.

This is what keeps the composition boundary class E: no app imports another
app to compose, so no class A edge is created.
"""

from __future__ import annotations

from common.dispatch import command_registry, task_registry
from common.party360.registry import section_registry, timeline_contributor_registry
from common.ports import ports, simple_port
from common.provider_ports import providers


def register_party360_sections() -> None:
    from apps.crm.party360 import (
        AppointmentsSectionProvider,
        ContactsSectionProvider,
        LeadSectionProvider,
        NotesSectionProvider,
        TasksSectionProvider,
    )
    from apps.customfields.party360 import CustomFieldsSectionProvider
    from apps.discovery.party360 import BusinessSectionProvider
    from apps.files.party360 import FilesSectionProvider

    # I2 — crm, discovery, files.
    section_registry.register(LeadSectionProvider())
    section_registry.register(ContactsSectionProvider())
    section_registry.register(TasksSectionProvider())
    section_registry.register(AppointmentsSectionProvider())
    section_registry.register(NotesSectionProvider())
    section_registry.register(BusinessSectionProvider())
    section_registry.register(FilesSectionProvider())

    # I5 — customers, customfields.
    from apps.customers.party360 import CustomerProfileSectionProvider

    section_registry.register(CustomerProfileSectionProvider())
    section_registry.register(CustomFieldsSectionProvider())

    # I7 — pipeline. The `deals` section flips unavailable -> present HERE and
    # at no earlier slice.
    from apps.pipeline.party360 import DealsSectionProvider

    section_registry.register(DealsSectionProvider())


def register_timeline_contributors() -> None:
    """Each contributor activates at ITS OWN slice.

    I2: crm. I6: messaging (not in Wave 1). I7: pipeline.
    The timeline is executable with crm ALONE — it requires neither of the
    other modules to function.
    """
    from apps.crm.party360 import CrmTimelineContributor

    timeline_contributor_registry.register(CrmTimelineContributor())

    from apps.pipeline.party360 import PipelineTimelineContributor

    timeline_contributor_registry.register(PipelineTimelineContributor())


def register_commands() -> None:
    """Infrastructure dispatch by NAME. platform_async holds the name only."""
    from apps.crm.services import create_lead
    from apps.customers.services import create_customer

    command_registry.register("CreateLead", create_lead)
    command_registry.register("CreateCustomer", create_customer)


def register_tasks() -> None:
    """Async work registered BY NAME (B14_09 §5).

    Each sender enqueues onto the task's own frozen queue. A domain command
    holds the NAME and a durable reference — never an import of the module that
    performs the work, and never a live object.

    `TASK_EXECUTION` selects how a registered name is delivered:

    *   `celery` — the deployed path: publish to the broker and return.
    *   `recorded` — record the enqueue and run nothing. This is what makes a
        worker's redelivery, concurrency and idempotency behaviour testable: the
        test enqueues through the real command path and then invokes the worker
        entry point itself, as many times as the property under test requires.

    There is no `inline` mode that silently runs work inside the request, because
    that would make every async contract in the pack untestable by hiding the
    boundary the contract is about.
    """
    from django.conf import settings

    from apps.discovery.tasks import run_discovery_job_task

    senders: dict[str, object] = {"discovery.run_discovery_job": run_discovery_job_task}

    mode = getattr(settings, "TASK_EXECUTION", "celery")

    def make_sender(task):
        if mode == "recorded":
            return lambda **payload: None
        return lambda **payload: task.delay(**payload)

    for name, task in senders.items():
        task_registry.register(name, make_sender(task))


class DiscardingCredentialDelivery:
    """The bound default for the out-of-band delivery boundary.

    B1 defines no provider, no template and no transport for credential
    delivery, so the correct Wave 1 behaviour is to accept the handoff and
    retain NOTHING: no storage, no logging, no echo. A deployment that wants
    real email binds a provider adapter here and changes nothing else.

    Discarding is the safe default. Returning the token to the caller — the
    posture B1-D-A22 exists to forbid — is not an option this seam offers.
    """

    def deliver(self, *, kind: str, subject_ref: str, raw_token: str, command_id: str) -> None:
        return None


def bind_ports() -> None:
    """Bind every class B port. common/ declares them; config/ supplies the
    implementations, so common/ never imports apps/ (T-ARCH-8)."""
    from apps.auditlog.models import AuditLog
    from apps.entitlements.selectors import evaluate_entitlement, evaluate_quota
    from apps.identity_access.models import Session
    from apps.platform_async.models import (
        OutboxEvent,
        PlatformReconciliationCase,
        ProviderRequestAttempt,
        WebhookReceipt,
    )
    from apps.workspaces.models import Membership

    def resolve_membership(workspace, user):
        return Membership.objects.select_related("workspace").filter(workspace=workspace, user=user).first()

    def initial_workspace_for(user):
        membership = (
            Membership.objects.select_related("workspace")
            .filter(user=user, status="active", workspace__status="active")
            .order_by("created_at")
            .first()
        )
        return membership.workspace if membership else None

    def append_audit(**kwargs):
        actor_membership = kwargs.get("actor_membership")
        return AuditLog.objects.create(
            workspace=kwargs["workspace"],
            actor_membership=actor_membership,
            actor_user=getattr(actor_membership, "user", None),
            action=kwargs["action"],
            target_type=kwargs["target_type"],
            target_ref=kwargs.get("target_ref", ""),
            changed_fields=kwargs.get("changed_fields", []),
            metadata=kwargs.get("metadata", {}),
        )

    def publish_outbox(**kwargs):
        return OutboxEvent.objects.create(
            workspace=kwargs["workspace"],
            event_type=kwargs["event_type"],
            aggregate_type=kwargs["aggregate_type"],
            aggregate_ref=kwargs["aggregate_ref"],
            payload=kwargs.get("payload", {}),
            correlation_id=kwargs.get("correlation_id", ""),
            causation_id=kwargs.get("causation_id", ""),
        )

    def record_receipt(*, provider, external_id, payload_digest, signature_verified):
        """First-line webhook dedup, decided by a DATABASE constraint.

        `get_or_create` on `(provider, external_id)` under the unique index
        makes a redelivered callback resolve to the existing receipt even when
        two deliveries race — which `if exists()` could not do.
        """
        if not external_id:
            # No provider identity to dedup on: receipt it, never claim it is new.
            return (
                WebhookReceipt.objects.create(
                    provider=provider,
                    external_id="",
                    payload_digest=payload_digest,
                    signature_verified=signature_verified,
                ),
                True,
            )
        return WebhookReceipt.objects.get_or_create(
            provider=provider,
            external_id=external_id,
            defaults={"payload_digest": payload_digest, "signature_verified": signature_verified},
        )

    def open_attempt(*, provider, operation):
        return ProviderRequestAttempt.objects.create(provider=provider, operation=operation)

    def settle_attempt(*, attempt, outcome, status_code=None):
        if attempt is None:
            return
        attempt.outcome = outcome
        attempt.status_code = status_code
        attempt.save(update_fields=["outcome", "status_code", "updated_at"])

    def open_case(*, case_class, subject_ref, detail):
        return PlatformReconciliationCase.objects.create(
            case_class=case_class, subject_ref=subject_ref, detail=detail
        )

    ports.bind(
        webhook_receipts=simple_port(record=record_receipt),
        provider_attempts=simple_port(open=open_attempt, settle=settle_attempt),
        reconciliation=simple_port(open_case=open_case),
        membership=simple_port(resolve=resolve_membership, initial_workspace_for=initial_workspace_for),
        audit=simple_port(append=append_audit),
        outbox=simple_port(publish=publish_outbox),
        entitlement=simple_port(evaluate_entitlement=evaluate_entitlement, evaluate_quota=evaluate_quota),
        session=simple_port(resolve=Session.objects.for_token),
        credential_delivery=DiscardingCredentialDelivery(),
    )


def bind_providers() -> None:
    """Bind every PROVIDER port (B14_16 §1, B14_14 §1, B14_15).

    This is the ONLY place a vendor adapter is named. A domain module reaches a
    provider exclusively through `common.provider_ports`, so replacing any line
    below with a different adapter — or with a stub — changes no domain module,
    no migration, no DTO and no test (`T-DISC-2`, `T-AI-6`).

    Selection is by CONFIGURATION, never by a test flag: a settings module that
    names the stub gets the stub, and nothing inside a domain service ever asks
    whether it is running under test.
    """
    from django.conf import settings

    from adapters.openai import OpenAIAdapter, StubAIAdapter
    from adapters.places import GooglePlacesAdapter, StubPlaceSearchAdapter
    from adapters.scraping import UnselectedScrapingAdapter
    from adapters.whatsapp import MetaWhatsAppAdapter, StubWhatsAppAdapter

    use_stubs = getattr(settings, "USE_STUB_PROVIDERS", False)
    providers.bind(
        place_search=StubPlaceSearchAdapter() if use_stubs else GooglePlacesAdapter(),
        # The vendor is unselected in EVERY environment (B12-D-B005): there is
        # no stub to swap in, because there is no contract to stub.
        scraping=UnselectedScrapingAdapter(),
        ai=StubAIAdapter() if use_stubs else OpenAIAdapter(),
        whatsapp=StubWhatsAppAdapter() if use_stubs else MetaWhatsAppAdapter(),
    )


def register_all() -> None:
    section_registry.clear()
    timeline_contributor_registry.clear()
    command_registry.clear()
    task_registry.clear()
    bind_ports()
    bind_providers()
    register_party360_sections()
    register_timeline_contributors()
    register_commands()
    register_tasks()

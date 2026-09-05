"""COMPOSITION ROOT registrations.

config/ is the ONLY package permitted to import upward. Every Party360 section
provider, every timeline contributor and every dispatchable command name is
registered HERE — never by an app, and never by the composer.

This is what keeps the composition boundary class E: no app imports another
app to compose, so no class A edge is created.
"""

from __future__ import annotations

from common.dispatch import command_registry
from common.party360.registry import section_registry, timeline_contributor_registry
from common.ports import ports, simple_port


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


def bind_ports() -> None:
    """Bind every class B port. common/ declares them; config/ supplies the
    implementations, so common/ never imports apps/ (T-ARCH-8)."""
    from apps.auditlog.models import AuditLog
    from apps.entitlements.selectors import evaluate_entitlement, evaluate_quota
    from apps.identity_access.models import Session
    from apps.platform_async.models import OutboxEvent
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

    ports.bind(
        membership=simple_port(resolve=resolve_membership, initial_workspace_for=initial_workspace_for),
        audit=simple_port(append=append_audit),
        outbox=simple_port(publish=publish_outbox),
        entitlement=simple_port(evaluate_entitlement=evaluate_entitlement, evaluate_quota=evaluate_quota),
        session=simple_port(resolve=Session.objects.for_token),
    )


def register_all() -> None:
    section_registry.clear()
    timeline_contributor_registry.clear()
    command_registry.clear()
    bind_ports()
    register_party360_sections()
    register_timeline_contributors()
    register_commands()

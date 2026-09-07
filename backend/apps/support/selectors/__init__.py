"""support read models. Workspace-scoped on every query."""

from __future__ import annotations

from ..models import Ticket, TicketSlaClock


def tickets_for(workspace):
    return Ticket.objects.filter(workspace=workspace).order_by("-created_at", "-public_id")


def ticket_payload(ticket: Ticket) -> dict:
    """No amount, no currency, no revenue reference. Support holds no money."""
    return {
        "id": ticket.public_id,
        "subject": ticket.subject,
        "body": ticket.body,
        "status": ticket.status,
        "priority": ticket.priority,
        "subject_type": ticket.subject_type,
        "subject_ref": ticket.subject_ref,
        "assigned_to": ticket.assigned_to.public_id if ticket.assigned_to_id else None,
        "resolved_at": ticket.resolved_at,
        "reopened_count": ticket.reopened_count,
        "version": ticket.version,
        "created_at": ticket.created_at,
    }


def ticket_activities(ticket: Ticket):
    return ticket.activities.order_by("created_at")


def sla_clocks_for(ticket: Ticket) -> list[dict]:
    return [
        {
            "kind": clock.kind,
            "state": clock.state,
            "target_minutes": clock.target_minutes,
            "elapsed_seconds": clock.elapsed_seconds,
            "breached": clock.breached_at is not None,
        }
        for clock in TicketSlaClock.objects.filter(ticket=ticket).order_by("kind")
    ]


def tickets_for_subject(workspace, subject_ref: str) -> list[dict]:
    """The Party360 `tickets` section provider."""
    return [
        ticket_payload(t)
        for t in Ticket.objects.filter(workspace=workspace, subject_ref=subject_ref).order_by(
            "-created_at"
        )
    ]


__all__ = [
    "tickets_for",
    "ticket_payload",
    "ticket_activities",
    "sla_clocks_for",
    "tickets_for_subject",
]

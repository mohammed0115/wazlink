"""crm API. The Lead 360 and timeline endpoints are served by the COMPOSER
(routed from config/), not from here — crm composes nothing."""

from __future__ import annotations

from rest_framework.response import Response

from common.authz import enforce_object_condition, resolve_in_workspace
from common.concurrency import parse_if_match
from common.errors import EntityNotFound, ValidationFailed
from common.pagination import paginate
from common.views import WazlinkAPIView

from ..models import Contact, Lead, Task
from ..selectors import contact_payload, filter_leads, lead_list_item
from ..services import (
    add_contact_to_lead,
    add_note,
    add_tag,
    archive_lead,
    complete_task,
    convert_business_to_lead,
    create_appointment,
    create_lead,
    create_task,
    set_lead_priority,
    set_lead_status,
)


class LeadListCreateView(WazlinkAPIView):
    def get(self, request):
        context = self.context(request, "lead.view")
        queryset = filter_leads(context, request.query_params.dict())
        items, next_cursor = paginate(queryset, request, order_fields=("-last_activity_at", "-public_id"))
        return Response(
            {
                "items": [lead_list_item(lead, role=context.role) for lead in items],
                "next_cursor": next_cursor,
            }
        )

    def post(self, request):
        """POST /leads — CA-01 + CA-15. Creates a Lead with NO Business,
        NO DiscoveryJob and NO fabricated provenance."""
        context = self.context(request, "lead.create")
        data = request.data or {}

        business = None
        if business_ref := data.get("business_ref"):
            from apps.discovery.models import Business

            business = resolve_in_workspace(Business.objects.all(), context, public_id=business_ref)

        lead = create_lead(
            context=context,
            origin_type=data.get("origin_type", "manual"),
            business=business,
            primary_contact=data.get("primary_contact"),
        )
        return Response(lead_list_item(lead, role=context.role), status=201)


class LeadStatusView(WazlinkAPIView):
    permission_code = "lead.update"

    def post(self, request, lead_ref: str):
        context = self.context(request)
        lead = resolve_in_workspace(Lead.objects.all(), context, public_id=lead_ref)
        enforce_object_condition(context, "lead.update")
        lead = set_lead_status(
            context=context,
            lead=lead,
            status=(request.data or {}).get("status", ""),
            expected_version=parse_if_match(request),
        )
        return Response(lead_list_item(lead, role=context.role))


class LeadPriorityView(WazlinkAPIView):
    permission_code = "lead.update"

    def post(self, request, lead_ref: str):
        context = self.context(request)
        lead = resolve_in_workspace(Lead.objects.all(), context, public_id=lead_ref)
        lead = set_lead_priority(
            context=context,
            lead=lead,
            priority=(request.data or {}).get("priority", ""),
            expected_version=parse_if_match(request),
        )
        return Response(lead_list_item(lead, role=context.role))


class LeadArchiveView(WazlinkAPIView):
    permission_code = "lead.archive"

    def post(self, request, lead_ref: str):
        context = self.context(request)
        lead = resolve_in_workspace(Lead.objects.all(), context, public_id=lead_ref)
        lead = archive_lead(context=context, lead=lead, expected_version=parse_if_match(request))
        return Response(lead_list_item(lead, role=context.role))


class LeadTagView(WazlinkAPIView):
    permission_code = "lead.update"

    def post(self, request, lead_ref: str):
        context = self.context(request)
        lead = resolve_in_workspace(Lead.objects.all(), context, public_id=lead_ref)
        row = add_tag(context=context, lead=lead, tag=(request.data or {}).get("tag", ""))
        return Response({"lead_ref": lead.public_id, "tag": row.tag}, status=201)


class LeadContactsView(WazlinkAPIView):
    def get(self, request, lead_ref: str):
        context = self.context(request, "contact.view")
        lead = resolve_in_workspace(Lead.objects.all(), context, public_id=lead_ref)
        links = lead.lead_contacts.select_related("contact").filter(unlinked_at__isnull=True)
        return Response(
            {
                "items": [
                    {**contact_payload(link.contact, role=context.role), "is_primary": link.is_primary}
                    for link in links
                ]
            }
        )

    def post(self, request, lead_ref: str):
        context = self.context(request, "contact.manage")
        lead = resolve_in_workspace(Lead.objects.all(), context, public_id=lead_ref)
        data = request.data or {}
        contact = add_contact_to_lead(
            context=context,
            lead=lead,
            name=data.get("name", ""),
            phone=data.get("phone", ""),
            email=data.get("email", ""),
            contact_ref=data.get("contact_ref"),
            is_primary=bool(data.get("is_primary")),
        )
        return Response(contact_payload(contact, role=context.role), status=201)


class ContactListView(WazlinkAPIView):
    permission_code = "contact.view"

    def get(self, request):
        context = self.context(request)
        queryset = Contact.objects.filter(workspace=context.workspace, archived_at__isnull=True)
        if q := request.query_params.get("q"):
            queryset = queryset.filter(full_name__icontains=q)
        items, next_cursor = paginate(queryset, request, order_fields=("full_name", "public_id"))
        return Response(
            {
                "items": [contact_payload(c, role=context.role) for c in items],
                "next_cursor": next_cursor,
            }
        )


class ContactDetailView(WazlinkAPIView):
    def get(self, request, contact_ref: str):
        context = self.context(request, "contact.view")
        contact = resolve_in_workspace(Contact.objects.all(), context, public_id=contact_ref)
        return Response(contact_payload(contact, role=context.role))


class TaskListCreateView(WazlinkAPIView):
    def get(self, request):
        context = self.context(request, "task.view")
        queryset = Task.objects.filter(workspace=context.workspace)
        if status_filter := request.query_params.get("status"):
            queryset = queryset.filter(status=status_filter)
        items, next_cursor = paginate(queryset, request, order_fields=("due_at", "public_id"))
        return Response(
            {
                "items": [
                    {
                        "task_ref": t.public_id,
                        "title": t.title,
                        "status": t.status,
                        "due_at": t.due_at,
                        "overdue": t.is_overdue,
                        "version": t.version,
                        "lead_ref": t.lead.public_id if t.lead_id else None,
                    }
                    for t in items
                ],
                "next_cursor": next_cursor,
            }
        )

    def post(self, request):
        context = self.context(request, "task.manage")
        data = request.data or {}
        lead = None
        if lead_ref := data.get("lead_ref"):
            lead = resolve_in_workspace(Lead.objects.all(), context, public_id=lead_ref)
        task = create_task(context=context, title=data.get("title", ""), lead=lead, due_at=data.get("due_at"))
        return Response(
            {"task_ref": task.public_id, "title": task.title, "status": task.status, "version": task.version},
            status=201,
        )


class TaskDetailView(WazlinkAPIView):
    permission_code = "task.manage"

    def patch(self, request, task_ref: str):
        context = self.context(request)
        task = resolve_in_workspace(Task.objects.all(), context, public_id=task_ref)
        if (request.data or {}).get("status") == "completed":
            task = complete_task(context=context, task=task, expected_version=parse_if_match(request))
        else:
            raise ValidationFailed("Only completion is supported on this endpoint.")
        return Response({"task_ref": task.public_id, "status": task.status, "version": task.version})


class AppointmentListCreateView(WazlinkAPIView):
    def get(self, request):
        context = self.context(request, "appointment.view")
        from ..models import Appointment

        queryset = Appointment.objects.filter(workspace=context.workspace)
        items, next_cursor = paginate(queryset, request, order_fields=("starts_at", "public_id"))
        return Response(
            {
                "items": [
                    {
                        "appointment_ref": a.public_id,
                        "title": a.title,
                        "starts_at": a.starts_at,
                        "ends_at": a.ends_at,
                        "status": a.status,
                    }
                    for a in items
                ],
                "next_cursor": next_cursor,
            }
        )

    def post(self, request):
        context = self.context(request, "appointment.manage")
        data = request.data or {}
        if not data.get("starts_at") or not data.get("ends_at"):
            raise ValidationFailed("starts_at and ends_at are required.")
        lead = None
        if lead_ref := data.get("lead_ref"):
            lead = resolve_in_workspace(Lead.objects.all(), context, public_id=lead_ref)
        appointment = create_appointment(
            context=context,
            title=data.get("title", ""),
            starts_at=data["starts_at"],
            ends_at=data["ends_at"],
            lead=lead,
        )
        return Response(
            {
                "appointment_ref": appointment.public_id,
                "title": appointment.title,
                "starts_at": appointment.starts_at,
                "ends_at": appointment.ends_at,
                # Overlap is a WARNING, not a refusal.
                "overlap_warning": getattr(appointment, "overlap_warning", False),
            },
            status=201,
        )


class LeadNoteView(WazlinkAPIView):
    permission_code = "lead.update"

    def post(self, request, lead_ref: str):
        context = self.context(request)
        lead = resolve_in_workspace(Lead.objects.all(), context, public_id=lead_ref)
        note = add_note(context=context, lead=lead, body=(request.data or {}).get("body", ""))
        return Response({"note_ref": note.public_id, "body": note.body}, status=201)


class BusinessConvertView(WazlinkAPIView):
    """POST /businesses/{id}/convert — a discovered Business becomes a Lead.

    The route addresses a Business, but the COMMAND is CRM's: `crm`(L5) reads
    `discovery`(L4) downward, which is the legal direction. Serving it from
    `discovery` would require `discovery` to reach UP into `crm`, and the layer
    walk refuses that (`B14_03` §5c).
    """

    permission_code = "business.convert"

    def post(self, request, business_ref: str):
        from apps.discovery.models import Business

        context = self.context(request)
        business = resolve_in_workspace(Business.objects.all(), context, public_id=business_ref)
        lead = convert_business_to_lead(context=context, business=business)
        return Response(lead_list_item(lead, role=context.role), status=201)


__all__ = [
    "BusinessConvertView",
    "LeadListCreateView",
    "LeadStatusView",
    "LeadPriorityView",
    "LeadArchiveView",
    "LeadTagView",
    "LeadContactsView",
    "ContactListView",
    "ContactDetailView",
    "TaskListCreateView",
    "TaskDetailView",
    "AppointmentListCreateView",
    "LeadNoteView",
    "EntityNotFound",
]


class LeadCustomFieldsView(WazlinkAPIView):
    """The SUBJECT OWNER checks its own update permission, then delegates
    DOWNWARD into SetCustomFieldValues (crm L5 -> customfields L3) — the same
    direction AttachFile already uses."""

    permission_code = "lead.update"

    def post(self, request, lead_ref: str):
        from apps.customfields.services import set_field_values

        context = self.context(request)
        lead = resolve_in_workspace(Lead.objects.all(), context, public_id=lead_ref)
        rows = set_field_values(
            context=context,
            subject_type="lead",
            subject_id=lead.id,
            values=(request.data or {}).get("values", {}),
        )
        return Response({"lead_ref": lead.public_id, "written": len(rows)})


class LeadCustomFieldSearchView(WazlinkAPIView):
    """Value search/filter over leads (GAP-011).

    Workspace-scoped end to end: a value belonging to another workspace, or one
    whose definition is archived, can never appear in these results.
    """

    permission_code = "lead.view"

    def get(self, request):
        from apps.customfields.services import search_subject_ids

        context = self.context(request)
        ids = search_subject_ids(
            workspace=context.workspace,
            subject_type="lead",
            key=request.query_params.get("key", ""),
            value=request.query_params.get("value", ""),
        )
        leads = Lead.objects.filter(workspace=context.workspace, id__in=ids)
        return Response(
            {
                "items": [lead_list_item(lead, role=context.role) for lead in leads],
                "count": leads.count(),
            }
        )

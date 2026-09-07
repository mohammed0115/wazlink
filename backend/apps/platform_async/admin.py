"""Django Admin — the Integration Operations area (B14_12).

Two absences are the design:

*   **No tenant business model is registered here.** A platform operator has
    no business authority, so Leads, Customers, Deals, Messages and
    `revenue_events` are simply not reachable from this surface.
*   **There is no "retry this task" button** (`B12-D-A053`). Replay is a
    governed command with a mandatory reason, and it lives on the API, not on
    a one-click admin action.

Every model below is READ-ONLY in the admin. Operator actions go through the
commands in `services/`, which audit with a named operator actor; an editable
admin form would be an unaudited write path around them.
"""

from __future__ import annotations

from django.contrib import admin

from .models import (
    IntegrationConnection,
    IntegrationHealthSnapshot,
    PlatformDeadLetter,
    PlatformReconciliationCase,
    ProviderRequestAttempt,
    WorkerExecution,
)


class ReadOnlyAdmin(admin.ModelAdmin):
    """No add, no change, no delete. The admin observes; it does not act."""

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(IntegrationConnection)
class IntegrationConnectionAdmin(ReadOnlyAdmin):
    # `credential_refs` holds reference NAMES. There is no value column to
    # render, masked or otherwise (`T-SEC-4`).
    list_display = ("provider", "status", "configuration_valid", "updated_at")
    list_filter = ("provider", "status")
    readonly_fields = ("provider", "status", "configuration_valid", "credential_refs")


@admin.register(IntegrationHealthSnapshot)
class IntegrationHealthSnapshotAdmin(ReadOnlyAdmin):
    list_display = ("connection", "healthy", "created_at")
    list_filter = ("healthy",)


@admin.register(PlatformDeadLetter)
class PlatformDeadLetterAdmin(ReadOnlyAdmin):
    list_display = ("command_name", "status", "owning_domain", "replay_eligible", "created_at")
    list_filter = ("status", "owning_domain", "replay_eligible")
    # No action list: replay and abandon are governed commands, not buttons.
    actions = None


@admin.register(PlatformReconciliationCase)
class PlatformReconciliationCaseAdmin(ReadOnlyAdmin):
    list_display = ("case_class", "subject_ref", "status", "created_at")
    list_filter = ("case_class", "status")
    actions = None


@admin.register(WorkerExecution)
class WorkerExecutionAdmin(ReadOnlyAdmin):
    list_display = ("task_name", "queue", "status", "heartbeat_at", "created_at")
    list_filter = ("status", "queue")
    actions = None


@admin.register(ProviderRequestAttempt)
class ProviderRequestAttemptAdmin(ReadOnlyAdmin):
    list_display = ("provider", "operation", "outcome", "status_code", "created_at")
    list_filter = ("provider", "outcome")

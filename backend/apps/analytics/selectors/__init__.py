

# --------------------------------------------------------------------------
# I14 — the report sections (BACKEND_ANALYTICS_SEMANTICS).
#
# The load-bearing rule: **every revenue figure reads `revenue_events`.**
# Not `deals.value`, not a pipeline sum, not a quote, not a count of Won Deals.
# Frozen `BACKEND_ANALYTICS_SEMANTICS` states it in terms — "Deal value is
# never used as Recognized Revenue" — and the way to keep that true is for the
# revenue sections to query one table and never union a second.
#
# Pipeline value still appears here, clearly labelled as PIPELINE. It is a
# forecast, and the two are reported side by side precisely so nobody has to
# guess which one they are looking at.
# --------------------------------------------------------------------------
REPORT_SECTIONS = (
    "lead_funnel",
    "lead_sources",
    "customer_growth",
    "pipeline_value",
    "deal_outcomes",
    "activity_volume",
    "conversation_volume",
    "ticket_volume",
    "sla_performance",
    "recognized_revenue",
    "revenue_by_origin",
)


def report_section(workspace, section: str, *, actor=None) -> dict:
    """One report section, resolved by name. Unknown names fail closed."""
    if section not in REPORT_SECTIONS:
        return {"section": section, "state": "unavailable"}
    handler = _REPORT_HANDLERS.get(section)
    if handler is None:
        return {"section": section, "state": "unavailable"}
    return {"section": section, "state": "present", "data": handler(workspace, actor)}


def _lead_funnel(workspace, actor=None) -> dict:
    from apps.crm.models import Lead

    rows = Lead.objects.filter(workspace=workspace)
    return {
        "total": rows.count(),
        "by_status": _count_by(rows, "status"),
    }


def _lead_sources(workspace, actor=None) -> dict:
    from apps.crm.models import Lead

    return {"by_origin": _count_by(Lead.objects.filter(workspace=workspace), "origin_type")}


def _customer_growth(workspace, actor=None) -> dict:
    from apps.customers.models import Customer

    return {"total": Customer.objects.filter(workspace=workspace).count()}


def _pipeline_value(workspace, actor=None) -> dict:
    """Explicitly PIPELINE, explicitly a forecast, explicitly not revenue."""
    from django.db.models import Sum

    from apps.pipeline.models import Deal

    open_deals = Deal.objects.filter(workspace=workspace, status="open")
    total = open_deals.aggregate(total=Sum("value"))["total"] or 0
    return {
        "open_count": open_deals.count(),
        "open_value": f"{total:.4f}",
        "note": "forecast only; not recognized revenue",
    }


def _deal_outcomes(workspace, actor=None) -> dict:
    from apps.pipeline.models import Deal

    # Counts and statuses only. No amount is folded into a revenue figure here.
    return {"by_status": _count_by(Deal.objects.filter(workspace=workspace), "status")}


def _activity_volume(workspace, actor=None) -> dict:
    from apps.crm.models import Appointment, Task

    return {
        "tasks": Task.objects.filter(workspace=workspace).count(),
        "appointments": Appointment.objects.filter(workspace=workspace).count(),
    }


def _conversation_volume(workspace, actor=None) -> dict:
    from apps.messaging.models import Conversation

    return {"by_status": _count_by(Conversation.objects.filter(workspace=workspace), "status")}


def _ticket_volume(workspace, actor=None) -> dict:
    from apps.support.models import Ticket

    return {"by_status": _count_by(Ticket.objects.filter(workspace=workspace), "status")}


def _sla_performance(workspace, actor=None) -> dict:
    from apps.support.models import TicketSlaClock

    clocks = TicketSlaClock.objects.filter(workspace=workspace)
    return {
        "total": clocks.count(),
        "breached": clocks.filter(breached_at__isnull=False).count(),
    }


def _recognized_revenue(workspace, actor=None) -> dict:
    """Reads `revenue_events` and `revenue_reversals`. Nothing else."""
    from apps.revenue.selectors import revenue_summary

    return {"totals": revenue_summary(workspace)}


def _revenue_by_origin(workspace, actor=None) -> dict:
    from apps.revenue.selectors import attribution_ladder

    return {"ladder": attribution_ladder(workspace)}


_REPORT_HANDLERS = {
    "lead_funnel": _lead_funnel,
    "lead_sources": _lead_sources,
    "customer_growth": _customer_growth,
    "pipeline_value": _pipeline_value,
    "deal_outcomes": _deal_outcomes,
    "activity_volume": _activity_volume,
    "conversation_volume": _conversation_volume,
    "ticket_volume": _ticket_volume,
    "sla_performance": _sla_performance,
    "recognized_revenue": _recognized_revenue,
    "revenue_by_origin": _revenue_by_origin,
}

# The two sections that carry money. Reading either requires `revenue.view`
# conjunctively with `analytics.view` (`B9-D-A038`), enforced at the view.
MONETARY_SECTIONS = frozenset({"recognized_revenue", "revenue_by_origin"})


def _count_by(queryset, field: str) -> dict:
    counts: dict[str, int] = {}
    for value in queryset.values_list(field, flat=True):
        counts[value] = counts.get(value, 0) + 1
    return dict(sorted(counts.items()))

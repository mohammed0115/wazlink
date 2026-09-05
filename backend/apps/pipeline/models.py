"""pipeline (L7) — Pipelines, Stages and Deals (frozen B6).

REVENUE FIREWALL, structural: `revenue` and `pipeline` are BOTH L7 and
same-layer edges are prohibited, so neither can import the other. There is no
FK from a deal to revenue_events and none from revenue to deals. A Won Deal is
NOT recognized revenue and writes NOTHING to revenue.

The frozen monetary field name on a Deal is `value` (B6_DEAL_AGGREGATE). It is
forecast value, never recognized revenue.
"""

from __future__ import annotations

from decimal import Decimal

from django.db import models
from django.db.models import Q

from common.models import PublicIdModel, TimestampedModel, VersionedModel

DEAL_STATUSES = ("open", "won", "lost")


class Pipeline(PublicIdModel, TimestampedModel, VersionedModel):
    PUBLIC_ID_PREFIX = "PIPE"

    workspace = models.ForeignKey("workspaces.Workspace", on_delete=models.RESTRICT, related_name="pipelines")
    name = models.CharField(max_length=150)
    is_default = models.BooleanField(default=False)

    class Meta:
        db_table = "pipelines"
        constraints = [
            models.UniqueConstraint(
                fields=["workspace"],
                condition=Q(is_default=True),
                name="uq_pipeline_single_default",
            ),
        ]


class PipelineStage(PublicIdModel, TimestampedModel):
    PUBLIC_ID_PREFIX = "STG"

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="pipeline_stages"
    )
    pipeline = models.ForeignKey(Pipeline, on_delete=models.CASCADE, related_name="stages")
    name = models.CharField(max_length=120)
    position = models.PositiveIntegerField()
    probability = models.DecimalField(max_digits=5, decimal_places=4, default=Decimal("0"))
    is_terminal = models.BooleanField(default=False)

    class Meta:
        db_table = "pipeline_stages"
        ordering = ["position"]
        constraints = [
            models.UniqueConstraint(fields=["pipeline", "position"], name="uq_stage_position"),
            models.CheckConstraint(
                condition=Q(probability__gte=0) & Q(probability__lte=1),
                name="ck_stage_probability_range",
            ),
        ]


class Deal(PublicIdModel, TimestampedModel, VersionedModel):
    """The Deal aggregate. Lead-keyed, per frozen B6_B2_HANDOFF_CONTRACT."""

    PUBLIC_ID_PREFIX = "DEAL"

    workspace = models.ForeignKey("workspaces.Workspace", on_delete=models.RESTRICT, related_name="deals")
    # Lead-keyed subject reference (B6_B2_HANDOFF_CONTRACT).
    lead = models.ForeignKey(
        "crm.Lead", on_delete=models.RESTRICT, null=True, blank=True, related_name="deals"
    )
    customer = models.ForeignKey(
        "customers.Customer",
        on_delete=models.RESTRICT,
        null=True,
        blank=True,
        related_name="deals",
    )
    pipeline = models.ForeignKey(Pipeline, on_delete=models.RESTRICT, related_name="deals")
    stage = models.ForeignKey(PipelineStage, on_delete=models.RESTRICT, related_name="deals")
    title = models.CharField(max_length=250)
    # FROZEN monetary field name. Forecast value ONLY — never recognized revenue.
    value = models.DecimalField(max_digits=18, decimal_places=2, default=Decimal("0"))
    currency = models.CharField(max_length=3, default="SAR")
    status = models.CharField(max_length=10, choices=[(s, s) for s in DEAL_STATUSES], default="open")
    owner_membership = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="owned_deals"
    )
    loss_reason = models.CharField(max_length=200, blank=True)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "deals"
        constraints = [
            # A Deal must have a subject: a Lead, a Customer, or both.
            models.CheckConstraint(
                condition=Q(lead__isnull=False) | Q(customer__isnull=False),
                name="ck_deal_requires_subject",
            ),
            models.CheckConstraint(
                condition=~Q(status="lost") | ~Q(loss_reason=""),
                name="ck_deal_lost_requires_reason",
            ),
            models.CheckConstraint(
                condition=Q(status="open") | Q(closed_at__isnull=False),
                name="ck_deal_closed_has_timestamp",
            ),
        ]
        indexes = [
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["workspace", "pipeline", "stage"]),
        ]

    def __str__(self) -> str:
        return self.public_id

    @property
    def weighted_value(self) -> Decimal:
        """Computed at READ TIME and NEVER persisted to revenue."""
        if self.status == "won":
            return self.value
        if self.status == "lost":
            return Decimal("0")
        return (self.value * self.stage.probability).quantize(Decimal("0.01"))

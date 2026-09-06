"""`B3-INV-5` — move Business identity onto `business_identities`, keyed by
`(workspace_id, provider, provider_external_id)`.

**What was wrong.** `0002` put a unique key on `businesses`
`(workspace_id, provider_external_id)`. A provider's external id is opaque
*within that provider's namespace only*, so that key asserts that two providers
minting the same string describe the same company. Frozen
`B3_DATA_MODEL.md` §7 says the opposite in terms, and `AT-ID-11` is the negative
control naming this exact implementation. Observed before this migration: a
`places` result and a `scraping` result sharing one external id produced ONE
Business, whose name and `source_provider` anchor were silently overwritten by
whichever arrived second.

**Why the old table is recreated rather than altered.** Wave 1's
`business_identities` was a generic `(business, identity_kind, identity_value)`
shape that shares no column with the frozen one beyond its FK. Nothing has ever
written it — no writer exists at `75c09cb` (Wave 1) or at `ffa7bbb` (Wave 2), so
the table is empty in every database that can exist. Recreating it states the
frozen shape plainly instead of accumulating eight `AddField`s around two
`RemoveField`s.

That emptiness is a load-bearing claim, so it is **enforced, not asserted**:
`_refuse_if_populated` fails the migration loudly rather than dropping a row
anybody managed to write.
"""

from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


def _refuse_if_populated(apps, schema_editor):
    """Fail closed if the superseded table somehow holds data.

    A migration that silently drops rows is worse than one that stops. If this
    ever raises, the right answer is a bespoke data migration, not a `--fake`.
    """
    BusinessIdentity = apps.get_model("discovery", "BusinessIdentity")
    count = BusinessIdentity.objects.using(schema_editor.connection.alias).count()
    if count:
        raise RuntimeError(
            f"business_identities holds {count} row(s) under the superseded "
            "(business, identity_kind, identity_value) shape. This migration "
            "expects it to be empty because no code path has ever written it. "
            "Write a data migration that maps those rows onto "
            "(workspace, provider, provider_external_id) before continuing."
        )


def _noop(apps, schema_editor):
    """Reverse of a check is a no-op — it verified, it did not change."""


def _backfill_anchor_identities(apps, schema_editor):
    """Record the anchor each existing Business already carries.

    A database that ran `0002` holds Businesses whose `(source_provider,
    provider_external_id)` anchor was written straight onto the row, because
    `business_identities` did not participate. Once resolution moves to that
    table, such a Business is unreachable by identity: re-observing it would
    MISS and create a duplicate. Writing its anchor row is what keeps the
    Business continuous across this migration.

    This records what the row already says. It invents no link, merges nothing,
    and touches no Business that never came from a provider. `0002`'s unique
    key made `(workspace, provider_external_id)` unique, so no two rows can
    collide on the new key either.
    """
    Business = apps.get_model("discovery", "Business")
    BusinessIdentity = apps.get_model("discovery", "BusinessIdentity")
    alias = schema_editor.connection.alias

    rows = (
        Business.objects.using(alias)
        .exclude(provider_external_id="")
        .exclude(source_provider="")
        .values("id", "workspace_id", "provider_external_id", "source_provider",
                "first_observed_at", "last_observed_at")
    )
    BusinessIdentity.objects.using(alias).bulk_create(
        [
            BusinessIdentity(
                workspace_id=row["workspace_id"],
                business_id=row["id"],
                provider=row["source_provider"],
                provider_external_id=row["provider_external_id"],
                link_basis="anchor",
                first_seen_at=row["first_observed_at"],
                last_seen_at=row["last_observed_at"],
            )
            for row in rows
        ],
        batch_size=1000,
    )


def _drop_backfilled_identities(apps, schema_editor):
    """Reverse: the rows this migration created are anchors it derived."""
    BusinessIdentity = apps.get_model("discovery", "BusinessIdentity")
    BusinessIdentity.objects.using(schema_editor.connection.alias).filter(
        link_basis="anchor"
    ).delete()


class Migration(migrations.Migration):
    dependencies = [
        ("workspaces", "0001_initial"),
        ("discovery", "0002_i3_discovery_features"),
    ]

    operations = [
        migrations.RunPython(_refuse_if_populated, _noop),
        # The provider-blind key. Removing it is what stops two providers'
        # external ids from colliding into one row.
        migrations.RemoveConstraint(
            model_name="business",
            name="uq_business_provider_identity",
        ),
        migrations.RemoveConstraint(
            model_name="businessidentity",
            name="uq_business_identity",
        ),
        migrations.DeleteModel(name="BusinessIdentity"),
        migrations.CreateModel(
            name="BusinessIdentity",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("provider", models.CharField(max_length=40)),
                ("provider_external_id", models.CharField(max_length=200)),
                (
                    "link_basis",
                    models.CharField(
                        choices=[
                            ("anchor", "anchor"),
                            ("strong_match", "strong_match"),
                            ("merge", "merge"),
                            ("operator", "operator"),
                        ],
                        default="anchor",
                        max_length=20,
                    ),
                ),
                ("link_evidence", models.JSONField(blank=True, default=dict)),
                ("linked_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("first_seen_at", models.DateTimeField(blank=True, null=True)),
                ("last_seen_at", models.DateTimeField(blank=True, null=True)),
                (
                    "business",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="identities",
                        to="discovery.business",
                    ),
                ),
                (
                    "workspace",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.RESTRICT,
                        related_name="business_identities",
                        to="workspaces.workspace",
                    ),
                ),
            ],
            options={
                "db_table": "business_identities",
            },
        ),
        migrations.AddIndex(
            model_name="businessidentity",
            index=models.Index(fields=["workspace", "business"], name="business_id_workspa_201c94_idx"),
        ),
        migrations.AddIndex(
            model_name="businessidentity",
            index=models.Index(fields=["workspace", "provider"], name="business_id_workspa_16e6b9_idx"),
        ),
        # B3-INV-5. `provider` is in the key, which is the whole point.
        migrations.AddConstraint(
            model_name="businessidentity",
            constraint=models.UniqueConstraint(
                fields=("workspace", "provider", "provider_external_id"),
                name="uq_business_identity",
            ),
        ),
        migrations.AddConstraint(
            model_name="businessidentity",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    link_basis__in=("anchor", "strong_match", "merge", "operator")
                ),
                name="ck_business_identity_link_basis",
            ),
        ),
        # Last, so it runs against the finished shape and its unique index.
        migrations.RunPython(_backfill_anchor_identities, _drop_backfilled_identities),
    ]

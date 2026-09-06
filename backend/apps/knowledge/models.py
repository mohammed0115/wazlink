"""knowledge (L4) — the KB that grounds the agent (`GAP-015`, M25).

**Only a PUBLISHED article may ground an answer.** A draft is somebody thinking
aloud and an archived article is somebody's retracted answer; letting either
reach a customer through an AI draft would be worse than having no KB at all.
`kb_retrieval` therefore filters on `published` in the selector, not in the
caller — so a future caller cannot forget.

Versions are APPEND-ONLY. A citation names an article AND a version, so an
answer stays explainable after the article moves on.
"""

from __future__ import annotations

from django.db import models

from common.models import PublicIdModel, TimestampedModel, VersionedModel

STATUS_DRAFT = "draft"
STATUS_PUBLISHED = "published"
STATUS_ARCHIVED = "archived"
ARTICLE_STATUSES = (STATUS_DRAFT, STATUS_PUBLISHED, STATUS_ARCHIVED)


class KnowledgeArticle(PublicIdModel, TimestampedModel, VersionedModel):
    PUBLIC_ID_PREFIX = "KBA"

    STATUS_CHOICES = [(s, s) for s in ARTICLE_STATUSES]

    workspace = models.ForeignKey(
        "workspaces.Workspace", on_delete=models.RESTRICT, related_name="kb_articles"
    )
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    # Which append-only version is currently published. NULL until first publish.
    published_version = models.PositiveIntegerField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="kb_articles"
    )

    class Meta:
        db_table = "kb_articles"
        indexes = [models.Index(fields=["workspace", "status"])]


class KnowledgeArticleVersion(TimestampedModel):
    """Append-only. A published answer stays quotable after the article changes."""

    article = models.ForeignKey(
        KnowledgeArticle, on_delete=models.CASCADE, related_name="versions"
    )
    version_no = models.PositiveIntegerField()
    title = models.CharField(max_length=200)
    body = models.TextField(blank=True)
    created_by = models.ForeignKey(
        "workspaces.Membership", on_delete=models.RESTRICT, related_name="kb_article_versions"
    )

    class Meta:
        db_table = "kb_article_versions"
        constraints = [
            models.UniqueConstraint(fields=["article", "version_no"], name="uq_kb_article_version"),
        ]


class KnowledgeSource(TimestampedModel):
    """An attachment backing an article, held through B11 — no second file truth."""

    article = models.ForeignKey(KnowledgeArticle, on_delete=models.CASCADE, related_name="sources")
    # A FILE-* public id. The bytes live in files/, which owns them.
    file_ref = models.CharField(max_length=60, blank=True)
    label = models.CharField(max_length=200, blank=True)

    class Meta:
        db_table = "kb_sources"

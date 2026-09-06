"""knowledge commands — CreateArticle, PublishArticle, ArchiveArticle."""

from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from common.audit import write_audit
from common.concurrency import bump_version, lock_aggregate, require_version
from common.errors import DomainConflict, ValidationFailed
from common.outbox import publish_event

from ..models import (
    STATUS_ARCHIVED,
    STATUS_DRAFT,
    STATUS_PUBLISHED,
    KnowledgeArticle,
    KnowledgeArticleVersion,
)


@transaction.atomic
def create_article(*, context, title: str, body: str = "") -> KnowledgeArticle:
    if not (title or "").strip():
        raise ValidationFailed("An article requires a title.")

    article = KnowledgeArticle.objects.create(
        workspace=context.workspace,
        title=title.strip()[:200],
        body=body or "",
        status=STATUS_DRAFT,
        created_by=context.membership,
    )
    KnowledgeArticleVersion.objects.create(
        article=article,
        version_no=1,
        title=article.title,
        body=article.body,
        created_by=context.membership,
    )
    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="knowledge.article_created",
        target_type="kb_article",
        target_ref=article.public_id,
        changed_fields=["title", "status"],
    )
    return article


@transaction.atomic
def update_article(
    *, context, article: KnowledgeArticle, title: str = "", body: str = "",
    expected_version: int | None = None,
) -> KnowledgeArticle:
    """An edit appends a NEW version; it never rewrites a published one.

    A citation names an article AND a version, so an answer already given stays
    explainable even after the article moves on.
    """
    require_version(article, expected_version, required=False)
    lock_aggregate(article)

    article.title = (title or article.title).strip()[:200]
    article.body = body if body is not None else article.body
    next_version = (article.versions.order_by("-version_no").first().version_no) + 1
    KnowledgeArticleVersion.objects.create(
        article=article,
        version_no=next_version,
        title=article.title,
        body=article.body,
        created_by=context.membership,
    )
    bump_version(article)
    article.save(update_fields=["title", "body", "version", "updated_at"])
    return article


@transaction.atomic
def publish_article(
    *, context, article: KnowledgeArticle, expected_version: int | None = None
) -> KnowledgeArticle:
    require_version(article, expected_version, required=False)
    lock_aggregate(article)
    if article.status == STATUS_PUBLISHED:
        raise DomainConflict("This article is already published.")
    if not (article.body or "").strip():
        # An empty published article would be cited as an authority that says
        # nothing, which is worse than an absent one.
        raise ValidationFailed("An article cannot be published with an empty body.")

    latest = article.versions.order_by("-version_no").first()
    article.status = STATUS_PUBLISHED
    article.published_version = latest.version_no
    article.published_at = timezone.now()
    bump_version(article)
    article.save(
        update_fields=["status", "published_version", "published_at", "version", "updated_at"]
    )

    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="knowledge.article_published",
        target_type="kb_article",
        target_ref=article.public_id,
        changed_fields=["status", "published_version"],
    )
    publish_event(
        workspace=context.workspace,
        event_type="KnowledgeArticlePublished",
        aggregate_type="kb_article",
        aggregate_ref=article.public_id,
        payload={"published_version": article.published_version},
    )
    return article


@transaction.atomic
def archive_article(
    *, context, article: KnowledgeArticle, expected_version: int | None = None
) -> KnowledgeArticle:
    """Archiving withdraws an article from grounding IMMEDIATELY.

    Retrieval filters on `published`, so an archived article stops being quotable
    the moment this commits — no cache to invalidate and no index to rebuild.
    """
    require_version(article, expected_version, required=False)
    lock_aggregate(article)
    if article.status == STATUS_ARCHIVED:
        raise DomainConflict("This article is already archived.")

    article.status = STATUS_ARCHIVED
    bump_version(article)
    article.save(update_fields=["status", "version", "updated_at"])
    write_audit(
        workspace=context.workspace,
        actor_membership=context.membership,
        action="knowledge.article_archived",
        target_type="kb_article",
        target_ref=article.public_id,
        changed_fields=["status"],
    )
    return article


__all__ = ["create_article", "update_article", "publish_article", "archive_article"]

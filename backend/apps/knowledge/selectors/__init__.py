"""knowledge read models — including `kb_retrieval`, the grounding source."""

from __future__ import annotations

from ..models import STATUS_PUBLISHED, KnowledgeArticle

MAX_RETRIEVED = 4
MAX_EXCERPT_CHARS = 700


def articles_for(workspace):
    return KnowledgeArticle.objects.filter(workspace=workspace)


def article_payload(article: KnowledgeArticle) -> dict:
    return {
        "article_ref": article.public_id,
        "title": article.title,
        "body": article.body,
        "status": article.status,
        "published_version": article.published_version,
        "published_at": article.published_at,
        "version": article.version,
    }


def kb_retrieval(*, workspace, query: str, limit: int = MAX_RETRIEVED) -> list[dict]:
    """PUBLISHED articles only, workspace-scoped, with citations.

    Two filters here are load-bearing rather than incidental:

    *   **`status='published'`** — a draft is somebody thinking aloud and an
        archived article is a retracted answer. Filtering in the SELECTOR rather
        than in the caller means a future caller cannot forget.
    *   **`workspace`** — grounding context is tenant data. A cross-workspace
        retrieval is not expressible, so one tenant's KB can never end up in
        another tenant's prompt.

    Every row carries the version it was read at, so a citation stays accurate
    after the article changes.
    """
    queryset = articles_for(workspace).filter(status=STATUS_PUBLISHED)

    terms = [term for term in (query or "").split() if len(term) > 2][:5]
    if terms:
        from django.db.models import Q

        matcher = Q()
        for term in terms:
            matcher |= Q(title__icontains=term) | Q(body__icontains=term)
        queryset = queryset.filter(matcher)

    return [
        {
            "article_ref": article.public_id,
            "version": article.published_version or article.version,
            "title": article.title,
            "excerpt": (article.body or "")[:MAX_EXCERPT_CHARS],
        }
        for article in queryset.order_by("-published_at", "-created_at")[:limit]
    ]


__all__ = ["articles_for", "article_payload", "kb_retrieval", "MAX_RETRIEVED"]

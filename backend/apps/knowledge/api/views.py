"""knowledge API — articles."""

from __future__ import annotations

from rest_framework.response import Response

from common.authz import resolve_in_workspace
from common.concurrency import parse_if_match
from common.pagination import paginate
from common.views import WazlinkAPIView

from ..selectors import article_payload, articles_for
from ..services import archive_article, create_article, publish_article, update_article


class ArticleListCreateView(WazlinkAPIView):
    def get(self, request):
        context = self.context(request, "knowledge.view")
        queryset = articles_for(context.workspace)
        if status_filter := request.query_params.get("status"):
            queryset = queryset.filter(status=status_filter)
        items, next_cursor = paginate(queryset, request)
        return Response(
            {"items": [article_payload(a) for a in items], "next_cursor": next_cursor}
        )

    def post(self, request):
        context = self.context(request, "knowledge.manage")
        data = request.data or {}
        article = create_article(context=context, title=data.get("title", ""), body=data.get("body", ""))
        return Response(article_payload(article), status=201)


class ArticleDetailView(WazlinkAPIView):
    def get(self, request, article_ref: str):
        context = self.context(request, "knowledge.view")
        article = resolve_in_workspace(articles_for(context.workspace), context, public_id=article_ref)
        return Response(article_payload(article))

    def patch(self, request, article_ref: str):
        context = self.context(request, "knowledge.manage")
        article = resolve_in_workspace(articles_for(context.workspace), context, public_id=article_ref)
        data = request.data or {}
        article = update_article(
            context=context,
            article=article,
            title=data.get("title", ""),
            body=data.get("body", article.body),
            expected_version=parse_if_match(request),
        )
        return Response(article_payload(article))


class ArticlePublishView(WazlinkAPIView):
    permission_code = "knowledge.manage"

    def post(self, request, article_ref: str):
        context = self.context(request)
        article = resolve_in_workspace(articles_for(context.workspace), context, public_id=article_ref)
        return Response(
            article_payload(
                publish_article(context=context, article=article, expected_version=parse_if_match(request))
            )
        )


class ArticleArchiveView(WazlinkAPIView):
    permission_code = "knowledge.manage"

    def post(self, request, article_ref: str):
        context = self.context(request)
        article = resolve_in_workspace(articles_for(context.workspace), context, public_id=article_ref)
        return Response(
            article_payload(
                archive_article(context=context, article=article, expected_version=parse_if_match(request))
            )
        )


__all__ = ["ArticleListCreateView", "ArticleDetailView", "ArticlePublishView", "ArticleArchiveView"]

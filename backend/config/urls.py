"""Root URLconf. config/ is the COMPOSITION ROOT: it is the only package
permitted to import upward, and it is excluded from the layering walk.
"""

from django.contrib import admin
from django.urls import include, path

from apps.billing.webhooks import tap_webhook
from apps.messaging.webhooks import whatsapp_webhook

from .health import health, ready

urlpatterns = [
    # Webhooks are B12-owned and deliberately NOT under /api/v1/: they are a
    # provider surface with their own authentication (signature verification),
    # not a tenant API surface with session authentication.
    path("webhooks/whatsapp", whatsapp_webhook, name="whatsapp-webhook"),
    path("webhooks/tap", tap_webhook, name="tap-webhook"),
    path("health", health, name="health"),
    path("ready", ready, name="ready"),
    path("admin/", admin.site.urls),
    path("api/v1/", include("config.api_urls")),
]

"""Root URLconf. config/ is the COMPOSITION ROOT: it is the only package
permitted to import upward, and it is excluded from the layering walk.
"""

from django.contrib import admin
from django.urls import include, path

from .health import health, ready

urlpatterns = [
    path("health", health, name="health"),
    path("ready", ready, name="ready"),
    path("admin/", admin.site.urls),
    path("api/v1/", include("config.api_urls")),
]

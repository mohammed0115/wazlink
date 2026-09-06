"""Shared settings. Imports NOTHING environment-specific (B14_29 §5).

No settings module reads a credential VALUE. Secrets are referenced by NAME and
resolved by common.secrets at call time (B14_11 §1).
"""

from __future__ import annotations

import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

from .validation import validate_browser_origin, validate_core

BASE_DIR = Path(__file__).resolve().parent.parent.parent

load_dotenv(BASE_DIR / ".env", override=False)


def env_str(name: str, default: str = "") -> str:
    return os.environ.get(name, default).strip()


def env_bool(name: str, default: bool = False) -> bool:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return raw.strip().lower() in ("1", "true", "yes", "on")


def env_list(name: str, default: str = "") -> list[str]:
    raw = os.environ.get(name, default)
    return [item.strip() for item in raw.split(",") if item.strip()]


# --------------------------------------------------------------------------
# Environment identity — independently required and validated. A mismatch with
# the loaded settings module fails closed at startup (B14_29 §5).
# --------------------------------------------------------------------------
ENVIRONMENT = env_str("ENVIRONMENT", "local")

SECRET_KEY = env_str("DJANGO_SECRET_KEY")
DEBUG = False  # base.py carries no production-unsafe default; only local.py may set True.
ALLOWED_HOSTS = env_list("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1")

DATABASE_URL = env_str("DATABASE_URL")
REDIS_URL = env_str("REDIS_URL")

validate_core(
    environment=ENVIRONMENT,
    secret_key=SECRET_KEY,
    debug=env_bool("DJANGO_DEBUG", False),
    allowed_hosts=ALLOWED_HOSTS,
    database_url=DATABASE_URL,
    redis_url=REDIS_URL,
)

# --------------------------------------------------------------------------
# Browser origin contract — validated fail-closed for EVERY environment
# including test (B14_11 §3).
# --------------------------------------------------------------------------
BROWSER_TOPOLOGY = env_str("BROWSER_TOPOLOGY", "same_origin")
FRONTEND_ORIGINS = env_list("FRONTEND_ORIGINS")
CORS_ALLOW_ALL_ORIGINS = env_bool("CORS_ALLOW_ALL_ORIGINS", False)

CORS_ALLOWED_ORIGINS, CORS_ALLOW_CREDENTIALS = validate_browser_origin(
    environment=ENVIRONMENT,
    topology=BROWSER_TOPOLOGY,
    frontend_origins=FRONTEND_ORIGINS,
    cors_allow_all=CORS_ALLOW_ALL_ORIGINS,
)

CSRF_TRUSTED_ORIGINS = list(FRONTEND_ORIGINS)

# Trust boundary: safe default is to trust NO forwarded header (B14_31 §5).
TRUSTED_PROXY_COUNT = int(env_str("TRUSTED_PROXY_COUNT", "0") or "0")

# --------------------------------------------------------------------------
# Applications — 26-module ownership map (B14_03 §3). Wave 1 installs the
# modules its slices own; later waves add theirs without moving a layer.
# --------------------------------------------------------------------------
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "rest_framework",
    "corsheaders",
]

# Layer order is documentation for readers; enforcement is T-ARCH-1.
LOCAL_APPS = [
    "config.apps.CompositionRootConfig",  # composition root — registers providers
    "apps.accounts",  # L1
    "apps.identity_access",  # L2
    "apps.workspaces",  # L2
    "apps.entitlements",  # L3
    "apps.files",  # L3
    "apps.platform_async",  # L3
    "apps.auditlog",  # L3
    "apps.customfields",  # L3
    "apps.identity",  # L4
    "apps.discovery",  # L4
    "apps.billing",  # L4
    "apps.assignment",  # L4
    "apps.knowledge",  # L4
    "apps.crm",  # L5
    "apps.tax",  # L5
    "apps.customers",  # L6
    "apps.intelligence",  # L6
    "apps.messaging",  # L6
    "apps.pipeline",  # L7
    "apps.revenue",  # L7
    "apps.imports",  # L8
    "apps.aiagent",  # L8
    "apps.automation",  # L9
    "apps.analytics",  # L10 — owns no table
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

# CorsMiddleware must precede CommonMiddleware and every auth/CSRF middleware
# (B14_29 §5; T-TOOL-7). A misplaced entry is a rejection ground.
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "common.middleware.RequestContextMiddleware",
    "common.middleware.IdempotencyMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

DATABASES = {
    "default": dj_database_url.parse(DATABASE_URL, conn_max_age=600),
}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator", "OPTIONS": {"min_length": 12}},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
    "staticfiles": {"BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage"},
}

# --------------------------------------------------------------------------
# Session / CSRF — frozen B13 §6 values, carried unchanged.
# SESSION_COOKIE_SAMESITE="Lax" is INVARIANT (FI-B1-01).
# --------------------------------------------------------------------------
SESSION_COOKIE_NAME = "wazlink_session"
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
SESSION_COOKIE_SECURE = ENVIRONMENT in ("staging", "production")
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SECURE = ENVIRONMENT in ("staging", "production")

SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_REFERRER_POLICY = "same-origin"
X_FRAME_OPTIONS = "DENY"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "common.authentication.WazlinkSessionAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.AllowAny"],
    "EXCEPTION_HANDLER": "common.errors.wazlink_exception_handler",
    "UNAUTHENTICATED_USER": None,
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
}

# --------------------------------------------------------------------------
# Celery — the FIVE frozen queues only. No sixth (B14_09 §1).
# --------------------------------------------------------------------------
CELERY_BROKER_URL = env_str("CELERY_BROKER_URL") or REDIS_URL
CELERY_RESULT_BACKEND = None
CELERY_TASK_SERIALIZER = "json"  # JSON only (B13-X-007)
CELERY_RESULT_SERIALIZER = "json"
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TIMEZONE = "UTC"
CELERY_QUEUES_FROZEN = ("default", "providers.fast", "providers.slow", "webhooks", "maintenance")

# Provider credential REFERENCE NAMES. Never a value (B14_11 §1).
PROVIDER_CREDENTIAL_REFS = {
    "whatsapp": ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_APP_SECRET"],
    "openai": ["OPENAI_API_KEY"],
    "places": ["GOOGLE_PLACES_API_KEY"],
    "scraping": ["SCRAPING_API_KEY", "SCRAPING_WEBHOOK_SECRET"],
    "tap": ["TAP_SECRET_KEY", "TAP_WEBHOOK_SECRET"],
}

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {"redaction": {"()": "common.logging.RedactionFilter"}},
    "formatters": {"json": {"()": "common.logging.JsonFormatter"}},
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
            "formatter": "json",
            "filters": ["redaction"],
        }
    },
    "root": {"handlers": ["console"], "level": "INFO"},
}


# --------------------------------------------------------------------------
# Provider adapter selection (B14_16 §1, B14_14 §8, B14_15).
#
# CONFIGURATION, not a test flag. `config/registry.py` reads this to decide
# which implementation to bind behind each provider port. A domain service never
# asks whether it is running under test — that would be exactly the
# `if TESTING:` business logic the SOLID/LSP requirement forbids.
#
# Deliberately DEFAULT FALSE: a deployment that forgets to configure a provider
# gets `not_configured` and a degraded feature, never a stub silently answering
# as though it were a real provider.
# --------------------------------------------------------------------------
USE_STUB_PROVIDERS = env_bool("USE_STUB_PROVIDERS", False)

# How a registered task NAME is delivered: 'celery' (deployed) | 'recorded'
# (tests enqueue through the real command path and drive the worker explicitly).
TASK_EXECUTION = env_str("TASK_EXECUTION", "celery")

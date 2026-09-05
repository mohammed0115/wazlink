"""Fail-closed startup validation (B14_11 §3, B13 configuration management).

Two tiers:
  1. Platform-critical  -> the process REFUSES TO START.
  2. Provider           -> the process starts; the connection reports not_configured.

A validation message may name THE VARIABLE, never its value and never a
fragment of it (T-ENV-2).
"""

from __future__ import annotations

KNOWN_DEFAULT_SECRETS = frozenset(
    {
        "changeme",
        "secret",
        "django-insecure",
        "your-secret-key",
        "",
    }
)

VALID_ENVIRONMENTS = ("local", "test", "staging", "production")
VALID_TOPOLOGIES = ("same_origin", "same_site_subdomain", "cross_site")


class ConfigurationError(Exception):
    """Raised when platform-critical configuration is missing or unsafe.

    The message names variables only — never values (T-ENV-2).
    """


def _fail(problems: list[str]) -> None:
    if problems:
        raise ConfigurationError(
            "Fail-closed startup validation refused this configuration: " + "; ".join(problems)
        )


def validate_core(
    *,
    environment: str,
    secret_key: str,
    debug: bool,
    allowed_hosts: list[str],
    database_url: str,
    redis_url: str,
) -> None:
    """Platform-critical tier. Names variables only."""
    problems: list[str] = []

    if environment not in VALID_ENVIRONMENTS:
        problems.append("ENVIRONMENT must be one of local|test|staging|production")

    is_prod_like = environment in ("staging", "production")

    if not secret_key or len(secret_key) < 50:
        problems.append("DJANGO_SECRET_KEY must be set and at least 50 characters")
    elif any(secret_key.lower().startswith(d) for d in KNOWN_DEFAULT_SECRETS if d):
        problems.append("DJANGO_SECRET_KEY must not be a known default value")

    if debug and is_prod_like:
        problems.append("DJANGO_DEBUG must be False in staging and production")

    if not allowed_hosts:
        problems.append("DJANGO_ALLOWED_HOSTS must be set and non-empty")
    elif is_prod_like and "*" in allowed_hosts:
        problems.append("DJANGO_ALLOWED_HOSTS must not contain a wildcard in staging or production")

    if not database_url:
        problems.append("DATABASE_URL must be set")
    elif not database_url.startswith(("postgres://", "postgresql://")):
        problems.append("DATABASE_URL must be a PostgreSQL URL")

    if not redis_url:
        problems.append("REDIS_URL must be set")

    _fail(problems)


def validate_browser_origin(
    *, environment: str, topology: str, frontend_origins: list[str], cors_allow_all: bool
) -> tuple[list[str], bool]:
    """Browser-origin fail-closed rules (B14_11 §3, closing F-02).

    Returns (cors_allowed_origins, cors_allow_credentials).
    """
    problems: list[str] = []
    is_prod_like = environment in ("staging", "production")

    if topology not in VALID_TOPOLOGIES:
        problems.append("BROWSER_TOPOLOGY must be one of same_origin|same_site_subdomain|cross_site")
        _fail(problems)

    # Rule 1: a wildcard is correct in NO environment.
    if cors_allow_all:
        problems.append("CORS_ALLOW_ALL_ORIGINS must be absent or False in every environment")

    # Rule: cross_site is unsupported in staging/production — it would require
    # changing the frozen SESSION_COOKIE_SAMESITE="Lax" invariant (FI-B1-01).
    if topology == "cross_site" and is_prod_like:
        problems.append("BROWSER_TOPOLOGY=cross_site is refused in staging and production")

    for origin in frontend_origins:
        # Rule 2: '*' enforced on the value as well as the flag.
        if "*" in origin:
            problems.append("FRONTEND_ORIGINS must not contain a wildcard entry")
        elif not origin.startswith(("http://", "https://")):
            problems.append("FRONTEND_ORIGINS entries must be full origins including a scheme")
        elif is_prod_like and not origin.startswith("https://"):
            problems.append("FRONTEND_ORIGINS entries must use https in staging and production")
        elif origin.rstrip("/").count("/") != 2:
            problems.append("FRONTEND_ORIGINS entries must be scheme://host[:port] with no path")

    if topology == "same_origin":
        # No cross-origin request exists: empty list, credentials off.
        cors_allowed_origins: list[str] = []
        cors_allow_credentials = False
    else:
        if not frontend_origins:
            problems.append(
                "FRONTEND_ORIGINS must be a non-empty explicit allow-list "
                "when BROWSER_TOPOLOGY is not same_origin"
            )
        cors_allowed_origins = list(frontend_origins)
        # Credentials only with a non-empty explicit allow-list.
        cors_allow_credentials = bool(frontend_origins)

    _fail(problems)
    return cors_allowed_origins, cors_allow_credentials

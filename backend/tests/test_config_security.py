"""T-ENV-* / T-CORS-* / T-PROXY-* / T-TOOL-* — configuration security gates."""

from __future__ import annotations

import pytest

from config.settings.validation import (
    ConfigurationError,
    validate_browser_origin,
    validate_core,
)

GOOD_SECRET = "x" * 60


def _core(**overrides):
    kwargs = dict(
        environment="production",
        secret_key=GOOD_SECRET,
        debug=False,
        allowed_hosts=["wazlink.example"],
        database_url="postgres://u:p@h/db",
        redis_url="redis://h:6379/0",
    )
    kwargs.update(overrides)
    return kwargs


# --------------------------- core, fail-closed ----------------------------


def test_env_1_valid_production_config_passes():
    validate_core(**_core())


@pytest.mark.security
def test_debug_true_in_production_fails_closed():
    with pytest.raises(ConfigurationError, match="DJANGO_DEBUG"):
        validate_core(**_core(debug=True))


@pytest.mark.security
def test_wildcard_allowed_hosts_in_production_fails_closed():
    with pytest.raises(ConfigurationError, match="DJANGO_ALLOWED_HOSTS"):
        validate_core(**_core(allowed_hosts=["*"]))


@pytest.mark.security
def test_short_secret_key_fails_closed():
    with pytest.raises(ConfigurationError, match="DJANGO_SECRET_KEY"):
        validate_core(**_core(secret_key="tooshort"))


@pytest.mark.security
def test_sqlite_database_url_is_refused():
    """PostgreSQL is the implementation truth; SQLite is never silently used."""
    with pytest.raises(ConfigurationError, match="DATABASE_URL"):
        validate_core(**_core(database_url="sqlite:///db.sqlite3"))


@pytest.mark.security
def test_env_2_validation_message_names_the_variable_never_its_value():
    """A validation message may name THE VARIABLE, never its value."""
    secret = "SUPER-SECRET-LITERAL-VALUE-THAT-MUST-NOT-LEAK"
    try:
        validate_core(**_core(secret_key=secret[:10]))
    except ConfigurationError as exc:
        assert "DJANGO_SECRET_KEY" in str(exc)
        assert secret[:10] not in str(exc)
    else:
        pytest.fail("expected a ConfigurationError")


# --------------------------- browser origin -------------------------------


@pytest.mark.security
@pytest.mark.parametrize("environment", ["local", "test", "staging", "production"])
def test_cors_1_wildcard_flag_is_refused_in_every_environment(environment):
    """There is NO environment in which a wildcard is correct."""
    with pytest.raises(ConfigurationError, match="CORS_ALLOW_ALL_ORIGINS"):
        validate_browser_origin(
            environment=environment,
            topology="same_origin",
            frontend_origins=[],
            cors_allow_all=True,
        )


@pytest.mark.security
def test_cors_2_wildcard_value_is_refused_on_the_value_too():
    with pytest.raises(ConfigurationError, match="FRONTEND_ORIGINS"):
        validate_browser_origin(
            environment="staging",
            topology="same_site_subdomain",
            frontend_origins=["https://*.example.com"],
            cors_allow_all=False,
        )


@pytest.mark.security
def test_cors_3_cross_site_is_refused_in_staging_and_production():
    """cross_site would require changing the frozen SameSite=Lax invariant."""
    for environment in ("staging", "production"):
        with pytest.raises(ConfigurationError, match="cross_site"):
            validate_browser_origin(
                environment=environment,
                topology="cross_site",
                frontend_origins=["https://app.example.com"],
                cors_allow_all=False,
            )


def test_cors_4_same_origin_yields_empty_list_and_no_credentials():
    origins, credentials = validate_browser_origin(
        environment="production",
        topology="same_origin",
        frontend_origins=[],
        cors_allow_all=False,
    )
    assert origins == []
    assert credentials is False


def test_cors_5_cross_site_permitted_locally_with_explicit_list():
    origins, credentials = validate_browser_origin(
        environment="local",
        topology="cross_site",
        frontend_origins=["http://localhost:5173"],
        cors_allow_all=False,
    )
    assert origins == ["http://localhost:5173"]
    assert credentials is True


@pytest.mark.security
def test_cors_6_non_same_origin_requires_a_non_empty_list():
    with pytest.raises(ConfigurationError, match="FRONTEND_ORIGINS"):
        validate_browser_origin(
            environment="staging",
            topology="same_site_subdomain",
            frontend_origins=[],
            cors_allow_all=False,
        )


@pytest.mark.security
def test_cors_7_http_origin_refused_in_production():
    with pytest.raises(ConfigurationError, match="https"):
        validate_browser_origin(
            environment="staging",
            topology="same_site_subdomain",
            frontend_origins=["http://app.example.com"],
            cors_allow_all=False,
        )


# --------------------------- middleware order -----------------------------


@pytest.mark.security
def test_tool_7_cors_middleware_precedes_common_and_auth():
    from django.conf import settings

    order = list(settings.MIDDLEWARE)
    cors = order.index("corsheaders.middleware.CorsMiddleware")
    common = order.index("django.middleware.common.CommonMiddleware")
    csrf = order.index("django.middleware.csrf.CsrfViewMiddleware")
    auth = order.index("django.contrib.auth.middleware.AuthenticationMiddleware")
    assert cors < common and cors < csrf and cors < auth


def test_session_cookie_samesite_is_the_frozen_lax_invariant():
    from django.conf import settings

    assert settings.SESSION_COOKIE_SAMESITE == "Lax"


def test_only_the_five_frozen_queues_are_declared():
    """Five frozen queues. No sixth."""
    from config.celery import FROZEN_QUEUES

    assert FROZEN_QUEUES == ("default", "providers.fast", "providers.slow", "webhooks", "maintenance")
    assert len(FROZEN_QUEUES) == 5


# --------------------------- trust boundary -------------------------------


@pytest.mark.security
def test_proxy_default_ignores_forwarded_headers():
    """Safe default: TRUSTED_PROXY_COUNT=0 means a forwarded header is ignored."""
    from django.test import RequestFactory

    from common.net import client_ip

    request = RequestFactory().get("/")
    request.META["REMOTE_ADDR"] = "10.0.0.9"
    request.META["HTTP_X_FORWARDED_FOR"] = "1.2.3.4, 5.6.7.8"
    assert client_ip(request) == "10.0.0.9"


@pytest.mark.nc
def test_proxy_detector_reads_forwarded_only_when_trusted(settings):
    from django.test import RequestFactory

    from common.net import client_ip

    settings.TRUSTED_PROXY_COUNT = 1
    request = RequestFactory().get("/")
    request.META["REMOTE_ADDR"] = "10.0.0.9"
    request.META["HTTP_X_FORWARDED_FOR"] = "1.2.3.4, 5.6.7.8"
    assert client_ip(request) == "5.6.7.8"


# --------------------------- secret handling ------------------------------


@pytest.mark.security
def test_wave1_requires_no_provider_credential():
    """EXPECTED: NONE. Wave 1 must run with every provider credential absent."""
    from common.secrets import provider_status

    for refs in (["OPENAI_API_KEY"], ["WHATSAPP_ACCESS_TOKEN"], ["GOOGLE_PLACES_API_KEY"]):
        assert provider_status(refs) in ("not_configured", "configured")


@pytest.mark.security
def test_redaction_processor_strips_secrets_from_logs():
    from common.logging import redact_mapping, redact_text

    assert redact_mapping({"api_key": "sk-live-123"})["api_key"] == "[REDACTED]"
    assert "sk-liveabcdef1234567890" not in redact_text("token sk-liveabcdef1234567890")
    assert "a@b.com" not in redact_text("contact a@b.com now")

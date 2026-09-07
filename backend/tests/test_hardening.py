"""I15 — Security / Operations hardening.

I15 adds **no capability**: no module, no model, no migration, no endpoint, no
command and no permission. It proves what the earlier slices built.

Frozen sources: B13 throughout, with `B13_ACCEPTANCE_TESTS` and
`B13_VERIFICATION_MATRIX` as the checklist, plus `B14_33` §5's provider
re-verification cycle and `B14_34`'s supply-chain baseline.
"""

from __future__ import annotations

import ast
import json
import pathlib

import pytest

from common import rate_limit
from common.logging import redact_mapping, redact_text

pytestmark = pytest.mark.django_db(transaction=True)

BACKEND = pathlib.Path(__file__).resolve().parent.parent
SENTINEL = "sk_live_SENTINELSECRET0123456789"


@pytest.fixture(autouse=True)
def _clean_limiter():
    rate_limit.reset()
    yield
    rate_limit.reset()


# ---------------------------------------------------------------- T-SEC redaction
def test_t_sec_1_redaction_covers_keys_and_value_shapes():
    redacted = redact_mapping(
        {
            "api_key": SENTINEL,
            "Authorization": "Bearer abcdefghijklmnop",
            "nested": {"password": "hunter2", "note": "reach me at a@b.com"},
            "phone": "+966 50 123 4567",
            "safe": "ordinary text",
        }
    )
    blob = json.dumps(redacted)
    assert SENTINEL not in blob
    assert "hunter2" not in blob
    assert "a@b.com" not in blob
    assert "ordinary text" in blob  # redaction is targeted, not indiscriminate


# The credential SHAPES WazLink actually carries, per the `.env` contract.
# Dummy values only — no real credential appears in this repository.
VENDOR_CANARIES = {
    "tap_secret_key": "sk_live_EXAMPLECANARY0123456789",
    "openai_api_key": "sk-proj-EXAMPLECANARY0123456789",
    "whatsapp_access_token": "EAAGEXAMPLECANARYabcdefghijklmnopqrstuvwxyz0123456789",
    "google_places_api_key": "AIzaEXAMPLECANARYabcdefghijklmnopqrstuv",
    "aws_key": "AKIAEXAMPLECANARY123",
    "slack_token": "xoxb-EXAMPLECANARY-1234567890-abcdef",
    "bearer": "Bearer EXAMPLE.CANARY-1234567890",
}


@pytest.mark.parametrize("name", sorted(VENDOR_CANARIES))
def test_t_sec_1_value_shaped_redaction_covers_every_vendor_credential(name):
    """Every credential in the `.env` contract, redacted WHOLE.

    Meta (`EAA…`) and Google (`AIza…`) are the two the value-shaped net used to
    miss, and they are exactly the two WazLink's own provider adapters carry.
    A prefix-only redaction is not redaction: the assertion below rejects any
    surviving twelve-character run of the secret, not merely the whole string.
    """
    secret = VENDOR_CANARIES[name]
    redacted = redact_text(f"provider call failed with {secret} at the boundary")
    assert secret not in redacted
    fragments = [secret[i : i + 12] for i in range(0, max(1, len(secret) - 12))]
    assert not any(fragment in redacted for fragment in fragments)


def test_t_sec_1_redaction_does_not_swallow_ordinary_business_text():
    """The widened patterns must stay targeted, not indiscriminate."""
    for benign in (
        "AIza",  # too short to be a key
        "EAA",  # a bare acronym
        "The customer said EAA was fine",
        "Riyadh branch, order 12345, total 299.00 SAR",
        "nothing sensitive here",
    ):
        assert redact_text(benign) == benign


def test_t_sec_2_redaction_reaches_every_outbound_class(actor):
    """Logs, audit rows, outbox payloads and task payloads — all of them."""
    from apps.auditlog.models import AuditLog
    from apps.platform_async.models import OutboxEvent
    from common.audit import write_audit
    from common.outbox import publish_event

    a = actor()
    write_audit(
        workspace=a.workspace,
        actor_membership=a.membership,
        action="test.redaction",
        target_type="test",
        target_ref="x",
        metadata={"api_key": SENTINEL, "note": f"used {SENTINEL}"},
    )
    publish_event(
        workspace=a.workspace,
        event_type="TestRedaction",
        aggregate_type="test",
        aggregate_ref="x",
        payload={"token": SENTINEL, "detail": f"token {SENTINEL}"},
    )

    for row in AuditLog.objects.all():
        assert SENTINEL not in json.dumps(row.metadata), "a secret reached an audit row"
    for event in OutboxEvent.objects.all():
        assert SENTINEL not in json.dumps(event.payload), "a secret reached the outbox"


def test_t_sec_3_no_credential_value_is_stored_in_any_column():
    """Every provider credential is a reference NAME resolved at call time."""
    from django.db import connection

    with connection.cursor() as cursor:
        cursor.execute(
            """SELECT table_name, column_name FROM information_schema.columns
               WHERE table_schema='public'
                 AND (column_name ILIKE '%%secret%%' OR column_name ILIKE '%%api_key%%'
                      OR column_name ILIKE '%%access_token%%' OR column_name ILIKE '%%private_key%%'
                      OR column_name ILIKE '%%password%%')"""
        )
        found = cursor.fetchall()
    # Three shapes are legitimate, and each for a different reason:
    #   `*_secret_ref` / `*_refs` — a reference NAME resolved from the
    #        environment at call time (B14_13), which is the opposite of a
    #        stored credential;
    #   `*_hash`                  — a one-way digest, not a recoverable value;
    #   `users.password`          — Django's own column, which stores a hash.
    # Anything else matching is a real leak.
    def permitted(table: str, column: str) -> bool:
        return (
            column.endswith(("_secret_ref", "_refs", "_hash"))
            or (table, column) == ("users", "password")
        )

    offenders = [(t, c) for t, c in found if not permitted(t, c)]
    assert offenders == [], f"a credential-shaped column exists: {offenders}"

    # And the control is not vacuous: it really did see the columns it allowed.
    assert found, "the credential-column scan matched nothing at all"


def test_t_sec_4_no_secret_appears_on_any_operator_surface(actor, monkeypatch):
    from apps.platform_async.selectors import integration_payload
    from apps.platform_async.services import check_provider_configuration

    monkeypatch.setenv("WHATSAPP_ACCESS_TOKEN", SENTINEL)
    a = actor()
    payload = integration_payload(check_provider_configuration(context=a.context, provider="whatsapp"))
    assert SENTINEL not in json.dumps(payload, default=str)
    # Reference NAMES, never values.
    assert all(ref.isupper() or "_" in ref for ref in payload["credential_refs"])


def test_t_sec_5_no_provider_secret_is_hardcoded_in_source():
    """Static scan over everything that ships."""
    import re

    patterns = [
        re.compile(r"\bsk-[A-Za-z0-9]{20,}"),
        re.compile(r"\bsk_live_[A-Za-z0-9]{16,}"),
        re.compile(r"\bAKIA[0-9A-Z]{16}\b"),
        re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----"),
        re.compile(r"\bxox[baprs]-[A-Za-z0-9-]{20,}"),
    ]
    offenders = []
    for path in list((BACKEND / "apps").rglob("*.py")) + list((BACKEND / "common").rglob("*.py")) + list(
        (BACKEND / "adapters").rglob("*.py")
    ) + list((BACKEND / "config").rglob("*.py")):
        text = path.read_text()
        for pattern in patterns:
            if pattern.search(text):
                offenders.append(f"{path.name}: {pattern.pattern}")
    assert offenders == [], f"a credential-shaped literal ships in source: {offenders}"


# ---------------------------------------------------------------- rate limits
def test_the_rate_limit_classes_are_separate_budgets():
    """Exhausting one class must not consume another's.

    If they shared a bucket, an attacker could burn the login limiter with
    harmless reads — or hide credential stuffing inside ordinary traffic.
    """
    key = "actor-1"
    budget = rate_limit.BUDGETS[rate_limit.CLASS_LOGIN]
    for _ in range(budget.limit):
        assert rate_limit.check(rate_limit.CLASS_LOGIN, key).allowed

    exhausted = rate_limit.check(rate_limit.CLASS_LOGIN, key)
    assert exhausted.allowed is False
    assert exhausted.retry_after_seconds >= 1

    # Every OTHER class is untouched.
    for other in rate_limit.RATE_LIMIT_CLASSES:
        if other == rate_limit.CLASS_LOGIN:
            continue
        assert rate_limit.check(other, key).allowed is True, f"{other} shared the login budget"


def test_rate_limit_keys_do_not_bleed_between_subjects():
    for _ in range(rate_limit.BUDGETS[rate_limit.CLASS_LOGIN].limit):
        rate_limit.check(rate_limit.CLASS_LOGIN, "victim")
    assert rate_limit.check(rate_limit.CLASS_LOGIN, "victim").allowed is False
    # A second subject is unaffected — one account cannot lock out another.
    assert rate_limit.check(rate_limit.CLASS_LOGIN, "bystander").allowed is True


def test_an_unknown_rate_limit_class_is_refused_not_defaulted():
    with pytest.raises(ValueError):
        rate_limit.check("made_up_class", "k")


def test_every_frozen_rate_limit_class_has_a_budget():
    assert set(rate_limit.BUDGETS) == set(rate_limit.RATE_LIMIT_CLASSES)
    for name, budget in rate_limit.BUDGETS.items():
        assert budget.limit > 0 and budget.window_seconds > 0, name


def test_no_rate_limit_decision_is_backed_by_a_database_table():
    """A limiter is not business truth, and must not pretend to be."""
    source = (BACKEND / "common" / "rate_limit.py").read_text()
    for forbidden in ("models.", "objects.", "select_for_update", "transaction"):
        assert forbidden not in source, f"the limiter reaches the database: {forbidden}"


# ---------------------------------------------------------------- headers/CORS
def test_t_cors_no_wildcard_origin_is_ever_configured():
    from django.conf import settings

    assert getattr(settings, "CORS_ALLOW_ALL_ORIGINS", False) is False
    for origin in getattr(settings, "CORS_ALLOWED_ORIGINS", []):
        assert "*" not in origin


def test_security_headers_are_set(actor, auth_client):
    a = actor()
    response = auth_client(a).get("/api/v1/billing/subscription")
    from django.conf import settings

    assert settings.SECURE_CONTENT_TYPE_NOSNIFF is True
    assert settings.X_FRAME_OPTIONS == "DENY"
    assert settings.SESSION_COOKIE_HTTPONLY is True
    # The frozen SameSite invariant (FI-B1-01).
    assert settings.SESSION_COOKIE_SAMESITE == "Lax"
    assert response.status_code == 200


def test_t_proxy_a_forged_forwarded_header_influences_nothing(settings):
    """`B14_31` §5, exercised rather than grepped."""
    from common.net import client_ip

    class FakeRequest:
        def __init__(self, meta):
            self.META = meta

    forged = FakeRequest(
        {"REMOTE_ADDR": "10.0.0.9", "HTTP_X_FORWARDED_FOR": "1.2.3.4, 5.6.7.8"}
    )

    # The safe default trusts NO hop, so the forged header decides nothing.
    settings.TRUSTED_PROXY_COUNT = 0
    assert client_ip(forged) == "10.0.0.9"

    # With one hop trusted, the RIGHTMOST hop is taken — never the leftmost,
    # which is the value an attacker controls.
    settings.TRUSTED_PROXY_COUNT = 1
    assert client_ip(forged) == "5.6.7.8"
    assert client_ip(forged) != "1.2.3.4"


def test_only_one_forwarded_header_parser_exists():
    """A second parser is a second place to get the trust bound wrong."""
    parsers = [
        str(path.relative_to(BACKEND))
        for path in list((BACKEND / "common").rglob("*.py"))
        + list((BACKEND / "apps").rglob("*.py"))
        + list((BACKEND / "config").rglob("*.py"))
        if "HTTP_X_FORWARDED_FOR" in path.read_text()
    ]
    assert parsers == ["common/net.py"], f"more than one forwarded-header parser: {parsers}"


# ---------------------------------------------------------------- provider facts
def test_the_meta_graph_default_is_a_supported_version():
    """`B14_33` §5 re-verification. `v21.0` expires 2027-01-21."""
    from adapters.whatsapp import DEFAULT_GRAPH_VERSION

    major = int(DEFAULT_GRAPH_VERSION.lstrip("v").split(".")[0])
    assert major >= 25, f"the Graph API default {DEFAULT_GRAPH_VERSION} is too old to ship"


def test_the_graph_version_stays_environment_overridable():
    source = (BACKEND / "adapters" / "whatsapp" / "__init__.py").read_text()
    assert 'WHATSAPP_GRAPH_VERSION' in source, "the version override was removed"


def test_every_adapter_reports_not_configured_rather_than_crashing(monkeypatch):
    """Absent credentials never crash and never fabricate a value."""
    from adapters.storage import LocalObjectStorageAdapter
    from adapters.tap import TapAdapter
    from adapters.whatsapp import MetaWhatsAppAdapter

    for name in (
        "TAP_SECRET_KEY", "FILE_STORAGE_ROOT", "WHATSAPP_ACCESS_TOKEN",
        "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_BUSINESS_ACCOUNT_ID",
        "WHATSAPP_APP_SECRET", "WHATSAPP_VERIFY_TOKEN",
    ):
        monkeypatch.delenv(name, raising=False)

    for adapter in (TapAdapter(), LocalObjectStorageAdapter(), MetaWhatsAppAdapter()):
        status = adapter.status()
        assert status.status == "not_configured"
        assert status.configuration_valid is False
        # Reference NAMES are still reported — that is what an operator needs.
        assert status.credential_refs


def test_an_unconfigured_tap_adapter_verifies_no_webhook():
    """Fail closed: unconfigured verifies NOTHING, it never returns True."""
    import os

    from adapters.tap import TapAdapter

    previous = os.environ.pop("TAP_SECRET_KEY", None)
    try:
        assert TapAdapter().verify_webhook(raw_body=b"{}", headers={"hashstring": "x"}) is False
    finally:
        if previous is not None:
            os.environ["TAP_SECRET_KEY"] = previous


# ---------------------------------------------------------------- supply chain
def test_t_sup_the_production_image_ships_no_dev_dependency():
    """`uv sync --frozen --no-dev` — the test and lint toolchain never ships."""
    dockerfile = (BACKEND / "Dockerfile").read_text()
    assert "--no-dev" in dockerfile, "the production image would ship dev dependencies"
    assert "--frozen" in dockerfile, "a stale lock would not fail the build"
    # And it runs as a non-root user.
    assert "USER 10001" in dockerfile


def test_t_sup_adapters_introduce_no_new_dependency():
    """`B14_34`. Every adapter is stdlib-only over the shared HTTP helper."""
    import tomllib

    declared = tomllib.loads((BACKEND / "pyproject.toml").read_text())
    runtime = {d.split(">")[0].split("[")[0].strip() for d in declared["project"]["dependencies"]}

    third_party = set()
    for path in (BACKEND / "adapters").rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            names = []
            if isinstance(node, ast.Import):
                names = [a.name.split(".")[0] for a in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
                names = [node.module.split(".")[0]]
            third_party.update(names)

    stdlib_and_local = {
        "__future__", "hashlib", "hmac", "json", "os", "urllib", "datetime", "typing",
        "dataclasses", "pathlib", "re", "time", "adapters", "common", "django", "secrets",
    }
    unexpected = third_party - stdlib_and_local - runtime
    assert unexpected == set(), f"an adapter introduced a new dependency: {unexpected}"


def test_no_wave3_module_imports_a_vendor_sdk():
    """No domain reaches a vendor SDK; every one goes through a port."""
    forbidden_roots = {"stripe", "boto3", "botocore", "sentry_sdk", "opentelemetry", "requests", "httpx"}
    offenders = []
    for path in (BACKEND / "apps").rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            names = []
            if isinstance(node, ast.Import):
                names = [a.name.split(".")[0] for a in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module and node.level == 0:
                names = [node.module.split(".")[0]]
            for name in names:
                if name in forbidden_roots:
                    offenders.append(f"{path.relative_to(BACKEND)}: {name}")
    assert offenders == [], f"a domain module imports a vendor SDK: {offenders}"


# ---------------------------------------------------------------- escape hatches
def test_no_dynamic_import_bypasses_the_dependency_graph():
    """`importlib`/`__import__` would make the layering walk a lie."""
    offenders = []
    for path in (BACKEND / "apps").rglob("*.py"):
        tree = ast.parse(path.read_text())
        for node in ast.walk(tree):
            if isinstance(node, ast.Name) and node.id == "__import__":
                offenders.append(f"{path.relative_to(BACKEND)}: __import__")
            if isinstance(node, ast.Import) and any(a.name == "importlib" for a in node.names):
                offenders.append(f"{path.relative_to(BACKEND)}: importlib")
            if isinstance(node, ast.ImportFrom) and (node.module or "").startswith("importlib"):
                offenders.append(f"{path.relative_to(BACKEND)}: importlib")
            if isinstance(node, ast.Attribute) and node.attr in ("get_model", "import_module"):
                # `apps.get_model` is legitimate INSIDE a migration only.
                if "migrations" not in str(path):
                    offenders.append(f"{path.relative_to(BACKEND)}: .{node.attr}")
    assert offenders == [], f"a dynamic-import escape hatch exists: {offenders}"


def test_common_imports_no_app_and_apps_import_no_config():
    """The two boundary counters, asserted directly rather than inferred."""
    common_to_apps, apps_to_config = [], []
    for path in (BACKEND / "common").rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            module = node.module if isinstance(node, ast.ImportFrom) else ""
            if module and module.startswith("apps"):
                common_to_apps.append(str(path.relative_to(BACKEND)))
    for path in (BACKEND / "apps").rglob("*.py"):
        for node in ast.walk(ast.parse(path.read_text())):
            module = node.module if isinstance(node, ast.ImportFrom) else ""
            if module and module.startswith("config"):
                apps_to_config.append(str(path.relative_to(BACKEND)))
    assert common_to_apps == [], f"COMMON_TO_APPS_EDGE_COUNT != 0: {common_to_apps}"
    assert apps_to_config == [], f"APPS_TO_CONFIG_EDGE_COUNT != 0: {apps_to_config}"


# ---------------------------------------------------------------- non-vacuity
def test_the_redaction_detector_is_not_vacuous():
    """A detector that never fires proves nothing."""
    assert redact_text(f"key {SENTINEL}") != f"key {SENTINEL}"
    assert "[REDACTED" in redact_text("mail me at person@example.com")
    # And it leaves innocuous text alone, so it is not just blanking everything.
    assert redact_text("nothing sensitive here") == "nothing sensitive here"


def test_the_secret_scanner_is_not_vacuous(tmp_path):
    import re

    probe = tmp_path / "probe.py"
    probe.write_text('KEY = "sk_live_ABCDEFGHIJKLMNOPQRST"\n')
    assert re.search(r"\bsk_live_[A-Za-z0-9]{16,}", probe.read_text())


def test_the_dependency_scanner_is_not_vacuous(tmp_path):
    probe = tmp_path / "probe.py"
    probe.write_text("import boto3\n")
    found = [
        a.name.split(".")[0]
        for node in ast.walk(ast.parse(probe.read_text()))
        if isinstance(node, ast.Import)
        for a in node.names
    ]
    assert "boto3" in found


@pytest.mark.parametrize("name", sorted(VENDOR_CANARIES))
def test_every_vendor_canary_is_absent_from_every_sink(actor, name):
    """The widened patterns, exercised through the real sinks — not the regex.

    Audit metadata, outbox payloads and the log handler each carry the canary
    in a NON-sensitive key name, so only the value-shaped net can catch it.
    """
    import logging

    from apps.auditlog.models import AuditLog
    from apps.platform_async.models import OutboxEvent
    from common.audit import write_audit
    from common.logging import JsonFormatter, RedactionFilter
    from common.outbox import publish_event

    secret = VENDOR_CANARIES[name]
    a = actor()

    write_audit(
        workspace=a.workspace,
        actor_membership=a.membership,
        action="test.vendor_canary",
        target_type="probe",
        target_ref="X",
        metadata={"note": f"provider said {secret}"},
    )
    publish_event(
        workspace=a.workspace,
        event_type="VendorCanaryProbe",
        aggregate_type="probe",
        aggregate_ref="X",
        payload={"note": f"provider said {secret}"},
    )

    captured: list[str] = []

    class _Capture(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            captured.append(self.format(record))

    handler = _Capture()
    handler.setFormatter(JsonFormatter())
    handler.addFilter(RedactionFilter())
    logger = logging.getLogger("test.vendor_canary")
    logger.handlers = [handler]
    logger.propagate = False
    logger.setLevel(logging.INFO)
    logger.info("calling provider with %s", secret)
    logger.info({"message": "structured", "detail": secret})

    audit_blob = json.dumps([row.metadata for row in AuditLog.objects.filter(workspace=a.workspace)])
    outbox_blob = json.dumps(
        [row.payload for row in OutboxEvent.objects.filter(workspace=a.workspace)]
    )
    assert secret not in audit_blob
    assert secret not in outbox_blob
    assert secret not in "\n".join(captured)


def test_the_vendor_shape_detector_is_not_vacuous():
    """Negative control: an unredacted canary IS visible, so the sinks above
    are proving redaction rather than proving the canary was never written."""
    for secret in VENDOR_CANARIES.values():
        raw = f"provider call failed with {secret} at the boundary"
        assert secret in raw
        assert redact_text(raw) != raw

"""Shared fixtures for the CRM Fast-Track browser end-to-end suite.

These tests drive a REAL browser against the REAL React build, the REAL Django
API and the REAL PostgreSQL database. Nothing is stubbed except the outbound
provider network, which uses the frozen fake adapter at the infrastructure
boundary — the application and domain layers are exercised unchanged.

Required environment (all have local defaults):
    WAZLINK_E2E_BASE_URL   frontend origin              http://127.0.0.1:5173
    WAZLINK_E2E_API_URL    API origin                   http://127.0.0.1:8000
    WAZLINK_E2E_CHROME     chromium executable          discovered from the
                                                        Playwright cache
"""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import pytest

BASE_URL = os.environ.get("WAZLINK_E2E_BASE_URL", "http://127.0.0.1:5173")
API_URL = os.environ.get("WAZLINK_E2E_API_URL", "http://127.0.0.1:8000")
PASSWORD = "wazlink-dev-password-2026"
OWNER_EMAIL = "owner@wazlink.test"
RIVAL_EMAIL = "rival@wazlink.test"
VIEWER_EMAIL = "viewer@wazlink.test"


def _discover_chrome() -> str:
    """Find a usable chromium.

    Playwright pins a browser revision per version; this environment carries a
    different one, so the executable is located rather than assumed. Being
    explicit here is what keeps the suite runnable on a machine whose cache was
    populated by a different Playwright release.
    """
    explicit = os.environ.get("WAZLINK_E2E_CHROME")
    if explicit:
        return explicit
    cache = Path.home() / ".cache" / "ms-playwright"
    for candidate in sorted(cache.glob("chromium-*/chrome-linux*/chrome"), reverse=True):
        return str(candidate)
    for candidate in ("/usr/bin/google-chrome", "/usr/bin/chromium"):
        if Path(candidate).exists():
            return candidate
    raise RuntimeError("no chromium executable found for the e2e suite")


def psql(sql: str) -> str:
    """Read PostgreSQL directly — the independent truth for every assertion."""
    result = subprocess.run(
        ["docker", "exec", "wazlink-pg", "psql", "-U", "wazlink", "-d", "wazlink_crm", "-qtA", "-c", sql],
        capture_output=True,
        text=True,
        check=True,
    )
    return result.stdout.strip()


def count(sql_where_table: str) -> int:
    return int(psql(f"SELECT count(*) FROM {sql_where_table}") or 0)


@pytest.fixture(scope="session")
def browser():
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        instance = p.chromium.launch(
            headless=True,
            executable_path=_discover_chrome(),
            args=["--no-sandbox", "--disable-dev-shm-usage"],
        )
        yield instance
        instance.close()


@pytest.fixture
def page(browser):
    """A fresh, isolated browser context — no cookie leaks between tests."""
    context = browser.new_context(viewport={"width": 1400, "height": 950}, locale="ar-SA")
    page = context.new_page()
    page.set_default_timeout(15000)
    yield page
    context.close()


# Cookies from the first real sign-in per account, reused by later tests.
#
# Login is rate-limited to 10 attempts per 60 seconds — a real control that
# exists to slow credential stuffing. A suite that signs in for every test
# out-runs it and then reports a product failure that is really the suite
# tripping a security feature. So the form is exercised for real ONCE per
# account, and after that the session cookie is replayed into a fresh context,
# which is also what a returning user's browser does.
_SESSION_COOKIES: dict[str, list] = {}


def _login_through_the_form(page, email: str, password: str) -> None:
    page.goto(f"{BASE_URL}/#/login", wait_until="domcontentloaded")
    page.fill("#loginEmail", email)
    page.fill("#loginPassword", password)
    page.click("button[type=submit]")
    page.wait_for_url("**/#/dashboard", timeout=20000)


def sign_in(page, email: str = OWNER_EMAIL, password: str = PASSWORD) -> None:
    """Establish an authenticated session and wait for the shell to resolve."""
    cached = _SESSION_COOKIES.get(email)
    if cached:
        page.context.add_cookies(cached)
        page.goto(f"{BASE_URL}/#/dashboard", wait_until="domcontentloaded")
    else:
        _login_through_the_form(page, email, password)
        _SESSION_COOKIES[email] = page.context.cookies()

    try:
        # The dashboard only renders once /workspaces and /entitlements resolve.
        page.wait_for_selector(".crm-summary-grid, .crm-state-card", timeout=20000)
    except Exception:
        # A replayed cookie can be revoked (another test signed the user out).
        # Fall back to a real login once rather than failing the scenario.
        _SESSION_COOKIES.pop(email, None)
        _login_through_the_form(page, email, password)
        _SESSION_COOKIES[email] = page.context.cookies()
        page.wait_for_selector(".crm-summary-grid, .crm-state-card", timeout=20000)


def goto_route(page, route: str) -> None:
    page.goto(f"{BASE_URL}/#/{route}", wait_until="domcontentloaded")
    page.wait_for_load_state("networkidle")


@pytest.fixture
def inbound_conversation():
    """Deliver ONE inbound WhatsApp message through the application layer.

    It calls `messaging.services.ingest_inbound` — the same command the webhook
    worker calls — rather than inserting rows. Identity resolution, conversation
    opening and party association therefore run exactly as they do in
    production; only the provider network is absent, which is what the frozen
    fake adapter at the infrastructure boundary is for.
    """
    import subprocess
    import json as _json

    phone = "+966500000777"
    script = f"""
import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
django.setup()
import json, uuid
from datetime import datetime, UTC
from apps.workspaces.models import Workspace
from apps.crm.models import Contact
from apps.messaging.services import ingest_inbound
from common.provider_ports import InboundMessage

workspace = Workspace.objects.get(name="شركة نمو")

# The address must already belong to a CRM contact, so the association the
# test asserts is a RESOLUTION, not a creation.
contact, _ = Contact.objects.get_or_create(
    workspace=workspace, phone="{phone}", defaults={{"full_name": "عميل واتساب"}}
)

message = ingest_inbound(
    workspace=workspace,
    inbound=InboundMessage(
        provider_message_id="e2e-" + uuid.uuid4().hex,
        from_phone="{phone}",
        body="مرحبًا، أريد عرض سعر.",
        occurred_at=datetime.now(UTC),
        profile_name="عميل واتساب",
    ),
)

# Drafting is gated on `ai_assisted` — the mode that authorises the assistant
# to WRITE and nothing else. Set it through the domain command so the test
# starts from the state the AI-assistance scenarios are actually about.
conversation = message.conversation
if conversation.handling_mode != "ai_assisted":
    conversation.handling_mode = "ai_assisted"
    conversation.takeover_by = None
    conversation.save(update_fields=["handling_mode", "takeover_by", "updated_at"])
print(json.dumps({{
    "phone": "{phone}",
    "conversation_ref": message.conversation.public_id if message else "",
    "contact_ref": contact.public_id,
}}))
"""
    backend = Path(__file__).resolve().parents[2] / "backend"
    result = subprocess.run(
        ["uv", "run", "python", "-c", script],
        cwd=backend,
        capture_output=True,
        text=True,
        check=True,
    )
    return _json.loads(result.stdout.strip().splitlines()[-1])


def wait_for_row(page, text: str) -> None:
    """Wait for a value to appear in the DATA TABLE.

    Not `text=`: the success toast carries the same name and renders above the
    table, so a bare text match would assert on a transient notification rather
    than on what the list actually reloaded from the server.
    """
    page.wait_for_selector(f".data-table tbody tr:has-text('{text}')", timeout=20000)


def open_lead(page, name: str) -> None:
    """Open a lead's 360 from its row link."""
    wait_for_row(page, name)
    page.locator(f".data-table tbody tr:has-text('{name}') .row-link").first.click()
    page.wait_for_url("**/#/crm/leads/**", timeout=20000)
    page.wait_for_selector(".lead-360-hero", timeout=20000)

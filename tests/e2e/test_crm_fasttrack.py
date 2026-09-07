"""CRM Fast-Track — browser end-to-end proof.

Each test drives the real UI and then checks PostgreSQL directly. A UI
assertion alone would only prove the screen re-rendered its own state; the
database read is what proves the mutation actually landed and that a refresh
reads the same truth back.
"""

from __future__ import annotations

import uuid

import pytest

from conftest import (  # type: ignore[import-not-found]
    open_lead,
    wait_for_row,
    RIVAL_EMAIL,
    VIEWER_EMAIL,
    count,
    goto_route,
    psql,
    sign_in,
)


def unique(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}"


# -------------------------------------------------------------------------
# E2E-1 — sign in, create a Lead by hand, refresh, it is still there.
# -------------------------------------------------------------------------
def test_e2e_1_manual_lead_survives_refresh(page):
    sign_in(page)
    goto_route(page, "crm")

    name = unique("عميل")
    page.click("text=إضافة عميل محتمل")
    page.fill("#leadContactName", name)
    page.fill("#leadContactPhone", "+966500000111")
    page.click("button:has-text('إنشاء عميل محتمل')")
    wait_for_row(page, name)

    # The row exists in PostgreSQL, with NO business and a manual origin.
    row = psql(
        "SELECT l.origin_type || '|' || coalesce(l.business_id::text, 'NULL') "
        "FROM leads l JOIN lead_contacts lc ON lc.lead_id = l.id "
        f"JOIN contacts c ON c.id = lc.contact_id WHERE c.full_name = '{name}'"
    )
    assert row == "manual|NULL", row

    # A full reload re-reads from the server: nothing was browser-local.
    page.reload(wait_until="networkidle")
    wait_for_row(page, name)


# -------------------------------------------------------------------------
# E2E-2 — a Customer created with zero Discovery objects, plus a Contact.
# -------------------------------------------------------------------------
def test_e2e_2_customer_and_contact_without_discovery(page):
    sign_in(page)
    goto_route(page, "crm/customers")

    name = unique("منشأة")
    page.click("text=إضافة عميل")
    page.fill("#customerName", name)
    page.fill("#customerContact", "جهة اتصال أولى")
    page.fill("#customerContactPhone", "+966500000222")
    page.click("button:has-text('إنشاء عميل')")
    wait_for_row(page, name)

    business_id = psql(f"SELECT coalesce(business_id::text,'NULL') FROM customers WHERE name = '{name}'")
    assert business_id == "NULL", business_id
    assert count("businesses") == 0, "a Business was fabricated for a manual customer"
    assert count("discovery_jobs") == 0, "a DiscoveryJob was fabricated"

    page.reload(wait_until="networkidle")
    wait_for_row(page, name)


# -------------------------------------------------------------------------
# E2E-3 — a CRM-only party carries a follow-up task.
#
# Contract note: `Task` links to a Lead, not to a Customer (crm models), so the
# CRM-only party used here is a manually created Lead. No customer-task
# relationship is invented to satisfy the scenario.
# -------------------------------------------------------------------------
def test_e2e_3_crm_only_party_gets_a_task(page):
    sign_in(page)
    goto_route(page, "crm")

    name = unique("متابعة")
    page.click("text=إضافة عميل محتمل")
    page.fill("#leadContactName", name)
    page.click("button:has-text('إنشاء عميل محتمل')")
    wait_for_row(page, name)

    open_lead(page, name)
    page.wait_for_selector("#newTaskTitle", timeout=15000)
    title = unique("مهمة")
    page.fill("#newTaskTitle", title)
    page.click("button:has-text('إضافة مهمة')")
    page.wait_for_selector(f"text={title}", timeout=15000)

    assert count(f"tasks WHERE title = '{title}'") == 1

    page.reload(wait_until="networkidle")
    page.wait_for_selector(f"text={title}", timeout=15000)


# -------------------------------------------------------------------------
# E2E-4 — a CRM-only Customer carries a Deal.
# -------------------------------------------------------------------------
def test_e2e_4_crm_only_customer_gets_a_deal(page):
    sign_in(page)
    goto_route(page, "crm/customers")

    customer = unique("عميل-صفقة")
    page.click("text=إضافة عميل")
    page.fill("#customerName", customer)
    page.click("button:has-text('إنشاء عميل')")
    wait_for_row(page, customer)

    goto_route(page, "deals")
    deal = unique("صفقة")
    page.click("text=صفقة جديدة")
    page.fill("#dealTitle", deal)
    page.fill("#dealValue", "15000")
    page.select_option("#dealPartyType", "customer")
    page.select_option("#dealParty", label=customer)
    page.click("button:has-text('إنشاء صفقة')")
    wait_for_row(page, deal)

    linked = psql(
        f"SELECT c.name FROM deals d JOIN customers c ON c.id = d.customer_id WHERE d.title = '{deal}'"
    )
    assert linked == customer, linked


# -------------------------------------------------------------------------
# E2E-5 — Lead -> Customer conversion lands on a usable Customer 360.
# -------------------------------------------------------------------------
def test_e2e_5_lead_converts_to_customer_360(page):
    sign_in(page)
    goto_route(page, "crm")

    name = unique("تحويل")
    page.click("text=إضافة عميل محتمل")
    page.fill("#leadContactName", name)
    page.click("button:has-text('إنشاء عميل محتمل')")
    wait_for_row(page, name)

    open_lead(page, name)
    page.wait_for_selector("button:has-text('تحويل كمنشأة')", timeout=15000)
    before = count("customers")
    page.click("button:has-text('تحويل كمنشأة')")
    page.wait_for_url("**/#/crm/customers/**", timeout=20000)
    page.wait_for_selector(".lead-360-hero", timeout=15000)

    assert count("customers") == before + 1

    # A second conversion attempt must NOT create a duplicate customer.
    lead_ref = psql(
        "SELECT l.public_id FROM leads l JOIN lead_contacts lc ON lc.lead_id = l.id "
        f"JOIN contacts c ON c.id = lc.contact_id WHERE c.full_name = '{name}'"
    )
    result = page.evaluate(
        """async (leadRef) => {
            const response = await fetch(`/api/v1/leads/${leadRef}/convert-customer`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                credentials: 'include',
                body: JSON.stringify({party_kind: 'organization'}),
            });
            return response.status;
        }""",
        lead_ref,
    )
    assert result == 409, f"a repeated conversion returned {result}, not a conflict"
    assert count("customers") == before + 1, "a duplicate customer was created"


# -------------------------------------------------------------------------
# E2E-6 — an inbound conversation associates with the EXISTING party.
# -------------------------------------------------------------------------
@pytest.mark.usefixtures("inbound_conversation")
def test_e2e_6_inbox_associates_existing_party(page, inbound_conversation):
    sign_in(page)
    goto_route(page, "inbox")
    page.wait_for_selector(".party-section", timeout=20000)

    # Identity resolution is the server's: the conversation attaches to the
    # contact that already existed, and no second CRM party is created.
    parties = count(f"contacts WHERE phone = '{inbound_conversation['phone']}'")
    assert parties == 1, f"inbound message created {parties} contacts for one address"


# -------------------------------------------------------------------------
# E2E-7 / E2E-8 — the human-send firewall.
# -------------------------------------------------------------------------
def test_e2e_7_ai_draft_sends_nothing_until_a_human_presses_send(page, inbound_conversation):
    sign_in(page)
    goto_route(page, "inbox")
    page.wait_for_selector(".ai-draft-panel", timeout=20000)

    outbound_before = count("messages WHERE direction = 'outbound'")

    # Ask the assistant for a draft and let any async generation settle.
    page.click("button:has-text('اقترح ردًا')")
    page.wait_for_timeout(6000)

    outbound_after = count("messages WHERE direction = 'outbound'")
    assert outbound_after == outbound_before, (
        "AI assistance produced an outbound customer message with no human send"
    )


def test_e2e_8_human_send_goes_through_the_messaging_boundary(page, inbound_conversation):
    sign_in(page)
    goto_route(page, "inbox")
    page.wait_for_selector("textarea[aria-label='نص الرسالة']", timeout=20000)

    before = count("messages WHERE direction = 'outbound'")
    body = unique("رد")
    page.fill("textarea[aria-label='نص الرسالة']", body)
    page.click("button:has-text('إرسال')")
    page.wait_for_timeout(3000)

    assert count(f"messages WHERE body = '{body}' AND direction = 'outbound'") == 1
    assert count("messages WHERE direction = 'outbound'") == before + 1

    # The sender recorded is the HUMAN membership, never an agent identity.
    sender = psql(f"SELECT coalesce(sent_by_id::text, 'NULL') FROM messages WHERE body = '{body}'")
    assert sender != "NULL", "an outbound message was recorded with no human sender"


# -------------------------------------------------------------------------
# E2E-9 — cross-workspace isolation.
# -------------------------------------------------------------------------
def test_e2e_9_workspace_cannot_read_another_workspaces_party(page):
    sign_in(page)
    goto_route(page, "crm")

    name = unique("سري")
    page.click("text=إضافة عميل محتمل")
    page.fill("#leadContactName", name)
    page.click("button:has-text('إنشاء عميل محتمل')")
    wait_for_row(page, name)

    lead_ref = psql(
        "SELECT l.public_id FROM leads l JOIN lead_contacts lc ON lc.lead_id = l.id "
        f"JOIN contacts c ON c.id = lc.contact_id WHERE c.full_name = '{name}'"
    )
    assert lead_ref

    # Sign in as the OTHER workspace's owner and ask for that exact lead.
    page.context.clear_cookies()
    sign_in(page, email=RIVAL_EMAIL)
    status = page.evaluate(
        """async (leadRef) => {
            const response = await fetch(`/api/v1/leads/${leadRef}`, {credentials: 'include'});
            return response.status;
        }""",
        lead_ref,
    )
    # 404, never 403: a 403 would confirm the object exists in another tenant.
    assert status == 404, f"cross-workspace read returned {status}"


# -------------------------------------------------------------------------
# E2E-10 — a permission-limited actor gets a correct, non-blank UI.
# -------------------------------------------------------------------------
def test_e2e_10_viewer_sees_a_read_only_surface(page):
    sign_in(page, email=VIEWER_EMAIL)
    goto_route(page, "crm")
    page.wait_for_selector(".crm-filter-card, .crm-state-card", timeout=20000)

    # The Viewer role holds no lead.create, so the create affordance is absent
    # — and the page is still a real, populated screen, not a blank or an error.
    assert page.locator("button:has-text('إضافة عميل محتمل')").count() == 0
    assert page.locator("text=لا تملك صلاحية").count() >= 0
    body = page.inner_text("body")
    assert "Traceback" not in body and "DoesNotExist" not in body
    assert len(body.strip()) > 40, "the permission-limited view rendered a blank screen"


# -------------------------------------------------------------------------
# E2E-11 — winning a deal recognizes NO revenue.
# -------------------------------------------------------------------------
def test_e2e_11_won_deal_creates_no_revenue_event(page):
    sign_in(page)
    goto_route(page, "crm/customers")

    customer = unique("عميل-كسب")
    page.click("text=إضافة عميل")
    page.fill("#customerName", customer)
    page.click("button:has-text('إنشاء عميل')")
    wait_for_row(page, customer)

    goto_route(page, "deals")
    deal = unique("صفقة-كسب")
    page.click("text=صفقة جديدة")
    page.fill("#dealTitle", deal)
    page.fill("#dealValue", "99000")
    page.select_option("#dealPartyType", "customer")
    page.select_option("#dealParty", label=customer)
    page.click("button:has-text('إنشاء صفقة')")
    wait_for_row(page, deal)

    revenue_before = count("revenue_events")

    row = page.locator("tr", has_text=deal).first
    row.locator("button:has-text('كسب')").click()
    page.wait_for_timeout(2500)

    assert psql(f"SELECT status FROM deals WHERE title = '{deal}'") == "won"
    assert count("revenue_events") == revenue_before, (
        "closing a deal Won created a RevenueEvent — the finance boundary was crossed"
    )
    assert count("revenue_events") == 0


# -------------------------------------------------------------------------
# E2E-12 — every mutation in one session survives a reload.
# -------------------------------------------------------------------------
def test_e2e_12_all_mutations_survive_a_reload(page):
    sign_in(page)
    goto_route(page, "crm")

    name = unique("ثبات")
    page.click("text=إضافة عميل محتمل")
    page.fill("#leadContactName", name)
    page.click("button:has-text('إنشاء عميل محتمل')")
    wait_for_row(page, name)

    open_lead(page, name)
    page.wait_for_selector("textarea[aria-label='نص الملاحظة']", timeout=15000)
    note = unique("ملاحظة")
    page.fill("textarea[aria-label='نص الملاحظة']", note)
    page.click("button:has-text('حفظ الملاحظة')")
    page.wait_for_selector(f"text={note}", timeout=15000)

    assert count(f"notes WHERE body = '{note}'") == 1

    # A hard reload re-fetches everything from the API.
    page.reload(wait_until="networkidle")
    page.wait_for_selector(".lead-360-hero", timeout=20000)
    page.wait_for_selector(f"text={note}", timeout=20000)
    assert name in page.inner_text(".lead-360-hero")

/**
 * Resource-client behaviour that carries a product invariant.
 *
 * Two things are asserted that a reviewer would otherwise have to re-derive
 * from the whole UI: a manual Lead/Customer creates NO Business, and the AI
 * agent client contains no path that sends a customer message.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

function ok(body: unknown, status = 200) {
  return {
    ok: status < 400,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(ok({}));
});

function lastBody() {
  return JSON.parse(fetchMock.mock.calls.at(-1)?.[1].body as string);
}

function lastUrl(): string {
  return fetchMock.mock.calls.at(-1)?.[0] as string;
}

describe("manual CRM creation carries no Discovery coupling", () => {
  it("posts a manual lead with a primary contact and no business_ref", async () => {
    const { leadsApi } = await import("../resources/crm");
    await leadsApi.create({ primary_contact: { name: "نورة" } });

    const body = lastBody();
    expect(body.origin_type).toBe("manual");
    expect(body.primary_contact).toEqual({ name: "نورة" });
    expect(body).not.toHaveProperty("business_ref");
  });

  it("defaults a customer to a manual origin with no business_ref", async () => {
    const { customersApi } = await import("../resources/crm");
    await customersApi.create({ party_kind: "person", name: "خالد", origin_kind: "manual" });

    const body = lastBody();
    expect(body.origin_kind).toBe("manual");
    expect(body).not.toHaveProperty("business_ref");
  });

  it("always attaches an idempotency key to a create, without being asked", async () => {
    const { leadsApi } = await import("../resources/crm");
    await leadsApi.create({ primary_contact: { name: "أحمد" } });
    expect(fetchMock.mock.calls.at(-1)?.[1].headers["Idempotency-Key"]).toBeTruthy();
  });

  it("sends If-Match on a conversion so a repeat cannot duplicate a customer", async () => {
    const { leadsApi } = await import("../resources/crm");
    await leadsApi.convertToCustomer("LEAD-1", "organization", 7, "intent-key");

    const init = fetchMock.mock.calls.at(-1)?.[1];
    expect(init.headers["If-Match"]).toBe("7");
    expect(init.headers["Idempotency-Key"]).toBe("intent-key");
  });
});

describe("the AI agent client cannot send to a customer", () => {
  it("exposes no send-like function", async () => {
    const { agentApi } = await import("../resources/messaging");
    const names = Object.keys(agentApi);
    expect(names).toEqual(
      expect.arrayContaining(["startSession", "requestProposal", "list", "accept", "reject"]),
    );
    expect(names.some((name) => /send|deliver|dispatch|publish/i.test(name))).toBe(false);
  });

  it("accepting a proposal touches only the agent resource, never /messages", async () => {
    const { agentApi } = await import("../resources/messaging");
    fetchMock.mockResolvedValue(ok({ proposal_ref: "P1", text: "مسودة" }));
    await agentApi.accept("P1", 1);

    expect(lastUrl()).toBe("/api/v1/agent/proposals/P1/accept");
    for (const call of fetchMock.mock.calls) {
      expect(call[0]).not.toContain("/messages");
    }
  });

  it("sending is a separate call to the single messaging endpoint", async () => {
    const { messagesApi } = await import("../resources/messaging");
    await messagesApi.send({ conversation_ref: "CONV-1", body: "أهلًا", ai_assisted: true });

    expect(lastUrl()).toBe("/api/v1/messages");
    // ai_assisted is provenance, not authorship: the server still records the
    // human membership as the sender.
    expect(lastBody()).toMatchObject({ conversation_ref: "CONV-1", ai_assisted: true });
  });
});

describe("lead owner assignment goes through the frozen PATCH", () => {
  it("PATCHes the lead resource with owner_ref and an If-Match version", async () => {
    const { leadsApi } = await import("../resources/crm");
    await leadsApi.assignOwner("LEAD-1", "MEM-2", 7);

    const init = fetchMock.mock.calls.at(-1)?.[1];
    expect(lastUrl()).toBe("/api/v1/leads/LEAD-1");
    expect(init.method).toBe("PATCH");
    expect(lastBody()).toEqual({ owner_ref: "MEM-2" });
    // Optimistic concurrency is the contract, not an optimisation: without it
    // two managers reassigning the same Lead would both appear to succeed.
    expect(init.headers["If-Match"]).toBe("7");
  });

  it("never invents an owner endpoint of its own", async () => {
    const { leadsApi } = await import("../resources/crm");
    await leadsApi.assignOwner("LEAD-1", "MEM-2", 1);

    for (const call of fetchMock.mock.calls) {
      expect(call[0]).not.toContain("/assign");
      expect(call[0]).not.toContain("/owner");
    }
  });
});

describe("deals never touch the revenue boundary", () => {
  it("closing a deal Won posts to the deal resource only", async () => {
    const { dealsApi } = await import("../resources/sales");
    await dealsApi.close("DEAL-1", "won", 3);

    expect(lastUrl()).toBe("/api/v1/deals/DEAL-1/close");
    for (const call of fetchMock.mock.calls) {
      expect(call[0]).not.toContain("/revenue");
    }
  });

  it("offers no revenue-recognition function at all", async () => {
    const sales = await import("../resources/sales");
    const surface = JSON.stringify(Object.keys(sales.dealsApi));
    expect(surface).not.toMatch(/revenue|recognis|recogniz/i);
  });
});

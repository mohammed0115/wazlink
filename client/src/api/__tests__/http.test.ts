/**
 * The HTTP boundary's contract obligations.
 *
 * These are the rules the backend relies on the client to honour — session
 * credentials, `Idempotency-Key` on durable mutations, `If-Match` on versioned
 * updates, dropped empty query parameters and the error envelope. They are
 * implemented once in `http.ts`, so they are tested once here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../errors";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    headers: { get: (name: string) => (init.headers ?? {})[name] ?? null },
    text: async () => JSON.stringify(body),
    blob: async () => new Blob([JSON.stringify(body)]),
  };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function load() {
  return import("../http");
}

describe("request construction", () => {
  it("targets /api/v1 on the same origin, so the session cookie is sent", async () => {
    const { api } = await load();
    fetchMock.mockResolvedValue(jsonResponse({ items: [] }));
    await api.get("/leads");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/v1/leads");
    expect(init.credentials).toBe("include");
  });

  it("drops null, undefined and empty query values instead of sending them", async () => {
    const { api } = await load();
    fetchMock.mockResolvedValue(jsonResponse({ items: [] }));
    await api.get("/leads", {
      query: { q: "نمو", status: "", priority: undefined, owner: null, limit: 25 },
    });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("limit=25");
    expect(url).toContain("q=");
    expect(url).not.toContain("status=");
    expect(url).not.toContain("priority");
    expect(url).not.toContain("owner");
  });

  it("sends Idempotency-Key and If-Match only when asked", async () => {
    const { api } = await load();
    fetchMock.mockResolvedValue(jsonResponse({}));

    await api.post("/leads", { body: { a: 1 }, idempotencyKey: "key-1" });
    expect(fetchMock.mock.calls[0][1].headers["Idempotency-Key"]).toBe("key-1");
    expect(fetchMock.mock.calls[0][1].headers["If-Match"]).toBeUndefined();

    fetchMock.mockResolvedValue(jsonResponse({}));
    await api.post("/leads/L1/status", { body: { status: "new" }, ifMatch: 4 });
    expect(fetchMock.mock.calls[1][1].headers["If-Match"]).toBe("4");
  });

  it("lets the browser set the multipart boundary by not setting Content-Type", async () => {
    const { api } = await load();
    fetchMock.mockResolvedValue(jsonResponse({}));
    const form = new FormData();
    form.set("file", "x");
    await api.post("/files", { form });

    expect(fetchMock.mock.calls[0][1].headers["Content-Type"]).toBeUndefined();
  });

  it("returns undefined for 204 rather than trying to parse a body", async () => {
    const { api } = await load();
    fetchMock.mockResolvedValue({ ok: true, status: 204, headers: { get: () => null } });
    await expect(api.delete("/customers/C1/contacts/CT1")).resolves.toBeUndefined();
  });
});

describe("error translation", () => {
  it("preserves the frozen envelope's code, details and request id", async () => {
    const { api } = await load();
    fetchMock.mockResolvedValue(
      jsonResponse(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "A lead without a business requires a primary contact.",
            details: { field: "primary_contact" },
            request_id: "req-42",
          },
        },
        { status: 422 },
      ),
    );

    await expect(api.post("/leads", { body: {} })).rejects.toMatchObject({
      code: "VALIDATION_FAILED",
      status: 422,
      requestId: "req-42",
    });
  });

  it("reads Retry-After on a rate limit", async () => {
    const { api } = await load();
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { code: "REQUEST_FAILED", message: "slow down" } }, {
        status: 429,
        headers: { "Retry-After": "30" },
      }),
    );

    const error = await api.get("/leads").catch((cause) => cause as ApiError);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).retryAfter).toBe(30);
    expect((error as ApiError).kind).toBe("rate_limited");
  });

  it("turns a transport failure into NETWORK_ERROR, not a fake 500", async () => {
    const { api } = await load();
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));

    const error = await api.get("/leads").catch((cause) => cause as ApiError);
    expect((error as ApiError).code).toBe("NETWORK_ERROR");
    expect((error as ApiError).status).toBe(0);
  });

  it("re-throws an abort untouched, so a superseded request is not an error", async () => {
    const { api } = await load();
    fetchMock.mockRejectedValue(new DOMException("aborted", "AbortError"));

    await expect(api.get("/leads")).rejects.toBeInstanceOf(DOMException);
  });

  it("never renders a non-JSON error body", async () => {
    const { api } = await load();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      headers: { get: () => null },
      text: async () => "<html><body>Server Error<pre>Traceback…</pre></body></html>",
    });

    const error = await api.get("/leads").catch((cause) => cause as ApiError);
    expect((error as ApiError).message).not.toContain("Traceback");
    expect((error as ApiError).code).toBe("REQUEST_FAILED");
  });
});

describe("newIdempotencyKey", () => {
  it("produces a distinct key per call", async () => {
    const { newIdempotencyKey } = await load();
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey());
  });
});

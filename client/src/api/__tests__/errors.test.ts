/**
 * The frozen error envelope must map to exactly one UI state.
 *
 * These assertions are the reason every CRM screen can branch on `kind`
 * instead of on a status code: if a backend code ever stops mapping, this
 * fails here rather than becoming a blank screen in one page and a raw message
 * in another.
 */
import { describe, expect, it } from "vitest";
import { ApiError, failureKind, failureTitle, isApiError } from "../errors";

const make = (code: string, status: number, details: Record<string, unknown> = {}) =>
  new ApiError({ status, code: code as never, message: "m", details });

describe("failureKind", () => {
  it("maps authentication codes to the unauthenticated state", () => {
    expect(failureKind(make("AUTH_REQUIRED", 401))).toBe("unauthenticated");
    expect(failureKind(make("SESSION_REVOKED", 401))).toBe("unauthenticated");
  });

  it("maps every 403 family code to a permission state, not a generic error", () => {
    for (const code of [
      "PERMISSION_DENIED",
      "MEMBERSHIP_INACTIVE",
      "WORKSPACE_INACTIVE",
      "EMAIL_VERIFICATION_REQUIRED",
    ]) {
      expect(failureKind(make(code, 403))).toBe("permission");
    }
  });

  it("separates entitlement from permission, because the remedy differs", () => {
    expect(failureKind(make("ENTITLEMENT_LOCKED", 403))).toBe("entitlement");
    expect(failureKind(make("QUOTA_EXHAUSTED", 403))).toBe("entitlement");
  });

  it("treats a cross-tenant miss as not-found, never as denied", () => {
    // A 403 here would confirm the object exists in another workspace.
    expect(failureKind(make("ENTITY_NOT_FOUND", 404))).toBe("not_found");
    expect(failureKind(make("WORKSPACE_NOT_FOUND", 404))).toBe("not_found");
  });

  it("maps every conflict code, including the revenue-specific one", () => {
    for (const code of ["CONFLICT", "STALE_VERSION", "IDEMPOTENCY_CONFLICT", "DUPLICATE_RECOGNITION"]) {
      expect(failureKind(make(code, 409))).toBe("conflict");
    }
  });

  it("falls back on the status when the code is unknown to the client", () => {
    expect(failureKind(make("REQUEST_FAILED", 429))).toBe("rate_limited");
    expect(failureKind(make("REQUEST_FAILED", 502))).toBe("provider");
    expect(failureKind(make("REQUEST_FAILED", 503))).toBe("provider");
    expect(failureKind(make("REQUEST_FAILED", 500))).toBe("server");
  });

  it("reports a transport failure as network, not as a server fault", () => {
    expect(failureKind(make("NETWORK_ERROR", 0))).toBe("network");
  });
});

describe("fieldErrors", () => {
  it("reads the single-field form the domain services emit", () => {
    const error = make("VALIDATION_FAILED", 422, { field: "primary_contact" });
    expect(error.fieldErrors).toEqual({ primary_contact: "m" });
  });

  it("reads DRF's fields map and takes the first message per field", () => {
    const error = make("VALIDATION_FAILED", 422, {
      fields: { name: ["مطلوب", "ثانٍ"], email: "غير صحيح" },
    });
    expect(error.fieldErrors).toEqual({ name: "مطلوب", email: "غير صحيح" });
  });

  it("is empty when the server named no field", () => {
    expect(make("CONFLICT", 409).fieldErrors).toEqual({});
  });
});

describe("titles and guards", () => {
  it("gives every kind its own title", () => {
    expect(failureTitle(make("PERMISSION_DENIED", 403))).not.toBe(
      failureTitle(make("ENTITY_NOT_FOUND", 404)),
    );
  });

  it("does not claim a non-ApiError is one", () => {
    expect(isApiError(new Error("boom"))).toBe(false);
    expect(isApiError(make("CONFLICT", 409), "CONFLICT")).toBe(true);
    expect(isApiError(make("CONFLICT", 409), "STALE_VERSION")).toBe(false);
  });
});

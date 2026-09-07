/**
 * The ONE HTTP boundary for the whole frontend.
 *
 * Nothing above this module calls `fetch`. That is what makes the frozen
 * contract enforceable in one place: session credentials, the error envelope,
 * `Idempotency-Key`, `If-Match`, cursor pagination and cancellation are
 * implemented once here and inherited by every resource client.
 *
 * Transport notes that are contract, not preference:
 *  - Authentication is the HttpOnly `wazlink_session` cookie, so every request
 *    sends `credentials: "include"` and the browser never reads the token.
 *  - `BROWSER_TOPOLOGY=same_origin` is the frozen production topology, so the
 *    default base URL is empty (same origin) and dev proxies `/api` instead of
 *    enabling CORS.
 */
import { appConfig } from "../config/env";
import { ApiError, type ApiErrorCode } from "./errors";

const API_ROOT = `${appConfig.apiBaseUrl.replace(/\/$/, "")}/api/v1`;

export type QueryValue = string | number | boolean | null | undefined;

export interface RequestOptions {
  /** Query-string parameters; `null`/`undefined` entries are dropped. */
  query?: Record<string, QueryValue>;
  /** JSON request body. Mutually exclusive with `form`. */
  body?: unknown;
  /** Multipart body for uploads. Mutually exclusive with `body`. */
  form?: FormData;
  /** Durable-mutation idempotency, per `BACKEND_IDEMPOTENCY_STANDARD.md`. */
  idempotencyKey?: string;
  /** Optimistic concurrency for versioned updates; sent as `If-Match`. */
  ifMatch?: number | string | null;
  /** Cancellation, so a superseded search does not overwrite a newer result. */
  signal?: AbortSignal;
}

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const url = `${API_ROOT}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${url}?${qs}` : url;
}

function toApiError(status: number, payload: unknown, retryAfter: string | null): ApiError {
  const envelope =
    payload && typeof payload === "object" && "error" in payload
      ? ((payload as { error: unknown }).error as Record<string, unknown>)
      : null;

  return new ApiError({
    status,
    code: (envelope?.code as ApiErrorCode) ?? "REQUEST_FAILED",
    message: (envelope?.message as string) || "تعذر إكمال الطلب.",
    details: (envelope?.details as Record<string, unknown>) ?? {},
    requestId: (envelope?.request_id as string) ?? "",
    retryAfter: retryAfter ? Number(retryAfter) : null,
  });
}

async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;

  if (options.form) {
    // Content-Type is deliberately unset: the browser must add the multipart
    // boundary itself.
    body = options.form;
  } else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }

  if (options.idempotencyKey) headers["Idempotency-Key"] = options.idempotencyKey;
  if (options.ifMatch !== undefined && options.ifMatch !== null) {
    headers["If-Match"] = String(options.ifMatch);
  }

  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method,
      headers,
      body,
      credentials: "include",
      signal: options.signal,
    });
  } catch (cause) {
    // An aborted request is a caller decision, not a failure to report.
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError({
      status: 0,
      code: "NETWORK_ERROR",
      message: "تعذر الوصول إلى الخادم. تحقق من الاتصال ثم أعد المحاولة.",
    });
  }

  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      // A non-JSON body means we did not reach the API contract at all (a
      // proxy or an HTML error page). It is never rendered to the user.
      payload = null;
    }
  }

  if (!response.ok) throw toApiError(response.status, payload, response.headers.get("Retry-After"));
  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>("GET", path, options),
  post: <T>(path: string, options?: RequestOptions) => request<T>("POST", path, options),
  patch: <T>(path: string, options?: RequestOptions) => request<T>("PATCH", path, options),
  put: <T>(path: string, options?: RequestOptions) => request<T>("PUT", path, options),
  delete: <T>(path: string, options?: RequestOptions) => request<T>("DELETE", path, options),
};

/**
 * Download a file as a Blob. Separate from `api.get` because the download
 * path returns bytes, not the JSON envelope, and must still map an error
 * envelope when the ticket is expired or already spent.
 */
export async function getBlob(path: string, options: RequestOptions = {}): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: "GET",
      credentials: "include",
      signal: options.signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError({ status: 0, code: "NETWORK_ERROR", message: "تعذر الوصول إلى الخادم." });
  }
  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = JSON.parse(await response.text());
    } catch {
      payload = null;
    }
    throw toApiError(response.status, payload, response.headers.get("Retry-After"));
  }
  return response.blob();
}

/**
 * A fresh idempotency key. Generated per user intent (one click), NOT per
 * attempt, so a double-click or a retry of the same intent collapses into one
 * durable mutation instead of two.
 */
export function newIdempotencyKey(): string {
  const globalCrypto = globalThis.crypto;
  if (globalCrypto && "randomUUID" in globalCrypto) return globalCrypto.randomUUID();
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/** A cursor page, as returned by every paginated collection endpoint. */
export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

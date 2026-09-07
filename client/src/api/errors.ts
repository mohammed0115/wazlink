/**
 * The frozen B0 error envelope, mapped ONCE for the whole frontend.
 *
 * `BACKEND_API_STANDARD.md` freezes both the envelope shape
 * `{ error: { code, message, details, request_id } }` and the HTTP policy.
 * Mapping it here — rather than in each screen — is what lets every CRM page
 * render the eight required UI states from one switch instead of eight
 * slightly different ad-hoc interpretations of `catch (e)`.
 */

/** Error codes the backend actually emits (`common/errors.py`). */
export type ApiErrorCode =
  | "AUTH_REQUIRED"
  | "SESSION_REVOKED"
  | "EMAIL_VERIFICATION_REQUIRED"
  | "WORKSPACE_NOT_FOUND"
  | "MEMBERSHIP_INACTIVE"
  | "WORKSPACE_INACTIVE"
  | "PERMISSION_DENIED"
  | "ENTITY_NOT_FOUND"
  | "ENTITLEMENT_LOCKED"
  | "QUOTA_EXHAUSTED"
  | "STALE_VERSION"
  | "IDEMPOTENCY_CONFLICT"
  | "VALIDATION_FAILED"
  | "CONFLICT"
  | "DUPLICATE_RECOGNITION"
  | "REQUEST_FAILED"
  | "NETWORK_ERROR";

/**
 * The UI state a failure resolves to. Screens branch on this, never on a raw
 * status code, so a new backend code cannot silently become a blank screen.
 */
export type ApiFailureKind =
  | "unauthenticated"
  | "permission"
  | "entitlement"
  | "not_found"
  | "validation"
  | "conflict"
  | "rate_limited"
  | "provider"
  | "server"
  | "network";

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details: Record<string, unknown>;
  readonly requestId: string;
  readonly retryAfter: number | null;

  constructor(init: {
    status: number;
    code: ApiErrorCode;
    message: string;
    details?: Record<string, unknown>;
    requestId?: string;
    retryAfter?: number | null;
  }) {
    super(init.message);
    this.name = "ApiError";
    this.status = init.status;
    this.code = init.code;
    this.details = init.details ?? {};
    this.requestId = init.requestId ?? "";
    this.retryAfter = init.retryAfter ?? null;
  }

  get kind(): ApiFailureKind {
    return failureKind(this);
  }

  /** Field-level messages for a 422, keyed by field name. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    const field = this.details.field;
    if (typeof field === "string") out[field] = this.message;
    const fields = this.details.fields;
    if (fields && typeof fields === "object") {
      for (const [key, value] of Object.entries(fields as Record<string, unknown>)) {
        out[key] = Array.isArray(value) ? String(value[0]) : String(value);
      }
    }
    return out;
  }
}

/** Code first, status second: the code is the contract, the status is a hint. */
export function failureKind(error: ApiError): ApiFailureKind {
  switch (error.code) {
    case "AUTH_REQUIRED":
    case "SESSION_REVOKED":
      return "unauthenticated";
    case "EMAIL_VERIFICATION_REQUIRED":
    case "PERMISSION_DENIED":
    case "MEMBERSHIP_INACTIVE":
    case "WORKSPACE_INACTIVE":
      return "permission";
    case "ENTITLEMENT_LOCKED":
    case "QUOTA_EXHAUSTED":
      return "entitlement";
    case "ENTITY_NOT_FOUND":
    case "WORKSPACE_NOT_FOUND":
      return "not_found";
    case "VALIDATION_FAILED":
      return "validation";
    case "STALE_VERSION":
    case "IDEMPOTENCY_CONFLICT":
    case "CONFLICT":
    case "DUPLICATE_RECOGNITION":
      return "conflict";
    case "NETWORK_ERROR":
      return "network";
    default:
      break;
  }
  if (error.status === 429) return "rate_limited";
  if (error.status === 502 || error.status === 503) return "provider";
  if (error.status >= 500) return "server";
  return "server";
}

/** Arabic copy for each failure kind — the default when a screen adds none. */
const KIND_TITLES: Record<ApiFailureKind, string> = {
  unauthenticated: "انتهت الجلسة",
  permission: "لا تملك صلاحية لهذا الإجراء",
  entitlement: "الباقة الحالية لا تشمل هذه الميزة",
  not_found: "العنصر غير موجود",
  validation: "تعذر قبول البيانات",
  conflict: "تعارض في الحالة",
  rate_limited: "تم تجاوز حد الطلبات",
  provider: "مزود الخدمة غير متاح حاليًا",
  server: "تعذر إكمال الطلب",
  network: "تعذر الوصول إلى الخادم",
};

export function failureTitle(error: unknown): string {
  return error instanceof ApiError ? KIND_TITLES[error.kind] : KIND_TITLES.server;
}

/**
 * A message safe to render. The backend already guarantees the envelope
 * message carries no trace, SQL or provider secret, so it is shown as-is.
 */
export function failureMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "حدث خطأ غير متوقع.";
}

export function isApiError(error: unknown, code?: ApiErrorCode): error is ApiError {
  return error instanceof ApiError && (code === undefined || error.code === code);
}

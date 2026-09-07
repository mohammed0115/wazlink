/**
 * The frontend's API surface. Import from here, never from `http.ts` directly:
 * that keeps the set of endpoints the UI can reach visible in one file.
 */
export { api, getBlob, newIdempotencyKey, type Page, type RequestOptions } from "./http";
export {
  ApiError,
  failureKind,
  failureMessage,
  failureTitle,
  isApiError,
  type ApiErrorCode,
  type ApiFailureKind,
} from "./errors";
export * from "./types";
export * from "./resources/crm";
export * from "./resources/session";
export * from "./resources/sales";
export * from "./resources/messaging";
export * from "./resources/platform";

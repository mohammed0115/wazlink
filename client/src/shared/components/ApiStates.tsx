/**
 * The eight required UI states, rendered from ONE mapping.
 *
 * Every integrated CRM screen must intentionally handle loading, success,
 * empty, validation error, permission denied, not found, conflict and
 * server/provider error. Doing that per screen guarantees eight slightly
 * different interpretations, so the mapping lives here: a screen hands over an
 * `ApiError` and gets the right state back, with the right role and Arabic
 * copy. No blank screen, no raw Django page, no stack trace.
 */
import type { ReactNode } from "react";
import { ApiError, failureMessage, failureTitle, type ApiFailureKind } from "../../api";

/** Which states are worth offering a retry for. A 403 is not one of them. */
const RETRYABLE: ReadonlySet<ApiFailureKind> = new Set<ApiFailureKind>([
  "network",
  "server",
  "provider",
  "rate_limited",
]);

const KIND_TONE: Record<ApiFailureKind, string> = {
  unauthenticated: "warning",
  permission: "warning",
  entitlement: "warning",
  not_found: "neutral",
  validation: "danger",
  conflict: "warning",
  rate_limited: "warning",
  provider: "danger",
  server: "danger",
  network: "danger",
};

export function ApiErrorState({
  error,
  onRetry,
  actions,
}: {
  error: ApiError | null;
  onRetry?: () => void;
  actions?: ReactNode;
}) {
  if (!error) return null;
  const kind = error.kind;
  const canRetry = Boolean(onRetry) && RETRYABLE.has(kind);

  return (
    <section
      className="card crm-state-card"
      role={kind === "not_found" ? "status" : "alert"}
      data-failure-kind={kind}
    >
      <span className={`status ${KIND_TONE[kind]}`}>{failureTitle(error)}</span>
      <h2>{failureMessage(error)}</h2>
      {error.requestId ? (
        <p className="muted">
          معرّف الطلب: <code className="ltr">{error.requestId}</code>
        </p>
      ) : null}
      {(canRetry || actions) && (
        <div className="crm-state-actions">
          {canRetry ? (
            <button className="button primary" type="button" onClick={onRetry}>
              إعادة المحاولة
            </button>
          ) : null}
          {actions}
        </div>
      )}
    </section>
  );
}

export function ApiLoadingState({ title = "جارٍ التحميل" }: { title?: string }) {
  return (
    <section className="card crm-state-card" role="status" aria-live="polite">
      <span className="status info">جارٍ التحميل</span>
      <h2>{title}</h2>
      <div className="crm-skeleton" />
    </section>
  );
}

export function ApiEmptyState({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <section className="card crm-state-card" role="status">
      <span className="status neutral">لا توجد بيانات</span>
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {actions ? <div className="crm-state-actions">{actions}</div> : null}
    </section>
  );
}

/**
 * Inline field errors for a 422.
 *
 * The server decides what is invalid; this only renders the `details` it
 * returned, so a new server-side rule needs no frontend change to be visible.
 */
export function FieldError({ error, field }: { error: ApiError | null; field: string }) {
  const message = error?.fieldErrors[field];
  if (!message) return null;
  return (
    <small className="field-error" role="alert">
      {message}
    </small>
  );
}

/** A non-field failure shown inside a form, above the submit button. */
export function FormError({ error }: { error: ApiError | null }) {
  if (!error) return null;
  // A field-scoped 422 is already rendered next to its input.
  if (error.kind === "validation" && Object.keys(error.fieldErrors).length > 0) return null;
  return (
    <p className="form-error" role="alert" data-failure-kind={error.kind}>
      <b>{failureTitle(error)}</b> {failureMessage(error)}
    </p>
  );
}

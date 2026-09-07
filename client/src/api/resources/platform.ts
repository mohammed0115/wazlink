/**
 * Files, custom-field definitions, CSV imports and the calendar.
 *
 * Files use the frozen three-step upload (intent -> content -> attach) and the
 * ticketed download. The ticket is single-use and short-lived by design, so
 * `download()` always issues a fresh one instead of caching a URL.
 */
import { api, getBlob, newIdempotencyKey } from "../http";
import type { FieldDefinition, FilePayload, ImportBatchPayload } from "../types";

export const filesApi = {
  /** Step 1: declare the upload and receive the asset shell. */
  createIntent: (input: {
    filename: string;
    content_type: string;
    size_bytes: number;
    retention_class?: string;
  }) => api.post<FilePayload>("/files/upload-intent", { body: input, idempotencyKey: newIdempotencyKey() }),

  /** Step 2: send the bytes. Base64 keeps this one JSON contract end to end. */
  uploadContent: (fileRef: string, base64: string, checksum?: string) =>
    api.put<FilePayload>(`/files/${encodeURIComponent(fileRef)}/content`, {
      body: { content: base64, ...(checksum ? { checksum } : {}) },
    }),

  /**
   * Step 3: attach to a CRM party so it appears in that party's 360.
   *
   * The request goes to the SUBJECT's endpoint, not to the file's. The file's
   * own `/attachments` route takes the subject's internal database id, which
   * the API never discloses; the subject owner resolves its own public id and
   * delegates downward instead.
   */
  attach: (fileRef: string, subjectType: "lead" | "customer", subjectRef: string) => {
    const collection = subjectType === "lead" ? "leads" : "customers";
    return api.post<{ file_ref: string; subject_type: string; subject_ref: string; state: string }>(
      `/${collection}/${encodeURIComponent(subjectRef)}/files`,
      { body: { file_ref: fileRef } },
    );
  },

  get: (fileRef: string, signal?: AbortSignal) =>
    api.get<FilePayload>(`/files/${encodeURIComponent(fileRef)}`, { signal }),

  /**
   * Issue a ticket then immediately redeem it. Two calls, not one, because the
   * ticket is the authorization: it is single-use and re-running the chain is
   * the correct way to download twice.
   */
  download: async (fileRef: string): Promise<Blob> => {
    const { ticket } = await api.get<{ ticket: string }>(
      `/files/${encodeURIComponent(fileRef)}/download`,
    );
    return getBlob(`/files/${encodeURIComponent(fileRef)}/download`, { query: { ticket } });
  },

  remove: (fileRef: string, reason = "") =>
    api.delete<FilePayload>(`/files/${encodeURIComponent(fileRef)}`, { body: { reason } }),
};

export const customFieldsApi = {
  list: (subjectType?: string, signal?: AbortSignal) =>
    api.get<{ items: FieldDefinition[] }>("/custom-fields", {
      query: { subject_type: subjectType },
      signal,
    }),

  define: (input: {
    subject_type: string;
    key: string;
    label: string;
    field_type: string;
    options?: string[];
    required?: boolean;
  }) => api.post<FieldDefinition>("/custom-fields", { body: input }),

  archive: (fieldRef: string) =>
    api.post<void>(`/custom-fields/${encodeURIComponent(fieldRef)}/archive`),
};

export interface DryRunResult {
  [key: string]: unknown;
}

export const importsApi = {
  list: (signal?: AbortSignal) =>
    api.get<{ items: ImportBatchPayload[] }>("/imports", { signal }),

  /** `target_kind` is "lead" or "customer"; neither requires Discovery. */
  create: (targetKind: string, csv: string) =>
    api.post<ImportBatchPayload>("/imports", {
      body: { target_kind: targetKind, csv },
      idempotencyKey: newIdempotencyKey(),
    }),

  setMapping: (batchRef: string, mapping: Record<string, string>) =>
    api.put<ImportBatchPayload>(`/imports/${encodeURIComponent(batchRef)}/mapping`, {
      body: { mapping },
    }),

  /** Validates and reports. Writes nothing — this is the preview step. */
  dryRun: (batchRef: string) =>
    api.post<DryRunResult>(`/imports/${encodeURIComponent(batchRef)}/dry-run`),

  commit: (batchRef: string, version: number) =>
    api.post<ImportBatchPayload>(`/imports/${encodeURIComponent(batchRef)}/commit`, {
      ifMatch: version,
      idempotencyKey: newIdempotencyKey(),
    }),

  errorsCsv: (batchRef: string) =>
    getBlob(`/imports/${encodeURIComponent(batchRef)}/errors.csv`),
};

export interface CalendarEntry {
  entry_id: string;
  kind: "task" | "appointment";
  title: string;
  occurs_at: string;
  status: string;
}

export const calendarApi = {
  list: (query: { start?: string; end?: string } = {}, signal?: AbortSignal) =>
    api.get<{ items: CalendarEntry[] }>("/activities/calendar", { query: { ...query }, signal }),
};

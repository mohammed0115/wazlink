/**
 * CRM resource clients — leads, contacts, tasks, customers.
 *
 * Each function is a thin, typed transcription of ONE endpoint. No business
 * rule lives here: status transitions, identity, conversion and ownership are
 * decided by the Django application services, and this file only carries the
 * request there and the DTO back. That is what keeps the frontend from
 * becoming a second, divergent copy of the domain.
 */
import { api, newIdempotencyKey, type Page, type RequestOptions } from "../http";
import type {
  AppointmentItem,
  ContactPayload,
  CustomerSummary,
  LeadListItem,
  LeadPriority,
  LeadStatus,
  Party360,
  PartyKind,
  TaskItem,
  TimelineEntry,
} from "../types";

export interface LeadQuery {
  q?: string;
  status?: string;
  priority?: string;
  owner?: string;
  tag?: string;
  city?: string;
  category?: string;
  include_archived?: string;
  cursor?: string;
  limit?: number;
}

/** A primary contact for a Lead or Customer created without a Business. */
export interface PrimaryContactInput {
  name: string;
  phone?: string;
  email?: string;
}

export const leadsApi = {
  list: (query: LeadQuery = {}, signal?: AbortSignal) =>
    api.get<Page<LeadListItem>>("/leads", { query: { ...query }, signal }),

  /**
   * Create a Lead. `origin_type: "manual"` with a `primary_contact` is the
   * Discovery-free path: the server fabricates NO Business and NO discovery
   * job, and returns 422 if the contact is missing (CA-15).
   */
  create: (
    input: { origin_type?: string; primary_contact?: PrimaryContactInput; business_ref?: string },
    options: Pick<RequestOptions, "idempotencyKey" | "signal"> = {},
  ) =>
    api.post<LeadListItem>("/leads", {
      body: { origin_type: "manual", ...input },
      idempotencyKey: options.idempotencyKey ?? newIdempotencyKey(),
      signal: options.signal,
    }),

  get360: (leadRef: string, signal?: AbortSignal) =>
    api.get<Party360>(`/leads/${encodeURIComponent(leadRef)}`, { signal }),

  timeline: (leadRef: string, query: { cursor?: string; limit?: number } = {}, signal?: AbortSignal) =>
    api.get<{ items: TimelineEntry[]; has_more: boolean; next_cursor: string | null }>(
      `/leads/${encodeURIComponent(leadRef)}/timeline`,
      { query: { ...query }, signal },
    ),

  setStatus: (leadRef: string, status: LeadStatus, version: number) =>
    api.post<LeadListItem>(`/leads/${encodeURIComponent(leadRef)}/status`, {
      body: { status },
      ifMatch: version,
    }),

  setPriority: (leadRef: string, priority: LeadPriority, version: number) =>
    api.post<LeadListItem>(`/leads/${encodeURIComponent(leadRef)}/priority`, {
      body: { priority },
      ifMatch: version,
    }),

  archive: (leadRef: string, version: number) =>
    api.post<LeadListItem>(`/leads/${encodeURIComponent(leadRef)}/archive`, { ifMatch: version }),

  addTag: (leadRef: string, tag: string) =>
    api.post<{ lead_ref: string; tag: string }>(`/leads/${encodeURIComponent(leadRef)}/tags`, {
      body: { tag },
    }),

  addNote: (leadRef: string, body: string) =>
    api.post<{ note_ref: string }>(`/leads/${encodeURIComponent(leadRef)}/notes`, { body: { body } }),

  contacts: (leadRef: string, signal?: AbortSignal) =>
    api.get<{ items: ContactPayload[] }>(`/leads/${encodeURIComponent(leadRef)}/contacts`, { signal }),

  addContact: (
    leadRef: string,
    input: { name: string; phone?: string; email?: string; contact_ref?: string; is_primary?: boolean },
  ) =>
    api.post<ContactPayload>(`/leads/${encodeURIComponent(leadRef)}/contacts`, {
      body: input,
      idempotencyKey: newIdempotencyKey(),
    }),

  setCustomFields: (leadRef: string, values: Record<string, unknown>) =>
    api.post<{ written: number }>(`/leads/${encodeURIComponent(leadRef)}/custom-fields`, {
      body: { values },
    }),

  /**
   * Lead -> Customer. Idempotency-Key is generated per user intent so a
   * double-click cannot produce a second Customer; a repeat of a completed
   * conversion is answered 409 by the domain, which the UI renders as a
   * conflict rather than as a failure.
   */
  convertToCustomer: (
    leadRef: string,
    partyKind: PartyKind,
    version: number,
    idempotencyKey: string,
  ) =>
    api.post<CustomerSummary>(`/leads/${encodeURIComponent(leadRef)}/convert-customer`, {
      body: { party_kind: partyKind },
      ifMatch: version,
      idempotencyKey,
    }),
};

export const contactsApi = {
  list: (query: { q?: string; cursor?: string; limit?: number } = {}, signal?: AbortSignal) =>
    api.get<Page<ContactPayload>>("/contacts", { query: { ...query }, signal }),
  get: (contactRef: string, signal?: AbortSignal) =>
    api.get<ContactPayload>(`/contacts/${encodeURIComponent(contactRef)}`, { signal }),
};

export const customersApi = {
  list: (
    query: { q?: string; party_kind?: string; status?: string; cursor?: string; limit?: number } = {},
    signal?: AbortSignal,
  ) => api.get<Page<CustomerSummary>>("/customers", { query: { ...query }, signal }),

  /** Discovery-free by default: no `business_ref`, and none is fabricated. */
  create: (
    input: {
      party_kind: PartyKind;
      name: string;
      origin_kind?: string;
      primary_contact?: PrimaryContactInput;
      contact_ref?: string;
      business_ref?: string;
    },
    idempotencyKey = newIdempotencyKey(),
  ) => api.post<CustomerSummary>("/customers", { body: input, idempotencyKey }),

  get360: (customerRef: string, signal?: AbortSignal) =>
    api.get<Party360>(`/customers/${encodeURIComponent(customerRef)}`, { signal }),

  update: (customerRef: string, input: { name?: string; party_kind?: PartyKind }, version: number) =>
    api.patch<CustomerSummary>(`/customers/${encodeURIComponent(customerRef)}/update`, {
      body: input,
      ifMatch: version,
    }),

  archive: (customerRef: string, version: number) =>
    api.post<CustomerSummary>(`/customers/${encodeURIComponent(customerRef)}/archive`, {
      ifMatch: version,
    }),

  addContact: (
    customerRef: string,
    input: { primary_contact?: PrimaryContactInput; contact_ref?: string; is_primary?: boolean },
  ) =>
    api.post<CustomerSummary>(`/customers/${encodeURIComponent(customerRef)}/contacts`, {
      body: input,
      idempotencyKey: newIdempotencyKey(),
    }),

  removeContact: (customerRef: string, contactRef: string) =>
    api.delete<void>(
      `/customers/${encodeURIComponent(customerRef)}/contacts/${encodeURIComponent(contactRef)}`,
    ),

  setCustomFields: (customerRef: string, values: Record<string, unknown>) =>
    api.post<{ written: number }>(`/customers/${encodeURIComponent(customerRef)}/custom-fields`, {
      body: { values },
    }),
};

export const tasksApi = {
  list: (query: { status?: string; cursor?: string; limit?: number } = {}, signal?: AbortSignal) =>
    api.get<Page<TaskItem>>("/tasks", { query: { ...query }, signal }),

  create: (
    input: { title: string; lead_ref?: string; due_at?: string | null },
    idempotencyKey = newIdempotencyKey(),
  ) => api.post<TaskItem>("/tasks", { body: input, idempotencyKey }),

  /** The endpoint supports completion only; anything else is 422 by contract. */
  complete: (taskRef: string, version: number) =>
    api.patch<TaskItem>(`/tasks/${encodeURIComponent(taskRef)}`, {
      body: { status: "completed" },
      ifMatch: version,
    }),
};

export const appointmentsApi = {
  list: (query: { cursor?: string; limit?: number } = {}, signal?: AbortSignal) =>
    api.get<Page<AppointmentItem>>("/appointments", { query: { ...query }, signal }),
  create: (input: { title: string; starts_at: string; ends_at: string; lead_ref?: string }) =>
    api.post<AppointmentItem>("/appointments", { body: input, idempotencyKey: newIdempotencyKey() }),
};

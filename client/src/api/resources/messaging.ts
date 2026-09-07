/**
 * Team Inbox, messages, and the AI agent.
 *
 * THE HUMAN-SEND FIREWALL, stated where it is implemented:
 * `POST /messages` is the only send endpoint in the product, it requires the
 * human `message.send` permission held by a membership, and the AI agent API
 * has no send endpoint at all. `agentApi.accept()` returns DRAFT TEXT; turning
 * that text into a customer-visible message is a separate, explicit
 * `messagesApi.send()` call that a person triggers. Nothing in this module may
 * chain those two together.
 */
import { api, newIdempotencyKey, type Page } from "../http";
import type {
  AgentProposalPayload,
  AgentSessionPayload,
  ConversationDetail,
  ConversationPayload,
  HandlingMode,
  MessagePayload,
} from "../types";

export interface InboxQuery {
  status?: "open" | "closed";
  handling_mode?: HandlingMode;
  unassigned?: "true";
  assigned_to?: string;
  unread?: "true";
  cursor?: string;
  limit?: number;
}

export const conversationsApi = {
  list: (query: InboxQuery = {}, signal?: AbortSignal) =>
    api.get<Page<ConversationPayload>>("/conversations", { query: { ...query }, signal }),

  get: (conversationRef: string, query: { cursor?: string; limit?: number } = {}, signal?: AbortSignal) =>
    api.get<ConversationDetail>(`/conversations/${encodeURIComponent(conversationRef)}`, {
      query: { ...query },
      signal,
    }),

  assign: (conversationRef: string, membershipRef: string, version: number) =>
    api.post<ConversationPayload>(`/conversations/${encodeURIComponent(conversationRef)}/assign`, {
      body: { membership_ref: membershipRef },
      ifMatch: version,
    }),

  markRead: (conversationRef: string) =>
    api.post<ConversationPayload>(`/conversations/${encodeURIComponent(conversationRef)}/read`),

  setHandlingMode: (conversationRef: string, mode: HandlingMode, version: number) =>
    api.post<ConversationPayload>(
      `/conversations/${encodeURIComponent(conversationRef)}/handling-mode`,
      { body: { handling_mode: mode }, ifMatch: version },
    ),

  /** Start a human takeover. The verb carries the intent: POST begins it. */
  startTakeover: (conversationRef: string, version: number) =>
    api.post<ConversationPayload>(`/conversations/${encodeURIComponent(conversationRef)}/takeover`, {
      ifMatch: version,
    }),

  /** End the takeover this member holds. */
  endTakeover: (conversationRef: string, version: number) =>
    api.delete<ConversationPayload>(
      `/conversations/${encodeURIComponent(conversationRef)}/takeover`,
      { ifMatch: version },
    ),

  archive: (conversationRef: string, version: number) =>
    api.post<ConversationPayload>(`/conversations/${encodeURIComponent(conversationRef)}/archive`, {
      ifMatch: version,
    }),

  reopen: (conversationRef: string, version: number) =>
    api.post<ConversationPayload>(`/conversations/${encodeURIComponent(conversationRef)}/reopen`, {
      ifMatch: version,
    }),
};

export const messagesApi = {
  /**
   * The ONE send. Called only from an explicit human action handler.
   *
   * `ai_assisted` is an honest provenance tag a person may set when a draft
   * helped: it changes the tag, never the sender. `sent_by` remains the human
   * membership either way.
   */
  send: (
    input: { conversation_ref: string; body: string; ai_assisted?: boolean },
    idempotencyKey = newIdempotencyKey(),
  ) => api.post<MessagePayload>("/messages", { body: input, idempotencyKey }),

  sendTemplate: (
    input: {
      conversation_ref: string;
      template_ref: string;
      variables?: string[];
      ai_assisted?: boolean;
    },
    idempotencyKey = newIdempotencyKey(),
  ) => api.post<MessagePayload>("/messages/template", { body: input, idempotencyKey }),

  templates: (signal?: AbortSignal) =>
    api.get<{
      items: { template_ref: string; name: string; language: string; status: string; body: string }[];
    }>("/templates", { signal }),
};

export const agentApi = {
  /** Open an assistance session against a conversation. */
  startSession: (conversationRef: string) =>
    api.post<AgentSessionPayload>("/agent/sessions", { body: { conversation_ref: conversationRef } }),

  /** 202 — generation runs on the slow provider queue; poll `list`. */
  requestProposal: (sessionRef: string, intent = "draft_reply") =>
    api.post<AgentSessionPayload>("/agent/proposals", {
      body: { session_ref: sessionRef, intent },
    }),

  list: (query: { status?: string; cursor?: string; limit?: number } = {}, signal?: AbortSignal) =>
    api.get<Page<AgentProposalPayload>>("/agent/proposals", { query: { ...query }, signal }),

  /**
   * A human accepts a draft. This returns the proposal with its text; it does
   * NOT send anything to a customer.
   */
  accept: (proposalRef: string, version: number) =>
    api.post<AgentProposalPayload>(`/agent/proposals/${encodeURIComponent(proposalRef)}/accept`, {
      ifMatch: version,
    }),

  reject: (proposalRef: string, version: number) =>
    api.post<AgentProposalPayload>(`/agent/proposals/${encodeURIComponent(proposalRef)}/reject`, {
      ifMatch: version,
    }),
};

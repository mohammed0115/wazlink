import type {
  Conversation,
  Deal,
  Lead,
  Message,
} from "../../domain/types";

/**
 * S0 contracts are deliberately implementation-agnostic. The current mock
 * adapter remains synchronous; API-backed implementations may become async in
 * a later phase without changing feature ownership of these contracts.
 */
export interface LeadRepository {
  getById(id: string): Lead | undefined;
  list(): Lead[];
}

export interface DealRepository {
  getById(id: string): Deal | undefined;
  list(): Deal[];
}

export interface ConversationRepository {
  getById(id: string): Conversation | undefined;
  list(): Conversation[];
  listMessages(conversationId: string): Message[];
}

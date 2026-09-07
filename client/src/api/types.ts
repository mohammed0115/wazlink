/**
 * DTOs, mirroring the backend selectors exactly.
 *
 * These are transcriptions of what the API actually returns
 * (each app's `selectors` and `api/views.py`), in backend `snake_case`. They
 * are deliberately NOT renamed into frontend casing: a rename layer is a place
 * for the two shapes to drift silently, and the whole point of this boundary
 * is that drift becomes a TypeScript error.
 */

/** `apps/crm/models.LEAD_STATUSES`. There is no "converted" status: a
 *  converted lead is identified by `converted_at`, not by a status value. */
export type LeadStatus = "new" | "contacted" | "qualified" | "unqualified" | "nurturing";
export type LeadPriority = "low" | "medium" | "high";
export type LeadOrigin = "manual" | "import" | "api" | "form" | "discovery";
export type PartyKind = "organization" | "person";

/** How the display block was derived. `contact` means there is no Business. */
export type DisplaySource = "business" | "contact";

export interface LeadListItem {
  lead_ref: string;
  status: LeadStatus;
  priority: LeadPriority;
  origin_type: LeadOrigin;
  owner_ref: string;
  last_activity_at: string | null;
  version: number;
  archived: boolean;
  /** Nullable by CA-15 — a manual Lead has NO business and none is invented. */
  business_ref: string | null;
  business_name: string | null;
  business_city: string | null;
  business_category: string | null;
  /** Always present: the read-time projection every screen renders. */
  display_name: string;
  display_subtitle: string;
  display_source: DisplaySource;
}

export interface ContactPayload {
  contact_ref: string;
  full_name: string;
  phone: string;
  email: string;
  title: string;
  /** True when the actor is a Viewer and the server masked the PII. */
  masked: boolean;
  is_primary?: boolean;
}

export interface CustomerSummary {
  customer_ref: string;
  party_kind: PartyKind;
  name: string;
  origin_kind: string;
  status: string;
  owner_ref: string;
  business_ref: string | null;
  version: number;
}

export interface TaskItem {
  task_ref: string;
  title: string;
  status: string;
  due_at: string | null;
  overdue?: boolean;
  version: number;
  lead_ref?: string | null;
}

export interface AppointmentItem {
  appointment_ref: string;
  title: string;
  starts_at: string;
  ends_at: string;
  status: string;
}

export interface NoteItem {
  note_ref: string;
  body: string;
  created_at: string;
}

export interface DealStageRef {
  stage_ref: string;
  name: string;
  position: number;
  probability?: string;
}

export interface DealPayload {
  deal_ref: string;
  title: string;
  /** FORECAST value. Never recognized revenue — see `RevenueEvent`. */
  value: string;
  currency: string;
  weighted_value: string;
  status: string;
  stage: DealStageRef;
  pipeline_ref: string;
  lead_ref: string | null;
  customer_ref: string | null;
  owner_ref: string;
  loss_reason: string;
  closed_at: string | null;
  version: number;
}

export interface PipelinePayload {
  pipeline_ref: string;
  name: string;
  is_default: boolean;
  stages: DealStageRef[];
}

/**
 * The conversation's handling mode (`apps/messaging/models.HANDLING_MODES`).
 *
 * `ai_assisted` authorises DRAFTING and nothing more — no mode in this
 * vocabulary authorises a send, which is why the send guard never consults it.
 * `ai_paused` is set by the system when a human takes over; it is a state to
 * display, not a mode a user picks.
 */
export type HandlingMode = "ai_assisted" | "human" | "ai_paused";

export interface MessagePayload {
  message_ref: string;
  direction: "inbound" | "outbound";
  status: string;
  body: string;
  kind: string;
  template_name: string | null;
  /** The HUMAN membership that sent it. An AI-drafted message still reports one. */
  sent_by_ref: string | null;
  ai_assisted: boolean;
  failure_code: string | null;
  occurred_at: string;
  version: number;
}

export interface ConversationPayload {
  conversation_ref: string;
  channel: string;
  status: string;
  handling_mode: HandlingMode;
  identity_state: string;
  peer_address: string;
  contact_ref: string | null;
  customer_ref: string | null;
  assigned_to_ref: string | null;
  takeover_by_ref: string | null;
  unread_count: number;
  last_message_at: string | null;
  latest_message: MessagePayload | null;
  version: number;
}

export interface ConversationDetail extends ConversationPayload {
  messages: MessagePayload[];
  next_cursor: string | null;
}

export interface AgentSessionPayload {
  session_ref: string;
  conversation_ref: string;
  status: string;
  version: number;
}

/** `apps/aiagent/models` — a fresh proposal is `pending` until a human acts. */
export type ProposalStatus = "pending" | "accepted" | "rejected" | "abandoned";

export interface AgentProposalPayload {
  proposal_ref: string;
  session_ref: string;
  kind: string;
  tier: string;
  status: ProposalStatus;
  /** The DRAFT text. Carries no channel, recipient or send flag by design. */
  text: string;
  citations: unknown[];
  confidence: number | null;
  accepted_by_ref: string | null;
  resulting_command: string | null;
  resulting_ref: string | null;
  version: number;
}

export interface FilePayload {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  lifecycle_state: string;
  checksum: string;
  created_at: string;
}

export interface FieldDefinition {
  field_ref: string;
  subject_type: string;
  key: string;
  label: string;
  field_type: "text" | "number" | "date" | "boolean" | "select" | string;
  options: string[] | null;
  required: boolean;
}

export interface CustomFieldValue {
  key: string;
  label: string;
  field_type: string;
  value: unknown;
}

export interface ImportBatchPayload {
  batch_ref: string;
  target_kind: string;
  status: string;
  mapping: Record<string, string>;
  rows_total: number;
  outcomes: Record<string, number>;
  version: number;
}

export interface TimelineEntry {
  entry_id: string;
  source_domain: string;
  occurred_at: string;
  recorded_at: string;
  actor: string | null;
  summary: string;
  change: Record<string, unknown>;
  target_ref: string | null;
  source_resource_ref: string | null;
  source_event_type: string | null;
  route_hint: string | null;
}

/**
 * Lead 360 / Customer 360.
 *
 * EVERY section is optional, and that is the contract, not laziness: a section
 * the actor may not read and a section whose slice has not shipped are BOTH
 * key-absent. The UI must therefore treat "missing" as "do not render", never
 * as "empty".
 */
export interface Party360 {
  lead?: LeadListItem & { converted_at: string | null };
  profile?: CustomerSummary;
  contacts?: ContactPayload[];
  tasks?: TaskItem[];
  appointments?: AppointmentItem[];
  notes?: NoteItem[];
  deals?: { deal_ref: string; title: string }[];
  files?: { file_ref: string; filename: string; content_type: string; size_bytes: number }[];
  custom_fields?: CustomFieldValue[];
  conversations?: unknown[];
  business?: Record<string, unknown>;
  intelligence?: Record<string, unknown>;
  tickets?: unknown[];
  activities: TimelineEntry[];
}

export interface SessionPayload {
  session_ref: string;
  user: { user_ref: string; email: string; email_verified: boolean };
  active_workspace_ref: string | null;
  has_workspace: boolean;
}

export interface WorkspacePayload {
  workspace_ref: string;
  name: string;
  slug: string;
  status: string;
  version: number;
  role?: string;
}

export interface EntitlementPayload {
  plan_code: string;
  role: string;
  /** Server-derived permission set. The client never invents one. */
  permissions: string[];
}

export interface MemberPayload {
  membership_ref: string;
  user_ref?: string;
  email?: string;
  role: string;
  status: string;
}

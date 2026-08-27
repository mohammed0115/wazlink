import { crmService, discoveryService, messagingService, pipelineService } from "@services";
import type {
  AppointmentView,
  CustomerJourneyContext,
  JourneyAction,
  JourneyActivityItem,
  JourneyCanonicalId,
  JourneyProjectionService,
  LeadActivityItem,
  MessageView,
  TaskView,
} from "./contracts/services";

const idPrefixes = {
  business: "BUS-",
  lead: "LEAD-",
  job: "JOB-",
  conversation: "CONV-",
  message: "MSG-",
  deal: "DEAL-",
  task: "TSK-",
  appointment: "APT-",
  activity: "ACT-",
} as const;

type JourneyKind = keyof typeof idPrefixes;

function ref(kind: JourneyKind, id: string | undefined): JourneyCanonicalId | null {
  const prefix = idPrefixes[kind];
  return id?.startsWith(prefix) ? (id as JourneyCanonicalId) : null;
}

function action(label: string, route: string, kind: JourneyKind, id: string | undefined): JourneyAction | null {
  const entity = ref(kind, id);
  return entity ? { label, route, entity: { kind, id: entity } } : null;
}

function timestamp(value: string | undefined): string | null {
  return value && !Number.isNaN(Date.parse(value)) ? value : null;
}

function baseItem(
  activity: LeadActivityItem,
  leadId: JourneyCanonicalId,
  businessId?: JourneyCanonicalId,
): JourneyActivityItem | null {
  const id = ref("activity", activity.id);
  const time = timestamp(activity.createdAt || activity.at);
  if (!id || !time) return null;
  return {
    id,
    kind: "lead_activity",
    timestamp: time,
    leadId,
    businessId,
    title: activity.title || activity.type || "نشاط Lead",
    description: activity.detail || activity.body,
    route: `crm/leads/${leadId}`,
    ...(ref("deal", activity.metadata?.dealId) ? { dealId: ref("deal", activity.metadata?.dealId) || undefined } : {}),
  };
}

function taskItem(task: TaskView, leadId: JourneyCanonicalId, businessId?: JourneyCanonicalId): JourneyActivityItem | null {
  const id = ref("task", task.id);
  const time = timestamp(task.createdAt || task.dueAt);
  if (!id || !time) return null;
  return {
    id,
    kind: "task",
    timestamp: time,
    leadId,
    businessId,
    taskId: id,
    title: task.title || "مهمة متابعة",
    description: task.status || (task.completed ? "مكتملة" : undefined),
    route: `crm/leads/${leadId}`,
    ...(ref("deal", task.dealId) ? { dealId: ref("deal", task.dealId) || undefined } : {}),
  };
}

function appointmentItem(appointment: AppointmentView, leadId: JourneyCanonicalId, businessId?: JourneyCanonicalId): JourneyActivityItem | null {
  const id = ref("appointment", appointment.id);
  const time = timestamp(appointment.createdAt || appointment.startsAt);
  if (!id || !time) return null;
  return {
    id,
    kind: "appointment",
    timestamp: time,
    leadId,
    businessId,
    appointmentId: id,
    title: appointment.title || "موعد",
    description: appointment.status,
    route: `crm/leads/${leadId}`,
    ...(ref("deal", appointment.dealId) ? { dealId: ref("deal", appointment.dealId) || undefined } : {}),
  };
}

function messageItem(message: MessageView, leadId: JourneyCanonicalId, businessId?: JourneyCanonicalId): JourneyActivityItem | null {
  const id = ref("message", message.id);
  const conversationId = ref("conversation", message.conversationId);
  const time = timestamp(message.createdAt);
  if (!id || !conversationId || !time) return null;
  return {
    id,
    kind: "message",
    timestamp: time,
    leadId,
    businessId,
    conversationId,
    messageId: id,
    title: message.direction === "inbound" ? "رسالة واردة" : "رسالة مرسلة",
    description: message.body,
    route: `inbox/${conversationId}`,
  };
}

function dealItem(activity: LeadActivityItem, leadId: JourneyCanonicalId, businessId?: JourneyCanonicalId, dealId?: JourneyCanonicalId): JourneyActivityItem | null {
  const item = baseItem(activity, leadId, businessId);
  const canonicalDealId = ref("deal", dealId || activity.metadata?.dealId);
  if (!item || !canonicalDealId) return null;
  return { ...item, kind: "deal_activity", dealId: canonicalDealId, route: `deals/${canonicalDealId}` };
}

export const journeyProjection: JourneyProjectionService = {
  getContext(leadId) {
    const lead = crmService.getLead(leadId);
    const canonicalLeadId = ref("lead", lead?.id);
    if (!lead || !canonicalLeadId) return null;
    const business = crmService.listBusinesses().find((item) => item.id === lead.businessId);
    const businessId = ref("business", business?.id);
    const job = ref("job", lead.sourceJobId);
    const conversations = crmService.getLeadConversations(lead.id);
    const deals = crmService.getLeadDeals(lead.id);
    const actions = [
      action("فتح ذكاء Business", `intelligence?business=${businessId || ""}`, "business", business?.id),
      action("فتح المحادثة", conversations[0]?.id ? `inbox/${conversations[0].id}` : "", "conversation", conversations[0]?.id),
      action("فتح الصفقة", deals[0]?.id ? `deals/${deals[0].id}` : "", "deal", deals[0]?.id),
    ].filter((item): item is JourneyAction => Boolean(item));
    return {
      ...(job ? { job: { kind: "job", id: job } } : {}),
      ...(businessId ? { business: { kind: "business", id: businessId } } : {}),
      lead: { kind: "lead", id: canonicalLeadId },
      ...(conversations[0] && ref("conversation", conversations[0].id) ? { conversation: { kind: "conversation", id: ref("conversation", conversations[0].id) as JourneyCanonicalId } } : {}),
      ...(deals[0] && ref("deal", deals[0].id) ? { deal: { kind: "deal", id: ref("deal", deals[0].id) as JourneyCanonicalId } } : {}),
      sourceId: job ? discoveryService.getDiscoveryJob(lead.sourceJobId)?.sourceId : undefined,
      actions,
    } satisfies CustomerJourneyContext;
  },
  getLeadActivity(leadId) {
    const lead = crmService.getLead(leadId);
    const canonicalLeadId = ref("lead", lead?.id);
    if (!lead || !canonicalLeadId) return [];
    const businessId = ref("business", lead.businessId);
    const items: JourneyActivityItem[] = [];
    crmService.getLeadActivities(lead.id).forEach((item) => {
      const projected = baseItem(item, canonicalLeadId, businessId || undefined);
      if (projected) items.push(projected);
    });
    crmService.getLeadTasks(lead.id).forEach((item) => {
      const projected = taskItem(item, canonicalLeadId, businessId || undefined);
      if (projected) items.push(projected);
    });
    crmService.getLeadAppointments(lead.id).forEach((item) => {
      const projected = appointmentItem(item, canonicalLeadId, businessId || undefined);
      if (projected) items.push(projected);
    });
    crmService.getLeadConversations(lead.id).forEach((conversation) => {
      messagingService.getConversationMessages(conversation.id).forEach((message) => {
        const projected = messageItem(message, canonicalLeadId, businessId || undefined);
        if (projected) items.push(projected);
      });
    });
    crmService.getLeadDeals(lead.id).forEach((deal) => {
      pipelineService.getDealActivities(deal.id).forEach((item) => {
        const canonicalDealId = ref("deal", deal.id);
        const projected = canonicalDealId ? dealItem(item, canonicalLeadId, businessId || undefined, canonicalDealId) : null;
        if (projected) items.push(projected);
      });
    });
    return items.sort((a, b) => b.timestamp.localeCompare(a.timestamp) || b.id.localeCompare(a.id));
  },
};

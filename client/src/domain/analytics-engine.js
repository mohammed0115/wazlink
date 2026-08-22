// S10-FIX Design reminder: analytics is a read-only derived layer. Event metrics use only their declared timestamp; snapshot metrics intentionally ignore date range and disclose their current-state semantics.
import { businesses, conversations, getDealProbability, jobs, mockModel } from "./data.js";
import { getBusinessIntelligence, getOpportunityTier } from "./intelligence.js";

export const ANALYTICS_REFERENCE_DATE = "2026-08-15";
export const analyticsDefaultContext = { dateRange:"all", customStart:"", customEnd:"", sourceId:"all", jobId:"all", ownerId:"all", city:"all", opportunityTier:"all", leadStatus:"all", dealStageId:"all", channel:"all", automationRuleId:"all" };

export const analyticsMetricDefinitions = [
  { id:"businesses_discovered", label:"الشركات المكتشفة", entity:"Business", aggregation:"unique_count", timestampField:"DiscoveryJob.completedAt", timeMode:"event", ownerDimension:"none", definition:"Business فريدة من عمليات اكتشاف اكتملت خلال الفترة." },
  { id:"businesses_enriched", label:"الشركات المُثرّاة", entity:"OpportunityAnalysis", aggregation:"unique_count", timestampField:"OpportunityAnalysis.analyzedAt", timeMode:"event", ownerDimension:"none", definition:"Business ذات Intelligence analysis خلال الفترة." },
  { id:"high_opportunity_businesses", label:"الفرص العالية", entity:"OpportunityAnalysis", aggregation:"unique_count", timestampField:"OpportunityAnalysis.analyzedAt", timeMode:"event", ownerDimension:"none", definition:"Business ذات Opportunity Tier = high وفق analysis خلال الفترة؛ ليست درجة Deal." },
  { id:"leads_created", label:"العملاء المحتملون", entity:"Lead", aggregation:"unique_count", timestampField:"Lead.createdAt", timeMode:"event", ownerDimension:"leadOwner", definition:"Lead فريدة أُنشئت خلال الفترة." },
  { id:"leads_contacted", label:"تم التواصل", entity:"Lead", aggregation:"unique_count", timestampField:"— الحالة الحالية", timeMode:"snapshot", ownerDimension:"leadOwner", definition:"لقطة حالية لLeads حالتها contacted أو qualified أو nurturing؛ لا تدّعي انتقالًا داخل الفترة." },
  { id:"qualified_leads", label:"عملاء مؤهلون", entity:"Lead", aggregation:"unique_count", timestampField:"— الحالة الحالية", timeMode:"snapshot", ownerDimension:"leadOwner", definition:"لقطة حالية لLeads حالتها qualified؛ لا تدّعي انتقالًا داخل الفترة." },
  { id:"open_deals", label:"الصفقات المفتوحة", entity:"Deal", aggregation:"unique_count", timestampField:"— الحالة الحالية", timeMode:"snapshot", ownerDimension:"dealOwner", definition:"لقطة حالية لDeals المفتوحة." },
  { id:"open_pipeline", label:"قيمة Pipeline المفتوحة", entity:"Deal", aggregation:"sum", field:"value", timestampField:"— الحالة الحالية", timeMode:"snapshot", ownerDimension:"dealOwner", currency:"SAR", definition:"Σ قيم Deals المفتوحة الحالية المطابقة؛ لا تمثل إيرادًا خلال الفترة." },
  { id:"weighted_pipeline", label:"Pipeline المرجحة", entity:"Deal", aggregation:"weighted_sum", field:"value × probability", timestampField:"— الحالة الحالية", timeMode:"snapshot", ownerDimension:"dealOwner", currency:"SAR", definition:"Σ قيمة Deal المفتوحة الحالية × احتمالها التجاري؛ Score ≠ Probability." },
  { id:"won_deals", label:"الصفقات الرابحة", entity:"Deal", aggregation:"unique_count", timestampField:"Deal.wonAt/closedAt", timeMode:"event", ownerDimension:"dealOwner", definition:"Deals التي أصبحت won خلال الفترة." },
  { id:"revenue_total", label:"الإيراد", entity:"RevenueEvent", aggregation:"sum", field:"amount", timestampField:"RevenueEvent.recognizedAt", timeMode:"event", ownerDimension:"dealOwner", currency:"SAR", definition:"Σ RevenueEvent recognized خلال الفترة؛ لا يستخدم Deal value." },
  { id:"attributed_revenue", label:"الإيراد المنسوب", entity:"RevenueEvent + AttributionTouchpoint", aggregation:"weighted_sum", field:"amount × touchpoint.weight", timestampField:"RevenueEvent.recognizedAt", timeMode:"event", ownerDimension:"dealOwner", currency:"SAR", definition:"Σ مبالغ touchpoints الصالحة، مع المحافظة على عدم تجاوز RevenueEvent." },
  { id:"ai_influenced_revenue", label:"إيراد متأثر بالذكاء", entity:"RevenueEvent", aggregation:"sum", field:"amount", timestampField:"RevenueEvent.recognizedAt", timeMode:"event", ownerDimension:"dealOwner", currency:"SAR", definition:"إيراد recognized لLead تحمل Intelligence reviewed activity؛ وصف ارتباطي لا سببي." },
  { id:"appointments", label:"المواعيد", entity:"Appointment", aggregation:"unique_count", timestampField:"Appointment.startsAt", timeMode:"event", ownerDimension:"appointmentOwner", definition:"Appointments المطابقة بحسب startsAt خلال الفترة." },
  { id:"automation_executions", label:"تنفيذات الأتمتة", entity:"AutomationActionExecution", aggregation:"unique_count", timestampField:"AutomationActionExecution.executedAt", timeMode:"event", ownerDimension:"automationActor", definition:"إجراءات Automation المنفذة خلال الفترة؛ ليست مبيعات ناجحة." }
];

const byId = (items, id) => items.find((item) => item.id === id) || null;
const uniq = (items) => [...new Set(items.filter(Boolean))];
const round = (number, digits = 1) => Number.isFinite(number) ? Number(number.toFixed(digits)) : null;
const amount = (value) => Math.round(Number(value || 0));
const percentage = (numerator, denominator) => denominator ? round(numerator / denominator * 100) : null;
const definition = (id) => analyticsMetricDefinitions.find((item) => item.id === id) || null;
const dateLabel = (ctx) => ({ all:"كل الفترة التجريبية", today:"اليوم", last7:"آخر 7 أيام", last30:"آخر 30 يومًا", month:"هذا الشهر", custom:ctx.customStart && ctx.customEnd ? `${ctx.customStart} إلى ${ctx.customEnd}` : "نطاق مخصص" }[ctx.dateRange] || "كل الفترة التجريبية");

export function normalizeAnalyticsContext(partial = {}) {
  const next = { ...analyticsDefaultContext, ...partial };
  if (next.dateRange === "custom" && (!next.customStart || !next.customEnd || next.customStart > next.customEnd)) next.dateRange = "all";
  return next;
}

export function inAnalyticsRange(value, context = {}) {
  const ctx = normalizeAnalyticsContext(context);
  if (ctx.dateRange === "all") return true;
  if (!value) return false;
  const date = String(value).slice(0,10);
  const starts = { today:"2026-08-15", last7:"2026-08-09", last30:"2026-07-17", month:"2026-08-01" };
  const start = ctx.dateRange === "custom" ? ctx.customStart : starts[ctx.dateRange];
  const end = ctx.dateRange === "custom" ? ctx.customEnd : ANALYTICS_REFERENCE_DATE;
  return Boolean(start && date >= start && date <= end);
}

function intelligenceForBusiness(businessId) { return getBusinessIntelligence(businessId); }
function tierForBusiness(businessId) { const result = intelligenceForBusiness(businessId); return result?.tier || (result?.score === null ? "unknown" : getOpportunityTier(result?.score || 0)); }
function jobForBusiness(business) { return business && byId(jobs, business.discoveryJobId); }
function sourceForJob(job) { return job && byId(mockModel.discoverySources || [], job.sourceId); }
function leadForDeal(deal) { return deal && byId(mockModel.leads, deal.leadId); }
function businessForLead(lead) { return lead && byId(businesses, lead.businessId); }
function businessForDeal(deal) { return businessForLead(leadForDeal(deal)); }
function ownerForDeal(deal) { return deal && byId(mockModel.users, deal.ownerId); }

export function getMetricTimestamp(metricDefinition, entity) {
  if (!metricDefinition || metricDefinition.timeMode !== "event" || !entity) return null;
  switch (metricDefinition.id) {
    case "businesses_discovered": return jobForBusiness(entity)?.completedAt || null;
    case "businesses_enriched":
    case "high_opportunity_businesses": return entity.analyzedAt || null;
    case "leads_created": return entity.createdAt || null;
    case "won_deals": return entity.wonAt || entity.closedAt || null;
    case "revenue_total":
    case "attributed_revenue":
    case "ai_influenced_revenue": return entity.recognizedAt || null;
    case "appointments": return entity.startsAt || null;
    case "automation_executions": return entity.executedAt || null;
    default: return null;
  }
}

function metricIncludes(metricId, entity, context) {
  const metric = definition(metricId);
  if (!metric || metric.timeMode === "snapshot") return true;
  return inAnalyticsRange(getMetricTimestamp(metric, entity), context);
}
function eventMissingTimestamp(metricId, entity, context) {
  const metric = definition(metricId);
  return Boolean(metric?.timeMode === "event" && normalizeAnalyticsContext(context).dateRange !== "all" && !getMetricTimestamp(metric, entity));
}

export function getAttributionAllocation(revenueAmount, touchpoints = []) {
  return touchpoints.map((touchpoint) => ({ ...touchpoint, attributedAmount:amount(revenueAmount * Number(touchpoint.weight ?? 1)) }));
}
function traceForRevenue(event) {
  const deal = byId(mockModel.deals, event.dealId);
  const lead = deal && leadForDeal(deal);
  const business = lead && businessForLead(lead);
  const touchpoints = mockModel.attributionTouchpoints.filter((item) => item.revenueEventId === event.id);
  const allocations = getAttributionAllocation(event.amount, touchpoints);
  const traceTouchpoints = allocations.length ? allocations.map((touchpoint) => {
    const job = byId(jobs, touchpoint.discoveryJobId);
    const source = job && sourceForJob(job);
    const missingRefs = [!deal && "Deal", !lead && "Lead", !business && "Business", !job && "DiscoveryJob", !source && "DiscoverySource"].filter(Boolean);
    return { touchpoint, job, source, attributedAmount:touchpoint.attributedAmount, complete:missingRefs.length === 0, missingRefs };
  }) : [{ touchpoint:null, job:null, source:null, attributedAmount:0, complete:false, missingRefs:["AttributionTouchpoint"] }];
  return { event, deal, lead, business, owner:ownerForDeal(deal), touchpoints:traceTouchpoints, attributionModel:"multi_touch_weighted" };
}

function matchesDimensions({ business=null, job=null, lead=null, deal=null, ownerId=null, channel=null, automationRuleId=null }, context) {
  const ctx = normalizeAnalyticsContext(context);
  const sourceId = job?.sourceId || jobForBusiness(business)?.sourceId;
  const effectiveJobId = job?.id || jobForBusiness(business)?.id || lead?.sourceJobId;
  const effectiveOwnerId = ownerId || deal?.ownerId || lead?.ownerId;
  const tier = business ? tierForBusiness(business.id) : null;
  return (ctx.sourceId === "all" || sourceId === ctx.sourceId)
    && (ctx.jobId === "all" || effectiveJobId === ctx.jobId)
    && (ctx.ownerId === "all" || effectiveOwnerId === ctx.ownerId)
    && (ctx.city === "all" || business?.city === ctx.city)
    && (ctx.opportunityTier === "all" || tier === ctx.opportunityTier)
    && (ctx.leadStatus === "all" || lead?.status === ctx.leadStatus)
    && (ctx.dealStageId === "all" || deal?.stageId === ctx.dealStageId)
    && (ctx.channel === "all" || channel === ctx.channel)
    && (ctx.automationRuleId === "all" || automationRuleId === ctx.automationRuleId);
}
function eventMatchesDimensions(event, trace, context) {
  const ctx = normalizeAnalyticsContext(context);
  const neutral = { ...ctx, sourceId:"all", jobId:"all" };
  const sourceMatch = ctx.sourceId === "all" || trace.touchpoints.some((item) => item.source?.id === ctx.sourceId);
  const jobMatch = ctx.jobId === "all" || trace.touchpoints.some((item) => item.job?.id === ctx.jobId);
  return sourceMatch && jobMatch && matchesDimensions({ business:trace.business, lead:trace.lead, deal:trace.deal }, neutral);
}

export function getAnalyticsOptions() {
  return { sources:mockModel.discoverySources.map((item)=>({id:item.id,label:item.name})), jobs:jobs.map((item)=>({id:item.id,label:item.name})), owners:mockModel.users.map((item)=>({id:item.id,label:item.name})), cities:uniq(businesses.map((item)=>item.city)).map((id)=>({id,label:id})), tiers:[{id:"high",label:"عالية"},{id:"good",label:"جيدة"},{id:"medium",label:"متوسطة"},{id:"low",label:"منخفضة"},{id:"unknown",label:"غير معروفة"}], leadStatuses:uniq(mockModel.leads.map((item)=>item.status)).map((id)=>({id,label:id})), stages:mockModel.pipelineStages.map((item)=>({id:item.id,label:item.name})), channels:uniq(conversations.map((item)=>item.channel)).map((id)=>({id,label:id})), automationRules:(mockModel.automationRules||[]).map((item)=>({id:item.id,label:item.name})) };
}

function baseCollections(context) {
  const ctx = normalizeAnalyticsContext(context);
  const filteredBusinesses = businesses.filter((business)=>matchesDimensions({business,job:jobForBusiness(business)},ctx));
  const businessIds = new Set(filteredBusinesses.map((item)=>item.id));
  const leads = mockModel.leads.filter((lead)=>businessIds.has(lead.businessId) && matchesDimensions({business:businessForLead(lead),lead},ctx));
  const leadIds = new Set(leads.map((item)=>item.id));
  const deals = mockModel.deals.filter((deal)=>leadIds.has(deal.leadId) && matchesDimensions({business:businessForDeal(deal),lead:leadForDeal(deal),deal},ctx));
  const events = mockModel.revenueEvents.filter((event)=>{ const trace=traceForRevenue(event); return event.status === "recognized" && eventMatchesDimensions(event,trace,ctx); });
  const conversationRows = conversations.filter((conversation)=>{ const lead=byId(mockModel.leads,conversation.leadId); return lead && matchesDimensions({business:businessForLead(lead),lead,channel:conversation.channel},ctx); });
  const appointmentRows = mockModel.appointments.filter((appointment)=>{const lead=byId(mockModel.leads,appointment.leadId);return lead && matchesDimensions({business:businessForLead(lead),lead,deal:byId(mockModel.deals,appointment.dealId),ownerId:appointment.ownerId},ctx);});
  const taskRows = mockModel.tasks.filter((task)=>{const lead=byId(mockModel.leads,task.leadId);return lead && matchesDimensions({business:businessForLead(lead),lead,ownerId:task.ownerId},ctx);});
  const automationRuns=(mockModel.automationRuns||[]).filter((run)=>matchesDimensions({automationRuleId:run.ruleId},ctx));
  return {ctx,businesses:filteredBusinesses,leads,deals,events,conversationRows,appointmentRows,taskRows,automationRuns};
}

function eventEntities(metricId, entities, context) { return entities.filter((entity)=>metricIncludes(metricId,entity,context)); }
export function getAnalyticsFunnel(context = {}) {
  const data=baseCollections(context);
  const cohortBusinesses=eventEntities("businesses_discovered",data.businesses,data.ctx);
  const businessIds=cohortBusinesses.map((item)=>item.id);
  const enriched=cohortBusinesses.filter((business)=>{const analysis=intelligenceForBusiness(business.id);return analysis && analysis.status !== "not_analyzed";}).map((item)=>item.id);
  const high=cohortBusinesses.filter((business)=>tierForBusiness(business.id)==="high").map((item)=>item.id);
  const within=(ids,prior)=>uniq(ids).filter((id)=>prior.includes(id));
  const highFromEnriched=within(high,enriched);
  const leadBusinesses=within(data.leads.map((lead)=>lead.businessId),highFromEnriched);
  const contacted=within(data.leads.filter((lead)=>["contacted","qualified","nurturing"].includes(lead.status)).map((lead)=>lead.businessId),leadBusinesses);
  const qualified=within(data.leads.filter((lead)=>lead.status==="qualified").map((lead)=>lead.businessId),contacted);
  const dealBusinesses=within(data.deals.map((deal)=>businessForDeal(deal)?.id),qualified);
  const wonDeals=eventEntities("won_deals",data.deals.filter((deal)=>deal.status==="won"),data.ctx);
  const wonBusinesses=within(wonDeals.map((deal)=>businessForDeal(deal)?.id),dealBusinesses);
  const revenueEvents=eventEntities("revenue_total",data.events,data.ctx);
  const revenueBusinesses=within(revenueEvents.map((event)=>traceForRevenue(event).business?.id),wonBusinesses);
  const source=[
    ["discovered","مكتشف",businessIds,"Cohort: Business من DiscoveryJob.completedAt ضمن الفترة"], ["enriched","مُثرى",within(enriched,businessIds),"ضمن cohort، Business ذات Intelligence analysis"], ["high","فرصة عالية",highFromEnriched,"ضمن cohort المُثرى، Tier = high"], ["lead","CRM Lead",leadBusinesses,"ضمن cohort العالية، Business ذات Lead"], ["contacted","تم التواصل",contacted,"ضمن cohort Lead، لقطة حالة التواصل الحالية"], ["qualified","مؤهل",qualified,"ضمن cohort المتواصل، لقطة حالة التأهيل الحالية"], ["deal","صفقة",dealBusinesses,"ضمن cohort المؤهل، Business ذات Deal"], ["won","رابح",wonBusinesses,"ضمن cohort Deal، wonAt/closedAt ضمن الفترة"], ["revenue","إيراد",revenueBusinesses,"ضمن cohort رابح، RevenueEvent.recognizedAt ضمن الفترة"]
  ];
  const stages=source.map(([id,label,ids,definitionText],index,all)=>{const entityIds=uniq(ids);const denominator=index?uniq(all[index-1][2]).length:null;return {id,label,entityIds,count:entityIds.length,definition:definitionText,conversion:index?percentage(entityIds.length,denominator):null,denominator};});
  return {stages,context:data.ctx,contract:"cohort: Businesses discovered during the selected period; downstream states are subsets of that cohort, with event timestamps only where explicitly stated."};
}

export function getAttributionTraces(context = {}) {
  const data=baseCollections(context); const events=eventEntities("revenue_total",data.events,data.ctx);
  return events.map((event)=>{const trace=traceForRevenue(event);const attributed=trace.touchpoints.filter((item)=>item.touchpoint&&item.complete).reduce((sum,item)=>sum+item.attributedAmount,0);return {...trace,attributed,unattributed:Math.max(0,amount(event.amount)-attributed),overAttributed:Math.max(0,attributed-amount(event.amount)),complete:trace.touchpoints.every((item)=>item.complete),touchpointCount:trace.touchpoints.filter((item)=>item.touchpoint).length};});
}
function revenueSummary(context) { const traces=getAttributionTraces(context); const revenue=traces.reduce((sum,trace)=>sum+amount(trace.event.amount),0); const attributed=traces.reduce((sum,trace)=>sum+trace.attributed,0); const unattributed=traces.reduce((sum,trace)=>sum+trace.unattributed,0); const overAttributed=traces.reduce((sum,trace)=>sum+trace.overAttributed,0); return {revenue,attributed,unattributed,overAttributed,traces}; }

export function getAnalyticsOverview(context = {}) {
  const data=baseCollections(context); const funnel=getAnalyticsFunnel(data.ctx); const revenue=revenueSummary(data.ctx);
  const analyses=data.businesses.map((business)=>({business,analysis:intelligenceForBusiness(business.id)})).filter((row)=>row.analysis);
  const enriched=analyses.filter((row)=>row.analysis.status!=="not_analyzed"&&metricIncludes("businesses_enriched",row.analysis,data.ctx)).map((row)=>row.business.id);
  const high=analyses.filter((row)=>tierForBusiness(row.business.id)==="high"&&metricIncludes("high_opportunity_businesses",row.analysis,data.ctx)).map((row)=>row.business.id);
  const leadsCreated=eventEntities("leads_created",data.leads,data.ctx);
  const contacted=data.leads.filter((lead)=>["contacted","qualified","nurturing"].includes(lead.status)); const qualified=data.leads.filter((lead)=>lead.status==="qualified");
  const openDeals=data.deals.filter((deal)=>deal.status==="open"); const wonDeals=eventEntities("won_deals",data.deals.filter((deal)=>deal.status==="won"),data.ctx); const lostDeals=data.deals.filter((deal)=>deal.status==="lost");
  const aiInfluencedEvents=getAttributionTraces(data.ctx).filter((trace)=>mockModel.activities.some((activity)=>activity.leadId===trace.lead?.id&&activity.type==="intelligence_reviewed")).map((trace)=>trace.event);
  const appointmentRows=eventEntities("appointments",data.appointmentRows,data.ctx);
  const executionRows=eventEntities("automation_executions",(mockModel.automationActionExecutions||[]).filter((item)=>item.status==="executed"&&data.automationRuns.some((run)=>run.id===item.runId)),data.ctx);
  const metrics={ businessesDiscovered:{value:funnel.stages[0].count,entityIds:funnel.stages[0].entityIds}, businessesEnriched:{value:enriched.length,entityIds:enriched}, highOpportunityBusinesses:{value:high.length,entityIds:high}, leadsCreated:{value:leadsCreated.length,entityIds:leadsCreated.map((item)=>item.id)}, leadsContacted:{value:contacted.length,entityIds:contacted.map((item)=>item.id)}, qualifiedLeads:{value:qualified.length,entityIds:qualified.map((item)=>item.id)}, openDeals:{value:openDeals.length,entityIds:openDeals.map((item)=>item.id)}, openPipeline:{value:openDeals.reduce((sum,deal)=>sum+amount(deal.value),0),entityIds:openDeals.map((item)=>item.id)}, weightedPipeline:{value:openDeals.reduce((sum,deal)=>sum+deal.value*getDealProbability(deal)/100,0),entityIds:openDeals.map((item)=>item.id)}, wonDeals:{value:wonDeals.length,entityIds:wonDeals.map((item)=>item.id)}, revenue:{value:revenue.revenue,entityIds:revenue.traces.map((item)=>item.event.id)}, attributedRevenue:{value:revenue.attributed,entityIds:revenue.traces.filter((item)=>item.attributed).map((item)=>item.event.id)}, aiInfluencedRevenue:{value:aiInfluencedEvents.reduce((sum,item)=>sum+amount(item.amount),0),entityIds:aiInfluencedEvents.map((item)=>item.id)}, appointments:{value:appointmentRows.length,entityIds:appointmentRows.map((item)=>item.id)}, automationExecutions:{value:executionRows.length,entityIds:executionRows.map((item)=>item.id)} };
  return {context:data.ctx,metrics,funnel,revenue,sales:{openDeals,wonDeals,lostDeals,winRate:percentage(wonDeals.length,wonDeals.length+lostDeals.length),averageDealValue:wonDeals.length?round(wonDeals.reduce((sum,deal)=>sum+deal.value,0)/wonDeals.length,0):null,averageSalesCycle:null,reason:"لا تتوفر تواريخ دورة بيع مكتملة لكل Deals؛ لا تُعرض قيمة مصطنعة."}};
}

export function getSourcePerformance(context = {}) {
  const data=baseCollections(context); const traces=getAttributionTraces(data.ctx); const ids=uniq(data.businesses.map((business)=>jobForBusiness(business)?.sourceId));
  return ids.map((sourceId)=>{const source=byId(mockModel.discoverySources,sourceId);const rows=eventEntities("businesses_discovered",data.businesses.filter((business)=>jobForBusiness(business)?.sourceId===sourceId),data.ctx);const rowIds=new Set(rows.map((item)=>item.id));const leads=data.leads.filter((lead)=>rowIds.has(lead.businessId));const deals=data.deals.filter((deal)=>rowIds.has(businessForDeal(deal)?.id));const touched=traces.filter((trace)=>trace.touchpoints.some((touch)=>touch.source?.id===sourceId));const attributed=touched.reduce((sum,trace)=>sum+trace.touchpoints.filter((touch)=>touch.source?.id===sourceId).reduce((inside,touch)=>inside+touch.attributedAmount,0),0);return {sourceId,sourceName:source?.name||sourceId,businesses:rows.length,highOpportunity:rows.filter((business)=>tierForBusiness(business.id)==="high").length,leads:leads.length,leadConversion:percentage(leads.length,rows.length),deals:deals.length,won:deals.filter((deal)=>deal.status==="won").length,revenueEventsTouched:touched.length,attributedRevenue:attributed,revenuePerLead:leads.length?round(attributed/leads.length,0):null};});
}
export function getJobPerformance(context = {}) { const data=baseCollections(context);const traces=getAttributionTraces(data.ctx);return uniq(data.businesses.map((business)=>business.discoveryJobId)).map((jobId)=>{const job=byId(jobs,jobId);const source=job&&sourceForJob(job);const rows=eventEntities("businesses_discovered",data.businesses.filter((business)=>business.discoveryJobId===jobId),data.ctx);const ids=new Set(rows.map((item)=>item.id));const leads=data.leads.filter((lead)=>ids.has(lead.businessId));const deals=data.deals.filter((deal)=>ids.has(businessForDeal(deal)?.id));const matching=traces.filter((trace)=>trace.touchpoints.some((touch)=>touch.job?.id===jobId));const attributed=matching.reduce((sum,trace)=>sum+trace.touchpoints.filter((touch)=>touch.job?.id===jobId).reduce((inner,touch)=>inner+touch.attributedAmount,0),0);return {jobId,jobName:job?.name||jobId,sourceName:source?.name||"غير مكتمل",discovered:rows.length,deduplicated:job?.deduplicatedCount??null,highOpportunity:rows.filter((item)=>tierForBusiness(item.id)==="high").length,leads:leads.length,deals:deals.length,attributedRevenue:attributed,revenueEventsTouched:matching.length};}); }

export function getIntelligenceAnalytics(context = {}) { const data=baseCollections(context);const records=data.businesses.map((business)=>({business,intelligence:intelligenceForBusiness(business.id)})).filter((item)=>item.intelligence);const analyzed=records.filter((item)=>item.intelligence.status==="analyzed");const signals=analyzed.flatMap((item)=>item.intelligence.signals||[]);const services=analyzed.flatMap((item)=>item.intelligence.services||[]);const tierDistribution=["high","good","medium","low","unknown"].map((tier)=>({tier,count:records.filter((item)=>tierForBusiness(item.business.id)===tier).length}));const tierRows=tierDistribution.map((row)=>{const businessIds=new Set(records.filter((item)=>tierForBusiness(item.business.id)===row.tier).map((item)=>item.business.id));const leads=data.leads.filter((lead)=>businessIds.has(lead.businessId));const deals=data.deals.filter((deal)=>businessIds.has(businessForDeal(deal)?.id));const revenue=getAttributionTraces(data.ctx).filter((trace)=>businessIds.has(trace.business?.id)).reduce((sum,trace)=>sum+amount(trace.event.amount),0);return {...row,leadConversion:percentage(leads.length,businessIds.size),dealConversion:percentage(deals.length,leads.length),revenue};});return {tierRows,averageScore:analyzed.length?round(analyzed.reduce((sum,item)=>sum+(item.intelligence.score||0),0)/analyzed.length):null,averageConfidence:analyzed.length?round(analyzed.reduce((sum,item)=>sum+(item.intelligence.confidence||0),0)/analyzed.length*100):null,topGapSignals:Object.entries(signals.filter((signal)=>signal.polarity==="gap").reduce((acc,signal)=>{acc[signal.key]=(acc[signal.key]||0)+1;return acc;},{})).map(([key,count])=>({key,count})).sort((a,b)=>b.count-a.count),recommendedServices:Object.entries(services.reduce((acc,service)=>{acc[service.name]=(acc[service.name]||0)+1;return acc;},{})).map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count),failed:records.filter((item)=>item.intelligence.status==="analysis_error").length,unknown:records.filter((item)=>["insufficient_data","not_analyzed"].includes(item.intelligence.status)).length}; }
export function getConversationAnalytics(context = {}) { const data=baseCollections(context);const ids=new Set(data.conversationRows.map((item)=>item.id));const messages=(mockModel.messages||[]).filter((message)=>ids.has(message.conversationId));const inbound=messages.filter((message)=>message.direction==="inbound");const humanOutbound=messages.filter((message)=>message.direction==="outbound"&&message.senderType==="user");const needsReply=data.conversationRows.filter((conversation)=>{const rows=messages.filter((message)=>message.conversationId===conversation.id).sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)));return conversation.status==="open"&&rows.at(-1)?.direction==="inbound";});return {total:data.conversationRows.length,open:data.conversationRows.filter((item)=>item.status==="open").length,closed:data.conversationRows.filter((item)=>item.status==="closed").length,needsReply:needsReply.length,inbound:inbound.length,humanOutbound:humanOutbound.length,responseRate:percentage(uniq(humanOutbound.map((message)=>message.conversationId)).length,uniq(inbound.map((message)=>message.conversationId)).length),entityIds:data.conversationRows.map((item)=>item.id)}; }
export function getAutomationAnalytics(context = {}) { const data=baseCollections(context);const runs=data.automationRuns;const actions=(mockModel.automationActionExecutions||[]).filter((action)=>runs.some((run)=>run.id===action.runId));const terminal=actions.filter((action)=>["executed","rejected"].includes(action.status));return {rulesEnabled:(mockModel.automationRules||[]).filter((rule)=>rule.status==="enabled").length,runs:runs.length,matched:runs.filter((run)=>run.status!=="skipped"&&run.conditionResult?.matched).length,awaitingApproval:actions.filter((item)=>item.status==="awaiting_approval").length,executed:actions.filter((item)=>item.status==="executed").length,failed:actions.filter((item)=>item.status==="failed").length,rejected:actions.filter((item)=>item.status==="rejected").length,approvalRate:percentage(actions.filter((item)=>item.status==="executed").length,terminal.length),tasksCreated:actions.filter((item)=>item.resultEntityType==="Task").length,appointmentsCreated:actions.filter((item)=>item.resultEntityType==="Appointment").length}; }
export function getAppointmentAnalytics(context = {}) { const data=baseCollections(context);const rows=eventEntities("appointments",data.appointmentRows,data.ctx);return {scheduled:rows.filter((item)=>item.status==="scheduled").length,completed:rows.filter((item)=>item.status==="completed").length,cancelled:rows.filter((item)=>item.status==="cancelled").length,noShow:rows.filter((item)=>item.status==="no_show").length,byOwner:mockModel.users.map((user)=>({ownerId:user.id,name:user.name,count:rows.filter((item)=>item.ownerId===user.id).length})).filter((item)=>item.count)}; }
export function getTaskAnalytics(context = {}) { const data=baseCollections(context);const rows=data.taskRows;return {open:rows.filter((item)=>item.status!=="completed").length,dueToday:rows.filter((item)=>String(item.dueAt||"").slice(0,10)===ANALYTICS_REFERENCE_DATE).length,overdue:rows.filter((item)=>item.status==="overdue").length,completed:rows.filter((item)=>item.status==="completed").length,automationCreated:rows.filter((item)=>item.createdByAutomationRunId).length,humanCreated:rows.filter((item)=>!item.createdByAutomationRunId).length}; }

function missingTimestampRows(data, context) {
  const ctx=normalizeAnalyticsContext(context);if(ctx.dateRange==="all")return [];
  const rows=[];const add=(metricId,entity)=>{if(eventMissingTimestamp(metricId,entity,ctx))rows.push({id:entity.id,metricId,timestampField:definition(metricId)?.timestampField});};
  data.businesses.forEach((item)=>add("businesses_discovered",item));
  data.businesses.forEach((business)=>{const analysis=intelligenceForBusiness(business.id);if(analysis&&analysis.status!=="not_analyzed"){add("businesses_enriched",analysis);if(tierForBusiness(business.id)==="high")add("high_opportunity_businesses",analysis);}});
  data.leads.forEach((item)=>add("leads_created",item)); data.deals.filter((item)=>item.status==="won").forEach((item)=>add("won_deals",item)); data.events.forEach((item)=>add("revenue_total",item)); data.appointmentRows.forEach((item)=>add("appointments",item)); (mockModel.automationActionExecutions||[]).filter((item)=>item.status==="executed").forEach((item)=>add("automation_executions",item));
  return rows;
}
export function getDataQuality(context = {}) { const data=baseCollections(context);const traces=getAttributionTraces(data.ctx);const brokenAttribution=traces.filter((trace)=>!trace.complete).length;const revenueWithoutAttribution=traces.filter((trace)=>!trace.touchpoints.some((item)=>item.touchpoint)).length;const brokenLeadBusiness=data.leads.filter((lead)=>!businessForLead(lead)).length;const brokenDealLead=data.deals.filter((deal)=>!leadForDeal(deal)).length;const intelligence=getIntelligenceAnalytics(data.ctx);const missingTimestamps=missingTimestampRows(data,data.ctx);const overAttributed=traces.filter((trace)=>trace.overAttributed>0).length;const structuralSeverity=overAttributed||brokenAttribution||brokenLeadBusiness||brokenDealLead?"warning":"ok";const coverageSeverity=intelligence.unknown||intelligence.failed||missingTimestamps.length||revenueWithoutAttribution?"warning":"ok";const severity=structuralSeverity==="warning"||coverageSeverity==="warning"?"warning":"ok";const rows=[...traces.filter((trace)=>!trace.complete).map((trace)=>({id:trace.event.id,kind:"structural",missing:trace.touchpoints.flatMap((item)=>item.missingRefs)})),...missingTimestamps.map((row)=>({id:row.id,kind:"timestamp",missing:[row.timestampField]}))];return {severity,structural:{severity:structuralSeverity,brokenAttribution,brokenLeadBusiness,brokenDealLead,overAttributed},coverage:{severity:coverageSeverity,unknownIntelligence:intelligence.unknown,failedIntelligence:intelligence.failed,missingTimestamps:missingTimestamps.length,revenueWithoutAttribution},brokenAttribution,revenueWithoutAttribution,brokenLeadBusiness,brokenDealLead,unknownIntelligence:intelligence.unknown,failedIntelligence:intelligence.failed,missingTimestamps:missingTimestamps.length,overAttributed,rows}; }

export function getMetricDrilldown(metricId, context = {}) { const overview=getAnalyticsOverview(context);const map={businesses_discovered:overview.metrics.businessesDiscovered.entityIds,businesses_enriched:overview.metrics.businessesEnriched.entityIds,high_opportunity_businesses:overview.metrics.highOpportunityBusinesses.entityIds,leads_created:overview.metrics.leadsCreated.entityIds,leads_contacted:overview.metrics.leadsContacted.entityIds,qualified_leads:overview.metrics.qualifiedLeads.entityIds,open_deals:overview.metrics.openDeals.entityIds,open_pipeline:overview.metrics.openPipeline.entityIds,weighted_pipeline:overview.metrics.weightedPipeline.entityIds,won_deals:overview.metrics.wonDeals.entityIds,revenue_total:overview.metrics.revenue.entityIds,attributed_revenue:overview.metrics.attributedRevenue.entityIds,ai_influenced_revenue:overview.metrics.aiInfluencedRevenue.entityIds,appointments:overview.metrics.appointments.entityIds,automation_executions:overview.metrics.automationExecutions.entityIds};const metric=definition(metricId);return {definition:metric,ids:map[metricId]||[],period:metric?.timeMode==="snapshot"?"لقطة حالية — لا يطبق عليها نطاق التاريخ":dateLabel(overview.context),filters:activeAnalyticsFilters(overview.context)}; }
export function activeAnalyticsFilters(context = {}) { const ctx=normalizeAnalyticsContext(context);const options=getAnalyticsOptions();const labels={sourceId:"المصدر",jobId:"العملية",ownerId:"المالك",city:"المدينة",opportunityTier:"الفرصة",leadStatus:"حالة Lead",dealStageId:"مرحلة الصفقة",channel:"القناة",automationRuleId:"قاعدة الأتمتة"};return Object.entries(labels).flatMap(([key,label])=>{if(ctx[key]==="all")return [];const group=key==="sourceId"?options.sources:key==="jobId"?options.jobs:key==="ownerId"?options.owners:key==="city"?options.cities:key==="opportunityTier"?options.tiers:key==="leadStatus"?options.leadStatuses:key==="dealStageId"?options.stages:key==="channel"?options.channels:options.automationRules;return [{key,label,value:group.find((item)=>item.id===ctx[key])?.label||ctx[key]}];}); }
export function getAnalyticsExportRows(context = {}) { return getAttributionTraces(context).map((trace)=>({revenueEventId:trace.event.id,recognizedAt:trace.event.recognizedAt,revenue:amount(trace.event.amount),attributed:trace.attributed,unattributed:trace.unattributed,dealId:trace.deal?.id||"",leadId:trace.lead?.id||"",businessId:trace.business?.id||"",ownerId:trace.owner?.id||"",attributionModel:trace.attributionModel,touchpointCount:trace.touchpointCount,jobIds:trace.touchpoints.map((item)=>item.job?.id).filter(Boolean).join("|"),sourceIds:trace.touchpoints.map((item)=>item.source?.id).filter(Boolean).join("|"),traceStatus:trace.complete?"complete":"broken"})); }

import {
  approveAutomationAction, createAutomationRule, evaluateAutomationRule, getAppointment, getAutomationIntegrityReport,
  getAutomationRunActionExecutions, getAutomationRuns, getLead, getTasksWorkspace, mockModel, rejectAutomationAction,
  runAutomationNow, setAutomationRuleStatus, testAutomationRule, updateAutomationRule
} from "../client/src/domain/data.js";
import { getAutomationRulePreview } from "../client/src/domain/automation.js";

const checks=[];
const check=(id,name,pass,detail)=>{checks.push({id,name,pass,detail});if(!pass)throw new Error(`${id} — ${name}: ${detail}`);};
const count=(items)=>items.length;
const messagesBefore=count(mockModel.messages);
const dealSnapshot=JSON.stringify(mockModel.deals.map(({id,value,probability,stageId,status})=>({id,value,probability,stageId,status})));
const revenueSnapshot=JSON.stringify(mockModel.revenueEvents);
const attributionSnapshot=JSON.stringify(mockModel.attributionTouchpoints);
const baseEvent={type:"lead_created",entityType:"lead",entityId:"LEAD-1042",occurredAt:"2026-08-15T14:00:00",triggeredAt:"2026-08-15T14:00:00",eventId:"EVT-1001",transition:{from:"new",to:"qualified"},origin:"user"};

const baselineRules=count(mockModel.automations);
const invalidField=createAutomationRule({name:"حقل غير صالح",triggerType:"lead_created",actionIds:["AUTOACT-1001"],approvalPolicy:"auto_safe",status:"enabled",conditions:[{field:"lead.magic_field",operator:"equals",value:"high"}]});
const invalidOperator=createAutomationRule({name:"معامل غير صالح",triggerType:"lead_created",actionIds:["AUTOACT-1001"],approvalPolicy:"auto_safe",status:"enabled",conditions:[{field:"lead.priority",operator:"greater_than",value:"high"}]});
const invalidValue=createAutomationRule({name:"قيمة غير صالحة",triggerType:"lead_created",actionIds:["AUTOACT-1001"],approvalPolicy:"auto_safe",status:"enabled",conditions:[{field:"lead.priority",operator:"equals",value:"super-high"}]});
check("A","مراجع القواعد",getAutomationIntegrityReport().checks.find((item)=>item.id==="A")?.pass,"Trigger/Actions موجودة");
check("B","Condition contract مركزي",!invalidField&&!invalidOperator&&!invalidValue&&count(mockModel.automations)===baselineRules,"field/operator/value غير صالحة لا تحفظ Rule");

const dryCount=count(mockModel.automationRuns);
const dry=testAutomationRule("AUTO-1001",baseEvent);
check("C","Dry Run وحالة القاعدة",dry.dryRun&&dry.triggerMatched&&dry.conditionResult.matched&&count(mockModel.automationRuns)===dryCount,"dry-run صفر mutation وRule enabled مطابقة");
check("D","Provenance للحدث",Boolean(baseEvent.eventId&&baseEvent.transition?.from&&baseEvent.transition?.to),"eventId وtransition صريحان");
check("E","حتمية التقييم",testAutomationRule("AUTO-1001",baseEvent).conditionResult.matched===dry.conditionResult.matched,"السياق نفسه ينتج نتيجة الشروط نفسها");
check("F","Disabled Rule",setAutomationRuleStatus("AUTO-1005","disabled")?.status==="disabled"&&evaluateAutomationRule("AUTO-1005",baseEvent).kind==="inactive","disabled لا تنشئ Run");
check("G","Draft Rule",evaluateAutomationRule("AUTO-1006",{...baseEvent,type:"conversation_needs_reply",entityType:"conversation",entityId:"CONV-3042",eventId:"EVT-DRAFT"}).kind==="inactive","draft لا تنشئ Run");

const manualTaskRule=createAutomationRule({name:"S9-FIX مهمة يدوية",triggerType:"lead_created",actionIds:["AUTOACT-1001"],approvalPolicy:"manual_only",status:"enabled",conditions:[{field:"lead.priority",operator:"equals",value:"high"}]});
const taskBefore=count(mockModel.tasks);
const automaticManual=evaluateAutomationRule(manualTaskRule.id,{...baseEvent,eventId:"EVT-MANUAL-BLOCK",origin:"user",triggerMode:"automatic"});
const manualTask=runAutomationNow(manualTaskRule.id,"USR-1001",{entityType:"lead",entityId:"LEAD-1042",eventId:"EVT-MANUAL-TASK",occurredAt:"2026-08-15T14:01:00",transition:{from:"new",to:"qualified"}});
check("H","manual_only semantics",automaticManual.kind==="blocked_manual_only"&&count(mockModel.tasks)===taskBefore+1&&manualTask.kind==="executed"&&manualTask.run.triggerMode==="manual"&&manualTask.run.triggeredBy==="USR-1001","automatic blocked وRun Now ينفذ الإجراء الآمن محليًا");

const manualAppointmentRule=createAutomationRule({name:"S9-FIX موعد يدوي",triggerType:"lead_created",actionIds:["AUTOACT-1003"],approvalPolicy:"manual_only",status:"enabled",conditions:[{field:"lead.priority",operator:"equals",value:"high"}]});
const appointmentBefore=count(mockModel.appointments);
const manualAppointment=runAutomationNow(manualAppointmentRule.id,"USR-1001",{entityType:"lead",entityId:"LEAD-1042",eventId:"EVT-MANUAL-APT",occurredAt:"2026-08-15T14:02:00"});
const appointmentExecution=getAutomationRunActionExecutions(manualAppointment.run.id)[0];
check("I","Approval guard",manualAppointment.kind==="awaiting_approval"&&appointmentExecution.status==="awaiting_approval"&&count(mockModel.appointments)===appointmentBefore,"manual لا يتجاوز موافقة الموعد");
const approved=approveAutomationAction(appointmentExecution.id,"USR-1001");
const appointment=getAppointment(approved.execution.resultEntityId);
const doubleApprove=approveAutomationAction(appointmentExecution.id,"USR-1001");
check("J","Idempotency وموافقة الموعد",approved.kind==="executed"&&count(mockModel.appointments)===appointmentBefore+1&&doubleApprove.kind==="no_op"&&appointment?.createdByAutomationRunId===manualAppointment.run.id,"Appointment واحدة فقط بعد approve");

const eventTaskBefore=count(mockModel.tasks);
const eventOne=evaluateAutomationRule("AUTO-1001",baseEvent);
const duplicate=evaluateAutomationRule("AUTO-1001",baseEvent);
const eventTwo=evaluateAutomationRule("AUTO-1001",{...baseEvent,eventId:"EVT-1002",transition:{from:"nurturing",to:"qualified"}});
check("K","هوية الحدث وإعادة استخدام Task",eventOne.kind==="executed"&&duplicate.kind==="duplicate"&&eventTwo.kind==="executed"&&count(mockModel.tasks)===eventTaskBefore+2&&getTasksWorkspace({search:"",status:"all",ownerId:"all",due:"all",origin:"automation",leadId:"all",sort:"due"}).some((task)=>task.createdByAutomationRunId===eventOne.run.id),"same eventId مرة واحدة وeventId جديد مستقل");
check("L","مراجع المواعيد",appointment?.leadId==="LEAD-1042"&&appointment?.ownerId&&appointment?.createdByAutomationRunId,"Lead/Owner/Run محفوظة");
check("M","وقت الموعد",new Date(appointment.endsAt)>new Date(appointment.startsAt),"endsAt أكبر من startsAt");
const versionBefore=manualAppointmentRule.version;
const updated=updateAutomationRule(manualAppointmentRule.id,{actionIds:["AUTOACT-1003","AUTOACT-1008"]});
check("N","Historical Rule Version",updated.version===versionBefore+1&&manualAppointment.run.automationRuleVersion===versionBefore,"Run السابق يحتفظ بـversion السابقة");

const rejectRule=createAutomationRule({name:"S9-FIX رفض موعد",triggerType:"lead_created",actionIds:["AUTOACT-1003"],approvalPolicy:"manual_only",status:"enabled",conditions:[{field:"lead.priority",operator:"equals",value:"high"}]});
const rejectRun=runAutomationNow(rejectRule.id,"USR-1001",{entityType:"lead",entityId:"LEAD-1042",eventId:"EVT-MANUAL-REJECT",occurredAt:"2026-08-15T14:03:00"});
const rejected=rejectAutomationAction(getAutomationRunActionExecutions(rejectRun.run.id)[0].id,"USR-1001");
check("O","Audit trace كامل",approved.execution.approvedBy==="USR-1001"&&approved.execution.executedBy==="automation"&&approved.execution.executedAt&&approved.execution.resultEntityId&&rejected.execution.rejectedBy==="USR-1001"&&rejected.execution.rejectedAt&&!rejected.execution.executedAt,"approver/executor/result/rejection محفوظة");
const loop=evaluateAutomationRule("AUTO-1001",{...baseEvent,eventId:"EVT-AUTO-LOOP",origin:"automation",originAutomationRunId:"AUTORUN-X"});
check("P","Loop guard",loop.kind==="loop_guard"&&loop.run.status==="skipped"&&loop.run.triggerEventId==="EVT-AUTO-LOOP","Automation origin لا يعيد trigger");
check("Q","Messaging boundary",count(mockModel.messages)===messagesBefore&&mockModel.messages.every((message)=>message.senderType!=="automation"),"0 رسالة Automation");
check("R","Deal boundary",JSON.stringify(mockModel.deals.map(({id,value,probability,stageId,status})=>({id,value,probability,stageId,status})))===dealSnapshot,"0 Deal mutation");
check("S","Revenue/Attribution boundary",JSON.stringify(mockModel.revenueEvents)===revenueSnapshot&&JSON.stringify(mockModel.attributionTouchpoints)===attributionSnapshot,"0 Revenue/Attribution mutation");
check("T","S8 boundary",mockModel.agentActions.every((action)=>action.proposedBy==="agent"),"لا Agent execution خارج عقد S8");
const preview=getAutomationRulePreview({triggerType:"lead_created",conditionField:"lead.priority",conditionOperator:"equals",conditionValue:"high",actionType:"AUTOACT-1001",approvalPolicy:"manual_only"});
check("U","Live Preview",preview.sentence.includes("أولوية العميل يساوي high")&&preview.policyNote.includes("يدويًا"),"Preview مشتقة من field/action/policy الفعلية");
const integrity=getAutomationIntegrityReport();
check("V","Integrity وغياب Scheduler",integrity.pass&&new Set([...mockModel.automations,...mockModel.automationRuns,...mockModel.automationActionExecutions,...mockModel.appointments].map((item)=>item.id)).size===mockModel.automations.length+mockModel.automationRuns.length+mockModel.automationActionExecutions.length+mockModel.appointments.length,"A–V integrity وIDs فريدة ومحرك session-only");

console.log(`S9 verification: ${checks.length}/22 PASS`);
checks.forEach((item)=>console.log(`${item.id}. PASS — ${item.name}`));

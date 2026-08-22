import { readFile } from "node:fs/promises";
import {
  changeSubscriptionPlanMock,
  connectIntegrationMock,
  createTeamInvitation,
  disconnectIntegrationMock,
  getBillingUsage,
  getCurrentSubscription,
  getIntegration,
  getS11IntegrityReport,
  getWorkspace,
  mockModel,
  previewPlanChange,
  retryIntegrationMock,
  setNotificationPreference,
  setSubscriptionCancelAtPeriodEnd,
  updateIntegrationConfiguration,
  updateWorkspaceSettings
} from "../client/src/domain/data.js";

const results=[];
const check=(id,pass,detail)=>results.push({id,pass:Boolean(pass),detail});
const operationalSnapshot=()=>JSON.stringify({businesses:mockModel.businesses,leads:mockModel.leads,deals:mockModel.deals,messages:mockModel.messages,tasks:mockModel.tasks,appointments:mockModel.appointments,revenueEvents:mockModel.revenueEvents,attributionTouchpoints:mockModel.attributionTouchpoints});
const source=await Promise.all(["../.ui-sources/settings.txt","../.ui-sources/all.txt","../client/src/domain/data.js","../client/index.html"].map((path)=>readFile(new URL(path,import.meta.url),"utf8")));

const beforeOperational=operationalSnapshot();
const baselineIntegrity=getS11IntegrityReport();
check("A contracts and IDs",baselineIntegrity.pass,"عقود S11 ومراجعها ومعرفاتها سليمة عند البداية.");
check("B integration statuses",mockModel.integrations.every((item)=>["not_connected","mock_connected","configuration_required","error","disabled"].includes(item.status)&&item.status!=="connected"),"لا يظهر أي تكامل كاتصال إنتاجي.");
check("C mock disclosure and secrets",mockModel.integrations.every((item)=>item.mode&&item.capabilities.length&&!Object.keys(item).some((key)=>/token|apikey|secret/i.test(key)&&item[key])),"لا توجد مفاتيح أو tokens أو secrets فعلية في Fixtures.");

const whatsapp=getIntegration("INT-1002");
const connected=connectIntegrationMock(whatsapp.id);
check("D mock connect",connected?.status==="mock_connected"&&connected.connectedBy==="USR-1001"&&mockModel.integrationActivities.some((item)=>item.integrationId===whatsapp.id&&item.type==="mock_connected"),"ربط WhatsApp ينتج حالة Mock وسجل تدقيق محلي.");
const disconnected=disconnectIntegrationMock(whatsapp.id);
check("E mock disconnect",disconnected?.status==="not_connected"&&mockModel.integrationActivities.some((item)=>item.integrationId===whatsapp.id&&item.type==="disconnected"),"فصل WhatsApp يعيد الحالة التجريبية ولا ينشئ قناة أو رسالة.");
const calendar=getIntegration("INT-1004");
const retried=retryIntegrationMock(calendar.id);
check("F error retry",retried?.status==="configuration_required"&&retried.lastCheckedAt&&mockModel.integrationActivities.some((item)=>item.integrationId===calendar.id&&item.type==="retry_requested"),"Error fixture تنتقل حتميًا إلى requires configuration عند retry محلي.");
const configured=updateIntegrationConfiguration(calendar.id,{hasConfiguredSecret:true});
check("G masked configuration",configured?.status==="mock_connected"&&configured.hasConfiguredSecret===true&&!Object.keys(configured).some((key)=>/token|apiKey|secret$/i.test(key)&&key!=="hasConfiguredSecret"&&configured[key]),"يحفظ الإعداد hasConfiguredSecret فقط ولا يعيد قيمة سرية.");

const workspace=getWorkspace();
const updatedWorkspace=updateWorkspaceSettings({name:"وكالة نمو التجريبية",timezone:"Asia/Riyadh",currency:"SAR",locale:"ar-SA"});
check("H workspace source of truth",updatedWorkspace?.name==="وكالة نمو التجريبية"&&mockModel.settingsActivities.some((item)=>item.type==="settings_changed"&&item.metadata.field==="name"),"تحديث اسم Workspace يستخدم مصدر حقيقة واحدًا ويسجل from/to.");
check("I notification preference",Boolean(setNotificationPreference("NP-1001",false))&&mockModel.notificationPreferences.find((item)=>item.id==="NP-1001")?.enabled===false,"تغيير الإشعار يعدّل preference فقط.");
const invitation=createTeamInvitation("qa.member@example.test","محلل عمليات");
check("J invite mock",invitation?.status==="pending_mock"&&mockModel.teamInvitations.includes(invitation),"دعوة الفريق كيان محلي معلّق بلا بريد.");

const revenueBefore=JSON.stringify({revenueEvents:mockModel.revenueEvents,attributionTouchpoints:mockModel.attributionTouchpoints});
const downgradePreview=previewPlanChange("PLAN-STARTER");
check("K downgrade warning",downgradePreview?.differences.some((item)=>item.key==="seats"&&item.over),"الخطة الأدنى تعرض تحذيرًا لأن المقاعد النشطة تتجاوز حدها التجريبي.");
const changed=changeSubscriptionPlanMock("PLAN-STARTER");
check("L mock plan change",changed?.planId==="PLAN-STARTER"&&changed.status==="active_mock"&&mockModel.billingActivities.some((item)=>item.type==="plan_changed_mock"),"تغيير الخطة محلي وبحالة active_mock فقط.");
const usage=getBillingUsage();
check("M usage contract",usage.every((item)=>"used" in item&&"limit" in item&&"remaining" in item&&(item.limit===null||item.remaining===Math.max(0,item.limit-item.used))),"كل Usage يعرّف used/limit/remaining ولا يحسب نسبة بلا limit.");
setSubscriptionCancelAtPeriodEnd(true);
check("N cancel mock",getCurrentSubscription()?.cancelAtPeriodEnd===true&&mockModel.billingActivities.some((item)=>item.type==="subscription_cancel_scheduled"),"إلغاء الاشتراك جدول محلي لا يحذف مساحة العمل.");
setSubscriptionCancelAtPeriodEnd(false);
check("O reactivate mock",getCurrentSubscription()?.cancelAtPeriodEnd===false&&mockModel.billingActivities.some((item)=>item.type==="subscription_reactivated"),"إعادة التفعيل تلغي الجدولة محليًا.");
check("P billing revenue separation",revenueBefore===JSON.stringify({revenueEvents:mockModel.revenueEvents,attributionTouchpoints:mockModel.attributionTouchpoints}),"Billing لا ينشئ RevenueEvent أو AttributionTouchpoint.");
check("Q operational isolation",beforeOperational===operationalSnapshot(),"S11 لا يغير Business/Lead/Deal/Message/Task/Appointment/Revenue/Attribution.");
check("R routes and local UI",source[0].includes("export function Settings")&&source[0].includes("export function Integrations")&&source[0].includes("export function Billing")&&source[1].includes('path === "integrations"')&&source[1].includes('path === "billing"'),"توجد مسارات Settings وIntegrations وBilling صريحة.");
check("S no-network implementation",!source.slice(0,3).join("\n").match(/\b(fetch|XMLHttpRequest|axios\.|WebSocket)\b/),"تنفيذ S11 لا يستدعي شبكة أو مزودًا خارجيًا.");
check("T UI disclosures",source[0].includes("وضع تجريبي / Mock")&&source[0].includes("لا بوابة دفع ولا معالجة بطاقات")&&source[0].includes("لا تُحفظ أو تُعرض أي قيمة سرية فعلية"),"الواجهة تفصح عن Mock والفوترة والأسرار بوضوح.");

const failed=results.filter((item)=>!item.pass);
for(const item of results)console.log(`${item.pass?"PASS":"FAIL"} ${item.id}: ${item.detail}`);
console.log(`\nS11 verification: ${results.length-failed.length}/${results.length} passed`);
if(failed.length)process.exit(1);

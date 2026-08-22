import { readFile, stat } from "node:fs/promises";
import { readUiSource, readFeature } from "./lib/ui-sources.mjs";
import {
  getAttributionIntegrityReport,
  getDealIntegrityReport,
  getDiscoveryIntegrityReport,
  getLeadIntegrityReport,
  getAutomationIntegrityReport,
  getS11IntegrityReport,
  mockModel,
  state
} from "../client/src/domain/data.js";
import { getIntelligenceIntegrityReport } from "../client/src/domain/intelligence.js";
import { getS8IntegrityReport } from "../client/src/domain/sales-ai.js";
import { getAnalyticsOverview, getAttributionTraces } from "../client/src/domain/analytics-engine.js";

const results=[];
const check=(id,pass,detail)=>results.push({id,pass:Boolean(pass),detail});
const read=(path)=>readFile(new URL(path,import.meta.url),"utf8");
const dataSourceText = await read("../client/src/domain/data.js");
const [app,settings,dashboard,inbox,sales,automation,analytics,data,cssFiles]=await Promise.all([
  readUiSource(),readFeature('settings'),readFeature('dashboard'),readFeature('inbox'),read("../client/src/domain/sales-ai.js"),read("../client/src/domain/automation.js"),readFeature('analytics'),read("../client/src/domain/data.js"),Promise.all([read("../client/src/styles/base.css"),read("../client/src/styles/layout.css"),read("../client/src/styles/responsive.css"),read("../client/src/styles/s10.css")])
]);
const css=cssFiles.join("\n");
const source=[app,settings,dashboard,inbox,sales,automation,analytics,data,css].join("\n");
const analyticsOverview=getAnalyticsOverview(state.analyticsContext);
const traces=getAttributionTraces(analyticsOverview.context);

check("A routes",app.includes('path === "settings/integrations"')&&app.includes('path === "settings/billing"')&&app.includes('path.startsWith("crm/leads/")')&&app.includes('path.startsWith("inbox/")'),"المسارات الأساسية والتفصيلية معرفة صراحة.");
check("B deep links",app.includes('path.startsWith("settings/")')&&app.includes("settingsSection: section")&&settings.includes("go(`settings/${id}`)"),"Settings deep links تعيد القسم الصحيح من المصدر الحالي.");
check("C navigation state",app.includes('route.startsWith("settings/")) return "settings"')&&app.includes('route.startsWith("crm/leads/")) return "crm"')&&app.includes('route.startsWith("deals/")) return "deals"'),"Sidebar يبقى نشطًا في المسارات العميقة الرئيسية.");
check("D dashboard truth",dashboard.includes("getAnalyticsOverview")&&dashboard.includes("getAttributionTraces")&&dashboard.includes("getPipelineStageSummary"),"Dashboard يعتمد selectors S10/S6 المشتركة بدل إعادة حساب مستقلة.");
check("E discovery lifecycle",getDiscoveryIntegrityReport().pass,"إنشاء Job ومعالجة واكتمال وفشل/إعادة محاولة محكومة بعقد S3.");
check("F intelligence lifecycle",getIntelligenceIntegrityReport().pass,"التحليل الحتمي والإشارات والأدلة وحالات insufficient/error سليمة.");
check("G CRM conversion",getLeadIntegrityReport().pass,"التحويل يحفظ Business/source/provenance ويحمي من التكرار.");
check("H deal lifecycle",getDealIntegrityReport().pass,"الصفقات والمراحل والقيمة والـwon/lost وحد الإيراد سليمة.");
check("I inbox lifecycle",mockModel.conversations.every((item)=>mockModel.leads.some((lead)=>lead.id===item.leadId))&&mockModel.messages.every((item)=>mockModel.conversations.some((conversation)=>conversation.id===item.conversationId))&&app.includes("retryMockMessage")&&inbox.includes("renderInbox"),"المحادثات والرسائل والمراجع وإعادة المحاولة محلية وصحيحة.");
check("J copilot insert-only",sales.includes("useSuggestedReply")&&app.includes("أُدرج الرد المقترح في Composer فقط؛ لم تُنشأ أي رسالة.")&&!sales.match(/function useSuggestedReply[\s\S]{0,800}sendMockMessage/),"Copilot يدرج مسودة ولا يرسل رسالة.");
check("K human sender",mockModel.messages.filter((item)=>item.direction==="outbound").every((item)=>item.senderType==="user")&&!mockModel.messages.some((item)=>["agent","automation","ai"].includes(item.senderType)),"كل outbound مرسل بشري ولا يوجد AI/Automation outbound.");
check("L agent boundaries",getS8IntegrityReport().pass&&state.agentMode!=="fully_autonomous"&&!mockModel.agentActions.some((item)=>["send_message","close_deal","revenue_mutation","update_deal_value"].includes(item.type)),"Agent مقيد بالموافقة ولا يملك مسار إرسال أو mutation مالية.");
check("M automation idempotency",getAutomationIntegrityReport().pass,"Idempotency وmanual-only وloop guard والموافقة وحدود الإيراد تمر.");
check("N appointment approval",mockModel.appointments.every((item)=>mockModel.leads.some((lead)=>lead.id===item.leadId)&&mockModel.users.some((user)=>user.id===item.ownerId)&&(!item.dealId||mockModel.deals.some((deal)=>deal.id===item.dealId)))&&(automation.includes("overlapWarning")||dataSourceText.includes("overlapWarning")),"المواعيد تملك Lead/Owner/Deal صحيحة وتنبيه تداخل بلا تقويم خارجي.");
check("O analytics reconciliation",getAttributionIntegrityReport().pass&&analyticsOverview.metrics.revenue.value===382000&&analyticsOverview.metrics.attributedRevenue.value===382000,"الإيراد المعترف به والمنسوب متطابقان ضمن الحقيقة الحالية.");
check("P attribution trace",traces.length===3&&traces.every((trace)=>trace.event&&trace.deal&&trace.lead&&trace.business&&trace.touchpoints.length)&&traces.every((trace)=>trace.attributed<=trace.event.amount),"سلاسل Revenue→Deal→Lead→Business→Touchpoint مكتملة ولا يوجد over-attribution.");
check("Q settings consistency",getS11IntegrityReport().pass&&settings.includes("WorkspaceSection")&&settings.includes("TeamSection")&&settings.includes("NotificationsSection"),"Workspace/Account/Team/Notifications تستند إلى حقيقة S11 واحدة.");
check("R integration mock boundary",mockModel.integrations.every((item)=>item.mode.includes("mock")&&item.status!=="connected")&&!settings.match(/\b(fetch|XMLHttpRequest|WebSocket|axios\.)\b/),"التكاملات Mock معلنة ولا تنفذ شبكة أو OAuth أو provider call.");
check("S billing revenue separation",data.includes("changeSubscriptionPlanMock")&&data.includes("setSubscriptionCancelAtPeriodEnd")&&!data.match(/changeSubscriptionPlanMock[\s\S]{0,1200}(revenueEvents\.push|attributionTouchpoints\.push)/),"تغيير الخطة/الإلغاء المحليان لا ينشئان RevenueEvent أو AttributionTouchpoint.");
check("T no external network",!source.match(/\b(fetch|XMLHttpRequest|WebSocket|axios\.)\b/),"مسارات prototype لا تستدعي شبكة تشغيلية أو backend أو webhook.");
check("U no secrets",!source.match(/sk-[A-Za-z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,}|ghp_[A-Za-z0-9]{20,}|Bearer\s+[A-Za-z0-9._-]{12,}/),"لا توجد قيمة secret أو token أو API key عالية الثقة في المصدر.");
check("V responsive shell",css.includes("@media")&&app.includes("menu-button")&&source.includes("table-wrap"),"Shell والجداول والتنقل لديهم قواعد استجابة للمقاسات الصغيرة.");
check("W accessibility critical paths",app.includes('document.documentElement.dir = "rtl"')&&app.includes("prefersReducedMotion")&&analytics.includes('aria-modal="true"')&&app.includes('event.key === "Escape"')&&app.includes("previous.focus()"),"RTL وreduced motion وModal focus/Escape/restore وحالات نصية متاحة.");
const regressionScripts=["verify-s2-fix.mjs","verify-s3.mjs","verify-s4.mjs","verify-s4-ux.mjs","verify-s5.mjs","verify-s6.mjs","verify-s7.mjs","verify-s8.mjs","verify-s8-runtime.mjs","verify-s9.mjs","verify-s10.mjs","verify-s11.mjs"];
check("X full regression inventory",(await Promise.all(regressionScripts.map((name)=>stat(new URL(`./${name}`,import.meta.url)).then(()=>true).catch(()=>false)))).every(Boolean),"تتوفر جميع فحوص S2–S11 المطلوبة لتشغيل الانحدار الكامل.");

const failed=results.filter((item)=>!item.pass);
for(const item of results)console.log(`${item.pass?"PASS":"FAIL"} ${item.id}: ${item.detail}`);
console.log(`\nS12 verification: ${results.length-failed.length}/${results.length} passed`);
if(failed.length)process.exit(1);
